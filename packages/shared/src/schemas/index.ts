import { z } from 'zod';
import {
  BAGGAGE_STATES,
  BAGGAGE_PRIORITIES,
  EVENT_TYPES,
  CASE_TYPES,
  CASE_PRIORITIES,
  CASE_STATUSES,
  CASE_RESOLUTION_CODES,
  TASK_TYPES,
  TASK_STATUSES,
  ORG_TYPES,
  HANDOVER_TYPES,
  FLIGHT_STATUSES,
  MEMBERSHIP_STATUSES,
} from '../constants/index.js';
import { LAYER2_ROLES, INTEGRATION_TYPES, INTEGRATION_PROVIDERS, OPERATIONAL_EVENT_TYPES, CUSTODY_PARTY_TYPES, CASE_SOURCES, SLA_STATUSES, ESCALATION_LEVELS, RECOVERY_PLAN_STATUSES, RECOVERY_TYPES, RECOVERY_RISK_LEVELS, ROUTE_SEGMENT_MODES, ROUTE_CONSTRAINT_TYPES, ROUTE_CONSTRAINT_SEVERITY, RECOVERY_EXECUTION_STATUSES, RECOVERY_APPROVAL_LEVELS, ANALYTICS_TIME_RANGES, ANALYTICS_GRANULARITIES, ALERT_SEVERITIES, EXPORT_FORMATS } from '../constants/index.js';

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const createOrganizationSchema = z.object({
  name: z.string().min(1).max(255),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/),
  type: z.enum(ORG_TYPES),
});

export const createAirportSchema = z.object({
  iataCode: z.string().length(3).toUpperCase(),
  icaoCode: z.string().length(4).toUpperCase().optional(),
  name: z.string().min(1).max(255),
  city: z.string().max(255).optional(),
  country: z.string().max(100).optional(),
  timezone: z.string().max(50).optional(),
});

export const createAirlineSchema = z.object({
  iataCode: z.string().length(3).toUpperCase(),
  icaoCode: z.string().length(4).toUpperCase().optional(),
  name: z.string().min(1).max(255),
  country: z.string().max(100).optional(),
});

export const createFlightSchema = z.object({
  airlineId: z.string().uuid().optional(),
  flightNumber: z.string().min(1).max(20),
  departureAirportId: z.string().uuid().optional(),
  arrivalAirportId: z.string().uuid().optional(),
  scheduledDeparture: z.string().datetime().optional(),
  scheduledArrival: z.string().datetime().optional(),
  status: z.enum(FLIGHT_STATUSES).default('scheduled'),
  flightDate: z.string().date().optional(),
  tailNumber: z.string().max(20).optional(),
  aircraftType: z.string().max(50).optional(),
});

export const createBaggageSchema = z.object({
  tagNumber: z.string().min(1).max(50),
  journeyId: z.string().uuid().optional(),
  flightId: z.string().uuid().optional(),
  passengerName: z.string().max(255).optional(),
  passengerReference: z.string().max(100).optional(),
  originAirportId: z.string().uuid().optional(),
  destinationAirportId: z.string().uuid().optional(),
  currentLocation: z.string().max(100).optional(),
  currentState: z.enum(BAGGAGE_STATES).default('registered'),
  weight: z.number().int().min(0).optional(),
  dimensions: z.string().max(50).optional(),
  bagType: z.string().max(50).optional(),
  priority: z.enum(BAGGAGE_PRIORITIES).default('normal'),
});

export const createBaggageEventSchema = z.object({
  baggageId: z.string().uuid(),
  flightId: z.string().uuid().optional(),
  eventType: z.enum(EVENT_TYPES),
  eventSource: z.string().max(100).optional(),
  location: z.string().max(100).optional(),
  airportCode: z.string().length(3).optional(),
  terminal: z.string().max(20).optional(),
  handler: z.string().max(100).optional(),
  idempotencyKey: z.string().max(255).optional(),
  rawPayload: z.string().optional(),
  occurredAt: z.string().datetime(),
});

