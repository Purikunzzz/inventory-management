"""Tests for the auth rate limiter's client-IP resolution and 429 behaviour."""

from fastapi import status
from starlette.requests import Request

from app.config import settings
from app.core.rate_limit import client_ip


def _request(xff: str | None = None, peer: str = "10.0.0.1") -> Request:
    headers = [(b"x-forwarded-for", xff.encode())] if xff else []
    return Request({"type": "http", "headers": headers, "client": (peer, 1234)})


def test_uses_peer_without_forwarded_header(monkeypatch):
    monkeypatch.setattr(settings, "TRUSTED_PROXY_HOPS", 1)
    assert client_ip(_request()) == "10.0.0.1"


def test_uses_rightmost_entry_for_one_proxy(monkeypatch):
    """Client-supplied (spoofed) entries on the left are ignored."""
    monkeypatch.setattr(settings, "TRUSTED_PROXY_HOPS", 1)
    assert client_ip(_request("6.6.6.6, 203.0.113.7")) == "203.0.113.7"


def test_two_proxies(monkeypatch):
    monkeypatch.setattr(settings, "TRUSTED_PROXY_HOPS", 2)
    assert client_ip(_request("6.6.6.6, 203.0.113.7, 172.16.0.5")) == "203.0.113.7"


def test_zero_hops_ignores_header(monkeypatch):
    monkeypatch.setattr(settings, "TRUSTED_PROXY_HOPS", 0)
    assert client_ip(_request("203.0.113.7")) == "10.0.0.1"


def test_quota_is_per_client_not_shared(client, monkeypatch):
    """Behind a proxy, one user hitting the limit must not lock out everyone else."""
    monkeypatch.setattr(settings, "TRUSTED_PROXY_HOPS", 1)
    body = {"email": "nobody@test.com", "password": "wrong"}
    for _ in range(10):
        client.post("/api/auth/login", json=body, headers={"X-Forwarded-For": "1.1.1.1"})
    blocked = client.post("/api/auth/login", json=body, headers={"X-Forwarded-For": "1.1.1.1"})
    other = client.post("/api/auth/login", json=body, headers={"X-Forwarded-For": "2.2.2.2"})
    assert blocked.status_code == status.HTTP_429_TOO_MANY_REQUESTS
    assert other.status_code == status.HTTP_401_UNAUTHORIZED
