"use client";

import { useState } from "react";

export default function AskPage() {
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);

  const [answer, setAnswer] = useState<string>("");
  const [citations, setCitations] = useState<any[]>([]);
  const [debug, setDebug] = useState<any>(null);

  async function ask() {
    setLoading(true);
    setAnswer("");
    setCitations([]);
    setDebug(null);

    const res = await fetch("/api/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: q }),
    });

    const text = await res.text();
    let data: any = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { error: "Non-JSON response", rawText: text };
    }

    setLoading(false);
    setDebug({ status: res.status, data });

    if (!res.ok) {
      setAnswer(data?.error ?? "Ask failed");
      return;
    }

    setAnswer(data?.answer ?? "");
    setCitations(data?.citations ?? []);
  }

  return (
    <main className="max-w-3xl mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-bold">Ask Pilot Assistance</h1>

      <textarea
        className="w-full border rounded p-3"
        rows={4}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Ask a question..."
      />

      <button
        className="px-4 py-2 rounded bg-black text-white disabled:opacity-50"
        disabled={!q.trim() || loading}
        onClick={ask}
      >
        {loading ? "Asking..." : "Ask"}
      </button>

      <section className="p-4 border rounded bg-white space-y-3">
        <h2 className="font-semibold">Answer</h2>
        <p className="whitespace-pre-wrap">{answer || "-"}</p>

        <h3 className="font-semibold">References</h3>
        {citations.length === 0 ? (
          <p className="text-sm text-gray-600">No citations returned.</p>
        ) : (
          <ul className="list-disc pl-5 space-y-2 text-sm">
            {citations.map((c, idx) => (
              <li key={idx}>
                <div>
                  <b>{c.filename ?? c.file_id ?? "Source"}</b>
                </div>
                {c.quote && <div className="text-gray-700">“{c.quote}”</div>}
              </li>
            ))}
          </ul>
        )}

        <h3 className="font-semibold">Debug</h3>
        <pre className="p-3 rounded bg-gray-100 text-xs overflow-auto">
          {JSON.stringify(debug, null, 2)}
        </pre>
      </section>
    </main>
  );
}
