import { eq, and, sql, desc } from 'drizzle-orm';
import { db, analyticsSavedViews } from '@airove/db';
import type { AnalyticsSavedView } from '@airove/shared';

function mapSavedView(r: typeof analyticsSavedViews.$inferSelect): AnalyticsSavedView {
  return {
    id: r.id,
    orgId: r.orgId,
    userId: r.userId,
    viewName: r.viewName,
    description: r.description,
    filters: (r.filters ?? {}) as Record<string, unknown>,
    isDefault: r.isDefault,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

export const savedViewsService = {
  async listSavedViews(
    orgId: string,
    userId?: string,
  ): Promise<AnalyticsSavedView[]> {
    const conditions = [eq(analyticsSavedViews.orgId, orgId)];

    if (userId) {
      conditions.push(eq(analyticsSavedViews.userId, userId));
    }

    const rows = await db
      .select()
      .from(analyticsSavedViews)
      .where(and(...conditions))
      .orderBy(desc(analyticsSavedViews.isDefault), desc(analyticsSavedViews.updatedAt));

    return rows.map(mapSavedView);
  },

  async getSavedView(
    orgId: string,
    viewId: string,
  ): Promise<AnalyticsSavedView | null> {
    const rows = await db
      .select()
      .from(analyticsSavedViews)
      .where(
        and(
          eq(analyticsSavedViews.id, viewId),
          eq(analyticsSavedViews.orgId, orgId),
        ),
      )
      .limit(1);

    if (rows.length === 0) return null;
    const r = rows[0];
    if (!r) return null;
    return mapSavedView(r);
  },

  async createSavedView(
    orgId: string,
    data: {
      userId: string;
      viewName: string;
      description?: string;
      filters: Record<string, unknown>;
      isDefault?: boolean;
    },
  ): Promise<AnalyticsSavedView> {
    if (data.isDefault) {
      await db
        .update(analyticsSavedViews)
        .set({ isDefault: false, updatedAt: new Date() })
        .where(
          and(
            eq(analyticsSavedViews.orgId, orgId),
            eq(analyticsSavedViews.userId, data.userId),
            eq(analyticsSavedViews.isDefault, true),
          ),
        );
    }

    const rows = await db
      .insert(analyticsSavedViews)
      .values({
        orgId,
        userId: data.userId,
        viewName: data.viewName,
        description: data.description,
        filters: data.filters,
        isDefault: data.isDefault ?? false,
      })
      .returning();

    const r = rows[0];
    if (!r) throw new Error('Failed to create saved view');
    return mapSavedView(r);
  },

  async updateSavedView(
    orgId: string,
    viewId: string,
    data: {
      viewName?: string;
      description?: string;
      filters?: Record<string, unknown>;
      isDefault?: boolean;
    },
  ): Promise<AnalyticsSavedView | null> {
    const existing = await this.getSavedView(orgId, viewId);
    if (!existing) return null;

    if (data.isDefault) {
      await db
        .update(analyticsSavedViews)
        .set({ isDefault: false, updatedAt: new Date() })
        .where(
          and(
            eq(analyticsSavedViews.orgId, orgId),
            eq(analyticsSavedViews.userId, existing.userId),
            eq(analyticsSavedViews.isDefault, true),
            sql`${analyticsSavedViews.id} != ${viewId}`,
          ),
        );
    }

    const updateData: Partial<typeof analyticsSavedViews.$inferInsert> = {
      updatedAt: new Date(),
    };
    if (data.viewName !== undefined) updateData['viewName'] = data.viewName;
    if (data.description !== undefined) updateData['description'] = data.description;
    if (data.filters !== undefined) updateData['filters'] = data.filters;
    if (data.isDefault !== undefined) updateData['isDefault'] = data.isDefault;

    const rows = await db
      .update(analyticsSavedViews)
      .set(updateData)
      .where(
        and(
          eq(analyticsSavedViews.id, viewId),
          eq(analyticsSavedViews.orgId, orgId),
        ),
      )
      .returning();

    if (rows.length === 0) return null;
    const r = rows[0];
    if (!r) return null;
    return mapSavedView(r);
  },

  async deleteSavedView(
    orgId: string,
    viewId: string,
  ): Promise<boolean> {
    const deleted = await db
      .delete(analyticsSavedViews)
      .where(
        and(
          eq(analyticsSavedViews.id, viewId),
          eq(analyticsSavedViews.orgId, orgId),
        ),
      )
      .returning({ id: analyticsSavedViews.id });

    return deleted.length > 0;
  },
};
