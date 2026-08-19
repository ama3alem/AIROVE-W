import pino from 'pino';
import { ROUTE_SCORING_WEIGHTS } from '@airove/shared';
import type { RouteScoringResult, RecoveryRiskLevel } from '@airove/shared';

const logger = pino({ name: 'layer6-route-scoring' });

export class RouteScoring {
  scoreRoute(
    routeOption: {
      totalEtaMinutes: number | null;
      riskLevel: string;
      segmentCount: number;
      estimatedCost: number | null;
    },
    slaRemainingMinutes: number | null,
    constraints: { severity: string }[] = [],
  ): RouteScoringResult {
    const sla = this.evaluateSLACompliance(slaRemainingMinutes, routeOption.totalEtaMinutes);
    const eta = this.evaluateETA(routeOption.totalEtaMinutes, slaRemainingMinutes);
    const risk = this.evaluateRisk(routeOption.riskLevel);
    const conn = this.evaluateConnections(routeOption.segmentCount);
    const cost = this.evaluateCost(routeOption.estimatedCost);
    const handling = this.evaluateHandling(routeOption.segmentCount);

    const breakdown = {
      slaCompliance: sla.score,
      eta: eta.score,
      operationalRisk: risk.score,
      connectionQuality: conn.score,
      cost: cost.score,
      handlingCapability: handling.score,
    };

    const totalScore =
      sla.score * ROUTE_SCORING_WEIGHTS.slaCompliance +
      eta.score * ROUTE_SCORING_WEIGHTS.eta +
      risk.score * ROUTE_SCORING_WEIGHTS.operationalRisk +
      conn.score * ROUTE_SCORING_WEIGHTS.connectionQuality +
      cost.score * ROUTE_SCORING_WEIGHTS.cost +
      handling.score * ROUTE_SCORING_WEIGHTS.handlingCapability;

    const reasons = this.generateReasons(breakdown, sla.compliant, routeOption.riskLevel, routeOption.segmentCount);

    const score = Math.round(totalScore * 100) / 100;

    logger.debug({ score, breakdown }, 'Route scored');

    return { score, breakdown, reasons };
  }

  evaluateSLACompliance(slaRemainingMinutes: number | null, etaMinutes: number | null) {
    if (slaRemainingMinutes === null || etaMinutes === null) {
      return { score: 0.5, compliant: true, marginMinutes: null };
    }
    const marginMinutes = slaRemainingMinutes - etaMinutes;
    const compliant = marginMinutes >= 0;

    if (!compliant) {
      const deficit = Math.abs(marginMinutes);
      const score = Math.max(0, 0.2 - (deficit / slaRemainingMinutes) * 0.2);
      return { score, compliant: false, marginMinutes };
    }

    const ratio = marginMinutes / slaRemainingMinutes;
    const score = 0.7 + ratio * 0.3;
    return { score: Math.min(1.0, score), compliant: true, marginMinutes };
  }

  evaluateETA(etaMinutes: number | null, slaRemainingMinutes: number | null) {
    if (etaMinutes === null) return { score: 0.5 };
    if (slaRemainingMinutes === null) {
      if (etaMinutes <= 240) return { score: 1.0 };
      if (etaMinutes <= 480) return { score: 0.8 };
      if (etaMinutes <= 720) return { score: 0.6 };
      return { score: 0.4 };
    }

    const ratio = etaMinutes / slaRemainingMinutes;
    if (ratio <= 0.5) return { score: 1.0 };
    if (ratio <= 0.7) return { score: 0.9 };
    if (ratio <= 0.85) return { score: 0.8 };
    if (ratio <= 1.0) return { score: 0.6 };
    return { score: 0.2 };
  }

  evaluateRisk(riskLevel: string) {
    switch (riskLevel) {
      case 'low': return { score: 1.0 };
      case 'medium': return { score: 0.7 };
      case 'high': return { score: 0.4 };
      case 'critical': return { score: 0.1 };
      default: return { score: 0.5 };
    }
  }

  evaluateConnections(segmentCount: number) {
    if (segmentCount <= 1) return { score: 1.0 };
    if (segmentCount === 2) return { score: 0.8 };
    if (segmentCount === 3) return { score: 0.6 };
    return { score: 0.3 };
  }

  evaluateCost(estimatedCost: number | null) {
    if (estimatedCost === null) return { score: 0.5 };
    if (estimatedCost <= 500) return { score: 1.0 };
    if (estimatedCost <= 1500) return { score: 0.8 };
    if (estimatedCost <= 3000) return { score: 0.6 };
    if (estimatedCost <= 5000) return { score: 0.4 };
    return { score: 0.2 };
  }

  evaluateHandling(segmentCount: number) {
    if (segmentCount <= 1) return { score: 1.0 };
    if (segmentCount === 2) return { score: 0.8 };
    return { score: 0.5 };
  }

  generateReasons(
    breakdown: RouteScoringResult['breakdown'],
    slaCompliant: boolean,
    riskLevel: string,
    segmentCount: number,
  ): string[] {
    const reasons: string[] = [];

    if (slaCompliant) reasons.push('+ SLA compliant');
    else reasons.push('- SLA non-compliant');

    if (segmentCount <= 1) reasons.push('+ direct route');
    else reasons.push(`- ${segmentCount} segments required`);

    if (riskLevel === 'low') reasons.push('+ low operational risk');
    else if (riskLevel === 'high') reasons.push('- high operational risk');
    else if (riskLevel === 'critical') reasons.push('- critical operational risk');

    if (breakdown.cost >= 0.8) reasons.push('+ cost-effective');
    else if (breakdown.cost <= 0.4) reasons.push('- higher cost');

    if (breakdown.connectionQuality >= 0.8) reasons.push('+ good connection quality');

    return reasons;
  }
}

export const routeScoring = new RouteScoring();
