from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime, timezone

from app.database import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Item(Base):
    """Equipment / physical lab item (oscilloscope, Arduino kit, etc.)."""

    __tablename__ = "items"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False, index=True)
    description = Column(String(1000), nullable=True)
    category = Column(String(100), nullable=True, index=True)

    # Inventory counters: total_quantity is the master stock, available_quantity
    # is what's currently on the shelf (decreases on borrow, increases on return).
    total_quantity = Column(Integer, nullable=False, default=0)
    available_quantity = Column(Integer, nullable=False, default=0)

    # When available_quantity <= low_stock_threshold, a stock alert is triggered.
    low_stock_threshold = Column(Integer, nullable=False, default=1)

    location_id = Column(Integer, ForeignKey("locations.id"), nullable=True)

    image_url = Column(String(500), nullable=True)

    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, nullable=False, default=_utcnow)
    updated_at = Column(DateTime, nullable=False, default=_utcnow, onupdate=_utcnow)

    location = relationship("Location", back_populates="items")
    borrow_records = relationship("BorrowRecord", back_populates="item")
