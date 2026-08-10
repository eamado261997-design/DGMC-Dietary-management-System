import winston from 'winston';

const { createLogger, format, transports } = winston;

export const logger = createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: format.combine(
    format.timestamp(),
    format.errors({ stack: true }),
    format.json()
  ),
  defaultMeta: { service: 'dgmc-app' },
  transports: [
    new transports.Console({
      stderrLevels: ['error'],
      format: process.env.NODE_ENV === 'production'
        ? format.json()
        : format.combine(
            format.colorize(),
            format.printf(({ timestamp, level, message, service, ...meta }) => {
              const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
              return `[${timestamp}] ${level}: ${message}${metaStr}`;
            })
          )
    })
  ]
});

export default logger;
