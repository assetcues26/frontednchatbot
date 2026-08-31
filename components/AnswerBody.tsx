"use client";

import type { Citation } from "@/lib/api";

/**
 * Renders an answer's markdown as React elements.
 *
 * Deliberately not `react-markdown` and deliberately never
 * `dangerouslySetInnerHTML`. This text is model output built from document
 * content, and a document is something a customer can put words into. Turning
 * that into raw HTML is an injection path straight through the one surface
 * this product exists to protect. Producing React nodes means a stray `<img
 * onerror>` in a Word file is text, not markup, with no sanitiser to trust.
 *
 * Supported, because it is what the model actually emits: bold, italic,
 * inline code, bullet and numbered lists, and headings. Anything else falls
 * through as plain text rather than being silently dropped.
 */

const INLINE = /(\*\*[^*]+\*\*|\*[^*\n]+\*|`[^`\n]+`|\[[0-9a-fA-F]{8}#\d+(?:\s*,\s*[0-9a-fA-F]{8}#\d+)*\])/g;

interface Marker {
  numbers: Map<string, number>;
  known: Set<string>;
}

function renderInline(text: string, marker: Marker, keyPrefix: string) {
  const parts = text.split(INLINE).filter((p) => p !== "");

  return parts.map((part, i) => {
    const key = `${keyPrefix}-${i}`;

    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      return (
        <strong key={key} className="font-semibold text-ink-900">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
      return (
        <code
          key={key}
          className="rounded bg-ink-100 px-1 py-0.5 font-mono text-[0.85em] text-ink-800"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    if (
      part.startsWith("*") &&
      part.endsWith("*") &&
      part.length > 2 &&
      !part.startsWith("**")
    ) {
      return (
        <em key={key} className="italic">
          {part.slice(1, -1)}
        </em>
      );
    }

    const citation = /^\[(.+)\]$/.exec(part);
    if (citation?.[1]) {
      const keys = citation[1].split(",").map((k) => k.trim().toLowerCase());
      return (
        <sup
          key={key}
          className="mx-0.5 cursor-default font-medium text-brand-600"
          title="Source"
        >
          {keys
            .map((k) => (marker.known.has(k) ? (marker.numbers.get(k) ?? "?") : "?"))
            .join(",")}
        </sup>
      );
    }

    return <span key={key}>{part}</span>;
  });
}

export function AnswerBody({
  text,
  citations,
}: {
  text: string;
  citations: Citation[];
}) {
  const marker: Marker = {
    known: new Set(citations.map((c) => c.key.toLowerCase())),
    numbers: new Map(citations.map((c, i) => [c.key.toLowerCase(), i + 1])),
  };

  const lines = text.split("\n");
  const blocks: React.ReactNode[] = [];

  let paragraph: string[] = [];
  let bullets: string[] = [];
  let numbered: string[] = [];

  const flushParagraph = () => {
    if (!paragraph.length) return;
    const key = `p-${blocks.length}`;
    blocks.push(
      <p key={key} className="text-sm leading-relaxed text-ink-800">
        {renderInline(paragraph.join(" "), marker, key)}
      </p>,
    );
    paragraph = [];
  };

  const flushBullets = () => {
    if (!bullets.length) return;
    const key = `ul-${blocks.length}`;
    blocks.push(
      <ul key={key} className="ml-1 space-y-1.5">
        {bullets.map((item, i) => (
          <li key={i} className="flex gap-2 text-sm leading-relaxed text-ink-800">
            <span aria-hidden className="mt-[0.45rem] size-1.5 shrink-0 rounded-full bg-brand-400" />
            <span>{renderInline(item, marker, `${key}-${i}`)}</span>
          </li>
        ))}
      </ul>,
    );
    bullets = [];
  };

  const flushNumbered = () => {
    if (!numbered.length) return;
    const key = `ol-${blocks.length}`;
    blocks.push(
      <ol key={key} className="ml-1 space-y-1.5">
        {numbered.map((item, i) => (
          <li key={i} className="flex gap-2.5 text-sm leading-relaxed text-ink-800">
            <span
              aria-hidden
              className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-brand-50 text-[11px] font-medium text-brand-700"
            >
              {i + 1}
            </span>
            <span>{renderInline(item, marker, `${key}-${i}`)}</span>
          </li>
        ))}
      </ol>,
    );
    numbered = [];
  };

  const flushAll = () => {
    flushParagraph();
    flushBullets();
    flushNumbered();
  };

  for (const raw of lines) {
    const line = raw.trimEnd();

    if (!line.trim()) {
      flushAll();
      continue;
    }

    const bullet = /^\s*[-*•]\s+(.*)$/.exec(line);
    if (bullet?.[1] !== undefined) {
      flushParagraph();
      flushNumbered();
      bullets.push(bullet[1]);
      continue;
    }

    const ordered = /^\s*\d+[.)]\s+(.*)$/.exec(line);
    if (ordered?.[1] !== undefined) {
      flushParagraph();
      flushBullets();
      numbered.push(ordered[1]);
      continue;
    }

    const heading = /^\s*#{1,6}\s+(.*)$/.exec(line);
    if (heading?.[1] !== undefined) {
      flushAll();
      const key = `h-${blocks.length}`;
      blocks.push(
        <p key={key} className="text-sm font-semibold text-ink-900">
          {renderInline(heading[1], marker, key)}
        </p>,
      );
      continue;
    }

    flushBullets();
    flushNumbered();
    paragraph.push(line.trim());
  }

  flushAll();

  return <div className="space-y-3">{blocks}</div>;
}
