"""Timestamps: stored as naive UTC, returned with "Z", local days for reports."""

from datetime import date, datetime

import pytest

from app.core import timeutil


@pytest.fixture
def item(client, auth_header) -> dict:
    resp = client.post("/api/items", json={"name": "Multimeter", "total_quantity": 5}, headers=auth_header)
    assert resp.status_code == 201
    return resp.json()


def test_api_datetimes_are_utc_with_z(client, auth_header, item):
    assert item["created_at"].endswith("Z")
    borrow = client.post("/api/borrow", json={"item_id": item["id"]}, headers=auth_header).json()
    assert borrow["borrowed_at"].endswith("Z")


def test_due_date_with_offset_is_stored_as_utc(client, auth_header, item, db):
    """00:00 Bangkok (+07:00) == 17:00 UTC the previous day, regardless of DB server timezone."""
    from app.models.borrow import BorrowRecord

    resp = client.post(
        "/api/borrow",
        json={"item_id": item["id"], "due_date": "2026-11-26T00:00:00+07:00"},
        headers=auth_header,
    )
    assert resp.status_code == 201
    assert resp.json()["due_date"] == "2026-11-25T17:00:00Z"
    stored = db.get(BorrowRecord, resp.json()["id"]).due_date
    assert stored.replace(tzinfo=None) == datetime(2026, 11, 25, 17, 0)


def test_local_day_bounds_use_app_timezone():
    start, end = timeutil.local_day_bounds_utc(date(2026, 11, 21), date(2026, 11, 21))
    # Bangkok day 21 Nov = 20 Nov 17:00 UTC .. 21 Nov 16:59:59 UTC
    assert start == datetime(2026, 11, 20, 17, 0)
    assert end.replace(microsecond=0) == datetime(2026, 11, 21, 16, 59, 59)


def test_to_local_formats_bangkok_wall_time():
    assert timeutil.to_local(datetime(2026, 11, 20, 17, 30)).strftime("%Y-%m-%d %H:%M") == "2026-11-21 00:30"
