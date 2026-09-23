import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getPendingReviews, logAuditEvent, readAuditLog } from "@/lib/audit";

export const runtime = "nodejs";

/**
 * The architectural answer to "who's liable if it misses a flag":
 *
 * GET  — cases where the AI (via flag_compliance_triggers) suggested a look
 *        and no human has closed it out yet. This is the queue, not a
 *        decision.
 * POST — a named reviewer records their decision. This is the ONLY thing
 *        that closes a case in the audit trail, and it always requires a
 *        reviewerId. The AI's suggestion and the human's decision are
 *        stored as two separate, separately-timestamped, separately-
 *        attributed events (policy_check vs human_review) — never merged
 *        into one record where it'd be unclear which one actually decided
 *        anything.
 *
 * Nothing in this system auto-approves or auto-rejects a case. A missing
 * POST here just means the case sits in the pending queue, visibly
 * unreviewed, forever. That's a feature, not a bug: silence is never
 * mistaken for sign-off.
 */

export async function GET() {
  const pending = await getPendingReviews();
  return NextResponse.json({ pending, count: pending.length });
}

const VALID_DECISIONS = ["approved", "escalated", "override_dismissed"] as const;
type Decision = (typeof VALID_DECISIONS)[number];

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { caseReference, decision, reviewerId, note } = body as {
    caseReference?: string;
    decision?: string;
    reviewerId?: string;
    note?: string;
  };

  if (!caseReference || typeof caseReference !== "string") {
    return NextResponse.json({ error: "caseReference is required." }, { status: 400 });
  }
  if (!decision || !VALID_DECISIONS.includes(decision as Decision)) {
    return NextResponse.json(
      { error: `decision must be one of: ${VALID_DECISIONS.join(", ")}` },
      { status: 400 }
    );
  }
  if (!reviewerId || typeof reviewerId !== "string") {
    // No anonymous sign-off. If we don't know who decided, we haven't
    // actually answered the liability question — we've just moved it.
    return NextResponse.json(
      { error: "reviewerId is required — every human_review event must be attributable." },
      { status: 400 }
    );
  }

  // Pull the AI's own suggestion for this case so it's preserved alongside
  // the human decision, not overwritten by it.
  const priorChecks = await readAuditLog({ caseReference, eventType: "policy_check" });
  const aiSuggested = priorChecks.flatMap((e) => e.payload.matches ?? []);

  const event = await logAuditEvent({
    requestId: randomUUID(),
    eventType: "human_review",
    actor: `human:${reviewerId}`,
    caseReference,
    payload: {
      decision: decision as Decision,
      note: note ?? null,
      aiSuggested,
    },
  });

  return NextResponse.json({ recorded: event });
}
