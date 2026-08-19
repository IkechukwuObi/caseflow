import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import {
  searchCaseArchiveTool,
  runSearchCaseArchive,
  flagComplianceTriggersTool,
  runFlagComplianceTriggers,
} from "@/lib/tools";

export const runtime = "nodejs";

const SYSTEM_PROMPT = `You are CaseFlow, an assistant that helps a case-processing team find,
summarize, and triage case files (loan applications, account openings, customer disputes)
quickly. Your job is speed and accuracy on real case content, not general advice.

Hard rules, non-negotiable:
1. Always call search_case_archive before answering a question about a specific case.
   Never answer from general knowledge or invent case details.
2. When summarizing a case, base every fact on the retrieved case text. If asked something
   the case text doesn't cover, say so rather than guessing.
3. After retrieving a case, call flag_compliance_triggers on its text and mention any
   triggered patterns plainly as "worth a human compliance look," not as a conclusion.
   This is a supporting check, not the main point of your answer — don't over-index on it.
4. If search_case_archive returns found: false, say plainly that the case isn't in the
   archive yet. Do not fill the gap with a plausible-sounding guess.
5. Keep answers concise and focused on what a busy case handler actually needs: status,
   key facts, what's pending, and anything flagged.`;

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
      return NextResponse.json({
        reply: textBlock && textBlock.type === "text" ? textBlock.text : "",
      });
    }

    conversation.push({ role: "assistant", content: response.content });

    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const block of toolUseBlocks) {
      if (block.name === "search_case_archive") {
        const args = block.input as { query: string };
        const result = await runSearchCaseArchive(args.query);
        toolResults.push({
          type: "tool_result",
          tool_use_id: block.id,
          content: JSON.stringify(result),
        });
      } else if (block.name === "flag_compliance_triggers") {
        const args = block.input as { caseText: string };
        const result = runFlagComplianceTriggers(args.caseText);
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
