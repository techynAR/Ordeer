"""
Order service — business logic for the orders domain.

Responsibilities
----------------
* Validate that the customer exists.
* Validate that every requested product exists.
* Validate that each product has sufficient stock.
* Calculate per-item subtotals and the order total.
* Decrement ``stock_quantity`` for each product.
* Persist the ``Order`` and its ``OrderItem`` records atomically inside a
  single database transaction (commit / rollback is managed here).
* Allow updating order status via ``update_order_status``.
* Search orders by id or customer name via ``search_orders``.

All public functions accept a SQLAlchemy ``Session`` as their first argument.
"""

from __future__ import annotations

from decimal import Decimal

from sqlalchemy import or_, select
from sqlalchemy.orm import Session, selectinload

from app.models.order import Order, OrderStatus
from app.models.order_item import OrderItem
from app.models.product import Product
from app.schemas.order import OrderCreate


# ---------------------------------------------------------------------------
# Exceptions
# ---------------------------------------------------------------------------

class CustomerNotFoundError(Exception):
    """Raised when the referenced customer does not exist."""

    def __init__(self, customer_id: int) -> None:
        self.customer_id = customer_id
        super().__init__(f"Customer with id={customer_id} not found.")


class ProductNotFoundError(Exception):
    """Raised when a referenced product does not exist."""

    def __init__(self, product_id: int) -> None:
        self.product_id = product_id
        super().__init__(f"Product with id={product_id} not found.")


class InsufficientStockError(Exception):
    """Raised when a product does not have enough stock to fulfil the order."""

    def __init__(self, product_id: int, requested: int, available: int) -> None:
        self.product_id = product_id
        self.requested = requested
        self.available = available
        super().__init__(
            f"Insufficient stock for product id={product_id}: "
            f"requested={requested}, available={available}."
        )


class EmptyOrderError(Exception):
    """Raised when an order is submitted with no line items."""

    def __init__(self) -> None:
        super().__init__("An order must contain at least one item.")


class OrderNotFoundError(Exception):
    """Raised when an order with the requested id does not exist."""

    def __init__(self, order_id: int) -> None:
        self.order_id = order_id
        super().__init__(f"Order with id={order_id} not found.")


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _get_customer_or_raise(db: Session, customer_id: int):  # noqa: ANN202
    """Load a customer by pk; raise ``CustomerNotFoundError`` if missing."""
    # Import here to avoid a circular-import at module level.
    from app.models.customer import Customer  # noqa: PLC0415

    customer = db.get(Customer, customer_id)
    if customer is None:
        raise CustomerNotFoundError(customer_id)
    return customer


def _get_product_or_raise(db: Session, product_id: int) -> Product:
    """Load a product by pk; raise ``ProductNotFoundError`` if missing."""
    product = db.get(Product, product_id)
    if product is None:
        raise ProductNotFoundError(product_id)
    return product


# ---------------------------------------------------------------------------
# Read operations
# ---------------------------------------------------------------------------

def get_order(db: Session, order_id: int) -> Order:
    """
    Return a single order with customer and order_items eagerly loaded.

    Raises ``OrderNotFoundError`` if the order does not exist.
    """
    stmt = (
        select(Order)
        .where(Order.id == order_id)
        .options(
            selectinload(Order.order_items).selectinload(OrderItem.product),
            selectinload(Order.customer),
        )
    )
    order = db.scalars(stmt).first()
    if order is None:
        raise OrderNotFoundError(order_id)
    return order


