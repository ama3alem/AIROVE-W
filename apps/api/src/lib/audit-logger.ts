import { db, auditLogs } from '@airove/db';

interface AuditLogParams {
  orgId: string;
  userId?: string;
  action: string;
  entityType: string;
  entityId?: string;
  entityRef?: string;
  changes?: string;
  ipAddress?: string;
  userAgent?: string;
}

export async function auditLog(params: AuditLogParams): Promise<void> {
  try {
    await db.insert(auditLogs).values({
      orgId: params.orgId,
      userId: params.userId ?? null,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId ?? null,
      entityRef: params.entityRef ?? null,
      changes: params.changes ?? null,
      ipAddress: params.ipAddress ?? null,
      userAgent: params.userAgent ?? null,
    });
  } catch (err) {
    console.error('[AUDIT] Failed to write audit log:', err);
  }
}
