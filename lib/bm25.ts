// Minimal, dependency-free BM25 implementation. This is the "lexical search"
// half of the hybrid retrieval pattern from the course — plain keyword overlap
// scoring, which catches exact-term matches (section numbers, defined terms
// like "customer due diligence") that embeddings alone can miss or blur.

export interface BM25Doc {
  id: string;
  tokens: string[];
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

export class BM25Index {
  private docs: BM25Doc[] = [];
  private df = new Map<string, number>();
  private avgDocLen = 0;
  private k1 = 1.5;
  private b = 0.75;

  constructor(documents: { id: string; text: string }[]) {
    this.docs = documents.map((d) => ({ id: d.id, tokens: tokenize(d.text) }));
    const totalLen = this.docs.reduce((sum, d) => sum + d.tokens.length, 0);
    this.avgDocLen = totalLen / (this.docs.length || 1);

    for (const doc of this.docs) {
      const seen = new Set(doc.tokens);
      for (const term of seen) {
        this.df.set(term, (this.df.get(term) ?? 0) + 1);
      }
    }
  }

  search(query: string, topK = 10): { id: string; score: number }[] {
    const queryTerms = tokenize(query);
    const N = this.docs.length;
    const scores: { id: string; score: number }[] = [];

    for (const doc of this.docs) {
      let score = 0;
      const docLen = doc.tokens.length;
      const termFreq = new Map<string, number>();
      for (const t of doc.tokens) termFreq.set(t, (termFreq.get(t) ?? 0) + 1);

      for (const term of queryTerms) {
        const tf = termFreq.get(term) ?? 0;
        if (tf === 0) continue;
        const df = this.df.get(term) ?? 0;
        const idf = Math.log(1 + (N - df + 0.5) / (df + 0.5));
        const denom = tf + this.k1 * (1 - this.b + (this.b * docLen) / this.avgDocLen);
        score += idf * ((tf * (this.k1 + 1)) / denom);
      }

      if (score > 0) scores.push({ id: doc.id, score });
    }

    return scores.sort((a, b) => b.score - a.score).slice(0, topK);
  }
}
