"""
scripts/seed_demo_data.py
-------------------------
Deterministic demo-data seeder for Ordeer.

Run from the *backend* directory:
    python -m scripts.seed_demo_data

What it does
~~~~~~~~~~~~
1.  Safely wipes all existing rows (order_items -> orders -> customers -> products).
2.  Inserts ~100 products across 8 realistic categories.
3.  Inserts ~80 customers with names from multiple regions.
4.  Inserts ~400 completed orders spread across the last 12 months, each
    containing 1-6 order-items.
5.  Deducts stock correctly; never allows negative inventory.
6.  Plants a handful of records with today / yesterday / last-week timestamps
    so the dashboard "recent activity" feed looks alive.

The random seed is fixed (SEED = 42) so every run produces the exact same
dataset -- important for recruiter screenshots.
"""

from __future__ import annotations

import os
import random
import sys
from datetime import datetime, timedelta, timezone
from decimal import Decimal, ROUND_HALF_UP

# ---------------------------------------------------------------------------
# Path bootstrap: allow "python -m scripts.seed_demo_data" from backend/
# ---------------------------------------------------------------------------
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env"))

from sqlalchemy.orm import Session

from app.db.init_db import create_tables
from app.db.session import SessionLocal
from app.models import Customer, Order, OrderItem, Product
from app.models.order import OrderStatus

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
SEED = 42
rng = random.Random(SEED)

NOW = datetime.now(tz=timezone.utc)
ONE_YEAR_AGO = NOW - timedelta(days=365)

TARGET_PRODUCTS  = 100
TARGET_CUSTOMERS = 80
TARGET_ORDERS    = 380

