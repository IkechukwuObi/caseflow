import Anthropic from "@anthropic-ai/sdk";
import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  searchCaseArchiveTool,
  runSearchCaseArchive,
  flagComplianceTriggersTool,
  runFlagComplianceTriggers,
  type ToolContext,
} from "@/lib/tools";
import { logAuditEvent } from "@/lib/audit";

export const runtime = "nodejs";

const SYSTEM_PROMPT = `You are CaseFlow, an assistant that helps a case-processing team find,
summarize, and triage case files (loan applications, account openings, customer disputes)
quickly. Your job is speed and accuracy on real case content, not general advice.

Hard rules, non-negotiable:
1. Always call search_case_archive before answering a question about a specific case.
   Never answer from general knowledge or invent case details.
2. When summarizing a case, base every fact on the retrieved case text. If asked something
   the case text doesn't cover, say so rather than guessing.
3. After retrieving a case, call flag_compliance_triggers on its text. For any match, mention
   the rule ID, severity, which team it routes to, and the regulation reference plainly as
   "worth a human look," never as a conclusion. This is a supporting check, not the main
   point of your answer — don't over-index on it.
4. If search_case_archive returns found: false, say plainly that the case isn't in the
   archive yet. Do not fill the gap with a plausible-sounding guess.
5. Keep answers concise and focused on what a busy case handler actually needs: status,
   key facts, what's pending, and anything flagged. Close by stating this case still needs
   a human sign-off before it's actioned — nothing here is a final decision.`;

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY is not configured on the server." },
      { status: 500 }
    );
  }

  const { messages } = await req.json();
  const anthropic = new Anthropic({ apiKey });

  const conversation: Anthropic.MessageParam[] = messages;

  // One requestId ties every tool call and the final answer for this turn
  // together in the audit trail (lib/audit.ts) — this is how a case gets
  // reconstructed after the fact: what was searched, what fired, what was
  // said, in order.
  const requestId = randomUUID();
  const ctx: ToolContext = { requestId };

  // Tracks the most recently retrieved case so the compliance-check audit
  // event can be attributed to a specific case, even though Claude's
  // flag_compliance_triggers call only carries caseText, not a reference —
  // that correlation is orchestration logic, not something the tool schema
  // should have to carry.
  let lastCase: { reference?: string; title?: string } = {};

  // Tool-use loop: Claude may call either tool one or more times before
  // producing a final answer. Cap iterations defensively so a malformed
  // loop can't run away.
  for (let turn = 0; turn < 6; turn++) {
    const response = await anthropic.messages.create({
      // Verify this model ID against https://docs.claude.com/en/docs/about-claude/models
      // before deploying — model slugs change and this scaffold was written without
      // live access to confirm the current one.
      model: "claude-sonnet-4-5",
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      tools: [searchCaseArchiveTool, flagComplianceTriggersTool],
      messages: conversation,
    });

    const toolUseBlocks = response.content.filter(
      (block): block is Anthropic.ToolUseBlock => block.type === "tool_use"
    );

    if (toolUseBlocks.length === 0) {
      const textBlock = response.content.find((b) => b.type === "text");
      const reply = textBlock && textBlock.type === "text" ? textBlock.text : "";
      await logAuditEvent({
        requestId,
        eventType: "assistant_answer",
        actor: "system",
        caseReference: lastCase.reference,
        caseTitle: lastCase.title,
        payload: { reply },
      });
      return NextResponse.json({ reply, requestId });
    }

    conversation.push({ role: "assistant", content: response.content });

    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const block of toolUseBlocks) {
      if (block.name === "search_case_archive") {
        const args = block.input as { query: string };
        const result = await runSearchCaseArchive(args.query, ctx);
        if (result.found && result.cases) {
          lastCase = { reference: result.cases[0]?.reference, title: result.cases[0]?.title };
        }
        toolResults.push({
          type: "tool_result",
          tool_use_id: block.id,
          content: JSON.stringify(result),
        });
      } else if (block.name === "flag_compliance_triggers") {
        const args = block.input as { caseText: string };
        const result = await runFlagComplianceTriggers(args.caseText, ctx, {
          caseReference: lastCase.reference,
          caseTitle: lastCase.title,
        });
        toolResults.push({
          type: "tool_result",
          tool_use_id: block.id,
          content: JSON.stringify(result),
        });
      }
    }

    conversation.push({ role: "user", content: toolResults });
  }

  return NextResponse.json(
    { error: "Tool-use loop did not resolve to a final answer within the iteration limit." },
    { status: 500 }
  );
}
