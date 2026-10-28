"""Vector-based retrieval over the SOP corpus.

This is the RAG layer: procedural knowledge, distinct from the operational
tools in app/tools/ and distinct from investigation state in app/state.py.

Approach, kept deliberately simple and inspectable:
  1. Each markdown SOP is split into sections on its "## " headings.
  2. Each section is embedded with Chroma's built-in local embedding model
     (a small ONNX sentence-transformer, all-MiniLM-L6-v2 -- no external API
     key or network call needed at query time).
  3. Sections are stored in a persistent Chroma collection on disk.
  4. `search_procedures` runs a semantic similarity query and returns the
     top-k sections with their source document, so the agent (and the UI)
     can cite exactly which procedure a piece of guidance came from.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

import chromadb
from chromadb.utils.embedding_functions import DefaultEmbeddingFunction

from app.config import CHROMA_PERSIST_DIR, RAG_CORPUS_DIR

COLLECTION_NAME = "sop_procedures"


@dataclass(frozen=True)
class ProcedureChunk:
    chunk_id: str
    source_name: str  # e.g. "SOP-03"
    doc_title: str  # e.g. "SOP-03: Repeated Pick Failure and Location Verification Procedure"
    section_title: str  # e.g. "Trigger condition"
    text: str


def _chunk_markdown_file(path) -> list[ProcedureChunk]:
    raw = path.read_text(encoding="utf-8")
    source_name = path.stem.split("-", 2)[0] + "-" + path.stem.split("-", 2)[1]  # e.g. "SOP-03"

    lines = raw.splitlines()
    doc_title = lines[0].lstrip("# ").strip() if lines and lines[0].startswith("#") else path.stem

    sections: list[tuple[str, list[str]]] = []
    current_title = "Overview"
    current_body: list[str] = []
    for line in lines[1:]:
        header_match = re.match(r"^##\s+(.*)", line)
        if header_match:
            if current_body:
                sections.append((current_title, current_body))
            current_title = header_match.group(1).strip()
            current_body = []
        else:
            current_body.append(line)
    if current_body:
        sections.append((current_title, current_body))

    chunks = []
    for i, (title, body) in enumerate(sections):
        text = "\n".join(body).strip()
        if not text:
            continue
        chunks.append(
            ProcedureChunk(
                chunk_id=f"{path.stem}#{i}",
                source_name=source_name,
                doc_title=doc_title,
                section_title=title,
                text=f"{doc_title} — {title}\n\n{text}",
            )
        )
    return chunks


def _load_all_chunks() -> list[ProcedureChunk]:
    chunks: list[ProcedureChunk] = []
    for path in sorted(RAG_CORPUS_DIR.glob("*.md")):
        chunks.extend(_chunk_markdown_file(path))
    return chunks


class ProcedureIndex:
    def __init__(self) -> None:
        CHROMA_PERSIST_DIR.mkdir(parents=True, exist_ok=True)
        self._client = chromadb.PersistentClient(path=str(CHROMA_PERSIST_DIR))
        self._embedding_fn = DefaultEmbeddingFunction()
        self._collection = self._client.get_or_create_collection(
            name=COLLECTION_NAME,
            embedding_function=self._embedding_fn,
        )
        self._ensure_indexed()

    def _ensure_indexed(self) -> None:
        chunks = _load_all_chunks()
        existing_ids = set(self._collection.get(include=[])["ids"])
        expected_ids = {c.chunk_id for c in chunks}

        # Rebuild if the corpus changed shape (added/removed sections) so the
        # index never silently drifts from the .md files on disk.
        if existing_ids == expected_ids and existing_ids:
            return

        if existing_ids:
            self._collection.delete(ids=list(existing_ids))
        if chunks:
            self._collection.add(
                ids=[c.chunk_id for c in chunks],
                documents=[c.text for c in chunks],
                metadatas=[
                    {
                        "source_name": c.source_name,
                        "doc_title": c.doc_title,
                        "section_title": c.section_title,
                    }
                    for c in chunks
                ],
            )

    def warm_up(self) -> None:
        """Runs one throwaway query so the embedding model is downloaded (first
        run only, ~80 MB) and loaded now, rather than inside whichever
        investigation happens to search procedures first."""
        self._collection.query(query_texts=["warm-up"], n_results=1)

    def search(self, query: str, k: int = 3) -> list[dict]:
        result = self._collection.query(query_texts=[query], n_results=k)
        hits = []
        ids = result["ids"][0]
        docs = result["documents"][0]
        metas = result["metadatas"][0]
        distances = result["distances"][0]
        for chunk_id, text, meta, distance in zip(ids, docs, metas, distances):
            hits.append(
                {
                    "chunk_id": chunk_id,
                    "source_name": meta["source_name"],
                    "doc_title": meta["doc_title"],
                    "section_title": meta["section_title"],
                    "text": text,
                    "relevance": round(max(0.0, 1.0 - distance), 4),
                }
            )
        return hits


_INDEX: ProcedureIndex | None = None


def get_index() -> ProcedureIndex:
    global _INDEX
    if _INDEX is None:
        _INDEX = ProcedureIndex()
    return _INDEX
