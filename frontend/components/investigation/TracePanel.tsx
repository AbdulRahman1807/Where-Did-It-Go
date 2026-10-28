"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";
import { Panel } from "@/components/ui/Panel";
import { getTrace } from "@/lib/api";
import type { ItemTrace, TraceTimelineItem } from "@/lib/types";

// Times in the records are UTC; show them as UTC so the panel lines up with
// the raw event data an analyst would compare it against.
function formatTime(iso: string): string {
  return (
    new Date(iso).toLocaleString("en-GB", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "UTC",
    }) + " UTC"
  );
}

const FINDING_STYLES = {
  conflict: "border-red/30 bg-red-dim/30 text-red",
  unexplained: "border-amber/30 bg-amber-dim/30 text-amber",
  info: "border-border-subtle bg-surface-2 text-text-secondary",
} as const;

function dotClass(item: TraceTimelineItem): string {
  if (item.kind === "pick_attempt") {
    if (item.explained === true) return "bg-green";
    if (item.explained === false) return "bg-red";
    return "bg-grey";
  }
  return item.kind === "inventory_update" ? "bg-amber" : "bg-cyan";
}

function verdictNote(item: TraceTimelineItem): { text: string; className: string } | null {
  if (item.kind !== "pick_attempt" || item.verdict === "not_applicable") return null;
  if (item.explained === true) return { text: "Explained by the records", className: "text-green" };
  if (item.explained === false) return { text: "Not explained by the records", className: "text-red" };
  return { text: "Cannot be assessed from the records", className: "text-text-tertiary" };
}

// The deterministic half of the investigation: where the records last place
// the item, replayed against each failed pick. It needs no model call, so it
// is shown for every case, including ones not yet investigated.
export function TracePanel({ incidentId }: { incidentId: string }) {
  const [trace, setTrace] = useState<ItemTrace | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getTrace(incidentId)
      .then((t) => !cancelled && setTrace(t))
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [incidentId]);

  if (failed || !trace) return null;

  const last = trace.last_known;
  const lastText = !last
    ? "No location record"
    : last.location
      ? `${last.location}`
      : "Left its location (destination not recorded)";

  return (
    <Panel eyebrow={`Item trace · ${trace.sku}`} title="Last known record" data-testid="item-trace">
      <div className="space-y-5 px-5 py-5">
        <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
          <div>
            <div className="text-[11px] uppercase tracking-widest text-text-tertiary">Last known location</div>
            <div className="font-display text-xl font-medium text-text-primary">{lastText}</div>
            {last && <div className="text-xs text-text-tertiary">as of {formatTime(last.as_of)}</div>}
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-widest text-text-tertiary">Assigned pick location</div>
            <div
              className={clsx(
                "font-display text-xl font-medium",
                trace.assigned_matches_last_known === false ? "text-red" : "text-text-primary"
              )}
            >
              {trace.assigned_location}
            </div>
            {trace.assigned_matches_last_known === false && (
              <div className="text-xs text-red">differs from last known</div>
            )}
          </div>
        </div>

        {trace.findings.length > 0 && (
          <div className="space-y-2">
            {trace.findings.map((f, i) => (
              <div key={`${f.code}-${i}`} className={clsx("rounded-md border px-4 py-3 text-sm", FINDING_STYLES[f.severity])}>
                {f.message}
              </div>
            ))}
          </div>
        )}

        {trace.timeline.length > 0 && (
          <ol className="space-y-3 border-l border-border-subtle pl-4">
            {trace.timeline.map((item) => {
              const note = verdictNote(item);
              return (
                <li key={`${item.kind}-${item.ref}`} className="relative text-sm">
                  <span
                    className={clsx("absolute -left-[21px] top-1.5 h-2 w-2 rounded-full", dotClass(item))}
                    aria-hidden
                  />
                  <div className="text-xs text-text-tertiary">{formatTime(item.timestamp)}</div>
                  <div className="text-text-primary">{item.label}</div>
                  {item.detail && <div className="text-xs text-text-secondary">{item.detail}</div>}
                  {note && <div className={clsx("text-xs font-medium", note.className)}>{note.text}</div>}
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </Panel>
  );
}
