"use client";

import { useState } from "react";

import { api } from "@/lib/api";

/**
 * Thumbs up or down on one answer.
 *
 * Only the turn id, the rating and an optional comment are sent. The question,
 * the documents used and who asked are read back on the server from that
 * turn's own audit row, so a rating cannot be filed against a question nobody
 * asked or attached to somebody else's conversation.
 *
 * A thumbs-down opens a comment box, because "this was wrong" is only
 * actionable if someone says how.
 */
export function Feedback({
  turnId,
  answer,
}: {
  turnId: string;
  answer: string;
}) {
  const [rating, setRating] = useState<"up" | "down" | null>(null);
  const [commenting, setCommenting] = useState(false);
  const [comment, setComment] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!turnId) return null;

  async function send(value: "up" | "down", withComment = "") {
    setBusy(true);
    setError(null);
    try {
      await api.feedback(turnId, value, withComment, answer);
      setRating(value);
      if (value === "up" || withComment) setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send feedback");
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <span className="animate-rise text-[11px] text-emerald-700">
        Thanks — recorded for review.
      </span>
    );
  }

  return (
    <span className="inline-flex flex-col gap-2">
      <span className="inline-flex items-center gap-0.5">
        <button
          type="button"
          disabled={busy}
          onClick={() => void send("up")}
          aria-pressed={rating === "up"}
          title="This answer was helpful"
          className={`grid size-7 place-items-center rounded-lg transition disabled:opacity-40 ${
            rating === "up"
              ? "bg-emerald-50 text-emerald-700"
              : "text-ink-400 hover:bg-ink-100 hover:text-ink-700"
          }`}
        >
          <ThumbIcon filled={rating === "up"} />
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            setRating("down");
            setCommenting(true);
          }}
          aria-pressed={rating === "down"}
          title="Something was wrong with this answer"
          className={`grid size-7 place-items-center rounded-lg transition disabled:opacity-40 ${
            rating === "down"
              ? "bg-rose-50 text-rose-700"
              : "text-ink-400 hover:bg-ink-100 hover:text-ink-700"
          }`}
        >
          <ThumbIcon filled={rating === "down"} down />
        </button>
      </span>

      {commenting && (
        <span className="animate-rise flex w-full max-w-md flex-col gap-2">
          <textarea
            rows={2}
            autoFocus
            className="input text-xs"
            placeholder="What was wrong? Missing detail, wrong source, out of date…"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />
          <span className="flex gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void send("down", comment)}
              className="btn-primary px-2.5 py-1 text-xs"
            >
              Send feedback
            </button>
            <button
              type="button"
              onClick={() => void send("down")}
              disabled={busy}
              className="btn-ghost px-2.5 py-1 text-xs"
            >
              Skip
            </button>
          </span>
        </span>
      )}

      {error && <span className="text-[11px] text-rose-700">{error}</span>}
    </span>
  );
}

function ThumbIcon({ filled, down }: { filled: boolean; down?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      className={`size-[15px] ${down ? "rotate-180" : ""}`}
      aria-hidden
    >
      <path
        d="M7 10.5v9H4.5a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1H7Zm0 0 4-7a2 2 0 0 1 2.9 2.5L12.8 9h5.1a2 2 0 0 1 2 2.5l-1.5 6A2 2 0 0 1 16.4 19H7"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}
