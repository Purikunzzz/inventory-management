from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy.orm import Session, joinedload

from app.models.item import Item
from app.models.maintenance import MaintenanceRecord, MaintenanceStatus
from app.models.user import User
from app.schemas.maintenance import MaintenanceCreate, MaintenanceOut, MaintenanceUpdate

_CLOSED = (MaintenanceStatus.completed, MaintenanceStatus.cancelled)


def to_out(record: MaintenanceRecord) -> MaintenanceOut:
    """Flatten item/technician names into the response."""
    out = MaintenanceOut.model_validate(record)
    out.item_name = record.item.name if record.item else None
    tech = record.technician
    out.technician_name = (tech.full_name or tech.email) if tech else None
    return out


def _base_query(db: Session):
    return (
        db.query(MaintenanceRecord)
        .options(joinedload(MaintenanceRecord.item), joinedload(MaintenanceRecord.technician))
        .filter(MaintenanceRecord.is_active.is_(True))
    )


def list_records(
    db: Session,
    status_filter: MaintenanceStatus | None = None,
    item_id: int | None = None,
    skip: int = 0,
    limit: int = 100,
) -> list[MaintenanceRecord]:
    query = _base_query(db)
    if status_filter is not None:
        query = query.filter(MaintenanceRecord.status == status_filter)
    if item_id is not None:
        query = query.filter(MaintenanceRecord.item_id == item_id)
    order = (MaintenanceRecord.scheduled_date.desc(), MaintenanceRecord.id.desc())
    return query.order_by(*order).offset(skip).limit(limit).all()


def get_record(db: Session, record_id: int) -> MaintenanceRecord:
    record = _base_query(db).filter(MaintenanceRecord.id == record_id).first()
    if not record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Maintenance record not found"
        )
    return record


def _check_item(db: Session, item_id: int) -> None:
    exists = db.query(Item.id).filter(Item.id == item_id, Item.is_active.is_(True)).first()
    if not exists:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item not found")


def _check_technician(db: Session, user_id: int | None) -> None:
    if user_id is None:
        return
    exists = db.query(User.id).filter(User.id == user_id, User.is_active.is_(True)).first()
    if not exists:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Technician not found")


def create_record(db: Session, body: MaintenanceCreate, creator: User) -> MaintenanceRecord:
    _check_item(db, body.item_id)
    _check_technician(db, body.technician_id)
    record = MaintenanceRecord(**body.model_dump(), created_by=creator.id)
    db.add(record)
    db.commit()
    return get_record(db, record.id)


def _apply_status(record: MaintenanceRecord, new_status: MaintenanceStatus) -> None:
    """Closed jobs (completed/cancelled) are final; completing stamps completed_at."""
    if new_status == record.status:
        return
    if record.status in _CLOSED:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Maintenance is already {record.status.value}",
        )
    record.status = new_status
    if new_status == MaintenanceStatus.completed:
        record.completed_at = datetime.now(timezone.utc)


def update_record(db: Session, record_id: int, body: MaintenanceUpdate) -> MaintenanceRecord:
    record = get_record(db, record_id)
    data = body.model_dump(exclude_unset=True)
    if "technician_id" in data:
        _check_technician(db, data["technician_id"])
    new_status = data.pop("status", None)
    if new_status is not None:
        _apply_status(record, new_status)
    for field, value in data.items():
        setattr(record, field, value)
    db.commit()
    return get_record(db, record_id)


def soft_delete_record(db: Session, record_id: int) -> None:
    """Soft delete — set is_active=False, never hard delete."""
    record = get_record(db, record_id)
    record.is_active = False
    db.commit()
