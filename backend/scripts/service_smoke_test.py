"""
backend/scripts/service_smoke_test.py
--------------------------------------
Standalone smoke-test for the Ordeer service layer.

Run from the *backend/* directory so that the ``app`` package is importable:

    cd backend
    python -m scripts.service_smoke_test

Or, if you prefer a plain script invocation add the backend dir to PYTHONPATH:

    PYTHONPATH=backend python backend/scripts/service_smoke_test.py

The script requires a running PostgreSQL instance and a valid DATABASE_URL
in backend/.env (or the environment).  It does NOT roll back — each run
inserts real rows, so it is intentionally idempotent-unfriendly (useful to
verify isolation and PK auto-increment behaviour).
"""

from __future__ import annotations

import sys
import traceback

# ---------------------------------------------------------------------------
# Ensure the ``app`` package is on the path when the script is run directly.
# ---------------------------------------------------------------------------
import os

# Insert the backend directory into sys.path so ``from app.xxx import ...``
# resolves correctly regardless of how the script is invoked.
_BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _BACKEND_DIR not in sys.path:
    sys.path.insert(0, _BACKEND_DIR)

# ---------------------------------------------------------------------------
# Application imports (after path fix)
# ---------------------------------------------------------------------------
from app.db.session import SessionLocal  # noqa: E402
from app.schemas.customer import CustomerCreate  # noqa: E402
from app.schemas.order import OrderCreate, OrderItemCreate  # noqa: E402
from app.schemas.product import ProductCreate  # noqa: E402
from app.services import customer_service, order_service, product_service  # noqa: E402
from app.services.order_service import InsufficientStockError  # noqa: E402

SEPARATOR = "-" * 60


def main() -> None:
    db = SessionLocal()

    try:
        # ------------------------------------------------------------------ #
        # Step 1 — Create a customer                                          #
        # ------------------------------------------------------------------ #
        print(SEPARATOR)
        print("Step 1 · Creating customer …")
        customer = customer_service.create_customer(
            db,
            CustomerCreate(
                full_name="Alice Tester",
                email=f"alice_smoke_{os.getpid()}@example.com",  # unique per run
                phone="+1-555-0100",
            ),
        )
        print(f"  ✔  Customer created  →  id={customer.id}")

        # ------------------------------------------------------------------ #
        # Step 2 — Create a product with stock_quantity=10                    #
        # ------------------------------------------------------------------ #
        print(SEPARATOR)
        print("Step 2 · Creating product (stock=10) …")
        product = product_service.create_product(
            db,
            ProductCreate(
                name="Smoke Widget",
                sku=f"SW-SMOKE-{os.getpid()}",   # unique per run
                price="49.99",
                stock_quantity=10,
            ),
        )
        print(f"  ✔  Product created   →  id={product.id}, stock={product.stock_quantity}")

        # ------------------------------------------------------------------ #
        # Step 3 — Create an order for quantity=3                             #
        # ------------------------------------------------------------------ #
        print(SEPARATOR)
        print("Step 3 · Creating order (qty=3) …")
        order = order_service.create_order(
            db,
            OrderCreate(
                customer_id=customer.id,
                items=[OrderItemCreate(product_id=product.id, quantity=3)],
            ),
        )

        # Reload product to get the updated stock_quantity.
        db.refresh(product)
        remaining_stock = product.stock_quantity

        print(f"  ✔  Order created")
        print()
        print(f"  customer id    : {customer.id}")
        print(f"  product id     : {product.id}")
        print(f"  order id       : {order.id}")
        print(f"  order total    : {order.total_amount}")
        print(f"  remaining stock: {remaining_stock}")

        # ------------------------------------------------------------------ #
        # Step 4 — Attempt an order that exceeds available stock (qty=8)      #
        #          Only 7 units remain after the first order.                 #
        # ------------------------------------------------------------------ #
        print(SEPARATOR)
        print("Step 4 · Attempting over-stock order (qty=8, available=7) …")
        try:
            order_service.create_order(
                db,
                OrderCreate(
                    customer_id=customer.id,
                    items=[OrderItemCreate(product_id=product.id, quantity=8)],
                ),
            )
            # Should never reach here.
            print("  ✘  ERROR: expected InsufficientStockError was NOT raised!")
            sys.exit(1)

        except InsufficientStockError as exc:
            print(f"  ✔  InsufficientStockError caught as expected:")
            print(f"       {exc}")
            print()
            print("  ✔  Inventory validation works correctly.")

        print(SEPARATOR)
        print("Smoke test passed ✔")

    except Exception:
        print(SEPARATOR)
        print("Smoke test FAILED — unexpected exception:")
        traceback.print_exc()
        sys.exit(1)

    finally:
        db.close()


if __name__ == "__main__":
    main()
