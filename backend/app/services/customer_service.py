"""
Customer service — business logic for the customers domain.

All public functions accept a SQLAlchemy ``Session`` as their first argument
so that the caller (a FastAPI dependency / router) owns the transaction
boundary and session lifecycle.
"""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.customer import Customer
from app.schemas.customer import CustomerCreate


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

def get_customer(db: Session, customer_id: int) -> Customer:
    """Return a single customer by primary key, or raise ``CustomerNotFoundError``."""
    customer = db.get(Customer, customer_id)
    if customer is None:
        raise CustomerNotFoundError(customer_id)
    return customer


def get_all_customers(
    db: Session,
    *,
    skip: int = 0,
    limit: int = 100,
) -> list[Customer]:
    """Return a paginated list of all customers ordered by id."""
    stmt = select(Customer).order_by(Customer.id).offset(skip).limit(limit)
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


def delete_customer(db: Session, customer_id: int) -> None:
    """
    Delete a customer by id.

    Raises ``CustomerNotFoundError`` if the customer does not exist.
    Raises ``CustomerHasOrdersError`` if the customer has existing orders.
    """
    customer = get_customer(db, customer_id)
    if customer.orders:
        raise CustomerHasOrdersError(customer_id)
    db.delete(customer)
    db.commit()
