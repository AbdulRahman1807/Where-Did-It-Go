# Frontend

Next.js (App Router) + TypeScript + Tailwind CSS + Framer Motion + React Three Fiber.

See the [project root README](../README.md) for the full picture (architecture, setup for both
services, evaluation, demo script). This file only covers frontend-specific notes.

## Run

```bash
npm install   # already done if you're picking this up fresh, but harmless to re-run
npm run dev
```

Opens on http://localhost:3000. Expects the backend API at `http://localhost:8000` (override with
`NEXT_PUBLIC_API_BASE` in a `.env.local` if needed).

## Structure

- `app/` — routes: `/` (cinematic landing), `/investigations` (dashboard), `/investigations/[id]`
  (investigation workspace)
- `components/hero/` — the 3D centerpiece and scroll-driven landing experience. Two-stage
  progressive enhancement: `Hero3DGate` attempts WebGL (`Scene.tsx` + `ExplodedObject.tsx`,
  react-three-fiber) first, and falls back to `ExplodedObjectCSS.tsx` -- the same concept in plain
  CSS 3D transforms, no rAF/WebGL dependency -- if WebGL doesn't confirm stable within ~1.2s. See the
  root README's Limitations section for why that fallback exists and how it was diagnosed.
- `components/investigation/` — the core product: timeline, finding/evidence panels, the human
  review gate, activity feed, outcome panel
- `components/dashboard/`, `components/ui/`, `components/layout/` — supporting pieces
- `lib/types.ts` — TypeScript types mirroring `backend/app/state.py` and the API response shape
- `lib/api.ts`, `lib/sse.ts`, `lib/useInvestigation.ts` — the API client and the hook that drives a
  single incident's live state from a mix of REST snapshots and streamed SSE events
