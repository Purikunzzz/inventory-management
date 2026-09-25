from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, timedelta, timezone
from typing import Any

from app.models.item import Item
from app.models.user import User
from app.models.borrow import BorrowRecord, BorrowStatus

# Pending/rejected requests never left the shelf, so they don't count as usage.
_REAL_LOANS = (BorrowStatus.borrowed, BorrowStatus.returned)
from app.schemas.stats import SummaryOut, ItemUsageOut, StockMovementOut, LowStockOut


def summary(db: Session) -> SummaryOut:
    """High-level dashboard counts."""
    total_items = db.query(func.count(Item.id)).filter(Item.is_active.is_(True)).scalar() or 0
    total_users = db.query(func.count(User.id)).filter(User.is_active.is_(True)).scalar() or 0
    active_borrows = (
        db.query(func.count(BorrowRecord.id))
        .filter(BorrowRecord.status == BorrowStatus.borrowed)
        .scalar()
        or 0
    )
    low_stock_count = (
        db.query(func.count(Item.id))
        .filter(
            Item.is_active.is_(True),
            Item.available_quantity <= Item.low_stock_threshold,
        )
        .scalar()
        or 0
    )
    return SummaryOut(
        total_items=int(total_items),
        total_users=int(total_users),
        active_borrows=int(active_borrows),
        low_stock_items=int(low_stock_count),
    )


def item_usage(db: Session, limit: int = 10) -> list[ItemUsageOut]:
    """Most-borrowed items by transaction count (descending)."""
    rows = (
        db.query(
            Item.id,
            Item.name,
            Item.image_url,
            func.count(BorrowRecord.id).label("borrow_count"),
            func.coalesce(func.sum(BorrowRecord.quantity), 0).label("total_quantity_borrowed"),
        )
        .join(BorrowRecord, BorrowRecord.item_id == Item.id)
        .filter(BorrowRecord.status.in_(_REAL_LOANS))
        .group_by(Item.id, Item.name, Item.image_url)
        .order_by(func.count(BorrowRecord.id).desc())
        .limit(limit)
        .all()
    )
    return [
        ItemUsageOut(
            item_id=r.id,
            name=r.name,
            borrow_count=int(r.borrow_count),
            total_quantity_borrowed=int(r.total_quantity_borrowed),
            image_url=r.image_url,
        )
        for r in rows
    ]


def stock_movement(db: Session, days: int = 30) -> list[StockMovementOut]:
    """Day-by-day count of borrow vs. return events over the last N days."""
    since = datetime.now(timezone.utc) - timedelta(days=days)

    borrows = (
        db.query(
            func.date(BorrowRecord.borrowed_at).label("day"),
            func.coalesce(func.sum(BorrowRecord.quantity), 0).label("qty"),
        )
        .filter(BorrowRecord.borrowed_at >= since, BorrowRecord.status.in_(_REAL_LOANS))
        .group_by(func.date(BorrowRecord.borrowed_at))
        .all()
    )
    returns = (
        db.query(
            func.date(BorrowRecord.returned_at).label("day"),
            func.coalesce(func.sum(BorrowRecord.quantity), 0).label("qty"),
        )
        .filter(BorrowRecord.returned_at.isnot(None), BorrowRecord.returned_at >= since)
        .group_by(func.date(BorrowRecord.returned_at))
        .all()
    )

    # Merge both streams keyed by day; missing values default to 0.
    movement: dict[str, dict] = {}
    for row in borrows:
        key = str(row.day)
        movement.setdefault(key, {"date": key, "borrowed": 0, "returned": 0})
        movement[key]["borrowed"] = int(row.qty)
    for row in returns:
        key = str(row.day)
        movement.setdefault(key, {"date": key, "borrowed": 0, "returned": 0})
        movement[key]["returned"] = int(row.qty)

    return [StockMovementOut(**v) for v in sorted(movement.values(), key=lambda r: r["date"])]


