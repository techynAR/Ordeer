from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field


class OrderItemCreate(BaseModel):
    product_id: int
    quantity: int = Field(gt=0)


class OrderCreate(BaseModel):
    customer_id: int
    items: list[OrderItemCreate]


class OrderItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    product_id: int
    quantity: int
    unit_price: Decimal
    subtotal: Decimal


class OrderResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    customer_id: int
    total_amount: Decimal
    created_at: datetime
    items: list[OrderItemResponse] = Field(validation_alias="order_items")


class OrderItemProductSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    name: str
    sku: str


class OrderItemDetailResponse(OrderItemResponse):
    product: OrderItemProductSummary


class OrderCustomerSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    full_name: str
    email: str
    phone: str


class OrderDetailResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    customer_id: int
    total_amount: Decimal
    created_at: datetime
    customer: OrderCustomerSummary
    items: list[OrderItemDetailResponse] = Field(validation_alias="order_items")