export const createCaseSchema = z.object({
  caseType: z.enum(CASE_TYPES as unknown as [string, ...string[]]),
  baggageId: z.string().uuid().optional(),
  flightId: z.string().uuid().optional(),
  journeyId: z.string().uuid().optional(),
  title: z.string().min(1).max(255).optional(),
  priority: z.enum(CASE_PRIORITIES as unknown as [string, ...string[]]).default('medium'),
  description: z.string().optional(),
  source: z.enum(CASE_SOURCES as unknown as [string, ...string[]]).default('operator'),
  sourceExceptionId: z.string().uuid().optional(),
  assignedTo: z.string().uuid().optional(),
  assignedOrganizationId: z.string().uuid().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const updateCaseSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  priority: z.enum(CASE_PRIORITIES as unknown as [string, ...string[]]).optional(),
  assignedTo: z.string().uuid().optional(),
  assignedOrganizationId: z.string().uuid().optional(),
  resolution: z.string().optional(),
  resolutionCode: z.enum(CASE_RESOLUTION_CODES as unknown as [string, ...string[]]).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const assignCaseSchema = z.object({
  assignedTo: z.string().uuid(),
  assignedOrganizationId: z.string().uuid().optional(),
});

export const reassignCaseSchema = z.object({
  assignedTo: z.string().uuid(),
  assignedOrganizationId: z.string().uuid().optional(),
  reason: z.string().min(1).max(1000).optional(),
});

export const resolveCaseSchema = z.object({
  resolution: z.string().min(1).max(2000),
  resolutionCode: z.enum(CASE_RESOLUTION_CODES as unknown as [string, ...string[]]),
});

export const createTaskSchema = z.object({
  caseId: z.string().uuid().optional(),
  baggageId: z.string().uuid().optional(),
  title: z.string().min(1).max(255),
  description: z.string().optional(),
  taskType: z.enum(TASK_TYPES as unknown as [string, ...string[]]),
  priority: z.enum(CASE_PRIORITIES as unknown as [string, ...string[]]).default('medium'),
  assignedTo: z.string().uuid().optional(),
  assignedOrganizationId: z.string().uuid().optional(),
  dueAt: z.string().datetime().optional(),
});

export const updateTaskSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  assignedTo: z.string().uuid().optional(),
  assignedOrganizationId: z.string().uuid().optional(),
  dueAt: z.string().datetime().optional(),
  result: z.string().optional(),
});

export const completeTaskSchema = z.object({
  result: z.string().min(1).max(2000).optional(),
});

export const blockTaskSchema = z.object({
  reason: z.string().min(1).max(1000),
});

// ─── Layer 5: SLA & Escalation Schemas ───

export const createSLAPolicySchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  caseType: z.enum(CASE_TYPES as unknown as [string, ...string[]]),
  priority: z.enum(CASE_PRIORITIES as unknown as [string, ...string[]]),
  responseMinutes: z.number().int().min(1),
  resolutionMinutes: z.number().int().min(1),
  warningThresholdPercent: z.number().min(1).max(100).default(75),
  escalationThresholdPercent: z.number().min(1).max(100).default(100),
  pauseOnPendingExternal: z.boolean().default(true),
});

export const updateSLAPolicySchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  responseMinutes: z.number().int().min(1).optional(),
  resolutionMinutes: z.number().int().min(1).optional(),
  warningThresholdPercent: z.number().min(1).max(100).optional(),
  escalationThresholdPercent: z.number().min(1).max(100).optional(),
  pauseOnPendingExternal: z.boolean().optional(),
  enabled: z.boolean().optional(),
});

export const pauseSLASchema = z.object({
  reason: z.string().min(1).max(1000),
});

export const createEscalationSchema = z.object({
  caseId: z.string().uuid(),
  escalationLevel: z.enum(ESCALATION_LEVELS as unknown as [string, ...string[]]),
  reason: z.string().min(1).max(1000),
});

// ─── Layer 5: Comment Schema ───

export const createCaseCommentSchema = z.object({
  content: z.string().min(1).max(5000),
});

export const createHandoverSchema = z.object({
  baggageId: z.string().uuid(),
  flightId: z.string().uuid().optional(),
  fromParty: z.string().min(1).max(100),
  fromPartyType: z.string().max(50).optional(),
  toParty: z.string().min(1).max(100),
  toPartyType: z.string().max(50).optional(),
  handoverType: z.enum(HANDOVER_TYPES),
  location: z.string().max(100).optional(),
  airportCode: z.string().length(3).optional(),
});

