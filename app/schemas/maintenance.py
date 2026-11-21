from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, Field

from app.models.maintenance import MaintenanceStatus, MaintenanceType


class MaintenanceCreate(BaseModel):
    item_id: int
    type: MaintenanceType
    scheduled_date: date
    notes: Optional[str] = Field(default=None, max_length=1000)
    technician_id: Optional[int] = None
    cost: Decimal = Field(default=Decimal("0"), ge=0, max_digits=10, decimal_places=2)
    next_due: Optional[date] = None


class MaintenanceUpdate(BaseModel):
    type: Optional[MaintenanceType] = None
    status: Optional[MaintenanceStatus] = None
    scheduled_date: Optional[date] = None
    notes: Optional[str] = Field(default=None, max_length=1000)
    technician_id: Optional[int] = None
    cost: Optional[Decimal] = Field(default=None, ge=0, max_digits=10, decimal_places=2)
    next_due: Optional[date] = None


class MaintenanceOut(BaseModel):
    id: int
    item_id: int
    item_name: Optional[str] = None
    type: MaintenanceType
    status: MaintenanceStatus
    scheduled_date: date
    completed_at: Optional[datetime] = None
    next_due: Optional[date] = None
    cost: float
    notes: Optional[str] = None
    technician_id: Optional[int] = None
    technician_name: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