def get_all_orders(
    db: Session,
    *,
    skip: int = 0,
    limit: int = 100,
) -> list[Order]:
    """
    Return a paginated list of all orders with ``order_items`` and ``customer`` eagerly loaded,
    ordered by descending creation time (newest first).
    """
    stmt = (
        select(Order)
        .options(
            selectinload(Order.order_items),
            selectinload(Order.customer),
        )
        .order_by(Order.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    return list(db.scalars(stmt).all())


def search_orders(db: Session, q: str, *, limit: int = 20) -> list[dict]:
    """
    Search orders by id (exact) or customer name (case-insensitive substring).
    Returns lightweight result dicts suitable for the search endpoint.
    """
    from app.models.customer import Customer  # noqa: PLC0415

    q = q.strip()
    if not q:
        return []

    # Build filter: match by order id if query is numeric, always match by customer name
    filters = [Customer.full_name.ilike(f"%{q}%")]
    if q.isdigit():
        filters.append(Order.id == int(q))

    stmt = (
        select(Order, Customer.full_name.label("customer_name"))
        .join(Customer, Order.customer_id == Customer.id)
        .where(or_(*filters))
        .order_by(Order.created_at.desc())
        .limit(limit)
    )
    rows = db.execute(stmt).all()
    return [
        {
            "id": row.Order.id,
            "customer_id": row.Order.customer_id,
            "status": row.Order.status,
            "total_amount": row.Order.total_amount,
            "created_at": row.Order.created_at,
            "customer_name": row.customer_name,
        }
        for row in rows
    ]


# ---------------------------------------------------------------------------
# Write operations
# ---------------------------------------------------------------------------

def create_order(db: Session, data: OrderCreate) -> Order:
    """
    Create an order inside a single atomic transaction.

    Steps
    -----
    1. Verify the customer exists.
    2. Verify every requested product exists (fail fast on first missing).
    3. Verify sufficient stock for every item (fail fast on first shortage).
    4. Calculate per-item subtotals and the order total.
    5. Decrement ``stock_quantity`` for every product.
    6. Persist the ``Order`` record (status defaults to ``pending``).
    7. Persist all ``OrderItem`` records.
    8. Commit; refresh and return the fully hydrated ``Order``.

    Raises
    ------
    EmptyOrderError
        If ``data.items`` is empty.
    CustomerNotFoundError
        If ``data.customer_id`` does not match an existing customer.
    ProductNotFoundError
        If any ``product_id`` in ``data.items`` does not exist.
    InsufficientStockError
        If any product's ``stock_quantity`` is less than the requested quantity.
    """
    if not data.items:
        raise EmptyOrderError()

    # --- Step 1: verify customer -------------------------------------------
    _get_customer_or_raise(db, data.customer_id)

    # --- Steps 2 & 3: validate all products and stock in a single pass ------
    products: dict[int, Product] = {}
    for item in data.items:
        if item.product_id not in products:
            products[item.product_id] = _get_product_or_raise(db, item.product_id)

    # Aggregate requested quantities per product to handle duplicate product
    # entries in the same order gracefully.
    requested_qty: dict[int, int] = {}
    for item in data.items:
        requested_qty[item.product_id] = (
            requested_qty.get(item.product_id, 0) + item.quantity
        )

    for product_id, qty in requested_qty.items():
        product = products[product_id]
        if product.stock_quantity < qty:
            raise InsufficientStockError(
                product_id=product_id,
                requested=qty,
                available=product.stock_quantity,
            )

    # --- Steps 4 & 5: compute financials, decrement stock -------------------
    total_amount = Decimal("0.00")
    line_items: list[tuple[int, int, Decimal, Decimal]] = []

    for item in data.items:
        product = products[item.product_id]
        unit_price: Decimal = product.price
        subtotal: Decimal = unit_price * item.quantity
        total_amount += subtotal
        line_items.append((item.product_id, item.quantity, unit_price, subtotal))

    # Decrement stock (aggregated quantities).
    for product_id, qty in requested_qty.items():
        products[product_id].stock_quantity -= qty

    # --- Steps 6 & 7: persist Order and OrderItems -------------------------
    order = Order(
        customer_id=data.customer_id,
        total_amount=total_amount,
        status=OrderStatus.pending,
    )
    db.add(order)
    db.flush()  # populate order.id without committing yet

    for product_id, quantity, unit_price, subtotal in line_items:
        order_item = OrderItem(
            order_id=order.id,
            product_id=product_id,
            quantity=quantity,
            unit_price=unit_price,
            subtotal=subtotal,
        )
        db.add(order_item)

    # --- Step 8: commit and return -----------------------------------------
    db.commit()
    db.refresh(order)
    db.refresh(order, attribute_names=["order_items"])
    return order


def update_order_status(db: Session, order_id: int, status: OrderStatus) -> Order:
    """
    Update the status of an existing order.

    Raises ``OrderNotFoundError`` if the order does not exist.
    """
    order = db.get(Order, order_id)
    if order is None:
        raise OrderNotFoundError(order_id)
    order.status = status
    db.commit()
    db.refresh(order)
    db.refresh(order, attribute_names=["order_items"])
    return order


def delete_order(db: Session, order_id: int) -> None:
    """
    Delete an order (and its items via cascade) by id.

    Raises ``OrderNotFoundError`` if the order does not exist.

    Note: Stock is NOT restored on deletion — if that behaviour is required
    it should be an explicit business decision added here.
    """
    order = db.get(Order, order_id)
    if order is None:
        raise OrderNotFoundError(order_id)
    db.delete(order)
    db.commit()
