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
 *
 * On `surface`: the video has no alpha, so `mix-blend-mode: multiply` is what
 * removes its white field. Multiply blends against the backdrop *within the
 * current stacking context*, and an animated or filtered ancestor creates one
 * -- so relying on the page background to be there is how you get a white box
 * on a grey page. The wrapper below carries an opaque background of its own,
 * which puts the correct backdrop inside the same group no matter what any
 * ancestor does. Pass the colour of whatever the element is sitting on.
 */
export function LogoAnimation({
  className = "",
  surface,
}: {
  className?: string;
  /**
   * Only needed for the MP4 fallback path, which still carries a white field.
   * Leave it unset and nothing is painted behind the video at all.
   */
  surface?: string;
}) {
  return (
    <span
      aria-hidden
      style={surface ? { background: surface } : undefined}
      className="pointer-events-none block size-full overflow-hidden"
    >
      {/* Source order matters. The first is VP9 with a real alpha channel,
          keyed from the original's white field -- it sits on any colour with
          nothing behind it. The MP4 is the fallback for browsers without
          alpha WebM (Safari), and still has the white field, which is what
          `surface` and the multiply blend are for.

          Always `object-contain`, never `object-cover`: the artwork is
          landscape, so covering a square crops the mark's outer dots off. */}
      <video
        autoPlay
        loop
        muted
        playsInline
        preload="auto"
        poster="/brand/logo-anim-poster.png"
        className={`size-full select-none object-contain ${
          surface ? "blend-logo" : ""
        } ${className}`}
      >
        <source src="/brand/logo-anim-alpha.webm" type="video/webm" />
        <source src="/brand/logo-anim.mp4" type="video/mp4" />
      </video>
    </span>
  );
}

/**
 * The assistant's "thinking" state: the mark animating beside a label.
 * Used while work is in flight, so the brand is doing the waiting.
 */
export function ThinkingMark({ label = "Thinking" }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-2.5" aria-label={label}>
      <span className="block aspect-[733/480] w-12 shrink-0">
        <LogoAnimation />
      </span>
      <span className="text-xs text-ink-500">{label}</span>
    </span>
  );
}
