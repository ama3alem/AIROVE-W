import { api, type PaginatedData, type PaginationParams } from './client';

export interface Baggage {
  id: string;
  orgId: string;
  tagNumber: string;
  journeyId: string | null;
  flightId: string | null;
  passengerName: string | null;
  passengerReference: string | null;
  originAirportId: string | null;
  destinationAirportId: string | null;
  currentLocation: string | null;
  currentState: string;
  currentCustodian: string | null;
  currentCustodianType: string | null;
  lastEventId: string | null;
  expectedNextEvent: string | null;
  weight: number | null;
  dimensions: string | null;
  bagType: string | null;
  priority: string;
  status: string;
  metadata: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface BaggageDetailView {
  baggage: {
    id: string;
    tagNumber: string;
    passengerName: string | null;
    passengerReference: string | null;
    originAirportId: string | null;
    destinationAirportId: string | null;
    weight: number | null;
    dimensions: string | null;
    bagType: string | null;
    priority: string;
    status: string;
  };
  journey: {
    id: string;
    originAirportId: string | null;
    destinationAirportId: string | null;
    status: string;
    flightSegments: Array<{
      flightId: string;
      flightNumber: string;
      departureAirportId: string | null;
      arrivalAirportId: string | null;
      scheduledDeparture: Date | null;
      scheduledArrival: Date | null;
      status: string;
    }>;
  } | null;
  state: {
    baggageId: string;
    currentState: string;
    currentLocation: string | null;
    currentAirportCode: string | null;
    currentCustodian: string | null;
    currentCustodianType: string | null;
    lastEvent: unknown;
    lastEventAt: Date | null;
    expectedNextEvent: string | null;
    sequenceNumber: number;
    eventCount: number;
  };
  custody: {
    currentCustody: unknown;
    custodyHistory: unknown[];
  } | null;
  lastEvent: unknown | null;
  expectedNextEvent: unknown | null;
  recentExceptions: unknown[];
  eventCount: number;
}

export interface BaggageTimelineEntry {
  eventId: string;
  eventType: string;
  eventSource: string;
  occurredAt: Date;
  recordedAt: Date;
  location: string | null;
  airportCode: string | null;
  terminal: string | null;
  handler: string | null;
  actorType: string | null;
  actorId: string | null;
  status: string;
  isCorrection: boolean;
  correctionOf: string | null;
  metadata: Record<string, unknown> | null;
}

export const baggageApi = {
  list(params?: PaginationParams & { status?: string; priority?: string }) {
    return api.get<PaginatedData<Baggage>>('/baggage', params as Record<string, string | number | undefined>);
  },

  get(id: string) {
    return api.get<Baggage>(`/baggage/${id}`);
  },

  getByTag(tagNumber: string) {
    return api.get<Baggage>(`/baggage/tag/${tagNumber}`);
  },

  getDetail(id: string) {
    return api.get<BaggageDetailView>(`/baggage/${id}/detail`);
  },

  getTimeline(id: string) {
    return api.get<{ baggageId: string; timeline: BaggageTimelineEntry[] }>(`/baggage/${id}/timeline`);
  },

  getState(id: string) {
    return api.get<{ baggageId: string; currentState: string; location: string | null; airportCode: string | null; custodian: string | null; custodianType: string | null; lastEvent: unknown; lastEventAt: Date | null; expectedNextEvent: string | null; sequenceNumber: number; eventCount: number }>(`/baggage/${id}/state`);
  },

  getCustody(id: string) {
    return api.get<{ baggageId: string; currentCustody: unknown; custodyHistory: unknown[] }>(`/baggage/${id}/custody`);
  },

  getJourney(id: string) {
    return api.get<{ baggageId: string; journey: unknown }>(`/baggage/${id}/journey`);
  },

  getIntegrity(id: string) {
    return api.get<{ baggageId: string; chainValid: boolean; eventsChecked: number; brokenAt: string | null }>(`/baggage/${id}/integrity`);
  },
};
