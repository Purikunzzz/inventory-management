"""Simple in-memory rate limiter for auth endpoints.

Uses a sliding-window approach keyed by client IP. Not suitable for
multi-process deployments — use Redis-backed limiting in production.
"""

from collections import defaultdict
import time
from typing import Dict, Tuple

from fastapi import HTTPException, Request, status


# (count, window_start_ts)
_WINDOW: Dict[str, Tuple[int, float]] = defaultdict(lambda: (0, time.monotonic()))

_MAX_ATTEMPTS = 10
_WINDOW_SECS = 60  # 10 attempts per 60 seconds per IP


def _rate_limit(request: Request) -> None:
    """Raise 429 if the client has exceeded the rate limit."""
    now = time.monotonic()
    ip = request.client.host if request.client else "unknown"
    count, start = _WINDOW[ip]

    # Reset window if expired.
    if now - start > _WINDOW_SECS:
        count, start = 0, now

    if count >= _MAX_ATTEMPTS:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many requests. Please try again later.",
        )

    _WINDOW[ip] = (count + 1, start)
