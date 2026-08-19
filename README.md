# RegLens

A South African financial regulatory due-diligence assistant. Built to answer
one narrow, evidenced gap: banks' own public disclosures (Absa's 2025
Integrated Report, Standard Bank's R13m FIC Act fine) describe compliance
teams either working from stale training or too slow/fragmented to respond
to new regulatory guidance. RegLens is a RAG + tool-use assistant that answers
FICA/SARB/POPIA compliance questions strictly from an ingested, citable source
corpus, with a matching MCP server so the same retrieval tool can be used from
Claude Desktop or Claude Code directly.

Built while working through Anthropic's "Claude with the Anthropic API"
course (tool use, RAG with hybrid embeddings + BM25 retrieval, MCP,
evaluations, agent workflows) — this project is the applied version of those
modules, not a restatement of them.

## Status: early prototype, not production, said plainly

- The corpus ships **empty**. See `corpus/documents/README.md` — real FICA,
  SARB, and POPIA source text needs to be added before this answers anything.
  It does not ship with invented regulatory text, because a compliance tool
  that hallucinates its own source material is worse than an empty one.
- The eval set (`eval/dataset.json`) ships empty for the same reason: it
  should be built from real questions against real ingested documents, not
  placeholder Q&A pairs.
- **Do not deploy this publicly as "production-grade" until the corpus is
  populated and `npm run eval` passes on real questions.** The whole point of
  building it this way was to not repeat the mistake of shipping a demo
  dressed up as a finished product.

## Architecture

- `lib/corpus.ts` — loads and chunks real source documents from `corpus/documents/*.md`
- `lib/embeddings.ts` — Voyage AI embeddings (`voyage-finance-2`, their finance-tuned model)
- `lib/bm25.ts` — dependency-free BM25 lexical search
- `lib/retrieve.ts` — hybrid retrieval (reciprocal rank fusion of vector + BM25 results)
- `lib/tools.ts` — the `search_regulatory_guidance` tool definition, shared by both consumers below
- `app/api/chat/route.ts` — the web chat backend: Claude + tool use + this repo's retrieval tool
- `mcp-server/server.ts` — a standalone MCP server exposing the same tool over stdio, for Claude Desktop/Code
- `scripts/ingest.ts` — embeds `corpus/documents/*.md` into `corpus/index.json`
- `eval/run-eval.ts` — checks retrieval accuracy against `eval/dataset.json`

## Setup

1. `npm install`
2. Copy `.env.example` to `.env.local` and fill in `ANTHROPIC_API_KEY` (from
   console.anthropic.com) and `VOYAGE_API_KEY` (from dash.voyageai.com).
   Never commit `.env.local`.
3. Add real source documents to `corpus/documents/` — see that folder's README.
4. `npm run ingest` — builds `corpus/index.json` from what you added.
5. `npm run dev` — runs the web app at localhost:3000.
6. Add real eval questions to `eval/dataset.json`, then `npm run eval` to check
   retrieval accuracy before trusting or demoing the app.

## Running the MCP server

```
npm run mcp
```

Point Claude Desktop's or Claude Code's MCP config at this command to query
the same corpus directly from those clients, outside the web UI.

## Deploying

Deploy to Vercel as a standard Next.js app. Set `ANTHROPIC_API_KEY` and
`VOYAGE_API_KEY` in the Vercel project's Environment Variables — not in any
committed file. `corpus/index.json` needs to be generated (`npm run ingest`)
and committed before deploying, since Vercel's build step doesn't have your
API keys available unless you also set them there for the build environment.

## What's deliberately not built yet

- No authentication — this is a public demo, not handling real customer data.
- No LLM-based answer grading in the eval, only retrieval accuracy (see
  `eval/run-eval.ts` for why that's the honest starting point).
- No specific bank's proprietary policies — the corpus is public regulatory
  text only.
