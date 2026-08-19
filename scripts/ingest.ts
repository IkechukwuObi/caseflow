import fs from "fs";
import path from "path";
import dotenv from "dotenv";

// This script runs standalone via tsx, outside Next.js's own dev/build
// lifecycle, so unlike the app itself it does NOT get .env.local loaded
// automatically. Load it explicitly, first thing, before anything else
// touches process.env.
dotenv.config({ path: path.join(process.cwd(), ".env.local") });

import { loadCorpusChunks } from "../lib/corpus";
import { embedDocuments } from "../lib/embeddings";
import { IndexedChunk } from "../lib/types";

const OUT_PATH = path.join(process.cwd(), "corpus", "index.json");
const BATCH_SIZE = 32;

async function main() {
  const chunks = loadCorpusChunks();

  if (chunks.length === 0) {
    console.error(
      "\nNo documents found in corpus/documents/. This is expected on a fresh " +
        "clone — see corpus/documents/README.md for where to get real FICA, " +
        "SARB, and POPIA source text before running ingest.\n"
    );
    process.exit(1);
  }

  console.log(`Embedding ${chunks.length} chunks from real source documents...`);
  const indexed: IndexedChunk[] = [];

  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE);
    const embeddings = await embedDocuments(batch.map((c) => c.text));
    batch.forEach((chunk, j) => indexed.push({ ...chunk, embedding: embeddings[j] }));
    console.log(`  embedded ${Math.min(i + BATCH_SIZE, chunks.length)}/${chunks.length}`);
  }

  fs.writeFileSync(OUT_PATH, JSON.stringify(indexed, null, 2));
  console.log(`\nWrote ${indexed.length} indexed chunks to ${OUT_PATH}`);
}

main().catch((err) => {
  console.error("Ingest failed:", err);
  process.exit(1);
});
