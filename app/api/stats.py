from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models.user import User
from app.schemas.stats import ItemUsageOut, LowStockOut, StockMovementOut, SummaryOut
from app.services import stats_service

router = APIRouter(prefix="/stats", tags=["stats"])


@router.get("/summary", response_model=SummaryOut, status_code=status.HTTP_200_OK)
def get_summary(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> SummaryOut:
    return stats_service.summary(db)


@router.get(
    "/item-usage", response_model=list[ItemUsageOut], status_code=status.HTTP_200_OK
)
def get_item_usage(
    limit: int = Query(default=10, ge=1, le=100),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[ItemUsageOut]:
    return stats_service.item_usage(db, limit=limit)


@router.get(
    "/stock-movement",
    response_model=list[StockMovementOut],
    status_code=status.HTTP_200_OK,
)
def get_stock_movement(
    days: int = Query(default=30, ge=1, le=365),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[StockMovementOut]:
    return stats_service.stock_movement(db, days=days)


@router.get(
    "/low-stock", response_model=list[LowStockOut], status_code=status.HTTP_200_OK
)
def get_low_stock(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[LowStockOut]:
    return stats_service.low_stock(db)


@router.get("/leaderboard", status_code=status.HTTP_200_OK)
def get_leaderboard(
    limit: int = Query(default=10, ge=1, le=50),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[dict]:
    return stats_service.leaderboard(db, limit=limit)


@router.get("/recommendations", status_code=status.HTTP_200_OK)
def get_recommendations(
    limit: int = Query(default=12, ge=1, le=50),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[dict]:
    return stats_service.recommendations(db, limit=limit)
