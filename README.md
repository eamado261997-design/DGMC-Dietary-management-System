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

DGMC (Dietary Management System) is a full-stack hospital application for managing meal allowances, employee scheduling, and dietary tracking. Built with:

- **Frontend:** React 18 with Vite
- **Backend:** Node.js 22 with Express
- **Database:** MySQL 8.0 + SQLite (backup)
- **Caching:** Redis 7
- **Monitoring:** Prometheus + Grafana
- **Process Manager:** PM2 (production) or Docker (containerized)

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

### Option 1: Docker (Recommended for Most Deployments)

```bash
# Clone and navigate to project
git clone <repo-url>
cd DGMC-Dietary-management-system-2026-08-10-f3094

# Build and start all services
docker compose up -d

# Verify all containers are running
docker ps

# Check health
curl http://localhost:3000/api/health

# View app
Open http://localhost:3000 in browser
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
cd DGMC-Dietary-management-system-2026-08-10-f3094

# 2. Build the application locally first (required)
npm run build

# 3. Start all containers
docker compose up -d

# 4. Monitor startup (takes 30-45 seconds)
docker compose logs -f dgmc_app

# 5. Once "Full-stack server running on http://localhost:3000" appears, press Ctrl+C

# 6. Verify all services are healthy
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

# Stop all services
docker compose stop

# Restart all services
docker compose restart

# Remove all containers (keeps data in volumes)
docker compose down

# Remove everything including volumes (WARNING: deletes data)
docker compose down -v

# Check database connection
docker exec dgmc_mysql mysql -uroot -proot -e "SELECT 1;"

# Access MySQL directly
docker exec -it dgmc_mysql mysql -uroot -proot dgmc

# Backup database
docker exec dgmc_mysql mysqldump -uroot -proot dgmc > backup.sql

# Restore database
docker exec -i dgmc_mysql mysql -uroot -proot dgmc < backup.sql
```

### Auto-Recovery Configuration

**Automatic behaviors enabled:**
- ✅ Containers auto-restart on crash (unless-stopped policy)
- ✅ Containers auto-start on Docker Desktop/server reboot
- ✅ MySQL health checks (healthy state required before app starts)
- ✅ Redis health checks (healthy state required before app starts)
- ✅ App connectivity attempts with retry logic
- ✅ Connection pool auto-recovery

**Restart sequence on system reboot:**
1. MySQL starts + health check (60s startup grace)
2. Redis starts + health check (30s startup grace)
3. App waits for both to be healthy
4. App connects to MySQL automatically
5. System ready ~45 seconds after Docker starts

---

## 🏥 PM2 Hospital Server Deployment

### Prerequisites
- Ubuntu 20.04+ or Windows Server 2019+
- Node.js 22.x LTS
- npm 10+
- MySQL 8.0 running on server
- Redis 7 (optional, for caching)
- SSH/Terminal access

### Installation

**Ubuntu/Linux:**
```bash
# Clone repository
git clone <repo-url>
cd DGMC-Dietary-management-system-2026-08-10-f3094

# Run deployment script
chmod +x deploy.sh
./deploy.sh

# Follow prompts to complete PM2 setup
```

**Windows:**
```cmd
# Run batch script
deploy.bat

# PM2 will configure itself automatically
```

### What `deploy.sh` Does
1. Installs PM2 globally (`npm install -g pm2`)
2. Builds application (`npm run build`)
3. Starts app with PM2 cluster mode (`pm2 start ecosystem.config.cjs`)
4. Enables auto-startup on server reboot (`pm2 startup`)
5. Saves process list (`pm2 save`)

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

**ecosystem.config.cjs includes:**
- `instances: "max"` — Uses all available CPU cores
- `exec_mode: "cluster"` — Cluster load balancing
- `kill_timeout: 4000` — Graceful 4-second shutdown
- `max_memory_restart: "500M"` — Auto-restart on memory threshold
- `max_restarts: 15` — Prevents restart loops
- `min_uptime: "30s"` — Minimum stability before counting restart
- Error & output logs: `logs/err.log`, `logs/out.log`

---

## 🗄️ Database Setup

### MySQL Configuration

**Connection Details (Default):**
```
Host:     localhost (Docker) or your-server-ip (PM2)
Port:     3311 (Docker) or 3306 (PM2)
Username: root
Password: root
Database: dgmc
```

**Change Database Credentials:**

1. **For Docker:** Edit `.env` file
   ```env
   MYSQL_HOST=dgmc_mysql
   MYSQL_USER=custom_user
   MYSQL_PASSWORD=your_secure_password
   MYSQL_DATABASE=dgmc
   ```
   Then rebuild: `docker compose down && docker compose up -d`

