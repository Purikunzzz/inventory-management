from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_current_user, require_admin
from app.models.user import User
from app.schemas.location import LocationCreate, LocationOut, LocationUpdate
from app.schemas.item import ItemOut
from app.services import location_service


router = APIRouter(prefix="/locations", tags=["locations"])


@router.get("", response_model=list[LocationOut], status_code=status.HTTP_200_OK)
def list_locations(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[LocationOut]:
    locs = location_service.list_locations(db, skip=skip, limit=limit)
    return [LocationOut.model_validate(l) for l in locs]


@router.get("/{location_id}", response_model=LocationOut, status_code=status.HTTP_200_OK)
def get_location(
    location_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> LocationOut:
    return LocationOut.model_validate(location_service.get_location(db, location_id))


@router.get(
    "/{location_id}/items",
    response_model=list[ItemOut],
    status_code=status.HTTP_200_OK,
)
def items_in_location(
    location_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[ItemOut]:
    items = location_service.get_items_in_location(db, location_id)
    return [ItemOut.model_validate(i) for i in items]


@router.post("", response_model=LocationOut, status_code=status.HTTP_201_CREATED)
def create_location(
    body: LocationCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
) -> LocationOut:
    return LocationOut.model_validate(location_service.create_location(db, body))


@router.patch("/{location_id}", response_model=LocationOut, status_code=status.HTTP_200_OK)
def update_location(
    location_id: int,
    body: LocationUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
) -> LocationOut:
    return LocationOut.model_validate(
        location_service.update_location(db, location_id, body)
    )


@router.delete("/{location_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_location(
    location_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
) -> Response:
    location_service.soft_delete_location(db, location_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
