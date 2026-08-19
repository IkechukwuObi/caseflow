export interface CorpusChunk {
  id: string;
  text: string;
  sourceTitle: string;
  sourceUrl: string;
  section?: string;
}

export interface IndexedChunk extends CorpusChunk {
  embedding: number[];
}

export interface RetrievalResult {
  chunk: CorpusChunk;
  score: number;
  vectorScore: number;
  bm25Score: number;
}
