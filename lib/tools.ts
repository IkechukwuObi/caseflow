import { retrieve } from "./retrieve";

/**
 * The single source of truth for what "search_regulatory_guidance" does.
 * Both the web app's API route and the standalone MCP server call this same
 * function, so a bank employee asking through the chat UI and a developer
 * connected via Claude Desktop/Claude Code get identical retrieval behavior.
 */
export const searchRegulatoryGuidanceTool = {
  name: "search_regulatory_guidance",
  description:
    "Search the ingested corpus of South African financial regulation " +
    "(FICA, SARB Prudential Authority guidance, POPIA, and related standards) " +
    "for passages relevant to a compliance or due-diligence question. " +
    "Returns the matching passages with their source title and URL so the " +
    "answer can be cited rather than asserted.",
  input_schema: {
    type: "object" as const,
    properties: {
      query: {
        type: "string",
        description: "The compliance or regulatory question to search for.",
      },
    },
    required: ["query"],
  },
};

export async function runSearchRegulatoryGuidance(query: string) {
  const results = await retrieve(query, 5);
  if (results.length === 0) {
    return {
      found: false,
      message:
        "No matching passages in the current corpus. The corpus may not yet " +
        "cover this topic — do not guess at an answer, tell the user this " +
        "specific document isn't indexed yet.",
    };
  }
  return {
    found: true,
    passages: results.map((r) => ({
      text: r.chunk.text,
      sourceTitle: r.chunk.sourceTitle,
      sourceUrl: r.chunk.sourceUrl,
      relevance: Number(r.score.toFixed(4)),
    })),
  };
}
