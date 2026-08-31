"use client";

import Image from "next/image";

/**
 * AssetCues brand elements.
 *
 * The animation is a 13-second VP9/H.264 loop of the dot-matrix mark. It has
 * no alpha channel -- the artwork sits on solid white -- so it is composited
 * with `mix-blend-mode: multiply`, which drops white to transparent over any
 * light background. Anything darker than the artwork would show a white box,
 * which is why these are only ever placed on light surfaces.
 */

export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <Image
      src="/brand/AssetCues-Logo.png"
      alt="AssetCues"
      width={1920}
      height={473}
      priority
      className={className}
    />
  );
}

export function Mark({ className = "" }: { className?: string }) {
  return (
    <Image
      src="/brand/assetcues-mark.png"
      alt=""
      width={512}
      height={512}
      aria-hidden
      className={className}
    />
  );
}

/**
 * The looping logo animation.
 *
 * `muted` and `playsInline` are not decoration -- without both, autoplay is
 * blocked on every modern browser and the poster frame is all anyone sees.
 */
export function LogoAnimation({
  className = "",
  round = false,
}: {
  className?: string;
  round?: boolean;
}) {
  return (
    <video
      autoPlay
      loop
      muted
      playsInline
      preload="auto"
      poster="/brand/logo-anim-poster.jpg"
      aria-hidden
      className={`blend-logo pointer-events-none select-none ${
        round ? "size-full rounded-full object-cover" : ""
      } ${className}`}
    >
      <source src="/brand/logo-anim.webm" type="video/webm" />
      <source src="/brand/logo-anim.mp4" type="video/mp4" />
    </video>
  );
}

/**
 * The assistant's "thinking" state: the mark animating inside a soft halo.
 * Used while an answer streams, so the brand is doing the waiting.
 */
export function ThinkingMark({ label = "Thinking" }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-2.5" aria-label={label}>
      <span className="relative grid size-9 place-items-center">
        <span className="animate-halo absolute inset-0 rounded-full bg-gradient-to-tr from-flare-500/25 via-orchid-500/20 to-aqua-500/25 blur-[6px]" />
        <span className="relative size-9 overflow-hidden rounded-full bg-white ring-1 ring-ink-200">
          <LogoAnimation round />
        </span>
      </span>
      <span className="text-xs text-ink-500">{label}</span>
    </span>
  );
}
