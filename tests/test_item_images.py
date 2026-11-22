"""Tests for POST /api/items/{id}/image (Cloudinary upload is mocked)."""
import hashlib

import pytest
from fastapi import status

from app.config import settings
from app.services import image_storage

PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 64
JPEG = b"\xff\xd8\xff\xe0" + b"\x00" * 64


class _FakeResponse:
    def __init__(self, ok: bool = True, url: str = "https://res.cloudinary.com/demo/v2/item.png"):
        self.ok = ok
        self._url = url

    def json(self) -> dict:
        return {"secure_url": self._url}


@pytest.fixture
def cloudinary(monkeypatch):
    """Configure fake credentials and capture the outgoing upload request."""
    monkeypatch.setattr(settings, "CLOUDINARY_URL", "cloudinary://key123:secret456@democloud")
    calls: list[dict] = []

    def fake_post(url, data=None, files=None, timeout=None):
        calls.append({"url": url, "data": data, "files": files})
        return _FakeResponse()

    monkeypatch.setattr(image_storage.requests, "post", fake_post)
    return calls


def _make_item(client, auth_header) -> int:
    resp = client.post("/api/items", json={"name": "Scope", "total_quantity": 1}, headers=auth_header)
    return resp.json()["id"]


def _upload(client, item_id, headers, data=PNG, name="photo.png"):
    return client.post(
        f"/api/items/{item_id}/image",
        files={"file": (name, data, "image/png")},
        headers=headers,
    )


def test_admin_upload_sets_image_url(client, auth_header, cloudinary):
    item_id = _make_item(client, auth_header)
    resp = _upload(client, item_id, auth_header)
    assert resp.status_code == status.HTTP_200_OK
    assert resp.json()["image_url"] == "https://res.cloudinary.com/demo/v2/item.png"
    # Persisted, not just echoed.
    assert client.get(f"/api/items/{item_id}", headers=auth_header).json()["image_url"].endswith("item.png")

    sent = cloudinary[0]
    assert sent["url"] == "https://api.cloudinary.com/v1_1/democloud/image/upload"
    assert sent["data"]["public_id"] == f"item-{item_id}"
    assert sent["data"]["api_key"] == "key123"
    signed = {k: v for k, v in sent["data"].items() if k not in ("api_key", "signature")}
    expected = "&".join(f"{k}={signed[k]}" for k in sorted(signed)) + "secret456"
    assert sent["data"]["signature"] == hashlib.sha1(expected.encode()).hexdigest()


def test_non_admin_cannot_upload(client, auth_header, user_auth_header, cloudinary):
    item_id = _make_item(client, auth_header)
    assert _upload(client, item_id, user_auth_header).status_code == status.HTTP_403_FORBIDDEN
    assert cloudinary == []


def test_rejects_non_image_even_with_image_name(client, auth_header, cloudinary):
    item_id = _make_item(client, auth_header)
    resp = _upload(client, item_id, auth_header, data=b"<html>not an image</html>", name="evil.png")
    assert resp.status_code == status.HTTP_400_BAD_REQUEST
    assert cloudinary == []


def test_rejects_oversize_file(client, auth_header, cloudinary):
    item_id = _make_item(client, auth_header)
    big = JPEG + b"\x00" * image_storage.MAX_IMAGE_BYTES
    resp = _upload(client, item_id, auth_header, data=big, name="big.jpg")
    assert resp.status_code == 413
    assert cloudinary == []


def test_missing_item_404(client, auth_header, cloudinary):
    assert _upload(client, 99999, auth_header).status_code == status.HTTP_404_NOT_FOUND


def test_not_configured_returns_503(client, auth_header, monkeypatch):
    monkeypatch.setattr(settings, "CLOUDINARY_URL", "")
    item_id = _make_item(client, auth_header)
    resp = _upload(client, item_id, auth_header)
    assert resp.status_code == status.HTTP_503_SERVICE_UNAVAILABLE
    assert "CLOUDINARY_URL" in resp.json()["detail"]


def test_cloudinary_error_returns_502_and_keeps_old_url(client, auth_header, monkeypatch):
    monkeypatch.setattr(settings, "CLOUDINARY_URL", "cloudinary://k:s@c")
    monkeypatch.setattr(image_storage.requests, "post", lambda *a, **kw: _FakeResponse(ok=False))
    item_id = _make_item(client, auth_header)
    resp = _upload(client, item_id, auth_header)
    assert resp.status_code == status.HTTP_502_BAD_GATEWAY
    assert client.get(f"/api/items/{item_id}", headers=auth_header).json()["image_url"] is None
