from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime, timezone

from app.models.borrow import BorrowRecord, BorrowStatus
from app.models.item import Item
from app.models.user import User, UserRoleEnum
from app.schemas.borrow import BorrowRequest, ReturnRequest, BorrowStatusEnum


def borrow_item(db: Session, user: User, body: BorrowRequest) -> BorrowRecord:
    """Decrement available_quantity and create a BorrowRecord.

    Returns 409 Conflict when the requested quantity exceeds stock on hand.
    """
    item = (
        db.query(Item)
        .filter(Item.id == body.item_id, Item.is_active.is_(True))
        .with_for_update()
        .first()
    )
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item not found")

    if item.available_quantity < body.quantity:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Not enough stock available to borrow",
        )

    item.available_quantity -= body.quantity
    record = BorrowRecord(
        user_id=user.id,
        item_id=item.id,
        quantity=body.quantity,
        status=BorrowStatus.borrowed,
        due_date=body.due_date,
        note=body.note,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


def return_item(db: Session, user: User, body: ReturnRequest) -> BorrowRecord:
    """Mark a BorrowRecord as returned and restock available_quantity."""
    record = db.query(BorrowRecord).filter(BorrowRecord.id == body.borrow_id).first()
    if not record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Borrow record not found")

    if record.status == BorrowStatus.returned:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Item already returned")

    # Regular users can only return what they themselves borrowed; admins may
    # return on anyone's behalf (e.g. lab cleanup).
    if user.role != UserRoleEnum.admin and record.user_id != user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only return items you borrowed",
        )

    item = db.query(Item).filter(Item.id == record.item_id).first()
    if item:
        item.available_quantity += record.quantity

    record.status = BorrowStatus.returned
    record.returned_at = datetime.now(timezone.utc)
    if body.note:
        record.note = body.note

    db.commit()
    db.refresh(record)
    return record


def list_transactions(
    db: Session,
    current_user: User,
    skip: int = 0,
    limit: int = 100,
    user_id: Optional[int] = None,
    item_id: Optional[int] = None,
    status_filter: Optional[BorrowStatusEnum] = None,
) -> list[BorrowRecord]:
    query = db.query(BorrowRecord)

    # Non-admins are scoped to their own history.
    if current_user.role != UserRoleEnum.admin:
        query = query.filter(BorrowRecord.user_id == current_user.id)
    elif user_id is not None:
        query = query.filter(BorrowRecord.user_id == user_id)

    if item_id is not None:
        query = query.filter(BorrowRecord.item_id == item_id)
    if status_filter is not None:
        # Translate schema enum → model enum at the service boundary.
        query = query.filter(BorrowRecord.status == BorrowStatus(status_filter.value))

    return (
        query.order_by(BorrowRecord.borrowed_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )
