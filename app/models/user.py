import enum
from datetime import datetime, timezone

from sqlalchemy import Boolean, Column, DateTime, Integer, String
from sqlalchemy import Enum as SAEnum
from sqlalchemy.orm import relationship

from app.database import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class UserRoleEnum(str, enum.Enum):
    admin = "admin"
    user = "user"


def detect_department(email: str) -> str | None:
    """Determine faculty from KMUTL email pattern.

    xxxx00xx@kmitl.ac.th → Mechatronics Engineering
    xxxx10xx@kmitl.ac.th → Computer Engineering
    xxxx20xx@kmitl.ac.th → Electronics and Electrical Engineering
    """
    prefix = email.split("@")[0]
    if len(prefix) < 4:
        return None
    code = prefix[4:6]
    mapping = {
        "00": "Mechatronics Engineering",
        "10": "Computer Engineering",
        "20": "Electronics and Electrical Engineering",
    }
    return mapping.get(code)


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password = Column(String(255), nullable=True)
    auth_provider = Column(String(20), nullable=False, default="email")
    full_name = Column(String(255), nullable=True)
    department = Column(String(100), nullable=True)
    role = Column(SAEnum(UserRoleEnum), nullable=False, default=UserRoleEnum.user)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, nullable=False, default=_utcnow)
    updated_at = Column(DateTime, nullable=False, default=_utcnow, onupdate=_utcnow)

    borrow_records = relationship("BorrowRecord", back_populates="user")
