"""Timezone helpers.

DB columns are naive `TIMESTAMP` holding UTC wall time. Rules:
- incoming aware datetimes are converted to naive UTC before storing;
- outgoing datetimes are tagged as UTC so JSON carries a trailing "Z"
  (browsers then render local time correctly);
- human-facing day boundaries and report timestamps use APP_TIMEZONE.
"""

from datetime import date, datetime, time, timezone
from zoneinfo import ZoneInfo

from app.config import settings

APP_TZ = ZoneInfo(settings.APP_TIMEZONE)


def to_utc_naive(value: datetime) -> datetime:
    """Aware → naive UTC for storage. Naive input is assumed to be UTC already."""
    if value.tzinfo is None:
        return value
    return value.astimezone(timezone.utc).replace(tzinfo=None)


def as_utc(value: datetime) -> datetime:
    """Tag a naive UTC datetime read from the DB as UTC (aware values are normalised)."""
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def to_local(value: datetime) -> datetime:
    return as_utc(value).astimezone(APP_TZ)


def local_today() -> date:
    return datetime.now(APP_TZ).date()


def local_day_bounds_utc(start: date, end: date) -> tuple[datetime, datetime]:
    """Inclusive local-calendar-day range expressed as naive UTC (for DB filters)."""
    start_dt = datetime.combine(start, time.min, tzinfo=APP_TZ)
    end_dt = datetime.combine(end, time.max, tzinfo=APP_TZ)
    return to_utc_naive(start_dt), to_utc_naive(end_dt)
