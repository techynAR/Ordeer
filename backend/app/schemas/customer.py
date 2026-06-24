from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict


class CustomerCreate(BaseModel):
    full_name: str
    email: str
    phone: str


class CustomerUpdate(BaseModel):
    full_name: str | None = None
    email: str | None = None
    phone: str | None = None


class CustomerResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    full_name: str
    email: str
    phone: str
    created_at: datetime


class CustomerOrderResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    status: str
    total_amount: Decimal
    created_at: datetime


class CustomerDetailResponse(CustomerResponse):
    orders: list[CustomerOrderResponse] = []
    total_revenue: Decimal = Decimal("0.00")
    order_count: int = 0


class CustomerSearchResult(BaseModel):
    """Lightweight result for search endpoint."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    full_name: str
    email: str
    phone: str
