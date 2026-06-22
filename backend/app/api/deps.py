"""
app/api/deps.py
---------------
Shared FastAPI dependencies for the Ordeer API.
"""

from collections.abc import Generator

from fastapi import Depends
from sqlalchemy.orm import Session

from app.db.session import SessionLocal


def get_db() -> Generator[Session, None, None]:
    """
    Yield a database session scoped to the current HTTP request.

    The session is closed in the ``finally`` block regardless of whether
    the request succeeds or raises an exception.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
