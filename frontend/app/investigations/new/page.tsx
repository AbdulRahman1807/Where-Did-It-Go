"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createIncident, type NewIncidentSubmission } from "@/lib/api";
import { TopBar } from "@/components/layout/TopBar";
import { Button } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Panel";

const inputClass =
  "focus-ring mt-1.5 w-full rounded-md border border-border-medium bg-surface-2 px-3 py-2.5 text-sm text-text-primary placeholder:text-text-tertiary";
const labelClass = "text-[11px] font-medium uppercase tracking-widest text-text-tertiary";

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className={labelClass}>{label}</span>
      {children}
      {hint && <p className="mt-1 text-xs text-text-tertiary">{hint}</p>}
    </label>
  );
}

export default function NewIncidentPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [sku, setSku] = useState("");
  const [itemDescription, setItemDescription] = useState("");
  const [location, setLocation] = useState("");
  const [qtyRequested, setQtyRequested] = useState(1);
  const [priority, setPriority] = useState<"standard" | "expedited">("standard");
  const [customerRef, setCustomerRef] = useState("");
  const [reasonCode, setReasonCode] = useState<"ITEM_NOT_FOUND" | "SHORT_PICK">("ITEM_NOT_FOUND");
  const [qtyPicked, setQtyPicked] = useState(0);
  const [attemptCount, setAttemptCount] = useState(1);
  const [restricted, setRestricted] = useState(false);
  const [hasInventory, setHasInventory] = useState(true);
  const [inventoryQty, setInventoryQty] = useState(0);
  const [summary, setSummary] = useState("");

  const canSubmit =
    sku.trim().length > 0 &&
    itemDescription.trim().length > 0 &&
    location.trim().length > 0 &&
    qtyRequested > 0 &&
    (reasonCode !== "SHORT_PICK" || qtyPicked < qtyRequested);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const submission: NewIncidentSubmission = {
        sku: sku.trim(),
        item_description: itemDescription.trim(),
        location: location.trim(),
        qty_requested: qtyRequested,
        priority,
        customer_ref: customerRef.trim() || undefined,
        reason_code: reasonCode,
        qty_picked: reasonCode === "SHORT_PICK" ? qtyPicked : undefined,
        attempt_count: attemptCount,
        restricted,
        inventory_qty: hasInventory ? inventoryQty : undefined,
        summary: summary.trim() || undefined,
      };
      const created = await createIncident(submission);
      router.push(`/investigations/${created.incident_id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to file the incident.");
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col">
      <TopBar />
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-8">
        <Link
          href="/investigations"
          className="focus-ring mb-4 inline-flex items-center gap-1.5 text-xs uppercase tracking-widest text-text-tertiary hover:text-text-primary"
        >
          <span aria-hidden>←</span> All investigations
        </Link>

        <h1 className="font-display text-2xl font-medium tracking-tight text-text-primary">
          File a pick exception
        </h1>
        <p className="mt-1 max-w-xl text-sm text-text-secondary">
          Creates a new order, pick task, and event history for this exception. Real operational
          data -- built from your inputs, not a template -- so the agent investigates it the same
          way it does any other case. This is synthetic test data, not a connection to a live
          warehouse system.
        </p>

        {error && (
          <div className="mt-6 rounded-lg border border-red/30 bg-red-dim/30 px-4 py-3 text-sm text-red">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-8 space-y-6">
          <Panel eyebrow="Item & order" title="What was ordered">
            <div className="grid grid-cols-1 gap-5 px-5 py-5 sm:grid-cols-2">
              <Field label="SKU" hint="e.g. XJ-482">
                <input
                  className={inputClass}
                  value={sku}
                  onChange={(e) => setSku(e.target.value)}
                  placeholder="XJ-482"
                  required
                />
              </Field>
              <Field label="Item description">
                <input
                  className={inputClass}
                  value={itemDescription}
                  onChange={(e) => setItemDescription(e.target.value)}
                  placeholder="Wireless Charging Pad"
                  required
                />
              </Field>
              <Field label="Quantity requested">
                <input
                  type="number"
                  min={1}
                  className={inputClass}
                  value={qtyRequested}
                  onChange={(e) => setQtyRequested(Math.max(1, Number(e.target.value)))}
                  required
                />
              </Field>
              <Field label="Order priority">
                <select
                  className={inputClass}
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as "standard" | "expedited")}
                >
                  <option value="standard">Standard</option>
                  <option value="expedited">Expedited</option>
                </select>
              </Field>
              <Field label="Customer reference" hint="Optional -- auto-generated if left blank">
                <input
                  className={inputClass}
                  value={customerRef}
                  onChange={(e) => setCustomerRef(e.target.value)}
                  placeholder="CUST-1029"
                />
              </Field>
            </div>
          </Panel>

          <Panel eyebrow="What happened" title="The pick attempt">
            <div className="grid grid-cols-1 gap-5 px-5 py-5 sm:grid-cols-2">
              <Field label="Assigned location" hint="e.g. A-17 -- zone is read from the letter before the dash">
                <input
                  className={inputClass}
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="A-17"
                  required
                />
              </Field>
              <Field label="Reason code">
                <select
                  className={inputClass}
                  value={reasonCode}
                  onChange={(e) => setReasonCode(e.target.value as "ITEM_NOT_FOUND" | "SHORT_PICK")}
                >
                  <option value="ITEM_NOT_FOUND">Item not found</option>
                  <option value="SHORT_PICK">Short pick (partial quantity)</option>
                </select>
              </Field>
              {reasonCode === "SHORT_PICK" && (
                <Field label="Quantity actually picked" hint="Must be less than quantity requested">
                  <input
                    type="number"
                    min={0}
                    max={Math.max(0, qtyRequested - 1)}
                    className={inputClass}
                    value={qtyPicked}
                    onChange={(e) => setQtyPicked(Number(e.target.value))}
                  />
                </Field>
              )}
              <Field label="Failed attempts so far" hint="2+ triggers repeated-failure procedure">
                <input
                  type="number"
                  min={1}
                  max={5}
                  className={inputClass}
                  value={attemptCount}
                  onChange={(e) => setAttemptCount(Math.min(5, Math.max(1, Number(e.target.value))))}
                />
              </Field>
            </div>
          </Panel>

          <Panel eyebrow="Optional" title="Current inventory record">
            <div className="space-y-4 px-5 py-5">
              <label className="flex items-center gap-2.5 text-sm text-text-primary">
                <input
                  type="checkbox"
                  className="focus-ring h-4 w-4 rounded border-border-medium bg-surface-2"
                  checked={hasInventory}
                  onChange={(e) => setHasInventory(e.target.checked)}
                />
                An inventory record exists for this SKU/location
              </label>
              <p className="text-xs text-text-tertiary">
                Leave unchecked to file this as a SKU the system has no inventory record for at
                all -- a legitimate, common shape (e.g. a newly activated location).
              </p>
              {hasInventory && (
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                  <Field label="Quantity on hand">
                    <input
                      type="number"
                      min={0}
                      className={inputClass}
                      value={inventoryQty}
                      onChange={(e) => setInventoryQty(Math.max(0, Number(e.target.value)))}
                    />
                  </Field>
                  <label className="flex items-center gap-2.5 self-end pb-2.5 text-sm text-text-primary">
                    <input
                      type="checkbox"
                      className="focus-ring h-4 w-4 rounded border-border-medium bg-surface-2"
                      checked={restricted}
                      onChange={(e) => setRestricted(e.target.checked)}
                    />
                    High-value / restricted SKU
                  </label>
                </div>
              )}
            </div>
          </Panel>

          <Panel eyebrow="Optional" title="Incident summary">
            <div className="px-5 py-5">
              <textarea
                className={inputClass}
                rows={3}
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                placeholder="Auto-generated from the fields above if left blank."
              />
            </div>
          </Panel>

          <div className="flex items-center gap-3">
            <Button type="submit" variant="primary" disabled={!canSubmit || submitting}>
              {submitting ? "Filing…" : "File exception"}
            </Button>
            <Link href="/investigations" className="focus-ring text-sm text-text-tertiary hover:text-text-primary">
              Cancel
            </Link>
          </div>
        </form>
      </main>
    </div>
  );
}
