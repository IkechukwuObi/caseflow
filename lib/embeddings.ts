import { VoyageAIClient } from "voyageai";

// voyage-finance-2 is Voyage's domain-tuned model for financial text, which is
// a better fit here than the general-purpose voyage-2 given the corpus is
// banking regulation. Confirmed against the voyageai SDK's own type definitions
// (see EmbedRequest) rather than assumed.
const EMBEDDING_MODEL = "voyage-finance-2";

let client: VoyageAIClient | null = null;

function getClient(): VoyageAIClient {
  if (!client) {
    const apiKey = process.env.VOYAGE_API_KEY;
    if (!apiKey) {
      throw new Error(
        "VOYAGE_API_KEY is not set. Add it to .env.local for local dev, " +
          "or Vercel's Environment Variables for deployment."
      );
    }
    client = new VoyageAIClient({ apiKey });
  }
  return client;
}

export async function embedDocuments(texts: string[]): Promise<number[][]> {
  const response = await getClient().embed({
    input: texts,
    model: EMBEDDING_MODEL,
    inputType: "document",
  });
  return (response.data ?? []).map((d) => d.embedding ?? []);
}

export async function embedQuery(text: string): Promise<number[]> {
  const response = await getClient().embed({
    input: text,
    model: EMBEDDING_MODEL,
    inputType: "query",
  });
  return response.data?.[0]?.embedding ?? [];
}

export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}
