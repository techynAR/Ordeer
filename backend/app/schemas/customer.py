from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict


class CustomerCreate(BaseModel):
    full_name: str
    email: str
    phone: str


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
    total_amount: Decimal
    created_at: datetime


class CustomerDetailResponse(CustomerResponse):
    orders: list[CustomerOrderResponse] = []
