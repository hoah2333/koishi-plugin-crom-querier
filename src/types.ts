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

interface TitleWikidotInfo {
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
