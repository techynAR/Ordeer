# Ordeer

[![Build Status](https://img.shields.io/badge/build-passing-brightgreen.svg)](#)
[![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688.svg?logo=fastapi&logoColor=white)](#)
[![React](https://img.shields.io/badge/Frontend-React-61DAFB.svg?logo=react&logoColor=white)](#)
[![PostgreSQL](https://img.shields.io/badge/Database-PostgreSQL-4169E1.svg?logo=postgresql&logoColor=white)](#)
[![Docker](https://img.shields.io/badge/Infrastructure-Docker-2496ED.svg?logo=docker&logoColor=white)](#)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

Ordeer is a Modern Inventory & Order Management Platform designed to streamline operations, reduce transaction processing times, and optimize inventory validation for small-to-medium retail and distribution businesses.

---

## Table of Contents

- [About](#about)
- [Key Features](#key-features)
- [Technology Stack](#technology-stack)
- [Architecture & File Structure](#architecture--file-structure)
- [Operational Workflow](#operational-workflow)
- [Design Philosophy](#design-philosophy)
- [Technical Decisions](#technical-decisions)
- [Installation & Local Setup](#installation--local-setup)
- [Environment Variables](#environment-variables)
- [API Documentation](#api-documentation)
- [Testing](#testing)
- [Deployment](#deployment)
- [Screenshots Guide](#screenshots-guide)
- [Live Demo & Credentials](#live-demo--credentials)
- [Future Improvements](#future-improvements)
- [License](#license)
- [Author](#author)

---

## About

Ordeer is built to resolve the operational bottlenecks that plague standard, spreadsheet-like legacy inventory management systems. In environments with rapid sales cycles and shared inventory, systems often suffer from poor transactional validation (leading to overselling), sluggish page navigation, and low data density that slows down worker execution.

Ordeer addresses these challenges directly:
- **The Problem Solved:** Eliminates stock race conditions and inventory overselling during checkout through atomic, database-level lock-based validation. It also removes high cognitive loads by maximizing screen real estate and omitting non-essential decorative elements.
- **Intended Audience:** Designed for logistics coordinators, store operators, order fulfillment teams, and developers or recruiters evaluating modern operational UI architectures.
- **Architectural Rationale:** The system separates backend transaction processing (FastAPI/PostgreSQL) from frontend presentation (React SPA). This decoupled pattern allows for lightweight frontend builds, ultra-fast client state manipulation, and decoupled hosting.

---

## Key Features

### Dashboard
* **Operational Overview:** Instant reporting on total orders, revenue metrics, total customers, and overall products.
* **Low-Stock Alerting:** Highlights products that have dropped below critical thresholds, enabling rapid replenishment.
* **Activity Stream:** A list of recent orders with colored badge status flags (Pending, Completed).
* **Quick Actions:** Instant buttons to initiate the Order Wizard, add new products, or record new customers.

### Product Management
* **Inventory Control:** Complete CRUD interfaces for managing item name, price, stock levels, and unique SKUs.
* **Inline Search & Filtering:** Dynamic client-side search across SKU and product names.
* **Data-Dense Tables:** Interactive tables displaying stock levels, price models, and timestamps.
* **Stock Constraints:** Strict backend database constraints blocking negative stock values and duplicate SKUs.

### Customer Management
* **Customer Directory:** CRUD functions for keeping track of customer names, email addresses, and phone contacts.
* **Historical Tracking:** Tabular ledger of past customer orders and aggregated lifetime spend.
* **Inline Statistics:** Live calculations showing total orders placed and total revenue generated per customer.

### Order Management
* **Guided Order Wizard:** A multi-step flow checking customer selection, item cataloging, stock validation, and checkout.
* **Live In-Wizard Verification:** Visual indicators indicating if stock is sufficient, preventing negative inventory selections before form submission.
* **Atomic Processing:** Stock quantities are updated synchronously within a single transaction database unit.

### User Experience (UX)
* **Single-Page Application (SPA):** Fluid screen state manipulation with no full-page reloads.
* **Command Palette:** Quick search interface accessed via `Cmd+K` or `Ctrl+K` to search orders, products, and customers globally from any screen.
* **Slide-over Drawer Panels:** Form interactions use sliding slide-over drawers to keep table data visible behind the form.
* **Toast Notification Engine:** Non-blocking alerts for actions, form validations, and network error reporting.
* **Mobile-Responsive Layouts:** Collapsible sidebar navigation optimized for field workers using smartphones and tablets.
* **Recruiter-Friendly Authentications:** Fully operational demo login system bypassing manual form completion.

---

## Technology Stack

| Layer | Component | Technology / Library | Description |
| :--- | :--- | :--- | :--- |
| **Frontend** | Core Web Framework | React 18 (Vite SPA) | Component-driven UI development with hot module reloading. |
| | Routing | React Router 6 | Declarative client-side routing. |
| | HTTP Client | Axios | Promise-based backend communication. |
| | Design System | Vanilla CSS (v2 Tokens) | custom property-driven design system with native system font stacks. |
| **Backend** | API Engine | FastAPI | Async Python web framework. |
| | Web Server | Uvicorn | High-performance ASGI server. |
| | ORM | SQLAlchemy 2.0 | Modern object-relational mapping with type-safety support. |
| | Validation | Pydantic v2 | Python type annotations data validation. |
| **Database** | Database Engine | PostgreSQL 16 | Relational database handling ACID-compliant transactions. |
| **Infrastructure**| Development Environment | Docker / Docker Compose | Containerized local database orchestration. |
| **Deployment** | Backend Hosting | Render | Cloud service for API execution. |
| | Frontend Hosting | Vercel | Static hosting optimized for React SPA. |
| **Tooling** | Version Control | Git / GitHub | Code management. |

---

## Architecture & File Structure

The workspace is organized as a monorepo splitting client and server logic:

```text
Ordeer/
├── backend/
│   ├── app/
│   │   ├── api/            # API routing and handler layers
│   │   │   ├── deps.py     # Database session dependency injector
│   │   │   └── routes/     # Resource routes (dashboard, products, customers, orders)
│   │   ├── core/           # Environment configuration loaders (pydantic-settings)
│   │   ├── db/             # Session engines and metadata base classes
│   │   ├── models/         # SQLAlchemy database models
│   │   ├── schemas/        # Pydantic schemas for request/response serialization
│   │   └── services/       # Service layer containing core business logic and validations
│   │       ├── customer_service.py
│   │       ├── order_service.py
│   │       └── product_service.py
│   ├── scripts/            # Standalone automation & smoke-testing tools
│   ├── .env.example        # Environment variable templates for local execution
│   ├── Dockerfile          # Container configuration for backend services
│   ├── requirements.txt    # Declared Python dependencies
│   └── app/main.py         # Application instantiation and router registrations
├── frontend/
│   ├── public/             # Static logos and assets
│   ├── src/
│   │   ├── api/            # API integration modules mapping to backend resources
│   │   ├── components/     # Reusable UI controls (OrderWizard, CommandPalette, Modals, SlideOver)
│   │   ├── context/        # State managers (AppContext, AuthContext, ToastContext)
│   │   ├── pages/          # View entry pages mapped to client routes
│   │   ├── routes/         # Protected routes configurations
│   │   └── styles/         # Ordeer Design System V2 CSS (index.css)
│   ├── Dockerfile          # Container configuration for client environment
│   ├── package.json        # Declared Node packages
│   └── vite.config.js      # Vite build configurations and reverse proxy rules
├── docker-compose.yml      # Developer local infrastructure (PostgreSQL container)
└── README.md               # Main repository documentation
```

---

## Operational Workflow

The following flowchart details the transaction lifecycle of an order in Ordeer, tracing state transitions from user action down to database-level lock-based validation.

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

## Design Philosophy

The user interface of Ordeer is designed on several core principles:
* **Information Density Over Decoration:** The layouts are inspired by systems like **Stripe** and **Linear**. Space is maximized, margins are compact, and borders replace background colors to reduce visual noise. Content is readable at a single glance.
* **Workflow Continuity:** Modal windows and slide-over side drawers are used extensively (e.g. for creating customers and adding products). This prevents workers from losing context, keeping lists visible in the background while updating entities.
* **Keyboard-First Operations:** The application implements global listener hooks (`Cmd+K` or `Ctrl+K`) that trigger a centralized command palette, enabling operators to look up records or navigate files entirely from their keyboard.
* **Apple & Zoho Influence:** Typography relies on native Apple system fonts (`-apple-system, BlinkMacSystemFont`), ensuring rapid page load times and high-density, sharp lettering across Retina displays.

---

## Technical Decisions

### FastAPI & Python Async
FastAPI was selected for its native support for ASGI asynchronous paradigms, rendering it highly performant under concurrent query execution. By employing Pydantic, the application enforces compile-time type validation for all inbound network payloads, producing robust runtime interfaces and automatic OpenAPI generation.

### React SPA & Vite
React allows Ordeer to handle interactive state trees (like the multi-stage Order Wizard) without the latency of server-side page renders. Vite was chosen as the frontend builder due to its esbuild-powered bundler, reducing startup and build times to milliseconds.

### SQLAlchemy 2.0 & PostgreSQL
SQLAlchemy 2.0 provides modern Python type-safety annotations. PostgreSQL serves as the relational engine because of its transactional safety, supporting row-level locks (`with_for_update()`) which are critical for preventing race conditions in high-throughput retail environments.

### Decoupled Custom CSS Style Engine
Instead of incorporating CSS-utility bloat (like Tailwind CSS) that scatters styling details across markup, Ordeer isolates its design system into a single, cohesive `index.css` file. Utilizing CSS Custom Properties, the codebase maintains a uniform design system (spacing grids, animation times, radius sets, and semantic borders) which is simple to adjust.

---

## Installation & Local Setup

### System Prerequisites
Ensure you have the following software installed locally:
- Python 3.11+
- Node.js 18+ & npm
- Docker Desktop

---

### Backend Service Setup

1. **Navigate to the Backend Directory:**
   ```bash
   cd backend
   ```

2. **Establish a Python Virtual Environment:**
   ```bash
   python3 -m venv .venv
   source .venv/bin/activate
   ```

3. **Install Dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

4. **Configure Environment Variables:**
   Copy the example environment file and configure connection settings.
   ```bash
   cp .env.example .env
   ```
   *Edit `.env` if your local database credentials differ from the default.*

5. **Start Infrastructure (PostgreSQL Database):**
   Run the postgres service using docker-compose from the project's root folder:
   ```bash
   cd ..
   docker compose up -d
   ```
   This will spin up a PostgreSQL instance on port `5432` with credentials:
   - Database name: `ordeer`
   - Username: `ordeer`
   - Password: `ordeer`

6. **Initialize Database Tables:**
   Ordeer handles table initialization dynamically on startup via its FastAPI lifespan context manager. However, you can verify table generation or run a manual initialization by launching the API once.

7. **Run the Development API Server:**
   Ensure you are in the `/backend` folder and run:
   ```bash
   cd backend
   uvicorn app.main:app --reload --port 8000
   ```
   The backend API will now be active at `http://localhost:8000`.

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
   Vite will launch the local client (typically at `http://localhost:5173` or `http://localhost:5174`).

4. **Verify Proxy Connectivity:**
   Ensure that backend API is active on port `8000`. Vite's configuration proxies all `/api` requests automatically.

5. **Build for Production:**
   To verify production builds:
   ```bash
   npm run build
   ```

---

## Environment Variables

### Backend Configuration (`backend/.env`)

| Variable Name | Required | Default Value | Description |
| :--- | :--- | :--- | :--- |
| `DATABASE_URL` | Yes | `postgresql://postgres:postgres@localhost:5432/ordeer` | The SQLAlchemy connection string pointing to your PostgreSQL instance. |

### Frontend Configuration
The frontend communicates via absolute path relative routing `/api`, which Vite proxies to `http://localhost:8000` during development. In production deployments, configure your proxy or environment variable redirects to map `/api` to the hosting backend domain.

---

## API Documentation

FastAPI dynamically generates interactive OpenAPI specifications based on backend Pydantic schemas. 

With the backend server running, you can access:
- **Interactive Swagger UI Documentation:** [http://localhost:8000/docs](http://localhost:8000/docs)
- **Alternative ReDoc Documentation:** [http://localhost:8000/redoc](http://localhost:8000/redoc)

These paths display all resources, expected request schemas, status codes, and allow developers to test endpoints interactively.

---

## Testing

### Backend Automated Smoke Testing
Ordeer contains a standalone service testing script to verify operations and transactional consistency without launching the web servers. 

To execute the service smoke test:
1. Ensure your PostgreSQL database is running.
2. Run the script from the `/backend` directory:
   ```bash
   cd backend
   python -m scripts.service_smoke_test
   ```
   Or explicitly include the path to your environment:
   ```bash
   PYTHONPATH=backend python backend/scripts/service_smoke_test.py
   ```

The script runs sequentially, executing the following validation blocks:
- **Step 1:** Customer Creation (validates serialization and unique email flags).
- **Step 2:** Product Creation (registers target items with SKU profiles and pricing constraints).
- **Step 3:** Order Verification (tests order placement, item registration, and automatic stock deduction).
- **Step 4:** Transaction Rollback Verification (attempts to order more items than currently in stock; verifies `InsufficientStockError` is thrown, the transaction is rolled back, and stock remains unchanged).

---

## Deployment

### Backend Deployment (Render)
1. Register a web service on Render connected to your Ordeer repository.
2. Select environment type: **Python**.
3. Set the **Build Command**:
   ```bash
   pip install -r backend/requirements.txt
   ```
4. Set the **Start Command**:
   ```bash
   cd backend && uvicorn app.main:app --host 0.0.0.0 --port $PORT
   ```
5. Configure the `DATABASE_URL` environment variable to point to a production PostgreSQL database.

### Frontend Deployment (Vercel)
1. Register a project on Vercel connected to your Ordeer repository.
2. Set the **Root Directory** to `frontend`.
3. Select **Vite** as the framework preset.
4. Set **Build Command** to `npm run build`.
5. Set **Output Directory** to `dist`.
6. Configure Vercel's routes (`vercel.json`) to forward all `/api/(.*)` requests to your Render API domain.

---

## Screenshots Guide

To document visual layouts, capture the following states of the Ordeer interface and save them into the `docs/screenshots/` folder:

| Screen / Component | Navigate To | Capture Target | Suggested Filename |
| :--- | :--- | :--- | :--- |
| **Login Screen** | `/login` | The landing interface showing the Ordeer branding, fields for Admin, and the "Demo Login" button. | `login-screen.png` |
| **Dashboard Overview** | `/dashboard` | The dashboard layout displaying overall metrics, the low stock alerts panel, and the list of recent transactions. | `dashboard-overview.png` |
| **Products List** | `/products` | The product inventory grid containing SKUs, price tags, and current stock counts. | `products-list.png` |
| **Create Product Drawer** | `/products` → Click `+ Add Product` | The product list with the right-side slide-over form active for registering a new item. | `create-product.png` |
| **Product Details** | `/products` → Click a product row | The detailed view showing transaction histories and analytics of the selected product. | `product-details.png` |
| **Customers List** | `/customers` | The customer directory displaying names, email records, and lifetime orders counts. | `customers-list.png` |
| **Customer Details** | `/customers` → Click a customer row | The customer panel showing demographic records alongside their specific order history. | `customer-details.png` |
| **Orders List** | `/orders` | The order index grid containing tracking keys, timestamps, customer details, and total sale values. | `orders-list.png` |
| **Order Wizard Step** | `/orders` → Click `+ New Order` | The multi-stage Order Wizard modal, showing product selection and customer linking. | `order-wizard.png` |
| **Order Details** | `/orders` → Click an order row | The invoice-style detailed view displaying order items, pricing totals, and status indicators. | `order-details.png` |
| **Command Palette Active**| Anywhere → Hit `Cmd+K` | The overlay UI displaying flat search results across orders, customers, and products. | `command-palette.png` |
| **Mobile Layout** | `/dashboard` (inspect mobile viewport) | The mobile workspace showing the collapsed navigation layout and stacked metrics cards. | `mobile-layout.png` |

---

## Live Demo & Credentials

* **Live Client URL:** [https://ordeer.techynar.com](https://ordeer.techynar.com) *(Placeholder)*
* **Live API Endpoint:** [https://api.ordeer.techynar.com](https://api.ordeer.techynar.com) *(Placeholder)*
* **Interactive API Documentation:** [https://api.ordeer.techynar.com/docs](https://api.ordeer.techynar.com/docs) *(Placeholder)*

### Recruiter Evaluation Credentials
To facilitate rapid testing for recruiters, hiring managers, and QA teams, Ordeer includes a pre-configured administrator account:

- **Username:** `admin`
- **Password:** `admin`

Alternatively, you may click the **Demo Login** button on the sign-in panel, which bypasses credential validation and generates a mock administrator session directly in browser local storage.

---

## Future Improvements

* **Role-Based Access Control (RBAC):** Implementing distinct permissions for warehouse staff (stock modification only) and store managers (access to pricing, sales analytics, and customer directory profiles).
* **Database Pagination & Server-side Queries:** Replacing client-side sorting and paging with database query limits (`LIMIT` and `OFFSET`) to support scaling to millions of product SKUs.
* **Real-time Synchronization:** Adding WebSockets to push instant dashboard updates, notifications, and stock warnings when inventory levels are depleted.
* **Barcode Scanning:** Incorporating camera-based barcode scanning interfaces directly into the Order Wizard for warehouse fulfillment.
* **Audit History Logs:** Creating a ledger tracking the exact user and timestamp for every stock adjustment or quantity correction.
* **Advanced Financial Analytics:** Introducing automated export routines (CSV/PDF) for monthly business, tax, and sales performance audits.

---

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## Author

**Aryan Sharma**
*Computer Science Engineer*
- **GitHub:** [@techynAR](https://github.com/techynAR)
- **LinkedIn:** [Aryan Sharma](https://linkedin.com/in/techynar) *(Placeholder)*
- **Portfolio:** [techynar.com](https://techynar.com)
