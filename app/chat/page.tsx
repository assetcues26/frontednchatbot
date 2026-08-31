"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { RoleBadges } from "@/components/Badges";
import { AnswerBody } from "@/components/AnswerBody";
import { LogoAnimation } from "@/components/Brand";
import { Composer } from "@/components/Composer";
import { Feedback } from "@/components/Feedback";
import { ReadAloud } from "@/components/ReadAloud";
import { Shell } from "@/components/Shell";
import { api, askStream, type Citation, type Me } from "@/lib/api";
import {
  clearTurns,
  HISTORY_DEPTH,
  historyForRequest,
  loadTurns,
  saveTurns,
  type StoredTurn,
} from "@/lib/history";

const REFUSAL_PREFIX = "I don't have information on that";

// On the composer having a microphone but no attach or camera button.
//
// Dictation is real: the browser's SpeechRecognition API does it locally.
//
// Attaching a file or a photo to a question is not a missing button, it is a
// missing pipeline. Every document here reaches an answer by one route --
// ingest, classify, and an administrator grants roles before it becomes
// retrievable. That quarantine is guardrail G1 and it is the product's whole
// claim. A file attached to a chat message would reach the model without any
// of it, which is precisely the hole the system exists to close. Doing it
// properly means routing the upload through the same review queue, which is a
// scoped feature rather than an icon.

interface Turn {
  id: string;
  question: string;
  answer: string;
  citations: Citation[];
  followUps: string[];
  turnId: string;
  sources: { key: string; title: string; doc_type: string }[];
  streaming: boolean;
  refused: boolean;
  retracted: boolean;
  cached: boolean;
  error?: string;
}

