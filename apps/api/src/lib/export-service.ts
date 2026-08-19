import { eq, and, desc, gte, lte } from 'drizzle-orm';
import {
  db,
  analyticsExports,
  baggage,
  cases,
  recoveryPlans,
  baggageEvents,
  recoveryProviders,
  recoveryProviderAssignments,
} from '@airove/db';
import type { AnalyticsExport, ExportFormat } from '@airove/shared';
import { EXPORT_MAX_ROWS } from '@airove/shared';
import { resolveTimeRangeBounds } from './metric-engine';
import type { AnalyticsTimeRange } from '@airove/shared';

function mapExport(r: typeof analyticsExports.$inferSelect): AnalyticsExport {
  return {
    id: r.id,
    orgId: r.orgId,
    userId: r.userId,
    exportType: r.exportType,
    format: r.format as ExportFormat,
    filters: (r.filters ?? {}) as Record<string, unknown>,
    status: r.status,
    fileUrl: r.fileUrl,
    rowCount: r.rowCount,
    createdAt: r.createdAt,
    completedAt: r.completedAt,
  };
}

export const exportService = {
  async listExports(
    orgId: string,
    userId?: string,
  ): Promise<AnalyticsExport[]> {
    const conditions = [eq(analyticsExports.orgId, orgId)];

    if (userId) {
      conditions.push(eq(analyticsExports.userId, userId));
    }

    const rows = await db
      .select()
      .from(analyticsExports)
      .where(and(...conditions))
      .orderBy(desc(analyticsExports.createdAt))
      .limit(50);

    return rows.map(mapExport);
  },

  async getExport(
    orgId: string,
    exportId: string,
  ): Promise<AnalyticsExport | null> {
    const rows = await db
      .select()
      .from(analyticsExports)
      .where(
        and(
          eq(analyticsExports.id, exportId),
          eq(analyticsExports.orgId, orgId),
        ),
      )
      .limit(1);

    const r = rows[0];
    if (!r) return null;
    return mapExport(r);
  },

  async createExport(
    orgId: string,
    data: {
      userId: string;
      exportType: string;
      format: ExportFormat;
      filters: Record<string, unknown>;
    },
  ): Promise<AnalyticsExport> {
    const rows = await db
      .insert(analyticsExports)
      .values({
        orgId,
        userId: data.userId,
        exportType: data.exportType,
        format: data.format,
        filters: data.filters,
        status: 'pending',
      })
      .returning();

    const r = rows[0];
    if (!r) throw new Error('Failed to create export');
    return mapExport(r);
  },

  async updateExportStatus(
    orgId: string,
    exportId: string,
    data: {
      status: string;
      fileUrl?: string;
      rowCount?: number;
    },
  ): Promise<AnalyticsExport | null> {
    const updateData: Partial<typeof analyticsExports.$inferInsert> & {
      completedAt?: Date;
    } = {
      status: data.status,
    };
    if (data.fileUrl !== undefined) updateData.fileUrl = data.fileUrl;
    if (data.rowCount !== undefined) updateData.rowCount = data.rowCount;
    if (data.status === 'completed') updateData.completedAt = new Date();

    const rows = await db
      .update(analyticsExports)
      .set(updateData)
      .where(
        and(
          eq(analyticsExports.id, exportId),
          eq(analyticsExports.orgId, orgId),
        ),
      )
      .returning();

    const r = rows[0];
    if (!r) return null;
    return mapExport(r);
  },

  async deleteExport(
    orgId: string,
    exportId: string,
  ): Promise<boolean> {
    const deleted = await db
      .delete(analyticsExports)
      .where(
        and(
          eq(analyticsExports.id, exportId),
          eq(analyticsExports.orgId, orgId),
        ),
      )
      .returning({ id: analyticsExports.id });

    return deleted.length > 0;
  },

  async generateExportData(
    orgId: string,
    exportType: string,
    filters: Record<string, unknown>,
  ): Promise<{ data: Record<string, unknown>[]; rowCount: number }> {
    const maxRows = EXPORT_MAX_ROWS;
    let data: Record<string, unknown>[] = [];

    const timeRange = (filters['timeRange'] ?? 'last_30_days') as AnalyticsTimeRange;
    const customFrom = filters['customFrom'] as string | undefined;
    const customTo = filters['customTo'] as string | undefined;
    const bounds = resolveTimeRangeBounds(timeRange, customFrom, customTo);

    switch (exportType) {
      case 'baggage':
      case 'baggage_summary': {
        const conditions = [
          eq(baggage.orgId, orgId),
          gte(baggage.createdAt, bounds.from),
          lte(baggage.createdAt, bounds.to),
        ];
        if (filters['airportCode']) {
          conditions.push(eq(baggage.currentLocation, filters['airportCode'] as string));
        }
        if (filters['status']) {
          conditions.push(eq(baggage.status, filters['status'] as string));
        }
        const rows = await db
          .select()
          .from(baggage)
          .where(and(...conditions))
          .limit(maxRows);
        data = rows.map((r) => r as unknown as Record<string, unknown>);
        break;
      }
      case 'cases':
      case 'case_summary': {
        const conditions = [
          eq(cases.orgId, orgId),
          gte(cases.createdAt, bounds.from),
          lte(cases.createdAt, bounds.to),
        ];
        if (filters['caseType']) {
          conditions.push(eq(cases.caseType, filters['caseType'] as string));
        }
        if (filters['priority']) {
          conditions.push(eq(cases.priority, filters['priority'] as string));
        }
        if (filters['status']) {
          conditions.push(eq(cases.status, filters['status'] as string));
        }
        const rows = await db
          .select()
          .from(cases)
          .where(and(...conditions))
          .limit(maxRows);
        data = rows.map((r) => r as unknown as Record<string, unknown>);
        break;
      }
      case 'recovery_plans':
      case 'recovery_summary': {
        const conditions = [
          eq(recoveryPlans.orgId, orgId),
          gte(recoveryPlans.createdAt, bounds.from),
          lte(recoveryPlans.createdAt, bounds.to),
        ];
        if (filters['recoveryType']) {
          conditions.push(eq(recoveryPlans.recoveryType, filters['recoveryType'] as string));
        }
        if (filters['status']) {
          conditions.push(eq(recoveryPlans.status, filters['status'] as string));
        }
        const rows = await db
          .select()
          .from(recoveryPlans)
          .where(and(...conditions))
          .limit(maxRows);
        data = rows.map((r) => r as unknown as Record<string, unknown>);
        break;
      }
      case 'baggage_events': {
        const conditions = [
          eq(baggage.orgId, orgId),
          gte(baggage.createdAt, bounds.from),
          lte(baggage.createdAt, bounds.to),
        ];
        if (filters['eventType']) {
          conditions.push(eq(baggageEvents.eventType, filters['eventType'] as string));
        }
        const rows = await db
          .select()
          .from(baggageEvents)
          .innerJoin(baggage, eq(baggageEvents.baggageId, baggage.id))
          .where(and(...conditions))
          .limit(maxRows);
        data = rows.map((r) => r as unknown as Record<string, unknown>);
        break;
      }
      case 'providers': {
        const conditions = [
          gte(recoveryProviderAssignments.createdAt, bounds.from),
          lte(recoveryProviderAssignments.createdAt, bounds.to),
        ];
        const rows = await db
          .select()
          .from(recoveryProviderAssignments)
          .innerJoin(
            recoveryProviders,
            eq(recoveryProviderAssignments.providerId, recoveryProviders.id),
          )
          .where(and(eq(recoveryProviders.orgId, orgId), ...conditions))
          .limit(maxRows);
        data = rows.map((r) => r as unknown as Record<string, unknown>);
        break;
      }
      default:
        data = [];
    }

    return { data, rowCount: data.length };
  },

  formatExportData(
    data: Record<string, unknown>[],
    format: ExportFormat,
  ): string {
    if (format === 'json') {
      return JSON.stringify(data, null, 2);
    }

    if (format === 'csv') {
      const first = data[0];
      if (!first) return '';
      const headers = Object.keys(first);
      const lines = [headers.join(',')];

      for (const row of data) {
        const values = headers.map((h) => {
          const val = row[h];
          if (val === null || val === undefined) return '';
          const str = String(val);
          if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
            return `"${str.replace(/"/g, '""')}"`;
          }
          return str;
        });
        lines.push(values.join(','));
      }

      return lines.join('\n');
    }

    return '';
  },
};
