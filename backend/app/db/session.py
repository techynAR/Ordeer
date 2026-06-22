from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import settings

# ---------------------------------------------------------------------------
# Engine — SQLAlchemy 2.0 style
# ---------------------------------------------------------------------------
engine = create_engine(
    settings.database_url,
    # Pool settings suitable for a FastAPI / async-compatible service.
    pool_pre_ping=True,   # recycle stale connections automatically
    pool_size=10,
    max_overflow=20,
    echo=False,           # set to True locally if you want SQL query logging
)

# ---------------------------------------------------------------------------
# Session factory
# ---------------------------------------------------------------------------
SessionLocal = sessionmaker(
    bind=engine,
    autocommit=False,
    autoflush=False,
    class_=Session,       # explicit SQLAlchemy 2.0 Session class
)


# ---------------------------------------------------------------------------
# FastAPI dependency
# ---------------------------------------------------------------------------
def get_db() -> Generator[Session, None, None]:
    """
    Yield a database session for the duration of a request and ensure
    it is closed when the request completes (or raises an exception).

    Usage in a FastAPI route::

        from fastapi import Depends
        from sqlalchemy.orm import Session
        from app.db.session import get_db

        @router.get("/items")
        def read_items(db: Session = Depends(get_db)):
            ...
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
