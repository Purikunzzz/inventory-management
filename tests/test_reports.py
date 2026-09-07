"""Report generation endpoint tests — every report type × format, auth, scoping."""

import csv
import io
from datetime import date, datetime, timedelta, timezone

import pytest

REPORT_TYPES = [
    "inventory",
    "borrowing",
    "maintenance",
    "damage",
    "usage",
    "financial",
]
FORMATS = ["pdf", "csv", "excel"]
MEDIA_TYPES = {
    "pdf": "application/pdf",
    "csv": "text/csv",
    "excel": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
}
MAGIC = {"pdf": b"%PDF", "excel": b"PK"}


@pytest.fixture
def seeded_item(client, auth_header):
    """Admin-created item with a Thai name to exercise Unicode rendering."""
    resp = client.post(
        "/api/items",
        json={
            "name": "Oscilloscope ทดสอบ",
            "category": "Instrument",
            "total_quantity": 5,
        },
        headers=auth_header,
    )
    assert resp.status_code == 201
    return resp.json()


@pytest.fixture
def low_stock_item(client, auth_header):
    """Item whose available_quantity starts at/below its threshold."""
    resp = client.post(
        "/api/items",
        json={"name": "Multimeter สต็อกต่ำ", "category": "Instrument", "total_quantity": 1},
        headers=auth_header,
    )
    assert resp.status_code == 201
    return resp.json()


@pytest.fixture
def seeded_borrow(client, auth_header, seeded_item):
    resp = client.post(
        "/api/borrow", json={"item_id": seeded_item["id"], "quantity": 2},
        headers=auth_header,
    )
    assert resp.status_code == 201
    return resp.json()


@pytest.fixture
def late_return(client, auth_header, seeded_item):
    """A borrow returned after its due date — the damage-report incident."""
    due = datetime.now(timezone.utc) - timedelta(days=2)
    borrow = client.post(
        "/api/borrow",
        json={"item_id": seeded_item["id"], "quantity": 1, "due_date": due.isoformat()},
        headers=auth_header,
    )
    assert borrow.status_code == 201
    returned = client.post(
        "/api/return", json={"borrow_id": borrow.json()["id"]}, headers=auth_header
    )
    assert returned.status_code == 200
    return returned.json()


def _get_report(client, headers, report_type, fmt="csv", **params):
    return client.get(
        f"/api/reports/{report_type}",
        params={"format": fmt, **params},
        headers=headers,
    )


def _csv_rows(body: bytes) -> list[list[str]]:
    text = body.decode("utf-8-sig")
    return list(csv.reader(io.StringIO(text)))


def _flat_cells(body: bytes) -> list[str]:
    return [cell for row in _csv_rows(body) for cell in row]


# The cell each report is expected to contain once its trigger data is seeded.
EXPECTED_CELL = {
    "inventory": lambda seeded_item, **_: seeded_item["name"],
    "borrowing": lambda seeded_item, **_: seeded_item["name"],
    "usage": lambda seeded_item, **_: seeded_item["name"],
    "damage": lambda seeded_item, **_: seeded_item["name"],
    "maintenance": lambda low_stock_item, **_: low_stock_item["name"],
    "financial": lambda **_: "Instrument",
}


# ── Happy path: every report type × format ───────────────────────────────


@pytest.mark.parametrize("report_type", REPORT_TYPES)
@pytest.mark.parametrize("fmt", FORMATS)
def test_report_formats(
    client, auth_header, seeded_item, seeded_borrow,
    low_stock_item, late_return, report_type, fmt,
):
    resp = _get_report(client, auth_header, report_type, fmt)

    assert resp.status_code == 200
    assert resp.headers["content-type"].startswith(MEDIA_TYPES[fmt])
    disposition = resp.headers["content-disposition"]
    assert "attachment" in disposition and f"{report_type}-report-" in disposition
    assert len(resp.content) > 50

    if fmt in MAGIC:
        assert resp.content.startswith(MAGIC[fmt])
    if fmt == "csv":
        expected = EXPECTED_CELL[report_type](
            seeded_item=seeded_item, low_stock_item=low_stock_item
        )
        assert expected in _flat_cells(resp.content)


# ── Auth & validation ─────────────────────────────────────────────────────


def test_reports_require_auth(client, seeded_item):
    resp = _get_report(client, {}, "inventory")
    assert resp.status_code == 401


def test_invalid_report_type(client, auth_header):
    resp = _get_report(client, auth_header, "nonexistent")
    assert resp.status_code == 422
    assert "detail" in resp.json()


def test_invalid_format(client, auth_header):
    resp = _get_report(client, auth_header, "inventory", fmt="docx")
    assert resp.status_code == 422
    assert "detail" in resp.json()


# ── Content correctness ───────────────────────────────────────────────────


def test_borrowing_report_contains_record(client, auth_header, seeded_borrow, seeded_item):
    today = date.today()
    resp = _get_report(
        client, auth_header, "borrowing",
        start_date=today.isoformat(), end_date=today.isoformat(),
    )
    assert resp.status_code == 200
    rows = _csv_rows(resp.content)
    header_idx = rows.index([r for r in rows if "Borrower" in r][0])
    data_rows = rows[header_idx + 1:]
    assert any(
        row[2] == seeded_item["name"] and row[3] == "2" and row[4] == "borrowed"
        for row in data_rows
    )


def test_borrowing_report_excludes_out_of_period(client, auth_header, seeded_borrow):
    tomorrow = (date.today() + timedelta(days=1)).isoformat()
    resp = _get_report(
        client, auth_header, "borrowing",
        start_date=tomorrow, end_date=tomorrow,
    )
    assert resp.status_code == 200
    assert "Oscilloscope ทดสอบ" not in resp.content.decode("utf-8-sig")


def test_damage_report_lists_days_late(client, auth_header, late_return):
    resp = _get_report(client, auth_header, "damage")
    rows = _csv_rows(resp.content)
    data_rows = [row for row in rows if row and row[0].isdigit()]
    assert len(data_rows) == 1
    assert int(data_rows[0][6]) >= 1  # days late


def test_inventory_report_low_stock_flag(client, auth_header, seeded_item):
    resp = _get_report(client, auth_header, "inventory")
    rows = _csv_rows(resp.content)
    header_idx = rows.index([r for r in rows if "Stock Status" in r][0])
    data_rows = rows[header_idx + 1:]
    target = next(row for row in data_rows if row[1] == seeded_item["name"])
    # 5 total, 5 available, threshold 1 → OK
    assert target[4] == "5" and target[5] == "5" and target[7] == "OK"


def test_non_admin_sees_only_own_records(client, auth_header, user_auth_header, seeded_item):
    admin_borrow = client.post(
        "/api/borrow", json={"item_id": seeded_item["id"], "quantity": 1},
        headers=auth_header,
    )
    assert admin_borrow.status_code == 201
    user_borrow = client.post(
        "/api/borrow", json={"item_id": seeded_item["id"], "quantity": 1},
        headers=user_auth_header,
    )
    assert user_borrow.status_code == 201

    resp = _get_report(client, user_auth_header, "borrowing")
    rows = _csv_rows(resp.content)
    body = [row for row in rows if row and row[0].isdigit()]
    assert len(body) == 1
    assert body[0][0] == str(user_borrow.json()["id"])
