# Re-export every ORM model from a single location so that:
#
# 1. All mapper classes are registered with SQLAlchemy's metadata before
#    Base.metadata.create_all() is called in app/db/init_db.py.
# 2. Callers can do: from app.models import Product, Customer, Order, OrderItem

from app.models.customer import Customer
from app.models.order import Order
from app.models.order_item import OrderItem
from app.models.product import Product

__all__ = [
    "Customer",
    "Order",
    "OrderItem",
    "Product",
]
