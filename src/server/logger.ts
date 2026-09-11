import pino from "pino";

const isDev = process.env.NODE_ENV !== "production";

/**
 * Shared structured logger for the DGMC server.
 * - Development: pretty-printed, human-readable output via pino-pretty.
 * - Production:  newline-delimited JSON — compatible with PM2 log rotation,
 *               Grafana Loki, ELK, and any SIEM that ingests JSON logs.
 */
const logger = pino(
  {
    level: process.env.LOG_LEVEL || "info",
    // Redact sensitive fields that must never appear in logs
    redact: {
      paths: ["req.headers.authorization", "*.password", "*.qr_code", "*.token"],
      censor: "[REDACTED]",
    },
    base: {
      pid: process.pid,
      service: "dgmc-server",
    },
    timestamp: pino.stdTimeFunctions.isoTime,
  },
  isDev
    ? pino.transport({
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "SYS:HH:MM:ss",
          ignore: "pid,hostname,service",
        },
      })
    : undefined
);

export default logger;