# ---------------------------------------------------------------------------
# Product catalogue  (category, name, sku_prefix, min_price, max_price)
# Prices in INR (paise not used; just integer rupees for simplicity)
# ---------------------------------------------------------------------------
PRODUCT_CATALOGUE = [
    # Electronics
    ("Electronics", "Apple MacBook Pro 14-inch (M3)",       "ELEC-MBP14",  149999, 179999),
    ("Electronics", "Apple MacBook Air 15-inch (M2)",       "ELEC-MBA15",   99999, 114999),
    ("Electronics", "Dell XPS 15 Laptop",                   "ELEC-XPS15",  119999, 139999),
    ("Electronics", "Lenovo ThinkPad X1 Carbon",            "ELEC-TPX1",    89999, 104999),
    ("Electronics", "ASUS ZenBook Pro 14",                  "ELEC-ZBP14",   74999,  84999),
    ("Electronics", "HP Spectre x360 13",                   "ELEC-SPX13",   84999,  99999),
    ("Electronics", "Microsoft Surface Pro 9",              "ELEC-MSP9",    89999, 104999),
    ("Electronics", "Samsung Galaxy Tab S9 Ultra",          "ELEC-GTS9U",   99999, 119999),
    ("Electronics", "Apple iPad Pro 12.9-inch (M2)",        "ELEC-IPADP",   89999, 109999),
    ("Electronics", "Kindle Paperwhite (16 GB)",            "ELEC-KINDLE",   9999,  13999),
    # Monitors
    ("Electronics", "Dell 27\" 4K USB-C Monitor (U2723D)",  "MON-DEL27",    39999,  49999),
    ("Electronics", "LG 32\" UltraWide QHD Monitor",        "MON-LG32U",    34999,  42999),
    ("Electronics", "Samsung 27\" Odyssey G7 QHD 240Hz",    "MON-SAM27G",   39999,  49999),
    ("Electronics", "ASUS ProArt 27\" 4K OLED Monitor",     "MON-ASPA27",   74999,  89999),
    ("Electronics", "BenQ PD2725U 27\" 4K Designer",        "MON-BNQ27",    44999,  54999),
    # Peripherals
    ("Peripherals", "Logitech MX Master 3S Mouse",          "PERI-MXMS3",    7499,   8999),
    ("Peripherals", "Apple Magic Mouse",                     "PERI-APMM",    6499,   7499),
    ("Peripherals", "Razer DeathAdder V3 Pro",              "PERI-RZDAV3",   9999,  11999),
    ("Peripherals", "Microsoft Sculpt Ergonomic Mouse",     "PERI-MSEM",     3999,   4999),
    ("Peripherals", "Logitech MX Keys S Keyboard",          "PERI-MXKS",     9499,  10999),
    ("Peripherals", "Apple Magic Keyboard with Touch ID",   "PERI-APMK",     9499,  10999),
    ("Peripherals", "Keychron Q1 Pro Mechanical Keyboard",  "PERI-KCQ1",    12499,  15999),
    ("Peripherals", "Logitech MX Keys Mini for Mac",        "PERI-MXKM",     8499,   9999),
    ("Peripherals", "HP LaserJet Pro M404n Printer",        "PERI-HPLJ",    17999,  21999),
    ("Peripherals", "Canon PIXMA G3770 Printer",            "PERI-CANPX",   10999,  13999),
    ("Peripherals", "Epson EcoTank L3250",                  "PERI-EPET",     9499,  11999),
    ("Peripherals", "Logitech C920 HD Pro Webcam",          "PERI-LC920",    6999,   8499),
    ("Peripherals", "Elgato Facecam Pro 4K Webcam",         "PERI-ELGFC",   17999,  21999),
    # Audio
    ("Audio", "Sony WH-1000XM5 Headphones",           "AUDIO-SXMS5",  26990,  29990),
    ("Audio", "Apple AirPods Pro (2nd Gen)",           "AUDIO-AAPP2",  24900,  26900),
    ("Audio", "Bose QuietComfort 45",                  "AUDIO-BQC45",  24900,  28900),
    ("Audio", "Jabra Evolve2 85 Wireless",             "AUDIO-JAB85",  29900,  34900),
    ("Audio", "Sennheiser Momentum 4 Wireless",        "AUDIO-SEM4W",  27990,  31990),
    ("Audio", "Apple AirPods (3rd Gen)",               "AUDIO-AAP3",   19900,  20900),
    ("Audio", "JBL Flip 6 Portable Speaker",           "AUDIO-JBLF6",   9999,  11999),
    ("Audio", "Sonos Era 100 Speaker",                 "AUDIO-SONE1",  22999,  25999),
    ("Audio", "Blue Yeti USB Microphone",              "AUDIO-BYETI",  10999,  13999),
    ("Audio", "Focusrite Scarlett Solo (4th Gen)",     "AUDIO-FSS4",   10999,  12999),
    # Storage
    ("Storage", "Samsung 990 Pro NVMe SSD 1TB",          "STOR-S990P1",  10999,  13499),
    ("Storage", "Samsung T7 Shield Portable SSD 2TB",    "STOR-T7S2T",    8499,   9999),
    ("Storage", "WD Black SN850X NVMe SSD 2TB",          "STOR-WDSN2",   14999,  17999),
    ("Storage", "Seagate Barracuda HDD 4TB",             "STOR-SGB4T",    4999,   6499),
    ("Storage", "SanDisk Extreme Pro Portable SSD 4TB",  "STOR-SDEP4",   19999,  23999),
    ("Storage", "Kingston Canvas React Plus SD 256GB",   "STOR-KCRP2",    2499,   3499),
    ("Storage", "Lexar PLAY 2TB microSDXC",              "STOR-LXPL2",    4499,   5499),
    ("Storage", "Crucial BX500 SSD 1TB (SATA)",          "STOR-CBX1T",    5999,   7499),
    # Networking
    ("Networking", "TP-Link Archer AX55 Wi-Fi 6 Router",   "NET-TPAX55",   6999,   8499),
    ("Networking", "ASUS RT-AX88U Pro Wi-Fi 6 Router",     "NET-ASAX88",  19999,  23999),
    ("Networking", "Netgear Orbi RBK863S Mesh (3-pack)",   "NET-NORB3P",  49999,  59999),
    ("Networking", "TP-Link Deco XE75 Mesh Wi-Fi 6E",      "NET-TPXE75",  19999,  24999),
    ("Networking", "Ubiquiti UniFi Dream Machine Pro",      "NET-UBDMP",   49999,  59999),
    ("Networking", "Cisco SG110D-08HP Ethernet Switch",    "NET-CSG10",    5999,   7499),
    ("Networking", "Synology RT6600ax Tri-Band Router",    "NET-SYNRT66", 24999,  28999),
    ("Networking", "TP-Link TL-SG116E 16-Port Switch",     "NET-TLSG16",   4499,   5499),
    # Accessories
    ("Accessories", "Anker 555 USB-C Hub (10-in-1)",         "ACC-ANK55",   3499,   4499),
    ("Accessories", "CalDigit TS4 Thunderbolt 4 Dock",       "ACC-CDTS4",  34999,  39999),
    ("Accessories", "Belkin 12-in-1 Thunderbolt 4 Dock",    "ACC-BEL12",  27999,  31999),
    ("Accessories", "Apple MagSafe Charger (2m)",            "ACC-APMSFC",  3299,   3699),
    ("Accessories", "Anker 737 GaN Charger 120W",            "ACC-ANK737",  6499,   7499),
    ("Accessories", "Baseus 65W GaN Travel Charger",         "ACC-BSGC65",  2999,   3799),
    ("Accessories", "Apple USB-C to MagSafe 3 Cable",        "ACC-APCMSC",  2999,   3499),
    ("Accessories", "Belkin 3-in-1 MagSafe Charging Stand", "ACC-BEL3MS",  9999,  11999),
    ("Accessories", "Satechi Dual Monitor Stand Arm",        "ACC-SATDM",   9999,  12499),
    ("Accessories", "Laptop Privacy Screen Filter 15.6in",   "ACC-PSCF15",  1999,   2999),
    ("Accessories", "Kensington MicroSaver Laptop Lock",     "ACC-KMSL",    1499,   1999),
    ("Accessories", "Peak Design Everyday Backpack 30L",     "ACC-PDEB3",  17999,  21999),
    ("Accessories", "Herschel Little America Backpack",      "ACC-HSLA",    6999,   8499),
    ("Accessories", "Moment Laptop Sleeve 16-inch",          "ACC-MOLS16",  2499,   3499),
    # Office Supplies
    ("Office Supplies", "Moleskine Classic Hardcover Notebook XL", "OFC-MLSNB",  1299,   1799),
    ("Office Supplies", "Rhodia Dot-Pad A4 Notebook",              "OFC-RHODP",   799,   1099),
    ("Office Supplies", "Leuchtturm1917 Bullet Journal A5",        "OFC-LTJN",   1499,   1999),
    ("Office Supplies", "Pilot G2 Gel Pens (12-pack)",             "OFC-PLG2",    799,   1099),
    ("Office Supplies", "Zebra Sarasa Clip Gel Pen (20-pack)",     "OFC-ZBSC",    999,   1299),
    ("Office Supplies", "Staedtler Mars Mechanical Pencil Set",    "OFC-STMM",    999,   1499),
    ("Office Supplies", "3M Post-it Super Sticky Notes (10-pack)", "OFC-3MST",    699,    999),
    ("Office Supplies", "Avery 5160 Address Labels (750-pack)",    "OFC-AV52",    599,    899),
    ("Office Supplies", "Scotch Heavy-Duty Shipping Tape (6-pack)","OFC-SCH6P",   599,    799),
    ("Office Supplies", "Fellowes Powershred 99Ci Shredder",       "OFC-FWPS",  14999,  17999),
    ("Office Supplies", "Leitz WOW Stapler Set",                   "OFC-LZWW",   1299,   1799),
    ("Office Supplies", "Pendaflex Hanging File Folders (25-pack)","OFC-PDHF",    799,   1099),
    # Furniture
    ("Furniture", "Herman Miller Aeron Chair (Size B)",    "FURN-HMAC",  99999, 119999),
    ("Furniture", "Secretlab TITAN Evo 2022 Chair",        "FURN-SLTE",  34999,  39999),
    ("Furniture", "FlexiSpot E7 Pro Standing Desk",        "FURN-FXSP",  27999,  32999),
    ("Furniture", "Uplift V2 4-Leg Commercial Desk",       "FURN-UPLV2", 44999,  54999),
    ("Furniture", "IKEA Bekant Corner Desk",               "FURN-IKBK",   9999,  12999),
    ("Furniture", "IKEA Alex Drawer Unit",                 "FURN-IKAD",   7999,   9999),
    ("Furniture", "3M Adjustable Monitor Stand",           "FURN-3MMS",   3999,   5499),
    ("Furniture", "Humanscale M8.1 Monitor Arm",           "FURN-HSM8",  12999,  15999),
]

