"use client";

import { useScrollProgress } from "@/lib/useScrollProgress";

// A second pinned stage that follows the exploded-object stage and tells the
// product's story as a plan view of a fulfillment centre: a unit is put away,
// moves without a scan, a pick fails, the agent traces it, a human decides.
//
// It uses the hero's same scroll channel. useScrollProgress writes
// --hero-progress onto this stage's own wrapper (a sibling of .hero-root, so
// the two never share a value), and every opacity, position and stroke below
// is a calc() against it. No React state, no re-render while scrolling, no
// transitions -- the same contract as ExplodedObjectCSS.

const P = "var(--hero-progress)";
const n = (v: number) => v.toFixed(3);

// 0 before `a`, 1 after `b`, linear between.
const ramp = (a: number, b: number) => `clamp(0, calc((${P} - ${n(a)}) / ${n(b - a)}), 1)`;
// Fades in over a..b, fades back out over c..d.
const win = (a: number, b: number, c: number, d: number) =>
  `calc(${ramp(a, b)} * (1 - ${ramp(c, d)}))`;
// Fully present until c, gone by d.
const until = (c: number, d: number) => `calc(1 - ${ramp(c, d)})`;

const C = {
  cyan: "var(--accent-cyan)",
  cyanDim: "var(--accent-cyan-dim)",
  green: "var(--accent-green)",
  greenDim: "var(--accent-green-dim)",
  amber: "var(--accent-amber)",
  amberDim: "var(--accent-amber-dim)",
  red: "var(--accent-red)",
  redDim: "var(--accent-red-dim)",
  grey: "var(--accent-grey)",
  text: "var(--text-primary)",
  textSec: "var(--text-secondary)",
  textTer: "var(--text-tertiary)",
  line: "var(--border-medium)",
  faint: "var(--border-subtle)",
  surface: "var(--bg-surface)",
  surface2: "var(--bg-surface-2)",
};

// The scroll beats. Each caption and each scene event is timed against these.
const BEATS = [
  {
    n: "01",
    title: "A fulfillment centre.",
    body: "Every unit has a location on record. A new unit is received and put away at A-17 -- and the system believes it.",
    from: 0,
    to: 0.24,
  },
  {
    n: "02",
    title: "The item moves. The record doesn't.",
    body: "An automated move takes it to B-12 and the scan is missed. The system still says A-17.",
    from: 0.24,
    to: 0.44,
  },
  {
    n: "03",
    title: "A pick fails.",
    body: "The picker reaches A-17 and finds nothing. The order stalls on ITEM_NOT_FOUND, and no one knows where the item went.",
    from: 0.44,
    to: 0.6,
  },
  {
    n: "04",
    title: "The agent investigates.",
    body: "It pulls the pick task, inventory and location history, checks them against procedure, and traces the item to B-12 -- labeled an inference, not a fact.",
    from: 0.6,
    to: 0.86,
  },
  {
    n: "05",
    title: "A human decides.",
    body: "The recommendation: verify at B-12 and correct the record. A person approves, rejects, or escalates, and the loop closes.",
    from: 0.86,
    to: 1,
  },
] as const;

// Caption i is visible from its own start to the next one's start, with a
// short overlap so neighbours cross-fade.
function captionOpacity(i: number): string {
  const start = BEATS[i].from;
  const end = i === BEATS.length - 1 ? null : BEATS[i + 1].from;
  if (i === 0) return until(end! - 0.02, end! + 0.02);
  if (end === null) return ramp(start - 0.02, start + 0.02);
  return win(start - 0.02, start + 0.02, end - 0.02, end + 0.02);
}

// ---- Plan-view geometry (viewBox 0 0 1000 560) -----------------------------
const RACK_TOP = 110;
const ROW_H = 45;
const ROWS = 8;
const AISLE_Y = 75; // cross aisle the item and picker travel along
const AISLE_AB = 315; // north-south aisle between racks A and B
const A17 = { x: 230, y: 178 }; // slot the system believes holds the item
const B12 = { x: 400, y: 358 }; // slot the item actually sits in

