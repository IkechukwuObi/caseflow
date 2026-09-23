/**
 * Compliance policy engine.
 *
 * This replaces the flat, unlabeled regex list that used to live in
 * lib/tools.ts. The old version told a reviewer *that* something matched.
 * This version tells them *which rule*, *why it exists*, *how serious it
 * is*, and *what regulation it's tied to* — the difference between a
 * pattern match and something a compliance team could actually act on.
 *
 * It is still, deliberately, not a determination. See PolicyMatch.rationale
 * and the disclaimer at the bottom of evaluatePolicyTriggers() — every
 * result is a "worth a human look" signal, never a verdict.
 *
 * Regulation references are South Africa-specific (FICA — the Financial
 * Intelligence Centre Act, 38 of 2001) because that's the jurisdiction this
 * portfolio project is built for. Where a citation is precise, it's cited.
 * Where the mapping between a pattern and a specific section is genuinely
 * fuzzy (cross-border activity touches several regimes depending on the
 * transaction), that's said plainly instead of invented — same standard
 * the rest of this repo holds itself to.
 */

export type Severity = "low" | "medium" | "high";

export interface PolicyRule {
  id: string;
  label: string;
  team: "compliance" | "fraud"; // who this should actually route to
  regulationRef: string;
  rationale: string;
  /** Returns matched evidence snippets, or an empty array if the rule didn't fire. */
  evaluate: (caseText: string) => { severity: Severity; evidence: string[] }[];
}

export interface PolicyMatch {
  ruleId: string;
  label: string;
  team: "compliance" | "fraud";
  severity: Severity;
  regulationRef: string;
  rationale: string;
  evidence: string[];
}

// Pulls Rand amounts out of free text ("R62,000", "R 49 999.99", "R85000")
// so the cash-threshold rule can compare against the real FICA figure
// instead of just matching the word "cash".
function extractRandAmounts(text: string): number[] {
  const matches = text.matchAll(/R\s?([\d]{1,3}(?:[,\s]\d{3})*(?:\.\d{1,2})?)/g);
  const amounts: number[] = [];
  for (const m of matches) {
    const normalized = m[1].replace(/[,\s]/g, "");
    const value = Number(normalized);
    if (!Number.isNaN(value)) amounts.push(value);
  }
  return amounts;
}

function simplePatternRule(
  matches: (text: string) => string[]
): PolicyRule["evaluate"] {
  return (caseText: string) => {
    const evidence = matches(caseText);
    return evidence.length > 0 ? [{ severity: "medium" as Severity, evidence }] : [];
  };
}

function snippetAround(text: string, index: number, radius = 60): string {
  const start = Math.max(0, index - radius);
  const end = Math.min(text.length, index + radius);
  return (start > 0 ? "…" : "") + text.slice(start, end).trim() + (end < text.length ? "…" : "");
}

function matchSnippets(text: string, pattern: RegExp): string[] {
  const snippets: string[] = [];
  const re = new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : pattern.flags + "g");
  for (const m of text.matchAll(re)) {
    if (m.index !== undefined) snippets.push(snippetAround(text, m.index));
  }
  return snippets;
}

// FICA s28: the actual current threshold, R49,999.99, as of the October
// 2022 revision (Money Laundering and Terrorist Financing Control
// Regulations). Below the threshold, a cash mention is still worth a
// look (medium); at or above it, it's a hard reporting obligation (high).
const CTR_THRESHOLD = 49_999.99;

