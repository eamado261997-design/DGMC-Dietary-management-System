const path = require('path');
const fs = require('fs');

const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) {
  try {
    fs.mkdirSync(logsDir, { recursive: true });
  } catch (e) {
    // Ignore directory creation error if already exists
  }
}

module.exports = {
  apps: [
    {
      name: "dgmc-hospital-app",
      script: path.join(__dirname, "dist", "server.cjs"),
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      max_memory_restart: "600M",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
        MYSQL_HOST: process.env.MYSQL_HOST || "127.0.0.1",
        MYSQL_PORT: process.env.MYSQL_PORT || "3311",
        MYSQL_USER: process.env.MYSQL_USER || "root",
        MYSQL_PASSWORD: process.env.MYSQL_PASSWORD || "rootpassword",
        MYSQL_DATABASE: process.env.MYSQL_DATABASE || "dgmc_meals",
        REDIS_URL: process.env.REDIS_URL || "redis://127.0.0.1:6379",
        REDIS_HOST: process.env.REDIS_HOST || "127.0.0.1",
        REDIS_PORT: process.env.REDIS_PORT || "6379"
      },
      error_file: path.join(logsDir, "err.log"),
      out_file: path.join(logsDir, "out.log"),
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      merge_logs: true,
      watch: false,
      ignore_watch: ["node_modules", "dist", "logs", ".git", "*.db*"],
      max_restarts: 10,
      min_uptime: "5s"
    }
  ]
};
