# DGMC Dietary Management System

A robust, enterprise-grade full-stack hospital dietary and meal management platform built with React 18, TypeScript, Tailwind CSS, Express, MySQL, SQLite, Redis caching, PM2 clustering, Nginx reverse proxy, and Docker.

---

## 1. System Overview & Core Features

- **Role-Based Access Control (RBAC)**: Dedicated secure dashboards and workflows for **Admins**, **Managers**, **Cashiers**, and **Employees**.
- **Dietary & Meal Management**: Schedule, track, and manage specialized hospital meal plans, dietary restrictions, and patient/staff preferences.
- **QR Code Verification**: Instant cryptographic QR code generation and live scanning check-ins for cafeteria transactions.
- **Analytics & Reporting**: Real-time transaction volume curves, gross revenue tracking, and average meal pricing trends powered by Recharts.
- **Dual-Mode Storage Engine**: Intelligent dual-mode database architecture supporting MySQL / SQLite / JSON file fallback.
- **Audit Logging & Telemetry**: Comprehensive system audit trail, performance benchmarking, and Prometheus / Grafana metrics integration.

---

## 2. Prerequisites

To run and deploy the DGMC Dietary Management System, ensure your environment has the following software installed:

- **Node.js**: Version 18+ (Node 22 LTS recommended)
- **MySQL**: Version 8.0+ (for relational data storage)
- **Redis**: Version 7.0+ (for caching and session / rate-limit stores)
- **Docker & Docker Compose** (Optional, for containerized deployments)
- **Nginx** (Optional, for production reverse proxy setup)

---

## 3. Local Development Steps

1. **Clone the Repository & Install Dependencies**:
   ```bash
   git clone https://github.com/eamado261997-design/DGMC-Dietary-management-System.git
   cd DGMC-Dietary-management-System
   npm install
   ```

2. **Configure Environment Variables**:
   Copy `.env.example` to `.env` and configure your local settings:
   ```bash
   cp .env.example .env
   ```
   *Example `.env` parameters:*
   ```env
   NODE_ENV=development
   PORT=3000
   MYSQL_HOST=127.0.0.1
   MYSQL_PORT=3306
   MYSQL_USER=root
   MYSQL_PASSWORD=rootpassword
   MYSQL_DATABASE=dgmc_meals
   REDIS_URL=redis://127.0.0.1:6379
   JWT_SECRET=your_jwt_secret_key_here
   ```

3. **Start the Development Server**:
   ```bash
   npm run dev
   ```
   This boots the unified Express backend and Vite middleware on `http://localhost:3000`.

---

## 4. Production Setup (Nginx, PM2 & Environment Variables)

### Environment Variables
For production, ensure all secret keys (`JWT_SECRET`, database credentials, Redis connection strings) are securely populated in `.env` or set in your hosting provider's environment manager.

### PM2 Process Management (Cluster Mode)
PM2 runs the application in cluster mode across multiple CPU cores for high availability and zero downtime.

1. **Build the Production Bundle**:
   ```bash
   npm run build
   ```
   *(Compiles React frontend via `vite build` and bundles the Express server into `dist/server.cjs` via `esbuild`).*

2. **Start the PM2 Cluster**:
   ```bash
   npm run pm2:start
   ```
   *(Managed by `ecosystem.config.cjs`, spawning instances across available CPU cores).*

3. **PM2 Management Commands**:
   - Status: `npx pm2 status`
   - Logs: `npx pm2 logs dgmc-hospital-app`
   - Monitor: `npx pm2 monit`
   - Zero-Downtime Reload: `npx pm2 reload dgmc-hospital-app`
   - Stop: `npm run pm2:stop`

### Nginx Reverse Proxy Configuration
A production-ready `nginx.conf` is provided at the root of the repository. It maps public web traffic on **ports 80 (HTTP)** and **443 (HTTPS)** to the local PM2-managed server cluster on port `3000`.

- **Upstream Load Balancing (`dgmc_cluster`)**: Distributes traffic to `127.0.0.1:3000` with least-connection routing and keepalive.
- **SSL / TLS & ACME**: Configured for TLS 1.2/1.3 and Let's Encrypt challenge routing (`/.well-known/acme-challenge/`).
- **Security Headers**: Includes HSTS (`preload`), CSP, X-Frame-Options (`SAMEORIGIN`), X-Content-Type-Options (`nosniff`), Referrer-Policy, and Permissions-Policy.
- **Gzip Compression**: Compresses text, JSON, CSS, and JS assets.

To deploy Nginx on your Linux server:
```bash
sudo cp nginx.conf /etc/nginx/sites-available/dgmc
sudo ln -s /etc/nginx/sites-available/dgmc /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

## 5. Deployment Guide (Docker & Docker Compose)

The project includes an optimized multi-stage `Dockerfile`, a robust `.dockerignore`, and a complete `docker-compose.yml` orchestrating the App, MySQL, Redis, Prometheus, and Grafana.

### Running with Docker Compose:
```bash
docker compose up --build -d
```

### Multi-Stage Dockerfile Architecture:
- **Build Stage**: Installs dependencies and compiles both the frontend and backend bundle into `dist/server.cjs`.
- **Production Stage**: Uses a lightweight `node:22-bookworm-slim` base image, copying only production dependencies and compiled artifacts for a secure, minimal image footprint.

### Automated CI/CD (GitHub Actions):
The workflow at `.github/workflows/deploy.yml` automatically builds and pushes the Docker container image to **GitHub Container Registry (GHCR)** on every push to `main`.