/** Restore a stored turn into a finished (non-streaming) one. */
function fromStored(t: StoredTurn): Turn {
  return {
    id: t.id,
    question: t.question,
    answer: t.answer,
    citations: t.citations,
    followUps: t.followUps,
    turnId: t.turnId ?? "",
    sources: [],
    streaming: false,
    refused: t.refused,
    retracted: false,
    cached: false,
  };
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
  const [restored, setRestored] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Bring the tab's thread back after a refresh. Keyed by user id, so signing
  // in as someone else starts clean instead of inheriting the last thread.
  useEffect(() => {
    setTurns(loadTurns(me.user_id).map(fromStored));
    setRestored(true);
  }, [me.user_id]);

  // Persist once a turn is finished. Mid-stream state is not worth storing.
  useEffect(() => {
    if (!restored) return;
    const settled = turns.filter((t) => !t.streaming && !t.error);
    saveTurns(
      me.user_id,
      settled.map((t) => ({
        id: t.id,
        question: t.question,
        answer: t.answer,
        citations: t.citations,
        followUps: t.followUps,
        turnId: t.turnId,
        refused: t.refused,
        at: Date.now(),
      })),
    );
  }, [turns, restored, me.user_id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [turns]);

  const ask = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || busy) return;

      const id = crypto.randomUUID();
      // Snapshot the thread before this turn joins it, so the question is not
      // handed back to the server as its own context.
      const history = historyForRequest(
        turns
          .filter((t) => !t.streaming && !t.error)
          .map((t) => ({
            id: t.id,
            question: t.question,
            answer: t.answer,
            citations: t.citations,
            followUps: t.followUps,
            turnId: t.turnId,
            refused: t.refused,
            at: 0,
          })),
      );

      setTurns((prev) => [
        ...prev,
        {
          id,
          question: trimmed,
          answer: "",
          citations: [],
          followUps: [],
          turnId: "",
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
        await askStream(
          trimmed,
          {
          onSources: (sources) => patch({ sources }),
          onDelta: (delta) =>
            setTurns((prev) =>
              prev.map((t) =>
                t.id === id ? { ...t, answer: t.answer + delta } : t,
              ),
            ),
          onDone: ({ turn_id, citations, follow_ups, refused, cached }) =>
            patch({
              turnId: turn_id ?? "",
              citations,
              followUps: follow_ups ?? [],
              refused,
              cached,
              streaming: false,
            }),
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
          },
          history,
        );
      } catch (err) {
        patch({
          error: err instanceof Error ? err.message : "Request failed",
          streaming: false,
        });
      } finally {
        setBusy(false);
      }
    },
    [busy, turns],
  );

  return (
    <div className="mx-auto max-w-3xl">
      {turns.length === 0 && (
        <div className="card animate-pop mb-6 overflow-hidden p-6">
          <div className="mb-4 flex items-center gap-3">
            <span className="block aspect-[732/480] w-10 shrink-0">
              <LogoAnimation />
            </span>
            <h1 className="text-lg font-semibold">
              Ask about the AssetCues product
            </h1>
          </div>
          <p className="text-sm text-ink-600">
            Answers come only from documentation you are cleared to read, and
            every claim is cited. You are signed in as{" "}
            <RoleBadges roles={me.roles} />
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {SUGGESTIONS.map((s, i) => (
              <button
                key={s}
                onClick={() => ask(s)}
                style={{ ["--i" as string]: i + 2 }}
                className="stagger rounded-full border border-ink-200 bg-white px-3 py-1.5 text-xs text-ink-700 transition hover:-translate-y-0.5 hover:border-brand-500 hover:text-brand-700 hover:shadow-sm"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-6">
        {turns.map((turn) => (
          <TurnView key={turn.id} turn={turn} onAsk={ask} busy={busy} />
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
        {turns.length > 0 && (
          <div className="mb-2 flex items-center justify-between text-[11px] text-ink-400">
            <span>
              Follow-ups use your last{" "}
              {Math.min(turns.filter((t) => !t.refused).length, HISTORY_DEPTH)}{" "}
              question
              {Math.min(turns.filter((t) => !t.refused).length, HISTORY_DEPTH) === 1
                ? ""
                : "s"}{" "}
              for context. This thread stays in this tab only.
            </span>
            <button
              type="button"
              onClick={() => {
                clearTurns(me.user_id);
                setTurns([]);
              }}
              className="rounded px-2 py-0.5 transition hover:bg-ink-100 hover:text-ink-700"
            >
              New conversation
            </button>
          </div>
        )}
        <Composer
          value={question}
          onChange={setQuestion}
          onSubmit={() => ask(question)}
          busy={busy}
        />
      </form>
    </div>
  );
}

function TurnView({
  turn,
  onAsk,
  busy,
}: {
  turn: Turn;
  onAsk: (q: string) => void;
  busy: boolean;
}) {
  const isRefusal =
    turn.refused || turn.answer.trim().startsWith(REFUSAL_PREFIX);

  return (
    <div className="animate-rise">
      <div className="mb-2 flex justify-end">
        <div className="animate-from-right max-w-[85%] rounded-2xl rounded-br-sm bg-brand-600 px-4 py-2 text-sm text-white shadow-sm">
          {turn.question}
        </div>
      </div>

      {turn.sources.length > 0 && !isRefusal && (
        <div className="mb-2 flex flex-wrap items-center gap-1.5 text-[11px] text-ink-500">
          <span>Reading</span>
          {dedupeTitles(turn.sources).map((title, i) => (
            <span
              key={title}
              style={{ ["--i" as string]: i }}
              className="stagger rounded-full bg-white px-2 py-0.5 ring-1 ring-inset ring-ink-200"
            >
              {title}
            </span>
          ))}
        </div>
      )}

      <div className="card p-4">
        <div className="min-w-0 flex-1">
        {turn.error ? (
          <p className="text-sm text-rose-700">{turn.error}</p>
        ) : turn.answer ? (
          isRefusal ? (
            <RefusalCard question={turn.question} answer={turn.answer} />
          ) : (
            <>
              <AnswerBody text={turn.answer} citations={turn.citations} />
              {turn.streaming && <TypingDots />}
              {!turn.streaming && turn.citations.length > 0 && (
                <CitationList citations={turn.citations} />
              )}
              {!turn.streaming && (
                <div className="mt-3 flex flex-wrap items-start gap-2">
                  <ReadAloud text={turn.answer} />
                  <Feedback turnId={turn.turnId} answer={turn.answer} />
                  {turn.cached && (
                    <span className="text-[11px] text-ink-400">
                      Served from cache for your exact permissions.
                    </span>
                  )}
                </div>
              )}
              {!turn.streaming && turn.followUps.length > 0 && (
                <FollowUps
                  questions={turn.followUps}
                  onAsk={onAsk}
                  busy={busy}
                />
              )}
            </>
          )
        ) : (
          // The avatar beside this is already the animated mark; a second one
          // here was two logos saying the same thing.
          <p className="flex items-center gap-2 py-1 text-sm text-ink-500">
            Searching the documents you can read
            <span className="inline-flex gap-1">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="typing-dot size-1.5 rounded-full bg-brand-400"
                  style={{ animationDelay: `${i * 0.15}s` }}
                />
              ))}
            </span>
          </p>
        )}
        </div>
      </div>
    </div>
  );
}

function FollowUps({
  questions,
  onAsk,
  busy,
}: {
  questions: string[];
  onAsk: (q: string) => void;
  busy: boolean;
}) {
  return (
    <div className="mt-4 border-t border-ink-100 pt-3">
      <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-ink-400">
        Ask next
      </p>
      <div className="flex flex-wrap gap-2">
        {questions.map((q, i) => (
          <button
            key={q}
            onClick={() => onAsk(q)}
            disabled={busy}
            style={{ ["--i" as string]: i }}
            className="stagger group inline-flex items-center gap-1.5 rounded-full border border-ink-200 bg-white px-3 py-1.5 text-xs text-ink-700 transition hover:-translate-y-0.5 hover:border-brand-500 hover:text-brand-700 hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
          >
            {q}
            <span
              aria-hidden
              className="text-ink-300 transition group-hover:translate-x-0.5 group-hover:text-brand-500"
            >
              &rarr;
            </span>
          </button>
        ))}
      </div>
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
