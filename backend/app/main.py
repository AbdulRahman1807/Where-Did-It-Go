from __future__ import annotations

import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import router
from app.graph import build_graph
from app.persistence.checkpointer import checkpointer_context
from app.rag.index import get_index

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("where_did_it_go")


def _warm_up_procedure_index() -> None:
    get_index().warm_up()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Load the procedure index and its embedding model before serving. On the
    # very first run this downloads the model, which takes about a minute --
    # better spent at startup than inside a live investigation. A failure
    # (e.g. offline on first run) is logged rather than fatal: the app still
    # serves, and the first procedure search will surface the error.
    try:
        await asyncio.to_thread(_warm_up_procedure_index)
        logger.info("Procedure index ready.")
    except Exception:
        logger.exception("Procedure index warm-up failed; procedure search may be unavailable.")

    async with checkpointer_context() as checkpointer:
        app.state.graph = build_graph(checkpointer)
        yield


app = FastAPI(title="Where Did It Go? — Investigation API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)


@app.get("/api/health")
async def health():
    return {"status": "ok"}
