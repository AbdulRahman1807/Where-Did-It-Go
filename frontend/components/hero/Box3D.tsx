"use client";

import { memo } from "react";

// A real 3D rectangular box built from six CSS-transformed faces sharing a
// `transform-style: preserve-3d` parent. Pure CSS/DOM -- no canvas, no
// WebGL, no requestAnimationFrame dependency. The browser's own compositor
// handles the 3D projection and any CSS transitions, so this renders and
// animates correctly even in environments where rAF-driven render loops
// (like react-three-fiber's) don't run.
//
// Memoized because every prop is a primitive and the parent re-renders on
// each discrete scroll phase change: without this, all six faces of all
// three boxes would be re-rendered to produce byte-identical output whenever
// any *one* layer's highlight changed.
function Box3DImpl({
  width,
  height,
  depth,
  color,
  borderColor,
}: {
  width: number;
  height: number;
  depth: number;
  color: string;
  borderColor: string;
}) {
  // Solid fill + a defined border communicate "highlighted" (via the color
  // props the caller passes in) -- no glow/shadow. Consistent with the rest
  // of the interface after the glassmorphism/soft-glow cleanup pass.
  //
  // No transition: the caller passes colours that already interpolate
  // continuously (a color-mix against a scroll-derived highlight intensity),
  // so a transition here would fight that rather than smooth it.
  const faceBase: React.CSSProperties = {
    position: "absolute",
    border: `1px solid ${borderColor}`,
    background: color,
  };

  return (
    <div
      style={{
        position: "relative",
        width,
        height,
        transformStyle: "preserve-3d",
      }}
    >
      {/* front */}
      <div style={{ ...faceBase, width, height, transform: `translateZ(${depth / 2}px)` }} />
      {/* back */}
      <div
        style={{ ...faceBase, width, height, transform: `rotateY(180deg) translateZ(${depth / 2}px)` }}
      />
      {/* right */}
      <div
        style={{
          ...faceBase,
          width: depth,
          height,
          left: (width - depth) / 2,
          transform: `rotateY(90deg) translateZ(${width / 2}px)`,
        }}
      />
      {/* left */}
      <div
        style={{
          ...faceBase,
          width: depth,
          height,
          left: (width - depth) / 2,
          transform: `rotateY(-90deg) translateZ(${width / 2}px)`,
        }}
      />
      {/* top */}
      <div
        style={{
          ...faceBase,
          width,
          height: depth,
          top: (height - depth) / 2,
          transform: `rotateX(90deg) translateZ(${height / 2}px)`,
        }}
      />
      {/* bottom */}
      <div
        style={{
          ...faceBase,
          width,
          height: depth,
          top: (height - depth) / 2,
          transform: `rotateX(-90deg) translateZ(${height / 2}px)`,
        }}
      />
    </div>
  );
}

export const Box3D = memo(Box3DImpl);
