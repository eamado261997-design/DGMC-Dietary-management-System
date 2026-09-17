# DGMC Hospital Server & Production Deployment Guide

This guide explains how to deploy the DGMC Dietary Management System in a production hospital environment using **PM2 Cluster Mode**, **Nginx Reverse Proxy**, and **Docker Compose**.

---

## Prerequisites

- Node.js 22 LTS installed on the server
- Docker Desktop / Docker Engine & Docker Compose (for containerized setup)
- MySQL 8.0+ and Redis 7
- Terminal / SSH access to the hospital server

---

## Option A: Containerized Deployment (Recommended)

Using Docker Compose ensures consistency across hospital servers, automatically orchestrating the App, MySQL, Redis, Prometheus, and Grafana.

1. **Clone and Configure**:
   ```bash
   git clone https://github.com/eamado261997-design/DGMC-Dietary-management-System.git
   cd DGMC-Dietary-management-System
   cp .env.example .env
   # Edit .env with your production database credentials
   ```

2. **Start the Stack**:
   ```bash
   docker compose up --build -d
   ```

3. **Verify Containers**:
   ```bash
   docker compose ps
   ```

---

## Option B: Native Host Deployment with PM2 & Nginx

If running natively on Linux/Windows host servers:

### 1. Build the Production Bundle
```bash
npm install
npm run build
```
*(Compiles the React frontend and bundles the Express server into `dist/server.cjs` via `esbuild`).*

### 2. Start PM2 in Cluster Mode
```bash
npm run pm2:start
pm2 save
pm2 startup
```
*Managed by `ecosystem.config.cjs`, PM2 clusters worker instances across all CPU cores with zero-downtime reloads (`wait_ready: true`) and automatic memory limits (`450M`).*

---

## Nginx Reverse Proxy Setup

To route public traffic from ports **80 (HTTP)** and **443 (HTTPS)** to PM2 on port `3000`:

1. Copy `nginx.conf` to your Nginx sites directory:
   ```bash
   sudo cp nginx.conf /etc/nginx/sites-available/dgmc
   sudo ln -s /etc/nginx/sites-available/dgmc /etc/nginx/sites-enabled/
   ```
2. Test configuration and reload Nginx:
   ```bash
   sudo nginx -t
   sudo systemctl reload nginx
   ```

---

## Managing PM2 Processes

- **Status**: `pm2 status`
- **Real-time logs**: `npx pm2 logs dgmc-hospital-app`
- **Metrics monitor**: `npx pm2 monit`
- **Zero-downtime reload**: `npx pm2 reload dgmc-hospital-app`
- **Restart**: `npx pm2 restart dgmc-hospital-app`
- **Stop**: `npm run pm2:stop`

---

## Health Check & Telemetry

- **API Health Check**:
  ```bash
  curl http://localhost:3000/api/health
  ```
- **Prometheus Metrics**: `http://localhost:3000/api/metrics`
- **Grafana Dashboards**: Available on port `3001` (default admin credentials: `admin` / `admin`).
