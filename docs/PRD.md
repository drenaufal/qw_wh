# 📦 Product Requirements Document (PRD)
# Warehouse Packing & Courier Pickup Monitoring System

**Document Version:** 3.0.0 (Production Reference Specification)  
**Status:** Approved & Implemented in Production  
**Tech Stack:** Next.js 16+ (App Router) with React + TypeScript frontend, Next.js Route Handlers for backend APIs, PostgreSQL 15+, Tailwind CSS v4, Web Camera API, Server-Sent Events (SSE)  
**Timezone Standard:** Asia/Jakarta (WIB, UTC+7)  

---

## 0. Technical Architecture & Frontend Requirements

### 0.1 Framework and Frontend
- **Next.js 16+ App Router** is the primary web application framework.
- **React** is the UI library for all frontend screens, reusable components, forms, tables, dialogs, status boards, and interactive workflows.
- Use **TypeScript** for application code.
- Use React Server Components by default; add `"use client"` only for interactive components that require browser APIs or client-side state (for example, camera capture, localStorage, timers, theme switching, and SSE subscriptions).
- Use **Tailwind CSS v4** for responsive styling and the existing three-theme design system.
- Do not use Vite as the application framework or development/build tool.

### 0.2 Next.js Application and API
- Use the Next.js App Router route structure under `src/app/` for pages and layouts.
- Implement application endpoints with **Next.js Route Handlers** under `src/app/api/**/route.ts`.
- Keep authorization, input validation, business rules, PostgreSQL transactions, and audit logging on the server. Do not expose database credentials or privileged operations to the browser.
- Implement SSE at `GET /api/events` using a streaming response supported by the deployment runtime. Verify that the production hosting platform supports long-lived streaming connections.
- Use PostgreSQL as the source of truth. React client state is for presentation only and must not replace server-side validation or transactional state transitions.

### 0.3 Suggested Project Structure
```text
src/
  app/
    page.tsx
    status/page.tsx
    packing/page.tsx
    pickup-admin/page.tsx
    orders/page.tsx
    dashboard/page.tsx
    users/page.tsx
    audit/page.tsx
    login/page.tsx
    api/
      events/route.ts
      orders/route.ts
      orders/[id]/route.ts
      auth/[...]/route.ts
  components/
    ui/
    layout/
    orders/
    packing/
    pickup/
    dashboard/
  hooks/
    use-sse.ts
    use-camera.ts
  lib/
    auth/
    db/
    validation/
    services/
  types/
```

The structure is a suggested organization; all existing functional requirements, routes, permissions, order-state rules, and database concurrency guarantees remain authoritative.

---

## 1. Executive Summary & Problem Statement

### 1.1 Background & Context
In modern high-velocity fulfillment centers, e-commerce warehouses, and logistics distribution hubs, two operational frontiers must work in seamless coordination:
1. **Warehouse Floor Operations (Inbound & Packaging):** The *Packer* team verifies product SKUs, securely boxes or bags customer orders, and seals packaging.
2. **Loading Bay & Dock Operations (Outbound & Handover):** Third-Party Logistics (3PL) courier partners (e.g., J&T Express, SiCepat, Shopee Xpress, GoSend, GrabExpress, Anteraja, Ninja Van) arrive at the dispatch dock to collect and transport shipments.

### 1.2 Operational Challenges Solved
- **Dock Congestion & Courier Dwell Time:** Couriers arriving before orders finish packing frequently crowd dispatch counters, asking staff verbal status questions while packers lose time searching through bins.
- **Blind FIFO Queuing:** Warehouse packers historically process orders strictly by order timestamp, unaware that couriers for later orders are already waiting outside on the loading dock.
- **Handover Disputes & Package Loss Fraud:** Traditional paper-based manifests and manual sign-offs leave warehouses vulnerable to false non-receipt claims and untraceable parcels.
- **Race Conditions & Double Pickups:** Peak volume with multiple dock terminals risks duplicate order handovers or simultaneous dispatches if not protected by database-level concurrency controls.
- **Lack of SLA Transparency:** Operations lack empirical metrics tracking courier dwell time (*driver wait duration*) and packaging turnaround time (*packing duration*).