# ---------------------------------------------------------------------------
# Customer data pools
# ---------------------------------------------------------------------------
FIRST_NAMES = [
    # Indian
    "Aryan", "Priya", "Rohan", "Sneha", "Vikram", "Ananya", "Karthik", "Divya",
    "Rahul", "Meera", "Aditya", "Pooja", "Siddharth", "Nisha", "Gaurav", "Kavya",
    "Manish", "Shreya", "Deepak", "Riya", "Amit", "Neha", "Suresh", "Pallavi",
    # Western
    "James", "Emily", "Michael", "Sarah", "David", "Jessica", "Christopher", "Ashley",
    "Matthew", "Jennifer", "Andrew", "Amanda", "Daniel", "Megan", "Ryan", "Lauren",
    "Kevin", "Stephanie", "Brian", "Nicole",
    # East Asian
    "Wei", "Lin", "Ming", "Fang", "Tao", "Hui", "Yuki", "Hana", "Kenji", "Sakura",
    # European
    "Luca", "Sofia", "Marco", "Elena", "Hans", "Anna", "Pierre", "Marie",
    # Latin American
    "Carlos", "Maria", "Juan", "Ana", "Luis", "Isabella",
]

LAST_NAMES = [
    # Indian
    "Sharma", "Patel", "Singh", "Kumar", "Verma", "Gupta", "Mehta", "Joshi",
    "Nair", "Reddy", "Iyer", "Agarwal", "Malhotra", "Kapoor", "Bose", "Pillai",
    # Western
    "Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis",
    "Wilson", "Taylor", "Anderson", "Thomas", "Jackson", "White", "Harris", "Martin",
    # East Asian
    "Chen", "Wang", "Li", "Zhang", "Liu", "Yang", "Yamamoto", "Nakamura", "Tanaka",
    # European
    "Rossi", "Ferrari", "Mueller", "Schmidt", "Dupont", "Bernard",
    # Latin American
    "Rodriguez", "Lopez", "Hernandez", "Martinez",
]

