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
    } catch (err) {
      setMessages([...next, { role: "assistant", content: "Request failed. Check the server logs." }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main>
      <div className="banner">
        Early prototype, synthetic demo cases only. Answers are restricted to
        the ingested case archive — if a case isn&apos;t indexed, it will say so
        rather than guess. Compliance-trigger flags are rule-based pattern
        matches for human review, not a determination. Not legal or compliance advice.
        <br />
        No Anthropic credit loaded yet? See the{" "}
        <a href="/demo" style={{ color: "#a9c0ff" }}>
          retrieval-only demo
        </a>{" "}
        — real search, no LLM call needed.
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
          placeholder="Ask about a case, e.g. 'what's the status of the Mokoena loan application?'"
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
          {loading ? "..." : "Ask"}
        </button>
      </div>
    </main>
  );
}
