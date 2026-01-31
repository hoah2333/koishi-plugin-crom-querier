import type { TitleQuery, UserQuery, UserRankQuery } from "./types";

const apiList: string[] = [
  "https://api.crom.avn.sh/graphql",
  "https://apiv1.crom.avn.sh/graphql",
  "https://zh.xjo.ch/crom/graphql",
];

export const branchInfo: Record<string, { url: string }> = {
  "cn": { url: "http://backrooms-wiki-cn.wikidot.com" },
  "en": { url: "http://backrooms-wiki.wikidot.com" },
  "es": { url: "http://es-backrooms-wiki.wikidot.com" },
  "fr": { url: "http://fr-backrooms-wiki.wikidot.com" },
  "id": { url: "http://id-backrooms-wiki.wikidot.com" },
  "jp": { url: "http://japan-backrooms-wiki.wikidot.com" },
  "pl": { url: "http://pl-backrooms-wiki.wikidot.com" },
  "ptbr": { url: "http://pt-br-backrooms-wiki.wikidot.com" },
  "ru": { url: "http://ru-backrooms-wiki.wikidot.com" },
  "vn": { url: "http://backrooms-vn.wikidot.com" },
  "scp-cn": { url: "http://scp-wiki-cn.wikidot.com" },
  "scp-cs": { url: "http://scp-cs.wikidot.com" },
  "scp-de": { url: "http://scp-wiki-de.wikidot.com" },
  "scp-en": { url: "http://scp-wiki.wikidot.com" },
  "scp-es": { url: "http://lafundacionscp.wikidot.com" },
  "scp-fr": { url: "http://fondationscp.wikidot.com" },
  "scp-int": { url: "http://scp-int.wikidot.com" },
  "scp-it": { url: "http://fondazionescp.wikidot.com" },
  "scp-jp": { url: "http://scp-jp.wikidot.com" },
  "scp-ko": { url: "http://scpko.wikidot.com" },
  "scp-pl": { url: "http://scp-pl.wikidot.com" },
  "scp-ptbr": { url: "http://scp-pt-br.wikidot.com" },
  "scp-ru": { url: "http://scp-ru.wikidot.com" },
  "scp-th": { url: "http://scp-th.wikidot.com" },
  "scp-uk": { url: "http://scp-ukrainian.wikidot.com" },
  "scp-vn": { url: "http://scp-vn.wikidot.com" },
  "na": { url: "http://nationarea.wikidot.com" },
};

export async function cromApiRequest(
  titleQuery: string,
  baseUrl: string,
  endpointIndex: number = 0,
  queryString: string,
): Promise<TitleQuery & UserQuery & UserRankQuery> {
  if (endpointIndex >= apiList.length) {
    throw new Error("所有API端点均已尝试但均失败");
  }

  try {
    const response: Response = await fetch(apiList[endpointIndex], {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: queryString,
        variables: {
          query: titleQuery,
          anyBaseUrl: baseUrl !== "" ? baseUrl : null,
          baseUrl,
          rank: parseInt(titleQuery.replace(/#([0-9]{1,15})/, "$1")) || 0,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`请求失败，状态码: ${response.status}`);
    }

    const { data, errors } = await response.json();

    if (errors && errors.length > 0) {
      return await cromApiRequest(titleQuery, baseUrl, endpointIndex + 1, queryString);
    }

    return data;
  } catch (error) {
    if (endpointIndex < apiList.length - 1) {
      return await cromApiRequest(titleQuery, baseUrl, endpointIndex + 1, queryString);
    }
    throw error;
  }
}

export function getBranchUrl(branch: string): string {
  return branchInfo[branch]?.url || "";
}
