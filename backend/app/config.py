"""Environment configuration and model routing settings.

Model routing: two Groq-hosted models are used for different jobs in the
investigation graph, based on the reasoning depth each job actually needs.

  FAST_MODEL      - intake parsing and risk/sufficiency classification.
                     These are short, structured, low-ambiguity tasks where a
                     small model is fast, cheap, and accurate enough.
  CAPABLE_MODEL    - the investigation tool-calling loop and the final
                     recommendation synthesis. These require multi-step
                     reasoning over several evidence sources, so they get the
                     larger model.

This is a deliberate latency/cost vs. reasoning-depth trade-off, not a
decorative use of two models.
"""

from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv

BACKEND_ROOT = Path(__file__).resolve().parent.parent
load_dotenv(BACKEND_ROOT / ".env")

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")

FAST_MODEL = os.getenv("FAST_MODEL", "openai/gpt-oss-20b")
CAPABLE_MODEL = os.getenv("CAPABLE_MODEL", "openai/gpt-oss-120b")

# Safety bounds on the investigation loop (Master Spec section 8: "There
# should be a sensible maximum investigation depth or equivalent safeguard.")
MAX_INVESTIGATION_ROUNDS = int(os.getenv("MAX_INVESTIGATION_ROUNDS", "3"))
MAX_TOOL_CALLS_PER_ROUND = int(os.getenv("MAX_TOOL_CALLS_PER_ROUND", "5"))

DATA_DIR = BACKEND_ROOT / "app" / "data"
FIXTURES_DIR = DATA_DIR / "fixtures"
RAG_CORPUS_DIR = BACKEND_ROOT / "app" / "rag" / "corpus"
CHROMA_PERSIST_DIR = BACKEND_ROOT / "app" / "rag" / ".chroma"
SQLITE_CHECKPOINT_PATH = BACKEND_ROOT / "app" / "persistence" / "checkpoints.sqlite"
