from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Enum as SAEnum
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
import enum

from app.database import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class BorrowStatus(str, enum.Enum):
    borrowed = "borrowed"
    returned = "returned"


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

    user = relationship("User", back_populates="borrow_records")
    item = relationship("Item", back_populates="borrow_records")
