"""Shared test fixtures — file-based SQLite, TestClient, admin/user tokens."""

import os
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker

from app.database import Base
from app.main import app
from app.api.deps import get_db
from app.core.security import create_access_token, hash_password
from app.models.user import User, UserRoleEnum

# ── File-based SQLite for tests ──────────────────────────────────────────

TEST_DB_PATH = os.path.join(os.path.dirname(__file__), ".test.db")
TEST_DATABASE_URL = f"sqlite:///{TEST_DB_PATH}"
engine = create_engine(TEST_DATABASE_URL, connect_args={"check_same_thread": False})

# Enable foreign key support on every connection.
@event.listens_for(engine, "connect")
def _fk_pragma(dbapi_connection, connection_record):
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()


TestingSessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)


@pytest.fixture(autouse=True)
def override_get_db():
    """Replace the production DB dependency with a fresh test DB."""
    Base.metadata.create_all(bind=engine)

    def _override():
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = _override
    yield
    app.dependency_overrides.clear()
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


@pytest.fixture
def db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


# ── Clean up test DB file after all tests ────────────────────────────────

@pytest.fixture(scope="session", autouse=True)
def cleanup_test_db():
    yield
    engine.dispose()
    try:
        os.remove(TEST_DB_PATH)
    except FileNotFoundError:
        pass


# ── User helpers ──────────────────────────────────────────────────────────

def _create_user(
    db, email: str, role: UserRoleEnum, password: str = "secret123"
) -> User:
    user = User(
        email=email,
        full_name=f"Test {role.value}",
        password=hash_password(password),
        role=role,
        is_active=True,
        auth_provider="email",
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def _token_for(user: User) -> str:
    return create_access_token(data={"sub": str(user.id), "role": user.role.value})


@pytest.fixture
def admin_user(db) -> User:
    return _create_user(db, "admin@test.com", UserRoleEnum.admin)


@pytest.fixture
def normal_user(db) -> User:
    return _create_user(db, "user@test.com", UserRoleEnum.user)


@pytest.fixture
def admin_token(admin_user) -> str:
    return _token_for(admin_user)


@pytest.fixture
def user_token(normal_user) -> str:
    return _token_for(normal_user)


@pytest.fixture
def auth_header(admin_token) -> dict:
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture
def user_auth_header(user_token) -> dict:
    return {"Authorization": f"Bearer {user_token}"}