function Rack({ x, label }: { x: number; label: string }) {
  const bottom = RACK_TOP + ROW_H * ROWS;
  return (
    <g>
      <rect x={x} y={RACK_TOP} width={80} height={bottom - RACK_TOP} fill={C.surface} stroke={C.line} />
      {Array.from({ length: ROWS - 1 }, (_, i) => (
        <line
          key={i}
          x1={x}
          x2={x + 80}
          y1={RACK_TOP + ROW_H * (i + 1)}
          y2={RACK_TOP + ROW_H * (i + 1)}
          stroke={C.faint}
        />
      ))}
      <line x1={x + 40} x2={x + 40} y1={RACK_TOP} y2={bottom} stroke={C.faint} />
      <text
        x={x + 40}
        y={RACK_TOP - 12}
        textAnchor="middle"
        className="font-display"
        fontSize={17}
        fill={C.textTer}
        style={{ letterSpacing: "0.2em" }}
      >
        {label}
      </text>
    </g>
  );
}

function Tag({
  x,
  y,
  w,
  color,
  dim,
  opacity,
  children,
}: {
  x: number;
  y: number;
  w: number;
  color: string;
  dim: string;
  opacity: string;
  children: React.ReactNode;
}) {
  return (
    <g style={{ opacity }}>
      <rect x={x} y={y} width={w} height={20} rx={2} fill={dim} stroke={color} />
      <text
        x={x + w / 2}
        y={y + 14}
        textAnchor="middle"
        fontSize={11.5}
        fontWeight={500}
        fill={color}
        style={{ letterSpacing: "0.08em" }}
      >
        {children}
      </text>
    </g>
  );
}

const EVIDENCE = [
  { at: 0.6, color: C.cyan, head: "Pick task PX-1042", sub: "failed · ITEM_NOT_FOUND" },
  { at: 0.645, color: C.amber, head: "Inventory record", sub: "A-17 · last updated 08:00Z" },
  { at: 0.69, color: C.cyan, head: "Location history", sub: "moved to B-12 · 14:21Z" },
  { at: 0.735, color: C.cyan, head: "Item trace XJ-482", sub: "no scan at A-17 since" },
  { at: 0.78, color: C.cyan, head: "SOP-04 · stale records", sub: "verify before correcting" },
] as const;