def low_stock(db: Session) -> list[LowStockOut]:
    """Items where available_quantity <= low_stock_threshold (StockAlert)."""
    items = (
        db.query(Item)
        .filter(
            Item.is_active.is_(True),
            Item.available_quantity <= Item.low_stock_threshold,
        )
        .all()
    )
    return [
        LowStockOut(
            item_id=i.id,
            name=i.name,
            available_quantity=i.available_quantity,
            low_stock_threshold=i.low_stock_threshold,
        )
        for i in items
    ]


def leaderboard(db: Session, limit: int = 10) -> list[dict[str, Any]]:
    """Top users ranked by total borrow count."""
    rows = (
        db.query(
            User.id,
            User.full_name,
            User.email,
            User.department,
            func.count(BorrowRecord.id).label("borrow_count"),
            func.coalesce(func.sum(BorrowRecord.quantity), 0).label("total_quantity"),
        )
        .join(BorrowRecord, BorrowRecord.user_id == User.id)
        .filter(User.is_active.is_(True), BorrowRecord.status.in_(_REAL_LOANS))
        .group_by(User.id, User.full_name, User.email, User.department)
        .order_by(func.count(BorrowRecord.id).desc())
        .limit(limit)
        .all()
    )
    return [
        {
            "rank": i + 1,
            "user_id": r.id,
            "name": r.full_name or r.email.split("@")[0],
            "email": r.email,
            "department": r.department or "Unknown",
            "borrow_count": int(r.borrow_count),
            "total_quantity": int(r.total_quantity),
        }
        for i, r in enumerate(rows)
    ]


def _borrowers_by_item(db: Session) -> dict[int, set[int]]:
    """item_id -> ids of users who really borrowed it."""
    rows = (
        db.query(BorrowRecord.item_id, BorrowRecord.user_id)
        .filter(BorrowRecord.status.in_(_REAL_LOANS))
        .distinct()
        .all()
    )
    borrowers: dict[int, set[int]] = {}
    for item_id, user_id in rows:
        borrowers.setdefault(item_id, set()).add(user_id)
    return borrowers


def _co_borrowed(source_id: int, borrowers: dict[int, set[int]]) -> list[tuple[int, int]]:
    """Other items ranked by how many of the source's borrowers also borrowed them."""
    users = borrowers[source_id]
    scored = [
        (other_id, len(users & other_users))
        for other_id, other_users in borrowers.items()
        if other_id != source_id
    ]
    return sorted((p for p in scored if p[1] > 0), key=lambda p: (-p[1], p[0]))


def recommendations(db: Session, limit: int = 12) -> list[dict[str, Any]]:
    """Items other users also borrowed, from real co-borrowing history.

    For each item, related items are ranked by how many distinct users borrowed
    both. ``confidence`` is the share of the source item's borrowers who also
    borrowed the top related item.
    """
    borrowers = _borrowers_by_item(db)
    items = {
        i.id: i
        for i in db.query(Item).filter(Item.id.in_(borrowers.keys()), Item.is_active.is_(True)).all()
    }
    recs = []
    for source_id in sorted(borrowers, key=lambda k: -len(borrowers[k])):
        source = items.get(source_id)
        ranked = [(oid, n) for oid, n in _co_borrowed(source_id, borrowers) if oid in items]
        if not source or not ranked:
            continue
        top_users = len(borrowers[source_id])
        recs.append({
            "id": f"rec-{source_id}",
            "item_id": source_id,
            "item_name": source.name,
            "category": source.category or "General",
            "borrow_count": top_users,
            "confidence": round(ranked[0][1] / top_users, 2),
            "reason": f"{ranked[0][1]} of {top_users} users who borrowed this also borrowed {items[ranked[0][0]].name}",
            "related_items": [
                {"id": oid, "name": items[oid].name, "category": items[oid].category or "General"}
                for oid, _ in ranked[:4]
            ],
        })
        if len(recs) >= limit:
            break
    return recs
