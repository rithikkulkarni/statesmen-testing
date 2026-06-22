import { Hono } from 'hono';

const version = process.env.npm_package_version ?? '0.1.0';
const commit = process.env.GIT_COMMIT ?? 'unknown';
const buildTime = process.env.BUILD_TIME ?? new Date().toISOString();

export const healthRouter = new Hono();

healthRouter.get('/', (c) => {
  return c.json({
    status: 'ok',
    version,
    commit,
    buildTime,
    uptime: process.uptime(),
  });
});
