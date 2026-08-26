"use client";

import { useEffect, useRef } from "react";
import { Panel } from "@/components/ui/Panel";
import type { ActivityEntry } from "@/lib/useInvestigation";

export function ActivityFeed({
  history,
  live,
  streaming,
}: {
  history: string[];
  live: ActivityEntry[];
  streaming: boolean;
}) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [live.length]);

  const combined = [...history.map((text, i) => ({ id: -history.length + i, text })), ...live];

  return (
    <Panel eyebrow="Agent activity" title="Investigation log">
      <div className="max-h-64 overflow-y-auto px-5 py-4">
        {combined.length === 0 && (
          <div className="text-sm text-text-tertiary">Nothing logged yet.</div>
        )}
        <ol className="space-y-2.5">
          {combined.map((entry) => (
            <li key={entry.id} className="flex items-start gap-3 text-sm">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan/60" aria-hidden />
              <span className="text-text-secondary">{entry.text}</span>
            </li>
          ))}
        </ol>
        {streaming && (
          <div className="mt-3 flex items-center gap-2 text-xs text-cyan">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan" aria-hidden />
            Working…
          </div>
        )}
        <div ref={bottomRef} />
      </div>
    </Panel>
  );
}