export const POLICY_RULES: PolicyRule[] = [
  {
    id: "SA-FICA-S28-CTR",
    label: "Cash transaction may meet the mandatory reporting threshold",
    team: "compliance",
    regulationRef:
      "FICA (Act 38 of 2001) s28 — accountable institutions must report cash " +
      "transactions of R49,999.99 or more to the FIC within the prescribed period.",
    rationale:
      "A cash amount at or above the s28 threshold isn't optional to report — " +
      "flagging it early avoids a missed CTR deadline, not just a fraud concern.",
    evaluate: (caseText) => {
      const cashMentioned = /cash deposit|cash payment/i.test(caseText);
      if (!cashMentioned) return [];
      const amounts = extractRandAmounts(caseText);
      const max = amounts.length > 0 ? Math.max(...amounts) : null;
      const evidence = matchSnippets(caseText, /cash deposit|cash payment/i);
      if (max !== null && max >= CTR_THRESHOLD) {
        return [{ severity: "high", evidence }];
      }
      // Cash mentioned but no amount parsed, or amount below threshold —
      // still worth a look, just not a confirmed reporting obligation.
      return [{ severity: "medium", evidence }];
    },
  },
  {
    id: "SA-FICA-S29-S21-UNDOCUMENTED-FUNDS",
    label: "Cash movement with no source-of-funds document attached",
    team: "compliance",
    regulationRef:
      "FICA s21 (customer due diligence) and s29 (suspicious/unusual transaction " +
      "reporting, no threshold — triggered by suspicion, not amount).",
    rationale:
      "An undocumented source of funds is a due-diligence gap regardless of " +
      "the Rand amount — this is why it's a separate rule from the CTR check, " +
      "not folded into it.",
    evaluate: simplePatternRule((text) =>
      matchSnippets(
        text,
        /no accompanying source-of-funds|no source-of-funds document|unverified source of funds/i
      )
    ),
  },
  {
    id: "SA-FICA-S21-NEW-BUSINESS-TURNOVER",
    label: "Declared turnover inconsistent with new-business trading history",
    team: "compliance",
    regulationRef:
      "FICA s21 — the risk-based approach expects enhanced due diligence when " +
      "risk indicators like this are present; no fixed threshold in the Act itself.",
    rationale:
      "A brand-new entity projecting high turnover with no trading history to " +
      "support it is a standard onboarding risk indicator, not proof of anything.",
    evaluate: simplePatternRule((text) =>
      matchSnippets(text, /newly registered|no trading history/i)
    ),
  },
  {
    id: "SA-FRAUD-AUTH-PATTERN",
    label: "Authentication/fraud dispute pattern (OTP, 3-D Secure, SIM-swap)",
    team: "fraud",
    regulationRef:
      "Not an AML/FICA trigger — internal fraud and authentication policy. " +
      "Listed separately so it routes to the fraud team, not compliance.",
    rationale:
      "OTP and SIM-swap patterns are a fraud-operations concern, distinct from " +
      "money-laundering triggers. Lumping every flag into one 'compliance' " +
      "bucket sends the wrong team the wrong case.",
    evaluate: simplePatternRule((text) => matchSnippets(text, /otp|3-d secure|sim-swap/i)),
  },
  {
    id: "SA-CROSS-BORDER-FX",
    label: "Cross-border or foreign-currency activity",
    team: "compliance",
    regulationRef:
      "Touches FICA's risk-based due-diligence provisions and SARB exchange " +
      "control rules depending on the transaction — this mapping is " +
      "deliberately left general. Verify the specific applicable provision " +
      "against current FIC/SARB guidance before treating this as compliance " +
      "advice; don't trust this citation the way you can trust the s28 one above.",
    rationale:
      "Flagged as a broader category rather than a precise citation because " +
      "the actual applicable rule genuinely depends on transaction specifics " +
      "this pattern match can't see.",
    evaluate: simplePatternRule((text) =>
      matchSnippets(text, /cross-border|foreign currency|offshore/i)
    ),
  },
];

export function evaluatePolicyTriggers(caseText: string): PolicyMatch[] {
  const results: PolicyMatch[] = [];
  for (const rule of POLICY_RULES) {
    for (const hit of rule.evaluate(caseText)) {
      results.push({
        ruleId: rule.id,
        label: rule.label,
        team: rule.team,
        severity: hit.severity,
        regulationRef: rule.regulationRef,
        rationale: rule.rationale,
        evidence: hit.evidence,
      });
    }
  }
  // Highest severity first so a reviewer sees the thing that matters most,
  // not whatever happened to be first in POLICY_RULES.
  const order: Record<Severity, number> = { high: 0, medium: 1, low: 2 };
  return results.sort((a, b) => order[a.severity] - order[b.severity]);
}
