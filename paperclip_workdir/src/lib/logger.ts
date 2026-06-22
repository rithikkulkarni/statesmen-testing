import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  transport:
    process.env.NODE_ENV === 'development'
      ? { target: 'pino-pretty', options: { colorize: true } }
      : undefined,
  base: {
    service: 'rit-api',
    version: process.env.npm_package_version ?? '0.1.0',
    env: process.env.NODE_ENV ?? 'production',
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});
