from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db, require_admin
from app.models.maintenance import MaintenanceStatus
from app.models.user import User
from app.schemas.maintenance import MaintenanceCreate, MaintenanceOut, MaintenanceUpdate
from app.services import maintenance_service

router = APIRouter(prefix="/maintenance", tags=["maintenance"])


@router.get("", response_model=list[MaintenanceOut], status_code=status.HTTP_200_OK)
def list_maintenance(
    status_filter: MaintenanceStatus | None = None,
    item_id: int | None = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[MaintenanceOut]:
    records = maintenance_service.list_records(db, status_filter, item_id, skip, limit)
    return [maintenance_service.to_out(r) for r in records]


@router.get("/{record_id}", response_model=MaintenanceOut, status_code=status.HTTP_200_OK)
def get_maintenance(
    record_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> MaintenanceOut:
    return maintenance_service.to_out(maintenance_service.get_record(db, record_id))


@router.post("", response_model=MaintenanceOut, status_code=status.HTTP_201_CREATED)
def create_maintenance(
    body: MaintenanceCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
) -> MaintenanceOut:
    return maintenance_service.to_out(maintenance_service.create_record(db, body, admin))


@router.patch("/{record_id}", response_model=MaintenanceOut, status_code=status.HTTP_200_OK)
def update_maintenance(
    record_id: int,
    body: MaintenanceUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
) -> MaintenanceOut:
    return maintenance_service.to_out(maintenance_service.update_record(db, record_id, body))


@router.delete("/{record_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_maintenance(
    record_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
) -> Response:
    maintenance_service.soft_delete_record(db, record_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
