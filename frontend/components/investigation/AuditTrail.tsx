"use client";

import { useState } from "react";
import { Panel } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";
import { getIncidentAudit } from "@/lib/api";
import type { AuditEntry } from "@/lib/types";

// Surfaces the checkpointer's full per-incident state history as an
// explicit, exportable audit trail (root README next-steps item #5) --
// fetched on demand rather than on every page load, since it's a
// secondary/inspection view, not part of the primary investigation flow.
export function AuditTrail({ incidentId }: { incidentId: string }) {
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<AuditEntry[] | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    if (open) {
      setOpen(false);
      return;
    }
    setOpen(true);
    if (entries !== null) return; // already loaded once
    setLoading(true);
    setError(null);
    try {
      const res = await getIncidentAudit(incidentId);
      setEntries(res.entries);
      setNote(res.note ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load audit trail.");
    } finally {
      setLoading(false);
    }
  }

  function exportJson() {
    if (!entries) return;
    const blob = new Blob([JSON.stringify({ incident_id: incidentId, entries }, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${incidentId}-audit-trail.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Panel
      eyebrow="Checkpointed state history"
      title="Audit trail"
      action={
        <div className="flex items-center gap-2">
          {open && entries && entries.length > 0 && (
            <Button variant="ghost" className="px-3 py-1.5 text-xs" onClick={exportJson}>
              Export JSON
            </Button>
          )}
          <Button variant="ghost" className="px-3 py-1.5 text-xs" onClick={toggle}>
            {open ? "Hide" : "Show"}
          </Button>
        </div>
      }
    >
      {open && (
        <div className="max-h-96 overflow-y-auto px-5 py-4">
          {loading && <div className="text-sm text-text-tertiary">Loading audit trail…</div>}
          {error && <div className="text-sm text-red">{error}</div>}
          {note && <div className="mb-3 text-sm text-text-tertiary">{note}</div>}
          {!loading && !error && entries && entries.length === 0 && !note && (
            <div className="text-sm text-text-tertiary">No checkpointed state yet.</div>
          )}
          {!loading && !error && entries && entries.length > 0 && (
            <ol className="space-y-3">
              {entries.map((e, i) => (
                <li key={e.checkpoint_id ?? i} className="rounded-md border border-border-subtle bg-surface-2 px-3 py-2.5 text-sm">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-text-tertiary">
                    <span className="font-mono">{e.node ?? "case opened"}</span>
                    <span>·</span>
                    <span>{new Date(e.timestamp).toLocaleString()}</span>
                    {e.status && (
                      <>
                        <span>·</span>
                        <span>{e.status}</span>
                      </>
                    )}
                    {e.round != null && (
                      <>
                        <span>·</span>
                        <span>round {e.round}</span>
                      </>
                    )}
                    {e.review_required && (
                      <>
                        <span>·</span>
                        <span className="text-amber">review required</span>
                      </>
                    )}
                  </div>
                  {e.new_activity.length > 0 && (
                    <ul className="mt-1.5 list-inside list-disc space-y-0.5 text-text-secondary">
                      {e.new_activity.map((line, j) => (
                        <li key={j}>{line}</li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </Panel>
  );
}