EMAIL_DOMAINS = [
    "gmail.com", "yahoo.com", "outlook.com", "hotmail.com",
    "protonmail.com", "icloud.com", "rediffmail.com", "ymail.com",
    "techynar.com", "example.com",
]

COUNTRY_CODES = ["+91", "+1", "+44", "+81", "+49", "+33", "+61"]
COUNTRY_CODE_WEIGHTS = [50, 20, 8, 5, 5, 5, 7]


def _rand_phone() -> str:
    code = rng.choices(COUNTRY_CODES, weights=COUNTRY_CODE_WEIGHTS, k=1)[0]
    if code == "+91":
        num = rng.randint(7_000_000_000, 9_999_999_999)
        return f"{code} {num}"
    elif code == "+1":
        area = rng.randint(200, 999)
        rest = rng.randint(1_000_000, 9_999_999)
        return f"{code} ({area}) {str(rest)[:3]}-{str(rest)[3:]}"
    else:
        num = rng.randint(100_000_000, 999_999_999)
        return f"{code} {num}"


def wipe_data(db: Session) -> None:
    print("  -> Clearing existing data ...")
    db.query(OrderItem).delete()
    db.query(Order).delete()
    db.query(Customer).delete()
    db.query(Product).delete()
    db.commit()
    print("  -> Database cleared.")


