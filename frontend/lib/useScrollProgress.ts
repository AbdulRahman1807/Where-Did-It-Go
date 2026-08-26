"use client";

import { useEffect, useRef } from "react";

// Tracks scroll progress (0..1) through a tall wrapper element, meant to be
// paired with an inner `position: sticky` panel: as the user scrolls through
// the wrapper's extra height, progress goes from 0 to 1.
//
// Note there is no React state here at all -- scrolling the hero triggers zero
// re-renders. Progress is published two ways instead:
//
//   1. As the `--hero-progress` CSS custom property, written directly onto the
//      wrapper element. Everything that moves or fades with scroll (the 3D
//      layers, their highlight, the headline, the parallax grid, the captions)
//      derives its own value from it in calc(), evaluated by the browser's
//      style engine. See the @property block in app/globals.css.
//   2. As `progressRef`, for consumers that already run their own per-frame
//      loop -- specifically the react-three-fiber path, whose useFrame
//      callbacks read the current value each frame rather than have the scene
//      graph re-rendered underneath them.
//
// Why it matters: scroll events fire up to ~120x/second on a ProMotion
// trackpad. Routing that through setState re-rendered the whole hero tree
// (~58 elements, most inside nested `transform-style: preserve-3d` contexts)
// on every event, so the browser re-ran React reconciliation *and* re-projected
// the entire 3D subtree many times per frame. That was the choppiness.
//
// Deliberately no requestAnimationFrame: the write is a single setProperty
// call, and multiple writes within one frame collapse into a single style
// recalculation anyway, so rAF would add a scheduling dependency (not
// guaranteed to fire in every environment -- backgrounded or non-composited
// tabs in particular) for no measurable gain.
export function useScrollProgress<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const progressRef = useRef(0);

  useEffect(() => {
    // The wrapper's position in the document only changes on resize/reflow, so
    // it's measured there rather than in the scroll handler. That keeps the
    // handler free of any layout read at all -- reading getBoundingClientRect
    // on every scroll event, interleaved with style writes, is the classic
    // read/write layout-thrash pattern.
    const metrics = { top: 0, height: 0 };

    const measure = () => {
      const el = ref.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      metrics.top = rect.top + window.scrollY;
      metrics.height = rect.height;
    };

    const update = () => {
      const el = ref.current;
      if (!el) return;
      const scrollable = metrics.height - window.innerHeight;
      const raw = scrollable > 0 ? (window.scrollY - metrics.top) / scrollable : 0;
      const p = Math.min(1, Math.max(0, raw));
      progressRef.current = p;
      el.style.setProperty("--hero-progress", p.toFixed(4));
    };

    const onResize = () => {
      measure();
      update();
    };

    measure();
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return { ref, progressRef };
}
