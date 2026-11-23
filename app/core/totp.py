"""RFC 6238 TOTP (30 s, 6 digits, SHA-1) — what Google/Microsoft Authenticator use.

Stdlib only, so no extra dependency for a few lines of HMAC.
"""

import base64
import hashlib
import hmac
import secrets
import struct
import time
from urllib.parse import quote

PERIOD_SECS = 30
DIGITS = 6
ISSUER = "LabFlow"


def generate_secret() -> str:
    """160-bit random secret, base32 without padding (what authenticator apps expect)."""
    return base64.b32encode(secrets.token_bytes(20)).decode("ascii").rstrip("=")


def _key(secret: str) -> bytes:
    padded = secret + "=" * (-len(secret) % 8)
    return base64.b32decode(padded.upper())


def code_at(secret: str, step: int) -> str:
    """HOTP value for one 30-second time step."""
    digest = hmac.new(_key(secret), struct.pack(">Q", step), hashlib.sha1).digest()
    offset = digest[-1] & 0x0F
    value = struct.unpack(">I", digest[offset : offset + 4])[0] & 0x7FFFFFFF
    return f"{value % 10**DIGITS:0{DIGITS}d}"


def current_step(now: float | None = None) -> int:
    return int((time.time() if now is None else now) // PERIOD_SECS)


def matching_step(secret: str, code: str, now: float | None = None, window: int = 1) -> int | None:
    """Time step the code belongs to (±`window` steps for clock drift), else None."""
    if len(code) != DIGITS or not code.isdigit():
        return None
    step = current_step(now)
    for candidate in range(step - window, step + window + 1):
        if hmac.compare_digest(code_at(secret, candidate), code):
            return candidate
    return None


def provisioning_uri(secret: str, account: str) -> str:
    """otpauth:// URI shown as a QR code for the authenticator app to scan."""
    label = quote(f"{ISSUER}:{account}")
    return f"otpauth://totp/{label}?secret={secret}&issuer={quote(ISSUER)}&digits={DIGITS}&period={PERIOD_SECS}"
