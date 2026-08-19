import { db, recoveryRouteOptions, recoveryRouteSegments, recoveryPlans, flights } from '@airove/db';
import { eq, and, sql, asc } from 'drizzle-orm';
import pino from 'pino';
import { GRAPH_TRAVERSAL_LIMITS, ROUTE_SEGMENT_MODES } from '@airove/shared';
import { auditLog } from './audit-logger.js';
import type { RecoveryRouteSegment, RecoveryRouteOption, RecoveryRiskLevel } from '@airove/shared';

const logger = pino({ name: 'layer6-routing-engine' });

interface CandidateRouteSegment {
  origin: string;
  destination: string;
  mode: (typeof ROUTE_SEGMENT_MODES)[number];
  carrier?: string;
  flightNumber?: string;
  durationMinutes?: number;
}

export interface RouteOptionInput {
  optionLabel: string;
  segments: CandidateRouteSegment[];
}

export interface SLAComplianceResult {
  compliant: boolean;
  marginMinutes: number;
}

export class RoutingEngine {
  async generateRouteOptions(
    planId: string,
    orgId: string,
    planData: {
      origin: string;
      destination: string;
      currentLocation?: string;
      slaRemainingMinutes?: number;
    },
  ): Promise<(RecoveryRouteOption & { segments: RecoveryRouteSegment[] })[]> {
    if (!planData.origin || !planData.destination) {
      throw new Error('Origin and destination are required');
    }

    const candidates = await this.buildCandidateRoutes(
      planData.origin,
      planData.destination,
      planData.currentLocation,
    );

    if (candidates.length === 0) {
      logger.warn({ planId }, 'No candidate routes generated');
      return [];
    }

    const evaluated = await Promise.all(
      candidates.map(async (candidate) => {
        const eta = this.estimateETA(candidate.segments);
        const cost = this.estimateCost(candidate.segments);
        const slaCheck = this.checkSLACompliance(
          eta,
          planData.slaRemainingMinutes,
        );
        const riskLevel = this.detectRiskLevel(
          candidate.segments,
          slaCheck.marginMinutes,
        );

        return {
          optionLabel: candidate.optionLabel,
          segments: candidate.segments,
          eta,
          cost,
          slaCheck,
          riskLevel,
        };
      }),
    );

    const sorted = evaluated.sort((a, b) => {
      const scoreA = this.computeCompositeScore(a.slaCheck, a.eta, a.riskLevel, a.cost);
      const scoreB = this.computeCompositeScore(b.slaCheck, b.eta, b.riskLevel, b.cost);
      return scoreB - scoreA;
    });

    const persisted: (RecoveryRouteOption & { segments: RecoveryRouteSegment[] })[] = [];

    for (const option of sorted) {
      const score = this.computeCompositeScore(
        option.slaCheck,
        option.eta,
        option.riskLevel,
        option.cost,
      );

      const savedOption = await this.persistRouteOption(
        planId,
        orgId,
        option.optionLabel,
        option.segments,
        score,
        option.riskLevel,
        option.slaCheck.compliant,
        option.slaCheck.marginMinutes,
        option.eta,
        option.cost,
      );

      const savedSegments = await db
        .select()
        .from(recoveryRouteSegments)
        .where(eq(recoveryRouteSegments.routeOptionId, savedOption.id))
        .orderBy(asc(recoveryRouteSegments.segmentOrder));

      persisted.push({ ...savedOption, segments: savedSegments as RecoveryRouteSegment[] });
    }

    logger.info(
      { planId, optionCount: persisted.length },
      'Route options generated',
    );

    return persisted;
  }

  async buildCandidateRoutes(
    origin: string,
    destination: string,
    currentLocation?: string,
  ): Promise<RouteOptionInput[]> {
    const candidates: RouteOptionInput[] = [];
    const start = currentLocation ?? origin;

    const directRoute = await this.buildDirectRoute(start, destination);
    if (directRoute) {
      candidates.push(directRoute);
    }

    const hubRoutes = await this.buildHubRoutes(start, destination);
    candidates.push(...hubRoutes);

    const twoStopRoutes = await this.buildTwoStopRoutes(start, destination);
    candidates.push(...twoStopRoutes);

    if (candidates.length > GRAPH_TRAVERSAL_LIMITS.maxCandidateRoutes) {
      return candidates.slice(0, GRAPH_TRAVERSAL_LIMITS.maxCandidateRoutes);
    }

    return candidates;
  }

