"use client";

import { useEffect, useRef, useState } from "react";

import {
  loadRate,
  loadVoiceURI,
  resolveVoice,
  subscribeToVoices,
} from "@/lib/voice";
import { VoicePicker } from "./VoicePicker";

/**
 * Reads an answer aloud with the browser's own speech synthesis.
 *
 * No model, no API, no key, no audio leaving the machine. `speechSynthesis`
 * ships in the browser, so this costs nothing per use and works offline. It
 * hides entirely where the browser has no voices rather than offering a
 * button that does nothing.
 */

/** Speech should hear the prose, not the markup. */
export function speakableText(markdown: string): string {
  return (
    markdown
      // Citation markers read as gibberish: "bracket three f a eight five".
      .replace(/\[[0-9a-fA-F]{8}#\d+(?:\s*,\s*[0-9a-fA-F]{8}#\d+)*\]/g, "")
      .replace(/`([^`]+)`/g, "$1")
      .replace(/\*\*([^*]+)\*\*/g, "$1")
      .replace(/\*([^*]+)\*/g, "$1")
      .replace(/^#{1,6}\s+/gm, "")
      // A leading bullet or number should become a pause, not be spoken.
      .replace(/^\s*[-*•]\s+/gm, ", ")
      .replace(/^\s*(\d+)[.)]\s+/gm, "$1. ")
      .replace(/\s{2,}/g, " ")
      // A removed citation leaves "Categories ." behind; some voices read the
      // gap as a pause mid-sentence.
      .replace(/\s+([.,;:!?])/g, "$1")
      .trim()
  );
}

export function ReadAloud({ text }: { text: string }) {
  const [supported, setSupported] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const utterance = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    setSupported(typeof window !== "undefined" && "speechSynthesis" in window);
    return subscribeToVoices(setVoices);
  }, []);

  // Leaving the page mid-sentence should not leave a voice talking: speech
  // synthesis lives on `window`, not on this component.
  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  if (!supported) return null;

  function toggle() {
    const synth = window.speechSynthesis;

    if (speaking) {
      synth.cancel();
      setSpeaking(false);
      return;
    }

    const spoken = speakableText(text);
    if (!spoken) return;

    // Any other answer already reading should stop first.
    synth.cancel();

    const u = new SpeechSynthesisUtterance(spoken);
    // Read the preference at speak time, not at mount: the picker may have
    // changed it since this answer rendered.
    const voice = resolveVoice(voices, loadVoiceURI());
    if (voice) {
      u.voice = voice;
      u.lang = voice.lang;
    } else {
      u.lang = navigator.language || "en-US";
    }
    u.rate = loadRate();
    u.onend = () => setSpeaking(false);
    u.onerror = () => setSpeaking(false);

    utterance.current = u;
    synth.speak(u);
    setSpeaking(true);
  }

  return (
    <span className="inline-flex items-center gap-0.5">
      <button
        type="button"
        onClick={toggle}
        aria-pressed={speaking}
        title={speaking ? "Stop reading" : "Read this answer aloud"}
        className={`inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] transition ${
          speaking
            ? "bg-brand-50 text-brand-700"
            : "text-ink-400 hover:bg-ink-100 hover:text-ink-700"
        }`}
      >
        {speaking ? <StopIcon /> : <SpeakerIcon />}
        {speaking ? "Stop" : "Listen"}
      </button>
      <VoicePicker
        onChange={() => {
          // A change mid-sentence would otherwise keep the old voice talking.
          if (speaking) {
            window.speechSynthesis.cancel();
            setSpeaking(false);
          }
        }}
      />
    </span>
  );
}

function SpeakerIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="size-3.5" aria-hidden>
      <path
        d="M11 5 6.5 9H3v6h3.5L11 19V5Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path
        d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="size-3.5" aria-hidden>
      <rect
        x="6"
        y="6"
        width="12"
        height="12"
        rx="2"
        fill="currentColor"
        opacity="0.9"
      />
    </svg>
  );
}
