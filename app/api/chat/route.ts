import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { searchRegulatoryGuidanceTool, runSearchRegulatoryGuidance } from "@/lib/tools";

export const runtime = "nodejs";

const SYSTEM_PROMPT = `You are RegLens, an assistant that answers South African financial
compliance and due-diligence questions (FICA, SARB Prudential Authority guidance, POPIA,
and related standards) STRICTLY from the ingested source corpus.

Hard rules, non-negotiable:
1. Always call search_regulatory_guidance before answering a substantive compliance question.
   Never answer from general knowledge alone.
2. Every factual claim in your answer must be traceable to a passage the tool returned.
   Cite the source title for each claim.
3. If the tool returns found: false, or the returned passages don't actually answer the
   question, say plainly that the current corpus doesn't cover this yet. Do not fill the
   gap with a plausible-sounding guess. A wrong compliance answer is worse than no answer.
4. Keep answers concise and point to the specific section/source rather than summarizing broadly.`;

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

  // Tool-use loop: Claude may call search_regulatory_guidance one or more
  // times before producing a final answer. Cap iterations defensively so a
  // malformed loop can't run away.
  for (let turn = 0; turn < 5; turn++) {
    const response = await anthropic.messages.create({
      // Verify this model ID against https://docs.claude.com/en/docs/about-claude/models
      // before deploying — model slugs change and this scaffold was written without
      // live access to confirm the current one.
      model: "claude-sonnet-4-5",
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      tools: [searchRegulatoryGuidanceTool],
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
      if (block.name === "search_regulatory_guidance") {
        const args = block.input as { query: string };
        const result = await runSearchRegulatoryGuidance(args.query);
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
