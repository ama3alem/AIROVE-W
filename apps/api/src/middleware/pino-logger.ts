import type { MiddlewareHandler } from 'hono';
import { logger as pinoLoggerFn } from '../lib/logger.js';

export const pinoLogger = (): MiddlewareHandler => {
  return async (c, next) => {
    const start = Date.now();
    await next();
    const duration = Date.now() - start;

    pinoLoggerFn.info({
      method: c.req.method,
      path: c.req.path,
      status: c.res.status,
      duration: `${duration}ms`,
      requestId: c.get('requestId'),
    }, 'Request completed');
  };
};
