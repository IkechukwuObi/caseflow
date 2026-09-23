/**
 * Audit trail.
 *
 * The pushback this answers: "your compliance check is a supporting signal
 * with no traceability." Every retrieval, every policy check, and every
 * human decision now gets logged as its own event, so any case can be
 * reconstructed after the fact: what was searched, what fired, who signed
 * off, and — critically — what the AI *suggested* versus what the *human*
 * *decided*, kept as two separate, separately-attributable records.
 *
 * That last split is the answer to "who's liable if it misses a flag":
 * the AI's output is logged as a recommendation (eventType "policy_check"),
 * never as a decision. Only a "human_review" event closes a case, and it
 * always records who made the call. Liability sits with the recorded human
 * decision, the same way it does in every real vendor in this space —
 * this file is what makes that a property of the system, not just a claim
 * in a pitch.
 *
 * ---
 * Storage, said plainly (same standard as the rest of this repo):
 *
 * This appends JSON Lines to a file — /tmp on Vercel (the only writable
 * path there), the local project folder everywhere else. That's fine for
 * `npm run dev` and for demoing the shape of an audit trail. It is NOT
 * fine as real production audit storage: /tmp on Vercel isn't guaranteed
 * to survive a cold start or to be shared across concurrent invocations,
 * so events can go missing under real load. What it does guarantee, after
 * an earlier version of this file didn't: a storage failure never breaks
 * the actual search, chat, or review request — see the try/catch in
 * every function below. Swapping this for a real audit store (Postgres,
 * Supabase, anything append-only and queryable) is a drop-in replacement
 * — every caller of this module goes through logAuditEvent/readAuditLog
 * only, never touches the file directly, so only this file needs to
 * change.
 */

import { randomUUID } from "crypto";
import { promises as fs } from "fs";
import os from "os";
import path from "path";
import type { PolicyMatch } from "./policy";

export type AuditEventType = "retrieval" | "policy_check" | "assistant_answer" | "human_review";

export interface AuditEvent {
  id: string;
  requestId: string;
  timestamp: string;
  eventType: AuditEventType;
  actor: string; // "system" for AI-driven events, "human:<reviewerId>" for sign-off
  caseReference?: string;
  caseTitle?: string;
  payload: Record<string, unknown>;
}

// process.cwd() is READ-ONLY on Vercel's serverless functions (and most
// serverless platforms) outside of the one writable scratch directory,
// /tmp. Writing to a folder under cwd, which is what this file did in an
// earlier version, throws EROFS on every single request in production,
// not just "doesn't persist" — it breaks search, chat, and review outright.
// `process.env.VERCEL` is set automatically by Vercel, so this picks /tmp
// there and the local project folder everywhere else (npm run dev).
const AUDIT_LOG_PATH = process.env.VERCEL
  ? path.join(os.tmpdir(), "caseflow-audit-log.jsonl")
  : path.join(process.cwd(), "audit", "audit-log.jsonl");

async function ensureAuditDir(): Promise<void> {
  await fs.mkdir(path.dirname(AUDIT_LOG_PATH), { recursive: true });
}

/**
 * Audit logging is a side channel, never a dependency of the main request.
 * Every write and read below is wrapped so a storage failure — wrong
 * permissions, disk full, /tmp evicted, anything — degrades to "this one
 * event didn't get logged," never to "the user's search or chat request
 * failed." A silent audit gap is a known, visible limitation (see the
 * module comment further down); a 500 on every case lookup is an outage.
 * Failures still print to the server logs so they're not invisible to you.
 */
export async function logAuditEvent(
  event: Omit<AuditEvent, "id" | "timestamp">
): Promise<AuditEvent> {
  const full: AuditEvent = {
    ...event,
    id: randomUUID(),
    timestamp: new Date().toISOString(),
  };
  try {
    await ensureAuditDir();
    await fs.appendFile(AUDIT_LOG_PATH, JSON.stringify(full) + "\n", "utf-8");
  } catch (err) {
    console.error("[audit] failed to write event (continuing without audit log):", err);
  }
  return full;
}

export async function readAuditLog(filter?: {
  requestId?: string;
  caseReference?: string;
  eventType?: AuditEventType;
}): Promise<AuditEvent[]> {
  let events: AuditEvent[] = [];
  try {
    const raw = await fs.readFile(AUDIT_LOG_PATH, "utf-8");
    events = raw
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line) as AuditEvent);
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
      console.error("[audit] failed to read audit log (returning empty):", err);
    }
    return [];
  }
  return events.filter((e) => {
    if (filter?.requestId && e.requestId !== filter.requestId) return false;
    if (filter?.caseReference && e.caseReference !== filter.caseReference) return false;
    if (filter?.eventType && e.eventType !== filter.eventType) return false;
    return true;
  });
}

/**
 * Cases where the AI flagged something (a policy_check event with matches)
 * but no human_review event has closed it out yet. This is the queue a
 * review UI would show a case handler: "the AI suggested a look here, and
 * nobody's signed off on it."
 */
export async function getPendingReviews(): Promise
  { caseReference: string; caseTitle?: string; requestId: string; matches: PolicyMatch[]; flaggedAt: string }[]
> {
  const events = await readAuditLog();
  const policyChecks = events.filter(
    (e) => e.eventType === "policy_check" && ((e.payload.matches as PolicyMatch[]) ?? []).length > 0
  );
  const reviewed = new Set(
    events.filter((e) => e.eventType === "human_review").map((e) => e.caseReference)
  );
  return policyChecks
    .filter((e) => e.caseReference && !reviewed.has(e.caseReference))
    .map((e) => ({
      caseReference: e.caseReference!,
      caseTitle: e.caseTitle,
      requestId: e.requestId,
      matches: e.payload.matches as PolicyMatch[],
      flaggedAt: e.timestamp,
    }));
}