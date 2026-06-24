"""
app/services/dashboard_service.py
----------------------------------
Business logic for the dashboard stats endpoint.
Queries are kept to a minimal set of efficient aggregates.
"""

from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.customer import Customer
from app.models.order import Order
from app.models.product import Product
from app.schemas.dashboard import DashboardStats, LowStockItem

LOW_STOCK_THRESHOLD = 10


def get_dashboard_stats(db: Session) -> DashboardStats:
    """Return aggregated stats for the operations dashboard."""

    total_products: int = db.scalar(select(func.count()).select_from(Product)) or 0
    total_customers: int = db.scalar(select(func.count()).select_from(Customer)) or 0
    total_orders: int = db.scalar(select(func.count()).select_from(Order)) or 0

    revenue_result = db.scalar(select(func.coalesce(func.sum(Order.total_amount), 0)))
    total_revenue = Decimal(str(revenue_result)) if revenue_result is not None else Decimal("0")

    low_stock_products = (
        db.execute(
            select(Product)
            .where(Product.stock_quantity <= LOW_STOCK_THRESHOLD)
            .order_by(Product.stock_quantity.asc())
        )
        .scalars()
        .all()
    )

    recent_customers = (
        db.execute(select(Customer).order_by(Customer.created_at.desc()).limit(5))
        .scalars()
        .all()
    )

    recent_orders_query = (
        db.execute(
            select(Order, Customer.full_name.label("customer_name"))
            .join(Customer, Order.customer_id == Customer.id)
            .order_by(Order.created_at.desc())
            .limit(5)
        )
        .all()
    )

    return DashboardStats(
        total_products=total_products,
        total_customers=total_customers,
        total_orders=total_orders,
        total_revenue=total_revenue,
        low_stock_count=len(low_stock_products),
        low_stock_items=[
            LowStockItem(
                id=p.id,
                name=p.name,
                sku=p.sku,
                stock_quantity=p.stock_quantity,
            )
            for p in low_stock_products
        ],
        recent_orders=[
            {
                "id": o.Order.id,
                "customer_name": o.customer_name,
                "status": o.Order.status.value if hasattr(o.Order.status, "value") else str(o.Order.status),
                "total_amount": o.Order.total_amount,
                "created_at": o.Order.created_at,
            }
            for o in recent_orders_query
        ],
        recent_customers=[
            {
                "id": c.id,
                "full_name": c.full_name,
                "email": c.email,
                "created_at": c.created_at,
            }
            for c in recent_customers
        ],
    )
