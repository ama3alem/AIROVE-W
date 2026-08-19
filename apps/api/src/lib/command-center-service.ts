import { eq, and, sql, gte } from 'drizzle-orm';
import {
  db,
  baggage,
  cases,
  recoveryPlans,
  analyticsAlerts,
  caseSla,
} from '@airove/db';
import type {
  CommandCenterOverview,
  AirportHealthSummary,
} from '@airove/shared';

export const commandCenterService = {
  async getOverview(
    orgId: string,
    airportCode?: string,
  ): Promise<CommandCenterOverview> {
    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const baggageConditions = [eq(baggage.orgId, orgId)];
    const caseConditions = [eq(cases.orgId, orgId)];
    const recoveryConditions = [eq(recoveryPlans.orgId, orgId)];
    const alertConditions = [
      eq(analyticsAlerts.orgId, orgId),
      eq(analyticsAlerts.status, 'active'),
    ];

    if (airportCode) {
      baggageConditions.push(eq(baggage.currentLocation, airportCode));
    }

    const activeBaggage = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(baggage)
      .where(and(...baggageConditions, eq(baggage.status, 'in_transit')));

    const openCases = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(cases)
      .where(and(...caseConditions, eq(cases.status, 'open')));

    const criticalCases = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(cases)
      .where(
        and(
          ...caseConditions,
          eq(cases.status, 'open'),
          sql`${cases.priority} in ('critical', 'high')`,
        ),
      );

    const activeRecoveryPlans = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(recoveryPlans)
      .where(
        and(
          ...recoveryConditions,
          sql`${recoveryPlans.status} in ('in_progress', 'scheduled')`,
        ),
      );

    const slaComplianceResult = await db
      .select({
        compliant: sql<number>`count(case when ${caseSla.status} = 'compliant' then 1 end)::int`,
        total: sql<number>`count(*)::int`,
      })
      .from(caseSla)
      .innerJoin(cases, eq(caseSla.caseId, cases.id))
      .where(
        and(
          eq(cases.orgId, orgId),
          gte(caseSla.createdAt, last24h),
        ),
      );

    const transferFailures = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(cases)
      .where(
        and(
          eq(cases.orgId, orgId),
          eq(cases.caseType, 'transfer_failure'),
          gte(cases.createdAt, last24h),
        ),
      );

    const activeAlerts = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(analyticsAlerts)
      .where(and(...alertConditions));

    const slaResult = slaComplianceResult[0];
    const slaCompliance =
      slaResult && slaResult.total > 0
        ? Math.round((slaResult.compliant / slaResult.total) * 10000) / 100
        : 100;

    return {
      activeBaggage: activeBaggage[0]?.count ?? 0,
      openCases: openCases[0]?.count ?? 0,
      atRiskBaggage: 0,
      criticalCases: criticalCases[0]?.count ?? 0,
      activeRecoveryPlans: activeRecoveryPlans[0]?.count ?? 0,
      slaCompliance,
      transferFailures: transferFailures[0]?.count ?? 0,
      activeAlerts: activeAlerts[0]?.count ?? 0,
      airportHealth: [],
    };
  },

  async getAirportHealth(
    orgId: string,
  ): Promise<AirportHealthSummary[]> {
    const airportRows = await db
      .select({
        location: baggage.currentLocation,
        count: sql<number>`count(*)::int`,
      })
      .from(baggage)
      .where(
        and(
          eq(baggage.orgId, orgId),
          sql`${baggage.currentLocation} is not null`,
        ),
      )
      .groupBy(baggage.currentLocation);

    const healthSummaries: AirportHealthSummary[] = [];

    for (const row of airportRows) {
      if (!row.location) continue;

      const conditions = [
        eq(baggage.orgId, orgId),
        eq(baggage.currentLocation, row.location),
      ];

      const totalBaggage = row.count;

      const inTransit = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(baggage)
        .where(and(...conditions, eq(baggage.status, 'in_transit')));

      const transferFailures = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(cases)
        .where(
          and(
            eq(cases.orgId, orgId),
            eq(cases.caseType, 'transfer_failure'),
          ),
        );

      const failureCount = transferFailures[0]?.count ?? 0;

      const transferPerformance =
        totalBaggage > 0
          ? Math.round(((totalBaggage - failureCount) / totalBaggage) * 100)
          : 100;

      const overallHealth = Math.round(
        transferPerformance * 0.4 +
          100 * 0.3 +
          (totalBaggage > 0 ? 95 : 100) * 0.3,
      );

      healthSummaries.push({
        airportCode: row.location,
        airportName: row.location,
        overallHealth: Math.min(100, Math.max(0, overallHealth)),
        transferPerformance: Math.min(100, Math.max(0, transferPerformance)),
        slaCompliance: 100,
        recoveryPerformance: 95,
        providerPerformance: 90,
        systemReliability: 98,
      });
    }

    return healthSummaries.sort((a, b) => b.overallHealth - a.overallHealth);
  },
};
