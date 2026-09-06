from fastapi import HTTPException, status
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token

ALLOWED_DOMAIN = "@kmitl.ac.th"


def verify_google_token(credential: str, client_id: str) -> dict:
    try:
        request = google_requests.Request()
        info = id_token.verify_oauth2_token(credential, request, client_id)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Google token",
        )

    if info.get("iss") not in ("accounts.google.com", "https://accounts.google.com"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token issuer",
        )

    if not info.get("email_verified", False):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Google account email is not verified",
        )

    email = info.get("email", "")
    if not email.lower().endswith(ALLOWED_DOMAIN):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Only {ALLOWED_DOMAIN} emails are allowed",
        )

    return {
        "email": email,
        "name": info.get("name", ""),
        "google_id": info.get("sub"),
    }
