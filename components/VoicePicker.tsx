"use client";

import { useEffect, useRef, useState } from "react";

import {
  RATE_MAX,
  RATE_MIN,
  groupByLanguage,
  loadRate,
  loadVoiceURI,
  resolveVoice,
  saveRate,
  saveVoiceURI,
  subscribeToVoices,
} from "@/lib/voice";

/**
 * Choose which installed voice reads answers, and how fast.
 *
 * The list comes from the operating system, so it differs per machine. On
 * Windows more voices are added through Settings → Time & language → Speech;
 * on macOS through System Settings → Accessibility → Spoken Content.
 */
export function VoicePicker({ onChange }: { onChange?: () => void }) {
  const [open, setOpen] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [rate, setRate] = useState(1.02);
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSelected(loadVoiceURI());
    setRate(loadRate());
    return subscribeToVoices(setVoices);
  }, []);

  // Close on an outside click or Escape, the way a menu should.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (!panel.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!voices.length) return null;

  const active = resolveVoice(voices, selected);

  function choose(voice: SpeechSynthesisVoice) {
    saveVoiceURI(voice.voiceURI);
    setSelected(voice.voiceURI);
    onChange?.();
    preview(voice, rate);
  }

  function changeRate(value: number) {
    saveRate(value);
    setRate(value);
    onChange?.();
  }

  return (
    <span className="relative inline-flex" ref={panel}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        title={active ? `Voice: ${active.name}` : "Choose a voice"}
        className="inline-flex items-center gap-1 rounded-lg px-1.5 py-1 text-[11px] text-ink-400 transition hover:bg-ink-100 hover:text-ink-700"
      >
        Voice
        <svg viewBox="0 0 24 24" className="size-3" fill="none" aria-hidden>
          <path
            d="m6 9 6 6 6-6"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {open && (
        <div className="animate-rise absolute bottom-full left-0 z-30 mb-2 w-72 rounded-xl border border-ink-200 bg-white p-3 shadow-lg">
          <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-ink-400">
            Read aloud
          </p>

          <label className="mb-1 block text-[11px] text-ink-500">
            Speed · {rate.toFixed(2)}×
          </label>
          <input
            type="range"
            min={RATE_MIN}
            max={RATE_MAX}
            step={0.02}
            value={rate}
            onChange={(e) => changeRate(Number(e.target.value))}
            className="mb-3 w-full accent-brand-600"
            aria-label="Speaking speed"
          />

          <div className="max-h-64 overflow-y-auto rounded-lg border border-ink-100">
            {groupByLanguage(voices).map(([lang, list]) => (
              <div key={lang}>
                <p className="sticky top-0 bg-ink-50 px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-ink-400">
                  {lang}
                </p>
                {list.map((voice) => {
                  const isActive = active?.voiceURI === voice.voiceURI;
                  return (
                    <button
                      key={voice.voiceURI}
                      type="button"
                      onClick={() => choose(voice)}
                      className={`flex w-full items-center justify-between gap-2 px-2 py-1.5 text-left text-xs transition ${
                        isActive
                          ? "bg-brand-50 font-medium text-brand-700"
                          : "text-ink-700 hover:bg-ink-50"
                      }`}
                    >
                      <span className="truncate">{voice.name}</span>
                      {isActive && <span aria-hidden>✓</span>}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>

          <p className="mt-2 text-[10px] leading-relaxed text-ink-400">
            Voices come from your operating system. Add more in Windows
            Settings → Time &amp; language → Speech, or macOS System Settings →
            Accessibility → Spoken Content.
          </p>
        </div>
      )}
    </span>
  );
}

/** Say a short line so a choice can be judged without reading a whole answer. */
function preview(voice: SpeechSynthesisVoice, rate: number) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  const synth = window.speechSynthesis;
  synth.cancel();
  const u = new SpeechSynthesisUtterance("Access Categories and Permission Groups.");
  u.voice = voice;
  u.lang = voice.lang;
  u.rate = rate;
  synth.speak(u);
}
