"use client";

import { useEffect, useRef, useState } from "react";

/**
 * The chat composer.
 *
 * The microphone is real: it uses the browser's SpeechRecognition API, so it
 * needs no server, no key and no audio ever leaving the machine beyond what
 * the browser itself does. It hides on browsers that do not support it rather
 * than sitting there dead.
 *
 * There is no attach-file or camera button, and that is a decision rather
 * than an omission -- see the note in `chat/page.tsx`.
 */

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
}

interface SpeechRecognitionEventLike {
  results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }>;
  resultIndex: number;
}

type RecognitionCtor = new () => SpeechRecognitionLike;

function getRecognitionCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: RecognitionCtor;
    webkitSpeechRecognition?: RecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function Composer({
  value,
  onChange,
  onSubmit,
  busy,
  placeholder = "Ask a question about the product…",
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  busy: boolean;
  placeholder?: string;
}) {
  const [listening, setListening] = useState(false);
  const [micAvailable, setMicAvailable] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const recognition = useRef<SpeechRecognitionLike | null>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const baseText = useRef("");

  useEffect(() => {
    setMicAvailable(getRecognitionCtor() !== null);
  }, []);

  // Grow with the question instead of scrolling a one-line box.
  useEffect(() => {
    const el = textarea.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
  }, [value]);

  function toggleMic() {
    setMicError(null);

    if (listening) {
      recognition.current?.stop();
      return;
    }

    const Ctor = getRecognitionCtor();
    if (!Ctor) return;

    const rec = new Ctor();
    rec.lang = navigator.language || "en-US";
    rec.continuous = true;
    rec.interimResults = true;
    baseText.current = value ? `${value.trim()} ` : "";

    rec.onresult = (event) => {
      let transcript = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        transcript += event.results[i]?.[0]?.transcript ?? "";
      }
      onChange(baseText.current + transcript);
    };
    rec.onerror = () => {
      setMicError("Could not hear anything. Check microphone permission.");
      setListening(false);
    };
    rec.onend = () => setListening(false);

    recognition.current = rec;
    rec.start();
    setListening(true);
  }

  // Stop the recogniser if the component goes away mid-dictation.
  useEffect(() => () => recognition.current?.stop(), []);

  return (
    <div>
      <div
        className={`flex items-end gap-2 rounded-2xl border bg-white p-2 shadow-sm transition ${
          listening
            ? "border-flare-500 ring-2 ring-flare-100"
            : "border-ink-200 focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-100"
        }`}
      >
        <textarea
          ref={textarea}
          rows={1}
          className="max-h-44 flex-1 resize-none bg-transparent px-2 py-1.5 text-sm outline-none placeholder:text-ink-400"
          placeholder={listening ? "Listening…" : placeholder}
          value={value}
          disabled={busy}
          aria-label="Your question"
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            // Enter sends; Shift+Enter is a newline.
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              onSubmit();
            }
          }}
        />

        {micAvailable && (
          <button
            type="button"
            onClick={toggleMic}
            disabled={busy}
            aria-pressed={listening}
            title={listening ? "Stop dictation" : "Dictate your question"}
            className={`grid size-9 shrink-0 place-items-center rounded-xl transition ${
              listening
                ? "bg-flare-500 text-white"
                : "text-ink-500 hover:bg-ink-100 hover:text-ink-800"
            } disabled:opacity-40`}
          >
            <MicIcon active={listening} />
          </button>
        )}

        <button
          type="button"
          onClick={onSubmit}
          disabled={busy || !value.trim()}
          title="Send"
          className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand-600 text-white transition hover:bg-brand-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy ? <Spinner /> : <SendIcon />}
        </button>
      </div>

      {micError && (
        <p className="animate-rise mt-1.5 text-[11px] text-rose-700">{micError}</p>
      )}
      {listening && !micError && (
        <p className="mt-1.5 flex items-center gap-1.5 text-[11px] text-ink-500">
          <span className="size-1.5 animate-pulse rounded-full bg-flare-500" />
          Listening — speak, then press the mic again to stop.
        </p>
      )}
    </div>
  );
}

function MicIcon({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="size-[18px]" aria-hidden>
      <rect
        x="9"
        y="3"
        width="6"
        height="11"
        rx="3"
        fill={active ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <path
        d="M5 11a7 7 0 0 0 14 0M12 18v3"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="size-[18px]" aria-hidden>
      <path
        d="M4.5 12 20 4.5 15.5 20l-3.7-5.6L4.5 12Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Spinner() {
  return (
    <svg viewBox="0 0 24 24" className="size-[18px] animate-spin" aria-hidden>
      <circle
        cx="12"
        cy="12"
        r="9"
        stroke="currentColor"
        strokeWidth="2.5"
        fill="none"
        opacity="0.25"
      />
      <path
        d="M21 12a9 9 0 0 0-9-9"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}
