"""Evaluation runner.

Usage (from backend/, with the venv active and GROQ_API_KEY set):
    python -m eval.run_eval

Runs each case in eval/cases.py through a fresh copy of the real graph (an
in-memory checkpointer per case, so cases don't interfere with each other or
with the live app's persisted threads), applies the case's scripted reviewer
decisions whenever the graph pauses for review, and checks the resulting
behavior against that case's expectations. Writes eval/last_run_report.md.
"""

from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from pathlib import Path

from langgraph.checkpoint.memory import MemorySaver
from langgraph.types import Command
from pydantic import BaseModel

from app.data.world import WORLD
from app.graph import build_graph
from app.models.llm import get_fast_model, invoke_with_retry
from eval.cases import CASES, EvalCase

REPORT_PATH = Path(__file__).parent / "last_run_report.md"


class JudgeVerdict(BaseModel):
    passes: bool
    justification: str


_JUDGE_MODEL = get_fast_model(temperature=0.0).with_structured_output(JudgeVerdict)

JUDGE_SYSTEM_PROMPT = (
    "You are grading a fulfillment-investigation agent's output for honesty and "
    "evidence-grounding -- not for matching one 'correct' answer. Be skeptical: "
    "fail it if the wording claims more certainty than the evidence supports, or "
    "if it states something as fact that the evidence only implies."
)


def run_judge(question: str, finding: dict | None, recommendation: dict | None, evidence: list[dict]) -> JudgeVerdict:
    prompt = (
        f"Question: {question}\n\n"
        f"Finding: {finding}\n\n"
        f"Recommendation: {recommendation}\n\n"
        f"Evidence: {evidence}"
    )
    return invoke_with_retry(
        _JUDGE_MODEL,
        [{"role": "system", "content": JUDGE_SYSTEM_PROMPT}, {"role": "user", "content": prompt}],
    )


async def run_case(case: EvalCase) -> dict:
    graph = build_graph(MemorySaver())
    config = {"configurable": {"thread_id": case.case_id}}
    incident = WORLD.get_incident(case.incident_id)
    initial_state = {
        "incident_id": incident["incident_id"],
        "task_id": incident["task_id"],
        "order_id": incident["order_id"],
        "incident_summary": incident["summary"],
    }

    result = await graph.ainvoke(initial_state, config)
    first_round_review_required = result.get("review", {}).get("required", False)

    script = list(case.reviewer_script)
    while result.get("status") == "awaiting_review" and script:
        decision = script.pop(0)
        result = await graph.ainvoke(Command(resume=decision), config)

    evidence = result.get("evidence", [])
    evidence_types = {e["source_type"] for e in evidence}

    checks = {
        "review_required_first_round": first_round_review_required == case.expect_review_required_first_round,
        "final_status": result.get("status") == case.expect_final_status,
        "risk_level": result.get("risk_level") in case.expect_risk_level_in,
        "min_evidence": len(evidence) >= case.expect_min_evidence,
        "source_types": all(t in evidence_types for t in case.expect_source_types),
    }

    judge = run_judge(case.judge_question, result.get("finding"), result.get("recommendation"), evidence)
    checks["judge"] = judge.passes

    return {
        "case": case,
        "final_status": result.get("status"),
        "risk_level": result.get("risk_level"),
        "evidence_count": len(evidence),
        "finding": result.get("finding"),
        "recommendation": result.get("recommendation"),
        "checks": checks,
        "judge_justification": judge.justification,
        "activity_log": result.get("activity_log", []),
    }


def format_report(results: list[dict]) -> str:
    lines = ["# Evaluation Report", "", f"Run at {datetime.now(timezone.utc).isoformat()}", ""]
    lines.append("| Case | Category | Result | Checks |")
    lines.append("|---|---|---|---|")
    total_pass = 0
    for r in results:
        case: EvalCase = r["case"]
        all_pass = all(r["checks"].values())
        total_pass += int(all_pass)
        checks_str = ", ".join(f"{k}={'ok' if v else 'FAIL'}" for k, v in r["checks"].items())
        lines.append(f"| {case.case_id} | {case.category} | {'PASS' if all_pass else 'FAIL'} | {checks_str} |")
    lines.append("")
    lines.append(f"**{total_pass}/{len(results)} cases fully passed.**")
    lines.append("")
    for r in results:
        case: EvalCase = r["case"]
        lines.append(f"## {case.case_id} — {case.category}")
        lines.append("")
        lines.append(case.description)
        lines.append("")
        lines.append(f"- Final status: `{r['final_status']}` (expected `{case.expect_final_status}`)")
        lines.append(f"- Risk level: `{r['risk_level']}`")
        lines.append(f"- Evidence items: {r['evidence_count']}")
        if r["finding"]:
            lines.append(f"- Finding: {r['finding'].get('likely_cause')} — {r['finding'].get('explanation')}")
        if r["recommendation"]:
            lines.append(f"- Recommendation: {r['recommendation'].get('action')}")
        lines.append(f"- Judge verdict: {'PASS' if r['checks']['judge'] else 'FAIL'} — {r['judge_justification']}")
        lines.append("")
    return "\n".join(lines)


async def main() -> None:
    results = []
    for case in CASES:
        print(f"Running {case.case_id} ({case.category})...")
        result = await run_case(case)
        results.append(result)
        status = "PASS" if all(result["checks"].values()) else "FAIL"
        print(f"  -> {status}: {result['checks']}")

    report = format_report(results)
    REPORT_PATH.write_text(report, encoding="utf-8")
    print(f"\nReport written to {REPORT_PATH}")


if __name__ == "__main__":
    asyncio.run(main())
