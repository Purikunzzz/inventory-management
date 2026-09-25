from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Enum as SAEnum
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
import enum

from app.database import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class BorrowStatus(str, enum.Enum):
    pending = "pending"
    borrowed = "borrowed"
    returned = "returned"
    rejected = "rejected"


class BorrowRecord(Base):
    """A checkout/return transaction for an Item by a User."""

    __tablename__ = "borrow_records"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    item_id = Column(Integer, ForeignKey("items.id"), nullable=False, index=True)

    quantity = Column(Integer, nullable=False, default=1)
    status = Column(SAEnum(BorrowStatus), nullable=False, default=BorrowStatus.borrowed, index=True)

    borrowed_at = Column(DateTime, nullable=False, default=_utcnow)
    due_date = Column(DateTime, nullable=True)
    returned_at = Column(DateTime, nullable=True)
    note = Column(String(500), nullable=True)

    # Set when an admin approves or rejects a pending request.
    reviewed_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    reviewed_at = Column(DateTime, nullable=True)
    review_note = Column(String(500), nullable=True)

    user = relationship("User", back_populates="borrow_records", foreign_keys=[user_id])
    reviewer = relationship("User", foreign_keys=[reviewed_by])
    item = relationship("Item", back_populates="borrow_records")