### 1.3 System Solution
An integrated real-time multi-display web monitoring platform:
- **Zero-Barrier Public Courier Terminal (`/`):** Touchscreen kiosk at the loading dock requiring no driver login. Drivers self-serve by searching orders, checking in arrival (*Early Check-In* or *Driver Arrival*), and capturing proof-of-handover photos directly using the physical device camera with automated watermarks.
- **Overhead TV Live Order Status Board (`/status`):** High-resolution 5-column Kanban board for large warehouse screens, showing live queue states, driver wait timers, and FIFO arrival order numbers.
- **Dynamic Priority Engine (`DRIVER_WAITING`):** Courier dock check-ins instantly elevate pending orders to the top of the packing queue (*Tier 1 Priority Queue*).
- **Packer Execution Station (`/packing`):** Packer workstation with mandatory item-by-item SKU checklist verification and carton sealing notes.
- **Pickup Admin Control Desk (`/pickup-admin`):** Staging rack management, manual arrival assistance, priority overrides, and full-resolution handover photo audit.
- **Atomic Database Concurrency (`SELECT FOR UPDATE`):** PostgreSQL row-level locks prevent simultaneous or duplicate dispatches.
- **Automated SLA Tracking:** Precision duration calculations in seconds stored in the database for SLA compliance auditing.

---

## 2. User Roles & Access Governance (RBAC)

| Role | Role Code | Authentication Method | Scope & Responsibilities |
|---|---|---|---|
| **Courier / Driver (Public)** | `PUBLIC` | Zero-Login (Public Access) | • Search order readiness<br>• Register dock arrival (*Driver Waiting*)<br>• Capture proof-of-handover via camera<br>• Receive digital dispatch receipt |
| **Overhead TV Display** | `PUBLIC` | Zero-Login (Kiosk Mode) | • 5-column fullscreen live Kanban board<br>• Audio chime alerts on status transitions |
| **Warehouse Packer** | `PACKER` | Staff Credentials (JWT) | • View prioritized orders with waiting couriers<br>• Claim orders & initiate packing sessions<br>• Verify SKU checklist items<br>• Complete packing and transfer to staging |
| **Pickup Admin / Dispatcher** | `PICKUP_ADMIN` | Staff Credentials (JWT) | • Monitor ready-for-pickup staging bays<br>• Assist drivers with manual arrival registration<br>• Override order priorities<br>• Audit captured handover photos |
| **Super Administrator** | `SUPERADMIN` | Staff Credentials (JWT) | • Manage staff accounts (create, activate, deactivate)<br>• Monitor warehouse-wide KPI statistics<br>• Audit immutable system logs with JSON state diffs |

---

## 3. Order Lifecycle & State Machine

### 3.1 Primary Order Statuses (`orders.status`)
```
[ WAITING ] ──(Packer Claims)──> [ PACKING ] ──(Checklist Complete)──> [ READY_FOR_PICKUP ] ──(Camera Verified)──> [ SHIP ]
```

1. **`WAITING`**: Order received (manually entered or ingested via ERP/Business Central webhook). Queued for packing.
2. **`PACKING`**: Order claimed by a packer. Packing timer (`packing_started_at`) is active.
3. **`READY_FOR_PICKUP`**: Packaging completed, SKUs verified, package staged in the loading dock bay.
4. **`SHIP`**: Package physically transferred to courier with watermarked camera proof. Final terminal status.

### 3.2 Dynamic Priority Escalation (`orders.priority_status`)
- **`NORMAL`**: Standard FIFO queue order.
- **`DRIVER_WAITING`**: Courier has arrived at the dock and checked in.
  - If the order is `WAITING` or `PACKING`: It escalates to the top of the packer queue (*Tier 1 Priority*).
  - If the order is `READY_FOR_PICKUP`: Displayed on the dock TV board with an incremental FIFO arrival number (`NO. 1`, `NO. 2`, etc.) alerting staging staff to hand it over immediately.
  - `driver_arrived_at` timestamp is permanently recorded, initiating the live SLA wait timer.

---

## 4. Module Functional Specifications

