from datetime import date
from decimal import Decimal
from typing import Annotated, Optional

from pydantic import BaseModel, Field, StringConstraints

from app.models.maintenance import MaintenanceStatus, MaintenanceType
from app.schemas.types import UtcDateTime


class MaintenanceCreate(BaseModel):
    item_id: int
    type: MaintenanceType
    scheduled_date: date
    notes: Optional[str] = Field(default=None, max_length=1000)
    technician_id: Optional[int] = None
    cost: Decimal = Field(default=Decimal("0"), ge=0, max_digits=10, decimal_places=2)
    next_due: Optional[date] = None


class IssueReport(BaseModel):
    """Any user reporting a problem with an item (becomes a scheduled repair)."""

    item_id: int
    notes: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=1000)]


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
    completed_at: Optional[UtcDateTime] = None
    next_due: Optional[date] = None
    cost: float
    notes: Optional[str] = None
    technician_id: Optional[int] = None
    technician_name: Optional[str] = None
    reported_by: Optional[str] = None  # set when a non-admin created it via "Report Issue"
    created_at: UtcDateTime
    updated_at: UtcDateTime

    model_config = {"from_attributes": True}
