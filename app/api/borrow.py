from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from typing import Optional

from app.api.deps import get_db, get_current_user
from app.models.user import User
from app.schemas.borrow import BorrowRequest, ReturnRequest, BorrowOut, BorrowStatusEnum
from app.services import borrow_service


router = APIRouter(tags=["borrow"])


@router.post("/borrow", response_model=BorrowOut, status_code=status.HTTP_201_CREATED)
def borrow(
    body: BorrowRequest,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
) -> BorrowOut:
    record = borrow_service.borrow_item(db, current, body)
    return BorrowOut.model_validate(record)


@router.post("/return", response_model=BorrowOut, status_code=status.HTTP_200_OK)
def return_(
    body: ReturnRequest,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
) -> BorrowOut:
    record = borrow_service.return_item(db, current, body)
    return BorrowOut.model_validate(record)


@router.get("/transactions", response_model=list[BorrowOut], status_code=status.HTTP_200_OK)
def list_transactions(
    skip: int = 0,
    limit: int = 100,
    user_id: Optional[int] = None,
    item_id: Optional[int] = None,
    status_filter: Optional[BorrowStatusEnum] = None,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
) -> list[BorrowOut]:
    records = borrow_service.list_transactions(
        db,
        current_user=current,
        skip=skip,
        limit=limit,
        user_id=user_id,
        item_id=item_id,
        status_filter=status_filter,
    )
    return [BorrowOut.model_validate(r) for r in records]
