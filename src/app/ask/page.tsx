"use client";

import { useState } from "react";

type Citation = {
  type: "file_citation";
  file_id?: string;
  filename?: string;
  index?: number;     // index from OpenAI
  page?: number;      // our mapped page (if available)
};

export default function AskPage() {
  const [question, setQuestion] = useState("");
  const [lang, setLang] = useState<"en" | "ar">("en");

  const [loading, setLoading] = useState(false);
  const [answer, setAnswer] = useState("");
  const [citations, setCitations] = useState<Citation[]>([]);

  async function ask() {
    setLoading(true);
    setAnswer("");
    setCitations([]);

    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: question.trim(), lang }),
      });

      const text = await res.text();
      const data = text ? JSON.parse(text) : {};

      if (!res.ok || data?.ok === false) {
        setAnswer("Ask failed");
        setLoading(false);
        return;
      }

      setAnswer(String(data?.answer ?? ""));
      setCitations(Array.isArray(data?.citations) ? data.citations : []);
    } catch {
      setAnswer("Ask failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-2xl font-bold">Ask Pilot Assistance</h1>

        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600">Language</label>
          <select
            value={lang}
            onChange={(e) => setLang(e.target.value as any)}
            className="border rounded px-2 py-1"
          >
            <option value="en">English</option>
            <option value="ar">Arabic</option>
          </select>
        </div>
      </div>

      <textarea
        className="w-full border rounded p-3 min-h-[140px]"
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        placeholder="Type your question..."
      />

      <button
        onClick={ask}
        disabled={loading || !question.trim()}
        className="px-5 py-2 rounded bg-black text-white disabled:opacity-50"
      >
        {loading ? "Asking..." : "Ask"}
      </button>

      <section className="border rounded p-4 bg-white space-y-3">
        <h2 className="font-semibold">Answer</h2>
        <div className="whitespace-pre-wrap">{answer || "—"}</div>

        <h3 className="font-semibold pt-2">References</h3>
        {citations.length === 0 ? (
          <div className="text-sm text-gray-600">No citations returned.</div>
        ) : (
          <ul className="list-disc pl-5 text-sm">
            {citations.map((c, i) => {
              const name = c.filename ?? c.file_id ?? "file";
              const pagePart = typeof c.page === "number" ? `— page ${c.page}` : "";
              const indexPart = typeof c.index === "number" ? `• index ${c.index}` : "";
              return (
                <li key={i}>
                  {name} {pagePart} {pagePart ? "" : indexPart}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