# ---------------------------------------------------------------------------
# Seed: Products
# ---------------------------------------------------------------------------
def seed_products(db: Session) -> list[Product]:
    print(f"  -> Seeding {TARGET_PRODUCTS} products ...")

    products: list[Product] = []
    used_skus: set[str] = set()
    catalogue = list(PRODUCT_CATALOGUE)
    rng.shuffle(catalogue)

    # Cycle the catalogue to reach exactly TARGET_PRODUCTS
    extended = (catalogue * ((TARGET_PRODUCTS // len(catalogue)) + 2))[:TARGET_PRODUCTS]

    for i, (category, name, sku_prefix, min_p, max_p) in enumerate(extended):
        # Unique SKU
        sku_base = f"{sku_prefix}-{i+1:03d}"
        sku = sku_base
        counter = 1
        while sku in used_skus:
            sku = f"{sku_base}-{counter}"
            counter += 1
        used_skus.add(sku)

        # Price with retail rounding
        price_raw = rng.randint(min_p, max_p)
        if price_raw >= 10_000:
            price_raw = (price_raw // 1000) * 1000 - 1   # e.g. 26999
        elif price_raw >= 1_000:
            price_raw = (price_raw // 100) * 100 - 1     # e.g. 8499
        price = Decimal(str(price_raw))

        # Stock distribution
        chance = rng.random()
        if chance < 0.04:          # ~4% out of stock
            stock = 0
        elif chance < 0.20:        # ~16% low stock
            stock = rng.randint(1, 10)
        elif chance < 0.70:        # ~50% moderate
            stock = rng.randint(11, 100)
        else:                      # ~30% well-stocked
            stock = rng.randint(101, 500)

        # Spread created_at over the past year, skewed toward more recent months
        months_ago = rng.choices(
            range(1, 13),
            weights=[13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2],
            k=1,
        )[0]
        created = NOW - timedelta(days=months_ago * 30 + rng.randint(0, 29))
        created = created.replace(
            hour=rng.randint(8, 18),
            minute=rng.randint(0, 59),
            second=0,
            microsecond=0,
        )

        p = Product(
            name=f"[{category}] {name}",
            sku=sku,
            price=price,
            stock_quantity=stock,
            created_at=created,
            updated_at=created,
        )
        db.add(p)
        products.append(p)

    db.flush()
    print(f"  -> {len(products)} products created.")
    return products


# ---------------------------------------------------------------------------
# Seed: Customers
# ---------------------------------------------------------------------------
def seed_customers(db: Session) -> list[Customer]:
    print(f"  -> Seeding {TARGET_CUSTOMERS} customers ...")

    customers: list[Customer] = []
    used_emails: set[str] = set()

    first_names = list(FIRST_NAMES)
    last_names  = list(LAST_NAMES)
    rng.shuffle(first_names)
    rng.shuffle(last_names)

    for i in range(TARGET_CUSTOMERS):
        fn = first_names[i % len(first_names)]
        ln = last_names[i % len(last_names)]

        base_email = f"{fn.lower()}.{ln.lower()}"
        domain = rng.choice(EMAIL_DOMAINS)
        email  = f"{base_email}@{domain}"
        attempt = 1
        while email in used_emails:
            email = f"{base_email}{attempt}@{domain}"
            attempt += 1
        used_emails.add(email)

        months_ago = rng.choices(
            range(1, 14),
            weights=[14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2],
            k=1,
        )[0]
        reg_date = NOW - timedelta(days=months_ago * 28 + rng.randint(0, 27))
        reg_date = reg_date.replace(
            hour=rng.randint(7, 22),
            minute=rng.randint(0, 59),
            second=0,
            microsecond=0,
        )

        c = Customer(
            full_name=f"{fn} {ln}",
            email=email,
            phone=_rand_phone(),
            created_at=reg_date,
        )
        db.add(c)
        customers.append(c)

    db.flush()
    print(f"  -> {len(customers)} customers created.")
    return customers


# ---------------------------------------------------------------------------
# Seed: Orders
# ---------------------------------------------------------------------------
def seed_orders(
    db: Session,
    products: list[Product],
    customers: list[Customer],
) -> list[Order]:
    print(f"  -> Seeding ~{TARGET_ORDERS} orders ...")

    # Separate orderable products (stock > 0)
    available = [p for p in products if p.stock_quantity > 0]

    # Virtual stock tracking to prevent negative inventory
    virtual_stock: dict[int, int] = {p.id: p.stock_quantity for p in products}

    # 20% power buyers drive ~60% of orders
    n_customers = len(customers)
    power_buyer_count = max(1, int(n_customers * 0.20))
    power_buyers = rng.sample(customers, power_buyer_count)
    regular_buyers = [c for c in customers if c not in power_buyers]
    customer_pool = power_buyers * 5 + regular_buyers

    # 20% popular products appear more often
    n_products = len(available)
    popular_count = max(1, int(n_products * 0.20))
    popular_products = rng.sample(available, popular_count)
    regular_products = [p for p in available if p not in popular_products]
    product_pool = popular_products * 4 + regular_products

    # Status weights
    status_choices = [
        OrderStatus.completed,
        OrderStatus.completed,
        OrderStatus.completed,
        OrderStatus.completed,
        OrderStatus.completed,
        OrderStatus.processing,
        OrderStatus.processing,
        OrderStatus.pending,
        OrderStatus.cancelled,
    ]

    orders: list[Order] = []
    order_count = 0

    for _ in range(TARGET_ORDERS + 20):  # overshoot slightly to account for skips
        # Date: skewed toward more recent months
        months_ago = rng.choices(
            range(0, 13),
            weights=[20, 18, 15, 12, 10, 8, 7, 6, 5, 4, 3, 2, 1],
            k=1,
        )[0]
        if months_ago == 0:
            days_ago = rng.randint(0, max(NOW.day - 1, 0))
        else:
            days_ago = months_ago * 30 + rng.randint(0, 29)

        order_date = NOW - timedelta(days=days_ago)
        order_date = order_date.replace(
            hour=rng.randint(7, 22),
            minute=rng.randint(0, 59),
            second=rng.randint(0, 59),
            microsecond=0,
        )

        customer = rng.choice(customer_pool)

        # Number of line items per order
        n_items = rng.choices([1, 2, 3, 4, 5, 6], weights=[30, 25, 20, 12, 8, 5], k=1)[0]

        # Select products with available stock
        rng.shuffle(product_pool)
        selected_items: list[tuple[Product, int]] = []
        seen_product_ids: set[int] = set()

        for candidate in product_pool:
            if len(selected_items) >= n_items:
                break
            if candidate.id in seen_product_ids:
                continue
            avail = virtual_stock.get(candidate.id, 0)
            if avail <= 0:
                continue
            max_qty = min(avail, rng.choices([1, 2, 3, 4, 5], weights=[45, 30, 15, 7, 3], k=1)[0])
            qty = rng.randint(1, max(1, max_qty))
            selected_items.append((candidate, qty))
            seen_product_ids.add(candidate.id)

        if not selected_items:
            continue

        status = rng.choice(status_choices)

        total = Decimal("0.00")
        order_items: list[OrderItem] = []

        for product, qty in selected_items:
            if status in (OrderStatus.completed, OrderStatus.processing):
                virtual_stock[product.id] = max(0, virtual_stock[product.id] - qty)

            unit_price = product.price
            subtotal = (unit_price * qty).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
            total += subtotal

            order_items.append(OrderItem(
                product_id=product.id,
                quantity=qty,
                unit_price=unit_price,
                subtotal=subtotal,
            ))

        order = Order(
            customer_id=customer.id,
            status=status,
            total_amount=total.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP),
            created_at=order_date,
            updated_at=order_date,
        )
        db.add(order)
        db.flush()

        for oi in order_items:
            oi.order_id = order.id
            db.add(oi)

        orders.append(order)
        order_count += 1

        if order_count >= TARGET_ORDERS:
            break

    # Sync real product stock with virtual consumption
    for product in products:
        remaining = virtual_stock.get(product.id, product.stock_quantity)
        product.stock_quantity = max(0, remaining)

    db.flush()
    print(f"  -> {order_count} orders created.")
    return orders


# ---------------------------------------------------------------------------
# Plant recent activity so the dashboard feed looks live
# ---------------------------------------------------------------------------
def plant_recent_activity(
    db: Session,
    products: list[Product],
    customers: list[Customer],
    orders: list[Order],
) -> None:
    print("  -> Planting recent activity timestamps ...")

    today_base = NOW.replace(hour=0, minute=0, second=0, microsecond=0)

    # 3 orders from today
    recent_orders = rng.sample(orders, min(3, len(orders)))
    for order in recent_orders:
        ts = today_base + timedelta(
            hours=rng.randint(8, max(8, NOW.hour - 1) if NOW.hour > 8 else 8),
            minutes=rng.randint(0, 59),
        )
        order.created_at = ts
        order.updated_at = ts

    # 2 orders from yesterday
    yesterday_pool = [o for o in orders if o not in recent_orders]
    yesterday_orders = rng.sample(yesterday_pool, min(2, len(yesterday_pool)))
    for order in yesterday_orders:
        ts = (today_base - timedelta(days=1)) + timedelta(hours=rng.randint(9, 20), minutes=rng.randint(0, 59))
        order.created_at = ts
        order.updated_at = ts

    # 2 orders from this week
    week_pool = [o for o in orders if o not in recent_orders and o not in yesterday_orders]
    week_orders = rng.sample(week_pool, min(2, len(week_pool)))
    for order in week_orders:
        days_back = rng.randint(2, 6)
        ts = (today_base - timedelta(days=days_back)) + timedelta(hours=rng.randint(9, 20), minutes=rng.randint(0, 59))
        order.created_at = ts
        order.updated_at = ts

    # 2 customers registered recently
    recent_customers = rng.sample(customers, min(2, len(customers)))
    for idx, customer in enumerate(recent_customers):
        ts = (today_base - timedelta(days=idx)) + timedelta(hours=rng.randint(10, 18), minutes=rng.randint(0, 59))
        customer.created_at = ts

    # 2 products added this week
    recent_products = rng.sample(products, min(2, len(products)))
    for product in recent_products:
        days_back = rng.randint(0, 4)
        ts = (today_base - timedelta(days=days_back)) + timedelta(hours=rng.randint(9, 17))
        product.created_at = ts
        product.updated_at = ts

    db.flush()
    print("  -> Recent activity timestamps planted.")


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------
def main() -> None:
    print()
    print("=" * 60)
    print("  Ordeer -- Demo Data Seeder  (fixed seed=42)")
    print("=" * 60)
    print()

    print("[1/6] Ensuring database tables exist ...")
    create_tables()
    print("  OK: Tables ready.")
    print()

    db: Session = SessionLocal()
    try:
        print("[2/6] Wiping existing data ...")
        wipe_data(db)
        print()

        print("[3/6] Seeding products ...")
        products = seed_products(db)
        print()

        print("[4/6] Seeding customers ...")
        customers = seed_customers(db)
        print()

        print("[5/6] Seeding orders ...")
        orders = seed_orders(db, products, customers)
        print()

        print("[6/6] Planting recent activity ...")
        plant_recent_activity(db, products, customers, orders)
        print()

        db.commit()

        # Summary stats
        total_revenue = sum(
            o.total_amount for o in orders
            if o.status == OrderStatus.completed
        )
        low_stock    = sum(1 for p in products if 0 < p.stock_quantity <= 10)
        out_of_stock = sum(1 for p in products if p.stock_quantity == 0)

        print("=" * 60)
        print("  SEED COMPLETE")
        print("=" * 60)
        print(f"  Products   : {len(products):>5}  ({low_stock} low-stock, {out_of_stock} out-of-stock)")
        print(f"  Customers  : {len(customers):>5}")
        print(f"  Orders     : {len(orders):>5}")
        print(f"  Revenue    : Rs. {int(total_revenue):>10,}  (completed orders only)")
        print("=" * 60)
        print()

    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
