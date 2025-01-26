import { Context, Schema } from "koishi";
import type { Argv } from "koishi";
import { cromApiRequest } from "./lib";
import { titleQueryString, userQueryString, userRankQueryString, branchInfo } from "./lib";
import type {
    Title,
    TitleWikidotInfo,
    TitleQuery,
    User,
    UserQuery,
    UserRankQuery,
    AuthorInfo,
    Attribution
} from "./lib";

export const name: string = "crom-querier";

export interface Config {}

export const Config: Schema<Config> = Schema.object({});

// 将分部检查逻辑提取为独立函数
function validateBranch(branch: string | undefined): string | undefined {
    if (branch && !Object.keys(branchInfo).includes(branch)) {
        return "格式错误，请检查输入格式。";
    }
    return undefined;
}

// 添加URL处理函数
function normalizeUrl(url: string): string {
    return url
        .replace(/^http(s)?\:\/\/backrooms-wiki-cn.wikidot.com/, "https://backroomswiki.cn")
        .replace(/^http(s)?\:\/\/([a-z]+\-wiki\-cn)/, "https://$2");
}

export function apply(ctx: Context): void {
    ctx.command("author <作者:string> [分部名称:string]", "查询作者信息。\n默认搜索后室中文站。")
        .alias("作者")
        .alias("作")
        .alias("au")
        .action(async (_: Argv, author: string, branch: string | undefined): Promise<string> => {
            const branchError = validateBranch(branch);
            if (branchError) return branchError;

            const authorRankQueryReg: RegExp = new RegExp("#[0-9]{1,15}");
            const branchUrl: string = branch ? branchInfo[branch].url : branchInfo.cn.url;

            return userProceed(
                await cromApiRequest(
                    author,
                    branchUrl,
                    0,
                    authorRankQueryReg.test(author) ? userRankQueryString : userQueryString
                ),
                branchUrl,
                authorRankQueryReg.test(author)
            );

            function userProceed(
                object: UserQuery | UserRankQuery,
                branch: string,
                isRank: boolean = false
            ): string {
                if (
                    Object.keys(
                        isRank
                            ? (object as UserRankQuery).usersByRank
                            : (object as UserQuery).searchUsers
                    ).length == 0
                ) {
                    return "未找到用户。";
                }
                const user: User = (
                    isRank
                        ? (object as UserRankQuery).usersByRank
                        : (object as UserQuery).searchUsers
                )[0];
                const userTotalRating: number = user.statistics.totalRating;
                const userPageCount: number = user.statistics.pageCount;
                const userAuthorPageUrl: string = normalizeUrl(
                    authorpageOutput(user.name, user.authorInfos, branch)
                );

                return `${user.name} (#${
                    user.statistics.rank
                })\n总分：${userTotalRating}   总页面数：${userPageCount}   平均分：${(
                    userTotalRating / userPageCount
                ).toFixed(2)}${userAuthorPageUrl == "" ? "" : `\n作者页：${userAuthorPageUrl}`}`;
            }

            function authorpageOutput(
                author: string,
                authorInfos: AuthorInfo[],
                branch: string
            ): string {
                if (authorInfos.length == 0) {
                    return "";
                }

                const filteredInfos = authorInfos.filter(
                    (info: AuthorInfo): boolean =>
                        info.authorPage.translationOf == null &&
                        !info.authorPage.url.includes("old:") &&
                        !info.authorPage.url.includes("deleted:")
                );

                const matchingAuthorInfos = filteredInfos.filter((info: AuthorInfo): boolean =>
                    info.authorPage.url.includes(author)
                );

                return matchingAuthorInfos.length > 0
                    ? matchingAuthorInfos.find((info: AuthorInfo): boolean => info.site === branch)
                          ?.authorPage.url ?? matchingAuthorInfos[0]?.authorPage.url
                    : filteredInfos.find((info: AuthorInfo): boolean => info.site === branch)
                          ?.authorPage.url ??
                          filteredInfos[0]?.authorPage.url ??
                          "";
            }
        });

    ctx.command("search <标题:string> [分部名称:string]", "查询文章信息。\n默认搜索后室中文站。")
        .alias("搜索")
        .alias("搜")
        .alias("sr")
        .action(async (_: Argv, title: string, branch: string | undefined): Promise<string> => {
            const branchError = validateBranch(branch);
            if (branchError) return branchError;

            const branchUrl: string = branch ? branchInfo[branch].url : branchInfo.cn.url;

            return titleProceed(await cromApiRequest(title, branchUrl, 0, titleQueryString));

            function titleProceed(title: TitleQuery): string {
                if (title.searchPages.length == 0) {
                    return "未找到文章。";
                }

                const article: Title = title.searchPages[0];
                const { rating, voteCount } = article.wikidotInfo;
                const positiveVotes: number = (voteCount + rating) / 2;
                const negativeVotes: number = (voteCount - rating) / 2;

                const alternateTitle: string = article.alternateTitles.length
                    ? ` - ${article.alternateTitles[0].title}`
                    : "";

                return `${article.wikidotInfo.title}${alternateTitle}
评分：${rating} (+${positiveVotes}, -${negativeVotes})
${authorOutput(article, Boolean(article.translationOf))}
${normalizeUrl(article.url)}`;
            }

            function authorOutput(article: Title, isTranslation: boolean): string {
                const prefix: string = isTranslation ? "译者：" : "作者：";
                const authors: string = article.attributions
                    .map((attr: Attribution): string => attr.user.name)
                    .join("、");

                if (!isTranslation) {
                    return `${prefix}${authors}`;
                }

                const originalAuthors: string = article.translationOf.attributions
                    .map((attr: Attribution): string => attr.user.name)
                    .join("、");

                return `${prefix}${authors}\t作者：${originalAuthors}`;
            }
        });
}