### 4.1 Courier Self-Service Terminal (`src/app/page.tsx`)
- **Route:** Public root (`/`). Designed for dock tablets/kiosks.
- **Layout Width:** Centered container (default Tailwind `max-w-2xl` for touch-friendly kiosk UI; configurable to `max-w-4xl` or `max-w-full`).
- **Client Cache:** Driver name (`wh_driver_name`) and courier fleet (`wh_courier_company`) persist in browser `localStorage` for quick auto-fill across multi-package pickups.
- **5-Stage Handover Wizard:**
  1. **Stage 1 (SELECT_ORDER):**
     - Instant search bar (matches order number, customer name, or courier company).
     - **Ready For Handover** section (`READY_FOR_PICKUP`):
       - **"🙋‍♂️ Driver Sudah Datang" (Driver Arrival)** button: allows courier to register dock arrival before package collection, switching priority to `DRIVER_WAITING`.
       - Animated glowing **"Driver Menunggu"** badge if courier has already checked in.
       - **"Pick Up →"** button: advances to handover verification.
     - **In Packaging Queue** section (`WAITING` & `PACKING`):
       - Displays orders currently being boxed or queued.
       - **"🙋‍♂️ I'm Here (Early Check-In)"** button: opens modal to register early arrival, escalating the order to the packer's top priority queue and starting the dwell timer.
  2. **Stage 2 (DRIVER_INFO):**
     - Summary of target order number and customer details.
     - Driver full name input (required).
     - Courier partner dropdown: J&T Express, SiCepat, Shopee Xpress, GoSend, GrabExpress, Anteraja, Ninja Van, Internal Fleet, Other.
  3. **Stage 3 (CAMERA):**
     - Direct hardware camera stream access via WebRTC (`navigator.mediaDevices.getUserMedia`).
     - **Anti-Fraud Guard:** Gallery image uploads are strictly disabled. Photos must be taken live at the dock.
     - Viewfinder overlay with bounding box alignment guidelines.
     - Flip camera button (rear/environment vs front/user camera).
     - High-resolution capture shutter button (1920×1080 ideal).
  4. **Stage 4 (REVIEW):**
     - Captures frame onto an HTML5 `<canvas>` and injects an **Immutable Watermark Banner**:
       - Line 1: `ORDER: <ORDER_NUMBER> | DRIVER: <DRIVER_NAME> (<COURIER>)`
       - Line 2: `TIME: <WIB_TIMESTAMP> | DOCK VERIFIED HANDOVER` (emerald green accent)
     - Options: "Retake Photo" or "Confirm & Complete Pickup".
  5. **Stage 5 (SUCCESS):**
     - Displays digital receipt: Transaction ID (`TXN-...`), Order Number, Driver Name, and Dispatched Timestamp (WIB).
     - "Process Next Package Pickup" button resets wizard for subsequent pickups.

### 4.2 Overhead TV Live Status Board (`src/app/status/page.tsx`)
- **Route:** Public (`/status`). Optimized for 55"-75" warehouse wall-mounted TVs.
- **5 Operational Kanban Columns:**
  1. **Ready for Pickup (Emerald Green):** Packages on dock staging shelves. Quick link to camera terminal.
  2. **Driver Waiting (Amber Yellow):** Orders with couriers waiting on-site.
     - **Sorting:** Strictly sorted **ASC** by arrival time (`driver_arrived_at ASC`) — earliest arrivals stay on top.
     - **FIFO Sequence Numbers:** Displayed with clear incrementing badges: **`NO. 1`**, **`NO. 2`**, **`NO. 3`**, etc.
     - **Live Elapsed Timer:** Real-time wait duration ticking every second (`⏳ Wait: 04m 12s`).
  3. **In Packing (Cyan Blue):** Orders actively being packed on workstations.
  4. **Waiting Queue (Slate Gray):** Regular unassigned pending orders.
  5. **Recently Shipped (Purple):** The 15 most recently dispatched orders.
- **TV Display Features:**
  - **Fullscreen Toggle** (HTML5 Fullscreen API).
  - **SSE Live Sync Beacon:** Pulsing green indicator showing live server connection.
  - **Auditory Chime Notification:** Web Audio API synthesizer (D5 oscillator at 587Hz) emitting a gentle chime whenever an order updates.
  - Sound on/off toggle button.

### 4.3 Packer Workstation (`src/app/packing/page.tsx`)
- **Route:** Authenticated (`PACKER` & `SUPERADMIN`).
- **Three Workstation Queues:**
  1. **Tier 1 Priority Queue (Couriers Waiting):** Glowing amber cards with live wait timers. Packers must process these first. Button: "⚡ Claim & Start Packing".
  2. **Active Packing Bench:** Orders currently claimed by the logged-in packer. Button: "Open Verification Checklist".
  3. **Standard Packaging Queue:** General backlog of waiting orders.
- **Item Verification Checklist Modal (Quality Assurance):**
  - Displays all order SKUs, descriptions, and required quantities.
  - Packer **must check off every single item** before completing the packing process.
  - Completion button remains disabled until 100% of items are verified.
  - Optional carton sealing condition notes.
  - Records verification details to `packing_sessions` and `packing_items`.

### 4.4 Pickup Admin Dock Console (`src/app/pickup-admin/page.tsx`)
- **Route:** Authenticated (`PICKUP_ADMIN` & `SUPERADMIN`).
- **Three Dock Management Zones:**
  1. **Couriers Waiting at Dock Bays:** Tracks physically waiting couriers with live timers and priority reset options.
  2. **Staging Bay Shelves:** Inventory of ready packages with "Assist Driver Arrival" for drivers without smartphones.
  3. **Recently Dispatched & Photo Audit:** Log of shipped parcels with an **"Inspect Photo"** button opening a full-resolution inspection modal with all handover metadata.

