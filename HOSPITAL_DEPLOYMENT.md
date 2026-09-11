# DGMC Hospital Server Deployment Guide

This guide explains how to deploy the DGMC Dietary Management System on a hospital Ubuntu or Windows server using PM2.

## Prerequisites

- Node.js 22+ installed on the server
- npm installed
- MySQL 8.0+ running on the server
- Redis installed (optional, for caching)
- Terminal/SSH access to the server

## Quick Deployment (5 minutes)

### On Ubuntu/Linux:

```bash
chmod +x deploy.sh
./deploy.sh
```

### On Windows:

```cmd
deploy.bat
```

This will automatically:
1. Install PM2 globally
2. Build the application (`npm run build`)
3. Start the app with PM2
4. Configure PM2 to auto-start on server reboot
5. Save the PM2 process list

## Manual Deployment Steps

If you prefer to run commands individually:

```bash
# Step 1: Install PM2
npm install -g pm2

# Step 2: Build the app
npm run build

# Step 3: Start with PM2 using ecosystem config
pm2 start ecosystem.config.js

# Step 4: Save and enable startup
pm2 save
pm2 startup
```

## Managing the App

### Check Status
```bash
pm2 status
pm2 info dgmc-hospital-app
```

### View Logs
```bash
pm2 logs dgmc-hospital-app          # Real-time logs
pm2 logs dgmc-hospital-app --lines 100  # Last 100 lines
```

### Restart After Updates
```bash
npm run build                       # Rebuild
pm2 restart dgmc-hospital-app       # Restart with PM2
```

### Monitor Resources
```bash
pm2 monit                           # Interactive CPU/Memory monitor
```

### Stop or Remove
```bash
pm2 stop dgmc-hospital-app
pm2 delete dgmc-hospital-app
pm2 kill                            # Stop all PM2 processes
```

## Configuration

The `ecosystem.config.js` file controls how PM2 runs your app. Key settings:

- **instances**: Number of worker processes (set to 1 for hospital use)
- **exec_mode**: "cluster" for multi-core load balancing
- **max_memory_restart**: Restart if using >500MB RAM
- **MYSQL_HOST**: Point to your hospital MySQL server
- **REDIS_URL**: Cache server (optional)
- **error_file** and **out_file**: Log file locations

Edit these values before deployment if needed.

## Health Check

The app provides a health endpoint:

```bash
curl http://localhost:3000/api/health
```

Returns:
- **status**: "healthy" or "degraded"
- **databases**: MySQL and SQLite connection status
- **cache**: Redis cache stats
- **system**: CPU, memory, uptime

## Auto-Start on Reboot

After running `pm2 startup`, PM2 will auto-start on server reboot. To verify:

```bash
pm2 list            # Shows startup command
sudo systemctl list-unit-files | grep pm2  # Verify systemd service (Linux)
```

## Troubleshooting

### App won't start
```bash
pm2 logs dgmc-hospital-app  # Check error messages
pm2 restart dgmc-hospital-app  # Force restart
```

### Port 3000 already in use
Edit `ecosystem.config.js` to change the port, or kill the process using port 3000:
```bash
lsof -i :3000           # Find process
kill -9 <PID>           # Kill it
```

### MySQL connection errors
- Verify MySQL is running: `mysql -uroot -p`
- Update `MYSQL_HOST`, `MYSQL_USER`, `MYSQL_PASSWORD` in `ecosystem.config.js`
- Restart: `pm2 restart dgmc-hospital-app`

### Memory issues
Increase `max_memory_restart` in `ecosystem.config.js`, then restart.

## Logs Location

- Standard output: `logs/out.log`
- Error output: `logs/err.log`

View live:
```bash
tail -f logs/out.log
tail -f logs/err.log
```

## Next Steps

1. Set up a reverse proxy (Nginx) for HTTPS
2. Configure firewall rules to allow hospital network access
3. Set up automated backups for MySQL
4. Monitor system performance with Prometheus/Grafana (already included)

## Support

For issues, check:
1. PM2 logs: `pm2 logs dgmc-hospital-app`
2. System logs (Linux): `journalctl -u pm2`
3. App health: `curl http://localhost:3000/api/health`
