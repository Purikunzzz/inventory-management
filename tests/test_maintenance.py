"""Tests for /api/maintenance/* endpoints."""

import pytest
from fastapi import status

URL = "/api/maintenance"


@pytest.fixture
def item(client, auth_header) -> dict:
    resp = client.post(
        "/api/items", json={"name": "Oscilloscope", "total_quantity": 3}, headers=auth_header
    )
    assert resp.status_code == 201
    return resp.json()


@pytest.fixture
def record(client, auth_header, item, normal_user) -> dict:
    resp = client.post(
        URL,
        json={
            "item_id": item["id"],
            "type": "calibration",
            "scheduled_date": "2026-12-01",
            "technician_id": normal_user.id,
            "cost": 1500.5,
            "notes": "Annual calibration",
        },
        headers=auth_header,
    )
    assert resp.status_code == status.HTTP_201_CREATED
    return resp.json()


def test_create_returns_names(record, item):
    assert record["status"] == "scheduled"
    assert record["item_name"] == item["name"]
    assert record["technician_name"] == "Test user"
    assert record["cost"] == 1500.5


def test_user_can_view_but_not_create(client, user_auth_header, record, item):
    assert client.get(URL, headers=user_auth_header).status_code == status.HTTP_200_OK
    resp = client.post(
        URL,
        json={"item_id": item["id"], "type": "repair", "scheduled_date": "2026-12-01"},
        headers=user_auth_header,
    )
    assert resp.status_code == status.HTTP_403_FORBIDDEN
    patch = client.patch(f"{URL}/{record['id']}", json={"status": "completed"}, headers=user_auth_header)
    assert patch.status_code == status.HTTP_403_FORBIDDEN


def test_unknown_item_or_technician_404(client, auth_header, item):
    base = {"type": "repair", "scheduled_date": "2026-12-01"}
    bad_item = client.post(URL, json={**base, "item_id": 9999}, headers=auth_header)
    bad_tech = client.post(
        URL, json={**base, "item_id": item["id"], "technician_id": 9999}, headers=auth_header
    )
    assert bad_item.status_code == status.HTTP_404_NOT_FOUND
    assert bad_tech.status_code == status.HTTP_404_NOT_FOUND


def test_negative_cost_rejected(client, auth_header, item):
    resp = client.post(
        URL,
        json={"item_id": item["id"], "type": "repair", "scheduled_date": "2026-12-01", "cost": -1},
        headers=auth_header,
    )
    assert resp.status_code == 422


def test_complete_sets_completed_at_and_is_final(client, auth_header, record):
    url = f"{URL}/{record['id']}"
    started = client.patch(url, json={"status": "in_progress"}, headers=auth_header)
    assert started.json()["completed_at"] is None
    done = client.patch(url, json={"status": "completed", "cost": 200}, headers=auth_header)
    assert done.status_code == status.HTTP_200_OK
    assert done.json()["completed_at"] is not None
    assert done.json()["cost"] == 200
    reopen = client.patch(url, json={"status": "scheduled"}, headers=auth_header)
    assert reopen.status_code == status.HTTP_409_CONFLICT
    # Editing notes on a closed record is still allowed.
    notes = client.patch(url, json={"notes": "Passed"}, headers=auth_header)
    assert notes.status_code == status.HTTP_200_OK


def test_filter_by_status_and_item(client, auth_header, record, item):
    client.post(
        URL, json={"item_id": item["id"], "type": "repair", "scheduled_date": "2026-11-01"},
        headers=auth_header,
    )
    client.patch(f"{URL}/{record['id']}", json={"status": "completed"}, headers=auth_header)
    completed = client.get(f"{URL}?status_filter=completed", headers=auth_header).json()
    assert [r["id"] for r in completed] == [record["id"]]
    by_item = client.get(f"{URL}?item_id={item['id']}", headers=auth_header).json()
    assert len(by_item) == 2


def test_soft_delete(client, auth_header, record, db):
    from app.models.maintenance import MaintenanceRecord

    resp = client.delete(f"{URL}/{record['id']}", headers=auth_header)
    assert resp.status_code == status.HTTP_204_NO_CONTENT
    assert client.get(f"{URL}/{record['id']}", headers=auth_header).status_code == 404
    row = db.get(MaintenanceRecord, record["id"])
    assert row is not None and row.is_active is False


def test_user_can_report_issue(client, user_auth_header, item):
    """Report Issue: any user opens a scheduled repair for today, tagged with the reporter."""
    resp = client.post(
        "/api/maintenance/report",
        json={"item_id": item["id"], "notes": "  Screen flickers  "},
        headers=user_auth_header,
    )
    assert resp.status_code == status.HTTP_201_CREATED
    data = resp.json()
    assert data["type"] == "repair"
    assert data["status"] == "scheduled"
    assert data["notes"] == "Screen flickers"
    assert data["reported_by"] == "Test user"


def test_admin_created_record_has_no_reporter(record):
    assert record["reported_by"] is None


def test_report_issue_validation(client, user_auth_header, item):
    empty = client.post(
        "/api/maintenance/report", json={"item_id": item["id"], "notes": "   "}, headers=user_auth_header
    )
    assert empty.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
    missing = client.post(
        "/api/maintenance/report", json={"item_id": 99999, "notes": "broken"}, headers=user_auth_header
    )
    assert missing.status_code == status.HTTP_404_NOT_FOUND
