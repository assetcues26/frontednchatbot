"use client";

import { useState } from "react";

import { RoleBadge } from "@/components/Badges";
import { Shell } from "@/components/Shell";
import { api, type Comparison } from "@/lib/api";

const PROBES = [
  {
    q: "What is the Partner Entitlement Envelope?",
    why: "Restricted commercial material. Sales, Product and Engineering only.",
  },
  {
    q: "Is there a full access-change audit trail today?",
    why: "Roadmap content. Sales and Customer must not see it quoted as shipped.",
  },
  {
    q: "What does test case UAP-TC-047 verify?",
    why: "QA material. Not for Sales, Support or Customer.",
  },
  {
    q: "How do I create an Asset Category?",
    why: "Customer-safe guidance. Everyone should be able to answer this.",
  },
];

export default function ComparePage() {
  return <Shell requireAdmin>{() => <Compare />}</Shell>;
}

function Compare() {
  const [question, setQuestion] = useState("");
  const [result, setResult] = useState<Comparison | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(text: string) {
    const trimmed = text.trim();
    if (!trimmed) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      setResult(await api.compare(trimmed));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Comparison failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Compare across roles</h1>
        <p className="mt-1 max-w-2xl text-sm text-ink-600">
          Runs one question through the real retrieval path once per role, with
          that role&apos;s actual permissions. Each column is what a person
          holding that role would genuinely receive — nothing here is
          simulated.
        </p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void run(question);
        }}
        className="flex gap-2"
      >
        <input
          className="input"
          placeholder="Ask a question to test across every role…"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          disabled={busy}
          aria-label="Question to compare"
        />
        <button
          type="submit"
          className="btn-primary"
          disabled={busy || !question.trim()}
        >
          {busy ? "Running…" : "Compare"}
        </button>
      </form>

      <div className="flex flex-wrap gap-2">
        {PROBES.map((p) => (
          <button
            key={p.q}
            title={p.why}
            onClick={() => {
              setQuestion(p.q);
              void run(p.q);
            }}
            disabled={busy}
            className="rounded-full border border-ink-200 bg-white px-3 py-1.5 text-xs text-ink-700 transition hover:border-brand-500 hover:text-brand-700 disabled:opacity-50"
          >
            {p.q}
          </button>
        ))}
      </div>

      {error && (
        <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {error}
        </p>
      )}

      {busy && (
        <p className="text-sm text-ink-500">
          Running the question once per role…
        </p>
      )}

      {result && (
        <>
          <div className="card p-4">
            <p className="text-sm">
              <span className="font-medium">{result.question}</span>
            </p>
            <p className="mt-1 text-xs text-ink-500">
              {result.total_matching_chunks} chunks in the corpus matched this
              question. What each role received depends entirely on their
              permissions.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {result.entries.map((entry) => (
              <div
                key={entry.role_key}
                className={`card flex flex-col p-4 ${
                  entry.refused ? "border-rose-200" : "border-emerald-200"
                }`}
              >
                <div className="mb-3 flex items-center justify-between gap-2">
                  <RoleBadge role={entry.role_key} />
                  <span
                    className={`badge ${
                      entry.refused
                        ? "bg-rose-50 text-rose-800 ring-rose-200"
                        : "bg-emerald-50 text-emerald-800 ring-emerald-200"
                    }`}
                  >
                    {entry.refused ? "Refused" : "Answered"}
                  </span>
                </div>

                <p className="flex-1 whitespace-pre-wrap text-xs leading-relaxed text-ink-700">
                  {truncate(stripCitations(entry.answer), 420)}
                </p>

                <div className="mt-3 space-y-1 border-t border-ink-100 pt-3 text-[11px] text-ink-500">
                  <div className="flex justify-between">
                    <span>Chunks allowed</span>
                    <span className="font-medium text-ink-700">
                      {entry.chunks_allowed}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Documents blocked</span>
                    <span
                      className={`font-medium ${
                        entry.documents_blocked > 0
                          ? "text-rose-700"
                          : "text-ink-700"
                      }`}
                    >
                      {entry.documents_blocked}
                    </span>
                  </div>
                  {entry.blocked_titles.length > 0 && (
                    <ul className="mt-1.5 space-y-0.5">
                      {entry.blocked_titles.map((t) => (
                        <li key={t} className="truncate text-rose-600" title={t}>
                          blocked: {t}
                        </li>
                      ))}
                    </ul>
                  )}
                  {entry.citations.length > 0 && (
                    <ul className="mt-1.5 space-y-0.5">
                      {dedupe(entry.citations.map((c) => c.title)).map((t) => (
                        <li key={t} className="truncate text-ink-600" title={t}>
                          cited: {t}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function stripCitations(text: string): string {
  return text.replace(/\[[0-9a-fA-F]{8}#\d+(?:\s*,\s*[0-9a-fA-F]{8}#\d+)*\]/g, "");
}

function truncate(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max).trimEnd()}…`;
}

function dedupe(values: string[]): string[] {
  return Array.from(new Set(values));
}
