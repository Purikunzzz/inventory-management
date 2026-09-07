from datetime import date

from fastapi import APIRouter, Depends, Query, status
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models.user import User
from app.schemas.reports import ReportFormatEnum, ReportTypeEnum
from app.services import report_service

router = APIRouter(prefix="/reports", tags=["reports"])


@router.get("/{report_type}", status_code=status.HTTP_200_OK)
def generate_report(
    report_type: ReportTypeEnum,
    format: ReportFormatEnum = Query(default=ReportFormatEnum.pdf, alias="format"),
    start_date: date | None = Query(default=None),
    end_date: date | None = Query(default=None),
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
) -> Response:
    filename, media_type, content = report_service.build_report(
        db, current, report_type, format, start_date, end_date
    )
    return Response(
        content=content,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
