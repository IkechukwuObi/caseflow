"use client";

import { useState } from "react";

type Message = { role: "user" | "assistant"; content: string };

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  async function send() {
    if (!input.trim() || loading) return;
    const next: Message[] = [...messages, { role: "user", content: input }];
    setMessages(next);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next }),
      });
      const data = await res.json();
      setMessages([
        ...next,
        { role: "assistant", content: data.reply ?? data.error ?? "No response." },
      ]);
    } catch {
      setMessages([...next, { role: "assistant", content: "Request failed. Check the server logs." }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main>
      <div className="mark">
        <h1>CaseFlow</h1>
        <p>
          Ask about a case, loan application, account opening, or dispute,
          and get its status, key facts, and anything worth a compliance or
          fraud look. Every answer still needs a human sign-off before it's
          actioned.
        </p>
      </div>

      <div className="thread">
        {messages.map((m, i) => (
          <div key={i} className={`message ${m.role}`}>
            {m.content}
          </div>
        ))}
      </div>

      <div className="composer">
        <textarea
          rows={2}
          placeholder="e.g. what's the status of the Mokoena loan application?"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
        />
        <button onClick={send} disabled={loading}>
          {loading ? "…" : "Ask"}
        </button>
      </div>

      <div className="footnote">
        Early prototype, synthetic demo cases only, three of them. Answers
        are restricted to the indexed archive, and compliance-trigger flags
        are rule-based matches for human review, not a determination or
        legal advice. No Anthropic credit loaded? Try the{" "}
        <a href="/demo">retrieval-only demo</a>, real search, no LLM call.
      </div>
    </main>
  );
}
