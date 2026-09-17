#!/bin/bash
# Hospital Server Deployment Script for DGMC App
# Run this on the Ubuntu server to set up PM2

set -e

echo "=== DGMC Hospital Server Deployment ==="
echo "Step 1: Installing dependencies safely..."
npm install --legacy-peer-deps

echo "Step 2: Building the frontend assets..."
npx vite build

echo "Step 3: Compiling the backend server..."
npx esbuild server.ts --bundle --platform=node --format=cjs --packages=external --sourcemap --outfile=dist/server.cjs

echo "Step 4: Creating logs directory..."
mkdir -p logs

echo "Step 5: Starting app with PM2 using ecosystem config..."
pm2 start ecosystem.config.cjs

echo "Step 6: Saving PM2 process list..."
pm2 save

echo "Step 7: Setting up PM2 to start on server reboot..."
pm2 startup

echo ""
echo "=== Deployment Complete ==="
echo ""
echo "Management Commands:"
echo "  View app status:           pm2 status"
echo "  View live logs:            pm2 logs dgmc-hospital-app"
echo "  Restart app:               pm2 restart dgmc-hospital-app"
echo "  Stop app:                  pm2 stop dgmc-hospital-app"
echo "  View detailed info:        pm2 info dgmc-hospital-app"
echo "  Monitor CPU/Memory:        pm2 monit"
echo ""
echo "Server will be running at http://localhost:3000"
