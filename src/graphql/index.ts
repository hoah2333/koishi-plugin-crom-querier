import { gql } from "graphql-tag";

import fs from "fs";
import path from "path";

import type { DocumentNode } from "graphql";

const loadQuery = (filename: string): DocumentNode => gql(fs.readFileSync(path.join(__dirname, filename), "utf8"));

export const queries = {
    titleQuery: loadQuery("titleQuery.graphql"),
    userQuery: loadQuery("userQuery.graphql"),
    userRankQuery: loadQuery("userRankQuery.graphql"),
};
