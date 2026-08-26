// Per-layer highlight intensity for the hero's exploded object.
//
// This mirrors the --hl-0 .. --hl-3 custom properties defined on .hero-root in
// app/globals.css. The CSS version drives the CSS-3D centrepiece; this one
// drives the WebGL centrepiece from inside useFrame, where there is no CSS to
// read. Both must agree, so the constants live here and the CSS carries a
// comment pointing back at this file.
//
// Each layer owns a focus window centred on the midpoint of its quarter of the
// scroll. Intensity falls off linearly over a window wider than the spacing
// between centres, so adjacent layers cross-fade rather than switching.

export const LAYER_CENTERS = [0.125, 0.375, 0.625, 0.875] as const;
export const FOCUS_WINDOW = 0.25;

// Ramp-up over the first 10% of scroll, so nothing is lit while the hero sits
// at rest and the highlight "arrives" as the user starts scrolling. This
// replaced a hard `progress > 0.05` boolean, which switched on in one frame.
const REVEAL_RATE = 10;

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

export function highlightIntensity(progress: number, layerIndex: number): number {
  const reveal = clamp01(progress * REVEAL_RATE);
  const center = LAYER_CENTERS[layerIndex];

  // The first and last layers only fall off on their inward side. There is no
  // neighbour beyond them to hand the highlight to, so falling off outward
  // would just dim the top layer at rest and the bottom layer at full explode
  // -- exactly where each one should be the thing you are looking at.
  const distance =
    layerIndex === 0
      ? Math.max(progress - center, 0)
      : layerIndex === LAYER_CENTERS.length - 1
        ? Math.max(center - progress, 0)
        : Math.abs(progress - center);

  return reveal * clamp01(1 - distance / FOCUS_WINDOW);
}
