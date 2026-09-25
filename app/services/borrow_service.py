from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime, timezone

from app.models.borrow import BorrowRecord, BorrowStatus
from app.models.item import Item
from app.models.user import User, UserRoleEnum
from app.schemas.borrow import BorrowRequest, ReturnRequest, ReviewRequest, BorrowStatusEnum


def _locked_item(db: Session, item_id: int) -> Item:
    item = (
        db.query(Item)
        .filter(Item.id == item_id, Item.is_active.is_(True))
        .with_for_update()
        .first()
    )
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item not found")
    return item


def _require_stock(item: Item, quantity: int) -> None:
    if item.available_quantity < quantity:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Not enough stock available to borrow",
        )


def borrow_item(db: Session, user: User, body: BorrowRequest) -> BorrowRecord:
    """Create a borrow request.

    Admins borrow immediately (stock is decremented). Everyone else creates a
    ``pending`` request that holds no stock until an admin approves it.
    Returns 409 Conflict when the requested quantity exceeds stock on hand.
    """
    item = _locked_item(db, body.item_id)
    _require_stock(item, body.quantity)

    auto_approve = user.role == UserRoleEnum.admin
    if auto_approve:
        item.available_quantity -= body.quantity
    record = BorrowRecord(
        user_id=user.id,
        item_id=item.id,
        quantity=body.quantity,
        status=BorrowStatus.borrowed if auto_approve else BorrowStatus.pending,
        due_date=body.due_date,
        note=body.note,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


def _get_pending(db: Session, borrow_id: int) -> BorrowRecord:
    record = db.query(BorrowRecord).filter(BorrowRecord.id == borrow_id).first()
    if not record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Borrow record not found")
    if record.status != BorrowStatus.pending:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Request is not pending")
    return record


def _stamp_review(record: BorrowRecord, admin: User, body: ReviewRequest) -> None:
    now = datetime.now(timezone.utc)
    record.reviewed_by = admin.id
    record.reviewed_at = now
    record.review_note = body.note


def approve_borrow(db: Session, admin: User, borrow_id: int, body: ReviewRequest) -> BorrowRecord:
    """Approve a pending request: re-check stock, decrement it, start the loan."""
    record = _get_pending(db, borrow_id)
    item = _locked_item(db, record.item_id)
    _require_stock(item, record.quantity)

    item.available_quantity -= record.quantity
    record.status = BorrowStatus.borrowed
    record.borrowed_at = datetime.now(timezone.utc)
    _stamp_review(record, admin, body)
    db.commit()
    db.refresh(record)
    return record


def reject_borrow(db: Session, admin: User, borrow_id: int, body: ReviewRequest) -> BorrowRecord:
    """Reject a pending request; stock was never held so nothing is restocked."""
    record = _get_pending(db, borrow_id)
    record.status = BorrowStatus.rejected
    _stamp_review(record, admin, body)
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
    if record.status != BorrowStatus.borrowed:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Borrow request was not approved")

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
