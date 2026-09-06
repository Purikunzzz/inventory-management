from fastapi import APIRouter, Depends, Request, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.core.rate_limit import _rate_limit
from app.schemas.user import GoogleLoginRequest, LoginRequest, LoginResponse, Token
from app.services import auth_service

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=LoginResponse, status_code=status.HTTP_200_OK)
def login(
    body: LoginRequest,
    request: Request,
    db: Session = Depends(get_db),
) -> LoginResponse:
    """Primary login for the frontend — JSON body, returns token + user."""
    _rate_limit(request)
    return auth_service.authenticate(db, body)


@router.post("/google", response_model=LoginResponse, status_code=status.HTTP_200_OK)
def google_login(
    body: GoogleLoginRequest,
    request: Request,
    db: Session = Depends(get_db),
) -> LoginResponse:
    """Login with Google ID token. Only @kmitl.ac.th emails are accepted."""
    _rate_limit(request)
    return auth_service.authenticate_google(db, body.credential)


@router.post("/token", response_model=Token, status_code=status.HTTP_200_OK)
def login_oauth_form(
    request: Request,
    form: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
) -> Token:
    """OAuth2 password-flow endpoint used by Swagger's Authorize button."""
    _rate_limit(request)
    result = auth_service.authenticate_form(db, form.username, form.password)
    return Token(**result)
