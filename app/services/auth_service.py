from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.config import settings
from app.core.google_auth import verify_google_token
from app.core.security import create_access_token, hash_password, verify_password
from app.models.user import User, UserRoleEnum, detect_department
from app.services import mfa_service
from app.schemas.user import ChangePassword, CreateUser, LoginRequest, LoginResponse, UpdateUser


def _verify_credentials(db: Session, email: str, password: str) -> User:
    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password"
        )
    if user.password is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Use Google Sign-In for this account",
        )
    if not verify_password(password, user.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password"
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Account is deactivated"
        )
    return user


def authenticate(db: Session, body: LoginRequest) -> LoginResponse:
    user = _verify_credentials(db, body.email, body.password)
    return mfa_service.login_response(db, user)


def authenticate_form(db: Session, username: str, password: str) -> dict:
    user = _verify_credentials(db, username, password)
    if user.role == UserRoleEnum.admin:
        # The OAuth2 password form has no step for a 2FA code.
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admins must sign in through the app (two-factor required)",
        )
    token = create_access_token(data={"sub": str(user.id), "role": user.role.value})
    return {"access_token": token, "token_type": "bearer"}


def authenticate_google(db: Session, credential: str) -> LoginResponse:
    info = verify_google_token(credential, settings.GOOGLE_CLIENT_ID)
    user = db.query(User).filter(User.email == info["email"]).first()
    if not user:
        user = User(
            email=info["email"],
            full_name=info["name"],
            password=None,
            auth_provider="google",
            role=UserRoleEnum.user,
            is_active=True,
            department=detect_department(info["email"]),
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    else:
        if not user.department:
            user.department = detect_department(info["email"])
            db.commit()
            db.refresh(user)
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Account is deactivated"
        )

    # Auto-promote to admin if email is in ADMIN_EMAILS
    admin_emails = [e.strip() for e in settings.ADMIN_EMAILS.split(",") if e.strip()]
    if info["email"].lower() in [e.lower() for e in admin_emails]:
        if user.role != UserRoleEnum.admin:
            user.role = UserRoleEnum.admin
            db.commit()

    return mfa_service.login_response(db, user)


def create_user(db: Session, body: CreateUser) -> User:
    existing = db.query(User).filter(User.email == body.email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="Email already registered"
        )
    user = User(
        email=body.email,
        full_name=body.full_name,
        password=hash_password(body.password),
        role=body.role or UserRoleEnum.user,
        is_active=True,
        department=detect_department(body.email),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def list_users(db: Session, skip: int = 0, limit: int = 100, include_inactive: bool = False) -> list[User]:
    query = db.query(User)
    if not include_inactive:
        query = query.filter(User.is_active.is_(True))
    return query.offset(skip).limit(limit).all()


def get_user(db: Session, user_id: int) -> User:
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
        )
    return user


def _guard_self_lockout(actor_id: int | None, user_id: int, data: dict) -> None:
    """Stop an admin from demoting or deactivating their own account.

    Otherwise the last admin can lock everyone out of the admin console.
    """
    if actor_id is None or actor_id != user_id:
        return
    if data.get("role") not in (None, UserRoleEnum.admin, UserRoleEnum.admin.value):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot remove your own admin role",
        )
    if data.get("is_active") is False:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot deactivate your own account",
        )


def update_user(
    db: Session, user_id: int, body: UpdateUser, actor_id: int | None = None
) -> User:
    user = get_user(db, user_id)
    data = body.model_dump(exclude_unset=True)
    _guard_self_lockout(actor_id, user_id, data)

    # Check email uniqueness if it's being changed.
    if "email" in data and data["email"] != user.email:
        existing = db.query(User).filter(User.email == data["email"]).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Email already registered",
            )

    # Hash password if being updated.
    if "password" in data:
        data["password"] = hash_password(data["password"])

    for field, value in data.items():
        setattr(user, field, value)

    db.commit()
    db.refresh(user)
    return user


def change_password(db: Session, user: User, body: ChangePassword) -> User:
    """Change own password after verifying the current one. Google accounts have none."""
    if user.password is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Google accounts cannot change password here",
        )
    # 400 (not 401): the frontend treats 401 as an expired session and logs out.
    if not verify_password(body.current_password, user.password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Current password is incorrect"
        )
    user.password = hash_password(body.new_password)
    db.commit()
    db.refresh(user)
    return user


def soft_delete_user(db: Session, user_id: int, actor_id: int | None = None) -> None:
    """Deactivate user — set is_active=False, never hard delete."""
    user = get_user(db, user_id)
    if actor_id == user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot delete your own account",
        )
    user.is_active = False
    db.commit()
