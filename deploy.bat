@echo off
REM Hospital Server Deployment & Update Script for DGMC App (Windows)
REM Run this on the Windows server to pull updates, build, and run with PM2

echo ===================================================
echo        DGMC Hospital Server Deployment / Update
echo ===================================================
echo.

echo Step 1: Pulling latest changes from Git repository...
call git pull

echo.
echo Step 2: Installing dependencies...
call npm install --legacy-peer-deps

echo.
echo Step 3: Building production assets and server...
call npm run build

echo.
echo Step 4: Ensuring logs directory exists...
if not exist "logs" mkdir logs

echo.
echo Step 5: Reloading / Starting app with PM2...
call pm2 reload ecosystem.config.cjs --update-env || call pm2 start ecosystem.config.cjs

echo.
echo Step 6: Saving PM2 process list for auto-start...
call pm2 save

echo.
echo ===================================================
echo             Deployment Complete!
echo ===================================================
echo.
echo Status Commands:
echo   View app status:    pm2 status
echo   View live logs:     pm2 logs dgmc-hospital-app
echo   Restart app:        pm2 restart dgmc-hospital-app
echo   Stop app:           pm2 stop dgmc-hospital-app
echo.
echo Server accessible at: http://localhost:3000
pause
