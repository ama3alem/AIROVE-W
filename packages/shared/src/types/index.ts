import type {
  BAGGAGE_STATES,
  BAGGAGE_PRIORITIES,
  EVENT_TYPES,
  CASE_TYPES,
  CASE_PRIORITIES,
  CASE_STATUSES,
  CASE_RESOLUTION_CODES,
  CASE_SOURCES,
  TASK_TYPES,
  TASK_STATUSES,
  ORG_TYPES,
  ORG_ROLES,
  HANDOVER_TYPES,
  FLIGHT_STATUSES,
  NOTIFICATION_TYPES,
  NOTIFICATION_SEVERITIES,
  PERMISSION_RESOURCES,
  PERMISSION_ACTIONS,
  LAYER2_ROLES,
  MEMBERSHIP_STATUSES,
  INVITATION_STATUSES,
  SERVICE_IDENTITY_TYPES,
  ORG_RELATIONSHIP_TYPES,
  INTEGRATION_TYPES,
  INTEGRATION_STATUS,
  INTEGRATION_PROVIDERS,
  INTEGRATION_EVENT_STATUS,
  CANONICAL_EVENT_TYPES,
  OUTBOUND_DELIVERY_STATUS,
  ENTITY_TYPES,
  DATA_CLASSIFICATIONS,
  OPERATIONAL_EVENT_TYPES,
  BAGGAGE_LIFECYCLE_STATES,
  EVENT_SOURCES,
  ACTOR_TYPES,
  OPERATIONAL_EXCEPTION_TYPES,
  EXCEPTION_SEVERITIES,
  CUSTODY_PARTY_TYPES,
  HANDOVER_STATES,
  EXPECTED_EVENT_STATUS,
  EVENT_OUTBOX_STATUS,
  SLA_STATUSES,
  ESCALATION_LEVELS,
  ESCALATION_STATUSES,
  WORKFLOW_STATUSES,
  CASE_ACTIVITY_TYPES,
  RECOVERY_PLAN_STATUSES,
  RECOVERY_TYPES,
  RECOVERY_RISK_LEVELS,
  ROUTE_SEGMENT_MODES,
  ROUTE_SEGMENT_STATUSES,
  ROUTE_CONSTRAINT_TYPES,
  ROUTE_CONSTRAINT_SEVERITY,
  RECOVERY_EXECUTION_STATUSES,
  RECOVERY_EXECUTION_STEP_STATUSES,
  RECOVERY_APPROVAL_LEVELS,
  RECOVERY_PLAN_TRANSITIONS,
  ROUTE_SCORING_WEIGHTS,
  GRAPH_TRAVERSAL_LIMITS,
  MetricCategory,
  AnalyticsAggregationType,
  AnalyticsDimension,
  AnalyticsGranularity,
  AlertSeverity,
  AlertStatus,
  ExportFormat,
} from '../constants';

export type BaggageState = (typeof BAGGAGE_STATES)[number];
export type BaggagePriority = (typeof BAGGAGE_PRIORITIES)[number];
export type EventType = (typeof EVENT_TYPES)[number];
export type CaseType = (typeof CASE_TYPES)[number];
export type CasePriority = (typeof CASE_PRIORITIES)[number];
export type CaseStatus = (typeof CASE_STATUSES)[number];
export type TaskType = (typeof TASK_TYPES)[number];
export type TaskStatus = (typeof TASK_STATUSES)[number];
export type OrgType = (typeof ORG_TYPES)[number];
export type OrgRole = (typeof ORG_ROLES)[number];
export type HandoverType = (typeof HANDOVER_TYPES)[number];
export type FlightStatus = (typeof FLIGHT_STATUSES)[number];
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];
export type NotificationSeverity = (typeof NOTIFICATION_SEVERITIES)[number];

// Layer 2 types
export type PermissionResource = (typeof PERMISSION_RESOURCES)[number];
export type PermissionAction = (typeof PERMISSION_ACTIONS)[number];
export type Layer2Role = (typeof LAYER2_ROLES)[keyof typeof LAYER2_ROLES];
export type MembershipStatus = (typeof MEMBERSHIP_STATUSES)[number];
export type InvitationStatus = (typeof INVITATION_STATUSES)[number];
export type ServiceIdentityType = (typeof SERVICE_IDENTITY_TYPES)[number];
export type OrgRelationshipType = (typeof ORG_RELATIONSHIP_TYPES)[number];

