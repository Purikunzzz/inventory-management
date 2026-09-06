"""Tests for /api/auth/* endpoints."""

from fastapi import status


class TestLogin:
    def test_login_success(self, client, db, admin_user):
        """Should return token + user on valid credentials."""
        resp = client.post(
            "/api/auth/login",
            json={"email": "admin@test.com", "password": "secret123"},
        )
        assert resp.status_code == status.HTTP_200_OK
        data = resp.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"
        assert data["user"]["email"] == "admin@test.com"

    def test_login_wrong_password(self, client, db, admin_user):
        """Should return 401 on wrong password."""
        resp = client.post(
            "/api/auth/login",
            json={"email": "admin@test.com", "password": "wrong"},
        )
        assert resp.status_code == status.HTTP_401_UNAUTHORIZED

    def test_login_nonexistent_email(self, client):
        """Should return 401 for unknown email."""
        resp = client.post(
            "/api/auth/login",
            json={"email": "nobody@test.com", "password": "secret123"},
        )
        assert resp.status_code == status.HTTP_401_UNAUTHORIZED


class TestTokenOAuth:
    def test_token_form(self, client, db, admin_user):
        """OAuth2 password flow should return a bearer token."""
        resp = client.post(
            "/api/auth/token",
            data={"username": "admin@test.com", "password": "secret123"},
        )
        assert resp.status_code == status.HTTP_200_OK
        data = resp.json()
        assert data["token_type"] == "bearer"
        assert "access_token" in data
