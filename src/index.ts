import { Context, Schema } from "koishi";
import type { Argv } from "koishi";
import { cromApiRequest } from "./lib";
import { titleQueryString, userQueryString, userRankQueryString, branchInfo } from "./lib";
import type { TitleQuery, UserQuery, UserRankQuery } from "./lib";

export const name: string = "crom-querier";

export interface Config {}

export const Config: Schema<Config> = Schema.object({});

export function apply(ctx: Context): void {
    ctx.command("author <作者:string> [分部名称:string]", "查询作者信息。\n默认搜索后室中文站。", {
        authority: 0
    })
        .alias("作者")
        .alias("作")
        .alias("au")
        .action(async (_: Argv, author: string, branch: string | undefined): Promise<string> => {
            if (branch != undefined && !Object.keys(branchInfo).includes(branch)) {
                return "格式错误，请检查输入格式。";
            }

            let authorRankQueryReg: RegExp = new RegExp("#[0-9]{1,15}");
            let branchUrl: string = branch ? branchInfo[branch]["url"] : branchInfo["cn"]["url"];

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
                let user: UserQuery["searchUsers"][0] | UserRankQuery["usersByRank"][0] = (
                    isRank
                        ? (object as UserRankQuery).usersByRank
                        : (object as UserQuery).searchUsers
                )[0];
                let userTotalRating: number = user.statistics.totalRating;
                let userPageCount: number = user.statistics.pageCount;
                let userAuthorPageUrl: string = authorpageOutput(
                    user.name,
                    user.authorInfos,
                    branch
                ).replace(/^http(s)?\:\/\/([a-z]+\-wiki\-cn)/, "https://$2");

                return `${user.name} (#${
                    user.statistics.rank
                })\n总分：${userTotalRating}   总页面数：${userPageCount}   平均分：${(
                    userTotalRating / userPageCount
                ).toFixed(2)}${userAuthorPageUrl == "" ? "" : `\n作者页：${userAuthorPageUrl}`}`;
            }

            function authorpageOutput(
                author: string,
                authorInfos: UserQuery["searchUsers"][0]["authorInfos"],
                branch: string
            ): string {
                if (authorInfos.length == 0) {
                    return "";
                }
                authorInfos = authorInfos.filter(
                    (info: UserQuery["searchUsers"][0]["authorInfos"][0]): boolean => {
                        return (
                            info.authorPage.translationOf == null &&
                            !info.authorPage.url.includes("old:") &&
                            !info.authorPage.url.includes("deleted:")
                        );
                    }
                );
                let filterInfo: UserQuery["searchUsers"][0]["authorInfos"][0][] =
                    authorInfos.filter(
                        (info: UserQuery["searchUsers"][0]["authorInfos"][0]): boolean => {
                            return info.authorPage.url.includes(author);
                        }
                    );
                if (filterInfo.length != 0) {
                    return (
                        filterInfo.find(
                            (info: UserQuery["searchUsers"][0]["authorInfos"][0]): boolean => {
                                return info.site == branch;
                            }
                        )?.authorPage.url ?? filterInfo[0]?.authorPage.url
                    );
                } else {
                    return (
                        authorInfos.find(
                            (info: UserQuery["searchUsers"][0]["authorInfos"][0]): boolean => {
                                return info.site == branch;
                            }
                        )?.authorPage.url ??
                        authorInfos[0]?.authorPage.url ??
                        ""
                    );
                }
            }
        });

    ctx.command("search <标题:string> [分部名称:string]", "查询文章信息。\n默认搜索后室中文站。", {
        authority: 0
    })
        .alias("搜索")
        .alias("搜")
        .alias("sr")
        .action(async (_: Argv, title: string, branch: string | undefined): Promise<string> => {
            if (branch != undefined && !Object.keys(branchInfo).includes(branch)) {
                return "格式错误，请检查输入格式。";
            }

            let branchUrl: string = branch ? branchInfo[branch]["url"] : branchInfo["cn"]["url"];

            return titleProceed(await cromApiRequest(title, branchUrl, 0, titleQueryString));

            function titleProceed(title: TitleQuery): string {
                if (title.searchPages.length == 0) {
                    return "未找到文章。";
                }
                let article: TitleQuery["searchPages"][0] = title.searchPages[0];
                let articleRating: TitleQuery["searchPages"][0]["wikidotInfo"]["rating"] =
                    article.wikidotInfo.rating;
                let articleVoteCount: TitleQuery["searchPages"][0]["wikidotInfo"]["voteCount"] =
                    article.wikidotInfo.voteCount;
                return `${article.wikidotInfo.title}${
                    article.alternateTitles.length != 0
                        ? " - " + article.alternateTitles[0].title
                        : ""
                }\n评分：${articleRating} (+${
                    articleVoteCount - (articleVoteCount - articleRating) / 2
                }, -${(articleVoteCount - articleRating) / 2})\n${authorOutput(
                    article,
                    article.translationOf != null ? true : false
                )}\n${article.url.replace(/^http(s)?\:\/\/([a-z]+\-wiki\-cn)/, "https://$2")}`;
            }

            function authorOutput(
                article: TitleQuery["searchPages"][0],
                isTranslation: boolean
            ): string {
                let author: string = "";
                isTranslation ? (author += "译者：") : (author += "作者：");
                for (let i = 0; i < article.attributions.length; i++) {
                    author += article.attributions[i].user.name;
                    if (i != article.attributions.length - 1) {
                        author += "、";
                    }
                }
                if (isTranslation) {
                    author += "\t作者：";
                    let translatedArticle: TitleQuery["searchPages"][0]["translationOf"] =
                        article.translationOf;
                    for (let i = 0; i < translatedArticle.attributions.length; i++) {
                        author += translatedArticle.attributions[i].user.name;
                        if (i != translatedArticle.attributions.length - 1) {
                            author += "、";
                        }
                    }
                }

                return author;
            }
        });
}
