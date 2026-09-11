module.exports = {
  apps: [
    {
      name: "dgmc-hospital-app",
      script: "./dist/server.cjs",
      instances: 1,
      exec_mode: "fork",
      wait_ready: true,
      listen_timeout: 30000,
      kill_timeout: 5000,
      env: {
        NODE_ENV: "production",
        PORT: 3000,
        HEALTH_CHECK_PATH: "/api/health",
        HEALTH_CHECK_INTERVAL_MS: 30000,
        MYSQL_HOST: process.env.MYSQL_HOST || "localhost",
        MYSQL_PORT: process.env.MYSQL_PORT || "3311",
        MYSQL_USER: process.env.MYSQL_USER || "root",
        MYSQL_PASSWORD: process.env.MYSQL_PASSWORD || "root",
        MYSQL_DATABASE: process.env.MYSQL_DATABASE || "dgmc",
        REDIS_URL: process.env.REDIS_URL || "redis://localhost:6379",
        REDIS_HOST: process.env.REDIS_HOST || "localhost",
        REDIS_PORT: process.env.REDIS_PORT || "6379"
      },
      error_file: "./logs/err.log",
      out_file: "./logs/out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      merge_logs: true,
      autorestart: true,
      max_memory_restart: "500M",
      watch: false,
      ignore_watch: ["node_modules", "dist", "logs"],
      max_restarts: 15,
      min_uptime: "30s",
      restart_delay: 5000,
      // Health check configuration
      cron_restart: "0 0 * * *",
      // Graceful shutdown
      kill_timeout: 8000,
      // For Docker: wait for containers to be ready
      delay_between_restart: 8000
    }
  ]
};
