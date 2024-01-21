import { Context, Schema, Logger } from 'koishi'

export const name = 'crom-querier'

export interface Config { }

export const Config: Schema<Config> = Schema.object({})

export function apply(ctx: Context) {
    var titleQueryString =
        " \
    query titleQuery($query: String!, $anyBaseUrl: [String!]) { \
        searchPages(query: $query, filter: {anyBaseUrl: $anyBaseUrl}) { \
            url \
            wikidotInfo { \
                title \
                rating \
                voteCount \
            } \
            alternateTitles { \
                title \
              } \
            translationOf { \
                url \
                attributions { \
                    user { \
                        name \
                    } \
                } \
            } \
            attributions { \
                user { \
                    name \
                } \
            } \
        } \
    } \
        ";

    var userQueryString =
        " \
    query userQuery($query: String!, $anyBaseUrl: [String!], $baseUrl: String!) { \
        searchUsers(query: $query, filter: {anyBaseUrl: $anyBaseUrl}) { \
          name \
          wikidotInfo{ \
            displayName \
            wikidotId \
            unixName \
          } \
          authorInfos{ \
            site \
            authorPage{ \
              url \
            } \
          } \
          statistics(baseUrl: $baseUrl){ \
            rank \
            totalRating \
            pageCount \
          } \
        } \
      }  \
      ";

    var userRankQueryString =
        " \
      query userRankQuery($rank: Int!, $anyBaseUrl: [String!], $baseUrl: String!) { \
        usersByRank(rank: $rank, filter: {anyBaseUrl: $anyBaseUrl}) { \
          name \
          wikidotInfo{ \
            displayName \
            wikidotId \
            unixName \
          } \
          authorInfos{ \
            site \
            authorPage{ \
              translationOf { \
                url \
              } \
              url \
            } \
          } \
          statistics(baseUrl: $baseUrl){ \
            rank \
            totalRating \
            pageCount \
          } \
        } \
      } \
      "

    var apiList = [
        "https://api.crom.avn.sh/graphql",
        "https://zh.xjo.ch/crom/graphql",
    ]

    var branchInfo = {
        cn: {
            url: "http://backrooms-wiki-cn.wikidot.com"
        },
        en: {
            url: "http://backrooms-wiki.wikidot.com"
        },
        es: {
            url: "http://es-backrooms-wiki.wikidot.com"
        },
        fr: {
            url: "http://fr-backrooms-wiki.wikidot.com"
        },
        jp: {
            url: "http://japan-backrooms-wiki.wikidot.com"
        },
        pl: {
            url: "http://pl-backrooms-wiki.wikidot.com"
        },
        ptbr: {
            url: "http://pt-br-backrooms-wiki.wikidot.com"
        },
        ru: {
            url: "http://ru-backrooms-wiki.wikidot.com"
        },
        vn: {
            url: "http://backrooms-vn.wikidot.com"
        },
        all: {
            url: ""
        }
    }

    ctx.on("message", (session) => {
        let titleQueryReg = new RegExp("\{[^\{\}]+\}");
        let authorQueryReg = new RegExp("&[^&]+&");
        let authorRankQueryReg = new RegExp("&([^&]+|)#[0-9]+&");
        let content = session.content;
        if (/&amp;/.test(content)) {
            content = content.replace(/&amp;/g, "&");
        }
        if (titleQueryReg.test(content)) {
            let titleQuery = queryCut(content, titleQueryReg, titleQueryString);
            let title = titleProceed(titleQuery);
            title.then(output => {
                session.sendQueued(output, 1000);
            });
        }
        if (authorQueryReg.test(content)) {
            let authorQuery: Promise<any>;
            let author: Promise<any>;
            if (authorRankQueryReg.test(content)) {
                authorQuery = queryCut(content, authorRankQueryReg, userRankQueryString, true);
                author = userProceed(authorQuery, true);
            } else {
                authorQuery = queryCut(content, authorQueryReg, userQueryString);
                author = userProceed(authorQuery);
            }
            author.then(output => {
                session.sendQueued(output, 1000);
            });
        }
    });

    function queryCut(query: string, queryReg: RegExp, queryString: string, isRank = false) {
        let queryCuted: string;
        let branch: string;
        let branchUrl: string;
        let car: Promise<any>;
        queryCuted = query.match(queryReg)[0].slice(1, -1);
        branch = (/\[[\w]+\]/.test(queryCuted) ? queryCuted.match(/\[[\w]+\]/)[0].slice(1, -1).toLowerCase() : "cn");
        branchUrl = (branchInfo[branch] ? branchInfo[branch]["url"] : branchInfo["cn"]["url"]);
        car = cromApiRequest(isRank ? parseInt(queryCuted.split("#").reverse()[0]) : queryCuted.split("]").reverse()[0], branchUrl, 0, queryString);
        return car;
    }

    async function titleProceed(promise: Promise<any>) {
        return promise.then((Result) => {
            if (Result.searchPages.length == 0) {
                return "未找到文章。";
            }
            let article = Result.searchPages[0];
            let articleURL = article.url;
            let articleRating = article.wikidotInfo.rating;
            let articleTitle = article.wikidotInfo.title;
            let articleVoteCount = article.wikidotInfo.voteCount;
            let isTranslation = (article.translationOf != null ? true : false);
            let articleAuthor = authorOutput(article, isTranslation);
            let articleAlternateTitle = (article.alternateTitles.length != 0 ? " - " + article.alternateTitles[0].title : "");
            return articleTitle + articleAlternateTitle +
                "\n评分：" + articleRating + " (+" + (articleVoteCount - (articleVoteCount - articleRating) / 2) + ", -" + (articleVoteCount - articleRating) / 2 + ")\n" +
                articleAuthor +
                "\n" + articleURL;
        });
    }

    async function userProceed(promise: Promise<any>, isRank = false) {
        return promise.then((Object) => {
            if ((isRank ? Object.usersByRank : Object.searchUsers).length == 0) {
                return "未找到用户。";
            }
            let user = (isRank ? Object.usersByRank : Object.searchUsers)[0];
            let userName = user.name;
            let userRank = user.statistics.rank;
            let userTotalRating = user.statistics.totalRating;
            let userPageCount = user.statistics.pageCount;
            let userAuthorPageUrl = authorpageOutput(user.authorInfos);
            return userName + " (#" + userRank + ")" +
                "\n总分：" + userTotalRating + "   总页面数：" + userPageCount + "   平均分：" + (userTotalRating / userPageCount).toFixed(2) +
                (userAuthorPageUrl != "" ? "\n作者页：" + userAuthorPageUrl : "");
        })
    }

    function authorpageOutput(authorInfos: any) {
        if (authorInfos.length == 0) {
            return "";
        }
        for (let i = 0; i <= authorInfos.length; i++) {
            if (authorInfos[i].authorPage.translationOf == null) {
                return authorInfos[i].authorPage.url;
            }
        }
        return "";
    }

    function authorOutput(article: any, isTranslation: boolean) {
        let author = "";
        isTranslation ? author += "译者：" : author += "作者：";
        for (let i = 0; i < article.attributions.length; i++) {
            author += article.attributions[i].user.name;
            if (i != article.attributions.length - 1) {
                author += "、";
            }
        }
        if (isTranslation) {
            author += "\t作者："
            article = article.translationOf;
            for (let i = 0; i < article.attributions.length; i++) {
                author += article.attributions[i].user.name;
                if (i != article.attributions.length - 1) {
                    author += "、";
                }
            }
        }

        return author;
    }

    async function cromApiRequest(titleQuery: any, baseUrl: string, endpointIndex: number, queryString: string) {
        const response = await fetch(apiList[endpointIndex], {
            method: "POST",
            headers: new Headers({
                "Content-Type": "application/json"
            }),
            body: JSON.stringify({
                query: queryString,
                variables: {
                    query: titleQuery,
                    anyBaseUrl: (baseUrl != "" ? baseUrl : null),
                    baseUrl: baseUrl,
                    rank: titleQuery
                }
            })
        });

        if (!response.ok) {
            throw new Error("Got status code: " + response.status);
        }

        const {
            data,
            errors
        } = await response.json();

        if (errors && errors.length > 0) {
            if (endpointIndex++ < apiList.length) {
                cromApiRequest(titleQuery, baseUrl, endpointIndex, queryString);
            } else {
                throw new Error("Got errors: " + JSON.stringify(errors));
            }
        }

        return data;
    }
}