  private async buildDirectRoute(
    origin: string,
    destination: string,
  ): Promise<RouteOptionInput | null> {
    const matchingFlights = await db
      .select()
      .from(flights)
      .where(
        and(
          sql`${flights.departureAirportId}::text = ${origin}`,
          sql`${flights.arrivalAirportId}::text = ${destination}`,
          eq(flights.status, 'scheduled'),
        ),
      )
      .limit(1);

    const flight = matchingFlights[0];

    const durationMinutes = flight?.scheduledArrival && flight?.scheduledDeparture
      ? Math.round(
          (new Date(flight.scheduledArrival).getTime() -
            new Date(flight.scheduledDeparture).getTime()) /
            60_000,
        )
      : undefined;

    return {
      optionLabel: 'Direct',
      segments: [
        {
          origin,
          destination,
          mode: 'flight',
          carrier: undefined,
          flightNumber: flight?.flightNumber,
          durationMinutes,
        },
      ],
    };
  }

  private async buildHubRoutes(
    origin: string,
    destination: string,
  ): Promise<RouteOptionInput[]> {
    const routes: RouteOptionInput[] = [];
    const hubs = await this.discoverHubs(origin, destination);

    for (const hub of hubs.slice(0, 3)) {
      const leg1 = await this.findFlightSegment(origin, hub);
      const leg2 = await this.findFlightSegment(hub, destination);

      routes.push({
        optionLabel: `1-Stop (${hub})`,
        segments: [
          {
            origin,
            destination: hub,
            mode: 'flight',
            carrier: leg1?.carrier,
            flightNumber: leg1?.flightNumber,
            durationMinutes: leg1?.durationMinutes,
          },
          {
            origin: hub,
            destination,
            mode: 'flight',
            carrier: leg2?.carrier,
            flightNumber: leg2?.flightNumber,
            durationMinutes: leg2?.durationMinutes,
          },
        ],
      });
    }

    return routes;
  }

  private async buildTwoStopRoutes(
    origin: string,
    destination: string,
  ): Promise<RouteOptionInput[]> {
    const routes: RouteOptionInput[] = [];
    const hubs = await this.discoverHubs(origin, destination);

    for (let i = 0; i < Math.min(hubs.length, 2); i++) {
      for (let j = 0; j < Math.min(hubs.length, 2); j++) {
        const hubA = hubs[i];
        const hubB = hubs[j];
        if (!hubA || !hubB || hubA === hubB) continue;

        const leg1 = await this.findFlightSegment(origin, hubA);
        const leg2 = await this.findFlightSegment(hubA, hubB);
        const leg3 = await this.findFlightSegment(hubB, destination);

        routes.push({
          optionLabel: `2-Stop (${hubA}, ${hubB})`,
          segments: [
            {
              origin,
              destination: hubA,
              mode: 'flight',
              carrier: leg1?.carrier,
              flightNumber: leg1?.flightNumber,
              durationMinutes: leg1?.durationMinutes,
            },
            {
              origin: hubA,
              destination: hubB,
              mode: 'flight',
              carrier: leg2?.carrier,
              flightNumber: leg2?.flightNumber,
              durationMinutes: leg2?.durationMinutes,
            },
            {
              origin: hubB,
              destination,
              mode: 'flight',
              carrier: leg3?.carrier,
              flightNumber: leg3?.flightNumber,
              durationMinutes: leg3?.durationMinutes,
            },
          ],
        });
      }
    }

    return routes;
  }

  private async discoverHubs(
    origin: string,
    destination: string,
  ): Promise<string[]> {
    const rows = await db.execute<{ hub: string }>(
      sql`
        SELECT DISTINCT departure_airport_id::text AS hub
        FROM flights
        WHERE status = 'scheduled'
          AND departure_airport_id::text != ${origin}
          AND arrival_airport_id::text = ${destination}
        UNION
        SELECT DISTINCT arrival_airport_id::text AS hub
        FROM flights
        WHERE status = 'scheduled'
          AND departure_airport_id::text = ${origin}
          AND arrival_airport_id::text != ${destination}
        LIMIT 6
      `,
    );

    return rows.map((r) => r.hub);
  }

