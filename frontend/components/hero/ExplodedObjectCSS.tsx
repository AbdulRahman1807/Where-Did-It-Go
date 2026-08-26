"use client";

import { Box3D } from "./Box3D";

const CYAN = "#3fd7ee";
const CYAN_DIM = "#12414a";
const SURFACE = "#1a2029";
const SURFACE_LIGHT = "#252c38";
const LINE = "#3a4250";

interface LayerSpec {
  key: string;
  label: string;
  assembledY: number;
  explodedY: number;
}

// Assembled positions are spaced with a real gap between every layer, not
// stacked/overlapping at the same center point. CSS 3D transforms don't
// reliably depth-sort independently-transformed nested `preserve-3d`
// contexts against each other (unlike a WebGL scene with a real depth
// buffer), so two boxes that geometrically intersect can render with the
// wrong one "winning" regardless of which is actually in front -- the
// visual bug this produced was layers appearing to show through each other.
// Keeping every layer spatially separate even at rest sidesteps that
// entirely rather than fighting it.
const LABEL: LayerSpec = { key: "label", label: "LABEL", assembledY: -102, explodedY: -260 };
const PACKAGE: LayerSpec = { key: "package", label: "PACKAGE", assembledY: 0, explodedY: -70 };
const ITEM: LayerSpec = { key: "item", label: "ITEM", assembledY: 121, explodedY: 140 };
const LOCATION: LayerSpec = { key: "location", label: "LOCATION", assembledY: 187, explodedY: 280 };

// Every value in this file is a pure function of --hero-progress (or of the
// --hl-N highlight intensities derived from it in globals.css), expressed in
// calc() so the browser's style engine evaluates it. Nothing here recomputes
// in React, and this component does not re-render while scrolling at all.
//
// That also means no CSS transitions are needed or wanted: the values already
// track the input continuously, and a transition would restart its easing
// curve on every new target, never settling -- which reads as stutter.
function layerTransform(spec: LayerSpec): string {
  const delta = spec.explodedY - spec.assembledY;
  return `translate(-50%, -50%) translateY(calc(${spec.assembledY}px + var(--hero-progress) * ${delta}px))`;
}

// Blends `base` toward the accent by that layer's highlight intensity, so a
// layer lights up and dims smoothly as the scroll passes over it.
function highlight(base: string, layerIndex: number): string {
  return `color-mix(in srgb, ${CYAN} calc(var(--hl-${layerIndex}) * 100%), ${base})`;
}

// The vertical run of the connecting trace at full explode.
const TRACE_SPAN = Math.abs(LOCATION.explodedY - LABEL.explodedY);

// One `preserve-3d` level per layer, not two: every nested preserve-3d context
// is another 3D rendering context the browser has to keep un-flattened and
// re-project separately, so the inner pass-through wrapper this used to have
// was pure cost for no visual effect.
function Layer({ spec, children }: { spec: LayerSpec; children: React.ReactNode }) {
  return (
    <div
      style={{
        position: "absolute",
        left: "50%",
        top: "50%",
        transformStyle: "preserve-3d",
        transform: layerTransform(spec),
      }}
    >
      {children}
    </div>
  );
}

// The CSS-only counterpart to ExplodedObject.tsx (the react-three-fiber
// version): same visual concept -- a package/item/location assembly that
// separates into labeled layers as the investigation scroll progresses --
// built entirely from real CSS 3D transforms instead of WebGL. See
// Hero3DGate.tsx for why this exists: react-three-fiber's render loop is
// built on requestAnimationFrame, which doesn't fire in every environment
// this has been tested in, so this path has no such dependency -- it's
// driven by scroll/pointer *events* directly, with the browser evaluating
// the resulting calc() transforms and a plain CSS @keyframes animation
// handling the idle spin.
export function ExplodedObjectCSS() {
  return (
    <div style={{ height: "100%", width: "100%", perspective: 1400 }}>
      <div className="css3d-spin" style={{ height: "100%", width: "100%", transformStyle: "preserve-3d" }}>
        <div
          style={{
            height: "100%",
            width: "100%",
            transformStyle: "preserve-3d",
            transform:
              "rotateX(calc(var(--pointer-y) * -8deg)) rotateY(calc(var(--pointer-x) * 14deg))",
          }}
        >
          <div style={{ position: "relative", height: "100%", width: "100%", transformStyle: "preserve-3d" }}>
            {/* Connecting trace, reinforcing "take it apart to investigate".
                Drawn at full length and scaled down rather than given a
                computed `height`: height is a layout property, so animating it
                would dirty layout on every scroll event, while scaleY is a
                composited transform that touches neither layout nor paint. */}
            <div
              style={{
                position: "absolute",
                left: "50%",
                top: "50%",
                width: 1,
                height: TRACE_SPAN,
                background: CYAN_DIM,
                opacity: "calc(var(--hero-progress) * 0.9)",
                transformOrigin: "top center",
                transform: `translate(-50%, 0) translateY(calc(${LABEL.assembledY}px + var(--hero-progress) * ${LABEL.explodedY - LABEL.assembledY}px)) scaleY(var(--hero-progress))`,
              }}
            />

            <Layer spec={LABEL}>
              <Box3D
                width={150}
                height={34}
                depth={8}
                color={highlight(SURFACE_LIGHT, 0)}
                borderColor={highlight(LINE, 0)}
              />
            </Layer>

            <Layer spec={PACKAGE}>
              <Box3D
                width={190}
                height={140}
                depth={140}
                color={highlight(SURFACE, 1)}
                borderColor={highlight(LINE, 1)}
              />
            </Layer>

            <Layer spec={ITEM}>
              <Box3D
                width={72}
                height={72}
                depth={72}
                color={highlight(SURFACE_LIGHT, 2)}
                borderColor={highlight(LINE, 2)}
              />
            </Layer>

            <Layer spec={LOCATION}>
              <div
                style={{
                  width: 140,
                  height: 140,
                  transform: "rotateX(78deg)",
                  transformStyle: "preserve-3d",
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    borderRadius: "50%",
                    border: `2px solid ${highlight(LINE, 3)}`,
                    background: `color-mix(in srgb, ${CYAN}14 calc(var(--hl-3) * 100%), transparent)`,
                  }}
                />
              </div>
            </Layer>
          </div>
        </div>
      </div>
    </div>
  );
}