export type PermissionString = `${PermissionResource}:${PermissionAction}`;

export interface AuthorizationContext {
  principalId: string;
  principalType: 'user' | 'service';
  organizationId: string;
  organizationType: string;
  membershipId: string;
  roles: string[];
  permissions: string[];
  scopes: string[];
  authenticationState: 'authenticated' | 'service_authenticated';
  isSuperAdmin: boolean;
}

export interface AuthorizationResult {
  allowed: boolean;
  reason?: string;
  requiredPermission?: string;
  context?: AuthorizationContext;
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string | null;
  platformRole: string | null;
  status: string;
}

export interface OrgMembership {
  id: string;
  orgId: string;
  userId: string;
  role: string;
  status: string;
}

export interface AuditEvent {
  orgId: string;
  userId?: string;
  action: string;
  entityType: string;
  entityId?: string;
  entityRef?: string;
  changes?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

export interface ApiSuccessResponse<T = unknown> {
  success: true;
  data: T;
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export type ApiResponse<T = unknown> = ApiSuccessResponse<T> | ApiErrorResponse;

export interface PaginatedData<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface PaginationParams {
  page?: number;
  pageSize?: number;
}

export interface RequestContext {
  userId: string;
  orgId: string;
  role: OrgRole;
  email: string;
}

// Layer 3 types
export type IntegrationType = (typeof INTEGRATION_TYPES)[number];
export type IntegrationStatus = (typeof INTEGRATION_STATUS)[number];
export type IntegrationProvider = (typeof INTEGRATION_PROVIDERS)[number];
export type IntegrationEventStatus = (typeof INTEGRATION_EVENT_STATUS)[number];
export type CanonicalEventType = (typeof CANONICAL_EVENT_TYPES)[number];
export type OutboundDeliveryStatus = (typeof OUTBOUND_DELIVERY_STATUS)[number];
export type EntityType = (typeof ENTITY_TYPES)[number];
export type DataClassification = (typeof DATA_CLASSIFICATIONS)[number];

export interface NormalizedEvent {
  eventId: string;
  eventType: CanonicalEventType | string;
  occurredAt: string;
  receivedAt: string;
  source: string;
  integrationId: string;
  organizationId: string;
  externalEventId: string;
  externalEntityId?: string;
  baggageId?: string;
  flightId?: string;
  location?: string;
  airportCode?: string;
  terminal?: string;
  handler?: string;
  actor?: string;
  payload: Record<string, unknown>;
  metadata: Record<string, unknown>;
  provenance: EventProvenance;
}

export interface EventProvenance {
  integrationId: string;
  integrationName: string;
  provider?: string;
  externalEventId: string;
  mappingVersion: string;
  sourceSystem?: string;
  receivedAt: string;
  correlationId?: string;
}

export interface IntegrationHealth {
  integrationId: string;
  status: IntegrationStatus;
  lastSuccessAt?: string;
  lastFailureAt?: string;
  lastError?: string;
  failureRate: number;
  totalReceived: number;
  totalFailed: number;
  consecutiveFailures: number;
}

export interface MappingField {
  source: string;
  target: string;
  required?: boolean;
  defaultValue?: unknown;
  transform?: 'string' | 'number' | 'date' | 'enum';
  enumMapping?: Record<string, string>;
}

export interface IntegrationMapping {
  version: string;
  eventTypeMap: Record<string, string>;
  fieldMappings: Record<string, MappingField[]>;
  entityResolvers: Record<string, string>;
}

export interface WebhookPayload {
  integrationId: string;
  headers: Record<string, string>;
  body: unknown;
  timestamp: string;
  signature?: string;
}

export interface IngestionResult {
  eventId: string;
  status: 'processed' | 'failed' | 'duplicate_ignored' | 'quarantined' | 'pending_resolution';
  reason?: string;
  normalizedEvent?: NormalizedEvent;
}

export interface CanonicalBaggageEvent {
  eventType: CanonicalEventType;
  tagNumber?: string;
  baggageId?: string;
  flightNumber?: string;
  flightId?: string;
  airportCode?: string;
  location?: string;
  terminal?: string;
  handler?: string;
  occurredAt: string;
  passengerName?: string;
  passengerReference?: string;
}

// Layer 4 types

export type OperationalEventType = (typeof OPERATIONAL_EVENT_TYPES)[number];
export type BaggageLifecycleState = (typeof BAGGAGE_LIFECYCLE_STATES)[number];

// Layer 8A types
export type IntelligenceType = 
  | 'PREDICTION'
  | 'ANOMALY'
  | 'RISK'
  | 'ROOT_CAUSE'
  | 'RECOMMENDATION'
  | 'ASSISTANT_RESPONSE';

export type IntelligenceStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'EXPIRED';

export type ConfidenceLevel = 'VERY_LOW' | 'LOW' | 'MEDIUM' | 'HIGH' | 'VERY_HIGH';

export type SeverityLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface EvidenceReference {
  sourceType: string;
  sourceId: string;
  reason: string;
}

export interface IntelligenceMetadata {
  generatedAt: Date;
  model: string;
  version: string;
  confidence: ConfidenceLevel;
}

export interface IntelligenceResult {
  id: string;
  organizationId: string;
  type: IntelligenceType;
  status: IntelligenceStatus;
  confidence: ConfidenceLevel;
  severity?: SeverityLevel;
  summary: string;
  explanation: string;
  evidence: EvidenceReference[];
  metadata: IntelligenceMetadata;
}

// Prediction types
export type PredictionCategory = 
  | 'TRANSFER_FAILURE'
  | 'SLA_MISS'
  | 'BAGGAGE_DELAY'
  | 'BAGGAGE_MISDIRECTION'
  | 'RECOVERY_FAILURE'
  | 'CONNECTION_FAILURE'
  | 'DELIVERY_DELAY'
  | 'CASE_ESCALATION'
  | 'SYSTEM_ANOMALY';

export interface Prediction {
  id: string;
  organizationId: string;
  predictionType: PredictionCategory;
  subjectType: string;
  subjectId: string;
  probability: number;
  confidence: ConfidenceLevel;
  horizon: number; // minutes
  evidence: EvidenceReference[];
  explanation: string;
  model: string;
  version: string;
  generatedAt: Date;
  expiresAt?: Date;
  status: IntelligenceStatus;
}

// Risk assessment
export interface RiskAssessment {
  id: string;
  organizationId: string;
  subjectType: string;
  subjectId: string;
  riskLevel: SeverityLevel;
  factors: Array<{
    name: string;
    weight: number;
    description: string;
  }>;
  evidence: EvidenceReference[];
  explanation: string;
  confidence: ConfidenceLevel;
  generatedAt: Date;
  status: IntelligenceStatus;
}

// Anomaly detection
export interface AnomalyDetection {
  id: string;
  organizationId: string;
  anomalyType: string;
  subjectType: string;
  subjectId: string;
  severity: SeverityLevel;
  score: number;
  expectedBehavior: string;
  observedBehavior: string;
  evidence: EvidenceReference[];
  explanation: string;
  confidence: ConfidenceLevel;
  generatedAt: Date;
  status: IntelligenceStatus;
}

// Root cause analysis
export interface RootCauseCandidate {
  cause: string;
  confidence: ConfidenceLevel;
  evidence: EvidenceReference[];
  description: string;
}

export interface RootCauseAnalysis {
  id: string;
  organizationId: string;
  subjectType: string;
  subjectId: string;
  candidates: RootCauseCandidate[];
  evidence: EvidenceReference[];
  explanation: string;
  confidence: ConfidenceLevel;
  generatedAt: Date;
  status: IntelligenceStatus;
}

// Recommendation
export interface Recommendation {
  id: string;
  organizationId: string;
  priority: SeverityLevel;
  recommendation: string;
  evidence: EvidenceReference[];
  confidence: ConfidenceLevel;
  impact: string;
  requiredApproval?: string;
  generatedAt: Date;
  status: IntelligenceStatus;
}

// Layer 8B: AI Operational Interface & Controlled Action Engine
export type {
  AIMessageRole,
  AIConversationStatus,
  AIMessageStatus,
  AIToolClassification,
  AIActionType,
  AIActionStatus,
  AIApprovalDecision,
  AIInteractionType,
  AIResponseMode,
  AIConfidence,
  AIExecutionStatus,
  AIConversationSession,
  AIMessage,
  AIToolCall,
  AIEvidence,
  AIResponse,
  AIActionProposal,
  AIApproval,
  AIInteraction,
} from './ai-interface';

export {
  aiConversationStatusEnum,
  aiMessageRoleEnum,
  aiMessageStatusEnum,
  aiToolClassificationEnum,
  aiActionTypeEnum,
  aiActionStatusEnum,
  aiApprovalDecisionEnum,
  aiInteractionTypeEnum,
  aiResponseModeEnum,
  aiConfidenceEnum,
  aiExecutionStatusEnum,
  aiEvidenceSchema,
  assistantRequestSchema,
  assistantResponseSchema,
  createSessionSchema,
  createMessageSchema,
  createActionProposalSchema,
  approvalRequestSchema,
} from './ai-interface';

export type EventSource = (typeof EVENT_SOURCES)[number];
export type ActorType = (typeof ACTOR_TYPES)[number];
export type OperationalExceptionType = (typeof OPERATIONAL_EXCEPTION_TYPES)[number];
export type ExceptionSeverity = (typeof EXCEPTION_SEVERITIES)[number];
export type CustodyPartyType = (typeof CUSTODY_PARTY_TYPES)[number];
export type HandoverState = (typeof HANDOVER_STATES)[number];
export type ExpectedEventStatus = (typeof EXPECTED_EVENT_STATUS)[number];
export type EventOutboxStatus = (typeof EVENT_OUTBOX_STATUS)[number];

export interface OperationalEvent {
  id: string;
  orgId: string;
  baggageId: string;
  flightId: string | null;
  eventType: OperationalEventType;
  eventSource: EventSource;
  actorType: ActorType | null;
  actorId: string | null;
  location: string | null;
  airportCode: string | null;
  terminal: string | null;
  handler: string | null;
  status: string;
  sequenceNumber: number;
  correctionOf: string | null;
  eventHash: string | null;
  previousEventHash: string | null;
  schemaVersion: string;
  idempotencyKey: string | null;
  rawPayload: string | null;
  metadata: string | null;
  occurredAt: Date;
  recordedAt: Date;
  processedAt: Date | null;
  createdAt: Date;
}

export interface BaggageStateProjection {
  id: string;
  orgId: string;
  baggageId: string;
  currentState: BaggageLifecycleState;
  currentLocation: string | null;
  currentAirportCode: string | null;
  currentCustodian: string | null;
  currentCustodianType: string | null;
  lastEventId: string | null;
  lastEventType: string | null;
  lastEventAt: Date | null;
  expectedNextEvent: string | null;
  expectedNextEventAt: Date | null;
  sequenceNumber: number;
  lastEventHash: string | null;
  eventCount: number;
  updatedAt: Date;
}

export interface BaggageCustodyRecord {
  id: string;
  orgId: string;
  baggageId: string;
  flightId: string | null;
  custodianName: string;
  custodianType: CustodyPartyType;
  previousCustodian: string | null;
  previousCustodianType: string | null;
  location: string | null;
  airportCode: string | null;
  transferredAt: Date;
  transferredBy: string | null;
  handoverId: string | null;
  notes: string | null;
  metadata: string | null;
  createdAt: Date;
}

export interface ExpectedEvent {
  id: string;
  orgId: string;
  baggageId: string;
  flightId: string | null;
  journeyId: string | null;
  expectedType: OperationalEventType;
  expectedAt: Date;
  expectedLocation: string | null;
  expectedAirportCode: string | null;
  status: ExpectedEventStatus;
  fulfilledByEventId: string | null;
  fulfilledAt: Date | null;
  expiredAt: Date | null;
  notes: string | null;
  metadata: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface OperationalException {
  id: string;
  orgId: string;
  baggageId: string | null;
  flightId: string | null;
  journeyId: string | null;
  exceptionType: OperationalExceptionType;
  severity: ExceptionSeverity;
  description: string;
  expectedEventId: string | null;
  actualEventId: string | null;
  location: string | null;
  airportCode: string | null;
  resolved: boolean;
  resolvedAt: Date | null;
  resolvedBy: string | null;
  resolution: string | null;
  metadata: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface EventOutboxEntry {
  id: string;
  orgId: string;
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  payload: string;
  status: EventOutboxStatus;
  attempts: number;
  maxAttempts: number;
  lastError: string | null;
  nextRetryAt: Date | null;
  sentAt: Date | null;
  createdAt: Date;
}

export interface BaggageTimelineEntry {
  eventId: string;
  eventType: OperationalEventType;
  eventSource: EventSource;
  occurredAt: Date;
  recordedAt: Date;
  location: string | null;
  airportCode: string | null;
  terminal: string | null;
  handler: string | null;
  actorType: ActorType | null;
  actorId: string | null;
  status: string;
  isCorrection: boolean;
  correctionOf: string | null;
  metadata: Record<string, unknown> | null;
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
  state: BaggageStateProjection;
  custody: BaggageCustodyRecord | null;
  lastEvent: OperationalEvent | null;
  expectedNextEvent: ExpectedEvent | null;
  recentExceptions: OperationalException[];
  eventCount: number;
}

export interface StateTransitionResult {
  allowed: boolean;
  previousState: BaggageLifecycleState;
  newState: BaggageLifecycleState;
  reason?: string;
}

export interface EventIntegrityHash {
  eventHash: string;
  previousEventHash: string | null;
}

export interface ReplayResult {
  baggageId: string;
  initialState: BaggageStateProjection;
  finalState: BaggageStateProjection;
  eventsReplayed: number;
  exceptions: OperationalException[];
}

// Layer 5 types

export type CaseResolutionCode = (typeof CASE_RESOLUTION_CODES)[number];
export type CaseSource = (typeof CASE_SOURCES)[number];
export type CaseActivityType = (typeof CASE_ACTIVITY_TYPES)[number];
export type SlaStatus = (typeof SLA_STATUSES)[number];
export type EscalationLevel = (typeof ESCALATION_LEVELS)[number];
export type EscalationStatus = (typeof ESCALATION_STATUSES)[number];
export type WorkflowStatus = (typeof WORKFLOW_STATUSES)[number];

export interface Case {
  id: string;
  orgId: string;
  caseNumber: string;
  caseType: string;
  baggageId: string | null;
  flightId: string | null;
  journeyId: string | null;
  title: string | null;
  priority: string;
  status: string;
  assignedTo: string | null;
  assignedOrganizationId: string | null;
  originOrganizationId: string | null;
  sourceExceptionId: string | null;
  source: CaseSource;
  description: string | null;
  resolution: string | null;
  resolutionCode: CaseResolutionCode | null;
  resolvedAt: Date | null;
  closedAt: Date | null;
  escalatedAt: Date | null;
  workflowId: string | null;
  metadata: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CaseTask {
  id: string;
  orgId: string;
  caseId: string | null;
  baggageId: string | null;
  title: string;
  description: string | null;
  taskType: string;
  priority: string;
  status: string;
  assignedTo: string | null;
  assignedOrganizationId: string | null;
  assignedAt: Date | null;
  startedAt: Date | null;
  dueAt: Date | null;
  completedAt: Date | null;
  completedBy: string | null;
  blockedAt: Date | null;
  blockedReason: string | null;
  result: string | null;
  metadata: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CaseActivity {
  id: string;
  caseId: string;
  orgId: string;
  activityType: CaseActivityType;
  actorId: string | null;
  actorOrganizationId: string | null;
  description: string | null;
  previousValue: string | null;
  newValue: string | null;
  metadata: string | null;
  createdAt: Date;
}

export interface CaseComment {
  id: string;
  caseId: string;
  orgId: string;
  authorId: string;
  authorOrganizationId: string | null;
  content: string;
  metadata: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface SLAPolicy {
  id: string;
  orgId: string;
  name: string;
  description: string | null;
  caseType: string;
  priority: string;
  responseMinutes: number;
  resolutionMinutes: number;
  warningThresholdPercent: number;
  escalationThresholdPercent: number;
  pauseOnPendingExternal: boolean;
  enabled: boolean;
  metadata: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CaseSLA {
  id: string;
  caseId: string;
  orgId: string;
  slaPolicyId: string;
  status: SlaStatus;
  responseDueAt: Date;
  resolutionDueAt: Date;
  respondedAt: Date | null;
  resolvedAt: Date | null;
  pausedAt: Date | null;
  resumedAt: Date | null;
  totalPausedMs: number;
  warningTriggeredAt: Date | null;
  breachTriggeredAt: Date | null;
  metadata: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CaseEscalation {
  id: string;
  caseId: string;
  orgId: string;
  escalationLevel: EscalationLevel;
  status: EscalationStatus;
  slaCaseId: string | null;
  triggeredAt: Date;
  acknowledgedAt: Date | null;
  acknowledgedBy: string | null;
  resolvedAt: Date | null;
  resolvedBy: string | null;
  reason: string | null;
  metadata: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface WorkflowDefinition {
  id: string;
  orgId: string;
  name: string;
  description: string | null;
  version: number;
  status: WorkflowStatus;
  triggerType: string;
  triggerConfig: string | null;
  metadata: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface WorkflowRule {
  id: string;
  workflowId: string;
  orgId: string;
  ruleOrder: number;
  conditionType: string;
  conditionConfig: string;
  actionType: string;
  actionConfig: string;
  enabled: boolean;
  metadata: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CaseDetailView {
  case: Case;
  tasks: CaseTask[];
  activities: CaseActivity[];
  sla: CaseSLA | null;
  escalations: CaseEscalation[];
  commentCount: number;
}

export interface CaseTimelineEntry {
  id: string;
  type: CaseActivityType;
  actorId: string | null;
  description: string | null;
  previousValue: string | null;
  newValue: string | null;
  timestamp: Date;
}

// ─── Layer 6: Recovery & Routing Engine ──────────────────────────────────────

export type RecoveryPlanStatus = (typeof RECOVERY_PLAN_STATUSES)[number];
export type RecoveryType = (typeof RECOVERY_TYPES)[number];
export type RecoveryRiskLevel = (typeof RECOVERY_RISK_LEVELS)[number];
export type RouteSegmentMode = (typeof ROUTE_SEGMENT_MODES)[number];
export type RouteSegmentStatus = (typeof ROUTE_SEGMENT_STATUSES)[number];
export type RouteConstraintType = (typeof ROUTE_CONSTRAINT_TYPES)[number];
export type RouteConstraintSeverity = (typeof ROUTE_CONSTRAINT_SEVERITY)[number];
export type RecoveryExecutionStatus = (typeof RECOVERY_EXECUTION_STATUSES)[number];
export type RecoveryExecutionStepStatus = (typeof RECOVERY_EXECUTION_STEP_STATUSES)[number];
export type RecoveryApprovalLevel = (typeof RECOVERY_APPROVAL_LEVELS)[number];

export interface RecoveryPlan {
  id: string;
  orgId: string;
  caseId: string;
  baggageId: string | null;
  planNumber: string;
  recoveryType: RecoveryType;
  status: RecoveryPlanStatus;
  origin: string;
  destination: string;
  currentLocation: string | null;
  slaRemainingMinutes: number | null;
  selectedRouteOptionId: string | null;
  approvalLevel: string | null;
  approvedBy: string | null;
  approvedAt: Date | null;
  riskLevel: RecoveryRiskLevel | null;
  estimatedCost: number | null;
  actualCost: number | null;
  metadata: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface RecoveryRouteOption {
  id: string;
  orgId: string;
  recoveryPlanId: string;
  optionLabel: string;
  status: string;
  totalEtaMinutes: number | null;
  totalDistance: number | null;
  segmentCount: number;
  riskLevel: RecoveryRiskLevel;
  slaCompliant: boolean;
  slaMarginMinutes: number | null;
  estimatedCost: number | null;
  score: number | null;
  scoreBreakdown: string | null;
  rejectionReason: string | null;
  metadata: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface RecoveryRouteSegment {
  id: string;
  orgId: string;
  routeOptionId: string;
  segmentOrder: number;
  origin: string;
  destination: string;
  mode: RouteSegmentMode;
  carrier: string | null;
  flightNumber: string | null;
  flightId: string | null;
  scheduledDeparture: Date | null;
  scheduledArrival: Date | null;
  estimatedDeparture: Date | null;
  estimatedArrival: Date | null;
  durationMinutes: number | null;
  connectionMinutes: number | null;
  status: RouteSegmentStatus;
  providerId: string | null;
  providerServiceId: string | null;
  cost: number | null;
  riskLevel: RecoveryRiskLevel | null;
  notes: string | null;
  metadata: string | null;
  createdAt: Date;
}

export interface RecoveryPlanVersion {
  id: string;
  orgId: string;
  recoveryPlanId: string;
  versionNumber: number;
  routeOptionId: string;
  changeReason: string;
  snapshot: string;
  createdBy: string | null;
  createdAt: Date;
}

export interface RecoveryExecution {
  id: string;
  orgId: string;
  recoveryPlanId: string;
  status: RecoveryExecutionStatus;
  externalReference: string | null;
  providerId: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
  failedAt: Date | null;
  failureReason: string | null;
  retryCount: number;
  maxRetries: number;
  metadata: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface RecoveryExecutionStep {
  id: string;
  orgId: string;
  executionId: string;
  stepOrder: number;
  stepType: string;
  description: string;
  status: RecoveryExecutionStepStatus;
  externalReference: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
  failedAt: Date | null;
  failureReason: string | null;
  metadata: string | null;
  createdAt: Date;
}

export interface RouteConstraint {
  id: string;
  orgId: string;
  recoveryPlanId: string | null;
  routeOptionId: string | null;
  constraintType: RouteConstraintType;
  severity: RouteConstraintSeverity;
  description: string;
  details: string | null;
  createdAt: Date;
}

export interface RecoveryProvider {
  id: string;
  orgId: string;
  name: string;
  description: string | null;
  coverage: string[];
  status: string;
  contactEmail: string | null;
  contactPhone: string | null;
  metadata: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProviderService {
  id: string;
  orgId: string;
  providerId: string;
  serviceName: string;
  serviceType: string;
  coverage: string[];
  estimatedDurationMinutes: number | null;
  cost: number | null;
  capacity: number | null;
  status: string;
  metadata: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface RecoveryProviderAssignment {
  id: string;
  orgId: string;
  recoveryPlanId: string;
  providerId: string;
  providerServiceId: string | null;
  assignedBy: string | null;
  assignedAt: Date;
  status: string;
  metadata: string | null;
  createdAt: Date;
}

export interface RecoveryMapView {
  planId: string;
  planNumber: string;
  status: RecoveryPlanStatus;
  baggageId: string | null;
  origin: string;
  destination: string;
  currentLocation: string | null;
  selectedRouteOptionId: string | null;
  segments: RecoveryMapSegment[];
  activeSegmentIndex: number | null;
  completedSegments: number;
  totalSegments: number;
  etaMinutes: number | null;
  riskLevel: RecoveryRiskLevel | null;
  slaRemainingMinutes: number | null;
  slaCompliant: boolean | null;
  executionStatus: RecoveryExecutionStatus | null;
}

export interface RecoveryMapSegment {
  segmentOrder: number;
  origin: string;
  destination: string;
  mode: RouteSegmentMode;
  carrier: string | null;
  flightNumber: string | null;
  status: RouteSegmentStatus;
  scheduledDeparture: Date | null;
  scheduledArrival: Date | null;
  durationMinutes: number | null;
  riskLevel: RecoveryRiskLevel | null;
}

export interface RouteScoringResult {
  score: number;
  breakdown: {
    slaCompliance: number;
    eta: number;
    operationalRisk: number;
    connectionQuality: number;
    cost: number;
    handlingCapability: number;
  };
  reasons: string[];
}

export interface RouteEvaluationResult {
  valid: boolean;
  hardConstraints: RouteConstraint[];
  softConstraints: RouteConstraint[];
  scoringResult: RouteScoringResult | null;
  slaCompliant: boolean;
  slaMarginMinutes: number | null;
}

// ─── Layer 7: Analytics & Command Center ──────────────────────────────────────

export interface MetricDefinition {
  id: string;
  orgId: string;
  metricName: string;
  displayName: string;
  description: string;
  category: MetricCategory;
  aggregationType: AnalyticsAggregationType;
  supportedDimensions: AnalyticsDimension[];
  unit: string;
  isActive: boolean;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface AnalyticsSnapshot {
  id: string;
  orgId: string;
  metricName: string;
  dimensions: Record<string, string>;
  value: number;
  previousValue: number | null;
  absoluteChange: number | null;
  percentageChange: number | null;
  periodFrom: Date;
  periodTo: Date;
  granularity: AnalyticsGranularity;
  createdAt: Date;
}

export interface AnalyticsAlertRule {
  id: string;
  orgId: string;
  ruleName: string;
  metricName: string;
  condition: string;
  threshold: number;
  severity: AlertSeverity;
  scopeDimensions: Record<string, string>;
  cooldownMinutes: number;
  isActive: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AnalyticsAlert {
  id: string;
  orgId: string;
  ruleId: string | null;
  ruleName: string;
  metricName: string;
  severity: AlertSeverity;
  status: AlertStatus;
  actualValue: number;
  threshold: number;
  scopeDimensions: Record<string, string>;
  message: string;
  acknowledgedBy: string | null;
  acknowledgedAt: Date | null;
  resolvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AnalyticsSavedView {
  id: string;
  orgId: string;
  userId: string;
  viewName: string;
  description: string | null;
  filters: Record<string, unknown>;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface AnalyticsExport {
  id: string;
  orgId: string;
  userId: string;
  exportType: string;
  format: ExportFormat;
  filters: Record<string, unknown>;
  status: string;
  fileUrl: string | null;
  rowCount: number | null;
  createdAt: Date;
  completedAt: Date | null;
}

export interface MetricValue {
  metric: string;
  value: number;
  unit: string;
  period: { from: Date; to: Date };
  scope: Record<string, string>;
  comparison?: {
    previousValue: number;
    absoluteChange: number;
    percentageChange: number;
  };
}

export interface TrendDataPoint {
  timestamp: Date;
  value: number;
  label?: string;
}

export interface TrendResult {
  metric: string;
  current: TrendDataPoint[];
  previous: TrendDataPoint[];
  summary: {
    currentValue: number;
    previousValue: number;
    absoluteChange: number;
    percentageChange: number;
  };
}

export interface CommandCenterOverview {
  activeBaggage: number;
  openCases: number;
  atRiskBaggage: number;
  criticalCases: number;
  activeRecoveryPlans: number;
  slaCompliance: number;
  transferFailures: number;
  activeAlerts: number;
  airportHealth: AirportHealthSummary[];
}

export interface AirportHealthSummary {
  airportCode: string;
  airportName: string;
  overallHealth: number;
  transferPerformance: number;
  slaCompliance: number;
  recoveryPerformance: number;
  providerPerformance: number;
  systemReliability: number;
}

export interface CaseAnalyticsSummary {
  totalCases: number;
  openCases: number;
  closedCases: number;
  casesByType: Record<string, number>;
  casesByPriority: Record<string, number>;
  casesByStatus: Record<string, number>;
  averageResolutionMinutes: number | null;
  slaComplianceRate: number;
  agingDistribution: { label: string; count: number }[];
}

export interface RecoveryAnalyticsSummary {
  totalPlans: number;
  activePlans: number;
  completedPlans: number;
  failedPlans: number;
  averageRecoveryMinutes: number | null;
  slaComplianceRate: number;
  successRate: number;
  plansByType: Record<string, number>;
}

export interface RouteAnalyticsSummary {
  totalRoutes: number;
  averageScore: number;
  averageEta: number | null;
  slaComplianceRate: number;
  riskDistribution: Record<string, number>;
  constraintFailureRate: number;
  successRate: number;
}

export interface ProviderAnalyticsSummary {
  totalProviders: number;
  activeProviders: number;
  totalAssignments: number;
  completionRate: number;
  failureRate: number;
  averageCompletionMinutes: number | null;
  slaComplianceRate: number;
}

export interface SLAAnalyticsSummary {
  totalEligible: number;
  compliant: number;
  breached: number;
  complianceRate: number;
  byAirport: Record<string, { eligible: number; compliant: number; rate: number }>;
  byProvider: Record<string, { eligible: number; compliant: number; rate: number }>;
}
