from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field

from app.models.order import OrderStatus


class OrderItemCreate(BaseModel):
    product_id: int
    quantity: int = Field(gt=0)


class OrderCreate(BaseModel):
    customer_id: int
    items: list[OrderItemCreate]


class OrderStatusUpdate(BaseModel):
    status: OrderStatus


class OrderItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    product_id: int
    quantity: int
    unit_price: Decimal
    subtotal: Decimal


class OrderCustomerSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    full_name: str
    email: str
    phone: str


class OrderResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    customer_id: int
    status: OrderStatus
    total_amount: Decimal
    created_at: datetime
    updated_at: datetime
    customer: OrderCustomerSummary
    items: list[OrderItemResponse] = Field(validation_alias="order_items")


class OrderItemProductSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    name: str
    sku: str


class OrderItemDetailResponse(OrderItemResponse):
    product: OrderItemProductSummary



class OrderDetailResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    customer_id: int
    status: OrderStatus
    total_amount: Decimal
    created_at: datetime
    updated_at: datetime
    customer: OrderCustomerSummary
    items: list[OrderItemDetailResponse] = Field(validation_alias="order_items")


class OrderSearchResult(BaseModel):
    """Lightweight result for search endpoint."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    customer_id: int
    status: OrderStatus
    total_amount: Decimal
    created_at: datetime
    customer_name: str
