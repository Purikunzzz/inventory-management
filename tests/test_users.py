"""Tests for /api/users/* endpoints."""

from fastapi import status

from app.models.user import UserRoleEnum


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

    def test_deactivated_user_hidden_by_default_but_visible_with_include_inactive(
        self, client, auth_header, normal_user
    ):
        """Regression: a disabled user must not vanish from /api/users forever —
        the admin panel needs `include_inactive=true` to find and re-enable them."""
        client.delete(f"/api/users/{normal_user.id}", headers=auth_header)

        default_resp = client.get("/api/users", headers=auth_header)
        assert normal_user.id not in [u["id"] for u in default_resp.json()]

        full_resp = client.get(
            "/api/users?include_inactive=true", headers=auth_header
        )
        ids = [u["id"] for u in full_resp.json()]
        assert normal_user.id in ids


class TestChangeOwnPassword:
    URL = "/api/users/me/password"

    def _login(self, client, password: str) -> int:
        return client.post(
            "/api/auth/login", json={"email": "user@test.com", "password": password}
        ).status_code

    def test_user_changes_own_password(self, client, user_auth_header, normal_user):
        """Regular user (non-admin) can change their password with the correct current one."""
        resp = client.patch(
            self.URL,
            json={"current_password": "secret123", "new_password": "newpass789"},
            headers=user_auth_header,
        )
        assert resp.status_code == status.HTTP_200_OK
        assert resp.json()["auth_provider"] == "email"
        assert self._login(client, "newpass789") == status.HTTP_200_OK
        assert self._login(client, "secret123") == status.HTTP_401_UNAUTHORIZED

    def test_wrong_current_password_is_400_not_401(self, client, user_auth_header, normal_user):
        """401 would make the frontend log the user out, so a wrong password must be 400."""
        resp = client.patch(
            self.URL,
            json={"current_password": "wrong", "new_password": "newpass789"},
            headers=user_auth_header,
        )
        assert resp.status_code == status.HTTP_400_BAD_REQUEST
        assert self._login(client, "secret123") == status.HTTP_200_OK

    def test_google_account_cannot_change_password(self, client, user_auth_header, normal_user, db):
        normal_user.password = None
        normal_user.auth_provider = "google"
        db.commit()
        resp = client.patch(
            self.URL,
            json={"current_password": "x", "new_password": "newpass789"},
            headers=user_auth_header,
        )
        assert resp.status_code == status.HTTP_400_BAD_REQUEST

    def test_short_new_password_rejected(self, client, user_auth_header, normal_user):
        resp = client.patch(
            self.URL,
            json={"current_password": "secret123", "new_password": "short"},
            headers=user_auth_header,
        )
        assert resp.status_code == 422

    def test_update_me_null_name_does_not_erase_name(self, client, user_auth_header, normal_user):
        resp = client.patch("/api/users/me", json={"full_name": None}, headers=user_auth_header)
        assert resp.status_code == status.HTTP_200_OK
        assert resp.json()["full_name"] == "Test user"


class TestAdminSelfLockout:
    """An admin must not be able to lock themselves out of the admin console."""

    def test_admin_cannot_demote_self(self, client, auth_header, admin_user):
        resp = client.patch(
            f"/api/users/{admin_user.id}", json={"role": "user"}, headers=auth_header
        )
        assert resp.status_code == status.HTTP_400_BAD_REQUEST
        assert "admin role" in resp.json()["detail"]

    def test_admin_cannot_deactivate_self(self, client, auth_header, admin_user):
        resp = client.patch(
            f"/api/users/{admin_user.id}", json={"is_active": False}, headers=auth_header
        )
        assert resp.status_code == status.HTTP_400_BAD_REQUEST

    def test_admin_cannot_delete_self(self, client, auth_header, admin_user):
        resp = client.delete(f"/api/users/{admin_user.id}", headers=auth_header)
        assert resp.status_code == status.HTTP_400_BAD_REQUEST
        still = client.get(f"/api/users/{admin_user.id}", headers=auth_header)
        assert still.json()["is_active"] is True

    def test_admin_can_still_edit_own_name_and_keep_role(self, client, auth_header, admin_user):
        resp = client.patch(
            f"/api/users/{admin_user.id}",
            json={"full_name": "New Name", "role": "admin", "is_active": True},
            headers=auth_header,
        )
        assert resp.status_code == status.HTTP_200_OK
        assert resp.json()["full_name"] == "New Name"

    def test_admin_can_demote_other_user(self, client, auth_header, db):
        from tests.conftest import _create_user
        other = _create_user(db, "other-admin@test.com", role=UserRoleEnum.admin)
        resp = client.patch(
            f"/api/users/{other.id}", json={"role": "user"}, headers=auth_header
        )
        assert resp.status_code == status.HTTP_200_OK
        assert resp.json()["role"] == "user"
