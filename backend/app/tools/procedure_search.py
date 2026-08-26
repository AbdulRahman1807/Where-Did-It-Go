"""The RAG tool: semantic search over the SOP corpus.

This is the one tool backed by vector retrieval (app/rag/index.py) rather than
the synthetic operational fixtures. It's exposed to the model exactly like
any other tool, so the model decides when procedural guidance is relevant
rather than every investigation being force-fed the same documents.
"""

from __future__ import annotations

from langchain_core.tools import tool

from app.rag.index import get_index


@tool
def search_procedures(query: str) -> dict:
    """Search the operational procedures / SOP knowledge base for guidance
    relevant to the current investigation, e.g. how to handle repeated
    failures, inventory discrepancies, short picks, or restricted items.
    Returns the most semantically relevant procedure sections. Use this
    whenever you need to know what the applicable procedure says, not just
    what the raw operational records show."""
    hits = get_index().search(query, k=3)
    if not hits:
        return {"found": False, "message": "No relevant procedure found for that query."}
    return {"found": True, "results": hits}


PROCEDURE_TOOLS = [search_procedures]
