const path = require('path');
const os = require('os');

// Scale automatically up to CPU count, but cap at 8 workers to conserve RAM
const maxInstances = process.env.PM2_INSTANCES 
  ? parseInt(process.env.PM2_INSTANCES, 10) 
  : Math.min(os.cpus().length, 8);

module.exports = {
  apps: [
    {
      name: "dgmc-hospital-app",
      script: path.join(__dirname, "dist", "server.cjs"),
      instances: maxInstances,
      exec_mode: "cluster",
      instance_var: "INSTANCE_ID",
      wait_ready: true,
      listen_timeout: 15000,
      kill_timeout: 5000,
      exp_backoff_restart_delay: 200,
      env: {
        NODE_ENV: "production",
        PORT: 3000,
        HEALTH_CHECK_PATH: "/api/health",
        HEALTH_CHECK_INTERVAL_MS: 30000,
        MYSQL_HOST: process.env.MYSQL_HOST || "127.0.0.1",
        MYSQL_PORT: process.env.MYSQL_PORT || "3311",
        MYSQL_USER: process.env.MYSQL_USER || "root",
        MYSQL_PASSWORD: process.env.MYSQL_PASSWORD || "rootpassword",
        MYSQL_DATABASE: process.env.MYSQL_DATABASE || "dgmc_meals",
        REDIS_URL: process.env.REDIS_URL || "redis://127.0.0.1:6379",
        REDIS_HOST: process.env.REDIS_HOST || "127.0.0.1",
        REDIS_PORT: process.env.REDIS_PORT || "6379"
      },
      error_file: path.join(__dirname, "logs", "err.log"),
      out_file: path.join(__dirname, "logs", "out.log"),
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      merge_logs: true,
      autorestart: true,
      max_memory_restart: "450M",
      watch: false,
      ignore_watch: ["node_modules", "dist", "logs", ".git"],
      max_restarts: 15,
      min_uptime: "10s"
    }
  ]
};
