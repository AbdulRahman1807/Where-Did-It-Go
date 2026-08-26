"use client";

import { Canvas } from "@react-three/fiber";
import { ExplodedObject } from "./ExplodedObject";

const STABILITY_WINDOW_MS = 700;

// Scroll progress and pointer position arrive as refs, not as numeric props,
// and are read inside ExplodedObject's useFrame callbacks. Passing them as
// props would re-render this component -- and with it react-three-fiber's
// reconciliation over the whole scene graph -- on every scroll and pointer
// event, which is exactly the per-event work the hero was made to avoid.
// A ref read inside an existing per-frame loop costs nothing.
export function Scene({
  progressRef,
  pointerRef,
  onContextLost,
  onStable,
}: {
  progressRef: React.RefObject<number>;
  pointerRef: React.RefObject<{ x: number; y: number }>;
  onContextLost?: () => void;
  onStable?: () => void;
}) {
  return (
    <div className="h-full w-full">
      <Canvas
        camera={{ position: [2.6, 1.4, 4.2], fov: 42 }}
        dpr={[1, 1.75]}
        // alpha:false + an explicit dark clear color: if the context is lost
        // or fails to init, worst case is an opaque near-black canvas that
        // blends into the page background, never a garish flash.
        //
        // Deliberately NOT preserveDrawingBuffer. It was set here to help an
        // embedded webview read the drawing buffer back for programmatic
        // screenshots, but it costs every real user a full framebuffer copy
        // on every frame -- the browser can no longer hand the buffer to the
        // compositor by swapping it (effectively free) and has to duplicate
        // it instead. It never bought anything either: that environment never
        // ran the render loop at all, so the captures were blank regardless.
        gl={{
          antialias: true,
          alpha: false,
          powerPreference: "high-performance",
          failIfMajorPerformanceCaveat: false,
        }}
        onCreated={({ gl, scene }) => {
          scene.background = null;
          gl.setClearColor("#030405", 1);
          let lost = false;
          gl.domElement.addEventListener("webglcontextlost", (e) => {
            e.preventDefault();
            lost = true;
            onContextLost?.();
          });
          // If the browser does restore it, resume rather than staying
          // permanently fallen back -- context loss isn't necessarily final.
          gl.domElement.addEventListener("webglcontextrestored", () => {
            lost = false;
            onStable?.();
          });
          // A WebGL context can be created successfully and still be torn
          // down moments later (observed directly: created, then lost,
          // within well under a second, on more than one machine/browser).
          // Only report "stable" -- which is what reveals the object and its
          // caption -- after surviving a grace window, so a doomed context
          // never gets to flash content on screen before vanishing.
          setTimeout(() => {
            if (!lost) onStable?.();
          }, STABILITY_WINDOW_MS);
        }}
      >
        <ambientLight intensity={0.55} />
        <directionalLight position={[3, 4, 2]} intensity={1.1} />
        <pointLight position={[-3, -1, -2]} intensity={0.3} color="#3fd7ee" />
        <ExplodedObject progressRef={progressRef} pointerRef={pointerRef} />
      </Canvas>
    </div>
  );
}
