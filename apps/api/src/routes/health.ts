import { Hono } from 'hono';
import { sql } from 'drizzle-orm';
import { db } from '@airove/db';
import { redis } from '../lib/redis.js';
import type { AppEnv } from '../types/env.js';

export const healthRoutes = new Hono<AppEnv>();

healthRoutes.get('/live', (c) => {
  return c.json({ status: 'alive', timestamp: new Date().toISOString() });
});

healthRoutes.get('/ready', async (c) => {
  const checks: Record<string, string> = {};

  try {
    await db.execute(sql`SELECT 1`);
    checks['database'] = 'ok';
  } catch {
    checks['database'] = 'error';
  }

  try {
    await redis.ping();
    checks['redis'] = 'ok';
  } catch {
    checks['redis'] = 'error';
  }

  const allHealthy = Object.values(checks).every((v) => v === 'ok');

  return c.json(
    {
      status: allHealthy ? 'ready' : 'degraded',
      checks,
      timestamp: new Date().toISOString(),
    },
    allHealthy ? 200 : 503,
  );
});
