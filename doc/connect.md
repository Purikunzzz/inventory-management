You are finishing a Laboratory Inventory Management monorepo (React + FastAPI). About 80% is already written. Your job: fix 3 broken things, add Docker, add CORS.

## CONVENTION
- Type hints everywhere
- snake_case for Python, camelCase for JS
- No business logic in api/ route handlers
- Use SQLAlchemy ORM, no raw SQL
- Return full file contents for every file you create or change

## FILES TO FIX/CREATE

### FILE 1: app/services/auth_service.py (FIX — corrupted)

Current state has JS code mixed in. Rewrite as clean Python with these functions:

```python
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.config import settings
from app.core.google_auth import verify_google_token
from app.core.security import create_access_token, hash_password, verify_password
from app.models.user import User, UserRoleEnum
from app.schemas.user import CreateUser, LoginRequest, LoginResponse, UserOut

# Private helper
def _verify_credentials(db: Session, email: str, password: str) -> User:
    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")
    if user.password is None:  # user registered via Google
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Use Google Sign-In for this account")
    if not verify_password(password, user.password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is deactivated")
    return user

def authenticate(db: Session, body: LoginRequest) -> LoginResponse:
    user = _verify_credentials(db, body.email, body.password)
    token = create_access_token(data={"sub": str(user.id), "role": user.role.value})
    return LoginResponse(access_token=token, token_type="bearer", user=UserOut.model_validate(user))

def authenticate_form(db: Session, username: str, password: str) -> dict:
    user = _verify_credentials(db, username, password)
    token = create_access_token(data={"sub": str(user.id), "role": user.role.value})
    return {"access_token": token, "token_type": "bearer"}

def authenticate_google(db: Session, credential: str) -> LoginResponse:
    info = verify_google_token(credential, settings.GOOGLE_CLIENT_ID)
    user = db.query(User).filter(User.email == info["email"]).first()
    if not user:
        user = User(email=info["email"], full_name=info["name"], password=None, auth_provider="google", role=UserRoleEnum.USER, is_active=True)
        db.add(user)
        db.commit()
        db.refresh(user)
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is deactivated")
    token = create_access_token(data={"sub": str(user.id), "role": user.role.value})
    return LoginResponse(access_token=token, token_type="bearer", user=UserOut.model_validate(user))

def create_user(db: Session, body: CreateUser) -> User:
    existing = db.query(User).filter(User.email == body.email).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")
    user = User(email=body.email, full_name=body.full_name, password=hash_password(body.password), role=body.role or UserRoleEnum.USER, is_active=True)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user

def list_users(db: Session, skip: int = 0, limit: int = 100) -> list[User]:
    return db.query(User).offset(skip).limit(limit).all()

def get_user(db: Session, user_id: int) -> User:
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return user

FILE 2: src/services/authService.js (FIX — mock to real)
Replace entire file:

import apiClient from '../lib/apiClient'

export const authService = {
  googleLogin(credential) {
    return apiClient.post('/auth/google', { credential })
  },
}
FILE 3: app/main.py (EDIT — add CORS)
Add imports at top after existing ones:

from fastapi.middleware.cors import CORSMiddleware
Add this block right after app = FastAPI(...) line:

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:4173",
        # Add your Vercel domain here after deploy, e.g.:
        # "https://your-project.vercel.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
Keep everything else in main.py unchanged.

FILE 4: Dockerfile (NEW)
FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app/ ./app/
COPY .env .

RUN mkdir -p /app/data

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
FILE 5: docker-compose.yml (NEW)
version: "3.8"

services:
  backend:
    build: .
    ports:
      - "8000:8000"
    volumes:
      - ./data:/app/data
    env_file:
      - .env
FILE 6: .dockerignore (NEW)
node_modules/
src/
public/
dist/
.git/
__pycache__/
*.pyc
.env
data/
FILE 7: .env (EDIT — change SQLite path)
Change the DATABASE_URL line from:

DATABASE_URL=sqlite:///./invent.db
to:

DATABASE_URL=sqlite:///./data/invent.db
All other lines stay the same.

VERIFICATION (tell user these steps)
After all changes, run:

docker compose up -d                        # Build + start backend
curl http://localhost:8000/health           # Should return {"status":"ok"}
npm run dev                                  # Start frontend
ngrok http 8000                             # Expose backend publicly
Add ngrok URL to Google Cloud Console → Authorized JavaScript origins, then test full Google Sign-In flow.

RULES
Output COMPLETE file contents for every file listed above
For existing files (files 1, 2, 3, 7): show the FULL file with changes applied
For new files (files 4, 5, 6): show the FULL file content
Do NOT skip imports, do NOT use placeholders like # ... rest unchanged
