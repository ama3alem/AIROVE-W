import { DEFAULT_EVENT_TYPE_MAP, CANONICAL_EVENT_TYPES } from '@airove/shared';
import type { NormalizedEvent, EventProvenance, IntegrationMapping, MappingField } from '@airove/shared';
import { logger } from './logger.js';

export interface RawInboundEvent {
  integrationId: string;
  orgId: string;
  integrationName: string;
  provider?: string;
  externalEventId: string;
  eventType: string;
  timestamp: string;
  payload: Record<string, unknown>;
  headers?: Record<string, string>;
  correlationId?: string;
}

export class NormalizationEngine {
  resolveEventType(
    externalType: string,
    mapping?: IntegrationMapping,
  ): string {
    if (mapping?.eventTypeMap?.[externalType]) {
      return mapping.eventTypeMap[externalType];
    }

    const normalized = DEFAULT_EVENT_TYPE_MAP[externalType.toUpperCase()];
    if (normalized) return normalized;

    const canonicalMatch = CANONICAL_EVENT_TYPES.find(
      (ct) => ct === externalType.toLowerCase(),
    );
    if (canonicalMatch) return canonicalMatch;

    logger.warn({ externalType }, 'Unknown event type, using raw value');
    return externalType.toLowerCase();
  }

  resolveEntityId(
    payload: Record<string, unknown>,
    entityType: string,
  ): string | undefined {
    const candidates: Record<string, string[]> = {
      baggage: ['bag', 'baggage_id', 'tag_number', 'tag', 'baggageId', 'bagNumber', 'bagTag'],
      flight: ['flight', 'flight_id', 'flight_number', 'flightId', 'flightNumber', 'flightNo'],
      airport: ['airport', 'airport_code', 'airportId', 'station', 'location'],
      airline: ['airline', 'airline_id', 'airline_code', 'airlineId', 'carrier'],
    };

    const fields = candidates[entityType] ?? [];

    for (const field of fields) {
      const value = payload[field];
      if (value !== undefined && value !== null && String(value).length > 0) {
        return String(value);
      }
    }

    return undefined;
  }

  resolveLocation(
    payload: Record<string, unknown>,
    fieldMappings?: Record<string, MappingField[]>,
  ): { airportCode?: string; terminal?: string; handler?: string; location?: string } {
    const get = (key: string): string | undefined => {
      const val = payload[key];
      if (val !== undefined && val !== null) return String(val);
      return undefined;
    };

    return {
      airportCode: get('airport') ?? get('station') ?? get('airportCode') ?? get('location_code'),
      terminal: get('terminal') ?? get('term'),
      handler: get('handler') ?? get('handled_by') ?? get('operator'),
      location: get('location') ?? get('station') ?? get('point'),
    };
  }

  applyFieldMappings(
    payload: Record<string, unknown>,
    fieldMappings: MappingField[],
  ): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    for (const mapping of fieldMappings) {
      const sourceValue = this.getNestedField(payload, mapping.source);

      if (sourceValue === undefined || sourceValue === null) {
        if (mapping.required) {
          throw new Error(`Required field '${mapping.source}' is missing`);
        }
        if (mapping.defaultValue !== undefined) {
          result[mapping.target] = mapping.defaultValue;
        }
        continue;
      }

      let transformed: unknown = sourceValue;

      if (mapping.transform) {
        transformed = this.transformValue(sourceValue, mapping.transform);
      }

      if (mapping.enumMapping && typeof transformed === 'string') {
        transformed = mapping.enumMapping[transformed] ?? transformed;
      }

      result[mapping.target] = transformed;
    }

    return result;
  }

  normalize(
    raw: RawInboundEvent,
    mapping?: IntegrationMapping,
  ): NormalizedEvent {
    const eventType = this.resolveEventType(raw.eventType, mapping);
    const location = this.resolveLocation(raw.payload);

    const baggageId = this.resolveEntityId(raw.payload, 'baggage');
    const flightId = this.resolveEntityId(raw.payload, 'flight');

    const provenance: EventProvenance = {
      integrationId: raw.integrationId,
      integrationName: raw.integrationName,
      provider: raw.provider,
      externalEventId: raw.externalEventId,
      mappingVersion: mapping?.version ?? '1.0',
      receivedAt: new Date().toISOString(),
      correlationId: raw.correlationId,
    };

    return {
      eventId: `norm_${raw.integrationId}_${raw.externalEventId}`,
      eventType,
      occurredAt: raw.timestamp,
      receivedAt: provenance.receivedAt,
      source: raw.integrationName,
      integrationId: raw.integrationId,
      organizationId: raw.orgId,
      externalEventId: raw.externalEventId,
      externalEntityId: baggageId ?? flightId,
      baggageId,
      flightId,
      location: location.location,
      airportCode: location.airportCode,
      terminal: location.terminal,
      handler: location.handler,
      payload: raw.payload,
      metadata: {
        provider: raw.provider,
        correlationId: raw.correlationId,
        receivedHeaders: raw.headers ? Object.keys(raw.headers) : [],
      },
      provenance,
    };
  }

  private getNestedField(obj: Record<string, unknown>, path: string): unknown {
    const parts = path.split('.');
    let current: unknown = obj;

    for (const part of parts) {
      if (current === null || current === undefined || typeof current !== 'object') {
        return undefined;
      }
      current = (current as Record<string, unknown>)[part];
    }

    return current;
  }

  private transformValue(value: unknown, transform: string): unknown {
    switch (transform) {
      case 'string':
        return String(value);
      case 'number':
        const num = Number(value);
        if (isNaN(num)) throw new Error(`Cannot transform '${value}' to number`);
        return num;
      case 'date':
        const date = new Date(String(value));
        if (isNaN(date.getTime())) throw new Error(`Cannot transform '${value}' to date`);
        return date.toISOString();
      default:
        return value;
    }
  }
}

export const normalizationEngine = new NormalizationEngine();