function Scene() {
  // Item path. Put-away: receiving -> cross aisle -> down the A/B aisle -> into A-17.
  // Automated move: back out, down the aisle, into B-12.
  const itemX = `calc(${ramp(0.03, 0.09)} * 265px + ${ramp(0.14, 0.19)} * -85px + ${ramp(0.25, 0.29)} * 85px + ${ramp(0.37, 0.4)} * 85px)`;
  const itemY = `calc(${ramp(0.09, 0.14)} * 103px + ${ramp(0.29, 0.37)} * 180px)`;
  const itemTransform = `translate(50px, ${AISLE_Y}px) translate(${itemX}, ${itemY})`;

  // Picker path: out of pack & ship, along the cross aisle, down to A-17.
  const pickX = `calc(${ramp(0.45, 0.51)} * -375px + ${ramp(0.54, 0.56)} * -53px)`;
  const pickY = `calc(${ramp(0.51, 0.54)} * 103px)`;
  const pickerTransform = `translate(690px, ${AISLE_Y}px) translate(${pickX}, ${pickY})`;

  const itemRect = { x: -11, y: -11, width: 22, height: 22, rx: 3 } as const;

  return (
    <svg
      viewBox="0 0 1000 560"
      role="img"
      aria-label="Plan view of a fulfillment centre. A unit is put away at A-17, is moved to B-12 without a scan, and a pick at A-17 fails. The agent traces the item to B-12 from the operational evidence, and a human reviews the recommendation."
      className="h-auto max-h-[72vh] w-full"
    >
      <defs>
        <pattern id="story-floor-grid" width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M40 0H0V40" fill="none" stroke={C.cyan} strokeOpacity={0.06} />
        </pattern>
      </defs>

      {/* ---- Floor ---- */}
      <rect x={10} y={20} width={730} height={520} fill="url(#story-floor-grid)" stroke={C.line} />

      {/* receiving */}
      <rect x={10} y={20} width={80} height={520} fill={C.cyan} fillOpacity={0.03} stroke={C.faint} />
      <text x={50} y={46} textAnchor="middle" fontSize={11} fill={C.textTer} style={{ letterSpacing: "0.16em" }}>
        RECEIVING
      </text>
      {[110, 210, 310].map((y) => (
        <rect key={y} x={6} y={y} width={8} height={56} fill={C.cyanDim} stroke={C.cyan} strokeOpacity={0.5} />
      ))}

      {/* pack & ship */}
      <rect x={640} y={20} width={100} height={520} fill={C.cyan} fillOpacity={0.03} stroke={C.faint} />
      <text x={690} y={46} textAnchor="middle" fontSize={11} fill={C.textTer} style={{ letterSpacing: "0.16em" }}>
        PACK &amp; SHIP
      </text>
      {[110, 210, 310].map((y) => (
        <rect key={y} x={736} y={y} width={8} height={56} fill={C.cyanDim} stroke={C.cyan} strokeOpacity={0.5} />
      ))}

      {/* racking */}
      <Rack x={170} label="A" />
      <Rack x={380} label="B" />
      <Rack x={540} label="C" />

      {/* ---- What the system believes about A-17 ---- */}
      {[
        { color: C.green, dim: C.greenDim, op: win(0.17, 0.2, 0.4, 0.43) },
        { color: C.amber, dim: C.amberDim, op: win(0.4, 0.43, 0.55, 0.58) },
        { color: C.red, dim: C.redDim, op: win(0.55, 0.58, 0.96, 0.99) },
      ].map((s) => (
        <rect
          key={s.color}
          x={A17.x - 20}
          y={A17.y - 22.5}
          width={40}
          height={45}
          fill={s.dim}
          fillOpacity={0.45}
          stroke={s.color}
          strokeDasharray="4 3"
          style={{ opacity: s.op }}
        />
      ))}

      {/* the slot the item really occupies, lit once it is found */}
      <rect
        x={B12.x - 20}
        y={B12.y - 22.5}
        width={40}
        height={45}
        fill={C.cyanDim}
        fillOpacity={0.5}
        stroke={C.cyan}
        style={{ opacity: win(0.82, 0.85, 0.96, 0.99) }}
      />
      <rect
        x={B12.x - 20}
        y={B12.y - 22.5}
        width={40}
        height={45}
        fill={C.greenDim}
        fillOpacity={0.5}
        stroke={C.green}
        style={{ opacity: ramp(0.96, 0.99) }}
      />

      {/* ---- Agent trace A-17 -> B-12 ---- */}
      <path
        d={`M ${A17.x} ${A17.y} H ${AISLE_AB} V ${B12.y} H ${B12.x}`}
        pathLength={1}
        fill="none"
        stroke={C.cyan}
        strokeWidth={2}
        strokeDasharray="1 1"
        style={{ strokeDashoffset: `calc(1 - ${ramp(0.78, 0.82)})`, opacity: until(0.96, 0.99) }}
      />

      {/* radar sweep out of A-17 while the agent starts looking */}
      <circle
        cx={A17.x}
        cy={A17.y}
        r={46}
        fill="none"
        stroke={C.cyan}
        style={{
          opacity: `calc(0.7 * ${win(0.6, 0.62, 0.68, 0.74)})`,
          transformBox: "fill-box",
          transformOrigin: "center",
          transform: `scale(calc(0.3 + 1.2 * ${ramp(0.6, 0.74)}))`,
        }}
      />

      {/* ---- The unit ---- */}
      <g style={{ transform: itemTransform }}>
        {/* tracked */}
        <rect {...itemRect} fill={C.cyanDim} stroke={C.cyan} strokeWidth={1.5} style={{ opacity: until(0.25, 0.28) }} />
        {/* moved without a scan: invisible to the system */}
        <rect
          {...itemRect}
          fill="none"
          stroke={C.textSec}
          strokeWidth={1.5}
          strokeDasharray="3 2"
          style={{ opacity: win(0.25, 0.28, 0.82, 0.85) }}
        />
        {/* found: inferred location */}
        <circle r={23} fill="none" stroke={C.cyan} style={{ opacity: `calc(0.45 * ${win(0.82, 0.85, 0.96, 0.99)})` }} />
        <rect {...itemRect} fill={C.cyanDim} stroke={C.cyan} strokeWidth={1.5} style={{ opacity: win(0.82, 0.85, 0.96, 0.99) }} />
        {/* resolved */}
        <rect {...itemRect} fill={C.greenDim} stroke={C.green} strokeWidth={1.5} style={{ opacity: ramp(0.96, 0.99) }} />
      </g>

      {/* ---- Picker ---- */}
      <g style={{ transform: pickerTransform, opacity: win(0.43, 0.45, 0.84, 0.88) }}>
        <circle r={10} fill={C.surface2} stroke={C.text} strokeWidth={1.5} />
        <circle r={3} fill={C.text} />
        <text y={26} textAnchor="middle" fontSize={11} fill={C.textSec} style={{ letterSpacing: "0.14em" }}>
          PICKER
        </text>
      </g>

      {/* ---- Failure at A-17 ---- */}
      <g style={{ opacity: win(0.56, 0.58, 0.84, 0.87) }}>
        <g className="animate-pulse">
          <circle cx={A17.x} cy={A17.y} r={27} fill="none" stroke={C.red} strokeWidth={1.5} />
        </g>
      </g>
      <text
        x={A17.x}
        y={A17.y + 7}
        textAnchor="middle"
        className="font-display"
        fontSize={20}
        fontWeight={600}
        fill={C.red}
        style={{ opacity: win(0.56, 0.59, 0.82, 0.85) }}
      >
        ?
      </text>
      <Tag x={96} y={A17.y - 10} w={68} color={C.red} dim={C.redDim} opacity={win(0.57, 0.6, 0.84, 0.87)}>
        NOT FOUND
      </Tag>

      {/* the missed scan */}
      <g style={{ opacity: win(0.31, 0.35, 0.58, 0.61) }}>
        <text x={AISLE_AB - 18} y={262} textAnchor="end" fontSize={11.5} fontWeight={500} fill={C.amber} style={{ letterSpacing: "0.08em" }}>
          MOVED
        </text>
        <text x={AISLE_AB - 18} y={277} textAnchor="end" fontSize={11.5} fontWeight={500} fill={C.amber} style={{ letterSpacing: "0.08em" }}>
          NO SCAN
        </text>
      </g>

      {/* the inference, labeled as one */}
      <Tag x={466} y={B12.y - 10} w={68} color={C.cyan} dim={C.cyanDim} opacity={win(0.83, 0.86, 0.96, 0.99)}>
        INFERRED
      </Tag>
      <Tag x={466} y={B12.y - 10} w={68} color={C.green} dim={C.greenDim} opacity={ramp(0.96, 0.99)}>
        B-12 · FOUND
      </Tag>

      {/* ---- System record ---- */}
      <g>
        <rect x={770} y={20} width={220} height={140} fill={C.surface} stroke={C.line} />
        <text x={782} y={42} fontSize={10.5} fill={C.textTer} style={{ letterSpacing: "0.14em" }}>
          WHAT THE SYSTEM BELIEVES
        </text>
        <text x={782} y={68} className="font-display" fontSize={21} fontWeight={500} fill={C.text}>
          XJ-482
        </text>
        <text x={782} y={92} fontSize={10.5} fill={C.textTer} style={{ letterSpacing: "0.14em" }}>
          LOCATION
        </text>
        {[
          { t: "Awaiting receipt", c: C.textTer, op: until(0.17, 0.2) },
          { t: "A-17", c: C.green, op: win(0.17, 0.2, 0.4, 0.43) },
          { t: "A-17 · STALE", c: C.amber, op: win(0.4, 0.43, 0.55, 0.58) },
          { t: "A-17 · NOT FOUND", c: C.red, op: win(0.55, 0.58, 0.96, 0.99) },
          { t: "B-12 · CORRECTED", c: C.green, op: ramp(0.96, 0.99) },
        ].map((v) => (
          <text key={v.t} x={782} y={114} className="font-display" fontSize={18} fontWeight={500} fill={v.c} style={{ opacity: v.op }}>
            {v.t}
          </text>
        ))}
        <line x1={770} x2={990} y1={126} y2={126} stroke={C.faint} />
        <text x={782} y={148} fontSize={10.5} fill={C.textTer} style={{ letterSpacing: "0.14em" }}>
          ORDER
        </text>
        {[
          { t: "ON TRACK", c: C.green, op: until(0.55, 0.58) },
          { t: "BLOCKED", c: C.red, op: win(0.55, 0.58, 0.97, 1) },
          { t: "UNBLOCKED", c: C.green, op: ramp(0.97, 1) },
        ].map((v) => (
          <text key={v.t} x={850} y={148} fontSize={12.5} fontWeight={600} fill={v.c} style={{ opacity: v.op, letterSpacing: "0.08em" }}>
            {v.t}
          </text>
        ))}
      </g>

      {/* ---- Agent evidence ---- */}
      <g style={{ opacity: ramp(0.58, 0.61) }}>
        <circle cx={776} cy={183} r={3} fill={C.cyan} />
        <text x={786} y={187} fontSize={10.5} fill={C.cyan} style={{ letterSpacing: "0.14em" }}>
          AGENT EVIDENCE
        </text>
      </g>
      {EVIDENCE.map((e, i) => {
        const y = 196 + i * 40;
        const shown = ramp(e.at, e.at + 0.035);
        return (
          <g key={e.head} style={{ opacity: shown, transform: `translateX(calc((1 - ${shown}) * 14px))` }}>
            <rect x={770} y={y} width={220} height={34} fill={C.surface} stroke={C.line} />
            <rect x={770} y={y} width={3} height={34} fill={e.color} />
            <text x={784} y={y + 14} fontSize={13.5} fontWeight={500} fill={C.text}>
              {e.head}
            </text>
            <text x={784} y={y + 28} fontSize={11.5} fill={C.textSec}>
              {e.sub}
            </text>
          </g>
        );
      })}

      {/* ---- Human review ---- */}
      <g style={{ opacity: ramp(0.86, 0.9), transform: `translateY(calc((1 - ${ramp(0.86, 0.9)}) * 12px))` }}>
        <rect x={770} y={406} width={220} height={134} fill={C.surface} stroke={C.amber} strokeOpacity={0.6} />
        <text x={782} y={428} fontSize={10.5} fill={C.amber} style={{ letterSpacing: "0.14em" }}>
          HUMAN REVIEW
        </text>
        <text x={782} y={452} fontSize={13.5} fontWeight={500} fill={C.text}>
          Verify XJ-482 at B-12,
        </text>
        <text x={782} y={469} fontSize={13.5} fontWeight={500} fill={C.text}>
          then correct the record.
        </text>
        {[
          { t: "APPROVE", x: 780, w: 64 },
          { t: "REJECT", x: 850, w: 56 },
          { t: "ESCALATE", x: 912, w: 68 },
        ].map((b) => (
          <g key={b.t}>
            <rect x={b.x} y={498} width={b.w} height={26} fill="none" stroke={C.line} />
            <text x={b.x + b.w / 2} y={515} textAnchor="middle" fontSize={10.5} fontWeight={500} fill={C.textSec} style={{ letterSpacing: "0.1em" }}>
              {b.t}
            </text>
          </g>
        ))}
        {/* the human's choice */}
        <g style={{ opacity: ramp(0.93, 0.96) }}>
          <rect x={780} y={498} width={64} height={26} fill={C.greenDim} stroke={C.green} />
          <text x={812} y={515} textAnchor="middle" fontSize={10.5} fontWeight={600} fill={C.green} style={{ letterSpacing: "0.1em" }}>
            APPROVE
          </text>
        </g>
      </g>
    </svg>
  );
}

