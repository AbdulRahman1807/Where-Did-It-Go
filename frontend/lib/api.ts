import type { CaseSnapshot, ReviewDecision } from "./types";

export const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";

export async function listCases(): Promise<CaseSnapshot[]> {
  const res = await fetch(`${API_BASE}/api/incidents`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load incidents (${res.status})`);
  const body = await res.json();
  return body.cases as CaseSnapshot[];
}

export async function getCase(incidentId: string): Promise<CaseSnapshot | null> {
  const res = await fetch(`${API_BASE}/api/incidents/${incidentId}`, { cache: "no-store" });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Failed to load incident ${incidentId} (${res.status})`);
  return (await res.json()) as CaseSnapshot;
}

export async function startInvestigation(incidentId: string): Promise<Response> {
  return fetch(`${API_BASE}/api/incidents/${incidentId}/investigate`, { method: "POST" });
}

export interface ReviewSubmission {
  decision: ReviewDecision;
  feedback_text?: string;
  modified_recommendation?: string;
}

export async function submitReview(incidentId: string, submission: ReviewSubmission): Promise<Response> {
  return fetch(`${API_BASE}/api/incidents/${incidentId}/review`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(submission),
  });
}

export interface NewIncidentSubmission {
  sku: string;
  item_description: string;
  location: string;
  qty_requested: number;
  priority: "standard" | "expedited";
  customer_ref?: string;
  reason_code: "ITEM_NOT_FOUND" | "SHORT_PICK";
  qty_picked?: number;
  attempt_count: number;
  restricted: boolean;
  inventory_qty?: number;
  summary?: string;
}

export async function createIncident(submission: NewIncidentSubmission): Promise<CaseSnapshot> {
  const res = await fetch(`${API_BASE}/api/incidents`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(submission),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.detail ?? `Failed to file incident (${res.status})`);
  }
  return (await res.json()) as CaseSnapshot;
}
