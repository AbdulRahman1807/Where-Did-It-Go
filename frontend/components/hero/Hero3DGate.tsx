"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { ExplodedObjectCSS } from "./ExplodedObjectCSS";

const Scene = dynamic(() => import("./Scene").then((m) => m.Scene), { ssr: false });

// How long WebGL gets to prove itself stable before falling back to the
// CSS-3D version. Intentionally NOT driven by Scene's own internal
// onCreated/onStable callbacks alone: those depend on react-three-fiber's
// render loop actually running (it's built on requestAnimationFrame), and
// this gate exists specifically to handle environments where that never
// fires -- in which case onCreated is never even called, so a timer that
// only started from inside it would never start either. This timer starts
// the moment WebGL is attempted, independent of anything inside Scene.
const DECISION_WINDOW_MS = 1200;

function supportsWebGL(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return !!(canvas.getContext("webgl2") || canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

type Mode = "checking" | "attempting" | "css";

// The 3D centerpiece degrades in two stages, both real (Design Spec section
// 9 / "Visual Ambition"): first choice is WebGL (react-three-fiber), for the
// richer lighting/materials it offers when it works. If WebGL doesn't prove
// itself stable within DECISION_WINDOW_MS -- whether because it's
// unavailable, or because the context gets created and lost again almost
// immediately (observed directly, more than once), or because the browser
// simply never drives react-three-fiber's render loop at all -- this falls
// back to ExplodedObjectCSS: the same visual concept built from plain CSS 3D
// transforms, which has no requestAnimationFrame dependency and is driven
// entirely by scroll/pointer events instead. That fallback is not a
// degraded experience; it's a fully designed alternative meant to look
// intentional on its own.
export function Hero3DGate({
  progressRef,
  onAvailabilityChange,
}: {
  progressRef: React.RefObject<number>;
  onAvailabilityChange?: (available: boolean) => void;
}) {
  const [mode, setMode] = useState<Mode>("checking");
  const [webglStable, setWebglStable] = useState(false);
  const decided = useRef(false);
  // Pointer parallax follows the same rule as scroll progress: pointermove
  // fires at high frequency, so it's published as CSS custom properties on
  // the surface element (inherited by the whole 3D subtree) and as a ref for
  // the WebGL path's per-frame loop -- never as React state.
  const surfaceRef = useRef<HTMLDivElement>(null);
  const pointerRef = useRef({ x: 0, y: 0 });

  const writePointer = (x: number, y: number) => {
    pointerRef.current.x = x;
    pointerRef.current.y = y;
    const el = surfaceRef.current;
    if (!el) return;
    el.style.setProperty("--pointer-x", x.toFixed(4));
    el.style.setProperty("--pointer-y", y.toFixed(4));
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    writePointer(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      ((e.clientY - rect.top) / rect.height) * 2 - 1,
    );
  };

  const commit = (next: Mode) => {
    if (decided.current) return;
    decided.current = true;
    setMode(next);
    onAvailabilityChange?.(true);
  };

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    queueMicrotask(() => {
      if (cancelled) return;
      if (!supportsWebGL()) {
        decided.current = true;
        setMode("css");
        onAvailabilityChange?.(true);
        return;
      }
      setMode("attempting");
      timer = setTimeout(() => commit("css"), DECISION_WINDOW_MS);
    });
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (mode === "checking") return null;

  if (mode === "css") {
    return (
      <div
        ref={surfaceRef}
        className="h-full w-full"
        onPointerMove={onPointerMove}
        onPointerLeave={() => writePointer(0, 0)}
      >
        <ExplodedObjectCSS />
      </div>
    );
  }

  return (
    <div
      ref={surfaceRef}
      style={{ height: "100%", opacity: webglStable ? 1 : 0, transition: "opacity 500ms ease-out" }}
      onPointerMove={onPointerMove}
      onPointerLeave={() => writePointer(0, 0)}
    >
      <Scene
        progressRef={progressRef}
        pointerRef={pointerRef}
        onStable={() => {
          if (decided.current) return;
          decided.current = true;
          setWebglStable(true);
          onAvailabilityChange?.(true);
        }}
        onContextLost={() => commit("css")}
      />
    </div>
  );
}
