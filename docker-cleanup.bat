@echo off
echo === DGMC Docker Cleanup Utility ===
echo.
echo This script will force remove any existing DGMC containers to prevent conflicts.
echo.

echo [1/2] Stopping and removing containers: dgmc_mysql, dgmc_redis...
docker rm -f dgmc_mysql dgmc_redis 2>nul

echo [2/2] Pruning orphaned docker-compose resources...
docker compose down --remove-orphans 2>nul

echo.
echo === Cleanup Complete ===
echo You can now run: docker compose up -d
echo.
pause
