# Docker Auto-Recovery & PM2 Production Setup

## Files Updated

### 1. **ecosystem.config.cjs** ✅ 
Configured for robust production performance:
- **instances: "max"** — Uses all CPU cores for clustering
- **exec_mode: "cluster"** — Load balancing across workers
- **kill_timeout: 4000** — Graceful 4-second shutdown
- **max_memory_restart: "500M"** — Auto-restart if exceeding 500MB
- **wait_ready: true** — Waits for app to signal readiness
- **max_restarts: 15** — Prevents restart loops

### 2. **docker-compose.yml** ✅
Enhanced with production-ready features:
- **Health checks** on all containers (5s interval)
- **Restart policy: unless-stopped** — Auto-restart on crash
- **Service dependencies** — App waits for MySQL & Redis to be healthy
- **Graceful shutdown** — 8-second delays between restarts

### 3. **Dockerfile** ✅
Simplified for production:
- Multi-stage build ready
- Health check support (curl)
- Production Node.js base image

## Docker Auto-Recovery Behavior

### On Shutdown/Reboot:
1. **Docker Desktop restarts** → Compose files auto-execute
2. **MySQL starts first** (5s health checks, 60s startup period)
3. **Redis starts** (health check waits for it)
4. **App waits** for both services to be healthy (depends_on)
5. **App connects** to MySQL automatically once healthy

**Total startup time:** ~30-45 seconds

### On Crash:
1. **Container crashes** → Docker detects (5s health check)
2. **Container restarts** (unless-stopped policy)
3. **App reconnects** to MySQL (connection pool retry logic)
4. **Monitoring logs** via `docker logs dgmc_app`

## PM2 for Hospital Server (Optional)

If running on a bare-metal Ubuntu/Windows hospital server instead of Docker:

```bash
# Deploy with PM2
chmod +x deploy.sh
./deploy.sh

# Or manually:
npm install -g pm2
npm run build
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup
```

### PM2 manages:
- **Auto-restart** on app crash
- **Auto-start** on server reboot
- **Cluster mode** across CPU cores
- **Memory limits** (500MB restart trigger)
- **Log rotation** (logs/out.log, logs/err.log)

## Verify Auto-Recovery

### Docker:
```bash
# Simulate restart
docker compose down
docker compose up -d

# Check status
docker ps -a
docker logs dgmc_app

# Test connectivity
curl http://localhost:3000/api/health
```

### PM2 (Hospital Server):
```bash
# Check running processes
pm2 status
pm2 info dgmc-hospital-app

# View logs
pm2 logs dgmc-hospital-app

# Monitor CPU/Memory
pm2 monit
```

## Production Checklist

- ✅ Docker: Auto-restart on crash
- ✅ Docker: Auto-start on reboot
- ✅ MySQL: Health checks active
- ✅ Redis: Health checks active
- ✅ App: Health endpoint working
- ✅ PM2: Cluster mode (max instances)
- ✅ PM2: Memory limits (500M restart)
- ✅ Logging: Available in logs/ directory
- ✅ Graceful shutdown: 4-8 second timeouts

## Database Connection After Restart

**Docker ensures automatic reconnection:**
1. MySQL container health check passes
2. Docker waits for "healthy" status
3. App container starts only after MySQL is ready
4. Connection pool automatically establishes on startup

**If still experiencing issues:**
```bash
# Check MySQL is running
docker exec dgmc_mysql mysql -uroot -proot -e "SELECT 1;"

# Check app logs for connection errors
docker logs dgmc_app | grep -i "mysql\|error\|connection"

# Manually restart app (MySQL will be ready)
docker compose restart dgmc_app
```

## Performance Metrics

Monitor with Prometheus/Grafana (port 3001):
- CPU usage across clusters
- Memory consumption
- Request latency
- Database query performance
- Container uptime

## Support

**For Docker issues:**
```bash
docker compose logs dgmc_app
docker inspect dgmc_app
docker network ls
docker network inspect dgmc-dietary-management-system-2026-08-10-f3094_default
```

**For PM2 issues (hospital server):**
```bash
pm2 logs dgmc-hospital-app
pm2 describe dgmc-hospital-app
pm2 kill    # Reset all processes
```
