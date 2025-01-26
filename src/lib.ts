export const titleQueryString: string = `
        query titleQuery($query: String!, $anyBaseUrl: [String!]) {
            searchPages(query: $query, filter: {anyBaseUrl: $anyBaseUrl}) {
                url
                wikidotInfo {
                    title
                    rating
                    voteCount
                    createdAt
                }
                alternateTitles {
                    title
                }
                translationOf {
                    url
                    attributions {
                        user {
                            name
                        }
                    }
                }
                attributions {
                    user {
                        name
                    }
                }
            }
        }
    `;

export const userQueryString: string = `
        query userQuery($query: String!, $anyBaseUrl: [String!], $baseUrl: String!) {
            searchUsers(query: $query, filter: {anyBaseUrl: $anyBaseUrl}) {
                name
                wikidotInfo {
                    displayName
                    wikidotId
                    unixName
                }
                authorInfos {
                    site
                    authorPage {
                        translationOf {
                            url
                        }
                        url
                    }
                }
                statistics(baseUrl: $baseUrl) {
                    rank
                    totalRating
                    pageCount
                }
            }
        }
    `;

export const userRankQueryString: string = `
        query userRankQuery($rank: Int!, $anyBaseUrl: [String!], $baseUrl: String!) {
            usersByRank(rank: $rank, filter: {anyBaseUrl: $anyBaseUrl}) {
                name
                wikidotInfo {
                    displayName
                    wikidotId
                    unixName
                }
                authorInfos {
                    site
                    authorPage {
                        translationOf {
                            url
                        }
                        url
                    }
                }
                statistics(baseUrl: $baseUrl) {
                    rank
                    totalRating
                    pageCount
                }
            }
        }
    `;

export interface UserWikidotInfo {
    displayName: string;
    wikidotId: number;
    unixName: string;
}

export interface AuthorInfo {
    site: string;
    authorPage: {
        translationOf: {
            url: string;
        } | null;
        url: string;
    };
}

export interface Statistics {
    rank: number;
    totalRating: number;
    pageCount: number;
}

export interface User {
    name: string;
    wikidotInfo: UserWikidotInfo;
    authorInfos: AuthorInfo[];
    statistics: Statistics;
}

export interface UserQuery {
    searchUsers: User[];
}

export interface UserRankQuery {
    usersByRank: User[];
}

export interface Attribution {
    user: {
        name: string;
    };
}

export interface TitleWikidotInfo {
    title: string;
    rating: number;
    voteCount: number;
    createdAt: Date;
}

export interface Title {
    url: string;
    wikidotInfo: TitleWikidotInfo;
    alternateTitles: {
        title: string;
    }[];
    translationOf: {
        url: string;
        attributions: Attribution[];
    } | null;
    attributions: Attribution[];
}

export interface TitleQuery {
    searchPages: Title[];
}

const apiList: string[] = ["https://api.crom.avn.sh/graphql", "https://zh.xjo.ch/crom/graphql"];

export const branchInfo: Record<string, { url: string }> = {
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
    id: {
        url: "http://id-backrooms-wiki.wikidot.com"
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
    "scp-cn": {
        url: "http://scp-wiki-cn.wikidot.com"
    },
    "scp-cs": {
        url: "http://scp-cs.wikidot.com"
    },
    "scp-de": {
        url: "http://scp-wiki-de.wikidot.com"
    },
    "scp-en": {
        url: "http://scp-wiki.wikidot.com"
    },
    "scp-es": {
        url: "http://lafundacionscp.wikidot.com"
    },
    "scp-fr": {
        url: "http://fondationscp.wikidot.com"
    },
    "scp-int": {
        url: "http://scp-int.wikidot.com"
    },
    "scp-it": {
        url: "http://fondazionescp.wikidot.com"
    },
    "scp-jp": {
        url: "http://scp-jp.wikidot.com"
    },
    "scp-ko": {
        url: "http://scpko.wikidot.com"
    },
    "scp-pl": {
        url: "http://scp-pl.wikidot.com"
    },
    "scp-ptbr": {
        url: "http://scp-pt-br.wikidot.com"
    },
    "scp-ru": {
        url: "http://scp-ru.wikidot.com"
    },
    "scp-th": {
        url: "http://scp-th.wikidot.com"
    },
    "scp-uk": {
        url: "http://scp-ukrainian.wikidot.com"
    },
    "scp-vn": {
        url: "http://scp-vn.wikidot.com"
    },
    na: {
        url: "http://nationarea.wikidot.com"
    },
    all: {
        url: ""
    }
};

export async function cromApiRequest(
    titleQuery: string,
    baseUrl: string,
    endpointIndex: number,
    queryString: string
): Promise<TitleQuery & UserQuery & UserRankQuery> {
    const response: Response = await fetch(apiList[endpointIndex], {
        method: "POST",
        headers: new Headers({
            "Content-Type": "application/json"
        }),
        body: JSON.stringify({
            query: queryString,
            variables: {
                query: titleQuery,
                anyBaseUrl: baseUrl != "" ? baseUrl : null,
                baseUrl: baseUrl,
                rank: parseInt(titleQuery.replace(/#([0-9]{1,15})/, "$1"))
            }
        })
    });

    if (!response.ok) {
        throw new Error("Got status code: " + response.status);
    }

    const { data, errors } = await response.json();

    if (errors && errors.length > 0) {
        if (endpointIndex++ < apiList.length) {
            cromApiRequest(titleQuery, baseUrl, endpointIndex, queryString);
        } else {
            throw new Error("Got errors: " + JSON.stringify(errors));
        }
    }

    return data;
}
