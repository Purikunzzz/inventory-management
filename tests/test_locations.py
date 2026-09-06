"""Tests for /api/locations/* endpoints."""

from fastapi import status


class TestLocationsCRUD:
    def test_create_location(self, client, auth_header):
        """Admin creates a location."""
        resp = client.post(
            "/api/locations",
            json={"name": "Cabinet A", "description": "Top shelf"},
            headers=auth_header,
        )
        assert resp.status_code == status.HTTP_201_CREATED
        data = resp.json()
        assert data["name"] == "Cabinet A"
        assert data["is_active"] is True

    def test_create_location_duplicate(self, client, auth_header):
        """Duplicate name → 409."""
        client.post("/api/locations", json={"name": "Cab B"}, headers=auth_header)
        resp = client.post(
            "/api/locations", json={"name": "Cab B"}, headers=auth_header
        )
        assert resp.status_code == status.HTTP_409_CONFLICT

    def test_create_location_forbidden(self, client, user_auth_header):
        """Regular user cannot create locations."""
        resp = client.post(
            "/api/locations",
            json={"name": "Secret Shelf"},
            headers=user_auth_header,
        )
        assert resp.status_code == status.HTTP_403_FORBIDDEN

    def test_list_locations(self, client, auth_header):
        """Should list all active locations."""
        client.post("/api/locations", json={"name": "Shelf 1"}, headers=auth_header)
        client.post("/api/locations", json={"name": "Shelf 2"}, headers=auth_header)
        resp = client.get("/api/locations", headers=auth_header)
        assert resp.status_code == status.HTTP_200_OK
        data = resp.json()
        names = {l["name"] for l in data}
        assert "Shelf 1" in names
        assert "Shelf 2" in names

    def test_get_location(self, client, auth_header):
        """Get a single location by id."""
        create = client.post(
            "/api/locations", json={"name": "Drawer"}, headers=auth_header
        )
        loc_id = create.json()["id"]
        resp = client.get(f"/api/locations/{loc_id}", headers=auth_header)
        assert resp.status_code == status.HTTP_200_OK
        assert resp.json()["name"] == "Drawer"

    def test_get_location_not_found(self, client, auth_header):
        resp = client.get("/api/locations/9999", headers=auth_header)
        assert resp.status_code == status.HTTP_404_NOT_FOUND

    def test_update_location(self, client, auth_header):
        """PATCH should update a location."""
        create = client.post(
            "/api/locations", json={"name": "Old Loc"}, headers=auth_header
        )
        loc_id = create.json()["id"]
        resp = client.patch(
            f"/api/locations/{loc_id}",
            json={"name": "New Loc", "description": "Updated"},
            headers=auth_header,
        )
        assert resp.status_code == status.HTTP_200_OK
        data = resp.json()
        assert data["name"] == "New Loc"
        assert data["description"] == "Updated"

    def test_update_location_duplicate_name(self, client, auth_header):
        """Renaming to an existing name → 409."""
        client.post("/api/locations", json={"name": "First"}, headers=auth_header)
        create2 = client.post(
            "/api/locations", json={"name": "Second"}, headers=auth_header
        )
        loc2_id = create2.json()["id"]
        resp = client.patch(
            f"/api/locations/{loc2_id}",
            json={"name": "First"},
            headers=auth_header,
        )
        assert resp.status_code == status.HTTP_409_CONFLICT

    def test_delete_location(self, client, auth_header):
        """DELETE should soft-delete (204)."""
        create = client.post(
            "/api/locations", json={"name": "Temp"}, headers=auth_header
        )
        loc_id = create.json()["id"]
        resp = client.delete(f"/api/locations/{loc_id}", headers=auth_header)
        assert resp.status_code == status.HTTP_204_NO_CONTENT

        # Should no longer appear in list
        resp2 = client.get("/api/locations", headers=auth_header)
        ids = [l["id"] for l in resp2.json()]
        assert loc_id not in ids
