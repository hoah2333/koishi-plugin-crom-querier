import { Context, Schema } from "koishi";
import { queries } from "./graphql";
import { branchInfo, cromApiRequest } from "./lib";

import type { Event } from "@satorijs/protocol";
import type { Argv } from "koishi";
import type { Attribution, AuthorInfo, Title, TitleQuery, User, UserQuery, UserRankQuery } from "./types";

declare module "koishi" {
  interface Tables {
    cromQuerier: CromQuerierTable;
  }
}

interface CromQuerierTable {
  id?: number;
  platform: string;
  channelId: string;
  defaultBranch: string;
}

export const name: string = "crom-querier";

export const inject: string[] = ["database"];

export interface Config {
  bannedUsers: string[];
  bannedTitles: string[];
  bannedTags: string[];
}

export const Config: Schema<Config> = Schema.object({
  bannedUsers: Schema.array(Schema.string()).description("禁止查询的用户列表"),
  bannedTitles: Schema.array(Schema.string()).description("禁止查询的文章列表"),
  bannedTags: Schema.array(Schema.string()).description("禁止查询的标签列表"),
}).description("禁止查询配置");

export function apply(ctx: Context, config: Config): void {
  ctx.model.extend("cromQuerier", {
    id: "unsigned",
    platform: "string(64)",
    channelId: "string(64)",
    defaultBranch: "string(64)",
  });
  const titleQueryString: string = queries.titleQuery.loc?.source.body;
  const userQueryString: string = queries.userQuery.loc?.source.body;
  const userRankQueryString: string = queries.userRankQuery.loc?.source.body;

  const normalizeUrl = (url: string): string =>
    url
      .replace(/^https?:\/\/backrooms-wiki-cn.wikidot.com/, "https://brcn.backroomswiki.cn")
      .replace(/^https?:\/\/scp-wiki-cn.wikidot.com/, "https://scpcn.backroomswiki.cn")
      .replace(/^https?:\/\/([a-z]+-wiki-cn|nationarea)/, "https://$1");

  const getBranchUrl = async (
    branch: string | undefined,
    lastStr: string | undefined,
    { platform, channel: { id: channelId } }: Event,
  ): Promise<string> => {
    const branchUrls: CromQuerierTable[] = await ctx.database.get("cromQuerier", { platform, channelId });
    if (Object.keys(branchInfo).includes(lastStr)) {
      return branchInfo[lastStr].url;
    } else if (branch && Object.keys(branchInfo).includes(branch)) {
      return branchInfo[branch].url;
    } else if (branchUrls.length > 0) {
      return branchInfo[branchUrls[0].defaultBranch].url;
    } else {
      return branchInfo.cn.url;
    }
  };

  ctx
    .command("default-branch <分部名称:string>", "设置默认分部。")
    .alias("默认分部")
    .alias("默认")
    .alias("db")
    .action(async (argv: Argv, branch: string): Promise<string> => {
      const platform: string = argv.session.event.platform;
      const channelId: string = argv.session.event.channel.id;
      if (!branch || !Object.keys(branchInfo).includes(branch) || branch === "all") {
        return "分部名称不正确。";
      }
      ctx.database.upsert("cromQuerier", [{ channelId, platform, defaultBranch: branch }], ["platform", "channelId"]);
      return `已将本群默认查询分部设置为: ${branch}`;
    });

  ctx
    .command("author <作者:string> [分部名称:string]", "查询作者信息。\n默认搜索后室中文站。")
    .alias("作者")
    .alias("作")
    .alias("au")
    .action(
      async (argv: Argv, author: string, branch: string | undefined): Promise<JSX.IntrinsicElements["template"]> => {
        const branchUrl: string = await getBranchUrl(branch, argv.args.at(-1), argv.session.event);

        const isRankQuery: boolean = /^#[0-9]{1,15}$/.test(author);
        const queryString: string = isRankQuery ? userRankQueryString : userQueryString;

        const authorName: string =
          (branch && !Object.keys(branchInfo).includes(branch)) || !author ?
            Object.keys(branchInfo).includes(argv.args.at(-1)) ?
              argv.args.slice(0, -1).join(" ")
            : argv.args.join(" ")
          : author;

        const authorpageOutput = (author: string, authorInfos: AuthorInfo[], branch: string): string => {
          if (!authorInfos || authorInfos.length === 0) {
            return "";
          }

          const filteredInfos: AuthorInfo[] = authorInfos.filter(
            (info: AuthorInfo): boolean =>
              info.authorPage.translationOf == null &&
              !info.authorPage.url.includes("old:") &&
              !info.authorPage.url.includes("deleted:"),
          );

          if (filteredInfos.length === 0) return "";

          const matchingAuthorInfos: AuthorInfo[] = filteredInfos.filter((info: AuthorInfo): boolean =>
            info.authorPage.url.includes(author),
          );

          return matchingAuthorInfos.length > 0 ?
              (matchingAuthorInfos.find((info: AuthorInfo): boolean => info.site === branch)?.authorPage.url ??
                matchingAuthorInfos[0]?.authorPage.url)
            : (filteredInfos.find((info: AuthorInfo): boolean => info.site === branch)?.authorPage.url ??
                filteredInfos[0]?.authorPage.url ??
                "");
        };

        const User = <T extends UserQuery | UserRankQuery>({
          object,
          branch,
          isRank,
        }: {
          object: T;
          branch: string;
          isRank: boolean;
        }): JSX.IntrinsicElements["template"] => {
          const dataArray: User[] = isRank ? (object as UserRankQuery).usersByRank : (object as UserQuery).searchUsers;

          if (!dataArray || dataArray.length === 0) {
            return <template>未找到用户。</template>;
          }

          const selectedIndex: number = dataArray.findIndex(
            (user: User): boolean => !config.bannedUsers.some((banned: string): boolean => user.name === banned),
          );

          if (selectedIndex === -1) {
            return <template>未找到符合条件的用户。</template>;
          }

          const user: User = dataArray[selectedIndex];
          const userTotalRating: number = user.statistics.totalRating;
          const userPageCount: number = user.statistics.pageCount;
          const userAuthorPageUrl: string = normalizeUrl(authorpageOutput(user.name, user.authorInfos, branch));
          const averageRating: string = userPageCount > 0 ? (userTotalRating / userPageCount).toFixed(2) : "0.00";

          return (
            <template>
              <quote id={argv.session.event.message.id} />
              {user.name} (#{user.statistics.rank})
              <br />
              总分：{userTotalRating}&emsp;总页面数：{userPageCount}&emsp;平均分：
              {averageRating}
              {userAuthorPageUrl && (
                <template>
                  <br />
                  作者页：{userAuthorPageUrl}
                </template>
              )}
            </template>
          );
        };

        try {
          const result = await cromApiRequest(authorName, branchUrl, 0, queryString);
          return <User object={result} branch={branchUrl} isRank={isRankQuery} />;
        } catch (err) {
          return <template>查询失败: {err.message || "未知错误"}</template>;
        }
      },
    );

  ctx
    .command("search <标题:string> [分部名称:string]", "查询文章信息。\n默认搜索后室中文站。")
    .alias("搜索")
    .alias("搜")
    .alias("sr")
    .action(
      async (argv: Argv, title: string, branch: string | undefined): Promise<JSX.IntrinsicElements["template"]> => {
        const branchUrl = await getBranchUrl(branch, argv.args.at(-1), argv.session.event);
        const titleName: string =
          (branch && !Object.keys(branchInfo).includes(branch)) || !title ?
            Object.keys(branchInfo).includes(argv.args.at(-1)) ?
              argv.args.slice(0, -1).join(" ")
            : argv.args.join(" ")
          : title;

        const Author = ({
          article,
          isTranslation,
        }: {
          article: Title;
          isTranslation: boolean;
        }): JSX.IntrinsicElements["text"] => {
          const prefix: string = isTranslation ? "译者：" : "作者：";

          if (!article.attributions) return <template>{prefix} 未知</template>;

          const authors: string = article.attributions.map((attr: Attribution): string => attr.user.name).join("、");

          if (!isTranslation) {
            return (
              <template>
                {prefix}
                {authors}
              </template>
            );
          }

          if (!article.translationOf || !article.translationOf.attributions) {
            return (
              <template>
                {prefix}
                {authors} 作者：未知
              </template>
            );
          }

          const originalAuthors: string = article.translationOf.attributions
            .map((attr: Attribution): string => attr.user.name)
            .join("、");

          return (
            <template>
              {prefix}
              {authors} 作者：{originalAuthors}
            </template>
          );
        };

        const TitleProceed = ({ titleData }: { titleData: TitleQuery }): JSX.IntrinsicElements["template"] => {
          if (!titleData.searchPages || titleData.searchPages.length === 0) {
            return <template>未找到文章。</template>;
          }

          const selectedIndex: number = titleData.searchPages.findIndex((article: Title): boolean => {
            const isBannedTitle: boolean = config.bannedTitles.includes(article.wikidotInfo.title);
            const isBannedUser: boolean = config.bannedUsers.some((user: string): boolean =>
              article.attributions.some((attr: Attribution): boolean => attr.user.name === user),
            );
            const isBannedTag: boolean = config.bannedTags.some((tag: string): boolean =>
              article.wikidotInfo.tags.includes(tag),
            );
            return !(isBannedTitle || isBannedUser || isBannedTag);
          });

          if (selectedIndex === -1) {
            return <template>未找到符合条件的文章。</template>;
          }

          const article: Title = titleData.searchPages[selectedIndex];
          const { rating, voteCount } = article.wikidotInfo;
          const positiveVotes: number = Math.round((voteCount + rating) / 2);
          const negativeVotes: number = Math.round((voteCount - rating) / 2);

          const alternateTitle: string | null =
            article.alternateTitles && article.alternateTitles.length > 0 ?
              <> - {article.alternateTitles[selectedIndex].title}</>
            : null;

          return (
            <template>
              <quote id={argv.session.event.message.id} />
              {article.wikidotInfo.title}
              {alternateTitle}
              <br />
              评分：{rating} (+{positiveVotes}, -{negativeVotes})
              <br />
              <Author article={article} isTranslation={Boolean(article.translationOf)} />
              <br />
              {normalizeUrl(article.url)}
            </template>
          );
        };

        try {
          const result = await cromApiRequest(titleName, branchUrl, 0, titleQueryString);
          return <TitleProceed titleData={result} />;
        } catch (err) {
          return <template>查询失败：{err.message || "未知错误"}</template>;
        }
      },
    );
}
