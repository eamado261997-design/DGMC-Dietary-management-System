#!/bin/bash
# PM2 Health Check Script
# Returns JSON status of all PM2 processes

pm2_json=$(pm2 jlist 2>/dev/null || echo "[]")

if [ "$pm2_json" = "[]" ]; then
  echo '{"status": "no_processes", "message": "PM2 not running or no processes", "processes": []}'
else
  echo "$pm2_json" | jq '{
    status: (if (.[] | select(.pm2_env.status == "online")) then "running" else "stopped" end),
    processes: [.[] | {
      name: .name,
      status: .pm2_env.status,
      pid: .pid,
      memory: .monit.memory,
      cpu: .monit.cpu,
      restarts: .pm2_env.restart_time,
      uptime: .pm2_env.pm_uptime,
      instances: .instances
    }]
  }'
fi
