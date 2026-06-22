"""
app/main.py
-----------
FastAPI application entry point for Ordeer.

Startup sequence
----------------
1. ``create_tables()`` is called via the ``lifespan`` context manager so all
   ORM-mapped tables are created (idempotently) before the first request.
2. All domain routers are registered with a common ``/api/v1`` prefix.
"""

from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI

from app.api.routes.customers import router as customers_router
from app.api.routes.dashboard import router as dashboard_router
from app.api.routes.orders import router as orders_router
from app.api.routes.products import router as products_router
from app.db.init_db import create_tables


# ---------------------------------------------------------------------------
# Lifespan — runs once on startup, cleans up on shutdown
# ---------------------------------------------------------------------------
@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Create database tables on startup (no-op if they already exist)."""
    create_tables()
    yield


# ---------------------------------------------------------------------------
# Application instance
# ---------------------------------------------------------------------------
app = FastAPI(
    title="Ordeer API",
    description="Order management REST API.",
    version="0.1.0",
    lifespan=lifespan,
)


# ---------------------------------------------------------------------------
# Routers
# ---------------------------------------------------------------------------
app.include_router(dashboard_router)
app.include_router(products_router)
app.include_router(customers_router)
app.include_router(orders_router)


# ---------------------------------------------------------------------------
# Root health-check endpoint
# ---------------------------------------------------------------------------
@app.get("/", tags=["health"])
def root() -> dict[str, str]:
    """Return a basic liveness response."""
    return {"name": "Ordeer API", "status": "running"}
