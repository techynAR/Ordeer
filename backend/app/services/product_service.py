"""
Product service — business logic for the products domain.

All public functions accept a SQLAlchemy ``Session`` as their first argument
so that the caller (a FastAPI dependency / router) owns the transaction
boundary and session lifecycle.
"""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.product import Product
from app.schemas.product import ProductCreate, ProductUpdate


# ---------------------------------------------------------------------------
# Exceptions
# ---------------------------------------------------------------------------

class ProductNotFoundError(Exception):
    """Raised when a product with the requested id does not exist."""

    def __init__(self, product_id: int) -> None:
        self.product_id = product_id
        super().__init__(f"Product with id={product_id} not found.")


class ProductHasOrdersError(Exception):
    """Raised when trying to delete a product that has been ordered."""

    def __init__(self, product_id: int) -> None:
        self.product_id = product_id
        super().__init__(f"Product with id={product_id} has existing order items and cannot be deleted.")


# ---------------------------------------------------------------------------
# Read operations
# ---------------------------------------------------------------------------

def get_product(db: Session, product_id: int) -> Product:
    """Return a single product by primary key, or raise ``ProductNotFoundError``."""
    product = db.get(Product, product_id)
    if product is None:
        raise ProductNotFoundError(product_id)
    return product


def get_all_products(db: Session, *, skip: int = 0, limit: int = 100) -> list[Product]:
    """Return a paginated list of all products ordered by id."""
    stmt = select(Product).order_by(Product.id).offset(skip).limit(limit)
    return list(db.scalars(stmt).all())


# ---------------------------------------------------------------------------
# Write operations
# ---------------------------------------------------------------------------

def create_product(db: Session, data: ProductCreate) -> Product:
    """Persist a new product and return the hydrated ORM instance."""
    product = Product(
        name=data.name,
        sku=data.sku,
        price=data.price,
        stock_quantity=data.stock_quantity,
    )
    db.add(product)
    db.commit()
    db.refresh(product)
    return product


def update_product(db: Session, product_id: int, data: ProductUpdate) -> Product:
    """
    Apply a partial update to an existing product.

    Only fields explicitly set on ``data`` (i.e. not ``None``) are written.
    Raises ``ProductNotFoundError`` if the product does not exist.
    """
    product = get_product(db, product_id)

    patch = data.model_dump(exclude_unset=True)
    for field, value in patch.items():
        setattr(product, field, value)

    db.commit()
    db.refresh(product)
    return product


def delete_product(db: Session, product_id: int) -> None:
    """
    Delete a product by id.

    Raises ``ProductNotFoundError`` if the product does not exist.
    Raises ``ProductHasOrdersError`` if the product has existing order items.
    """
    product = get_product(db, product_id)
    if product.order_items:
        raise ProductHasOrdersError(product_id)
    db.delete(product)
    db.commit()
