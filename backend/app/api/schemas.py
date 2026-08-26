from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

from app.state import ReviewDecision


class ReviewDecisionRequest(BaseModel):
    decision: ReviewDecision
    feedback_text: str = ""
    modified_recommendation: str | None = None


class NewIncidentRequest(BaseModel):
    sku: str = Field(min_length=1, max_length=32)
    item_description: str = Field(min_length=1, max_length=200)
    location: str = Field(min_length=1, max_length=32, description="e.g. 'B-12'")
    qty_requested: int = Field(gt=0, le=10_000)
    priority: Literal["standard", "expedited"] = "standard"
    customer_ref: str | None = Field(default=None, max_length=64)
    reason_code: Literal["ITEM_NOT_FOUND", "SHORT_PICK"] = "ITEM_NOT_FOUND"
    qty_picked: int | None = Field(default=None, ge=0, description="Required when reason_code is SHORT_PICK")
    attempt_count: int = Field(default=1, ge=1, le=5)
    restricted: bool = False
    inventory_qty: int | None = Field(
        default=None,
        ge=0,
        description="Leave unset to file this as a SKU with no existing inventory record at all.",
    )
    summary: str | None = Field(default=None, max_length=500)