  private async findFlightSegment(
    origin: string,
    destination: string,
  ): Promise<{
    carrier: string | undefined;
    flightNumber: string;
    durationMinutes: number;
  } | null> {
    const rows = await db
      .select()
      .from(flights)
      .where(
        and(
          sql`${flights.departureAirportId}::text = ${origin}`,
          sql`${flights.arrivalAirportId}::text = ${destination}`,
          eq(flights.status, 'scheduled'),
        ),
      )
      .limit(1);

    const flight = rows[0];
    if (!flight) return null;

    const durationMinutes = Math.round(
      (new Date(flight.scheduledArrival!).getTime() -
        new Date(flight.scheduledDeparture!).getTime()) /
        60_000,
    );

    return {
      carrier: undefined,
      flightNumber: flight.flightNumber,
      durationMinutes,
    };
  }

  async persistRouteOption(
    planId: string,
    orgId: string,
    optionLabel: string,
    segments: CandidateRouteSegment[],
    score: number,
    riskLevel: RecoveryRiskLevel,
    slaCompliant: boolean,
    slaMarginMinutes: number,
    etaMinutes: number,
    estimatedCost: number,
  ): Promise<RecoveryRouteOption> {
    const result = await db
      .insert(recoveryRouteOptions)
      .values({
        orgId,
        recoveryPlanId: planId,
        optionLabel,
        segmentCount: segments.length,
        riskLevel,
        slaCompliant,
        slaMarginMinutes,
        estimatedCost: String(estimatedCost),
        score: String(score),
        totalEtaMinutes: etaMinutes,
      })
      .returning();

    const option = result[0];
    if (!option) {
      throw new Error('Failed to persist route option');
    }

    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i]!;
      await db.insert(recoveryRouteSegments).values({
        orgId,
        routeOptionId: option.id,
        segmentOrder: i + 1,
        origin: seg.origin,
        destination: seg.destination,
        mode: seg.mode,
        carrier: seg.carrier ?? null,
        flightNumber: seg.flightNumber ?? null,
        durationMinutes: seg.durationMinutes ?? null,
        status: 'planned',
      });
    }

    await auditLog({
      orgId,
      action: 'route_option.create',
      entityType: 'recovery_route_option',
      entityId: option.id,
      entityRef: `${planId}:${optionLabel}`,
      changes: JSON.stringify({ score, riskLevel, slaCompliant, segmentCount: segments.length }),
    });

    return option as RecoveryRouteOption;
  }

  detectRiskLevel(
    segments: CandidateRouteSegment[],
    slaMarginMinutes: number,
  ): RecoveryRiskLevel {
    const segmentCount = segments.length;

    if (slaMarginMinutes < 0 || segmentCount >= 3) {
      return 'critical';
    }

    if (slaMarginMinutes < 60 || segmentCount >= 2) {
      return 'high';
    }

    if (slaMarginMinutes < 180) {
      return 'medium';
    }

    return 'low';
  }

  estimateETA(segments: CandidateRouteSegment[]): number {
    const CONNECTION_BUFFER_MINUTES = 60;

    return segments.reduce((total, segment, index) => {
      const duration = segment.durationMinutes ?? 0;
      const connection = index > 0 ? CONNECTION_BUFFER_MINUTES : 0;
      return total + duration + connection;
    }, 0);
  }

  estimateCost(segments: CandidateRouteSegment[]): number {
    return segments.reduce((total, segment) => {
      return total + 0;
    }, 0);
  }

  checkSLACompliance(
    etaMinutes: number,
    slaRemainingMinutes?: number,
  ): SLAComplianceResult {
    if (slaRemainingMinutes === undefined || slaRemainingMinutes === null) {
      return { compliant: true, marginMinutes: Infinity };
    }

    const marginMinutes = slaRemainingMinutes - etaMinutes;
    return {
      compliant: marginMinutes >= 0,
      marginMinutes,
    };
  }

  private computeCompositeScore(
    slaCheck: SLAComplianceResult,
    etaMinutes: number,
    riskLevel: RecoveryRiskLevel,
    _cost: number,
  ): number {
    const slaScore = slaCheck.compliant ? 1.0 : Math.max(0, 1 + slaCheck.marginMinutes / 360);

    const etaScore = Math.max(0, 1 - etaMinutes / 1440);

    const riskMap: Record<RecoveryRiskLevel, number> = {
      low: 1.0,
      medium: 0.7,
      high: 0.3,
      critical: 0.0,
    };
    const riskScore = riskMap[riskLevel];

    const connectionScore = 0.8;
    const costScore = 0.5;
    const handlingScore = 0.8;

    return (
      slaScore * 0.35 +
      etaScore * 0.25 +
      riskScore * 0.15 +
      connectionScore * 0.10 +
      costScore * 0.10 +
      handlingScore * 0.05
    );
  }
}

export const routingEngine = new RoutingEngine();
