import { describe, it, expect } from 'vitest';
import { app } from '../src/app.js';

describe('GET /health', () => {
  it('returns 200 with status ok', async () => {
    const res = await app.request('/health');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('ok');
  });

  it('includes version and uptime fields', async () => {
    const res = await app.request('/health');
    const body = await res.json();
    expect(body).toHaveProperty('version');
    expect(body).toHaveProperty('uptime');
    expect(typeof body.uptime).toBe('number');
  });
});

describe('404 handler', () => {
  it('returns 404 for unknown routes', async () => {
    const res = await app.request('/does-not-exist');
    expect(res.status).toBe(404);
  });
});
