@echo off
REM Docker Compose automated build and run script for Windows (PowerShell / CMD)
REM Ensures local images are built rather than pulled from Docker Hub

echo ===================================================
echo     DGMC Docker Stack - Build & Startup Script
echo ===================================================
echo.

echo Step 1: Building and starting all Docker containers...
docker compose up -d --build

echo.
echo Step 2: Checking container status...
docker compose ps

echo.
echo ===================================================
echo   Containers initialized!
echo   App URL: http://localhost:3000 or http://localhost:80
echo ===================================================
pause