export const idParamsSchema = z.object({
  id: z.string().uuid(),
});

// ─── Layer 2 Schemas ───

export const createRoleSchema = z.object({
  name: z.string().min(1).max(100).regex(/^[a-z_]+$/),
  displayName: z.string().min(1).max(255),
  description: z.string().optional(),
  permissionIds: z.array(z.string().uuid()).optional(),
});

export const assignRoleSchema = z.object({
  roleId: z.string().uuid(),
  userId: z.string().uuid(),
});

export const updateMembershipSchema = z.object({
  status: z.enum(MEMBERSHIP_STATUSES).optional(),
  role: z.string().max(50).optional(),
});

export const inviteUserSchema = z.object({
  email: z.string().email(),
  role: z.enum(Object.values(LAYER2_ROLES) as [string, ...string[]]),
});

export const createServiceIdentitySchema = z.object({
  name: z.string().min(1).max(255),
  type: z.enum(['scanner', 'integration', 'worker', 'ai', 'external']),
  permissions: z.array(z.string()).optional(),
  rateLimit: z.number().int().min(1).max(100000).optional(),
  expiresAt: z.string().datetime().optional(),
});

export const createOrgRelationshipSchema = z.object({
  childOrgId: z.string().uuid(),
  relationshipType: z.enum(['parent_child', 'partnership', 'service_agreement']),
});

export const createAccessPolicySchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  policyType: z.string().min(1).max(50),
  rules: z.string().min(1),
  priority: z.number().int().optional(),
  enabled: z.boolean().default(true),
});

// ─── Layer 3: Integration & Data Normalization Schemas ───

export const createIntegrationSchema = z.object({
  name: z.string().min(1).max(255),
  type: z.enum(Object.values(INTEGRATION_TYPES) as [string, ...string[]]),
  provider: z.enum(Object.values(INTEGRATION_PROVIDERS) as [string, ...string[]]).optional(),
  config: z.string().optional(),
  mappingConfig: z.record(z.unknown()).optional(),
});

export const updateIntegrationSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  status: z.enum(['configuring', 'active', 'paused', 'disabled']).optional(),
  config: z.string().optional(),
  mappingConfig: z.record(z.unknown()).optional(),
});

export const webhookEventSchema = z.object({
  event_id: z.string().min(1).max(255),
  event_type: z.string().min(1).max(100),
  timestamp: z.string().datetime(),
  payload: z.record(z.unknown()),
  entity: z.object({
    type: z.string().optional(),
    id: z.string().optional(),
    tag_number: z.string().optional(),
    flight_number: z.string().optional(),
  }).optional(),
  location: z.object({
    airport_code: z.string().length(3).optional(),
    terminal: z.string().optional(),
    handler: z.string().optional(),
  }).optional(),
});

export const importCsvSchema = z.object({
  eventType: z.string().min(1).max(100),
  mappingVersion: z.string().max(20).optional(),
});

export const replayEventSchema = z.object({
  eventId: z.string().uuid(),
});

// ─── Layer 4: Operations & Event Engine Schemas ───

export const createOperationalEventSchema = z.object({
  baggageId: z.string().uuid(),
  flightId: z.string().uuid().optional(),
  eventType: z.enum(OPERATIONAL_EVENT_TYPES as unknown as [string, ...string[]]),
  eventSource: z.enum(['external_integration', 'scanner', 'manual_operator', 'system', 'recovery']),
  actorType: z.enum(['user', 'scanner', 'system', 'integration', 'service']).optional(),
  actorId: z.string().uuid().optional(),
  location: z.string().max(255).optional(),
  airportCode: z.string().length(3).optional(),
  terminal: z.string().max(20).optional(),
  handler: z.string().max(100).optional(),
  idempotencyKey: z.string().max(255).optional(),
  rawPayload: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
  occurredAt: z.string().datetime(),
});

export const correctEventSchema = z.object({
  correctedEventType: z.enum(OPERATIONAL_EVENT_TYPES as unknown as [string, ...string[]]),
  reason: z.string().min(1).max(1000),
  metadata: z.record(z.unknown()).optional(),
});

