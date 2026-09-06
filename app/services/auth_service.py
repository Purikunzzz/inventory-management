from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.config import settings
from app.core.google_auth import verify_google_token
from app.core.security import create_access_token, hash_password, verify_password
from app.models.user import User, UserRoleEnum, detect_department
from app.schemas.user import CreateUser, LoginRequest, LoginResponse, UpdateUser, UserOut


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
    token = create_access_token(data={"sub": str(user.id), "role": user.role.value})
    return LoginResponse(
        access_token=token, token_type="bearer", user=UserOut.model_validate(user)
    )


def authenticate_form(db: Session, username: str, password: str) -> dict:
    user = _verify_credentials(db, username, password)
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

    token = create_access_token(data={"sub": str(user.id), "role": user.role.value})
    return LoginResponse(
        access_token=token, token_type="bearer", user=UserOut.model_validate(user)
    )


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


def update_user(db: Session, user_id: int, body: UpdateUser) -> User:
    user = get_user(db, user_id)
    data = body.model_dump(exclude_unset=True)

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


def soft_delete_user(db: Session, user_id: int) -> None:
    """Deactivate user — set is_active=False, never hard delete."""
    user = get_user(db, user_id)
    user.is_active = False
    db.commit()
