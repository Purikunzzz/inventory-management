"""Simple in-memory rate limiter for auth endpoints.

Fixed-window counter keyed by client IP. Not suitable for multi-process
deployments — use Redis-backed limiting if the app is scaled out.
"""

import time
from typing import Dict, Tuple

from fastapi import HTTPException, Request, status

from app.config import settings

# ip -> (count, window_start_ts)
_WINDOW: Dict[str, Tuple[int, float]] = {}

_MAX_ATTEMPTS = 10
_WINDOW_SECS = 60  # 10 attempts per 60 seconds per IP
_PRUNE_AT = 1000  # drop expired entries once the dict grows past this


def client_ip(request: Request) -> str:
    """Real client IP behind `TRUSTED_PROXY_HOPS` proxies.

    Each trusted proxy appends the address it received the request from to
    X-Forwarded-For, so the client is the Nth entry from the right. Entries
    further left are client-controlled and therefore ignored (anti-spoofing).
    """
    peer = request.client.host if request.client else "unknown"
    hops = settings.TRUSTED_PROXY_HOPS
    forwarded = request.headers.get("x-forwarded-for")
    if hops <= 0 or not forwarded:
        return peer
    chain = [part.strip() for part in forwarded.split(",") if part.strip()]
    return chain[-hops] if len(chain) >= hops else chain[0]


def _prune(now: float) -> None:
    for ip, (_, start) in list(_WINDOW.items()):
        if now - start > _WINDOW_SECS:
            del _WINDOW[ip]


def reset() -> None:
    """Clear all counters (used by tests)."""
    _WINDOW.clear()


def _rate_limit(request: Request) -> None:
    """Raise 429 if the client has exceeded the rate limit."""
    now = time.monotonic()
    if len(_WINDOW) > _PRUNE_AT:
        _prune(now)
    ip = client_ip(request)
    count, start = _WINDOW.get(ip, (0, now))

    # Reset window if expired.
    if now - start > _WINDOW_SECS:
        count, start = 0, now

    if count >= _MAX_ATTEMPTS:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many requests. Please try again later.",
        )

    _WINDOW[ip] = (count + 1, start)
