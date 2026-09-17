#!/bin/bash

# DGMC Docker Cleanup Utility (Linux/macOS)
echo "=== DGMC Docker Cleanup Utility ==="
echo ""

echo "[1/2] Stopping and removing containers: dgmc_mysql, dgmc_redis..."
docker rm -f dgmc_mysql dgmc_redis 2>/dev/null

echo "[2/2] Pruning orphaned docker-compose resources..."
docker compose down --remove-orphans 2>/dev/null

echo ""
echo "=== Cleanup Complete ==="
echo "You can now run: docker compose up -d"
