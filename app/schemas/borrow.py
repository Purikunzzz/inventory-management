from pydantic import BaseModel, Field
from typing import Optional
from enum import Enum

from app.schemas.types import UtcDateTime, UtcDateTimeIn


class BorrowStatusEnum(str, Enum):
    pending = "pending"
    borrowed = "borrowed"
    returned = "returned"
    rejected = "rejected"


class BorrowRequest(BaseModel):
    item_id: int
    quantity: int = Field(default=1, ge=1)
    due_date: Optional[UtcDateTimeIn] = None
    note: Optional[str] = Field(default=None, max_length=500)


class ReturnRequest(BaseModel):
    borrow_id: int
    note: Optional[str] = Field(default=None, max_length=500)


class ReviewRequest(BaseModel):
    note: Optional[str] = Field(default=None, max_length=500)


class BorrowOut(BaseModel):
    id: int
    user_id: int
    item_id: int
    quantity: int
    status: BorrowStatusEnum
    borrowed_at: UtcDateTime
    due_date: Optional[UtcDateTime] = None
    returned_at: Optional[UtcDateTime] = None
    note: Optional[str] = None
    reviewed_by: Optional[int] = None
    reviewed_at: Optional[UtcDateTime] = None
    review_note: Optional[str] = None

    model_config = {"from_attributes": True}
