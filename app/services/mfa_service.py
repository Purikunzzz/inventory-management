"""Two-factor sign-in (TOTP + one-time backup codes), required for every admin.

Flow: password/Google login → `challenge()` returns a 5-minute mfa_token instead
of a session → the client calls setup+enable (first time) or verify → session
token carrying `mfa: true`. `get_current_user` rejects admin tokens without it.
"""

import hashlib
import json
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core import totp
from app.core.security import MFA_PURPOSE, create_access_token, create_mfa_token, decode_token
from app.models.mfa import AdminMfa
from app.models.user import User, UserRoleEnum
from app.schemas.mfa import BackupCodesOut, MfaEnableOut, MfaSetupOut, MfaStatusOut
from app.schemas.user import LoginResponse, UserOut

BACKUP_CODE_COUNT = 10
_BACKUP_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789"  # no 0/o/1/l/i look-alikes
MAX_FAILURES = 5
LOCK_MINUTES = 5


def _utcnow_naive() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _get_record(db: Session, user_id: int) -> AdminMfa | None:
    return db.query(AdminMfa).filter(AdminMfa.user_id == user_id).first()


def _unauthorized() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Sign-in expired. Please sign in again.",
    )


def _user_from_mfa_token(db: Session, mfa_token: str) -> User:
    payload = decode_token(mfa_token)
    if payload.get("purpose") != MFA_PURPOSE:
        raise _unauthorized()
    try:
        user = db.get(User, int(payload.get("sub")))
    except (TypeError, ValueError):
        raise _unauthorized()
    if not user or not user.is_active or user.role != UserRoleEnum.admin:
        raise _unauthorized()
    return user


# ── login responses ──────────────────────────────────────────────────────

def issue_session(user: User, mfa: bool = False) -> LoginResponse:
    token = create_access_token(data={"sub": str(user.id), "role": user.role.value, "mfa": mfa})
    return LoginResponse(access_token=token, user=UserOut.model_validate(user))


def login_response(db: Session, user: User) -> LoginResponse:
    """What a successful first factor gets: a session, or a 2FA challenge for admins."""
    if user.role != UserRoleEnum.admin:
        return issue_session(user)
    record = _get_record(db, user.id)
    return LoginResponse(
        user=UserOut.model_validate(user),
        mfa_required=True,
        mfa_setup_required=not (record and record.enabled),
        mfa_token=create_mfa_token(user.id),
    )


# ── code checking ────────────────────────────────────────────────────────

def _hash_backup(code: str) -> str:
    return hashlib.sha256(code.encode("utf-8")).hexdigest()


def _normalize(code: str) -> str:
    return code.replace(" ", "").replace("-", "").lower()


def _new_backup_codes(record: AdminMfa) -> list[str]:
    raw = ["".join(secrets.choice(_BACKUP_ALPHABET) for _ in range(10)) for _ in range(BACKUP_CODE_COUNT)]
    record.backup_code_hashes = json.dumps([_hash_backup(c) for c in raw])
    return [f"{c[:5]}-{c[5:]}" for c in raw]


def _accept_totp(record: AdminMfa, code: str) -> bool:
    step = totp.matching_step(record.secret, code)
    if step is None or (record.last_used_step is not None and step <= record.last_used_step):
        return False  # wrong, or already used (replay)
    record.last_used_step = step
    return True


def _accept_backup(record: AdminMfa, code: str) -> bool:
    hashes = json.loads(record.backup_code_hashes or "[]")
    digest = _hash_backup(code)
    if digest not in hashes:
        return False
    hashes.remove(digest)  # one-time use
    record.backup_code_hashes = json.dumps(hashes)
    return True


def _check_lock(record: AdminMfa) -> None:
    if record.locked_until and record.locked_until > _utcnow_naive():
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many wrong codes. Try again in a few minutes.",
        )


def _verify_code(db: Session, record: AdminMfa, code: str, allow_backup: bool) -> None:
    """Accept the code or count a failure (locking after MAX_FAILURES). 400 on failure."""
    _check_lock(record)
    cleaned = _normalize(code)
    ok = _accept_totp(record, cleaned) or (allow_backup and _accept_backup(record, cleaned))
    if ok:
        record.failed_attempts = 0
        record.locked_until = None
        return
    record.failed_attempts = (record.failed_attempts or 0) + 1
    if record.failed_attempts >= MAX_FAILURES:
        record.failed_attempts = 0
        record.locked_until = _utcnow_naive() + timedelta(minutes=LOCK_MINUTES)
    db.commit()
    # 400 (not 401): the frontend treats 401 as an expired session and logs out.
    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid code")


# ── endpoints ────────────────────────────────────────────────────────────

def start_setup(db: Session, mfa_token: str) -> MfaSetupOut:
    """Create (or replace) a not-yet-confirmed secret for the QR code."""
    user = _user_from_mfa_token(db, mfa_token)
    record = _get_record(db, user.id)
    if record and record.enabled:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Two-factor is already set up")
    secret = totp.generate_secret()
    if record:
        record.secret = secret
    else:
        db.add(AdminMfa(user_id=user.id, secret=secret))
    db.commit()
    return MfaSetupOut(secret=secret, otpauth_uri=totp.provisioning_uri(secret, user.email))


def enable(db: Session, mfa_token: str, code: str) -> MfaEnableOut:
    """Confirm the first code from the app, turn 2FA on, sign in, hand out backup codes."""
    user = _user_from_mfa_token(db, mfa_token)
    record = _get_record(db, user.id)
    if not record or record.enabled:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Start two-factor setup first")
    _verify_code(db, record, code, allow_backup=False)
    record.enabled = True
    codes = _new_backup_codes(record)
    db.commit()
    session = issue_session(user, mfa=True)
    return MfaEnableOut(**session.model_dump(), backup_codes=codes)


def verify(db: Session, mfa_token: str, code: str) -> LoginResponse:
    """Second step of sign-in: authenticator code or a backup code."""
    user = _user_from_mfa_token(db, mfa_token)
    record = _get_record(db, user.id)
    if not record or not record.enabled:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Two-factor is not set up")
    _verify_code(db, record, code, allow_backup=True)
    db.commit()
    return issue_session(user, mfa=True)


def get_status(db: Session, user: User) -> MfaStatusOut:
    record = _get_record(db, user.id)
    if not record or not record.enabled:
        return MfaStatusOut(enabled=False, backup_codes_remaining=0)
    remaining = len(json.loads(record.backup_code_hashes or "[]"))
    return MfaStatusOut(enabled=True, backup_codes_remaining=remaining)


def regenerate_backup_codes(db: Session, user: User, code: str) -> BackupCodesOut:
    """Replace all backup codes; needs a fresh authenticator code (not a backup code)."""
    record = _get_record(db, user.id)
    if not record or not record.enabled:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Two-factor is not set up")
    _verify_code(db, record, code, allow_backup=False)
    codes = _new_backup_codes(record)
    db.commit()
    return BackupCodesOut(backup_codes=codes)