2. **For PM2:** Edit `ecosystem.config.cjs`
   ```javascript
   env: {
     MYSQL_HOST: "your-server-ip",
     MYSQL_USER: "hospital_user",
     MYSQL_PASSWORD: "secure_password"
   }
   ```
   Then restart: `pm2 restart dgmc-hospital-app`

### Database Tables

**Automatically created on first run:**
- `departments` — Hospital departments
- `people` — Employee & staff information (encrypted)
- `employee_schedules` — Work shifts
- `transactions` — Meal transactions
- `free_meal_logs` — Free allowance history
- `system_settings` — Configuration storage
- `audit_logs` — Action history
- `login_attempts` — Authentication tracking

### Backup & Restore

**Automatic backups:**
```bash
# Docker backup (run on host machine)
docker exec dgmc_mysql mysqldump -uroot -proot dgmc > dgmc_backup_$(date +%Y%m%d_%H%M%S).sql

# PM2 backup (on server)
mysqldump -u root -proot dgmc > dgmc_backup_$(date +%Y%m%d_%H%M%S).sql
```

**Restore from backup:**
```bash
# Docker
docker exec -i dgmc_mysql mysql -uroot -proot dgmc < dgmc_backup_20260910.sql

# PM2
mysql -u root -proot dgmc < dgmc_backup_20260910.sql
```

---

## ⚙️ Configuration

### Environment Variables

Create `.env` file in project root:

```env
# Node Environment
NODE_ENV=production
PORT=3000

# Database
MYSQL_HOST=dgmc_mysql
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD=root
MYSQL_DATABASE=dgmc

# Cache
REDIS_URL=redis://localhost:6379
REDIS_HOST=localhost
REDIS_PORT=6379

# Security (optional)
ALLOWED_ORIGINS=http://localhost:3000,https://your-domain.com

# Monitoring
HEALTH_CHECK_PATH=/api/health
HEALTH_CHECK_INTERVAL_MS=30000

# AI Integration (optional)
GEMINI_API_KEY=your_api_key_here
```

### Docker Compose Configuration

Edit `docker-compose.yml` to customize:

```yaml
# Change MySQL password
MYSQL_ROOT_PASSWORD: your_password

# Change exposed ports
ports:
  - "3312:3306"  # MySQL on different port

# Add volume mounts
volumes:
  - ./custom_data:/var/lib/mysql  # Persistent data location

# Resource limits
deploy:
  resources:
    limits:
      cpus: '2'
      memory: 2G
```

### PM2 Configuration

Edit `ecosystem.config.cjs`:

```javascript
max_memory_restart: "1G",        // Increase memory limit
instances: 4,                    // Use 4 cores instead of max
max_restarts: 20,                // Increase restart attempts
watch: true,                     // Auto-restart on file changes
```

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

**Access:** http://localhost:3001
**Default Credentials:** admin / admin

**Available Dashboards:**
- System Performance (CPU, Memory, Disk)
- Database Metrics (Queries, Connections)
- Application Metrics (Uptime, Errors)
- Request Latency

**Setup Custom Dashboard:**
1. Log in to Grafana
2. Add Prometheus data source: http://localhost:9090
3. Create custom panels for your metrics

### Prometheus Metrics

**Access:** http://localhost:9090

**Available metrics:**
- `node_cpu_seconds_total` — CPU usage
- `node_memory_MemAvailable_bytes` — Available memory
- `node_processes_running` — Running processes
- `dgmc_app_uptime` — App uptime
- `dgmc_app_requests_total` — Total requests

### Docker Container Health

```bash
# Check container status
docker ps --format "table {{.Names}}\t{{.Status}}"

# Detailed health information
docker inspect dgmc_app | grep -A 10 "Health"

# View container metrics
docker stats dgmc_app --no-stream
```

### PM2 Monitoring

```bash
# Real-time monitoring
pm2 monit

# Process details
pm2 describe dgmc-hospital-app

# Ecosystem info
pm2 env dgmc-hospital-app

# View all logs
pm2 logs dgmc-hospital-app

# Save logs to file
pm2 logs dgmc-hospital-app > app_logs.txt
```

---

## 🔧 Operations & Troubleshooting

### Common Operations

**Restart Application**
```bash
# Docker
docker compose restart dgmc_app

# PM2
pm2 restart dgmc-hospital-app
```

**View Real-time Logs**
```bash
# Docker
docker logs -f dgmc_app

# PM2
pm2 logs dgmc-hospital-app
```

**Deploy New Version**
```bash
# 1. Build new version
npm run build

# 2. Restart
docker compose restart dgmc_app
# OR
pm2 restart dgmc-hospital-app
```

