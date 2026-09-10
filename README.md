# Divine Grace Medical Center (DGMC) Dietary Management System

A high-performance, resilient, and enterprise-grade full-stack dietary management and meal-entitlement auditing application built for **Divine Grace Medical Center (a Mount Grace Hospital)**. 

This platform streamlines employee meal shift tracking, cafeteria QR code voucher scanning, real-time synchronization, and corporate financial reporting.

## 🆕 Recent Enhancements
- **Role-Based Endpoint Authorization Guard:** Implemented fine-grained endpoint protection in `src/server/api.ts` (`checkEndpointAuthorization`), validating session roles (`admin`, `dietary_admin`, `manager`, `cashier`, `employee`) and rejecting unauthorized access attempts with structured `403 Forbidden` responses.
- **Request Body & Schema Validation Pipeline:** Added `requestValidator` and `validateRequestBody` helpers supporting both Zod schemas and declarative field rules to ensure payload data integrity before reaching database and service layers.
- **Database Constraint Error Mapping:** Integrated `mapDatabaseError` to translate database constraint violations (MySQL/SQLite unique key violations, foreign key conflicts, not-null constraints) into human-readable HTTP `400 Bad Request` and `409 Conflict` error messages.
- **Production Sanitation & Cleanliness:** Conducted a comprehensive audit purging extraneous diagnostic statements across the codebase while preserving structured error handlers and telemetry.
- **Predictive Inventory Forecasting:** Integrated a structural placeholder for "Itemized Raw Food & Ingredient Requisition List (7-Day Cycle)" within the Admin Dietary Dashboard to prepare for upcoming predictive inventory analytics.
- **Currency Localization & Compliance:** Standardized all financial data displays across the Dietary Dashboard and Cashier modules, replacing the generic dollar ($) symbol with the Philippine Peso (₱) for accurate local institutional financial reporting.
- **System Stability:** Optimized build and production deployment scripts for the server-side environment.

---

