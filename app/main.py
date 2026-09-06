from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text

# Import all models so SQLAlchemy's metadata sees every table before create_all.
from app import models  # noqa: F401
from app.api.auth import router as auth_router
from app.api.borrow import router as borrow_router
from app.api.items import router as items_router
from app.api.locations import router as locations_router
from app.api.stats import router as stats_router
from app.api.users import router as users_router
from app.config import settings
from app.database import Base, SessionLocal, engine


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup — confirm DB reachable, then ensure tables exist.
    db = SessionLocal()
    try:
        db.execute(text("SELECT 1"))
        print("Database connected successfully")
        Base.metadata.create_all(bind=engine)

        # ── Schema migrations (no Alembic — manual ALTER TABLE) ──
        _run_migrations(db)

        from app.seed import seed_if_empty
        seed_if_empty()
    except Exception as e:
        print(f"Database connection failed: {e}")
    finally:
        db.close()

    yield
    # Shutdown — nothing to clean up right now.


def _run_migrations(db):
    """Apply missing schema changes for existing tables that were
    already created by a previous run of ``create_all``.

    Each migration is idempotent — safe to run on every startup.
    """
    is_sqlite = settings.DATABASE_URL.startswith("sqlite")

    # ── 2026-08-03: borrow_records.due_date ─────────────────
    try:
        if is_sqlite:
            # SQLite: check via PRAGMA before ALTER (no IF NOT EXISTS for ADD COLUMN in older versions)
            cols = [r[1] for r in db.execute(text("PRAGMA table_info('borrow_records')")).fetchall()]
            if "due_date" not in cols:
                db.execute(text("ALTER TABLE borrow_records ADD COLUMN due_date TIMESTAMP"))
                db.commit()
                print("Migration: added borrow_records.due_date")
        else:
            db.execute(text("ALTER TABLE borrow_records ADD COLUMN IF NOT EXISTS due_date TIMESTAMP"))
            db.commit()
            print("Migration: ensured borrow_records.due_date exists")
    except Exception as exc:
        db.rollback()
        print(f"Migration note (due_date): {exc}")


app = FastAPI(title="Laboratory Inventory Management API", lifespan=lifespan)

cors_origins = [o.strip() for o in settings.CORS_ORIGINS.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Force every validation error into the project-standard {"detail": "..."} shape.
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(
    request: Request, exc: RequestValidationError
) -> JSONResponse:
    first = exc.errors()[0] if exc.errors() else {"msg": "Validation error"}
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"detail": first.get("msg", "Validation error")},
    )


@app.get("/health", status_code=status.HTTP_200_OK)
def get_health() -> dict[str, str]:
    return {"status": "ok"}


# Mount every router under /api as the frontend expects.
app.include_router(auth_router, prefix="/api")
app.include_router(users_router, prefix="/api")
app.include_router(items_router, prefix="/api")
app.include_router(locations_router, prefix="/api")
app.include_router(borrow_router, prefix="/api")
app.include_router(stats_router, prefix="/api")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="127.0.0.1", port=8000)