**Stop/Start Services**
```bash
# Docker
docker compose stop          # Stop
docker compose start         # Start
docker compose down          # Remove
docker compose up -d         # Start all

# PM2
pm2 stop dgmc-hospital-app
pm2 start dgmc-hospital-app
pm2 delete dgmc-hospital-app
pm2 start ecosystem.config.cjs
```

### Troubleshooting

#### Issue: "MySQL Connection Refused"

**Solution:**
```bash
# Check MySQL is running
docker ps | grep mysql
# OR
ps aux | grep mysql

# Check MySQL port
docker exec dgmc_mysql mysql -uroot -proot -e "SELECT 1;"

# Verify connection credentials in .env
cat .env | grep MYSQL

# Restart MySQL
docker compose restart dgmc_mysql
# OR
sudo systemctl restart mysql
```

#### Issue: "Port Already in Use"

**Solution:**
```bash
# Find process using port 3000
lsof -i :3000
# OR
netstat -tlnp | grep 3000

# Kill the process
kill -9 <PID>

# OR change port in ecosystem.config.cjs or docker-compose.yml
```

#### Issue: "Out of Memory"

**Solution:**
```bash
# Check memory usage
docker stats
# OR
pm2 monit

# Increase memory limit in docker-compose.yml
# OR increase max_memory_restart in ecosystem.config.cjs

# Restart
docker compose restart dgmc_app
pm2 restart dgmc-hospital-app
```

#### Issue: "Database Not Syncing After Restart"

**Solution:**
```bash
# Verify MySQL is healthy
docker exec dgmc_mysql mysqladmin -uroot -proot status

# Check app logs for errors
docker logs dgmc_app | grep -i "error\|mysql"

# Verify .env variables
cat .env | grep MYSQL

# Force app restart
docker compose restart dgmc_app

# Wait 20 seconds for reconnection
sleep 20
curl http://localhost:3000/api/health
```

#### Issue: "App Crashes with Exit Code 1"

**Solution:**
```bash
# View crash logs
docker logs dgmc_app | tail -50

# Check for build errors
npm run build

# Rebuild Docker image
docker build -t dgmc-app:local .

# Restart with fresh image
docker compose down
docker compose up -d
```

---

## 🔐 Security

### Best Practices

1. **Change Default Credentials**
   ```env
   MYSQL_PASSWORD=your_secure_password
   REDIS_PASSWORD=your_redis_password
   ```

2. **Enable HTTPS (Production)**
   - Use Nginx reverse proxy with SSL certificates
   - Example: Let's Encrypt free certificates

3. **Firewall Configuration**
   ```bash
   # Only allow needed ports
   sudo ufw allow 3000/tcp    # App
   sudo ufw allow 3311/tcp    # MySQL (internal only)
   sudo ufw allow 6379/tcp    # Redis (internal only)
   sudo ufw allow 9090/tcp    # Prometheus (internal only)
   ```

4. **Database Security**
   - Regular backups (automated daily)
   - Encryption at rest
   - User-level access controls

5. **API Security**
   - Rate limiting (500 req/min per IP)
   - CORS enabled for specific origins
   - CSRF protection tokens
   - Input validation & sanitization

### Encrypted Fields

**Automatically encrypted in database:**
- Passwords (bcrypt + AES)
- Employee numbers
- QR codes
- First/last names
- Email addresses
- Phone numbers

---

## 💾 Backup & Recovery

### Automated Backup Strategy

**Daily Backups (Recommended):**

**Docker:**
```bash
# Create backup script
cat > backup-docker.sh << 'EOF'
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
docker exec dgmc_mysql mysqldump -uroot -proot dgmc | gzip > backups/dgmc_$DATE.sql.gz
echo "Backup completed: backups/dgmc_$DATE.sql.gz"
EOF

chmod +x backup-docker.sh

# Add to crontab (runs daily at 2 AM)
(crontab -l 2>/dev/null; echo "0 2 * * * /path/to/backup-docker.sh") | crontab -
```

**PM2 (Hospital Server):**
```bash
# Create backup script
cat > backup-pm2.sh << 'EOF'
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
mysqldump -u root -proot dgmc | gzip > backups/dgmc_$DATE.sql.gz
echo "Backup completed: backups/dgmc_$DATE.sql.gz"
EOF

chmod +x backup-pm2.sh

# Add to crontab (runs daily at 2 AM)
(crontab -l 2>/dev/null; echo "0 2 * * * /path/to/backup-pm2.sh") | crontab -
```

### Manual Backup

```bash
# Docker
docker exec dgmc_mysql mysqldump -uroot -proot dgmc > dgmc_backup_$(date +%Y%m%d).sql

# PM2
mysqldump -u root -proot dgmc > dgmc_backup_$(date +%Y%m%d).sql
```

### Restore from Backup