## 📋 Table of Contents
1. [System Specifications & Architecture](#-system-specifications--architecture)
2. [Required Environment Variables](#-required-environment-variables)
3. [Local Setup with Docker & MySQL](#-local-setup-with-docker--mysql)
4. [Role-Based Access Control (RBAC) Guidelines](#-role-based-access-control-rbac-guidelines)
5. [Security Features & Guardrails](#-security-features--guardrails)
6. [Scopes and Limitations](#-scopes-and-limitations)
7. [How to Set Up & Run Locally](#-how-to-set-up--run-locally)
8. [Key Database Constraints & Error Mapping](#-key-database-constraints--error-mapping)
9. [Database Setup & Persistence Options](#-database-setup--persistence-options)
10. [Resilience & Power-Failure Self-Healing](#-resilience--power-failure-self-healing)
11. [Key Operational Workflows](#-key-operational-workflows)
12. [Multi-Role User Portals & Operational Manual](#-multi-role-user-portals--operational-manual)
13. [Key Directories](#-key-directories)

---

## ⚙️ System Specifications & Architecture

The DGMC Dietary Management System is designed with a lightweight, robust, and full-stack architecture that supports both cloud deployment and localized, stand-alone intranet execution.

### 1. Technology Stack
*   **Client Interface (Frontend):**
    *   **Framework:** React 18+ with TypeScript.
    *   **Build Tooling:** Vite (configured with Hot Module Replacement and production bundling).
    *   **Styling Engine:** Tailwind CSS utilizing direct utility classes for low-latency visual rendering and responsive layouts.
    *   **Typography:** Modern typography stack with **Inter** (sans-serif) for general system interfaces, **Space Grotesk** for high-impact display numbers, and **JetBrains Mono** for low-level system records, timestamps, and barcodes.
    *   **Animations:** Framer Motion (`motion/react`) for smooth page transitions and responsive user feedback.
    *   **Charts & Visualizers:** Recharts for dynamic dashboard telemetry, including hourly cafeteria traffic density, meal distribution ratios, and department utilization tables.
*   **Application Server (Backend):**
    *   **Runtime:** Node.js.
    *   **API Framework:** Express.js.
    *   **Build Strategy:** esbuild compiles the backend TypeScript controllers into a highly optimized, self-contained CommonJS bundle (`dist/server.cjs`) for standalone, high-efficiency, cold-start production execution.
*   **Database Engine (Dual-Persistence Layer):**
    *   **Enterprise Mode:** MySQL 8.0 with a persistent connection pool, automatic keep-alives, and auto-reconnection.
    *   **Stand-alone Offline Fallback Mode:** In-memory storage synced synchronously to a local file database (`db.json`) when MySQL coordinates are not provided.

---

## 🔑 Required Environment Variables

To run the system with external services or durable MySQL persistence, configure your `.env` file based on `.env.example`.

| Variable Name | Description | Default / Example | Required? |
| :--- | :--- | :--- | :--- |
| `GEMINI_API_KEY` | Server-side API key for Google Gemini AI integrations (AI dietary insights & inventory forecasting). | `"MY_GEMINI_API_KEY"` | Optional (Enables AI insights) |
| `APP_URL` | Base URL where the applet is hosted and accessed on the network. | `"http://localhost:3000"` | Recommended |
| `MYSQL_HOST` | Host address of the MySQL 8.0 database server. If absent, falls back to local `db.json`. | `"127.0.0.1"` | Optional (Enables MySQL mode) |
| `MYSQL_PORT` | Port number of the MySQL server (matches Docker Compose mapping). | `3311` | Required if MySQL is used |
| `MYSQL_USER` | MySQL database username with privileges on the target database. | `"dgmc_user"` | Required if MySQL is used |
| `MYSQL_PASSWORD` | Secure password for the MySQL user account. | `"dgmc_password"` | Required if MySQL is used |
| `MYSQL_DATABASE` | Target MySQL database schema name. | `"dgmc_meals"` | Required if MySQL is used |
| `REDIS_URL` / `REDIS_HOST` | Redis connection parameters for cluster-aware distributed rate limiting. | `127.0.0.1:6379` | Optional (Falls back to memory) |

---

## 🐳 Local Setup with Docker & MySQL

For multi-user testing and durable production storage, you can launch a containerized MySQL 8.0 database instantly using Docker Compose.

### Step 1: Launch the MySQL Container
Ensure Docker Desktop is running on your host machine, then execute:
```bash
docker-compose up -d
```
*   This spins up a container named `dgmc_mysql` running MySQL 8.0 on port **3311** (mapped to container port `3306`), creating persistent Docker data volumes (`mysql_data`).

### Step 2: Configure Environment Variables
Create your local `.env` file in the project root by copying `.env.example`:
```bash
cp .env.example .env
```
Ensure your `.env` contains the matching connection settings:
```env
MYSQL_HOST=127.0.0.1
MYSQL_PORT=3311
MYSQL_USER=dgmc_user
MYSQL_PASSWORD=dgmc_password
MYSQL_DATABASE=dgmc_meals
```

### Step 3: Install Dependencies and Start the Application
```bash
npm install
npm run dev
```
*   Upon startup, the Express backend automatically reads `.env`, connects to the MySQL container, verifies tables, and bootstraps the relational schema.

---

## 🛡️ Role-Based Access Control (RBAC) Guidelines

The DGMC Dietary Management System enforces strict, centralized role-based access control (RBAC) on all API endpoints via `checkEndpointAuthorization` in `src/server/api.ts`. 

### Defined System Roles
1.  **`admin` (System Administrator):** Full privileges across all routes, system diagnostics, configuration settings, security verification matrix, and user roster management.
2.  **`dietary_admin` (Dietary Administrator):** Administrative privileges for meal planning, nutritional policies, department oversight, and inventory forecasting.
3.  **`manager` (Department Manager):** Oversight of departmental staff, schedule creation, and shift assignments. Access to department analytics and AI dietary insights.
4.  **`cashier` (Cafeteria Cashier):** Access to cashier station workflows, badge scanning, offline synchronization queues, and meal transaction processing.
5.  **`employee` (Hospital Staff / Self-Service):** Access to personal profile, QR badge generation, personal shift schedules, and historical meal entitlement logs.

### Authorization Guard Rules Matrix
*   **Public Endpoints:** `/api/health`, `/api/public-stats`, `/api/docs`, `/api/auth/login`, and `/api/auth/refresh` are publicly accessible without authentication.
*   **Super Admin Diagnostics:** Endpoints under `/api/admin/sys-*`, performance benchmarks, and security matrix verification require the `admin` role exclusively (`403 Forbidden` if attempted by other roles).
*   **AI Insights & Analytics:** `/api/admin/ai-insights` is restricted to `admin`, `dietary_admin`, and `manager`.
*   **General Administration & Audit Logs:** `/api/admin/*` and `/api/audit-logs/*` require `admin` or `dietary_admin`.
*   **Management Routes:** `/api/manager/*` require `manager` or `admin`.
*   **Cashier Routes:** `/api/cashier/*` require `cashier` or `admin`.
*   **Settings & Department Mutations:** `POST`, `PUT`, and `DELETE` requests on `/api/departments` and `/api/settings` are restricted to `admin` and `dietary_admin`.
*   **Unauthorized Response Format:** Any violation returns a standardized JSON response:
    ```json
    {
      "success": false,
      "statusCode": 403,
      "code": "FORBIDDEN",
      "error": "Access Denied: Role 'employee' is not authorized to access administrative routes.",
      "path": "/api/admin/people",
      "userRole": "employee",
      "requiredRoles": ["admin", "dietary_admin"]
    }
    ```

---

## 🔒 Security Features & Guardrails

Security and data integrity are central to healthcare software. The system implements sever-side security guardrails:

1.  **Exploit & Injection Defenses (`src/server/api.ts`):**
    *   **OOB SQL Injection Detection:** Real-time analysis matches Out-Of-Band injection signatures on all inputs.
    *   **Polyglot Multi-Context Exploit Detection:** Intercepts composite payloads targeting multiple execution contexts (e.g., hybrid SQL/XSS/Command injections).
    *   **Active Cross-Site Scripting (XSS) Sanitizers:** Cleanses all incoming client fields before ingestion.
2.  **IP-Based & Distributed Redis Rate Limiting:**
    *   Mitigates brute-force attacks and prevents Denials-of-Service (DoS) on critical public-facing API routes.
    *   **Cluster-Aware Protection:** Uses `rate-limit-redis` for Express-level security and atomic Redis multi-transactions internally. In high-availability PM2 cluster setups, this ensures rate-limit status is shared globally, completely closing bypass vulnerabilities.
    *   **`POST /api/auth/login`:** Restricted to a maximum of **10 requests per minute** per client IP.
    *   **`POST /api/cashier/scan`:** Restricted to a maximum of **30 requests per minute** per client IP.
    *   Exceeded rates trigger a clean `429 Too Many Requests` JSON response indicating the required wait-time (retry_after / retry-after).
    *   Gracefully falls back to high-performance local memory tracking if Redis connection is absent or offline.
3.  **Cryptographic Meal Vouchers:**
    *   Employee QR codes map to base64 cryptographically formatted payload tokens containing person IDs and structural bounds. This completely prevents local employee spoofing, badge cloning, or unauthorized ticket generation.
4.  **Role-Based Endpoint Authorization Guard (`checkEndpointAuthorization`):**
    *   Enforces least-privilege access control on all API endpoints.
    *   Restricts administrative diagnostics, security verification, and performance benchmarks to `admin`.
    *   Restricts AI dietary insights to `admin`, `dietary_admin`, and `manager`.
    *   Limits `/api/manager/*` and `/api/cashier/*` domains strictly to authorized personnel roles.
    *   Rejects unauthorized attempts with structured `403 Forbidden` responses.
5.  **Strict Request Body & Schema Validation (`requestValidator`):**
    *   All write/mutation endpoints validate payload schemas (supporting both Zod schemas and declarative field dictionaries) before reaching domain controllers or database services.
    *   Interception yields structured `400 Bad Request` (`VALIDATION_ERROR`) with clear field indicators and issue details.
6.  **Administrative Compliance & Security Audit Trail:**
    *   Every security and configuration action triggers an automatic, immutable server-side log in the database.
    *   **User/Roster Operations:** Creation and updating of user accounts logs `USER_CREATE` and `EMPLOYEE_CREATE` / `EMPLOYEE_UPDATE`.
    *   **Role Escalations & Policy Enforcement:** Modifying a user's role on their profile automatically records `ROLE_CHANGE` denoting the old role and newly assigned role.
    *   **Department Changes:** Custom logs (`DEPARTMENT_CREATE`, `DEPARTMENT_UPDATE`, and `DEPARTMENT_DELETE`) record name edits, department allocations, and full deletions.
    *   **Voucher Management & Voiding:** Actions like voiding client checkouts capture prior parameters and logs `TRANSACTION_VOID`.
    *   **System Reconfigurations:** Tracks changes to hospital-wide system configurations (`SETTINGS_UPDATE` and `BRANDING_LOGO_UPDATE`).

---

## 🚫 Scopes and Limitations

Understanding system boundaries ensures optimal real-world operations in hospital settings.

### 1. Security & Rate Limiting Boundaries
*   **Zod Payload Validation:** All incoming data payloads (especially QR scans and auth endpoints) are strictly parsed and validated using Zod schemas on the server side before touching the database. This prevents arbitrary payload injection, ensures correct types, limits character lengths, and rejects malicious characters within the QR codes, serving as a primary defense against malformed requests.
*   **Visual & Haptic Feedback Constraints:** The cashier scanning interface includes advanced visual success animations (simulating laser scans) and leverages the browser's Native Vibration API (`navigator.vibrate`) to provide physical haptic feedback when a meal voucher is successfully claimed. Haptic feedback requires hardware support (e.g., tablet or mobile device) and user permission.
*   **In-Memory Store:** The rate limiting registry resides in the application's RAM. Restarting the server process resets the rate limit counters immediately. For single-server setups, this is highly efficient; in multi-node clusters behind load balancers, client limits apply independently to each server instance unless a shared cache (e.g., Redis) is introduced.
*   **IP Detection:** Client IPs are extracted via proxy headers (`x-forwarded-for` and `x-real-ip`). It assumes proxy headers are configured correctly on your local router or enterprise load balancer.

### 2. Database & Storage Scaling Limits
*   **Local File Database Fallback (`db.json`):** While ideal for plug-and-play development, `db.json` uses synchronous serialization to persist transactions. Under heavy concurrent load (e.g., multiple cashiers checking out hundreds of staff simultaneously during hospital lunch rushes), you **must** use the Docker MySQL database option to ensure row-level locking, ACID compliance, and low latency.
*   **Relational Schema Integrity:** In MySQL mode, database tables enforce strict foreign key constraints across departments, personnel, schedules, and transactions to prevent orphaned data records.

### 3. Offline Cache Capacity
*   **Client-Side Browser Storage:** Offline cashier data (active personnel registries and active schedules) is cached in the browser's `localStorage` and memory.
*   **Capacity Boundaries:** Standard modern browser storage is restricted to **5MB - 10MB** for local storage. This is more than sufficient to store up to **20,000+ active employee records** and schedules; however, media files or raw binary uploads are not permitted in the offline schema to prevent cache overflows.
*   **Pending Queue Safety:** Unsynchronized offline scans are kept securely in local browser storage. Clearing browser history, clearing site caches, or using "Incognito" tabs will wipe out unsynchronized transactions. Cashiers should always sync their stations before closing the browser.

### 4. QR Code Scanning & Hardware Capabilities
*   **Hardware Independence:** The Cashier station relies on a standard HTML5-compatible video capture camera (built-in webcam or USB-attached webcam) or standard keyboard barcode emulators.
*   **Physical Scanner Integration:** The system reads hardware USB serial scanners out-of-the-box, provided the device is configured in **"Keyboard Wedge Mode"** (where scanned values are typed as standard text inputs followed by an Enter key trigger). It does not require native Windows/Linux hardware drivers or serial-port configurations.

### 5. Archiving and Purging
*   **Continuous Growth:** The system records all historical meal logs permanently. There is no automated data-purging scheduler. If the system is operated for several years, standard database maintenance (e.g., partitioning transaction records by year or archiving records older than 12 months) should be conducted by the hospital IT team manually via SQL.

---

## 🚀 How to Set Up & Run Locally

Follow these instructions to set up the software environment on your machine.

### Prerequisites
Ensure the following tools are installed on your host system:
*   **Node.js** (Version 18 or higher)
*   **Docker & Docker Compose** (Optional: Only required if using MySQL database container mode)
*   **PM2** (Recommended for production process management: `npm install -g pm2`)

---

### Setup Method 1: Standard Terminal
For rapid deployment in standard terminal windows (SSH, Bash, PowerShell, CMD):

1.  **Navigate to the project directory:**
    ```bash
    cd /path/to/dgmc-dietary-system
    ```
2.  **Install all dependencies:**
    ```bash
    npm install
    ```
3.  **Boot the system in Development Mode:**
    ```bash
    npm run dev
    ```
4.  **Open your web browser:**
    👉 `http://localhost:3000`

---

### Setup Method 2: Running with PM2 (Production Standard)
For enterprise-grade background execution with auto-restart and log management:

1.  **Build the application:**
    ```bash
    npm run build
    ```
2.  **Start using PM2:**
    ```bash
    pm2 start ecosystem.config.cjs
    ```
3.  **Operational Commands:**
    *   **View Live Logs:** `pm2 logs dgmc-app`
    *   **Monitor Resources:** `pm2 monit`
    *   **Stop System:** `pm2 stop dgmc-app`
    *   **Restart System:** `pm2 restart dgmc-app`

---

### Setup Method 3: Standalone Production Mode
For local servers, compiling the client and bundling server resources guarantees high-speed execution:

1.  **Compile client assets and bundle server controllers:**
    ```bash
    npm run build
    ```
2.  **Start the compiled production server:**
    ```bash
    npm run start
    ```
    *The application serves static React pages and handles APIs under a single server instance on port 3000.*

---

## 🗄️ Key Database Constraints & Error Mapping

To guarantee absolute data integrity, the DGMC Dietary Management System enforces robust database constraints at both the schema level (MySQL / SQLite) and the application layer (`src/server/db.ts` and `src/server/api.ts`).

### 1. Relational Constraints
*   **Primary Keys:** Every entity (`users`, `departments`, `schedules`, `transactions`, `audit_logs`) has a unique auto-incrementing or UUID primary key.
*   **Foreign Key Integrity:** Enforces relational boundaries across tables (e.g., `transactions` and `schedules` reference valid `users(id)` and `departments(id)`). Deleting a department or user with active dependencies triggers relational protection.
*   **Unique Constraints:** Enforces uniqueness on critical identifiers such as employee usernames, emails, and badge tokens to prevent duplicate accounts.
*   **Not Null Constraints:** Mandatory fields (e.g., employee name, role, timestamps, transaction amounts) forbid `NULL` values at the schema level.
*   **Check Constraints:** Restricts column values to allowed enumerations (e.g., user roles limited to `admin`, `dietary_admin`, `manager`, `cashier`, `employee`; meal types limited to `breakfast`, `lunch`, `dinner`, `night_snack`).

### 2. Centralized Database Error Mapping (`mapDatabaseError`)
When database operations encounter constraint violations, raw database exceptions are intercepted and translated into human-readable HTTP error responses:
*   **Duplicate Entry (`ER_DUP_ENTRY` / `SQLITE_CONSTRAINT_UNIQUE`):** Mapped to **HTTP 409 Conflict** with an explanatory message (e.g., *"A record with this unique identifier already exists"*).
*   **Foreign Key Deletion Violation (MySQL Error `1451`):** Mapped to **HTTP 409 Conflict** (e.g., *"Cannot delete or update a parent row: a foreign key constraint fails"*).
*   **Foreign Key Missing Parent Violation (MySQL Error `1452`):** Mapped to **HTTP 400 Bad Request** (e.g., *"Cannot add or update a child row: a foreign key constraint fails"`).
*   **NOT NULL Constraint Violation:** Mapped to **HTTP 400 Bad Request** identifying the missing required field.
*   **CHECK Constraint Violation:** Mapped to **HTTP 400 Bad Request** indicating invalid field values or out-of-range parameters.

---

### 🆕 Clean Slate (Production Ready)
The system starts with a **Clean Slate**. All mock data (departments, employees, schedules) has been removed to allow hospital IT to populate the system via the Admin Settings.

*   **Primary Admin Account:**
    *   **Username:** `admin`
    *   **Password:** `password123`

### Option A: Automatic Built-in JSON Storage (Zero Setup Fallback)
If you do not have MySQL or Docker installed, you do not need to configure anything. 
*   If the `MYSQL_HOST` environment variable is absent in `.env`, the system automatically defaults to **JSON Storage Engine Mode**.
*   A local file named `db.json` is created in the project root. This file acts as your relational database, saving all transactions, schedules, and departments across restarts.

### Option B: Docker MySQL Database (Durable Production Mode)
For multi-user settings and durable data security:

1.  **Launch the MySQL container:**
    ```bash
    docker-compose up -d
    ```
    *This boots a MySQL 8.0 server instance named `dgmc_dietary_mysql` on port `3306` with credentials defined in the `docker-compose.yml` file and automatic data volumes.*
2.  **Create your Environment Configuration File:**
    Copy `.env.example` to a new file named `.env` and fill out the details:
    ```env
    MYSQL_HOST=127.0.0.1
    MYSQL_PORT=3306
    MYSQL_USER=dgmc_user
    MYSQL_PASSWORD=dgmc_user_password
    MYSQL_DATABASE=dgmc_dietary
    ```
3.  **Boot the app:**
    Upon startup, the server automatically reads `.env`, connects to the Docker MySQL container, and bootstraps all tables and schemas.

---

## 🔌 Resilience & Power-Failure Self-Healing

The hospital operating environment requires extreme software resilience against power outages, brownouts, and network downtime.

### 1. Persistent Connection Pools
The system's database architecture (`src/server/mysql.ts`) manages active handshakes using resilient connection pooling:
*   **Pool Settings:** `enableKeepAlive: true` and `keepAliveInitialDelay: 10000`.
*   These options prevent the server database connections from timing out or dropping during inactive hours (e.g., late night hours when no cafeteria meals are scanned).

### 2. Auto-Reconnections (Unattended Self-Healing)
If a physical power failure occurs at the hospital:
*   The database and application containers will power down.
*   Once power is restored and the system reboots, **no manual human intervention is required**.
*   The Node.js server automatically attempts reconnection loops in the background until the database container completes its internal boot diagnostics. Once ready, standard cafeteria services resume instantly.

---

## 📶 Key Operational Workflows

### 1. Offline Mode Data Sync Flow
For hospital cafeterias positioned in deep basement structures or areas with spotty Wi-Fi:

```
[Cashier Station] ---> (Spotty Hospital Wi-Fi Fails) ---> [Offline Mode Activated]
                                                                 |
                                        - Offline validation using cached rosters.
                                        - Transaction saved to local browser cache.
                                        - Displays "Pending Sync Items" counter.
                                                                 |
[Cashier Station] ---> (Hospital Wi-Fi Restored) --------> [Sync Queue Triggered]
                                                                 |
                                        - Uploads all pending transactions to Server.
                                        - Relational integrity checked.
                                        - Resolves overlaps via Conflict Panel.
```

*   **Offline Validation:** The cashier's browser stores a compressed index of active employee QR tokens and schedules locally. This enables sub-millisecond, local validation without contacting the server.
*   **Synchronizing & Conflict Resolution:**
    *   **The Scenario:** A manager updates an employee's schedule from "Day Shift" to "Off" on their portal. Simultaneously, the cashier (offline) scans the employee's badge during lunch. 
    *   **The Sync:** Upon internet restoration, the queue uploads. The server detects that the offline scan clashes with the retrospective schedule change.
    *   **The Conflict Panel:** The Cashier's dashboard opens an interactive **Sync Conflicts** tray, detailing the dispute (e.g., "Employee checked in but schedule was modified to Off"). The cashier can manually "Approve with Special Exception" or "Reject & Delete" the record.

---

### 2. Night Shift Spanning Parameters
Standard hospital operations rely on night shifts spanning across two calendar days (e.g., June 15 Night Shift starts at **10:00 PM on June 15** and ends at **6:00 AM on June 16**).

The system handles this scenario without reporting errors:
*   **Configured Time Windows:**
    *   **Day Shift:** `11:00 AM - 02:00 PM`
    *   **Night Shift:** `10:00 PM - 06:00 AM`
*   **The Evaluation:** If an employee scans their badge at **1:30 AM on June 16**, the system evaluates active night shifts. It detects that 1:30 AM on June 16 falls within the shift window starting on **June 15**. 
*   **Outcome:** The meal is approved and correctly logged under their **June 15 shift roster**, avoiding "unauthorized shift" errors and preventing double-redemptions during the same shift window.

---

## 👥 Multi-Role User Portals & Operational Manual

The DGMC Dietary Management System is segmentized into four distinct roles, accessible from the clean main layout. All dashboards feature a fully responsive design built with Tailwind CSS, ensuring optimal layout and usability across all device sizes—from administrative desktop monitors to handheld tablets used by roaming managers and cafeteria staff.

### 👑 1. System Administrators (Admin Dashboard)
*   **Core Operational Summary Cards:**
    *   **Active Employees:** Displays total authorized employees currently in the system, flanked by a live visual indicator pulse.
    *   **Pending Meal Entitlements:** Live tally of scheduled employees for today who have not yet claimed their meal vouchers.
    *   **Recent Transactions Count:** Immediate count of total logs generated during the current operational day.
*   **Interactive Live Activity Feed:**
    *   Displays the last **5 real-time transactions** processed across the cafeteria.
    *   Includes Employee Name, ID, Department, Transaction Type (Voucher vs. Paid Cash), Meal Value (₱), Timestamp, and Status.
*   **System Controls:**
    *   Full reporting charts, department listings, roster management, security audit log viewing, and system diagnostics.

### 📋 2. Department Managers (Manager Portal)
*   **Staff Rosters:** Manage employee registrations and assign department groups (e.g., Nursing, ER, Pediatrics, Radiology).
*   **Schedules Engine:** Create daily, weekly, or monthly shift rosters. Assign workers to **Day Shift**, **Night Shift**, or mark them as **Off**.

### 🛒 3. Cafeteria Cashiers (Cashier Station)
*   **QR Scanner Module:** Directly accesses the local system webcam to read employee QR badges instantly. Includes manual numerical ID backup inputs for damaged or lost badges.
*   **Offline Controller:** Manual toggles to transition between Online/Offline modes to test or bypass hospital Wi-Fi outages.
*   **Synchronization Station:** Manages pending queues and guides the user through conflict resolution panels.

### 🏥 4. Hospital Employees (Employee Portal)
*   **Digital Entitlement Card:** Displays a personal profile card detailing current active credentials and department details.
*   **Cryptographic QR Badge:** High-contrast, auto-generating QR code used at the cashier station for hands-free meal validation.
*   **History Logs & Calendar:** View upcoming assigned shifts, meal eligibility statuses, and a historical calendar of past claimed meals.

---

## 🛠️ Disaster Recovery: After a PC Restart or Blackout

If the host computer restarts, follow these steps to get the system back online:

### 1. Ensure MySQL is Running
If you are using Docker, simply **Open Docker Desktop**. 
*   The `dgmc_mysql` container is configured with `restart: always`, so it will start automatically as soon as Docker is active.

### 2. Start the Application (PM2)
Open your terminal in the project folder and run:
```bash
pm2 start ecosystem.config.cjs
```

### 💡 Pro-Tip: Full Automation (Auto-start on Boot)
To make the application start automatically whenever the computer turns on without you typing anything:

1.  **Set up the startup script:**
    ```bash
    pm2 startup
    ```
    *(Follow the instructions printed in your terminal)*
2.  **Save the current process list:**
    ```bash
    pm2 save
    ```
Now, even after a blackout, the system will come back online automatically as long as the PC is powered on.

---

## 🛡️ Production Hardening & Deployment Guidelines

In production, the application must be deployed with standard security and operational practices. Below are detailed specifications and configurations.

### 1. Mandatory TLS / HTTPS termination (Reverse Proxy)
The Node.js server does not handle TLS termination directly. **All production instances must sit behind a secure reverse proxy (Nginx, Caddy, or an enterprise load balancer) to enforce HTTPS.** This prevents credential sniffing and ensures voucher tokens are encrypted in transit.

#### Sample Nginx Configuration (`/etc/nginx/sites-available/dgmc`)
```nginx
server {
    listen 80;
    server_name dgmc-dietary.hospital.local;
    return 301 https://$host$request_uri; # Redirect HTTP to HTTPS
}

server {
    listen 443 ssl http2;
    server_name dgmc-dietary.hospital.local;

    ssl_certificate /etc/ssl/certs/dgmc.crt;
    ssl_certificate_key /etc/ssl/private/dgmc.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # Dynamic Security Headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    location / {
        proxy_pass http://127.0.0.1:3000; # Forward requests to Node.js / PM2
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 2. High-Availability Clustered Mode with PM2 & Redis
To maximize performance and prevent rate-limiter bypasses in clustered environments:
*   **PM2 Clustering:** The application runs in clustered mode, distributing load across all available CPU cores. This is controlled via `ecosystem.config.cjs` using `instances: 'max'` and `exec_mode: 'cluster'`.
*   **Redis Cache & Rate Limiting:** When multiple instances or nodes run in parallel, in-memory rate-limiting counters are localized. To prevent clients from bypassing rate-limits by hitting different instances, the system automatically binds `express-rate-limit` and internal routes to Redis when `REDIS_URL` or `REDIS_HOST` is configured in `.env`.

### 3. Continuous Integration & Automated Delivery (CI/CD)
To ensure automated quality gates (linting, compiling) and seamless VPS/Cloud deployments, use the following GitHub Actions workflow.

#### Sample GitHub Actions CI/CD Pipeline (`.github/workflows/deploy.yml`)
```yaml
name: CI/CD Pipeline

on:
  push:
    branches: [ main ]

jobs:
  validate:
    name: Lint & Compile Verification
    runs-on: ubuntu-latest
    steps:
      - name: Checkout Code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install Dependencies
        run: npm ci

      - name: Code Quality Checks (Linter)
        run: npm run lint

      - name: Production Compiler Test
        run: npm run build

  deploy:
    name: VPS/Server Production Deploy
    needs: validate
    runs-on: ubuntu-latest
    steps:
      - name: SSH to Target Server
        uses: appleboy/ssh-action@v1.0.3
        with:
          host: ${{ secrets.SSH_HOST }}
          username: ${{ secrets.SSH_USER }}
          key: ${{ secrets.SSH_KEY }}
          script: |
            cd /var/www/dgmc-dietary-system
            git pull origin main
            npm install --production
            npm run build
            pm2 reload dgmc-app --update-env
```

### 4. Database Partitioning & Transaction Archiving Plan
Under continuous heavy usage in healthcare environments, transaction volume grows indefinitely. Over years, large tables degrade query speeds.
*   **Recommended Action:** Implement a monthly archival job to purge or move transactions older than 1 year to a secondary schema (`dgmc_dietary_archive`).
*   **Sample SQL Partitioning / Archival Script:**
    ```sql
    -- 1. Create identical archival table if not exists
    CREATE TABLE IF NOT EXISTS transactions_archive LIKE transactions;

    -- 2. Migrate records older than 365 days
    INSERT INTO transactions_archive
    SELECT * FROM transactions
    WHERE created_at < NOW() - INTERVAL 1 YEAR;

    -- 3. Safely delete archived records from main table
    DELETE FROM transactions
    WHERE created_at < NOW() - INTERVAL 1 YEAR;
    ```
*   This script can be scheduled as an automated cron job on the target database instance.

---

## 📁 Key Directories

```
/
├── src/
│   ├── components/       # Global React UI widgets, loaders, and pre-render layouts.
│   ├── context/          # Global AuthContext managing session, local queues, and sync engines.
│   ├── pages/            # Role-based workspace dashboards:
│   │   ├── admin/        # Admin dashboard components, reports, and system settings.
│   │   ├── cashier/      # Cashier QR scanners, offline modules, and conflict views.
│   │   ├── manager/      # Manager personnel profiles and schedule matrices.
│   │   └── employee/     # Employee QR voucher generators and transaction logs.
│   ├── server/           # Backend Express API routers and persistent storage engines.
│   │   ├── api.ts        # Primary API request routing, security filters, and rate limiters.
│   │   └── db.ts         # Dual-persistence database managers (MySQL + Local JSON).
│   ├── App.tsx           # Primary routing controller and view state manager.
│   └── types.ts          # Unified global TypeScript interface definitions.
├── assets/               # Folder for branding media (e.g., dgmc_logo.png).
├── .env.example          # Sample environment variable template.
├── ecosystem.config.cjs  # PM2 production process configuration.
├── db.json               # Local JSON database (fallback storage).
└── docker-compose.yml    # Docker configuration file for the MySQL 8.0 server.
```
