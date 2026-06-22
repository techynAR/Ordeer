"""
app/schemas/dashboard.py
------------------------
Pydantic response model for GET /dashboard/stats.
"""

from decimal import Decimal

from pydantic import BaseModel, ConfigDict


class LowStockItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    sku: str
    stock_quantity: int


class DashboardStats(BaseModel):
    total_products: int
    total_customers: int
    total_orders: int
    total_revenue: Decimal
    low_stock_count: int
    low_stock_items: list[LowStockItem]
