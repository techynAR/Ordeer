from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field


class ProductCreate(BaseModel):
    name: str
    sku: str
    price: Decimal = Field(ge=0)
    stock_quantity: int = Field(ge=0)


class ProductUpdate(BaseModel):
    name: str | None = None
    sku: str | None = None
    price: Decimal | None = Field(default=None, ge=0)
    stock_quantity: int | None = Field(default=None, ge=0)


class ProductResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    sku: str
    price: Decimal
    stock_quantity: int
    created_at: datetime
    updated_at: datetime


class ProductOrderItemDetail(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    order_id: int
    quantity: int
    unit_price: Decimal
    subtotal: Decimal


class ProductDetailResponse(ProductResponse):
    order_items: list[ProductOrderItemDetail] = []
    total_revenue: Decimal = Decimal("0.00")
    order_count: int = 0
    last_ordered_at: datetime | None = None


class ProductSearchResult(BaseModel):
    """Lightweight result for search endpoint."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    sku: str
    price: Decimal
    stock_quantity: int
