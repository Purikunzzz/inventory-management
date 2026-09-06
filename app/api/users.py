from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user_or_admin, get_db, get_current_user, require_admin
from app.models.user import User, UserRoleEnum
from app.schemas.user import CreateUser, UpdateUser, UserOut
from app.services import auth_service


router = APIRouter(prefix="/users", tags=["users"])


@router.patch("/me", response_model=UserOut, status_code=status.HTTP_200_OK)
def update_me(
    body: UpdateUser,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
) -> UserOut:
    """Allow any authenticated user to update their own profile (full_name only)."""
    # Only allow updating full_name — strip role/email/password changes for self-update
    data = body.model_dump(exclude_unset=True)
    safe = UpdateUser(full_name=data.get("full_name")) if "full_name" in data else UpdateUser()
    user = auth_service.update_user(db, current.id, safe)
    return UserOut.model_validate(user)


@router.post("", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def create_user(
    body: CreateUser,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
) -> UserOut:
    user = auth_service.create_user(db, body)
    return UserOut.model_validate(user)


@router.get("", response_model=list[UserOut], status_code=status.HTTP_200_OK)
def list_users(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
) -> list[UserOut]:
    users = auth_service.list_users(db, skip=skip, limit=limit)
    return [UserOut.model_validate(u) for u in users]


@router.get("/{user_id}", response_model=UserOut, status_code=status.HTTP_200_OK)
def get_user(
    user_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user_or_admin),
) -> UserOut:
    # Authorization handled by get_current_user_or_admin dependency.
    user = auth_service.get_user(db, user_id)
    return UserOut.model_validate(user)


@router.patch("/{user_id}", response_model=UserOut, status_code=status.HTTP_200_OK)
def update_user(
    user_id: int,
    body: UpdateUser,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
) -> UserOut:
    user = auth_service.update_user(db, user_id, body)
    return UserOut.model_validate(user)


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
) -> Response:
    auth_service.soft_delete_user(db, user_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
