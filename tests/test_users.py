"""Tests for /api/users/* endpoints."""

from fastapi import status


class TestUsersCRUD:
    def test_create_user(self, client, auth_header):
        """Admin creates a new user."""
        resp = client.post(
            "/api/users",
            json={
                "email": "newuser@test.com",
                "password": "secret456",
                "full_name": "New User",
                "role": "user",
            },
            headers=auth_header,
        )
        assert resp.status_code == status.HTTP_201_CREATED
        data = resp.json()
        assert data["email"] == "newuser@test.com"
        assert data["full_name"] == "New User"
        assert data["is_active"] is True

    def test_create_user_duplicate(self, client, auth_header, admin_user):
        """Duplicate email → 409."""
        resp = client.post(
            "/api/users",
            json={
                "email": "admin@test.com",
                "password": "secret456",
            },
            headers=auth_header,
        )
        assert resp.status_code == status.HTTP_409_CONFLICT

    def test_create_user_forbidden(self, client, user_auth_header):
        """Regular user cannot create users."""
        resp = client.post(
            "/api/users",
            json={"email": "x@test.com", "password": "secret456"},
            headers=user_auth_header,
        )
        assert resp.status_code == status.HTTP_403_FORBIDDEN

    def test_list_users(self, client, auth_header):
        """Admin can list all users."""
        resp = client.get("/api/users", headers=auth_header)
        assert resp.status_code == status.HTTP_200_OK
        data = resp.json()
        assert isinstance(data, list)
        assert len(data) >= 1

    def test_list_users_forbidden(self, client, user_auth_header):
        """Regular user cannot list all users."""
        resp = client.get("/api/users", headers=user_auth_header)
        assert resp.status_code == status.HTTP_403_FORBIDDEN

    def test_get_own_profile(self, client, user_auth_header, normal_user):
        """User can view their own profile."""
        resp = client.get(f"/api/users/{normal_user.id}", headers=user_auth_header)
        assert resp.status_code == status.HTTP_200_OK
        assert resp.json()["email"] == "user@test.com"

    def test_get_other_profile_forbidden(self, client, user_auth_header, admin_user):
        """Regular user cannot view another user's profile."""
        resp = client.get(f"/api/users/{admin_user.id}", headers=user_auth_header)
        assert resp.status_code == status.HTTP_403_FORBIDDEN

    def test_update_user(self, client, auth_header, normal_user):
        """Admin can update a user's details."""
        resp = client.patch(
            f"/api/users/{normal_user.id}",
            json={"full_name": "Updated Name"},
            headers=auth_header,
        )
        assert resp.status_code == status.HTTP_200_OK
        assert resp.json()["full_name"] == "Updated Name"

    def test_update_user_email_duplicate(self, client, auth_header, admin_user):
        """Updating to an existing email → 409."""
        # Create another user to conflict against.
        other = client.post(
            "/api/users",
            json={"email": "other@test.com", "password": "secret123"},
            headers=auth_header,
        )
        assert other.status_code == status.HTTP_201_CREATED
        other_id = other.json()["id"]

        resp = client.patch(
            f"/api/users/{other_id}",
            json={"email": "admin@test.com"},
            headers=auth_header,
        )
        assert resp.status_code == status.HTTP_409_CONFLICT

    def test_delete_user(self, client, auth_header, normal_user):
        """Admin can deactivate a user (soft delete)."""
        resp = client.delete(
            f"/api/users/{normal_user.id}", headers=auth_header
        )
        assert resp.status_code == status.HTTP_204_NO_CONTENT

        # Should still exist but be inactive
        get_resp = client.get(
            f"/api/users/{normal_user.id}", headers=auth_header
        )
        assert get_resp.json()["is_active"] is False
