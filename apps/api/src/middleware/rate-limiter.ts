import type { MiddlewareHandler } from 'hono';
import { redis } from '../lib/redis.js';

interface RateLimiterOptions {
  windowMs?: number;
  maxRequests?: number;
  keyPrefix?: string;
}

export const rateLimiter = (options: RateLimiterOptions = {}): MiddlewareHandler => {
  const {
    windowMs = 60000,
    maxRequests = 100,
    keyPrefix = 'rl',
  } = options;

  return async (c, next) => {
    const ip = c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'unknown';
    const key = `${keyPrefix}:${ip}`;

    try {
      const current = await redis.incr(key);

      if (current === 1) {
        await redis.pexpire(key, windowMs);
      }

      if (current > maxRequests) {
        const ttl = await redis.pttl(key);
        c.header('X-RateLimit-Limit', String(maxRequests));
        c.header('X-RateLimit-Remaining', '0');
        c.header('X-RateLimit-Reset', String(Math.ceil(ttl / 1000)));

        return c.json({
          success: false,
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Too many requests. Please try again later.',
          },
        }, 429);
      }

      c.header('X-RateLimit-Limit', String(maxRequests));
      c.header('X-RateLimit-Remaining', String(maxRequests - current));

      await next();
    } catch {
      await next();
    }
  };
};
