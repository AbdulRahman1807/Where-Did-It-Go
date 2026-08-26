"""Retrieval evaluation runner.

Usage (from backend/, with the venv active -- no GROQ_API_KEY needed, this
only exercises the local Chroma index):
    python -m eval.run_retrieval_eval

Runs every case in eval/retrieval_cases.py through the real search_procedures
index (k=3, matching the tool's own default) and checks whether the expected
SOP document appears among the top-k results. Writes
eval/last_retrieval_run_report.md.
"""

from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path

from app.rag.index import get_index
from eval.retrieval_cases import CASES, RetrievalCase

REPORT_PATH = Path(__file__).parent / "last_retrieval_run_report.md"
TOP_K = 3


def run_case(case: RetrievalCase) -> dict:
    hits = get_index().search(case.query, k=TOP_K)
    sources = [h["source_name"] for h in hits]
    sections = [(h["source_name"], h["section_title"]) for h in hits]

    hit_source = case.expected_source in sources
    hit_section = (case.expected_source, case.expected_section) in sections
    top_hit_source = sources[0] == case.expected_source if sources else False

    return {
        "case": case,
        "hits": hits,
        "hit_source_at_3": hit_source,
        "hit_section_at_3": hit_section,
        "hit_source_at_1": top_hit_source,
    }


def format_report(results: list[dict]) -> str:
    lines = ["# Retrieval Evaluation Report", "", f"Run at {datetime.now(timezone.utc).isoformat()}", ""]
    lines.append(f"Top-{TOP_K} retrieval against the live SOP corpus. `hit@3 (doc)` is the pass/fail bar: "
                  "did the expected procedure document appear anywhere in the top-3 results.")
    lines.append("")
    lines.append("| Query | Expected | hit@1 (doc) | hit@3 (doc) | hit@3 (exact section) |")
    lines.append("|---|---|---|---|---|")

    total_source_hits = 0
    for r in results:
        case: RetrievalCase = r["case"]
        total_source_hits += int(r["hit_source_at_3"])
        lines.append(
            f"| {case.query} | {case.expected_source} / {case.expected_section} "
            f"| {'ok' if r['hit_source_at_1'] else 'FAIL'} "
            f"| {'ok' if r['hit_source_at_3'] else 'FAIL'} "
            f"| {'ok' if r['hit_section_at_3'] else '-'} |"
        )

    lines.append("")
    lines.append(f"**{total_source_hits}/{len(results)} cases hit the expected document within top-{TOP_K}.**")
    lines.append("")
    lines.append("## Detail")
    lines.append("")
    for r in results:
        case: RetrievalCase = r["case"]
        status = "PASS" if r["hit_source_at_3"] else "FAIL"
        lines.append(f"### {status} — {case.query}")
        lines.append("")
        lines.append(f"Expected: `{case.expected_source} / {case.expected_section}`")
        if case.notes:
            lines.append(f"Notes: {case.notes}")
        lines.append("")
        lines.append("Retrieved:")
        for h in r["hits"]:
            lines.append(f"- `{h['source_name']} / {h['section_title']}` (relevance={h['relevance']})")
        lines.append("")
    return "\n".join(lines)


def main() -> None:
    results = []
    for case in CASES:
        result = run_case(case)
        results.append(result)
        status = "PASS" if result["hit_source_at_3"] else "FAIL"
        print(f"{status}  {case.query}  -> expected {case.expected_source}, got "
              f"{[h['source_name'] for h in result['hits']]}")

    report = format_report(results)
    REPORT_PATH.write_text(report, encoding="utf-8")
    passed = sum(1 for r in results if r["hit_source_at_3"])
    print(f"\n{passed}/{len(results)} cases hit the expected document within top-{TOP_K}.")
    print(f"Report written to {REPORT_PATH}")


if __name__ == "__main__":
    main()
