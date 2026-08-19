import { ZodError } from 'zod';
import { logger } from '../lib/logger';
import type { AppEnv } from '../types/env';
import type { ErrorHandler } from 'hono';

export const errorHandler: ErrorHandler<AppEnv> = (err, c) => {
  const requestId = c.get('requestId');

  if (err instanceof ZodError) {
    logger.warn({ requestId, errors: err.errors }, 'Validation error');
    return c.json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request data',
        details: err.errors,
      },
    }, 400);
  }

  const statusCode = (err as any).status || 500;
  const message = statusCode === 500 ? 'Internal server error' : err.message;

  logger.error({ requestId, err, statusCode }, 'Unhandled error');

  return c.json({
    success: false,
    error: {
      code: statusCode === 500 ? 'INTERNAL_ERROR' : 'REQUEST_ERROR',
      message,
    },
  }, statusCode as any);
};