### 4.5 Order Management System (`src/app/orders/page.tsx`)
- **Route:** Authenticated staff (`SUPERADMIN`, `PACKER`, `PICKUP_ADMIN`).
- **Capabilities:**
  - Search and filter by status (`WAITING`, `PACKING`, `READY_FOR_PICKUP`, `SHIP`) and priority (`NORMAL`, `DRIVER_WAITING`).
  - **Manual Order Creation Modal:** Generates order number (ORD-XXXX), customer name, courier fleet, and dynamic item rows (SKU, product name, quantity).
  - **Lifecycle Detail Modal:** Visual timeline of transitions, SLA audit metrics (driver wait duration and packing time), SKU list, and proof photo.

### 4.6 Operations Dashboard (`src/app/dashboard/page.tsx`)
- **Route:** Authenticated staff.
- **Components:**
  - 6 Real-time KPI Cards: Total Orders Today, Waiting Queue, In Packing, Ready for Pickup, Shipped Parcels, and Couriers Waiting.
  - Priority Escalation Zone with ticking wait timers.
  - Live table of recent orders synced via SSE.
  - Quick action shortcuts to station workstations.

### 4.7 Staff Account Management (`src/app/users/page.tsx`)
- **Route:** Restricted to `SUPERADMIN`.
- **Capabilities:**
  - Staff table: full name, username, role badge, last login timestamp, active/inactive state.
  - Provision new staff with role assignment (`PACKER`, `PICKUP_ADMIN`, `SUPERADMIN`) and bcrypt hashing.
  - Immediate toggle button to deactivate departing staff accounts.

### 4.8 Forensic Audit Logs Viewer (`src/app/audit/page.tsx`)
- **Route:** Restricted to `SUPERADMIN`.
- **Capabilities:**
  - Immutable audit logs capturing every business state mutation.
  - Filtering by action type and entity type.
  - Interactive **JSON State Diff Viewer** displaying old values vs new values.

---

## 5. SLA Tracking & Duration Calculation

Duration metrics are computed server-side directly in PostgreSQL using epoch delta functions:

| SLA Metric | Timer Start | Timer End | Database Column |
|---|---|---|---|
| **Driver Wait Duration** | When courier first checks in (`driver_arrived_at`) | When order is handed over (`shipped_at`) OR packing completes | `orders.driver_wait_duration_seconds` |
| **Packing Duration** | When packer clicks Claim/Start (`packing_started_at`) | When packer completes checklist (`packed_at`) | `orders.packing_duration_seconds` |

User interface presentation format:
- Under 1 hour: `05m 32s`
- Over 1 hour: `01h 14m 20s`

---

## 6. Real-Time Communication Architecture (SSE)

The system utilizes native HTTP **Server-Sent Events (SSE)** without external WebSocket servers or Redis dependencies:

1. **Persistent Streaming:** Clients open a streaming connection to `GET /api/events`.
2. **Centralized Connection Manager (`SSEManager`):** Holds active response controllers in server memory.
3. **Event Broadcasting:** Successful database transactions trigger `sseManager.broadcast('orderUpdate', payload)`.
4. **Heartbeat:** Server sends a ping packet every 30 seconds to prevent proxy/load balancer timeouts.
5. **Client Auto-Reconnect:** The `useSSE` hook automatically reconnects within 4 seconds if the connection drops.

---

## 7. Multi-Theme Design System

The system features 3 industrial dark themes switchable via the sidebar and persisted to `localStorage`:
1. **Operational Navy (Default):** Deep midnight `#0a0f1d` with indigo `#6366f1` accents.
2. **Warehouse Slate:** Tactical slate `#0f1419` with cyan `#0ea5e9` accents.
3. **Control Room Charcoal:** Pure carbon `#121212` with amber `#f59e0b` accents.

---

## 8. Non-Functional Requirements (NFR)

- **Transactional Concurrency:** All status transitions run in `BEGIN ... COMMIT` blocks using `SELECT * FROM orders WHERE id = $1 FOR UPDATE` to eliminate duplicate pickups.
- **Image Storage:** Captured photos are encoded as Base64 JPEG Data URLs (85% compression) and stored directly in the `pickup_photos` table.
- **Timezone:** All timestamps displayed in the UI are localized to **WIB (Asia/Jakarta, UTC+7)**.
- **Default Seed Accounts:**
  - `admin` (Password: `admin123`) → Role: `SUPERADMIN`
  - `packer1` (Password: `admin123`) → Role: `PACKER`
  - `pickup1` (Password: `admin123`) → Role: `PICKUP_ADMIN`

