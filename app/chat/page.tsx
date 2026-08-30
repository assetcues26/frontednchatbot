"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { RoleBadges } from "@/components/Badges";
import { Shell } from "@/components/Shell";
import { api, askStream, type Citation, type Me } from "@/lib/api";

const REFUSAL_PREFIX = "I don't have information on that";

interface Turn {
  id: string;
  question: string;
  answer: string;
  citations: Citation[];
  sources: { key: string; title: string; doc_type: string }[];
  streaming: boolean;
  refused: boolean;
  retracted: boolean;
  cached: boolean;
  error?: string;
}

const SUGGESTIONS = [
  "What are the six Access Categories?",
  "What does UAP-FR-045 say?",
  "How do I create an Asset Category?",
  "What is the Partner Entitlement Envelope?",
];

export default function ChatPage() {
  return <Shell>{(me) => <Chat me={me} />}</Shell>;
}

function Chat({ me }: { me: Me }) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [turns]);

  const ask = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || busy) return;

      const id = crypto.randomUUID();
      setTurns((prev) => [
        ...prev,
        {
          id,
          question: trimmed,
          answer: "",
          citations: [],
          sources: [],
          streaming: true,
          refused: false,
          retracted: false,
          cached: false,
        },
      ]);
      setQuestion("");
      setBusy(true);

      const patch = (changes: Partial<Turn>) =>
        setTurns((prev) =>
          prev.map((t) => (t.id === id ? { ...t, ...changes } : t)),
        );

      try {
        await askStream(trimmed, {
          onSources: (sources) => patch({ sources }),
          onDelta: (delta) =>
            setTurns((prev) =>
              prev.map((t) =>
                t.id === id ? { ...t, answer: t.answer + delta } : t,
              ),
            ),
          onDone: ({ citations, refused, cached }) =>
            patch({ citations, refused, cached, streaming: false }),
          // Citation validation runs after generation, so an answer can be
          // withdrawn. Replace what was streamed rather than appending.
          onRetracted: ({ answer }) =>
            patch({
              answer,
              retracted: true,
              refused: true,
              streaming: false,
              citations: [],
            }),
          onError: (message) => patch({ error: message, streaming: false }),
        });
      } catch (err) {
        patch({
          error: err instanceof Error ? err.message : "Request failed",
          streaming: false,
        });
      } finally {
        setBusy(false);
      }
    },
    [busy],
  );

  return (
    <div className="mx-auto max-w-3xl">
      {turns.length === 0 && (
        <div className="card mb-6 p-6">
          <h1 className="text-lg font-semibold">
            Ask about the AssetCues product
          </h1>
          <p className="mt-1 text-sm text-ink-600">
            Answers come only from documentation you are cleared to read, and
            every claim is cited. You are signed in as{" "}
            <RoleBadges roles={me.roles} />
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => ask(s)}
                className="rounded-full border border-ink-200 bg-white px-3 py-1.5 text-xs text-ink-700 transition hover:border-brand-500 hover:text-brand-700"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-6">
        {turns.map((turn) => (
          <TurnView key={turn.id} turn={turn} />
        ))}
        <div ref={bottomRef} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask(question);
        }}
        className="sticky bottom-0 mt-6 bg-ink-50 pb-4 pt-2"
      >
        <div className="flex gap-2">
          <input
            className="input"
            placeholder="Ask a question about the product…"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            disabled={busy}
            aria-label="Your question"
          />
          <button
            type="submit"
            className="btn-primary"
            disabled={busy || !question.trim()}
          >
            {busy ? "Thinking…" : "Ask"}
          </button>
        </div>
      </form>
    </div>
  );
}

