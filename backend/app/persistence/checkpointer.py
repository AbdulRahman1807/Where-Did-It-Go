"""SQLite-backed checkpointer.

This is what makes human review a genuine pause: the graph's state after
every node is written to disk, keyed by thread_id (== incident_id). A
review request can arrive in a later HTTP call, after the process has
handled other requests in between, and `Command(resume=...)` will pick the
investigation back up exactly where it paused.
"""

from __future__ import annotations

from contextlib import asynccontextmanager

from langgraph.checkpoint.sqlite.aio import AsyncSqliteSaver

from app.config import SQLITE_CHECKPOINT_PATH


@asynccontextmanager
async def checkpointer_context():
    SQLITE_CHECKPOINT_PATH.parent.mkdir(parents=True, exist_ok=True)
    async with AsyncSqliteSaver.from_conn_string(str(SQLITE_CHECKPOINT_PATH)) as saver:
        yield saver
