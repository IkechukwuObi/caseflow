# CaseFlow

A case retrieval and triage assistant for document-heavy back-office
processes, loan applications, account openings, customer disputes, built to
answer an efficiency question, not a compliance one. Of everything found
researching South Africa's three biggest banks' public AI activity, the one
concrete, named, quantified AI product win was Absa's own AI/OCR "Gateway" in
their Debt Review unit: it cut document-indexing time and delivered one-day
turnaround. CaseFlow is the generalized version of that pattern, built as a
portfolio piece: retrieve a case fast, summarize what's pending, and surface
anything worth a human compliance look, without making compliance the point
of the product.

Built while working through Anthropic's "Claude with the Anthropic API"
course (tool use, RAG with hybrid embeddings + BM25 retrieval, MCP,
evaluations, agent workflows) — this project is the applied version of those
modules, not a restatement of them.

## Status: early prototype, synthetic data, said plainly

- The case archive ships with **three synthetic, clearly-labeled demo
  cases** (see `corpus/documents/`), invented for this project. They are
  not real bank data and must never be presented as such.
- `eval/dataset.json` has real questions matched to those three synthetic
  cases, so `npm run eval` actually checks something from the start —
  extend it as you add real (or more realistic synthetic) cases.
- The `flag_compliance_triggers` tool is a small, deliberately simple
  rule-based pattern matcher, not a model call and not a determination. It's
  the security background folded in as a supporting feature. It is not, and
  isn't meant to be, the main pitch of this project.
- **Don't deploy this publicly as a finished product.** It's a demo of the
  retrieval + triage pattern, built on invented case data, until it's
  pointed at something real.

## Architecture

- `lib/corpus.ts` — loads and chunks case documents from `corpus/documents/*.md`
- `lib/embeddings.ts` — Voyage AI embeddings (`voyage-finance-2`, their finance-tuned model)
- `lib/bm25.ts` — dependency-free BM25 lexical search
- `lib/retrieve.ts` — hybrid retrieval (reciprocal rank fusion of vector + BM25 results)
- `lib/tools.ts` — `search_case_archive` (primary) and `flag_compliance_triggers` (secondary), shared by both consumers below
- `app/api/chat/route.ts` — the web chat backend: Claude + tool use over both tools
- `mcp-server/server.ts` — a standalone MCP server exposing the same tools for Claude Desktop/Code
- `scripts/ingest.ts` — embeds `corpus/documents/*.md` into `corpus/index.json`
- `eval/run-eval.ts` — checks retrieval accuracy against `eval/dataset.json`

## Setup

1. `npm install`
2. Copy `.env.example` to `.env.local` and fill in `ANTHROPIC_API_KEY` (from
   console.anthropic.com) and `VOYAGE_API_KEY` (from dash.voyageai.com).
   Never commit `.env.local`.
3. `npm run ingest` — builds `corpus/index.json` from the sample cases (or your own, added per `corpus/documents/README.md`).
4. `npm run dev` — runs the web app at localhost:3000.
5. `npm run eval` — checks retrieval accuracy against `eval/dataset.json` before trusting or demoing the app.

## Running the MCP server

```
npm run mcp
```

Point Claude Desktop's or Claude Code's MCP config at this command to query
the same case archive directly from those clients, outside the web UI.

## Deploying

Deploy to Vercel as a standard Next.js app. Set `ANTHROPIC_API_KEY` and
`VOYAGE_API_KEY` in the Vercel project's Environment Variables — not in any
committed file. `corpus/index.json` needs to be generated (`npm run ingest`)
and committed before deploying.

## What's deliberately not built yet

- No authentication — this is a public demo, not handling real customer data.
- No LLM-based answer grading in the eval, only retrieval accuracy (see
  `eval/run-eval.ts` for why that's the honest starting point).
- Trigger patterns in `flag_compliance_triggers` are a small illustrative
  set, not a real AML/compliance rule engine.
