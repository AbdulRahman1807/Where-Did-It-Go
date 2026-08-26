from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import router
from app.graph import build_graph
from app.persistence.checkpointer import checkpointer_context

logging.basicConfig(level=logging.INFO)


@asynccontextmanager
async def lifespan(app: FastAPI):
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
