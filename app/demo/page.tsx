"use client";

import { useState } from "react";

interface CaseResult {
  text: string;
  title: string;
  reference: string;
  relevance: number;
}

const EXAMPLES = [
  "What's the issue with the Mokoena loan application?",
  "Why is the Naidoo business account opening still pending?",
  "What happened with dispute reference 88213?",
];

// The corpus documents carry "(SYNTHETIC DEMO DATA)" as part of the title
// string (see corpus/documents/*.md frontmatter) so it can never be
// stripped out and forgotten. Pulling it out here turns that safeguard
// into an actual badge instead of leaving it buried in a long heading.
function splitTitle(title: string): { name: string; synthetic: boolean } {
  const match = title.match(/^(.*?)\s*\(SYNTHETIC DEMO DATA\)\s*$/i);
  return match ? { name: match[1], synthetic: true } : { name: title, synthetic: false };
}

export default function RetrievalDemo() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [cases, setCases] = useState<CaseResult[] | null>(null);
  const [notFound, setNotFound] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function search(q?: string) {
    const value = (q ?? query).trim();
    if (!value || loading) return;
    setQuery(value);
    setLoading(true);
    setError(null);
    setNotFound(null);
    setCases(null);

    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: value }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Search failed.");
      } else if (data.found) {
        setCases(data.cases);
      } else {
        setNotFound(data.message);
      }
    } catch {
      setError("Request failed. Check the server logs.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main>
      <div className="mark">
        <h1>CaseFlow — case archive lookup</h1>
        <p>
          Search the case archive by applicant name, reference, or what&apos;s
          outstanding. This is the retrieval step on its own, the same
          search the full assistant runs before Claude reasons over it.
        </p>
      </div>

      <div className="lookup-label">Find a case</div>
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
        <button onClick={() => search()} disabled={loading}>
          {loading ? "Searching…" : "Search"}
        </button>
      </div>

      <div className="chip-row">
        {EXAMPLES.map((ex) => (
          <button key={ex} className="chip" onClick={() => search(ex)} disabled={loading}>
            {ex}
          </button>
        ))}
      </div>

      {(error || notFound || cases) && (
        <div className="results">
          {error && <div className="notice">Error: {error}</div>}
          {notFound && <div className="notice">{notFound}</div>}
          {cases?.map((c, i) => {
            const { name, synthetic } = splitTitle(c.title);
            const paragraphs = c.text.split(/\n{2,}/).filter(Boolean);
            return (
              <div key={i} className="case-card">
                <div className="case-card-head">
                  <span className="case-title">{name}</span>
                  <span className="case-meta">
                    match {(c.relevance * 100).toFixed(0)}% · {c.reference}
                  </span>
                </div>
                {synthetic && <span className="badge badge-synthetic">Synthetic demo data</span>}
                <div style={{ marginTop: synthetic ? "0.75rem" : 0 }}>
                  {paragraphs.map((p, j) => (
                    <p key={j}>{p}</p>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="footnote">
        Retrieval-only demo: real hybrid search (Voyage embeddings + BM25),
        no Claude call, no Anthropic API credit spent. The full chat
        assistant runs this same search, then has Claude reason over the
        result and check it against the compliance policy engine. See{" "}
        <a href="/">the full assistant</a>.
      </div>
    </main>
  );
}