export const createCustodySchema = z.object({
  baggageId: z.string().uuid(),
  flightId: z.string().uuid().optional(),
  custodianName: z.string().min(1).max(100),
  custodianType: z.enum(CUSTODY_PARTY_TYPES as unknown as [string, ...string[]]),
  location: z.string().max(255).optional(),
  airportCode: z.string().length(3).optional(),
  handoverId: z.string().uuid().optional(),
  notes: z.string().max(1000).optional(),
  transferredAt: z.string().datetime().optional(),
});

export const createExpectedEventSchema = z.object({
  baggageId: z.string().uuid(),
  flightId: z.string().uuid().optional(),
  journeyId: z.string().uuid().optional(),
  expectedType: z.enum(OPERATIONAL_EVENT_TYPES as unknown as [string, ...string[]]),
  expectedAt: z.string().datetime(),
  expectedLocation: z.string().max(255).optional(),
  expectedAirportCode: z.string().length(3).optional(),
  notes: z.string().max(1000).optional(),
});

export const createJourneySchema = z.object({
  passengerName: z.string().max(255).optional(),
  passengerReference: z.string().max(100).optional(),
  pnr: z.string().max(10).optional(),
  originAirportId: z.string().uuid().optional(),
  destinationAirportId: z.string().uuid().optional(),
  connectingFlights: z.string().optional(),
});

export const createHandoverInputSchema = z.object({
  baggageId: z.string().uuid(),
  flightId: z.string().uuid().optional(),
  fromParty: z.string().min(1).max(100),
  fromPartyType: z.enum(CUSTODY_PARTY_TYPES as unknown as [string, ...string[]]).optional(),
  toParty: z.string().min(1).max(100),
  toPartyType: z.enum(CUSTODY_PARTY_TYPES as unknown as [string, ...string[]]).optional(),
  handoverType: z.enum(HANDOVER_TYPES),
  location: z.string().max(255).optional(),
  airportCode: z.string().length(3).optional(),
});

// ─── Layer 6: Recovery & Routing Engine ──────────────────────────────────────

