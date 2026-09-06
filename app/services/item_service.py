from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from typing import Optional

from app.models.item import Item
from app.models.location import Location
from app.schemas.item import ItemCreate, ItemUpdate


def list_items(
    db: Session,
    skip: int = 0,
    limit: int = 100,
    category: Optional[str] = None,
    location_id: Optional[int] = None,
    q: Optional[str] = None,
    include_inactive: bool = False,
) -> list[Item]:
    query = db.query(Item)
    if not include_inactive:
        query = query.filter(Item.is_active.is_(True))
    if q:
        query = query.filter(Item.name.ilike(f"%{q}%"))
    if category:
        query = query.filter(Item.category == category)
    if location_id is not None:
        query = query.filter(Item.location_id == location_id)
    return query.offset(skip).limit(limit).all()


def get_item(db: Session, item_id: int) -> Item:
    item = db.query(Item).filter(Item.id == item_id, Item.is_active.is_(True)).first()
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item not found")
    return item


def _validate_location(db: Session, location_id: Optional[int]) -> None:
    if location_id is None:
        return
    loc = db.query(Location).filter(Location.id == location_id, Location.is_active.is_(True)).first()
    if not loc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Location not found")


def create_item(db: Session, body: ItemCreate) -> Item:
    _validate_location(db, body.location_id)
    # available_quantity mirrors total_quantity at creation time — nothing has
    # been borrowed yet.
    item = Item(
        name=body.name,
        description=body.description,
        category=body.category,
        total_quantity=body.total_quantity,
        available_quantity=body.total_quantity,
        low_stock_threshold=body.low_stock_threshold,
        location_id=body.location_id,
        image_url=body.image_url,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


def update_item(db: Session, item_id: int, body: ItemUpdate) -> Item:
    item = get_item(db, item_id)
    data = body.model_dump(exclude_unset=True)

    if "location_id" in data:
        _validate_location(db, data["location_id"])

    # If total_quantity changes, shift available_quantity by the same delta so
    # the count of items currently out on loan stays consistent.
    if "total_quantity" in data:
        new_total = data["total_quantity"]
        delta = new_total - item.total_quantity
        new_available = item.available_quantity + delta
        if new_available < 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot reduce total below currently borrowed quantity",
            )
        item.available_quantity = new_available

    for field, value in data.items():
        setattr(item, field, value)

    db.commit()
    db.refresh(item)
    return item


def soft_delete_item(db: Session, item_id: int) -> None:
    """Soft delete — set is_active=False, never hard delete."""
    item = get_item(db, item_id)
    item.is_active = False
    db.commit()
