"use client";

import { useFrame } from "@react-three/fiber";
import { Line } from "@react-three/drei";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { highlightIntensity } from "@/lib/heroHighlight";

const CYAN = "#3fd7ee";
const CYAN_DIM = "#12414a";
const SURFACE = "#1a2029";
const SURFACE_LIGHT = "#252c38";
const OUTLINE = "#3a4250";

interface LayerConfig {
  label: string;
  assembledY: number;
  explodedY: number;
}

const LABEL: LayerConfig = { label: "LABEL", assembledY: 0.62, explodedY: 2.6 };
const PACKAGE: LayerConfig = { label: "PACKAGE", assembledY: 0, explodedY: 0.6 };
const ITEM: LayerConfig = { label: "ITEM", assembledY: 0, explodedY: -1.0 };
const LOCATION: LayerConfig = { label: "LOCATION", assembledY: -0.75, explodedY: -2.9 };

// Both of these are built once at module load, never during render.
//
// A three.js geometry constructed inline in an `args` array (or an array
// literal passed to drei's <Line points>) gets a fresh identity on every
// render, which defeats the memoization inside those components: they tear
// down the old geometry and build a new one -- for EdgesGeometry that means
// re-walking every triangle to extract edges, and for Line it means
// re-uploading an interleaved vertex buffer to the GPU. Hoisting them to
// module scope makes that a one-time cost and stops the per-render churn
// (which also leaked, since the discarded geometries were never disposed).
const PACKAGE_EDGES = new THREE.EdgesGeometry(new THREE.BoxGeometry(1.5, 1.1, 1.1));
const TRACE_POINTS: [number, number, number][] = [
  [0, LABEL.explodedY, 0],
  [0, PACKAGE.explodedY, 0],
  [0, ITEM.explodedY, 0],
  [0, LOCATION.explodedY, 0],
];

type HighlightableMaterial = THREE.Material & {
  color: THREE.Color;
  emissiveIntensity?: number;
};

// Drives one material's highlight from scroll position, every frame.
//
// The highlight used to be a boolean derived from Math.floor(progress * 4),
// so exactly one layer was lit and it changed at three hard thresholds --
// visibly snapping. Now each layer's intensity ramps up and back down as the
// scroll passes over it, and neighbouring layers cross-fade. The intensity
// curve lives in lib/heroHighlight.ts, shared with the CSS-3D centrepiece so
// both versions behave identically.
function useHighlight(
  ref: React.RefObject<HighlightableMaterial | null>,
  baseColor: string,
  layerIndex: number,
  progressRef: React.RefObject<number>,
  emissiveMax = 0,
) {
  const base = useMemo(() => new THREE.Color(baseColor), [baseColor]);
  const accent = useMemo(() => new THREE.Color(CYAN), []);

  useFrame(() => {
    const material = ref.current;
    if (!material) return;
    const k = highlightIntensity(progressRef.current, layerIndex);
    material.color.copy(base).lerp(accent, k);
    if (emissiveMax > 0) material.emissiveIntensity = emissiveMax * k;
  });
}

// No per-layer text label here on purpose: a flat label rotating with the
// object (which spins continuously) would show mirrored once past 90
// degrees of rotation unless billboarded. The "Exposing: X" caption in
// Hero.tsx already communicates the current layer as a fixed 2D overlay
// outside the rotating 3D context, which sidesteps that entirely.

// Scroll progress is read from the ref *inside* useFrame rather than taken as
// a prop, so a scroll event never re-renders the scene graph -- it just
// changes the number this callback reads on its next frame. The damping that
// was already here does the smoothing, so the visible result is unchanged.
function Layer({
  config,
  progressRef,
  children,
}: {
  config: LayerConfig;
  progressRef: React.RefObject<number>;
  children: React.ReactNode;
}) {
  const group = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    if (!group.current) return;
    const targetY = THREE.MathUtils.lerp(config.assembledY, config.explodedY, progressRef.current);
    group.current.position.y = THREE.MathUtils.damp(group.current.position.y, targetY, 4, delta);
  });

  return <group ref={group}>{children}</group>;
}

