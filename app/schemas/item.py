from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional


class ItemBase(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    description: Optional[str] = Field(default=None, max_length=1000)
    category: Optional[str] = Field(default=None, max_length=100)
    total_quantity: int = Field(ge=0)
    low_stock_threshold: int = Field(default=1, ge=0)
    location_id: Optional[int] = None
    image_url: Optional[str] = Field(default=None, max_length=500)


class ItemCreate(ItemBase):
    """On create, available_quantity is initialised equal to total_quantity."""
    pass


class ItemUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=255)
    description: Optional[str] = Field(default=None, max_length=1000)
    category: Optional[str] = Field(default=None, max_length=100)
    total_quantity: Optional[int] = Field(default=None, ge=0)
    low_stock_threshold: Optional[int] = Field(default=None, ge=0)
    location_id: Optional[int] = None
    image_url: Optional[str] = Field(default=None, max_length=500)


class ItemOut(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    category: Optional[str] = None
    total_quantity: int
    available_quantity: int
    low_stock_threshold: int
    location_id: Optional[int] = None
    image_url: Optional[str] = None
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
