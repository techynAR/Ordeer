"""
Customer service — business logic for the customers domain.

All public functions accept a SQLAlchemy ``Session`` as their first argument
so that the caller (a FastAPI dependency / router) owns the transaction
boundary and session lifecycle.
"""

from __future__ import annotations

from decimal import Decimal

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.models.customer import Customer
from app.models.order import Order
from app.schemas.customer import CustomerCreate, CustomerDetailResponse, CustomerUpdate


# ---------------------------------------------------------------------------
# Exceptions
# ---------------------------------------------------------------------------

class CustomerNotFoundError(Exception):
    """Raised when a customer with the requested id does not exist."""

    def __init__(self, customer_id: int) -> None:
        self.customer_id = customer_id
        super().__init__(f"Customer with id={customer_id} not found.")


class CustomerHasOrdersError(Exception):
    """Raised when trying to delete a customer who has orders."""

    def __init__(self, customer_id: int) -> None:
        self.customer_id = customer_id
        super().__init__(f"Customer with id={customer_id} has existing orders and cannot be deleted.")


# ---------------------------------------------------------------------------
# Read operations
# ---------------------------------------------------------------------------

def get_customer(db: Session, customer_id: int) -> CustomerDetailResponse:
    """
    Return a single customer with orders and revenue aggregates.

    Raises ``CustomerNotFoundError`` if the customer does not exist.
    """
    customer = (
        db.scalars(
            select(Customer)
            .where(Customer.id == customer_id)
            .options(selectinload(Customer.orders))
        ).first()
    )
    if customer is None:
        raise CustomerNotFoundError(customer_id)

    orders = customer.orders
    total_revenue = sum((o.total_amount for o in orders), Decimal("0.00"))
    order_count = len(orders)

    return CustomerDetailResponse(
        id=customer.id,
        full_name=customer.full_name,
        email=customer.email,
        phone=customer.phone,
        created_at=customer.created_at,
        orders=[
            {
                "id": o.id,
                "status": o.status.value if hasattr(o.status, "value") else str(o.status),
                "total_amount": o.total_amount,
                "created_at": o.created_at,
            }
            for o in sorted(orders, key=lambda o: o.created_at, reverse=True)
        ],
        total_revenue=total_revenue,
        order_count=order_count,
    )


def get_all_customers(
    db: Session,
    *,
    skip: int = 0,
    limit: int = 100,
) -> list[Customer]:
    """Return a paginated list of all customers ordered by id."""
    stmt = select(Customer).order_by(Customer.id).offset(skip).limit(limit)
    return list(db.scalars(stmt).all())


def search_customers(db: Session, q: str, *, limit: int = 20) -> list[Customer]:
    """
    Search customers by name, email, or phone (case-insensitive substring).
    """
    q = q.strip()
    if not q:
        return []
    stmt = (
        select(Customer)
        .where(
            or_(
                Customer.full_name.ilike(f"%{q}%"),
                Customer.email.ilike(f"%{q}%"),
                Customer.phone.ilike(f"%{q}%"),
            )
        )
        .order_by(Customer.full_name)
        .limit(limit)
    )
    return list(db.scalars(stmt).all())


# ---------------------------------------------------------------------------
# Write operations
# ---------------------------------------------------------------------------

def create_customer(db: Session, data: CustomerCreate) -> Customer:
    """Persist a new customer and return the hydrated ORM instance."""
    customer = Customer(
        full_name=data.full_name,
        email=data.email,
        phone=data.phone,
    )
    db.add(customer)
    db.commit()
    db.refresh(customer)
    return customer


def update_customer(db: Session, customer_id: int, data: CustomerUpdate) -> Customer:
    """
    Apply a partial update to an existing customer.

    Only fields explicitly set on ``data`` (i.e. not ``None``) are written.
    Raises ``CustomerNotFoundError`` if the customer does not exist.
    """
    customer = db.get(Customer, customer_id)
    if customer is None:
        raise CustomerNotFoundError(customer_id)

    patch = data.model_dump(exclude_unset=True)
    for field, value in patch.items():
        setattr(customer, field, value)

    db.commit()
    db.refresh(customer)
    return customer


def delete_customer(db: Session, customer_id: int) -> None:
    """
    Delete a customer by id.

    Raises ``CustomerNotFoundError`` if the customer does not exist.
    Raises ``CustomerHasOrdersError`` if the customer has existing orders.
    """
    customer = db.get(Customer, customer_id)
    if customer is None:
        raise CustomerNotFoundError(customer_id)

    # Check for existing orders without eager-loading all of them
    has_orders = db.scalar(
        select(func.count()).select_from(Order).where(Order.customer_id == customer_id)
    ) or 0
    if has_orders > 0:
        raise CustomerHasOrdersError(customer_id)

    db.delete(customer)
    db.commit()
