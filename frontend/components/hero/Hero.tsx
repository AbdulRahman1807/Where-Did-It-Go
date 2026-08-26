"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useScrollProgress } from "@/lib/useScrollProgress";
import { Hero3DGate } from "./Hero3DGate";

// Fixed-size 3D geometry doesn't reserve layout space the way text does: on
// a narrow viewport the headline takes the full width and the object (sized
// for sitting beside it, not under it) ends up overlapping the text instead
// of complementing it. Rather than fighting perspective/transform math to
// make a spatial 3D object reflow at every width, this follows the design
// spec's own mobile guidance directly -- prioritize the core content,
// progressively disclose the decorative layer -- by not mounting the 3D
// centerpiece below the breakpoint where it has room to sit clear of the
// text. That also skips the WebGL/CSS-3D setup cost entirely on mobile.
function useHasRoomFor3D() {
  const [hasRoom, setHasRoom] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia("(min-width: 768px)");
    const onChange = (e: MediaQueryListEvent) => setHasRoom(e.matches);
    // Deferred a tick: reading matchMedia's *current* value is a read of
    // external state, not something derivable at render time on the server,
    // so it has to happen from an effect -- queuing it keeps the initial
    // setState out of the effect's synchronous phase.
    queueMicrotask(() => setHasRoom(mql.matches));
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);
  return hasRoom;
}

const LAYER_CAPTIONS = ["LABEL", "PACKAGE", "ITEM", "LOCATION"];

export function Hero() {
  const { ref, progressRef } = useScrollProgress<HTMLDivElement>();
  const [scene3DAvailable, setScene3DAvailable] = useState(false);
  const hasRoomFor3D = useHasRoomFor3D();

  // Everything below that moves continuously with scroll is expressed as
  // calc() against --hero-progress rather than as a number recomputed in
  // React. The tuning intent is unchanged -- the very first bit of scroll
  // should be clearly, immediately responsive (a short pin distance and a
  // visible early headline shift), since a subtle effect spread over a long
  // distance reads as "broken" on a normal, brief scroll gesture -- but the
  // browser now applies it without React re-rendering the tree per event.
  // See useScrollProgress and the @property block in globals.css.

  return (
    <div ref={ref} className="hero-root relative h-[200vh]">
      <div className="sticky top-0 h-screen w-full overflow-hidden bg-void">
        {/* background trace lines -- subtle depth layer, moves slower than foreground text */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.15]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(63,215,238,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(63,215,238,0.4) 1px, transparent 1px)",
            backgroundSize: "64px 64px",
            transform: "translate3d(0, calc(var(--hero-progress) * -100px), 0)",
            // Full-viewport tiled gradient. Without a compositing trigger the
            // browser repaints all of it every time the transform changes;
            // promoted, the compositor just re-offsets an existing layer.
            willChange: "transform",
          }}
        />

        {hasRoomFor3D && (
          <div className="absolute inset-0">
            <Hero3DGate progressRef={progressRef} onAvailabilityChange={setScene3DAvailable} />
          </div>
        )}

        <div
          className="pointer-events-none absolute inset-0 flex flex-col justify-center px-6 sm:px-12"
          style={{
            opacity: "calc(1 - var(--hero-progress) * 0.4)",
            transform: "translate3d(0, calc(var(--hero-progress) * -160px), 0)",
            // Same reason as the grid above: this wrapper is full-viewport, and
            // a non-1 opacity on an unpromoted element forces the whole subtree
            // through an intermediate transparency buffer on every repaint.
            willChange: "transform, opacity",
          }}
        >
          <div className="mx-auto w-full max-w-6xl">
            <div className="font-display text-[15vw] font-medium leading-[0.85] tracking-tight text-text-primary sm:text-[9vw] lg:text-[7.5rem]">
              <div>WHERE</div>
              <div>DID</div>
              <div>
                IT GO<span className="text-cyan">?</span>
              </div>
            </div>
            <div className="mt-6 text-xs font-medium uppercase tracking-[0.3em] text-text-tertiary sm:text-sm">
              Fulfillment exception investigation
            </div>
            <p className="mt-5 max-w-md text-base text-text-secondary sm:text-lg">
              Investigate what went wrong. Follow the evidence. Keep the decision human.
            </p>
            <div
              className="pointer-events-none mt-9"
              style={{
                opacity: "var(--cta-progress)",
                transform: "translate3d(0, calc((1 - var(--cta-progress)) * 16px), 0)",
                // Sits inside the headline wrapper, which also carries a
                // sub-1 opacity -- so without its own layer this nests a
                // second full-size transparency buffer inside the first.
                willChange: "transform, opacity",
              }}
            >
              <Link
                href="/investigations"
                className="focus-ring pointer-events-auto group inline-flex items-center gap-3 border border-cyan bg-cyan px-7 py-3.5 text-sm font-medium uppercase tracking-widest text-void transition-colors hover:bg-text-primary hover:border-text-primary"
              >
                Enter the investigation console
                <span aria-hidden className="transition-transform group-hover:translate-x-1">
                  →
                </span>
              </Link>
            </div>
          </div>
        </div>

        {/* Current layer caption, ties the 3D explode to the investigation metaphor.
            All four labels are rendered stacked and cross-faded by the same
            --hl-N intensities that light the corresponding 3D layer, so the
            caption and the object always agree and neither one snaps between
            states. */}
        {scene3DAvailable && (
          <div
            className="pointer-events-none absolute bottom-28 right-6 text-right sm:right-12"
            style={{ opacity: "var(--reveal)" }}
          >
            <div className="text-[11px] uppercase tracking-[0.3em] text-text-tertiary">Exposing</div>
            <div className="relative font-display text-2xl font-medium text-cyan">
              {/* An invisible copy holds the line's height, since the real
                  labels are absolutely positioned on top of each other. */}
              <span className="invisible">{LAYER_CAPTIONS[0]}</span>
              {LAYER_CAPTIONS.map((caption, i) => (
                <span
                  key={caption}
                  className="absolute inset-0"
                  style={{ opacity: `var(--hl-${i})` }}
                >
                  {caption}
                </span>
              ))}
            </div>
          </div>
        )}

        <div
          className="pointer-events-none absolute inset-x-0 bottom-10 flex flex-col items-center gap-2 text-text-tertiary"
          style={{ opacity: "clamp(0, calc(1 - var(--hero-progress) * 10), 1)" }}
        >
          <span className="text-[11px] uppercase tracking-[0.3em]">Scroll</span>
          <span className="h-8 w-px animate-pulse bg-text-tertiary" />
        </div>
      </div>
    </div>
  );
}
