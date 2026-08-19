import fs from "fs";
import path from "path";
import { IndexedChunk, RetrievalResult } from "./types";
import { embedQuery, cosineSimilarity } from "./embeddings";
import { BM25Index } from "./bm25";

const INDEX_PATH = path.join(process.cwd(), "corpus", "index.json");

let cachedIndex: IndexedChunk[] | null = null;
let cachedBM25: BM25Index | null = null;

function loadIndex(): IndexedChunk[] {
  if (cachedIndex) return cachedIndex;
  if (!fs.existsSync(INDEX_PATH)) {
    throw new Error(
      "corpus/index.json not found. Add real source documents to " +
        "corpus/documents/ and run `npm run ingest` before starting the app."
    );
  }
  cachedIndex = JSON.parse(fs.readFileSync(INDEX_PATH, "utf-8"));
  return cachedIndex!;
}

function getBM25(chunks: IndexedChunk[]): BM25Index {
  if (cachedBM25) return cachedBM25;
  cachedBM25 = new BM25Index(chunks.map((c) => ({ id: c.id, text: c.text })));
  return cachedBM25;
}

/**
 * Hybrid retrieval: reciprocal-rank fusion of vector similarity and BM25
 * lexical search, same pattern taught in the course's RAG module. Neither
 * signal alone is reliable for regulatory text — embeddings miss exact
 * section-number matches, BM25 misses paraphrased questions.
 */
export async function retrieve(query: string, topK = 5): Promise<RetrievalResult[]> {
  const chunks = loadIndex();
  const bm25 = getBM25(chunks);

  const queryEmbedding = await embedQuery(query);
  const vectorRanked = chunks
    .map((c) => ({ id: c.id, score: cosineSimilarity(queryEmbedding, c.embedding) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.max(topK * 3, 15));

  const bm25Ranked = bm25.search(query, Math.max(topK * 3, 15));

  const RRF_K = 60;
  const fused = new Map<string, { rrf: number; vectorScore: number; bm25Score: number }>();

  vectorRanked.forEach((r, i) => {
    const entry = fused.get(r.id) ?? { rrf: 0, vectorScore: 0, bm25Score: 0 };
    entry.rrf += 1 / (RRF_K + i + 1);
    entry.vectorScore = r.score;
    fused.set(r.id, entry);
  });

  bm25Ranked.forEach((r, i) => {
    const entry = fused.get(r.id) ?? { rrf: 0, vectorScore: 0, bm25Score: 0 };
    entry.rrf += 1 / (RRF_K + i + 1);
    entry.bm25Score = r.score;
    fused.set(r.id, entry);
  });

  const chunkById = new Map(chunks.map((c) => [c.id, c]));

  return Array.from(fused.entries())
    .map(([id, v]) => ({
      chunk: chunkById.get(id)!,
      score: v.rrf,
      vectorScore: v.vectorScore,
      bm25Score: v.bm25Score,
    }))
    .filter((r) => r.chunk)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}
