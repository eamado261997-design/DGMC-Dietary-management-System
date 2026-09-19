# DGMC Server Transfer & Production Deployment Readiness Checklist

This document provides a step-by-step transfer guide for deploying the **DGMC Dietary Management System** to your production hospital server (Linux/Ubuntu, Windows Server, or Container Host).

---

## 1. Transfer Preparation Checklist

Before transferring files to the physical or virtual hospital server:

1. **Verify Files to Copy**:
   - `src/`, `public/`, `server.ts`, `tsconfig.json`, `vite.config.ts`, `package.json`
   - `schema.sql`, `init.sql` (Database table definitions & default administrator accounts)
   - `ecosystem.config.cjs` (PM2 process orchestration config)
   - `deploy.sh` (Linux automated setup script) / `deploy.bat` (Windows automated setup script)
   - `docker-compose.yml`, `Dockerfile`, `nginx.conf`
   - `.env.example` (template for your production environment variables)

2. **Server Prerequisites**:
   - **Node.js**: v20.x or v22.x LTS installed (`node -v` & `npm -v`)
   - **Database** (Optional / Recommended): MySQL 8.0+ or MariaDB 10.5+
   - **In-Memory Cache** (Optional): Redis 7+
   - **Process Manager**: PM2 (`npm install -g pm2`)

---

## 2. Option A: Native PM2 Deployment (Linux / Ubuntu)

### Step 1: Copy Code to Target Server
Transfer the project folder to `/var/www/dgmc` (or via Git clone):
```bash
cd /var/www/dgmc
```

### Step 2: Configure Environment
```bash
cp .env.example .env
nano .env
```
Set your production settings:
```env
PORT=3000
NODE_ENV=production
JWT_SECRET=your_super_secret_jwt_key_here
MYSQL_HOST=127.0.0.1
MYSQL_PORT=3306
MYSQL_USER=dgmc_user
MYSQL_PASSWORD=dgmc_secure_password
MYSQL_DATABASE=dgmc_meals
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
```

### Step 3: Run Automated Deployment Script
```bash
chmod +x deploy.sh
./deploy.sh
```
*This script installs dependencies, builds the production frontend (`vite build`), bundles the backend (`esbuild`), and registers the service with PM2 with auto-restart on system reboot.*

### Step 4: Verify Service Status
```bash
pm2 status
pm2 logs dgmc-hospital-app
curl http://localhost:3000/api/health
```

---

## 3. Option B: Native PM2 Deployment (Windows Server)

1. Open **Command Prompt** or **PowerShell** as Administrator in your application directory:
   ```cmd
   cd C:\DGMC-Dietary-management-System
   ```
2. Create `.env` from `.env.example` and set your database credentials.
3. Run the automated deployment batch file:
   ```cmd
   deploy.bat
   ```
4. To configure PM2 to auto-start on Windows boot:
   ```cmd
   npm install -g pm2-windows-service
   pm2-service-install
   ```

---

## 4. Option C: Containerized Stack (Docker & Docker Compose)

If your hospital server has **Docker** and **Docker Compose** installed, you can launch the complete ecosystem (Node App + MySQL 8 + Redis 7) with a single command:

1. Configure `.env`:
   ```bash
   cp .env.example .env
   ```
2. Build and launch all services:
   ```bash
   docker compose up -d --build
   ```
3. Check container health:
   ```bash
   docker compose ps
   docker compose logs -f app
   ```

---

## 5. Nginx Reverse Proxy (Hospital Intranet Port 80 / 443)

To expose the application across the hospital network on standard port 80 or SSL:

1. Link the provided `nginx.conf`:
   ```bash
   sudo cp nginx.conf /etc/nginx/sites-available/dgmc
   sudo ln -s /etc/nginx/sites-available/dgmc /etc/nginx/sites-enabled/
   ```
2. Test and restart Nginx:
   ```bash
   sudo nginx -t
   sudo systemctl restart nginx
   ```

---

## 6. Post-Transfer Verification Checklist

| Test Item | Verification Command / Action | Expected Result |
| :--- | :--- | :--- |
| **API Health** | `curl -i http://localhost:3000/api/health` | `200 OK` with system health JSON |
| **Telemetry & Stats** | `curl -i http://localhost:3000/api/public-stats` | Returns branding & hospital metadata |
| **Web Interface** | Open `http://<SERVER_IP>:3000` or `http://<SERVER_IP>` in browser | DGMC Dietary Portal loads cleanly |
| **Admin Login** | Log in with initial administrator credentials | Dashboard displays with full management tools |
| **PM2 Process** | `pm2 status` | Status shows `online` with auto-restart enabled |
