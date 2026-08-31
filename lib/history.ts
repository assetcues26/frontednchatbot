"use client";

/**
 * Conversation memory, stored in the browser.
 *
 * Why `sessionStorage` and not `localStorage` or the server:
 *
 *   - It is scoped to the tab and cleared when that tab closes, which is what
 *     "session-wise" means. A shared machine does not leak yesterday's thread.
 *   - It never reaches the server, so answers a user was cleared to see at the
 *     time are not retained anywhere they could later be re-served after that
 *     clearance changed. The server keeps the audit trail; it does not need
 *     the transcript.
 *   - It survives a refresh, which localStorage would over-serve and memory
 *     would under-serve.
 *
 * The key includes the user id, so signing in as someone else on the same tab
 * starts a clean thread rather than inheriting one.
 *
 * Only the questions are ever sent back to the API. Stored answers are for
 * re-rendering this tab after a refresh; sending fabricated assistant turns to
 * the server would be a prompt-injection channel for no benefit.
 */

import type { Citation } from "./api";

export interface StoredTurn {
  id: string;
  question: string;
  answer: string;
  citations: Citation[];
  followUps: string[];
  /** Audit row id, so a rating still works after a refresh. */
  turnId: string;
  refused: boolean;
  at: number;
}

/** Turns sent back as context. Matches MAX_HISTORY on the server. */
export const HISTORY_DEPTH = 5;

/** Turns kept for re-rendering. sessionStorage is ~5 MB; this stays far under. */
const MAX_STORED_TURNS = 40;

const VERSION = 1;

interface Envelope {
  v: number;
  turns: StoredTurn[];
}

function keyFor(userId: string): string {
  return `acues:chat:v${VERSION}:${userId}`;
}

/** sessionStorage throws in private modes and when storage is disabled. */
function safeRead(key: string): Envelope | null {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Envelope;
    if (parsed?.v !== VERSION || !Array.isArray(parsed.turns)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function safeWrite(key: string, envelope: Envelope): void {
  try {
    sessionStorage.setItem(key, JSON.stringify(envelope));
  } catch {
    // Quota or a browser that blocks storage. The thread still works in
    // memory for this page view; it just will not survive a refresh.
  }
}

export function loadTurns(userId: string): StoredTurn[] {
  return safeRead(keyFor(userId))?.turns ?? [];
}

export function saveTurns(userId: string, turns: StoredTurn[]): void {
  const trimmed = turns.slice(-MAX_STORED_TURNS);
  safeWrite(keyFor(userId), { v: VERSION, turns: trimmed });
}

export function clearTurns(userId: string): void {
  try {
    sessionStorage.removeItem(keyFor(userId));
  } catch {
    /* nothing to do */
  }
}

/**
 * The questions sent to the server so it can resolve "what about for sales?".
 *
 * Refusals are excluded: a question that returned nothing is a dead end, and
 * feeding it back only pulls the rewrite toward a topic with no material.
 */
export function historyForRequest(turns: StoredTurn[]): string[] {
  return turns
    .filter((t) => !t.refused && t.question.trim())
    .slice(-HISTORY_DEPTH)
    .map((t) => t.question.trim().slice(0, 500));
}
