# Ordeer

Ordeer is a production-grade, high-density **Inventory & Order Management Platform** designed to streamline operations, reduce transaction processing latency, and guarantee atomic inventory validation for retail and distribution businesses.

![Dashboard](docs/screenshots/dashboard-overview.png)

<div align="center">

[![Build Status](https://img.shields.io/badge/Build-passing-brightgreen.svg)](#)
[![React](https://img.shields.io/badge/Frontend-React-61DAFB.svg?logo=react&logoColor=white)](#)
[![Vercel](https://img.shields.io/badge/Hosting-Vercel-000000.svg?logo=vercel&logoColor=white)](#)
[![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688.svg?logo=fastapi&logoColor=white)](#)
[![Render](https://img.shields.io/badge/Hosting-Render-46E3B7.svg?logo=render&logoColor=white)](#)
[![PostgreSQL](https://img.shields.io/badge/Database-PostgreSQL-4169E1.svg?logo=postgresql&logoColor=white)](#)
[![Docker](https://img.shields.io/badge/Infrastructure-Docker-2496ED.svg?logo=docker&logoColor=white)](#)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

</div>

---

> [!TIP]
> **Live Sandbox Access**
> - **Client URL:** [https://ordeer.techynar.com](https://ordeer.techynar.com)
> - **API Endpoint:** [https://ordeer.onrender.com](https://ordeer.onrender.com)
> - **Interactive API Docs:** [https://ordeer.onrender.com/docs](https://ordeer.onrender.com/docs)
>
> **Demo Credentials**
> - **Username:** `admin`
> - **Password:** `admin`
> - *You can also bypass manual typing by clicking the **Demo Login** button on the sign-in screen to authenticate instantly.*

---

## Features at a Glance

* **Dashboard Analytics:** Unified monitoring of sales revenue, low-stock warnings, and recent order status.
* **Strict SKU & Stock Control:** Intuitive catalog management with backend database-level rules preventing overselling or duplicate SKUs.
* **Customer Directory:** Seamless customer profile registration, order histories, and aggregate total spend statistics.
* **Guided Order Wizard:** A multi-step transaction process featuring interactive stock-level checks before checkout.
* **Global Command Palette:** Instant keyboard navigation (`Cmd+K` / `Ctrl+K`) to search products, orders, and customers from any page.
* **Responsive Design:** Adaptive layouts styled with custom CSS properties, optimized for handheld warehouse scanners and mobile phones.
* **Concurrent Transaction Safeguards:** Underpinned by PostgreSQL transaction locks to eliminate double-selling race conditions.

---

## Why Ordeer? (The Problem & Solution)

Traditional legacy inventory systems often rely on spreadsheet-like UIs and polling APIs. In environments with shared stock and rapid order cycles, this architecture fails, causing data inconsistency and worker frustration.

| Legacy System Bottlenecks | The Ordeer Solution |
| :--- | :--- |
| **Overselling & Race Conditions:** Two agents checkout the same item simultaneously, leading to negative stock levels or failed delivery promises. | **ACID-Compliant Row Locking:** Employs backend transactional row locks (`SELECT FOR UPDATE`), preventing race conditions at the database level. |
| **High Cognitive Load:** Spreadsheets with hundred-column layouts distract operators and increase training times. | **Information-Dense Minimalism:** High-density, border-separated workspaces. Modals and slide-overs preserve context. |
| **Navigational Friction:** Clicking back-and-forth between pages to check stock, look up orders, or register customer profiles. | **Global Command Palette:** Complete lookup and control without lifting hands from the keyboard. |
| **Heavy UI Overhead:** Unnecessary styling engines (like Tailwind) and bloated script payloads slow down field devices. | **Custom CSS & Vite Build:** Pure, decoupled CSS system variables and Vite SPA for near-instant rendering. |

---

## System Architecture & Workflow

Ordeer splits client presentation and transactional server operations into a clean, decoupled monorepo:

```text
                               ┌───────────────────────────────────┐
                               │       React + Vite Frontend       │
                               │         (Hosted on Vercel)        │
                               └─────────────────┬─────────────────┘
                                                 │
                                                 │ HTTPS Requests (/api/*)
                                                 ▼
                               ┌───────────────────────────────────┐
                               │          FastAPI Backend          │
                               │         (Hosted on Render)        │
                               └─────────────────┬─────────────────┘
                                                 │
                                                 │ SQLAlchemy 2.0 (Async Session)
                                                 ▼
                               ┌───────────────────────────────────┐
                               │         Render PostgreSQL         │
                               │            (Database)             │
                               └───────────────────────────────────┘
```

### Transactional Lifecycle Flow

The diagram below details the path of an order creation transaction, showing how the backend secures stock quantities before committing modifications:

```mermaid
graph TD
    A[User Selects / Creates Customer] --> B[Browse Products & Check Live In-Memory Quantities]
    B --> C[Launch Guided Order Wizard]
    C --> D[Select Customer & Add Multiple Order Items]
    D --> E{Validate Item Quantities Against UI Stock State}
    E -->|Insufficient UI Stock| F[Show Local Toast Alert & Lock Quantity Addition]
    E -->|Stock Verified in UI| G[Submit Order Transaction Request to FastAPI]
    G --> H[FastAPI Opens Database Transaction]
    H --> I[SELECT FOR UPDATE row-locks Products in PostgreSQL]
    I -->{PostgreSQL Database Stock Check}
    I -->|Stock Depleted or Racing| J[Rollback Database Transaction & Return HTTP 400 Bad Request]
    I -->|Stock Confirmed| K[Deduct Quantities, Insert Order & OrderItem Rows]
    K --> L[Commit Transaction]
    L --> M[Refresh Dashboard Stats, Total Sales & Low Stock Warnings]
```

---

## Core Product Modules

### 1. Dashboard & Operations
The central dashboard serves as an operations control room. It provides key performance indicators (KPIs)—including Total Revenue, Orders Processed, Customer Counts, and Active SKUs. A dedicated panel alerts warehouse operators of low-stock thresholds, allowing them to initiate restocks. Recent orders are displayed with status badges for easy tracking.

![Dashboard](docs/screenshots/dashboard-overview.png)

---

### 2. Product & Inventory Management
The product module displays inventory stocks, listing individual items with unique SKUs, price tags, and current quantities. It includes an interactive slide-over drawer that keeps the catalog table visible in the background while adding new products or updating existing items.

![Products](docs/screenshots/products-list.png)

#### Detailed Product Insights
Clicking any product row opens its dedicated details sheet. This reveals aggregate lifecycles metrics (Total Revenue generated, Lifetime Order Counts, and the date of the last purchase) alongside a ledger listing every historical order containing the item.

![Product Details](docs/screenshots/product-details.png)

---

### 3. Customer Directory
The customer list maintains a record of customer contacts (names, emails, and phone numbers). It displays live-calculated metrics for each user, including lifetime orders placed and total spend.

![Customers](docs/screenshots/customers-list.png)

#### Customer Profiles & Ledger
Opening a customer profile presents contact details alongside a chronological list of their order history.

![Customer Details](docs/screenshots/customer-details.png)

---

### 4. Order Management
The main orders table lists all completed and pending orders, complete with customer details, order creation timestamps, and final invoice values.

![Orders](docs/screenshots/orders-list.png)

#### Guided Order Wizard
Initiating a sale launches a multi-stage Order Wizard. Operators select the customer, search and add items from the catalog, and adjust quantities. The wizard validates input against available stock in real-time, preventing workers from submitting an order with insufficient quantities.

![Order Wizard](docs/screenshots/order-wizard.png)

---

### 5. UI Features & Keyboard Shortcuts

#### Global Command Palette
Pressing `Cmd+K` or `Ctrl+K` launches an overlay search input. This allows operators to quickly search for products, customers, or navigate directly to specific management views.

![Command Palette](docs/screenshots/command-palette.png)

#### Responsive Mobile Layout
Designed for mobile warehouse terminals, the navigation sidebar collapses on smaller viewports. Layout items stack vertically to remain readable on handheld scanners and tablets.

![Mobile](docs/screenshots/mobile-layout.png)

---

### 6. Authentication
The login page handles access control. A built-in demo account and a **Demo Login** button are provided for quickly exploring the application. Clicking **Demo Login** bypasses password verification and starts an evaluation administrator session immediately.

![Login](docs/screenshots/login-screen.png)

---

## Codebase Structure

The project is structured as a monorepo separating server-side Python logic and React frontend builds:

```text
Ordeer/
├── backend/
│   ├── app/
│   │   ├── api/            # API routing and dependencies
│   │   │   ├── deps.py     # Database session injection
│   │   │   └── routes/     # Resource routes (dashboard, products, customers, orders)
│   │   ├── core/           # Configuration loaders (pydantic-settings)
│   │   ├── db/             # Session engines and metadata base classes
│   │   ├── models/         # SQLAlchemy database models
│   │   ├── schemas/        # Pydantic serialization models
│   │   └── services/       # Core business logic & transactional validation
│   │       ├── customer_service.py
│   │       ├── order_service.py
│   │       └── product_service.py
│   ├── scripts/            # Database seeding & service testing utilities
│   ├── .env.example        # Local configuration template
│   ├── Dockerfile          # Server container configuration
│   ├── requirements.txt    # Python dependencies
│   └── app/main.py         # Application entry point
├── frontend/
│   ├── public/             # Static logos and assets
│   ├── src/
│   │   ├── api/            # Axios API wrappers
│   │   ├── components/     # Reusable UI controls (Wizard, Command Palette, drawers)
│   │   ├── context/        # State managers (Auth, App, Toast notifications)
│   │   ├── pages/          # Layout views (Products, Customers, Orders, Dashboard)
│   │   ├── routes/         # Router declarations & authentication guards
│   │   └── styles/         # Ordeer Design System V2 CSS (index.css)
│   ├── Dockerfile          # Client container configuration
│   ├── package.json        # Node packages
│   └── vite.config.js      # Vite build and proxy definitions
├── docker-compose.yml      # Local database stack setup (PostgreSQL)
└── README.md               # Application documentation
```

---

## API Integration Examples

The backend provides type-safe REST endpoints built with FastAPI. Below are examples of key operations.

### Product Creation (`POST /api/products`)

Creates a new product SKU in the catalog.

#### Request Payload
```json
{
  "name": "Wireless Mechanical Keyboard",
  "sku": "KB-WRLS-MX87",
  "price": 129.99,
  "stock_quantity": 45
}
```

#### Response (201 Created)
```json
{
  "id": 12,
  "name": "Wireless Mechanical Keyboard",
  "sku": "KB-WRLS-MX87",
  "price": "129.99",
  "stock_quantity": 45,
  "created_at": "2026-06-25T12:00:00.123456Z",
  "updated_at": "2026-06-25T12:00:00.123456Z"
}
```

---

### Create Transactional Order (`POST /api/orders`)

Creates an order and deducts inventory stock. This operation runs inside a database transaction using `SELECT FOR UPDATE` to lock product rows, ensuring stock levels are verified before checkout completes.

#### Request Payload
```json
{
  "customer_id": 8,
  "items": [
    {
      "product_id": 12,
      "quantity": 2
    }
  ]
}
```

#### Response (201 Created)
```json
{
  "id": 42,
  "customer_id": 8,
  "status": "COMPLETED",
  "total_amount": "259.98",
  "created_at": "2026-06-25T12:05:00.987654Z",
  "updated_at": "2026-06-25T12:05:00.987654Z",
  "customer": {
    "id": 8,
    "full_name": "Alice Tester",
    "email": "alice@example.com",
    "phone": "+1-555-0100"
  },
  "items": [
    {
      "id": 91,
      "product_id": 12,
      "quantity": 2,
      "unit_price": "129.99",
      "subtotal": "259.98"
    }
  ]
}
```

---

## Technical Details

<details>
<summary><b>Local Installation & Development</b></summary>

### Prerequisites
- Python 3.11+
- Node.js 18+ & npm
- Docker Desktop

---

### Backend Service Setup
1. **Navigate to the Backend Directory:**
   ```bash
   cd backend
   ```
2. **Establish a Python Virtual Environment & Install Dependencies:**
   ```bash
   python3 -m venv .venv
   source .venv/bin/activate
   pip install -r requirements.txt
   ```
3. **Configure Environment Variables:**
   ```bash
   cp .env.example .env
   ```
   *Edit `.env` if your local database credentials differ from the defaults.*
4. **Start PostgreSQL Container:**
   ```bash
   cd ..
   docker compose up -d
   ```
   This spins up PostgreSQL on port `5432` with username `ordeer`, password `ordeer`, and database name `ordeer`.
5. **Run the FastAPI Development Server:**
   ```bash
   cd backend
   .venv/bin/python -m uvicorn app.main:app --reload --port 8000
   ```
   The backend API will be active at `http://localhost:8000`.

---

### Frontend Client Setup
1. **Navigate to the Frontend Directory:**
   ```bash
   cd frontend
   ```
2. **Install Node Packages:**
   ```bash
   npm install
   ```
3. **Start the Vite Client Server:**
   ```bash
   npm run dev
   ```
   Vite launches the local client (typically at `http://localhost:5173`). Vite proxies all `/api` requests to `http://localhost:8000`.
4. **Build for Production:**
   ```bash
   npm run build
   ```
</details>

<details>
<summary><b>Environment Variables & API Routing</b></summary>

### Development
- **Frontend:** Proxies all `/api` requests to `http://localhost:8000` via the Vite dev server configuration.
- **Backend:** Environment variables are loaded from `backend/.env`.
  - `DATABASE_URL`: SQLAlchemy connection string pointing to the local PostgreSQL instance (default: `postgresql://ordeer:ordeer@localhost:5432/ordeer`).

### Production
- **Frontend:** Proxies `/api` calls through Vercel rewrites to Render backend.
- **Backend:** Secrets and environment configurations (such as `DATABASE_URL`) are managed directly inside the Render Web Service Environment Variables.
</details>

<details>
<summary><b>Interactive API Documentation</b></summary>

FastAPI generates interactive API documentation from Pydantic schemas. You can access the API documentation at the following locations:

#### Production Documentation
- **Swagger UI:** [https://ordeer.onrender.com/docs](https://ordeer.onrender.com/docs)
- **ReDoc UI:** [https://ordeer.onrender.com/redoc](https://ordeer.onrender.com/redoc)

#### Development Documentation (Local Backend)
- **Swagger UI:** [http://localhost:8000/docs](http://localhost:8000/docs)
- **ReDoc UI:** [http://localhost:8000/redoc](http://localhost:8000/redoc)
</details>

<details>
<summary><b>Service Smoke Testing</b></summary>

Ordeer includes a service testing script to verify operations and transactional constraints.

1. Ensure the PostgreSQL database container is running.
2. Run the script from the `backend/` directory:
   ```bash
   .venv/bin/python -m scripts.service_smoke_test
   ```

The script runs the following checks:
- **Step 1: Customer Creation:** Validates serialization and email uniqueness.
- **Step 2: Product Creation:** Verifies SKU profile registry and pricing constraints.
- **Step 3: Order Verification:** Tests order placement, stock deduction, and calculations.
- **Step 4: Rollback Verification:** Attempts to order more items than are in stock. It verifies that an `InsufficientStockError` is thrown, the transaction rolls back, and stock levels remain unchanged.
</details>

<details>
<summary><b>Production Deployment & Proxy Configuration</b></summary>

The project uses separate hosting providers to serve the decoupled frontend and backend services:

### Frontend (Hosted on Vercel)
- **Framework Preset:** Vite
- **Root Directory:** `frontend`
- **Build Command:** `npm run build`
- **Output Directory:** `dist`
- **Transparent Proxying:** Production uses Vercel rewrites defined in `vercel.json` to transparently proxy all `/api/*` requests to the Render backend service. This avoids browser Cross-Origin Resource Sharing (CORS) issues while keeping frontend API code clean.

**Vercel Configuration (`frontend/vercel.json`):**
```json
{
  "rewrites": [
    {
      "source": "/api/:path*",
      "destination": "https://ordeer.onrender.com/:path*"
    }
  ]
}
```

### Backend (Hosted on Render Web Service)
- **Environment/Runtime:** Python
- **Build Command:** `pip install -r backend/requirements.txt`
- **Start Command:** `cd backend && uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- **Environment Variables:** Set `DATABASE_URL` to point to the production database.

### Database (Hosted on Render PostgreSQL)
- **Type:** PostgreSQL database instance provisioned on Render.
</details>

---

## Future Roadmap

* **Role-Based Access Control (RBAC):** Define different roles for warehouse staff (updating stock) and managers (accessing analytics and customer details).
* **Database Pagination:** Implement server-side paging (`LIMIT` and `OFFSET`) to support large product catalogs.
* **Real-time Updates:** Integrate WebSockets to push instant dashboard alerts and stock warnings.
* **Barcode Scanning:** Support device-camera scanning inside the Order Wizard.
* **Audit Log History:** Maintain a history log of stock edits and order corrections.

---

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## Author

**Aryan Sharma**  
*Computer Science Engineer*  
- **GitHub:** [@techynAR](https://github.com/techynAR)  
- **LinkedIn:** [Aryan Sharma](https://linkedin.com/in/techynar)  
- **Portfolio:** [techynar.com](https://techynar.com)