export function FulfillmentStory() {
  const { ref } = useScrollProgress<HTMLDivElement>();

  return (
    <div ref={ref} className="relative h-[500vh] border-t border-border-subtle">
      <div className="sticky top-0 h-screen w-full overflow-hidden bg-void">
        <div className="mx-auto flex h-full max-w-[92rem] flex-col justify-center gap-6 px-6 sm:px-12 lg:grid lg:grid-cols-[17rem_minmax(0,1fr)] lg:items-center lg:gap-8 lg:px-8">
          <div>
            <div className="text-xs font-medium uppercase tracking-[0.3em] text-text-tertiary">
              One missing item, investigated
            </div>

            <div className="relative mt-5 h-60 lg:h-72">
              {BEATS.map((b, i) => (
                <div
                  key={b.n}
                  className="absolute inset-x-0 top-0"
                  style={{
                    opacity: captionOpacity(i),
                    transform: `translateY(calc((1 - ${i === 0 ? 1 : ramp(b.from - 0.02, b.from + 0.02)}) * 12px))`,
                  }}
                >
                  <div className="font-display text-sm text-cyan">{b.n}</div>
                  <h2 className="mt-2 font-display text-2xl font-medium tracking-tight text-text-primary sm:text-3xl">
                    {b.title}
                  </h2>
                  <p className="mt-3 text-sm leading-relaxed text-text-secondary sm:text-base">{b.body}</p>
                </div>
              ))}
            </div>

            <div className="flex gap-1.5" aria-hidden>
              {BEATS.map((b) => (
                <div key={b.n} className="h-px w-8 bg-border-medium">
                  <div
                    className="h-px origin-left bg-cyan"
                    style={{ transform: `scaleX(${ramp(b.from, b.to)})` }}
                  />
                </div>
              ))}
            </div>
          </div>

          <Scene />
        </div>
      </div>
    </div>
  );
}
