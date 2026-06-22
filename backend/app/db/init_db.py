"""
app/db/init_db.py
-----------------
Database initialisation utilities.

``create_tables()`` creates all tables that are registered on
``Base.metadata``.  It is intentionally DDL-only; seed data and schema
migrations belong elsewhere (Alembic).

Usage
-----
    from app.db.init_db import create_tables
    create_tables()
"""

from app.db.base import Base
from app.db.session import engine

# Importing app.models registers every ORM mapper class (Product, Customer,
# Order, OrderItem) with Base.metadata.  Without this import,
# Base.metadata.create_all() would emit no CREATE TABLE statements because it
# only knows about tables that have been mapped.
import app.models  # noqa: F401  (side-effect import — must not be removed)


def create_tables() -> None:
    """Create all tables defined by the ORM models if they do not yet exist.

    Idempotent: uses ``checkfirst=True`` internally (SQLAlchemy default), so
    calling this multiple times is safe.
    """
    Base.metadata.create_all(bind=engine)