function TurnView({ turn }: { turn: Turn }) {
  const isRefusal =
    turn.refused || turn.answer.trim().startsWith(REFUSAL_PREFIX);

  return (
    <div>
      <div className="mb-2 flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-brand-600 px-4 py-2 text-sm text-white">
          {turn.question}
        </div>
      </div>

      {turn.sources.length > 0 && !isRefusal && (
        <div className="mb-2 flex flex-wrap items-center gap-1.5 text-[11px] text-ink-500">
          <span>Reading</span>
          {dedupeTitles(turn.sources).map((title) => (
            <span
              key={title}
              className="rounded-full bg-white px-2 py-0.5 ring-1 ring-inset ring-ink-200"
            >
              {title}
            </span>
          ))}
        </div>
      )}

      <div className="card p-4">
        {turn.error ? (
          <p className="text-sm text-rose-700">{turn.error}</p>
        ) : turn.answer ? (
          isRefusal ? (
            <RefusalCard question={turn.question} answer={turn.answer} />
          ) : (
            <>
              <AnswerText text={turn.answer} citations={turn.citations} />
              {turn.streaming && <TypingDots />}
              {!turn.streaming && turn.citations.length > 0 && (
                <CitationList citations={turn.citations} />
              )}
              {turn.cached && (
                <p className="mt-3 text-[11px] text-ink-400">
                  Served from cache for your exact permissions.
                </p>
              )}
            </>
          )
        ) : (
          <TypingDots />
        )}
      </div>
    </div>
  );
}

function AnswerText({
  text,
  citations,
}: {
  text: string;
  citations: Citation[];
}) {
  const known = new Set(citations.map((c) => c.key.toLowerCase()));
  const numbers = new Map(citations.map((c, i) => [c.key.toLowerCase(), i + 1]));

  // Turn [3fa85f64#7] into a small superscript marker.
  const parts = text.split(/(\[[0-9a-fA-F]{8}#\d+(?:\s*,\s*[0-9a-fA-F]{8}#\d+)*\])/g);

  return (
    <div className="whitespace-pre-wrap text-sm leading-relaxed text-ink-800">
      {parts.map((part, index) => {
        const match = /^\[(.+)\]$/.exec(part);
        if (!match?.[1]) return <span key={index}>{part}</span>;
        const keys = match[1].split(",").map((k) => k.trim().toLowerCase());
        return (
          <sup key={index} className="mx-0.5 font-medium text-brand-600">
            {keys
              .map((k) => (known.has(k) ? (numbers.get(k) ?? "?") : "?"))
              .join(",")}
          </sup>
        );
      })}
    </div>
  );
}

function CitationList({ citations }: { citations: Citation[] }) {
  return (
    <div className="mt-4 border-t border-ink-100 pt-3">
      <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-ink-400">
        Sources
      </p>
      <ol className="space-y-1.5">
        {citations.map((c, index) => (
          <li key={c.key} className="flex gap-2 text-xs text-ink-600">
            <span className="font-medium text-brand-600">{index + 1}</span>
            <span>
              <span className="font-medium text-ink-800">{c.title}</span>
              {c.doc_type && <span className="text-ink-400"> · {c.doc_type}</span>}
              {c.heading_path && (
                <span className="block text-ink-500">{c.heading_path}</span>
              )}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function RefusalCard({
  question,
  answer,
}: {
  question: string;
  answer: string;
}) {
  const [open, setOpen] = useState(false);
  const [justification, setJustification] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    try {
      await api.requestAccess(question, justification);
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send request");
    }
  }

  return (
    <div>
      <p className="text-sm text-ink-700">{answer}</p>

      {sent ? (
        <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
          Request sent. An administrator will review it.
        </p>
      ) : open ? (
        <div className="mt-3 space-y-2">
          <textarea
            className="input"
            rows={2}
            placeholder="Why do you need this? (optional)"
            value={justification}
            onChange={(e) => setJustification(e.target.value)}
          />
          <div className="flex gap-2">
            <button onClick={submit} className="btn-primary text-xs">
              Send request
            </button>
            <button onClick={() => setOpen(false)} className="btn-ghost text-xs">
              Cancel
            </button>
          </div>
          {error && <p className="text-xs text-rose-700">{error}</p>}
        </div>
      ) : (
        <button onClick={() => setOpen(true)} className="btn-ghost mt-2 text-xs">
          Request access
        </button>
      )}
    </div>
  );
}

function TypingDots() {
  return (
    <span className="inline-flex gap-1 py-1" aria-label="Generating">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="typing-dot size-1.5 rounded-full bg-ink-400"
          style={{ animationDelay: `${i * 0.15}s` }}
        />
      ))}
    </span>
  );
}

function dedupeTitles(
  sources: { key: string; title: string; doc_type: string }[],
): string[] {
  return Array.from(new Set(sources.map((s) => s.title)));
}
