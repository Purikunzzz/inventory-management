from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional
from enum import Enum


class BorrowStatusEnum(str, Enum):
    borrowed = "borrowed"
    returned = "returned"


class BorrowRequest(BaseModel):
    item_id: int
    quantity: int = Field(default=1, ge=1)
    due_date: Optional[datetime] = None
    note: Optional[str] = Field(default=None, max_length=500)


class ReturnRequest(BaseModel):
    borrow_id: int
    note: Optional[str] = Field(default=None, max_length=500)


class BorrowOut(BaseModel):
    id: int
    user_id: int
    item_id: int
    quantity: int
    status: BorrowStatusEnum
    borrowed_at: datetime
    due_date: Optional[datetime] = None
    returned_at: Optional[datetime] = None
    note: Optional[str] = None

    model_config = {"from_attributes": True}
