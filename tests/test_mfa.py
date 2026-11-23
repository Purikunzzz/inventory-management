"""Admin two-factor sign-in (TOTP + backup codes)."""

from fastapi import status

from app.core import totp
from app.core.security import create_access_token, create_mfa_token
from app.services import mfa_service

ADMIN_LOGIN = {"email": "admin@test.com", "password": "secret123"}


def _mfa_token(client) -> str:
    return client.post("/api/auth/login", json=ADMIN_LOGIN).json()["mfa_token"]


def _code(secret: str, offset: int = 0) -> str:
    return totp.code_at(secret, totp.current_step() + offset)


def _enroll(client) -> tuple[str, list[str]]:
    """Set up 2FA for admin@test.com; returns (secret, backup_codes)."""
    token = _mfa_token(client)
    secret = client.post("/api/auth/mfa/setup", json={"mfa_token": token}).json()["secret"]
    resp = client.post("/api/auth/mfa/enable", json={"mfa_token": token, "code": _code(secret)})
    assert resp.status_code == status.HTTP_200_OK, resp.text
    return secret, resp.json()["backup_codes"]


class TestTotp:
    def test_rfc6238_vector(self):
        # RFC 6238 appendix B, SHA-1, T=59 → 94287082 (last 6 digits: 287082).
        secret = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ"  # base32("12345678901234567890")
        assert totp.code_at(secret, 59 // 30) == "287082"

    def test_matching_step_allows_one_step_drift(self):
        secret = totp.generate_secret()
        assert totp.matching_step(secret, _code(secret, -1)) is not None
        assert totp.matching_step(secret, _code(secret, 5)) is None
        assert totp.matching_step(secret, "abc") is None


class TestEnrollment:
    def test_first_login_enrolls_and_returns_session(self, client, admin_user):
        token = _mfa_token(client)
        setup = client.post("/api/auth/mfa/setup", json={"mfa_token": token}).json()
        assert setup["otpauth_uri"].startswith("otpauth://totp/")
        resp = client.post(
            "/api/auth/mfa/enable", json={"mfa_token": token, "code": _code(setup["secret"])}
        )
        data = resp.json()
        assert len(data["backup_codes"]) == mfa_service.BACKUP_CODE_COUNT
        headers = {"Authorization": f"Bearer {data['access_token']}"}
        assert client.get("/api/users", headers=headers).status_code == status.HTTP_200_OK

    def test_wrong_code_does_not_enable(self, client, admin_user):
        token = _mfa_token(client)
        client.post("/api/auth/mfa/setup", json={"mfa_token": token})
        resp = client.post("/api/auth/mfa/enable", json={"mfa_token": token, "code": "000000"})
        assert resp.status_code == status.HTTP_400_BAD_REQUEST
        assert client.post("/api/auth/login", json=ADMIN_LOGIN).json()["mfa_setup_required"]

    def test_setup_refused_once_enabled(self, client, admin_user):
        _enroll(client)
        token = _mfa_token(client)
        resp = client.post("/api/auth/mfa/setup", json={"mfa_token": token})
        assert resp.status_code == status.HTTP_409_CONFLICT


class TestVerify:
    def test_totp_code_signs_in(self, client, admin_user):
        secret, _ = _enroll(client)
        token = _mfa_token(client)
        assert client.post("/api/auth/login", json=ADMIN_LOGIN).json()["mfa_setup_required"] is False
        resp = client.post("/api/auth/mfa/verify", json={"mfa_token": token, "code": _code(secret, 1)})
        assert resp.status_code == status.HTTP_200_OK
        assert resp.json()["access_token"]

    def test_same_totp_code_cannot_be_replayed(self, client, admin_user):
        secret, _ = _enroll(client)  # used the current step
        resp = client.post(
            "/api/auth/mfa/verify", json={"mfa_token": _mfa_token(client), "code": _code(secret)}
        )
        assert resp.status_code == status.HTTP_400_BAD_REQUEST

    def test_backup_code_works_once(self, client, admin_user):
        _, codes = _enroll(client)
        body = {"mfa_token": _mfa_token(client), "code": codes[0].upper()}
        assert client.post("/api/auth/mfa/verify", json=body).status_code == status.HTTP_200_OK
        assert client.post("/api/auth/mfa/verify", json=body).status_code == status.HTTP_400_BAD_REQUEST

    def test_locks_after_repeated_wrong_codes(self, client, admin_user):
        secret, _ = _enroll(client)
        token = _mfa_token(client)
        for _ in range(mfa_service.MAX_FAILURES):
            client.post("/api/auth/mfa/verify", json={"mfa_token": token, "code": "000000"})
        resp = client.post("/api/auth/mfa/verify", json={"mfa_token": token, "code": _code(secret, 1)})
        assert resp.status_code == status.HTTP_429_TOO_MANY_REQUESTS

    def test_verify_without_enrollment_is_409(self, client, admin_user):
        resp = client.post("/api/auth/mfa/verify", json={"mfa_token": _mfa_token(client), "code": "123456"})
        assert resp.status_code == status.HTTP_409_CONFLICT


class TestTokens:
    def test_mfa_token_is_not_a_session(self, client, admin_user):
        headers = {"Authorization": f"Bearer {create_mfa_token(admin_user.id)}"}
        assert client.get("/api/items", headers=headers).status_code == status.HTTP_401_UNAUTHORIZED

    def test_access_token_is_not_an_mfa_token(self, client, admin_user, admin_token):
        resp = client.post("/api/auth/mfa/setup", json={"mfa_token": admin_token})
        assert resp.status_code == status.HTTP_401_UNAUTHORIZED

    def test_admin_token_without_mfa_claim_rejected(self, client, admin_user):
        old = create_access_token(data={"sub": str(admin_user.id), "role": "admin"})
        resp = client.get("/api/items", headers={"Authorization": f"Bearer {old}"})
        assert resp.status_code == status.HTTP_401_UNAUTHORIZED

    def test_non_admin_cannot_use_mfa_endpoints(self, client, normal_user):
        token = create_mfa_token(normal_user.id)
        resp = client.post("/api/auth/mfa/setup", json={"mfa_token": token})
        assert resp.status_code == status.HTTP_401_UNAUTHORIZED


class TestSettings:
    def test_status_and_regenerate_backup_codes(self, client, admin_user):
        secret, old_codes = _enroll(client)
        resp = client.post(
            "/api/auth/mfa/verify", json={"mfa_token": _mfa_token(client), "code": old_codes[0]}
        )
        headers = {"Authorization": f"Bearer {resp.json()['access_token']}"}
        status_resp = client.get("/api/users/me/mfa", headers=headers).json()
        assert status_resp == {"enabled": True, "backup_codes_remaining": 9}

        new = client.post(
            "/api/users/me/mfa/backup-codes", json={"code": _code(secret, 1)}, headers=headers
        )
        assert new.status_code == status.HTTP_200_OK
        body = {"mfa_token": _mfa_token(client), "code": old_codes[1]}
        assert client.post("/api/auth/mfa/verify", json=body).status_code == status.HTTP_400_BAD_REQUEST
