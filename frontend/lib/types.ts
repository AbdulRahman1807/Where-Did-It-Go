// Mirrors backend/app/state.py and backend/app/api/service.py.
// Kept as one small, explicit file rather than generated, since the shape is
// small and stable -- easy for the team to see backend <-> frontend line up.

export type CaseStatus =
  | "open"
  | "investigating"
  | "awaiting_review"
  | "investigating_again"
  | "approved"
  | "rejected"
  | "escalated"
  | "resolved";

export type RiskLevel = "low" | "medium" | "high";
export type EvidenceSourceType = "operational" | "procedural";
export type EvidenceStance = "supports" | "conflicts" | "neutral";
export type ReviewDecision = "approve" | "reject" | "investigate_more" | "modify" | "escalate";
export type EvalCategory = "normal" | "edge" | "failure" | "high_risk" | "evidence";

export interface EvidenceItem {
  id: string;
  source_type: EvidenceSourceType;
  source_name: string;
  summary: string;
  detail: string;
  stance: EvidenceStance;
  round: number;
}

export interface Hypothesis {
  statement: string;
  supported: boolean;
  supporting_evidence_ids: string[];
  round: number;
}

export interface Finding {
  likely_cause: string;
  explanation: string;
  evidence_ids: string[];
}

export interface Recommendation {
  action: string;
  rationale: string;
  evidence_ids: string[];
}

export interface HumanFeedbackEntry {
  round: number;
  decision: ReviewDecision;
  feedback_text: string;
  timestamp: string;
}

export interface ReviewRequirement {
  required: boolean;
  reasons: string[];
}

export interface Outcome {
  outcome_type: "resolved" | "escalated" | string;
  status: string;
  finding: Finding | { likely_cause: string } | null;
  recommendation: Recommendation | { action: string } | null;
  risk_level: RiskLevel;
  reasons?: string[];
  rounds?: number;
  decided_at: string;
  human_feedback_history?: HumanFeedbackEntry[];
}

export interface CaseSnapshot {
  incident_id: string;
  task_id: string;
  order_id: string;
  title: string;
  summary: string;
  category: EvalCategory | null;
  is_seed_history: boolean;
  started: boolean;
  status: CaseStatus;
  round: number | null;
  max_rounds: number | null;
  risk_level: RiskLevel | null;
  review: ReviewRequirement;
  finding: Finding | null;
  recommendation: Recommendation | null;
  evidence: EvidenceItem[];
  hypotheses: Hypothesis[];
  unresolved_questions: string[];
  activity_log: string[];
  human_feedback_history: HumanFeedbackEntry[];
  outcome: Outcome | null;
}

export interface StreamActivityEvent {
  type: "activity";
  node: string;
  text: string;
}

export interface StreamNodeUpdateEvent {
  type: "node_update";
  node: string;
  update: Partial<CaseSnapshot>;
}

export interface StreamReviewRequiredEvent {
  type: "review_required";
  payload: {
    incident_id: string;
    round: number;
    finding: Finding;
    recommendation: Recommendation;
    evidence: EvidenceItem[];
    risk_level: RiskLevel;
    review_reasons: string[];
    unresolved_questions: string[];
  };
}

export interface StreamErrorEvent {
  type: "error";
  message: string;
}

export interface StreamDoneEvent {
  type: "done";
  case: CaseSnapshot;
}

export interface StreamAlreadyStartedEvent {
  type: "already_started";
  case: CaseSnapshot;
}

export type StreamEvent =
  | StreamActivityEvent
  | StreamNodeUpdateEvent
  | StreamReviewRequiredEvent
  | StreamErrorEvent
  | StreamDoneEvent
  | StreamAlreadyStartedEvent;
