"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import ProtectedRoute from "@/components/ProtectedRoute";

type Citation = {
  type: "file_citation";
  file_id?: string;
  filename?: string;
  index?: number;
  page?: number;
};

type ChatRole = "user" | "assistant";

type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  citations?: Citation[];
  error?: boolean;
};

const QUICK_QUESTIONS = [
  "What is the MTOW for B787-9?",
  "Maximum bank angle for APP arming?",
  "What are V1, VR, and V2 speeds?",
  "How does VNAV work during descent?",
];

function stripReferences(fullAnswer: string): string {
  if (!fullAnswer) return "";
  const parts = fullAnswer.split(/\n\s*References\s*:/i);
  return parts[0].trim();
}

function formatCitation(citation: Citation): string {
  const name = citation.filename ?? citation.file_id ?? "file";
  if (typeof citation.page === "number") return `${name} - page ${citation.page}`;
  if (typeof citation.index === "number") return `${name} - ref ${citation.index}`;
  return name;
}

export default function AskPage() {
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function ask(customQuestion?: string) {
    const prompt = (customQuestion ?? question).trim();
    if (!prompt || loading) return;

    const history = messages
      .filter((message) => !message.error)
      .map((message) => ({
        role: message.role,
        content: message.content,
      }));

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: prompt,
    };

    setMessages((prev) => [...prev, userMessage]);
    setQuestion("");
    setLoading(true);

    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: prompt, lang: "en", history }),
      });

      const text = await res.text();
      const data = text ? JSON.parse(text) : {};

      if (!res.ok || data?.ok === false) {
        throw new Error(data?.error || "Ask failed");
      }

      const cleanAnswer = stripReferences(String(data?.answer ?? "")) || "Not found in manuals.";
      const assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: cleanAnswer,
        citations: Array.isArray(data?.citations) ? data.citations : [],
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `assistant-error-${Date.now()}`,
          role: "assistant",
          content: "Ask failed. Please try again.",
          citations: [],
          error: true,
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50">
        <div className="mx-auto max-w-6xl px-4 py-8">
          <div className="mb-8 text-center">
            <h1 className="bg-gradient-to-r from-blue-600 to-blue-800 bg-clip-text text-4xl font-bold text-transparent">
              Pilot Chatbot
            </h1>
            <p className="text-gray-600">Ask aviation manuals in a live chat format</p>
          </div>

          <div className="mb-6 flex justify-center gap-3">
            <Link href="/">
              <button className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50">
                Back to Roster
              </button>
            </Link>
            <Link href="/flight-plan">
              <button className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50">
                Flight Plan Analyzer
              </button>
            </Link>
          </div>

          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4">
              <h2 className="text-lg font-bold text-white">Chat</h2>
              <p className="text-sm text-blue-100">Responses come from indexed B787/B777 manuals</p>
            </div>

            <div className="flex h-[68vh] flex-col">
              <div className="flex-1 space-y-4 overflow-y-auto bg-gray-50/40 p-4 md:p-6">
                {messages.length === 0 && !loading && (
                  <div className="rounded-xl border border-dashed border-gray-300 bg-white p-6 text-center">
                    <h3 className="text-lg font-semibold text-gray-900">Start chatting with the manuals</h3>
                    <p className="mt-2 text-sm text-gray-600">
                      Choose a suggested prompt or write your own question below.
                    </p>
                    <div className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-2">
                      {QUICK_QUESTIONS.map((quickQuestion) => (
                        <button
                          key={quickQuestion}
                          onClick={() => {
                            void ask(quickQuestion);
                          }}
                          className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-left text-sm text-gray-700 transition-all hover:border-blue-300 hover:bg-blue-50"
                        >
                          {quickQuestion}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {messages.map((message) => {
                  const isUser = message.role === "user";
                  const bubbleClass = isUser
                    ? "bg-blue-600 text-white border-blue-600"
                    : message.error
                    ? "bg-red-50 text-red-900 border-red-200"
                    : "bg-white text-gray-900 border-gray-200";

                  return (
                    <div key={message.id} className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[88%] rounded-2xl border p-4 shadow-sm ${bubbleClass}`}>
                        <div className="whitespace-pre-wrap text-sm leading-relaxed">{message.content || "-"}</div>

                        {!isUser && !!message.citations?.length && (
                          <div className="mt-3 border-t border-gray-200 pt-3">
                            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                              References
                            </div>
                            <ul className="space-y-1">
                              {message.citations?.map((citation, index) => (
                                <li key={`${message.id}-citation-${index}`} className="text-xs text-gray-600">
                                  {formatCitation(citation)}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}

                {loading && (
                  <div className="flex justify-start">
                    <div className="max-w-[88%] rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <svg className="h-4 w-4 animate-spin text-blue-600" viewBox="0 0 24 24">
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                            fill="none"
                          />
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                          />
                        </svg>
                        Searching manuals...
                      </div>
                    </div>
                  </div>
                )}

                <div ref={endRef} />
              </div>

              <form
                className="border-t border-gray-200 bg-white p-4 md:p-5"
                onSubmit={(event) => {
                  event.preventDefault();
                  void ask();
                }}
              >
                <div className="flex items-end gap-3">
                  <textarea
                    className="min-h-[68px] flex-1 resize-none rounded-xl border-2 border-gray-200 p-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    value={question}
                    onChange={(event) => setQuestion(event.target.value)}
                    placeholder="Ask the chatbot..."
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault();
                        void ask();
                      }
                    }}
                  />
                  <button
                    type="submit"
                    disabled={loading || !question.trim()}
                    className="rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-3 text-sm font-semibold text-white shadow-md transition-all hover:from-blue-700 hover:to-blue-800 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Send
                  </button>
                </div>
                <p className="mt-2 text-xs text-gray-500">Press Enter to send, Shift + Enter for a new line.</p>
              </form>
            </div>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}
