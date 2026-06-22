"""
app/api/routes/dashboard.py
----------------------------
FastAPI router for the /dashboard resource.
"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.schemas.dashboard import DashboardStats
from app.services import dashboard_service

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


# ---------------------------------------------------------------------------
# GET /dashboard/stats
# ---------------------------------------------------------------------------
@router.get(
    "/stats",
    response_model=DashboardStats,
    summary="Get aggregated dashboard statistics",
)
def get_stats(db: Session = Depends(get_db)) -> DashboardStats:
    """Return total counts, revenue, and low-stock alerts for the dashboard."""
    return dashboard_service.get_dashboard_stats(db)
