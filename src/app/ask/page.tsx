"use client";

import { useState } from "react";
import Link from "next/link";
import ProtectedRoute from "@/components/ProtectedRoute";

type Citation = {
  type: "file_citation";
  file_id?: string;
  filename?: string;
  index?: number; // index from OpenAI
  page?: number; // our mapped page (if available)
};

export default function AskPage() {
  const [question, setQuestion] = useState("");
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
        // language fixed to English
        body: JSON.stringify({ question: question.trim(), lang: "en" }),
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

  // ✅ Helper function to remove References section from answer
  function getAnswerWithoutReferences(fullAnswer: string): string {
    if (!fullAnswer) return "";
    
    // Split at "References:" (case-insensitive) and take only the first part
    const parts = fullAnswer.split(/\n\s*References\s*:/i);
    return parts[0].trim();
  }

  return (
    <ProtectedRoute>
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50">
      <div className="mx-auto max-w-5xl px-4 py-8">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="mb-2 flex items-center justify-center gap-3">
            <span className="text-5xl">💬</span>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-blue-800 bg-clip-text text-transparent">
              Ask Pilot Assistance
            </h1>
          </div>
          <p className="text-gray-600">Search B787/B777 aviation manuals and get instant answers</p>
        </div>

        {/* Quick Links */}
        <div className="mb-6 flex justify-center gap-3">
          <Link href="/">
            <button className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors">
              ← Back to Roster
            </button>
          </Link>
          <Link href="/flight-plan">
            <button className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors">
              Flight Plan Analyzer →
            </button>
          </Link>
        </div>

        {/* Question Input Card */}
        <div className="mb-6 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4">
            <h2 className="text-lg font-bold text-white">Your Question</h2>
          </div>
          <div className="p-6">
            <textarea
              className="w-full border-2 border-gray-200 rounded-xl p-4 min-h-[140px] focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Example: What is the maximum bank angle for APP arming?"
            />
            <div className="mt-4 flex gap-3">
              <button
                onClick={ask}
                disabled={loading || !question.trim()}
                className="flex-1 rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-3 text-base font-semibold text-white shadow-md transition-all hover:from-blue-700 hover:to-blue-800 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Searching manuals...
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    <span>🔍</span>
                    <span>Search Manuals</span>
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Answer Section */}
        {(answer || loading) && (
          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
            <div className="bg-gradient-to-r from-green-600 to-green-700 px-6 py-4">
              <h2 className="text-lg font-bold text-white">Answer</h2>
            </div>
            <div className="p-6 space-y-6">
              {/* Answer Content */}
              <div className="rounded-xl border border-gray-200 bg-gray-50/50 p-6">
                <div className="whitespace-pre-wrap text-gray-900 leading-relaxed">
                  {loading ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="text-center">
                        <svg className="animate-spin h-10 w-10 text-blue-600 mx-auto mb-3" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        <p className="text-gray-600 font-medium">Searching through manuals...</p>
                      </div>
                    </div>
                  ) : (
                    getAnswerWithoutReferences(answer) || "—"
                  )}
                </div>
              </div>

              {/* References Section */}
              {!loading && answer && (
                <div className="rounded-xl border border-blue-200 bg-blue-50/30 p-5">
                  <div className="mb-3 flex items-center gap-2">
                    <span className="text-xl">📚</span>
                    <h3 className="font-bold text-gray-900">References</h3>
                  </div>
                  {citations.length === 0 ? (
                    <div className="text-sm text-gray-600">No citations returned.</div>
                  ) : (
                    <ul className="space-y-2">
                      {citations.map((c, i) => {
                        const name = c.filename ?? c.file_id ?? "file";
                        const pagePart = typeof c.page === "number" ? `• page ${c.page}` : "";
                        const indexPart = typeof c.index === "number" ? `• ref ${c.index}` : "";
                        return (
                          <li key={i} className="flex items-start gap-2 text-sm">
                            <span className="mt-1 text-blue-600">•</span>
                            <span className="text-gray-700">
                              <span className="font-semibold">{name}</span>
                              {pagePart && <span className="text-gray-500"> {pagePart}</span>}
                              {!pagePart && indexPart && <span className="text-gray-500"> {indexPart}</span>}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Example Questions */}
        {!answer && !loading && (
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <span className="text-xl">💡</span>
              <h3 className="font-bold text-gray-900">Example Questions</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[
                "What is the MTOW for B787-9?",
                "Maximum bank angle for APP arming?",
                "What are V1, VR, and V2 speeds?",
                "How does VNAV work during descent?"
              ].map((q, i) => (
                <button
                  key={i}
                  onClick={() => setQuestion(q)}
                  className="text-left rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700 hover:border-blue-300 hover:bg-blue-50 transition-all"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
    </ProtectedRoute>
  );
}
