from datetime import datetime, timezone

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text

from app.database import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class AdminMfa(Base):
    """TOTP two-factor settings for one admin (separate table so `create_all` adds it — no ALTER).

    `secret` is set on setup; `enabled` flips once the first code is confirmed.
    `backup_code_hashes` is a JSON list of SHA-256 hex digests of unused one-time codes.
    """

    __tablename__ = "admin_mfa"

    user_id = Column(Integer, ForeignKey("users.id"), primary_key=True)
    secret = Column(String(64), nullable=False)
    enabled = Column(Boolean, nullable=False, default=False)
    last_used_step = Column(Integer, nullable=True)  # blocks replay of the same TOTP code
    backup_code_hashes = Column(Text, nullable=False, default="[]")
    failed_attempts = Column(Integer, nullable=False, default=0)
    locked_until = Column(DateTime, nullable=True)
    created_at = Column(DateTime, nullable=False, default=_utcnow)
    updated_at = Column(DateTime, nullable=False, default=_utcnow, onupdate=_utcnow)