export const createRecoveryPlanSchema = z.object({
  caseId: z.string().uuid(),
  baggageId: z.string().uuid().optional(),
  recoveryType: z.enum(RECOVERY_TYPES as unknown as [string, ...string[]]),
  origin: z.string().min(1).max(10),
  destination: z.string().min(1).max(10),
  currentLocation: z.string().max(10).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const updateRecoveryPlanSchema = z.object({
  recoveryType: z.enum(RECOVERY_TYPES as unknown as [string, ...string[]]).optional(),
  origin: z.string().min(1).max(10).optional(),
  destination: z.string().min(1).max(10).optional(),
  currentLocation: z.string().max(10).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const approveRecoveryPlanSchema = z.object({
  status: z.enum(['approved', 'rejected'] as [string, ...string[]]),
  approvalNotes: z.string().max(2000).optional(),
});

export const selectRouteSchema = z.object({
  routeOptionId: z.string().uuid(),
});

export const executeRecoveryPlanSchema = z.object({
  providerId: z.string().uuid().optional(),
  providerServiceId: z.string().uuid().optional(),
  notes: z.string().max(2000).optional(),
});

export const createRecoveryProviderSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(2000).optional(),
  coverage: z.array(z.string().min(1).max(10)).min(1),
  contactEmail: z.string().email().optional(),
  contactPhone: z.string().max(50).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const updateRecoveryProviderSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(2000).optional(),
  coverage: z.array(z.string().min(1).max(10)).optional(),
  status: z.string().max(30).optional(),
  contactEmail: z.string().email().optional(),
  contactPhone: z.string().max(50).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const createProviderServiceSchema = z.object({
  serviceName: z.string().min(1).max(255),
  serviceType: z.string().min(1).max(100),
  coverage: z.array(z.string().min(1).max(10)).min(1),
  estimatedDurationMinutes: z.number().int().positive().optional(),
  cost: z.number().nonnegative().optional(),
  capacity: z.number().int().nonnegative().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const createRouteConstraintSchema = z.object({
  recoveryPlanId: z.string().uuid().optional(),
  routeOptionId: z.string().uuid().optional(),
  constraintType: z.enum(ROUTE_CONSTRAINT_TYPES as unknown as [string, ...string[]]),
  severity: z.enum(ROUTE_CONSTRAINT_SEVERITY as unknown as [string, ...string[]]),
  description: z.string().min(1).max(1000),
  details: z.string().max(2000).optional(),
});

export const recoveryPlanQuerySchema = z.object({
  status: z.string().optional(),
  recoveryType: z.string().optional(),
  caseId: z.string().uuid().optional(),
  baggageId: z.string().uuid().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});

// ─── Layer 7: Analytics & Command Center ──────────────────────────────────────

export const analyticsQuerySchema = z.object({
  timeRange: z.enum(ANALYTICS_TIME_RANGES as unknown as [string, ...string[]]).default('last_30_days'),
  granularity: z.enum(ANALYTICS_GRANULARITIES as unknown as [string, ...string[]]).default('day'),
  airportCode: z.string().optional(),
  airlineCode: z.string().optional(),
  caseType: z.string().optional(),
  recoveryType: z.string().optional(),
  priority: z.string().optional(),
  status: z.string().optional(),
  providerId: z.string().optional(),
  customFrom: z.string().datetime().optional(),
  customTo: z.string().datetime().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});

export const analyticsMetricQuerySchema = z.object({
  metricName: z.string().min(1),
  timeRange: z.enum(ANALYTICS_TIME_RANGES as unknown as [string, ...string[]]).default('last_30_days'),
  granularity: z.enum(ANALYTICS_GRANULARITIES as unknown as [string, ...string[]]).default('day'),
  airportCode: z.string().optional(),
  airlineCode: z.string().optional(),
  customFrom: z.string().datetime().optional(),
  customTo: z.string().datetime().optional(),
});

export const createAlertRuleSchema = z.object({
  ruleName: z.string().min(1).max(255),
  metricName: z.string().min(1),
  condition: z.enum(['gt', 'lt', 'gte', 'lte', 'eq'] as unknown as [string, ...string[]]),
  threshold: z.number(),
  severity: z.enum(ALERT_SEVERITIES as unknown as [string, ...string[]]),
  scopeDimensions: z.record(z.string()).default({}),
  cooldownMinutes: z.number().int().min(5).max(1440).default(30),
});

export const updateAlertRuleSchema = z.object({
  ruleName: z.string().min(1).max(255).optional(),
  metricName: z.string().min(1).optional(),
  condition: z.enum(['gt', 'lt', 'gte', 'lte', 'eq'] as unknown as [string, ...string[]]).optional(),
  threshold: z.number().optional(),
  severity: z.enum(ALERT_SEVERITIES as unknown as [string, ...string[]]).optional(),
  scopeDimensions: z.record(z.string()).optional(),
  cooldownMinutes: z.number().int().min(5).max(1440).optional(),
  isActive: z.boolean().optional(),
});

export const acknowledgeAlertSchema = z.object({
  notes: z.string().max(2000).optional(),
});

export const dismissAlertSchema = z.object({
  reason: z.string().min(1).max(2000),
});

export const createSavedViewSchema = z.object({
  viewName: z.string().min(1).max(255),
  description: z.string().max(2000).optional(),
  filters: z.record(z.unknown()),
  isDefault: z.boolean().default(false),
});

export const updateSavedViewSchema = z.object({
  viewName: z.string().min(1).max(255).optional(),
  description: z.string().max(2000).optional(),
  filters: z.record(z.unknown()).optional(),
  isDefault: z.boolean().optional(),
});

export const createExportSchema = z.object({
  exportType: z.string().min(1),
  format: z.enum(EXPORT_FORMATS as unknown as [string, ...string[]]),
  filters: z.record(z.unknown()),
});

export const commandCenterQuerySchema = z.object({
  airportCode: z.string().optional(),
});

// ─── Layer 8A: AI Intelligence Engine ────────────────────────────────────────

export const intelligenceResultSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string(),
  type: z.enum(['PREDICTION', 'ANOMALY', 'RISK', 'ROOT_CAUSE', 'RECOMMENDATION', 'ASSISTANT_RESPONSE']),
  status: z.enum(['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'EXPIRED']),
  confidence: z.enum(['VERY_LOW', 'LOW', 'MEDIUM', 'HIGH', 'VERY_HIGH']),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
  summary: z.string(),
  explanation: z.string(),
  evidence: z.array(z.object({
    sourceType: z.string(),
    sourceId: z.string(),
    reason: z.string(),
  })),
  metadata: z.object({
    generatedAt: z.date(),
    model: z.string(),
    version: z.string(),
    confidence: z.enum(['VERY_LOW', 'LOW', 'MEDIUM', 'HIGH', 'VERY_HIGH']),
  }),
});

export const predictionSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string(),
  predictionType: z.string(),
  subjectType: z.string(),
  subjectId: z.string(),
  probability: z.number().min(0).max(1),
  confidence: z.enum(['VERY_LOW', 'LOW', 'MEDIUM', 'HIGH', 'VERY_HIGH']),
  horizon: z.number().int().positive(),
  evidence: z.array(z.object({
    sourceType: z.string(),
    sourceId: z.string(),
    reason: z.string(),
  })),
  explanation: z.string(),
  model: z.string(),
  version: z.string(),
  generatedAt: z.date(),
  expiresAt: z.date().optional(),
  status: z.enum(['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'EXPIRED']),
});

export const riskAssessmentSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string(),
  subjectType: z.string(),
  subjectId: z.string(),
  riskLevel: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
  factors: z.array(z.object({
    name: z.string(),
    weight: z.number(),
    description: z.string(),
  })),
  evidence: z.array(z.object({
    sourceType: z.string(),
    sourceId: z.string(),
    reason: z.string(),
  })),
  explanation: z.string(),
  confidence: z.enum(['VERY_LOW', 'LOW', 'MEDIUM', 'HIGH', 'VERY_HIGH']),
  generatedAt: z.date(),
  status: z.enum(['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'EXPIRED']),
});

export const anomalyDetectionSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string(),
  anomalyType: z.string(),
  subjectType: z.string(),
  subjectId: z.string(),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
  score: z.number().min(0).max(1),
  expectedBehavior: z.string(),
  observedBehavior: z.string(),
  evidence: z.array(z.object({
    sourceType: z.string(),
    sourceId: z.string(),
    reason: z.string(),
  })),
  explanation: z.string(),
  confidence: z.enum(['VERY_LOW', 'LOW', 'MEDIUM', 'HIGH', 'VERY_HIGH']),
  generatedAt: z.date(),
  status: z.enum(['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'EXPIRED']),
});

export const rootCauseAnalysisSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string(),
  subjectType: z.string(),
  subjectId: z.string(),
  candidates: z.array(z.object({
    cause: z.string(),
    confidence: z.enum(['VERY_LOW', 'LOW', 'MEDIUM', 'HIGH', 'VERY_HIGH']),
    evidence: z.array(z.object({
      sourceType: z.string(),
      sourceId: z.string(),
      reason: z.string(),
    })),
    description: z.string(),
  })),
  evidence: z.array(z.object({
    sourceType: z.string(),
    sourceId: z.string(),
    reason: z.string(),
  })),
  explanation: z.string(),
  confidence: z.enum(['VERY_LOW', 'LOW', 'MEDIUM', 'HIGH', 'VERY_HIGH']),
  generatedAt: z.date(),
  status: z.enum(['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'EXPIRED']),
});

export const recommendationSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
  recommendation: z.string(),
  evidence: z.array(z.object({
    sourceType: z.string(),
    sourceId: z.string(),
    reason: z.string(),
  })),
  confidence: z.enum(['VERY_LOW', 'LOW', 'MEDIUM', 'HIGH', 'VERY_HIGH']),
  impact: z.string(),
  requiredApproval: z.string().optional(),
  generatedAt: z.date(),
  status: z.enum(['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'EXPIRED']),
});

export type IntelligenceResultSchemaType = z.infer<typeof intelligenceResultSchema>;
export type PredictionSchemaType = z.infer<typeof predictionSchema>;
export type RiskAssessmentSchemaType = z.infer<typeof riskAssessmentSchema>;
export type AnomalyDetectionSchemaType = z.infer<typeof anomalyDetectionSchema>;
export type RootCauseAnalysisSchemaType = z.infer<typeof rootCauseAnalysisSchema>;
export type RecommendationSchemaType = z.infer<typeof recommendationSchema>;
