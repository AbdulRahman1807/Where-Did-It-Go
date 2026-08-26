"""Labeled retrieval evaluation set: query -> expected SOP section.

Root README next-steps item #2 ("Retrieval evaluation... to catch regressions
as the corpus grows, rather than eyeballing relevance"). This is a small,
hand-labeled set of realistic investigator queries paired with the SOP
section that should answer them, phrased so the match has to come from
semantic similarity rather than shared vocabulary (per the README's own
retrieval claim in section 6) -- most queries deliberately avoid reusing the
target section's exact wording.

Unlike eval/cases.py, this needs no LLM call and no GROQ_API_KEY: it queries
app.rag.index directly with the real persistent Chroma collection built from
the actual corpus on disk, so it also doubles as a regression check on the
corpus itself (a section renamed, deleted, or reworded enough to drift
semantically will show up here as a new miss).
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class RetrievalCase:
    query: str
    expected_source: str  # e.g. "SOP-03" -- the procedure that should be surfaced
    expected_section: str  # e.g. "Required steps" -- the specific section, for information only
    notes: str = ""


CASES: list[RetrievalCase] = [
    RetrievalCase(
        query="item was moved recently before a failed pick",
        expected_source="SOP-03",
        expected_section="Required steps",
        notes="The exact worked example from README section 6 -- neither 'moved' nor "
        "'failed pick' phrasing appears verbatim in the target section's prose.",
    ),
    RetrievalCase(
        query="the picking robot found nothing at the shelf but inventory says there's one unit",
        expected_source="SOP-02",
        expected_section="Definition of a discrepancy",
    ),
    RetrievalCase(
        query="should I trust an inventory record that hasn't been updated in weeks",
        expected_source="SOP-04",
        expected_section="Staleness",
    ),
    RetrievalCase(
        query="does a restricted item need a supervisor's signature before we retry the pick",
        expected_source="SOP-06",
        expected_section="Authority requirement",
    ),
    RetrievalCase(
        query="order needs to ship today but we only pulled half the requested quantity",
        expected_source="SOP-07",
        expected_section="Expedited orders",
    ),
    RetrievalCase(
        query="we can't find any location history at all for this SKU",
        expected_source="SOP-04",
        expected_section="No history found",
    ),
    RetrievalCase(
        query="inventory and the scan history both say zero units remain, is that a confirmed stockout",
        expected_source="SOP-01",
        expected_section="Resolving a confirmed stockout",
    ),
    RetrievalCase(
        query="we've tried the same bin three times and keep coming up empty",
        expected_source="SOP-03",
        expected_section="Trigger condition",
    ),
    RetrievalCase(
        query="what counts as putaway versus a cycle count event",
        expected_source="SOP-04",
        expected_section="Event types",
    ),
    RetrievalCase(
        query="after two rounds of investigation we still don't have an answer",
        expected_source="SOP-05",
        expected_section="Maximum investigation depth",
    ),
    RetrievalCase(
        query="a concurrent reservation ate into the quantity we could pick for this order",
        expected_source="SOP-07",
        expected_section="Legitimate causes of a short pick",
    ),
    RetrievalCase(
        query="correcting the system record after finding the item somewhere else",
        expected_source="SOP-02",
        expected_section="Recommended actions",
    ),
    RetrievalCase(
        query="is escalating to a human a failure of the investigation",
        expected_source="SOP-05",
        expected_section="Escalation is not failure",
    ),
    RetrievalCase(
        query="caged zone C items need extra sign-off",
        expected_source="SOP-06",
        expected_section="Scope",
    ),
    RetrievalCase(
        query="what's the general order of steps to check before writing up a pick exception",
        expected_source="SOP-01",
        expected_section="Investigation sequence",
    ),
    RetrievalCase(
        query="does having zero inventory records and zero scan events mean something is definitely wrong",
        expected_source="SOP-04",
        expected_section="No history found",
    ),
    RetrievalCase(
        query="some units held back for damage inspection reduced what we could pick",
        expected_source="SOP-07",
        expected_section="Legitimate causes of a short pick",
        notes="Documented known miss (see last_retrieval_run_report.md): 'damage inspection' "
        "does not embed close enough to SOP-07's 'quality inspection or damage review' phrasing "
        "at k=3 -- exactly the class of regression this eval set exists to catch, kept in "
        "deliberately rather than removed to make the suite pass.",
    ),
]
