"""
Product service — business logic for the products domain.

All public functions accept a SQLAlchemy ``Session`` as their first argument
so that the caller (a FastAPI dependency / router) owns the transaction
boundary and session lifecycle.
"""

from __future__ import annotations

from decimal import Decimal

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.models.order_item import OrderItem
from app.models.product import Product
from app.schemas.product import ProductCreate, ProductDetailResponse, ProductUpdate


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

def get_product(db: Session, product_id: int) -> ProductDetailResponse:
    """
    Return a single product with aggregated revenue data.

    Raises ``ProductNotFoundError`` if the product does not exist.
    """
    product = (
        db.scalars(
            select(Product)
            .where(Product.id == product_id)
            .options(selectinload(Product.order_items))
        ).first()
    )
    if product is None:
        raise ProductNotFoundError(product_id)

    # Compute revenue aggregates from loaded order_items
    order_items = product.order_items
    total_revenue = sum((item.subtotal for item in order_items), Decimal("0.00"))
    order_count = len(order_items)
    last_ordered_at = (
        max((item.order_id for item in order_items), default=None)
        if order_items else None
    )

    # Get the actual latest order created_at
    if order_items:
        from app.models.order import Order  # noqa: PLC0415
        last_order_id = max(item.order_id for item in order_items)
        last_order = db.get(Order, last_order_id)
        last_ordered_at = last_order.created_at if last_order else None
    else:
        last_ordered_at = None

    return ProductDetailResponse(
        id=product.id,
        name=product.name,
        sku=product.sku,
        price=product.price,
        stock_quantity=product.stock_quantity,
        created_at=product.created_at,
        updated_at=product.updated_at,
        order_items=[
            {
                "id": oi.id,
                "order_id": oi.order_id,
                "quantity": oi.quantity,
                "unit_price": oi.unit_price,
                "subtotal": oi.subtotal,
            }
            for oi in order_items
        ],
        total_revenue=total_revenue,
        order_count=order_count,
        last_ordered_at=last_ordered_at,
    )


def get_all_products(db: Session, *, skip: int = 0, limit: int = 100) -> list[Product]:
    """Return a paginated list of all products ordered by id."""
    stmt = select(Product).order_by(Product.id).offset(skip).limit(limit)
    return list(db.scalars(stmt).all())


def search_products(db: Session, q: str, *, limit: int = 20) -> list[Product]:
    """
    Search products by name or SKU (case-insensitive substring).
    Returns lightweight Product ORM objects.
    """
    q = q.strip()
    if not q:
        return []
    stmt = (
        select(Product)
        .where(
            or_(
                Product.name.ilike(f"%{q}%"),
                Product.sku.ilike(f"%{q}%"),
            )
        )
        .order_by(Product.name)
        .limit(limit)
    )
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
    product = db.get(Product, product_id)
    if product is None:
        raise ProductNotFoundError(product_id)

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
    product = db.get(Product, product_id)
    if product is None:
        raise ProductNotFoundError(product_id)

    # Check for existing order items without eager-loading all of them
    has_orders = db.scalar(
        select(func.count()).select_from(OrderItem).where(OrderItem.product_id == product_id)
    ) or 0
    if has_orders > 0:
        raise ProductHasOrdersError(product_id)

    db.delete(product)
    db.commit()
