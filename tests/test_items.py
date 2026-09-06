"""Tests for /api/items/* endpoints."""

from fastapi import status


class TestItemsCRUD:
    def test_create_item(self, client, auth_header):
        """Admin should be able to create an item."""
        resp = client.post(
            "/api/items",
            json={
                "name": "Oscilloscope",
                "description": "Digital oscilloscope",
                "category": "Electronics",
                "total_quantity": 5,
                "low_stock_threshold": 1,
            },
            headers=auth_header,
        )
        assert resp.status_code == status.HTTP_201_CREATED
        data = resp.json()
        assert data["name"] == "Oscilloscope"
        assert data["total_quantity"] == 5
        assert data["available_quantity"] == 5  # mirrors total at creation
        assert data["is_active"] is True

    def test_create_item_forbidden(self, client, user_auth_header):
        """Regular user should not be able to create items."""
        resp = client.post(
            "/api/items",
            json={"name": "Foo", "total_quantity": 1},
            headers=user_auth_header,
        )
        assert resp.status_code == status.HTTP_403_FORBIDDEN

    def test_create_item_unauthenticated(self, client):
        """No token → 401."""
        resp = client.post(
            "/api/items",
            json={"name": "Foo", "total_quantity": 1},
        )
        assert resp.status_code == status.HTTP_401_UNAUTHORIZED

    def test_list_items(self, client, auth_header):
        """Should list items (with the one created above visible)."""
        # Create an item first
        client.post(
            "/api/items",
            json={"name": "Pico", "total_quantity": 3},
            headers=auth_header,
        )
        resp = client.get("/api/items", headers=auth_header)
        assert resp.status_code == status.HTTP_200_OK
        data = resp.json()
        assert isinstance(data, list)
        assert any(i["name"] == "Pico" for i in data)

    def test_get_item(self, client, auth_header):
        """Should return a single item by id."""
        create = client.post(
            "/api/items",
            json={"name": "Signal Generator", "total_quantity": 2},
            headers=auth_header,
        )
        item_id = create.json()["id"]
        resp = client.get(f"/api/items/{item_id}", headers=auth_header)
        assert resp.status_code == status.HTTP_200_OK
        assert resp.json()["name"] == "Signal Generator"

    def test_get_item_not_found(self, client, auth_header):
        """Non-existent item → 404."""
        resp = client.get("/api/items/9999", headers=auth_header)
        assert resp.status_code == status.HTTP_404_NOT_FOUND

    def test_update_item(self, client, auth_header):
        """PATCH should partially update an item."""
        create = client.post(
            "/api/items",
            json={"name": "Old Name", "total_quantity": 10},
            headers=auth_header,
        )
        item_id = create.json()["id"]
        resp = client.patch(
            f"/api/items/{item_id}",
            json={"name": "New Name"},
            headers=auth_header,
        )
        assert resp.status_code == status.HTTP_200_OK
        data = resp.json()
        assert data["name"] == "New Name"
        assert data["total_quantity"] == 10  # unchanged

    def test_update_item_total_quantity_shifts_available(self, client, auth_header):
        """Increasing total should increase available by the same delta."""
        create = client.post(
            "/api/items",
            json={"name": "Test Qty", "total_quantity": 5},
            headers=auth_header,
        )
        item_id = create.json()["id"]
        resp = client.patch(
            f"/api/items/{item_id}",
            json={"total_quantity": 8},
            headers=auth_header,
        )
        assert resp.status_code == status.HTTP_200_OK
        data = resp.json()
        assert data["total_quantity"] == 8
        assert data["available_quantity"] == 8  # 5 + (8-5)

    def test_delete_item(self, client, auth_header):
        """DELETE should soft-delete (204)."""
        create = client.post(
            "/api/items",
            json={"name": "To Delete", "total_quantity": 1},
            headers=auth_header,
        )
        item_id = create.json()["id"]
        resp = client.delete(f"/api/items/{item_id}", headers=auth_header)
        assert resp.status_code == status.HTTP_204_NO_CONTENT

        # Should no longer appear in list
        resp2 = client.get("/api/items", headers=auth_header)
        ids = [i["id"] for i in resp2.json()]
        assert item_id not in ids
