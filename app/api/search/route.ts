import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { runSearchCaseArchive } from "@/lib/tools";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const { query } = await req.json();
  if (!query || typeof query !== "string") {
    return NextResponse.json({ error: "Missing 'query' string in request body." }, { status: 400 });
  }

  try {
    // One-shot public demo endpoint, no conversation to correlate across —
    // each hit gets its own requestId for the audit trail.
    const result = await runSearchCaseArchive(query, { requestId: randomUUID() });
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
