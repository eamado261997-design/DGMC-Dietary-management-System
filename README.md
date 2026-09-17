# DGMC - Dietary Management System
## Complete Hospital Deployment & Operations Guide

---

## 📋 Table of Contents

1. [System Overview](#system-overview)
2. [Architecture](#architecture)
3. [Quick Start](#quick-start)
4. [Docker Deployment](#docker-deployment)
5. [PM2 Hospital Server Deployment](#pm2-hospital-server-deployment)
6. [Database Setup](#database-setup)
7. [Configuration](#configuration)
8. [Monitoring & Health Checks](#monitoring--health-checks)
9. [Operations & Troubleshooting](#operations--troubleshooting)
10. [Security](#security)
11. [Backup & Recovery](#backup--recovery)
12. [Performance Tuning](#performance-tuning)
13. [API Documentation](#api-documentation)
14. [Support & Logging](#support--logging)

---

## 🏥 System Overview

DGMC (Dietary Management System) is a full-stack hospital application for managing meal allowances, employee scheduling, and dietary tracking built for Divine Grace Medical Center.

- **Frontend:** React 18 with Vite
- **Backend:** Node.js 22 with Express
- **Database:** MySQL 8.0 + SQLite (WAL backup)
- **Caching:** Redis 7
- **Monitoring:** Prometheus + Grafana
- **Process Manager:** PM2 (production cluster) or Docker (containerized)

### Key Features
- ✅ Multi-user role-based access (Admin, Manager, Cashier, Employee)
- ✅ Real-time meal transaction tracking
- ✅ Employee schedule management
- ✅ Free meal allowance logging
- ✅ System performance monitoring
- ✅ Audit logs & login tracking
- ✅ Automatic database sync & backup
- ✅ Health check endpoints
- ✅ Rate limiting & CORS security
- ✅ Encrypted sensitive data (passwords, QR codes, employee info)

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Hospital Network                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐      │
│  │   Browser    │    │   Mobile     │    │   Tablet     │      │
│  │   (React)    │    │   App        │    │   (iPad)     │      │
│  └──────┬───────┘    └──────┬───────┘    └──────┬───────┘      │
│         │                   │                    │               │
│         └───────────────────┼────────────────────┘               │
│                             │                                     │
│                    ┌────────▼────────┐                           │
│                    │  Node.js Server │ (Port 3000)              │
│                    │  Express + API  │                           │
│                    └────────┬────────┘                           │
│                             │                                     │
│         ┌───────────────────┼───────────────────┐               │
│         │                   │                   │               │
│    ┌────▼────┐         ┌───▼───┐         ┌────▼────┐          │
│    │ MySQL   │         │Redis  │         │SQLite   │          │
│    │(Primary)│         │(Cache)│         │(Backup) │          │
│    └─────────┘         └───────┘         └─────────┘          │
│                                                                   │
│    ┌─────────────────────────────────────────────────────────┐ │
│    │  Monitoring Stack                                       │ │
│    │  ├─ Prometheus (Metrics Collection)                    │ │
│    │  └─ Grafana (Visualization Dashboard)                  │ │
│    └─────────────────────────────────────────────────────────┘ │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🚀 Quick Start

### Option 1: Docker (Recommended for Containerized Deployments)

```bash
# Clone and navigate to project
git clone <repo-url>
cd DGMC-Dietary-management-system

# Build and start all services
docker compose up -d

# Verify all containers are running
docker ps

# Check health
curl http://localhost:3000/api/health

# Open application
# Navigate to http://localhost:3000 in browser
```

**Services running:**
- App: http://localhost:3000
- Grafana Dashboard: http://localhost:3001 (admin/admin)
- Prometheus: http://localhost:9090
- MySQL: localhost:3311 (root/root)
- Redis: localhost:6379

### Option 2: PM2 on Hospital Server

```bash
# On Ubuntu/Linux
chmod +x deploy.sh
./deploy.sh

# On Windows
deploy.bat

# Check status
pm2 status
pm2 logs dgmc-hospital-app
```

---

## 🐳 Docker Deployment

### Prerequisites
- Docker Desktop 4.0+
- docker-compose 2.0+
- 4GB RAM minimum, 2 CPU cores

### Full Setup Instructions

```bash
# 1. Navigate to project directory
cd DGMC-Dietary-management-system

# 2. Build the application locally first
npm run build

# 3. Start all containers
docker compose up -d

# 4. Monitor startup
docker compose logs -f dgmc_app

# 5. Verify all services are healthy
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
```

### Expected Output
```
NAMES             STATUS                PORTS
dgmc_app          Up 2 minutes          0.0.0.0:3000->3000/tcp
dgmc_mysql        Up 2 minutes (healthy) 0.0.0.0:3311->3306/tcp
dgmc_redis        Up 2 minutes (healthy) 0.0.0.0:6379->6379/tcp
dgmc_prometheus   Up 2 minutes          0.0.0.0:9090->9090/tcp
dgmc_grafana      Up 2 minutes          0.0.0.0:3001->3000/tcp
```

### Docker Management

```bash
# View container logs
docker logs dgmc_app              # Latest logs
docker logs -f dgmc_app           # Follow live logs
docker logs --tail 50 dgmc_app    # Last 50 lines

# Stop / Restart services
docker compose stop
docker compose restart

# Access MySQL directly
docker exec -it dgmc_mysql mysql -uroot -proot dgmc

# Backup database
docker exec dgmc_mysql mysqldump -uroot -proot dgmc > backup.sql

# Restore database
docker exec -i dgmc_mysql mysql -uroot -proot dgmc < backup.sql
```

---

## 🏥 PM2 Hospital Server Deployment

### Prerequisites
- Ubuntu 20.04+ or Windows Server 2019+
- Node.js 22.x LTS
- npm 10+
- MySQL 8.0 running on server
- Redis 7 (optional, for caching)

### Installation

```bash
# Ubuntu/Linux deployment
chmod +x deploy.sh
./deploy.sh
```

```cmd
:: Windows deployment
deploy.bat
```

### Verify Installation

```bash
# Check PM2 status
pm2 status

# View process details
pm2 info dgmc-hospital-app

# Monitor in real-time
pm2 monit

# View logs
pm2 logs dgmc-hospital-app
```

### PM2 Process Configuration

**`ecosystem.config.cjs` includes:**
- `instances: "max"` — Utilizes all available CPU cores automatically
- `exec_mode: "cluster"` — Enables local HTTP load balancing
- `kill_timeout: 4000` — Graceful 4-second request draining window
- `max_memory_restart: "500M"` — Auto-restart threshold per worker instance
- `max_restarts: 10` — Prevents infinite restart loops
- `min_uptime: "10s"` — Stability baseline

---

## 🗄️ Database Setup

### Connection Details (Default)
```
Host:     localhost (Docker) or server IP (PM2)
Port:     3311 (Docker) or 3306 (PM2)
Username: root
Password: root
Database: dgmc
```

### Key Database Tables
- `departments` — Hospital departments and meal entitlement rules
- `people` — Employee & staff accounts
- `employee_schedules` — Shift duty schedules
- `transactions` — Meal claims & cashier POS transactions
- `free_meal_logs` — Complimentary meal allowance records
- `system_settings` — System branding & shift configurations
- `audit_logs` — Security action logs

---

## 📊 Monitoring & Health Checks

### Health Endpoint

```bash
curl http://localhost:3000/api/health | jq '.'
```

**Response includes:**
```json
{
  "status": "healthy",
  "uptime": "2h 15m 30s",
  "databases": {
    "mysql": {
      "connected": true,
      "health": {
        "healthy": true,
        "latencyMs": 2,
        "error": null
      }
    },
    "sqlite": {
      "connected": true,
      "mode": "WAL"
    }
  },
  "system": {
    "memory": {
      "heapUsedFormatted": "125.45 MB",
      "heapTotalFormatted": "256.00 MB"
    },
    "cpu": {
      "usage": "12%"
    }
  }
}
```

### Grafana Dashboard
- **URL:** http://localhost:3001
- **Credentials:** `admin` / `admin`

---

## 🔐 Security

1. **Role-Based Access Control (RBAC):** Session roles (`admin`, `dietary_admin`, `manager`, `cashier`, `employee`) strictly enforced on all API routes.
2. **Field Encryption:** Sensitive user fields, employee numbers, and passwords are encrypted using bcrypt & AES.
3. **Rate Limiting:** Integrated Express rate limiting (500 requests/min per IP) to prevent brute-force attacks.

---

## 💾 Backup & Recovery

### Daily Backup Script
```bash
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
docker exec dgmc_mysql mysqldump -uroot -proot dgmc | gzip > backups/dgmc_$DATE.sql.gz
echo "Backup saved to backups/dgmc_$DATE.sql.gz"
```

---

**Version:** 1.0.0  
**Last Updated:** September 2026  
**Maintained By:** DGMC Development Team
