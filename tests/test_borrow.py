"""Tests for /api/borrow, /api/return, /api/transactions endpoints."""

import pytest
from fastapi import status


class TestBorrowFlow:
    @pytest.fixture(autouse=True)
    def setup(self, client, auth_header, user_auth_header, normal_user):
        self.client = client
        self.admin_h = auth_header
        self.user_h = user_auth_header
        self.user = normal_user

        # Create an item with available stock
        resp = client.post(
            "/api/items",
            json={"name": "Borrowable Item", "total_quantity": 5},
            headers=auth_header,
        )
        self.item_id = resp.json()["id"]

    def test_borrow_item(self):
        """User can borrow an item, reducing available_quantity."""
        resp = self.client.post(
            "/api/borrow",
            json={"item_id": self.item_id, "quantity": 2},
            headers=self.user_h,
        )
        assert resp.status_code == status.HTTP_201_CREATED
        data = resp.json()
        assert data["item_id"] == self.item_id
        assert data["quantity"] == 2
        assert data["status"] == "borrowed"

        # Check available quantity decreased
        item = self.client.get(
            f"/api/items/{self.item_id}", headers=self.user_h
        ).json()
        assert item["available_quantity"] == 3  # 5 - 2

    def test_borrow_insufficient_stock(self):
        """Borrowing beyond available → 409."""
        resp = self.client.post(
            "/api/borrow",
            json={"item_id": self.item_id, "quantity": 99},
            headers=self.user_h,
        )
        assert resp.status_code == status.HTTP_409_CONFLICT

    def test_borrow_unauthenticated(self):
        resp = self.client.post(
            "/api/borrow",
            json={"item_id": self.item_id, "quantity": 1},
        )
        assert resp.status_code == status.HTTP_401_UNAUTHORIZED

    def test_return_item(self):
        """Returning should increase available quantity and set status to returned."""
        # Borrow first
        borrow = self.client.post(
            "/api/borrow",
            json={"item_id": self.item_id, "quantity": 1},
            headers=self.user_h,
        )
        record_id = borrow.json()["id"]

        resp = self.client.post(
            "/api/return",
            json={"borrow_id": record_id},
            headers=self.user_h,
        )
        assert resp.status_code == status.HTTP_200_OK
        data = resp.json()
        assert data["status"] == "returned"
        assert data["returned_at"] is not None

        # Available should be back to 5
        item = self.client.get(
            f"/api/items/{self.item_id}", headers=self.user_h
        ).json()
        assert item["available_quantity"] == 5

    def test_return_already_returned(self):
        """Returning an already-returned record → 409."""
        borrow = self.client.post(
            "/api/borrow",
            json={"item_id": self.item_id, "quantity": 1},
            headers=self.user_h,
        )
        record_id = borrow.json()["id"]
        self.client.post(
            "/api/return", json={"borrow_id": record_id}, headers=self.user_h
        )
        resp = self.client.post(
            "/api/return", json={"borrow_id": record_id}, headers=self.user_h
        )
        assert resp.status_code == status.HTTP_409_CONFLICT

    def test_list_transactions(self):
        """Should list borrow records (admin sees all, user sees own)."""
        self.client.post(
            "/api/borrow",
            json={"item_id": self.item_id, "quantity": 1},
            headers=self.user_h,
        )
        resp = self.client.get("/api/transactions", headers=self.admin_h)
        assert resp.status_code == status.HTTP_200_OK
        data = resp.json()
        assert isinstance(data, list)
        assert len(data) >= 1
        assert data[0]["item_id"] == self.item_id
