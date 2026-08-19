import { Hono } from 'hono';
import { db, cases } from '@airove/db';
import { eq, and, sql } from 'drizzle-orm';
import {
  createCaseSchema,
  updateCaseSchema,
  assignCaseSchema,
  reassignCaseSchema,
  resolveCaseSchema,
  paginationSchema,
} from '@airove/shared';
import { PERMISSIONS } from '@airove/shared';
import { authMiddleware, requirePermission } from '../middleware/auth.js';
import { rateLimiter } from '../middleware/rate-limiter.js';
import { caseService } from '../lib/case-service.js';
import { caseActivityService } from '../lib/case-activity-service.js';
import type { AppEnv } from '../types/env.js';

export const caseRoutes = new Hono<AppEnv>();

caseRoutes.use('*', rateLimiter({ maxRequests: 60 }));
caseRoutes.use('*', authMiddleware);

caseRoutes.get('/', requirePermission(PERMISSIONS.CASE_READ), async (c) => {
  const authCtx = c.get('auth');
  const query = c.req.query();
  const page = parseInt(query['page'] ?? '1', 10);
  const pageSize = parseInt(query['pageSize'] ?? '20', 10);

  const result = await caseService.listCases(authCtx.orgId, {
    status: query['status'] as string | undefined,
    priority: query['priority'] as string | undefined,
    caseType: query['caseType'] as string | undefined,
    assignedTo: query['assignedTo'] as string | undefined,
    page,
    pageSize,
  });

  return c.json({ success: true, data: result });
});

caseRoutes.post('/', requirePermission(PERMISSIONS.CASE_CREATE), async (c) => {
  const authCtx = c.get('auth');
  const body = await c.req.json();
  const validated = createCaseSchema.parse(body);

  const newCase = await caseService.createCase(
    {
      caseType: validated.caseType,
      baggageId: validated.baggageId,
      flightId: validated.flightId,
      journeyId: validated.journeyId,
      title: validated.title,
      priority: validated.priority,
      description: validated.description,
      source: validated.source,
      sourceExceptionId: validated.sourceExceptionId,
      assignedTo: validated.assignedTo,
      assignedOrganizationId: validated.assignedOrganizationId,
      metadata: validated.metadata as Record<string, unknown> | undefined,
    },
    authCtx.orgId,
    authCtx.userId,
  );

  await caseActivityService.logCaseCreated(newCase.id, authCtx.orgId, authCtx.userId);

  return c.json({ success: true, data: newCase }, 201);
});

caseRoutes.get('/:id', requirePermission(PERMISSIONS.CASE_READ), async (c) => {
  const authCtx = c.get('auth');
  const { id } = c.req.param();

  const found = await caseService.getCase(id, authCtx.orgId);
  if (!found) {
    return c.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Case not found' } },
      404,
    );
  }

  return c.json({ success: true, data: found });
});

caseRoutes.patch('/:id', requirePermission(PERMISSIONS.CASE_UPDATE), async (c) => {
  const authCtx = c.get('auth');
  const { id } = c.req.param();
  const body = await c.req.json();
  const validated = updateCaseSchema.parse(body);

  const existing = await caseService.getCase(id, authCtx.orgId);
  if (!existing) {
    return c.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Case not found' } },
      404,
    );
  }

  const updated = await caseService.updateCase(id, authCtx.orgId, {
    title: validated.title,
    description: validated.description,
    priority: validated.priority,
    metadata: validated.metadata as Record<string, unknown> | undefined,
  });

  if (validated.priority && validated.priority !== existing.priority) {
    await caseActivityService.logCasePriorityChanged(
      id, authCtx.orgId, authCtx.userId, existing.priority, validated.priority,
    );
  }

  return c.json({ success: true, data: updated });
});

caseRoutes.post('/:id/assign', requirePermission(PERMISSIONS.CASE_ASSIGN), async (c) => {
  const authCtx = c.get('auth');
  const { id } = c.req.param();
  const body = await c.req.json();
  const validated = assignCaseSchema.parse(body);

  const existing = await caseService.getCase(id, authCtx.orgId);
  if (!existing) {
    return c.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Case not found' } },
      404,
    );
  }

  const updated = await caseService.assignCase(
    id, authCtx.orgId, validated.assignedTo, validated.assignedOrganizationId,
  );

  await caseActivityService.logCaseAssigned(
    id, authCtx.orgId, authCtx.userId, validated.assignedTo, existing.assignedTo ?? undefined,
  );

  return c.json({ success: true, data: updated });
});

