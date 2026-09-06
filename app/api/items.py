from fastapi import APIRouter, Depends, status, Response
from sqlalchemy.orm import Session
from typing import Optional

from app.api.deps import get_db, get_current_user, require_admin
from app.models.user import User
from app.schemas.item import ItemCreate, ItemUpdate, ItemOut
from app.services import item_service


router = APIRouter(prefix="/items", tags=["items"])


@router.get("", response_model=list[ItemOut], status_code=status.HTTP_200_OK)
def list_items(
    skip: int = 0,
    limit: int = 100,
    category: Optional[str] = None,
    location_id: Optional[int] = None,
    q: Optional[str] = None,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[ItemOut]:
    items = item_service.list_items(
        db, skip=skip, limit=limit, category=category, location_id=location_id, q=q
    )
    return [ItemOut.model_validate(i) for i in items]


@router.get("/{item_id}", response_model=ItemOut, status_code=status.HTTP_200_OK)
def get_item(
    item_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> ItemOut:
    return ItemOut.model_validate(item_service.get_item(db, item_id))


@router.post("", response_model=ItemOut, status_code=status.HTTP_201_CREATED)
def create_item(
    body: ItemCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
) -> ItemOut:
    return ItemOut.model_validate(item_service.create_item(db, body))


@router.patch("/{item_id}", response_model=ItemOut, status_code=status.HTTP_200_OK)
def update_item(
    item_id: int,
    body: ItemUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
) -> ItemOut:
    return ItemOut.model_validate(item_service.update_item(db, item_id, body))


@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_item(
    item_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
) -> Response:
    item_service.soft_delete_item(db, item_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
