"""Tests for the co-borrowing recommendations."""

from fastapi import status


def _item(client, headers, name, qty=5):
    return client.post(
        "/api/items", json={"name": name, "total_quantity": qty}, headers=headers
    ).json()["id"]


def _borrow(client, headers, item_id, approve_with=None):
    rid = client.post(
        "/api/borrow", json={"item_id": item_id, "quantity": 1}, headers=headers
    ).json()["id"]
    if approve_with:
        client.post(f"/api/borrow/{rid}/approve", headers=approve_with)
    return rid


class TestRecommendations:
    def test_co_borrowing(self, client, auth_header, user_auth_header):
        a, b, c = (_item(client, auth_header, n) for n in ("A", "B", "C"))
        for headers, approve in ((auth_header, None), (user_auth_header, auth_header)):
            _borrow(client, headers, a, approve)
            _borrow(client, headers, b, approve)
        _borrow(client, auth_header, c)  # only one user borrowed C, alongside A and B
        recs = client.get("/api/stats/recommendations", headers=auth_header).json()
        rec_a = next(r for r in recs if r["item_name"] == "A")
        assert rec_a["related_items"][0]["name"] in {"B", "C"}
        assert rec_a["related_items"][0]["name"] == "B"  # 2 shared users beats C's 1
        assert rec_a["confidence"] == 1.0

    def test_pending_requests_do_not_count(self, client, auth_header, user_auth_header):
        a, b = (_item(client, auth_header, n) for n in ("A", "B"))
        _borrow(client, user_auth_header, a)  # stays pending
        _borrow(client, user_auth_header, b)  # stays pending
        assert client.get("/api/stats/recommendations", headers=auth_header).json() == []

    def test_empty_without_history(self, client, auth_header):
        assert client.get("/api/stats/recommendations", headers=auth_header).json() == []
