"use client";

import { useState } from "react";

interface CaseResult {
  text: string;
  title: string;
  reference: string;
  relevance: number;
}

export default function RetrievalDemo() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [cases, setCases] = useState<CaseResult[] | null>(null);
  const [notFound, setNotFound] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function search() {
    if (!query.trim() || loading) return;
    setLoading(true);
    setError(null);
    setNotFound(null);
    setCases(null);

    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Search failed.");
      } else if (data.found) {
        setCases(data.cases);
      } else {
        setNotFound(data.message);
      }
    } catch (err) {
      setError("Request failed. Check the server logs.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main>
      <div className="banner">
        Retrieval-only demo. This calls the real hybrid search (Voyage
        embeddings + BM25) directly, no Claude, no Anthropic API credit
        required. It shows what the full chat assistant retrieves before
        Claude reasons over it and writes an answer.
      </div>

      <div className="composer">
        <textarea
          rows={2}
          placeholder="e.g. what's the issue with the Mokoena loan application?"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              search();
            }
          }}
        />
        <button onClick={search} disabled={loading}>
          {loading ? "..." : "Search"}
        </button>
      </div>

      <div className="thread" style={{ marginTop: "1.5rem" }}>
        {error && <div className="message assistant">Error: {error}</div>}
        {notFound && <div className="message assistant">{notFound}</div>}
        {cases?.map((c, i) => (
          <div key={i} className="message assistant">
            <strong>{c.title}</strong>
            <br />
            <span style={{ opacity: 0.7, fontSize: "0.85rem" }}>
              relevance: {c.relevance} · ref: {c.reference}
            </span>
            <p style={{ marginTop: "0.5rem" }}>{c.text}</p>
          </div>
        ))}
      </div>
    </main>
  );
}
