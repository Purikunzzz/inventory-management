from sqlalchemy import (
    Boolean, Column, Date, DateTime, Enum as SAEnum, ForeignKey, Integer, Numeric, String,
)
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
import enum

from app.database import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class MaintenanceType(str, enum.Enum):
    repair = "repair"
    calibration = "calibration"
    replacement = "replacement"
    inspection = "inspection"


class MaintenanceStatus(str, enum.Enum):
    scheduled = "scheduled"
    in_progress = "in_progress"
    completed = "completed"
    cancelled = "cancelled"


class MaintenanceRecord(Base):
    """A scheduled/performed maintenance job (repair, calibration, ...) on an Item."""

    __tablename__ = "maintenance_records"

    id = Column(Integer, primary_key=True, index=True)
    item_id = Column(Integer, ForeignKey("items.id"), nullable=False, index=True)
    type = Column(SAEnum(MaintenanceType), nullable=False)
    status = Column(
        SAEnum(MaintenanceStatus), nullable=False, default=MaintenanceStatus.scheduled, index=True
    )
    scheduled_date = Column(Date, nullable=False)
    completed_at = Column(DateTime, nullable=True)
    next_due = Column(Date, nullable=True)
    cost = Column(Numeric(10, 2), nullable=False, default=0)
    notes = Column(String(1000), nullable=True)
    technician_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, nullable=False, default=_utcnow)
    updated_at = Column(DateTime, nullable=False, default=_utcnow, onupdate=_utcnow)

    item = relationship("Item")
    technician = relationship("User", foreign_keys=[technician_id])