export function ExplodedObject({
  progressRef,
  pointerRef,
}: {
  progressRef: React.RefObject<number>;
  pointerRef: React.RefObject<{ x: number; y: number }>;
}) {
  const rig = useRef<THREE.Group>(null);
  const trace = useRef<React.ComponentRef<typeof Line>>(null);
  const t = useRef(0);

  const labelMat = useRef<THREE.MeshStandardMaterial>(null);
  const packageMat = useRef<THREE.MeshStandardMaterial>(null);
  const packageEdgeMat = useRef<THREE.LineBasicMaterial>(null);
  const itemMat = useRef<THREE.MeshStandardMaterial>(null);
  const ringMat = useRef<THREE.MeshBasicMaterial>(null);
  const ringFillMat = useRef<THREE.MeshBasicMaterial>(null);

  useHighlight(labelMat, SURFACE_LIGHT, 0, progressRef, 0.35);
  useHighlight(packageMat, SURFACE, 1, progressRef, 0.25);
  useHighlight(packageEdgeMat, OUTLINE, 1, progressRef);
  useHighlight(itemMat, SURFACE_LIGHT, 2, progressRef, 0.4);
  useHighlight(ringMat, OUTLINE, 3, progressRef);
  useHighlight(ringFillMat, OUTLINE, 3, progressRef);

  useFrame((_, delta) => {
    t.current += delta;
    if (trace.current?.material) {
      trace.current.material.opacity = progressRef.current * 0.8;
    }
    if (!rig.current) return;
    const pointer = pointerRef.current;
    const idleSpin = t.current * 0.12;
    const targetRotY = idleSpin + pointer.x * 0.35;
    const targetRotX = pointer.y * -0.15;
    rig.current.rotation.y = THREE.MathUtils.damp(rig.current.rotation.y, targetRotY, 3, delta);
    rig.current.rotation.x = THREE.MathUtils.damp(rig.current.rotation.x, targetRotX, 3, delta);
  });

  return (
    <group ref={rig}>
      {/* connecting trace line, reinforcing the "take it apart to investigate" motif */}
      <Line
        ref={trace}
        points={TRACE_POINTS}
        color={CYAN_DIM}
        transparent
        opacity={0}
        lineWidth={1}
      />

      <Layer config={LABEL} progressRef={progressRef}>
        <mesh>
          <boxGeometry args={[1.15, 0.32, 0.04]} />
          <meshStandardMaterial
            ref={labelMat}
            color={SURFACE_LIGHT}
            emissive={CYAN}
            emissiveIntensity={0}
            roughness={0.5}
            metalness={0.1}
          />
        </mesh>
      </Layer>

      <Layer config={PACKAGE} progressRef={progressRef}>
        <mesh>
          <boxGeometry args={[1.5, 1.1, 1.1]} />
          <meshStandardMaterial
            ref={packageMat}
            color={SURFACE}
            emissive={CYAN}
            emissiveIntensity={0}
            roughness={0.6}
            metalness={0.15}
          />
        </mesh>
        <lineSegments geometry={PACKAGE_EDGES}>
          <lineBasicMaterial ref={packageEdgeMat} color={OUTLINE} />
        </lineSegments>
      </Layer>

      <Layer config={ITEM} progressRef={progressRef}>
        <mesh>
          <boxGeometry args={[0.55, 0.55, 0.55]} />
          <meshStandardMaterial
            ref={itemMat}
            color={SURFACE_LIGHT}
            emissive={CYAN}
            emissiveIntensity={0}
            roughness={0.4}
            metalness={0.2}
          />
        </mesh>
      </Layer>

      <Layer config={LOCATION} progressRef={progressRef}>
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.5, 0.62, 48]} />
          <meshBasicMaterial ref={ringMat} color={OUTLINE} transparent opacity={0.9} />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.5, 48]} />
          <meshBasicMaterial ref={ringFillMat} color={OUTLINE} transparent opacity={0.08} />
        </mesh>
      </Layer>
    </group>
  );
}
