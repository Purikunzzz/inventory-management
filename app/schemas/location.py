from pydantic import BaseModel, Field
from typing import Optional

from app.schemas.types import UtcDateTime


class LocationCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    description: Optional[str] = Field(default=None, max_length=500)


class LocationUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=255)
    description: Optional[str] = Field(default=None, max_length=500)


class LocationOut(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    is_active: bool
    created_at: UtcDateTime
    updated_at: UtcDateTime

    model_config = {"from_attributes": True}
