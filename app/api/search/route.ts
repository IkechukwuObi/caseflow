import { NextRequest, NextResponse } from "next/server";
import { runSearchCaseArchive } from "@/lib/tools";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const { query } = await req.json();
  if (!query || typeof query !== "string") {
    return NextResponse.json({ error: "Missing 'query' string in request body." }, { status: 400 });
  }

  try {
    const result = await runSearchCaseArchive(query);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
