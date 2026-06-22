from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Numeric, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.customer import Customer
    from app.models.order_item import OrderItem


class Order(Base):
    __tablename__ = "orders"
    __table_args__ = (
        CheckConstraint(
            "total_amount >= 0",
            name="ck_orders_total_amount_non_negative",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    customer_id: Mapped[int] = mapped_column(
        ForeignKey("customers.id"),
        nullable=False,
    )
    total_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    customer: Mapped[Customer] = relationship(
        "Customer",
        back_populates="orders",
    )
    order_items: Mapped[list[OrderItem]] = relationship(
        "OrderItem",
        back_populates="order",
    )
