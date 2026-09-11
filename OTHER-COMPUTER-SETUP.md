# DGMC Setup on Another Computer

Use this checklist to install and run the DGMC Dietary Management System on another Windows computer.

## 1. Install prerequisites

Install the following:

- Node.js (use the same major version as the current computer)
- Docker Desktop with WSL2 enabled
- Git
- PM2:

```powershell
npm install -g pm2
```

Make sure Docker Desktop is running before continuing.

## 2. Copy or clone the project

Clone the repository:

```powershell
git clone <REPOSITORY_URL>
cd DGMC-Dietary-management-system-2026-08-10-f3094
```

Or copy the project folder manually.

Do not copy `node_modules`. It will be installed again. Copy `.env` securely from the original computer, or create it from `.env.example`.

## 3. Configure `.env`

Use the local Docker service ports:

```env
NODE_ENV=production
MYSQL_HOST=127.0.0.1
MYSQL_PORT=3311
MYSQL_USER=dgmc_user
MYSQL_PASSWORD=dgmc_password
MYSQL_DATABASE=dgmc_meals
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
REDIS_PASSWORD=
```

Keep secrets such as `JWT_SECRET` and `GEMINI_API_KEY` private. Do not commit `.env`.

## 4. Start Docker services

From the project root:

```powershell
docker compose up -d
docker compose ps
```

The computer must have these ports available:

- App: `3000`
- MySQL: `3311`
- Redis: `6379`
- Prometheus: `9090`
- Grafana: `3001`

### Redis note

The current `docker-compose.yml` does not define Redis. Create it separately on the new computer:

```powershell
docker run -d --name dgmc_redis --restart unless-stopped -p 6379:6379 redis:7-alpine
```

Verify Redis:

```powershell
docker exec dgmc_redis redis-cli ping
```

Expected result:

```text
PONG
```

## 5. Install dependencies and build

```powershell
npm ci
npm run build
```

If no lockfile is available, use `npm install` instead of `npm ci`.

## 6. Start the production app with PM2

```powershell
pm2 start ecosystem.config.cjs
pm2 save
pm2 status
```

The app should show as `online` and listen on port `3000`.

## 7. Verify the installation

```powershell
$health = Invoke-WebRequest http://localhost:3000/api/health -UseBasicParsing
$health.Content
```

Confirm that the response reports:

- `status`: `healthy`
- MySQL connected
- SQLite connected

Also check:

```powershell
docker compose ps
docker ps --filter "name=dgmc_"
```

Open the app:

```text
http://localhost:3000
```

## 8. Preserve existing database data

A new computer creates a new empty MySQL Docker volume. Export data from the original computer if existing records must be preserved:

```powershell
docker exec dgmc_mysql mysqldump -uroot -prootpassword dgmc_meals > dgmc_backup.sql
```

Copy `dgmc_backup.sql` to the new computer. Start MySQL first, then restore it:

```powershell
Get-Content .\dgmc_backup.sql | docker exec -i dgmc_mysql mysql -uroot -prootpassword dgmc_meals
```

Only copy `db.json` if the local JSON fallback data is also needed. Production mode uses MySQL when `MYSQL_HOST` is configured.

## 9. Enable automatic startup

In Docker Desktop settings, enable starting Docker Desktop with Windows.

PM2 process persistence:

```powershell
pm2 save
```

PM2 must also be configured to run `pm2 resurrect` when the Windows user logs in. A Windows Task Scheduler entry is preferred; a per-user startup entry can also be used if administrator access is unavailable.

After Windows login, verify:

```powershell
pm2 status
Invoke-WebRequest http://localhost:3000/api/health -UseBasicParsing
```

## 10. Optional phone access on the same Wi-Fi

Find the new computer's Wi-Fi IPv4 address:

```powershell
Get-NetIPAddress -AddressFamily IPv4
```

From a phone connected to the same Wi-Fi network, open:

```text
http://<COMPUTER_WIFI_IP>:3000
```

If it does not connect, allow inbound TCP port `3000` through Windows Firewall and make sure the phone is not using guest Wi-Fi or mobile data.
