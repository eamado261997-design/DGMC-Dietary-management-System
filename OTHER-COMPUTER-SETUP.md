# DGMC Setup on Another Computer

Use this checklist to install and run the DGMC Dietary Management System on another computer (Windows/Linux/macOS) using Docker and PM2.

## 1. Install Prerequisites

Install the following tools:
- Node.js (Version 18+ or 22 LTS)
- Docker Desktop with WSL2 enabled (or Docker Engine + Docker Compose on Linux)
- Git
- PM2 (global install):
  ```powershell
  npm install -g pm2
  ```

Ensure Docker Desktop is running before continuing.

---

## 2. Clone the Repository

Clone your repository on the target computer:
```powershell
git clone https://github.com/eamado261997-design/DGMC-Dietary-management-System.git
cd DGMC-Dietary-management-System
```

Copy your production `.env` file securely from the original computer into the project root (or create it based on `.env.example`).

---

## 3. Start Multi-Container Infrastructure via Docker Compose

Our unified `docker-compose.yml` orchestrates **MySQL (`db`)**, **Redis (`cache`)**, **Prometheus**, **Grafana**, and the **App (`app`)** with persistent data volumes.

1. **Build and start all containers**:
   ```powershell
   docker compose up --build -d
   ```

2. **Verify container health**:
   ```powershell
   docker compose ps
   ```

All required ports:
- App / Nginx: `3000` (or `80`/`443` if mapped)
- MySQL (`db`): `3311` (internal `3306`)
- Redis (`cache`): `6379`
- Prometheus: `9090`
- Grafana: `3001`

---

## 4. Install Dependencies & Build Production Bundle

If running the app alongside or outside Docker with PM2:

```powershell
npm install
npm run build
```
*(This compiles the React frontend via Vite and bundles the Node.js server into `dist/server.cjs`)*

---

## 5. Start with PM2 Cluster Mode

```powershell
npm run pm2:start
pm2 save
pm2 status
```

Monitor logs or metrics:
```powershell
npx pm2 logs dgmc-hospital-app
npx pm2 monit
```

---

## 6. Verify the Installation

Check health status:
```powershell
Invoke-WebRequest http://localhost:3000/api/health -UseBasicParsing
```

Open in your browser:
```text
http://localhost:3000
```

---

## 7. Database Migration & Backup (Optional)

To migrate an existing database from your original computer:
1. **Export on original PC**:
   ```powershell
   docker exec dgmc_db mysqldump -uroot -prootpassword dgmc_meals > dgmc_backup.sql
   ```
2. **Import on new PC**:
   ```powershell
   Get-Content .\dgmc_backup.sql | docker exec -i dgmc_db mysql -uroot -prootpassword dgmc_meals
   ```
