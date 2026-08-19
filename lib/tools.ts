import { retrieve } from "./retrieve";

/**
 * The single source of truth for tool behavior. Both the web app's API route
 * and the standalone MCP server call these same functions, so the chat UI
 * and a developer connected via Claude Desktop/Claude Code get identical
 * behavior.
 *
 * Two tools, deliberately split:
 *  - search_case_archive: the primary pitch. Case retrieval and triage —
 *    the efficiency story (generalized from Absa's real AI/OCR Gateway win).
 *  - flag_compliance_triggers: a small secondary tool. Cheap, rule-based,
 *    no model call needed. This is the security/compliance background
 *    folded in as a supporting feature, not the crux of the product.
 */

export const searchCaseArchiveTool = {
  name: "search_case_archive",
  description:
    "Search the ingested case archive (loan applications, account opening " +
    "cases, customer disputes) for the case matching a query, to summarize " +
    "status, key facts, and what's pending. Returns matching case text with " +
    "its title and reference so an answer can point back to the specific case.",
  input_schema: {
    type: "object" as const,
    properties: {
      query: {
        type: "string",
        description: "What case or case detail to search for (name, reference, or topic).",
      },
    },
    required: ["query"],
  },
};

export async function runSearchCaseArchive(query: string) {
  const results = await retrieve(query, 5);
  if (results.length === 0) {
    return {
      found: false,
      message:
        "No matching case in the current archive. Do not guess at case details — " +
        "tell the user this case isn't in the indexed archive yet.",
    };
  }
  return {
    found: true,
    cases: results.map((r) => ({
      text: r.chunk.text,
      title: r.chunk.sourceTitle,
      reference: r.chunk.sourceUrl,
      relevance: Number(r.score.toFixed(4)),
    })),
  };
}

// Lightweight, non-AI, keyword-pattern flags. Deliberately NOT model-based —
// this is a lookup against known trigger patterns, not a judgment call, so
// it can't hallucinate and doesn't need a tool-use round trip on its own.
const TRIGGER_PATTERNS: { label: string; pattern: RegExp }[] = [
  { label: "Undocumented large cash movement", pattern: /cash deposit|cash payment/i },
  { label: "New business with high declared turnover", pattern: /newly registered|no trading history/i },
  { label: "Authentication/fraud dispute pattern", pattern: /otp|3-d secure|sim-swap/i },
  { label: "Cross-border or foreign-currency activity", pattern: /cross-border|foreign currency|offshore/i },
];

export const flagComplianceTriggersTool = {
  name: "flag_compliance_triggers",
  description:
    "Scan case text for known compliance-relevant trigger patterns (large " +
    "undocumented cash movements, inconsistent new-business turnover, " +
    "authentication/fraud patterns, cross-border activity). Rule-based, not " +
    "a judgment call — flags patterns worth a human compliance review, does " +
    "not assert a conclusion about the case.",
  input_schema: {
    type: "object" as const,
    properties: {
      caseText: {
        type: "string",
        description: "The case text to scan for trigger patterns.",
      },
    },
    required: ["caseText"],
  },
};

export function runFlagComplianceTriggers(caseText: string) {
  const matches = TRIGGER_PATTERNS.filter((t) => t.pattern.test(caseText)).map((t) => t.label);
  return {
    triggered: matches.length > 0,
    patterns: matches,
    note:
      matches.length > 0
        ? "These are pattern matches only, not a compliance determination. Route to a human reviewer."
        : "No known trigger patterns matched.",
  };
}
