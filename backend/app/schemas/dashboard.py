"""
app/schemas/dashboard.py
------------------------
Pydantic response model for GET /dashboard/stats.
"""

from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict


class LowStockItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    sku: str
    stock_quantity: int


class RecentOrder(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    customer_name: str
    status: str
    total_amount: Decimal
    created_at: datetime



class RecentCustomer(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    full_name: str
    email: str
    created_at: datetime


class DashboardStats(BaseModel):
    total_products: int
    total_customers: int
    total_orders: int
    total_revenue: Decimal
    low_stock_count: int
    low_stock_items: list[LowStockItem]
    recent_orders: list[RecentOrder]
    recent_customers: list[RecentCustomer]
