"""Investigation state: the graph's memory.

This is the answer to "what has happened during this investigation?" -- as
distinct from RAG (app/rag/index.py), which answers "what does the
operational knowledge base say?". The two are never conflated: RAG results
are written into `evidence` as `source_type="procedural"` items, exactly like
any other evidence, and nothing here is embedded or semantically searched.

Fields without a reducer are overwritten by whatever a node returns for that
key (the default LangGraph behavior). Fields with `operator.add` accumulate
across the whole investigation, including across human-review rounds, so nodes
append by returning a single-item list rather than replacing the field.
"""

from __future__ import annotations

import operator
from typing import Annotated, Any, Literal, TypedDict

from langchain_core.messages import BaseMessage
from langgraph.graph.message import add_messages

EvidenceSourceType = Literal["operational", "procedural"]
EvidenceStance = Literal["supports", "conflicts", "neutral"]
RiskLevel = Literal["low", "medium", "high"]
CaseStatus = Literal[
    "investigating",
    "awaiting_review",
    "investigating_again",
    "approved",
    "rejected",
    "escalated",
    "resolved",
]
ReviewDecision = Literal["approve", "reject", "investigate_more", "modify", "escalate"]


class EvidenceItem(TypedDict):
    id: str
    source_type: EvidenceSourceType
    source_name: str  # e.g. "Pick Task PX-1042", "SOP-03"
    summary: str  # human-readable, one or two sentences
    detail: dict[str, Any] | str  # raw retrieved data, for the evidence drawer
    stance: EvidenceStance
    round: int


class Hypothesis(TypedDict):
    statement: str
    supported: bool
    supporting_evidence_ids: list[str]
    round: int


class Finding(TypedDict):
    likely_cause: str
    explanation: str
    evidence_ids: list[str]


class Recommendation(TypedDict):
    action: str
    rationale: str
    evidence_ids: list[str]


class HumanFeedbackEntry(TypedDict):
    round: int
    decision: ReviewDecision
    feedback_text: str
    timestamp: str


class ReviewRequirement(TypedDict):
    required: bool
    reasons: list[str]


class InvestigationState(TypedDict):
    # --- Original incident (immutable memory of what was reported) ---
    incident_id: str
    task_id: str
    order_id: str
    incident_summary: str

    # --- Agent scratchpad for the current tool-calling loop (LangChain messages) ---
    messages: Annotated[list[BaseMessage], add_messages]

    # --- Accumulated investigation memory ---
    # activity_log is a pure append-only history log. evidence/hypotheses are
    # NOT accumulated with a reducer: each synthesize step re-reads the full
    # transcript (messages accumulates across rounds) and returns the
    # complete, current case file, like a real investigator's case notes
    # rather than a growing list of possibly-stale fragments.
    activity_log: Annotated[list[str], operator.add]
    evidence: list[EvidenceItem]
    hypotheses: list[Hypothesis]
    unresolved_questions: list[str]
    investigation_focus: str | None  # human-directed focus for the next round, if any

    # --- Current conclusion ---
    finding: Finding | None
    recommendation: Recommendation | None
    risk_level: RiskLevel
    review: ReviewRequirement

    # --- Control flow / safeguards ---
    round: int
    max_rounds: int
    tool_calls_this_round: int

    # --- Review loop ---
    status: CaseStatus
    human_feedback_history: Annotated[list[HumanFeedbackEntry], operator.add]

    # --- Terminal outcome ---
    outcome: dict[str, Any] | None