```bash
# Docker
docker exec -i dgmc_mysql mysql -uroot -proot dgmc < dgmc_backup_20260910.sql

# PM2
mysql -u root -proot dgmc < dgmc_backup_20260910.sql

# Verify restoration
curl http://localhost:3000/api/health
```

---

## ⚡ Performance Tuning

### MySQL Optimization

**Edit `.env` for connection pooling:**
```env
MYSQL_CONNECTION_LIMIT=20
MYSQL_QUEUE_LIMIT=0
```

**Enable query caching (if using older MySQL):**
```sql
SET GLOBAL query_cache_size = 64 * 1024 * 1024;
```

### Redis Caching

**Verify Redis is connected:**
```bash
redis-cli ping
# Should return: PONG
```

**Monitor Redis performance:**
```bash
redis-cli INFO stats
```

### Docker Resource Limits

**Edit `docker-compose.yml`:**
```yaml
services:
  app:
    deploy:
      resources:
        limits:
          cpus: '2.0'
          memory: 2G
        reservations:
          cpus: '1.0'
          memory: 1G
```

### PM2 Clustering

**Use all CPU cores:**
```javascript
// ecosystem.config.cjs
instances: "max",          // Auto-detect CPU count
exec_mode: "cluster",      // Load balancing
```

**Monitor cluster:**
```bash
pm2 logs dgmc-hospital-app  # View all worker logs
pm2 scale dgmc-hospital-app 4  # Scale to 4 workers
```

---

## 📖 API Documentation

### Health Check Endpoint

**GET /api/health**
```bash
curl http://localhost:3000/api/health
```

Returns system status, database health, memory usage, uptime.

### Database Status

**GET /api/db-status**
```bash
curl http://localhost:3000/api/db-status
```

Returns MySQL and SQLite connection status.

### OpenAPI Specification

**GET /api/openapi.json**
```bash
curl http://localhost:3000/api/openapi.json
```

### Swagger UI

**Open in browser:**
```
http://localhost:3000/api/swagger-ui
```

Interactive API documentation.

---

## 📝 Support & Logging

### Log Locations

**Docker:**
- App logs: `docker logs dgmc_app`
- MySQL logs: `docker logs dgmc_mysql`
- All: `docker compose logs`

**PM2:**
- Output log: `logs/out.log`
- Error log: `logs/err.log`
- Real-time: `pm2 logs dgmc-hospital-app`

### Log Levels

```
ERROR   - Critical failures requiring immediate action
WARN    - Issues that should be investigated
INFO    - Important system events
DEBUG   - Detailed diagnostic information
```

### Export Logs

```bash
# Docker
docker logs dgmc_app > app_logs.txt 2>&1

# PM2
pm2 logs dgmc-hospital-app > app_logs.txt

# Compress for sharing
tar -czf logs_$(date +%Y%m%d).tar.gz logs/
```

### Support Resources

- **Documentation:** See `HOSPITAL_DEPLOYMENT.md` and `DOCKER_AUTORECOVERY.md`
- **Health Check:** `curl http://localhost:3000/api/health`
- **System Status:** `pm2 status` or `docker ps`
- **Error Logs:** Check application logs mentioned above

### Getting Help

When reporting issues, include:
1. Application version (`npm run build`)
2. Full error logs (last 50 lines)
3. System info (`docker stats` or `pm2 monit`)
4. Steps to reproduce
5. Expected vs actual behavior

---

## 📊 Deployment Comparison

| Feature | Docker | PM2 |
|---------|--------|-----|
| Setup Time | 5 min | 10 min |
| Auto-Recovery | ✅ Yes | ✅ Yes |
| Clustering | ✅ Yes | ✅ Yes |
| Memory Management | ✅ Yes | ✅ Yes |
| Logs | Docker logs | logs/ files |
| Monitoring | Prometheus/Grafana | PM2 monit |
| Production Ready | ✅ Yes | ✅ Yes |
| Hospital Server | ❌ Requires Docker | ✅ Bare Metal |
| Scalability | Limited to 1 host | Single server or cluster |

---

## 🎯 Next Steps

1. **Deploy Application**
   - Choose Docker or PM2 based on your infrastructure
   - Follow Quick Start or detailed deployment guide

2. **Configure Database**
   - Change default credentials
   - Set up automated backups
   - Test database connectivity

3. **Set Up Monitoring**
   - Access Grafana dashboard
   - Create custom alerts
   - Monitor performance metrics

4. **Security Hardening**
   - Enable HTTPS with reverse proxy
   - Configure firewall rules
   - Regular security audits

5. **Go Live**
   - Test all workflows with sample data
   - Train staff on system usage
   - Set up support procedures

---

**Version:** 1.0.0  
**Last Updated:** September 2026  
**Maintained By:** DGMC Development Team

For updates and support, refer to project repository and issue tracker.
