import { Hono } from 'hono';
import { logger as pinoLogger } from './lib/logger.js';
import { healthRouter } from './routes/health.js';

export const app = new Hono();

app.use('*', async (c, next) => {
  const start = Date.now();
  await next();
  const ms = Date.now() - start;
  pinoLogger.info({ method: c.req.method, path: c.req.path, status: c.res.status, ms }, 'request');
});

app.route('/health', healthRouter);

app.notFound((c) => {
  return c.json({ error: 'not found' }, 404);
});

app.onError((err, c) => {
  pinoLogger.error({ err, path: c.req.path }, 'unhandled error');
  return c.json({ error: 'internal server error' }, 500);
});
