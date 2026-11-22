"""Upload item photos to Cloudinary so they survive redeploys and DB resets.

Configured by one env var, ``CLOUDINARY_URL=cloudinary://<key>:<secret>@<cloud>``
(copy it from the Cloudinary dashboard). Uses Cloudinary's signed REST upload,
so no extra SDK is needed.
"""
import hashlib
import time
from dataclasses import dataclass
from urllib.parse import urlparse

import requests
from fastapi import HTTPException, status

from app.config import settings

MAX_IMAGE_BYTES = 5 * 1024 * 1024
FOLDER = "lab-inventory/items"
# Incoming transformation: cap the stored size so phone photos don't bloat pages.
TRANSFORMATION = "c_limit,w_1600,h_1600"


@dataclass(frozen=True)
class _Credentials:
    cloud_name: str
    api_key: str
    api_secret: str


def _credentials() -> _Credentials:
    parsed = urlparse(settings.CLOUDINARY_URL or "")
    if parsed.scheme != "cloudinary" or not (parsed.hostname and parsed.username and parsed.password):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Image upload is not configured (CLOUDINARY_URL missing)",
        )
    return _Credentials(parsed.hostname, parsed.username, parsed.password)


def detect_image_type(data: bytes) -> str | None:
    """Return the real image type from magic bytes (don't trust the filename)."""
    if data.startswith(b"\xff\xd8\xff"):
        return "jpeg"
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "png"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "webp"
    return None


def validate_image(data: bytes) -> None:
    if not data:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Empty file")
    if len(data) > MAX_IMAGE_BYTES:
        raise HTTPException(
            status_code=413,
            detail="Image must be 5 MB or smaller",
        )
    if detect_image_type(data) is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only JPEG, PNG or WebP images are allowed",
        )


def _sign(params: dict[str, str], api_secret: str) -> str:
    to_sign = "&".join(f"{k}={params[k]}" for k in sorted(params))
    return hashlib.sha1((to_sign + api_secret).encode()).hexdigest()


def upload_item_image(item_id: int, data: bytes) -> str:
    """Upload (or replace) the photo for one item; return its HTTPS URL.

    The public_id is fixed per item and overwritten, so replacing a photo
    doesn't leave orphans; the returned URL carries a new version number,
    so browsers don't show the cached old photo.
    """
    creds = _credentials()
    params = {
        "folder": FOLDER,
        "overwrite": "true",
        "public_id": f"item-{item_id}",
        "timestamp": str(int(time.time())),
        "transformation": TRANSFORMATION,
    }
    payload = {**params, "api_key": creds.api_key, "signature": _sign(params, creds.api_secret)}
    url = f"https://api.cloudinary.com/v1_1/{creds.cloud_name}/image/upload"
    try:
        res = requests.post(url, data=payload, files={"file": ("image", data)}, timeout=30)
    except requests.RequestException:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Image service unreachable")
    if not res.ok:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Image upload failed")
    return res.json()["secure_url"]
