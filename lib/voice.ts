"use client";

/**
 * Which voice reads answers aloud, and how fast.
 *
 * Stored in `localStorage`, not `sessionStorage` — unlike the conversation,
 * which is per-tab content, this is a preference. Nobody wants to re-pick a
 * voice every time they open a tab, and a voice name discloses nothing.
 *
 * Voices come from the operating system, so the list differs per machine and
 * per browser. Nothing here ships a voice; it only chooses among what is
 * already installed.
 */

const VOICE_KEY = "acues:tts:voiceURI";
const RATE_KEY = "acues:tts:rate";

export const RATE_MIN = 0.6;
export const RATE_MAX = 1.8;
export const RATE_DEFAULT = 1.02;

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* private mode or storage disabled; the choice lasts this page view */
  }
}

export function loadVoiceURI(): string | null {
  return read(VOICE_KEY);
}

export function saveVoiceURI(uri: string): void {
  write(VOICE_KEY, uri);
}

export function loadRate(): number {
  const raw = read(RATE_KEY);
  const value = raw ? Number(raw) : NaN;
  if (Number.isNaN(value) || value < RATE_MIN || value > RATE_MAX) {
    return RATE_DEFAULT;
  }
  return value;
}

export function saveRate(rate: number): void {
  write(RATE_KEY, String(rate));
}

/**
 * The installed voices.
 *
 * `getVoices()` is famously empty on first call in Chromium: the list loads
 * asynchronously and arrives via `voiceschanged`. Calling it once and giving
 * up is why voice pickers so often show nothing, so this subscribes and
 * re-reads.
 */
export function subscribeToVoices(
  onChange: (voices: SpeechSynthesisVoice[]) => void,
): () => void {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    onChange([]);
    return () => {};
  }

  const synth = window.speechSynthesis;
  const emit = () => onChange(synth.getVoices());

  emit();
  synth.addEventListener("voiceschanged", emit);
  return () => synth.removeEventListener("voiceschanged", emit);
}

/** The chosen voice, or the best default for the browser's language. */
export function resolveVoice(
  voices: SpeechSynthesisVoice[],
  preferredURI: string | null,
): SpeechSynthesisVoice | null {
  if (!voices.length) return null;

  if (preferredURI) {
    const exact = voices.find((v) => v.voiceURI === preferredURI);
    if (exact) return exact;
    // A saved voice can vanish: a different machine, or one the user removed.
    // Fall through to the default rather than failing silently.
  }

  const language = (
    typeof navigator !== "undefined" ? navigator.language : "en-US"
  ).toLowerCase();

  return (
    voices.find((v) => v.lang.toLowerCase() === language && v.default) ??
    voices.find((v) => v.lang.toLowerCase() === language) ??
    voices.find((v) => v.lang.toLowerCase().startsWith(language.slice(0, 2))) ??
    voices.find((v) => v.default) ??
    voices[0] ??
    null
  );
}

/** Group by language so a long list stays navigable. */
export function groupByLanguage(
  voices: SpeechSynthesisVoice[],
): [string, SpeechSynthesisVoice[]][] {
  const groups = new Map<string, SpeechSynthesisVoice[]>();
  for (const voice of voices) {
    const key = voice.lang || "other";
    const list = groups.get(key) ?? [];
    list.push(voice);
    groups.set(key, list);
  }

  const language = (
    typeof navigator !== "undefined" ? navigator.language : "en-US"
  ).toLowerCase();

  return [...groups.entries()].sort(([a], [b]) => {
    // The reader's own language first; it is what they will almost always want.
    const aMine = a.toLowerCase().startsWith(language.slice(0, 2));
    const bMine = b.toLowerCase().startsWith(language.slice(0, 2));
    if (aMine !== bMine) return aMine ? -1 : 1;
    return a.localeCompare(b);
  });
}
