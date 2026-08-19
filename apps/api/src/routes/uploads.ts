import { Hono } from 'hono';
import { z } from 'zod';
import { generateUploadUrl, generateDownloadUrl } from '../lib/storage';
import { authMiddleware } from '../middleware/auth';
import { rateLimiter } from '../middleware/rate-limiter';
import { nanoid } from 'nanoid';
import type { AppEnv } from '../types/env';

export const uploadRoutes = new Hono<AppEnv>();

uploadRoutes.use('*', rateLimiter({ maxRequests: 30 }));
uploadRoutes.use('*', authMiddleware);

const requestUploadSchema = z.object({
  fileName: z.string().min(1),
  contentType: z.string().min(1),
  fileSize: z.number().int().min(1).max(50 * 1024 * 1024),
  entityType: z.string().optional(),
  entityId: z.string().uuid().optional(),
});

uploadRoutes.post('/request-url', async (c) => {
  const authCtx = c.get('auth');
  const body = await c.req.json();
  const validated = requestUploadSchema.parse(body);

  const ext = validated.fileName.split('.').pop();
  const entityDir = validated.entityType || 'general';
  const key = `${authCtx.orgId}/${entityDir}/${nanoid()}.${ext}`;

  const uploadUrl = await generateUploadUrl(key, validated.contentType);
  const downloadUrl = await generateDownloadUrl(key);

  return c.json({
    success: true,
    data: {
      uploadUrl,
      key,
      downloadUrl,
    },
  });
});

uploadRoutes.get('/download-url', async (c) => {
  const key = c.req.query('key');
  if (!key) {
    return c.json(
      { success: false, error: { code: 'MISSING_KEY', message: 'key query parameter required' } },
      400,
    );
  }
  const url = await generateDownloadUrl(key);
  return c.json({ success: true, data: { url } });
});
