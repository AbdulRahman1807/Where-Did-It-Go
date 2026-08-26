"""Provider/model routing.

See app/config.py for the reasoning behind which job gets which model. Both
models currently come from Groq, but the two jobs are requested through
separate functions precisely so the routing decision lives in one place and
could point at a different provider per job without touching calling code.
"""

from __future__ import annotations

import logging
import random
import time
from typing import Any

from langchain_groq import ChatGroq

from app.config import CAPABLE_MODEL, FAST_MODEL, GROQ_API_KEY

logger = logging.getLogger("where_did_it_go")


def get_fast_model(temperature: float = 0.0) -> ChatGroq:
    """Small/fast model: intake parsing, risk & sufficiency classification."""
    return ChatGroq(model=FAST_MODEL, api_key=GROQ_API_KEY, temperature=temperature)


def get_capable_model(temperature: float = 0.2) -> ChatGroq:
    """Larger model: the investigation tool-calling loop and recommendation
    synthesis, where multi-step reasoning over several evidence sources
    matters more than latency."""
    return ChatGroq(model=CAPABLE_MODEL, api_key=GROQ_API_KEY, temperature=temperature)


def invoke_with_retry(runnable: Any, input: Any, max_attempts: int = 5, base_delay: float = 2.0) -> Any:
    """Invoke a (possibly tool-bound / structured-output-wrapped) chat model
    with exponential backoff on transient failures.

    Applied at the call site rather than wrapped onto the model object itself
    (e.g. via LangChain's `.with_retry()`) because `.bind_tools()` and
    `.with_structured_output()` are chat-model-specific methods that a retry
    wrapper's generic Runnable interface doesn't expose -- wrapping first
    would make those unavailable afterwards.

    Groq's free tier has real per-minute token limits; a rate-limit response
    names how long to wait (observed: ~10s), so this backs off far enough to
    reliably clear that within a handful of attempts rather than surfacing a
    transient limit as a hard failure.
    """
    last_exc: Exception | None = None
    for attempt in range(max_attempts):
        try:
            return runnable.invoke(input)
        except Exception as exc:  # noqa: BLE001 -- deliberately broad: retry, then re-raise as-is
            last_exc = exc
            if attempt == max_attempts - 1:
                raise
            delay = min(30.0, base_delay * (2**attempt)) + random.uniform(0, 1)
            logger.warning(
                "Model call failed (attempt %d/%d): %s -- retrying in %.1fs",
                attempt + 1,
                max_attempts,
                exc,
                delay,
            )
            time.sleep(delay)
    raise last_exc  # pragma: no cover -- unreachable, satisfies type checkers