caseRoutes.post('/:id/reassign', requirePermission(PERMISSIONS.CASE_REASSIGN), async (c) => {
  const authCtx = c.get('auth');
  const { id } = c.req.param();
  const body = await c.req.json();
  const validated = reassignCaseSchema.parse(body);

  const existing = await caseService.getCase(id, authCtx.orgId);
  if (!existing) {
    return c.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Case not found' } },
      404,
    );
  }

  const updated = await caseService.reassignCase(
    id, authCtx.orgId, validated.assignedTo, validated.assignedOrganizationId,
  );

  await caseActivityService.logCaseAssigned(
    id, authCtx.orgId, authCtx.userId, validated.assignedTo, existing.assignedTo ?? undefined,
  );

  return c.json({ success: true, data: updated });
});

caseRoutes.post('/:id/escalate', requirePermission(PERMISSIONS.CASE_ESCALATE), async (c) => {
  const authCtx = c.get('auth');
  const { id } = c.req.param();

  const existing = await caseService.getCase(id, authCtx.orgId);
  if (!existing) {
    return c.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Case not found' } },
      404,
    );
  }

  const updated = await caseService.escalateCase(id, authCtx.orgId);

  await caseActivityService.logCaseEscalated(id, authCtx.orgId, authCtx.userId);

  return c.json({ success: true, data: updated });
});

caseRoutes.post('/:id/resolve', requirePermission(PERMISSIONS.CASE_UPDATE), async (c) => {
  const authCtx = c.get('auth');
  const { id } = c.req.param();
  const body = await c.req.json();
  const validated = resolveCaseSchema.parse(body);

  const existing = await caseService.getCase(id, authCtx.orgId);
  if (!existing) {
    return c.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Case not found' } },
      404,
    );
  }

  const updated = await caseService.resolveCase(
    id, authCtx.orgId, validated.resolution, validated.resolutionCode, authCtx.userId,
  );

  await caseActivityService.logCaseResolved(
    id, authCtx.orgId, authCtx.userId, validated.resolution, validated.resolutionCode,
  );

  return c.json({ success: true, data: updated });
});

caseRoutes.post('/:id/close', requirePermission(PERMISSIONS.CASE_CLOSE), async (c) => {
  const authCtx = c.get('auth');
  const { id } = c.req.param();

  const existing = await caseService.getCase(id, authCtx.orgId);
  if (!existing) {
    return c.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Case not found' } },
      404,
    );
  }

  const updated = await caseService.closeCase(id, authCtx.orgId, authCtx.userId);

  await caseActivityService.logCaseClosed(id, authCtx.orgId, authCtx.userId);

  return c.json({ success: true, data: updated });
});

caseRoutes.post('/:id/reopen', requirePermission(PERMISSIONS.CASE_REOPEN), async (c) => {
  const authCtx = c.get('auth');
  const { id } = c.req.param();

  const existing = await caseService.getCase(id, authCtx.orgId);
  if (!existing) {
    return c.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Case not found' } },
      404,
    );
  }

  const updated = await caseService.reopenCase(id, authCtx.orgId, authCtx.userId);

  await caseActivityService.logCaseReopened(id, authCtx.orgId, authCtx.userId);

  return c.json({ success: true, data: updated });
});

caseRoutes.get('/:id/timeline', requirePermission(PERMISSIONS.CASE_READ), async (c) => {
  const authCtx = c.get('auth');
  const { id } = c.req.param();

  const timeline = await caseActivityService.getTimeline(id, authCtx.orgId);
  return c.json({ success: true, data: timeline });
});

caseRoutes.post('/:id/comments', requirePermission(PERMISSIONS.CASE_UPDATE), async (c) => {
  const authCtx = c.get('auth');
  const { id } = c.req.param();
  const body = await c.req.json();
  const { content } = body as { content: string };

  if (!content || content.length === 0 || content.length > 5000) {
    return c.json(
      { success: false, error: { code: 'VALIDATION', message: 'Content must be 1-5000 characters' } },
      400,
    );
  }

  const comment = await caseActivityService.addComment(
    id, authCtx.orgId, authCtx.userId, authCtx.orgId, content,
  );

  return c.json({ success: true, data: comment }, 201);
});
