import { retrieve } from "./retrieve";
import { evaluatePolicyTriggers, type PolicyMatch } from "./policy";
import { logAuditEvent } from "./audit";

/**
 * The single source of truth for tool behavior. Both the web app's API route
 * and the standalone MCP server call these same functions, so the chat UI
 * and a developer connected via Claude Desktop/Claude Code get identical
 * behavior — including identical audit logging, since that lives in here
 * too, not bolted onto just one consumer.
 *
 * Two tools, deliberately split:
 *  - search_case_archive: the primary pitch. Case retrieval and triage —
 *    the efficiency story (generalized from Absa's real AI/OCR Gateway win).
 *  - flag_compliance_triggers: a small secondary tool, now backed by the
 *    structured policy engine in lib/policy.ts instead of a flat regex
 *    list. Still rule-based, still cheap, still not a model call — a
 *    richer signal isn't the same thing as a judgment call.
 *
 * ToolContext carries the requestId used to correlate every tool call and
 * the final answer in the audit trail (lib/audit.ts). Callers (the chat
 * route, the MCP server) generate one requestId per conversation turn and
 * pass it through every tool invocation in that turn.
 */

export interface ToolContext {
  requestId: string;
}

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

export interface CaseSearchResult {
  found: boolean;
  message?: string;
  cases?: { text: string; title: string; reference: string; relevance: number }[];
}

export async function runSearchCaseArchive(
  query: string,
  ctx: ToolContext
): Promise<CaseSearchResult> {
  const results = await retrieve(query, 5);
  const top = results[0];

  await logAuditEvent({
    requestId: ctx.requestId,
    eventType: "retrieval",
    actor: "system",
    caseReference: top?.chunk.sourceUrl,
    caseTitle: top?.chunk.sourceTitle,
    payload: {
      query,
      resultCount: results.length,
      topScore: top ? Number(top.score.toFixed(4)) : null,
    },
  });

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

export const flagComplianceTriggersTool = {
  name: "flag_compliance_triggers",
  description:
    "Scan case text against the policy engine (lib/policy.ts) for known " +
    "trigger patterns — large undocumented cash movements, inconsistent " +
    "new-business turnover, authentication/fraud patterns, cross-border " +
    "activity. Each result includes a rule ID, severity, which team it " +
    "routes to (compliance vs fraud), and the regulation it's tied to " +
    "where one applies. Rule-based, not a judgment call — flags patterns " +
    "worth a human review, does not assert a conclusion about the case. " +
    "When reporting results, cite the rule ID and regulation reference, " +
    "not just the plain-language label.",
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

export async function runFlagComplianceTriggers(
  caseText: string,
  ctx: ToolContext,
  caseInfo?: { caseReference?: string; caseTitle?: string }
) {
  const matches: PolicyMatch[] = evaluatePolicyTriggers(caseText);

  await logAuditEvent({
    requestId: ctx.requestId,
    eventType: "policy_check",
    actor: "system",
    caseReference: caseInfo?.caseReference,
    caseTitle: caseInfo?.caseTitle,
    payload: { matches },
  });

  return {
    triggered: matches.length > 0,
    matches,
    note:
      matches.length > 0
        ? "These are rule matches only, not a compliance determination. Route each to the " +
          "listed team for human review — see matches[].team and matches[].regulationRef."
        : "No known trigger patterns matched.",
  };
}
