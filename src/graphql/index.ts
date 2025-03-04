import { gql } from "graphql-tag";

export const queries = {
    titleQuery: gql`
        query titleQuery($query: String!, $anyBaseUrl: [String!]) {
            searchPages(query: $query, filter: { anyBaseUrl: $anyBaseUrl }) {
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
    `,
    userQuery: gql`
        query userQuery($query: String!, $anyBaseUrl: [String!], $baseUrl: String!) {
            searchUsers(query: $query, filter: { anyBaseUrl: $anyBaseUrl }) {
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
    `,
    userRankQuery: gql`
        query userRankQuery($rank: Int!, $anyBaseUrl: [String!], $baseUrl: String!) {
            usersByRank(rank: $rank, filter: { anyBaseUrl: $anyBaseUrl }) {
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
    `,
};
