export const BAGGAGE_STATES = [
  'registered',
  'checked_in',
  'screened',
  'loaded',
  'in_transit',
  'unloaded',
  'atcarousel',
  'delivered',
  'missing',
  'delayed',
  'damaged',
  'misrouted',
  'recovered',
] as const;

export const BAGGAGE_PRIORITIES = ['low', 'normal', 'high', 'urgent'] as const;

export const EVENT_TYPES = [
  'bag_accepted',
  'bag_screened',
  'bag_loaded',
  'bag_unloaded',
  'bag_transferred',
  'bag_delivered',
  'bag_missing',
  'bag_delayed',
  'bag_damaged',
  'bag_misrouted',
  'bag_recovered',
] as const;

export const CASE_TYPES = [
  'missing',
  'delayed',
  'damaged',
  'misrouted',
  'tag_failure',
  'transfer_failure',
  'delivery_failure',
  'security_exception',
  'disruption',
  'system_exception',
  'custody_exception',
  'location_exception',
  'unexpected_event',
  'other',
] as const;

export const CASE_PRIORITIES = ['low', 'medium', 'high', 'critical'] as const;

export const CASE_STATUSES = [
  'open',
  'triaged',
  'assigned',
  'investigating',
  'action_required',
  'in_progress',
  'pending_external',
  'resolved',
  'closed',
  'cancelled',
  'duplicate',
] as const;

export const CASE_RESOLUTION_CODES = [
  'bag_found',
  'delivered',
  'transfer_completed',
  'duplicate',
  'false_alarm',
  'customer_contacted',
  'unresolved',
  'cancelled',
  'system_fixed',
  'other',
] as const;

export const CASE_SOURCES = [
  'exception',
  'operator',
  'traveler',
  'system_rule',
  'integration',
  'ai_recommendation',
] as const;

export const TASK_TYPES = [
  'investigate',
  'locate',
  'deliver',
  'transfer',
  'contact_passenger',
  'update_status',
  'escalate',
  'verify_last_scan',
  'locate_bag',
  'arrange_recovery',
  'confirm_delivery',
  'arrange_transfer',
  'verify_custody',
  'investigate_root_cause',
  'contact_airport',
  'contact_airline',
  'provide_evidence',
  'update_passenger',
  'other',
] as const;

export const TASK_STATUSES = [
  'pending',
  'assigned',
  'in_progress',
  'blocked',
  'completed',
  'cancelled',
] as const;

export const CASE_ACTIVITY_TYPES = [
  'case_created',
  'case_assigned',
  'case_reassigned',
  'case_status_changed',
  'case_priority_changed',
  'case_commented',
  'task_created',
  'task_assigned',
  'task_completed',
  'sla_started',
  'sla_paused',
  'sla_resumed',
  'sla_warning',
  'sla_breached',
  'case_escalated',
  'case_resolved',
  'case_reopened',
  'case_closed',
] as const;

export const RESOLUTION_CODES = [
  'bag_found',
  'delivered',
  'transfer_completed',
  'duplicate',
  'false_alarm',
  'customer_contacted',
  'unresolved',
  'cancelled',
  'system_fixed',
  'other',
] as const;

export const ORG_TYPES = [
  'airline',
  'airport',
  'ground_handler',
  'recovery_provider',
  'partner',
] as const;

export const ORG_ROLES = ['admin', 'operator', 'viewer'] as const;

export const HANDOVER_TYPES = [
  'airline_to_airport',
  'airport_to_ground_handler',
  'ground_handler_to_ground_handler',
  'airline_to_airline',
] as const;

export const FLIGHT_STATUSES = [
  'scheduled',
  'boarding',
  'departed',
  'in_flight',
  'landed',
  'arrived',
  'cancelled',
  'diverted',
  'delayed',
] as const;

export const NOTIFICATION_TYPES = [
  'baggage_update',
  'case_assignment',
  'task_assignment',
  'system_alert',
  'integration_alert',
] as const;

export const NOTIFICATION_SEVERITIES = ['info', 'warning', 'error', 'critical'] as const;

// ─── Layer 2: Identity, Organizations & Access ───

export const PERMISSION_RESOURCES = [
  'user',
  'role',
  'organization',
  'membership',
  'baggage',
  'baggage:event',
  'case',
  'task',
  'route',
  'integration',
  'analytics',
  'audit',
  'notification',
  'permission',
  'invitation',
  'service_identity',
  'access_policy',
] as const;

export const PERMISSION_ACTIONS = [
  'read',
  'create',
  'update',
  'delete',
  'assign',
  'execute',
  'approve',
  'escalate',
  'close',
  'reopen',
  'reassign',
  'suspend',
  'revoke',
  'recommend',
  'correct',
  'grant',
  'manage',
] as const;

export const PERMISSIONS = {
  // User management
  USER_READ: 'user:read',
  USER_CREATE: 'user:create',
  USER_UPDATE: 'user:update',
  USER_SUSPEND: 'user:suspend',

  // Role management
  ROLE_READ: 'role:read',
  ROLE_CREATE: 'role:create',
  ROLE_UPDATE: 'role:update',
  ROLE_DELETE: 'role:delete',
  ROLE_GRANT: 'role:grant',

  // Organization
  ORG_CREATE: 'organization:create',
  ORG_READ: 'organization:read',
  ORG_UPDATE: 'organization:update',
  ORG_DELETE: 'organization:delete',
  ORG_MANAGE: 'organization:manage',

  // Membership
  MEMBERSHIP_READ: 'membership:read',
  MEMBERSHIP_CREATE: 'membership:create',
  MEMBERSHIP_UPDATE: 'membership:update',
  MEMBERSHIP_DELETE: 'membership:delete',

  // Baggage
  BAGGAGE_READ: 'baggage:read',
  BAGGAGE_CREATE: 'baggage:create',
  BAGGAGE_UPDATE: 'baggage:update',
  BAGGAGE_DELETE: 'baggage:delete',

  // Baggage events
  BAGGAGE_EVENT_READ: 'baggage:event:read',
  BAGGAGE_EVENT_CREATE: 'baggage:event:create',
  BAGGAGE_EVENT_CORRECT: 'baggage:event:correct',

  // Cases
  CASE_READ: 'case:read',
  CASE_CREATE: 'case:create',
  CASE_UPDATE: 'case:update',
  CASE_ASSIGN: 'case:assign',
  CASE_REASSIGN: 'case:reassign',
  CASE_REOPEN: 'case:reopen',
  CASE_ESCALATE: 'case:escalate',
  CASE_CLOSE: 'case:close',

  // Tasks
  TASK_READ: 'task:read',
  TASK_CREATE: 'task:create',
  TASK_UPDATE: 'task:update',
  TASK_ASSIGN: 'task:assign',
  TASK_COMPLETE: 'task:complete',

  // Routes
  ROUTE_READ: 'route:read',
  ROUTE_CREATE: 'route:create',
  ROUTE_APPROVE: 'route:approve',
  ROUTE_EXECUTE: 'route:execute',

  // Integrations
  INTEGRATION_READ: 'integration:read',
  INTEGRATION_CREATE: 'integration:create',
  INTEGRATION_UPDATE: 'integration:update',
  INTEGRATION_DELETE: 'integration:delete',

  // Analytics
  ANALYTICS_READ: 'analytics:read',

  // Audit
  AUDIT_READ: 'audit:read',

  // Notifications
  NOTIFICATION_READ: 'notification:read',

  // Permissions
  PERMISSION_GRANT: 'permission:grant',

  // Invitations
  INVITATION_CREATE: 'invitation:create',
  INVITATION_READ: 'invitation:read',

  // Service identities
  SERVICE_IDENTITY_READ: 'service_identity:read',
  SERVICE_IDENTITY_CREATE: 'service_identity:create',
  SERVICE_IDENTITY_UPDATE: 'service_identity:update',
  SERVICE_IDENTITY_DELETE: 'service_identity:delete',

  // Access policies
  ACCESS_POLICY_READ: 'access_policy:read',
  ACCESS_POLICY_CREATE: 'access_policy:create',
  ACCESS_POLICY_UPDATE: 'access_policy:update',
  ACCESS_POLICY_DELETE: 'access_policy:delete',

  // Layer 6: Recovery & Routing
  RECOVERY_PLAN_READ: 'recovery_plan:read',
  RECOVERY_PLAN_CREATE: 'recovery_plan:create',
  RECOVERY_PLAN_UPDATE: 'recovery_plan:update',
  RECOVERY_PLAN_DELETE: 'recovery_plan:delete',
  RECOVERY_PLAN_APPROVE: 'recovery_plan:approve',
  RECOVERY_PLAN_EXECUTE: 'recovery_plan:execute',
  ROUTE_OPTION_READ: 'route_option:read',
  ROUTE_OPTION_CREATE: 'route_option:create',
  ROUTE_OPTION_SELECT: 'route_option:select',
  RECOVERY_PROVIDER_READ: 'recovery_provider:read',
  RECOVERY_PROVIDER_CREATE: 'recovery_provider:create',
  RECOVERY_PROVIDER_UPDATE: 'recovery_provider:update',
  RECOVERY_PROVIDER_DELETE: 'recovery_provider:delete',

  // Layer 7: Analytics & Command Center
  ANALYTICS_VIEW: 'analytics:view',
  ANALYTICS_EXPORT: 'analytics:export',
  ANALYTICS_MANAGE: 'analytics:manage',
  COMMAND_CENTER_VIEW: 'command_center:view',
  ANALYTICS_ALERT_VIEW: 'analytics_alert:view',
  ANALYTICS_ALERT_ACKNOWLEDGE: 'analytics_alert:acknowledge',
  ANALYTICS_ALERT_DISMISS: 'analytics_alert:dismiss',
  ANALYTICS_SAVED_VIEW_CREATE: 'analytics_saved_view:create',
  ANALYTICS_SAVED_VIEW_MANAGE: 'analytics_saved_view:manage',
  ANALYTICS_REPORT_VIEW: 'analytics_report:view',
  ANALYTICS_REPORT_CREATE: 'analytics_report:create',
} as const;

export const LAYER2_ROLES = {
  TRAVELER: 'traveler',
  BAGGAGE_AGENT: 'baggage_agent',
  RECOVERY_AGENT: 'recovery_agent',
  OPERATIONS_SUPERVISOR: 'operations_supervisor',
  OPERATIONS_MANAGER: 'operations_manager',
  AIRLINE_ADMIN: 'airline_admin',
  AIRPORT_ADMIN: 'airport_admin',
  INTEGRATION_ADMIN: 'integration_admin',
  SUPER_ADMIN: 'super_admin',
} as const;

export const ORG_ROLE_PERMISSIONS: Record<string, readonly string[]> = {
  [LAYER2_ROLES.TRAVELER]: [
    PERMISSIONS.BAGGAGE_READ,
    PERMISSIONS.CASE_READ,
    PERMISSIONS.NOTIFICATION_READ,
  ],
  [LAYER2_ROLES.BAGGAGE_AGENT]: [
    PERMISSIONS.BAGGAGE_READ,
    PERMISSIONS.BAGGAGE_UPDATE,
    PERMISSIONS.BAGGAGE_EVENT_READ,
    PERMISSIONS.BAGGAGE_EVENT_CREATE,
    PERMISSIONS.TASK_READ,
    PERMISSIONS.TASK_UPDATE,
    PERMISSIONS.TASK_COMPLETE,
    PERMISSIONS.CASE_READ,
    PERMISSIONS.NOTIFICATION_READ,
  ],
  [LAYER2_ROLES.RECOVERY_AGENT]: [
    PERMISSIONS.BAGGAGE_READ,
    PERMISSIONS.CASE_READ,
    PERMISSIONS.CASE_UPDATE,
    PERMISSIONS.TASK_READ,
    PERMISSIONS.TASK_UPDATE,
    PERMISSIONS.TASK_COMPLETE,
    PERMISSIONS.NOTIFICATION_READ,
    PERMISSIONS.RECOVERY_PLAN_READ,
    PERMISSIONS.RECOVERY_PLAN_CREATE,
    PERMISSIONS.RECOVERY_PLAN_UPDATE,
    PERMISSIONS.ROUTE_OPTION_READ,
    PERMISSIONS.ROUTE_OPTION_CREATE,
    PERMISSIONS.ROUTE_OPTION_SELECT,
    PERMISSIONS.RECOVERY_PROVIDER_READ,
  ],
  [LAYER2_ROLES.OPERATIONS_SUPERVISOR]: [
    PERMISSIONS.BAGGAGE_READ,
    PERMISSIONS.CASE_READ,
    PERMISSIONS.CASE_CREATE,
    PERMISSIONS.CASE_UPDATE,
    PERMISSIONS.CASE_ASSIGN,
    PERMISSIONS.CASE_REASSIGN,
    PERMISSIONS.TASK_READ,
    PERMISSIONS.TASK_CREATE,
    PERMISSIONS.TASK_UPDATE,
    PERMISSIONS.TASK_ASSIGN,
    PERMISSIONS.TASK_COMPLETE,
    PERMISSIONS.ANALYTICS_READ,
    PERMISSIONS.NOTIFICATION_READ,
    PERMISSIONS.RECOVERY_PLAN_READ,
    PERMISSIONS.RECOVERY_PLAN_CREATE,
    PERMISSIONS.RECOVERY_PLAN_UPDATE,
    PERMISSIONS.RECOVERY_PLAN_APPROVE,
    PERMISSIONS.ROUTE_OPTION_READ,
    PERMISSIONS.ROUTE_OPTION_CREATE,
    PERMISSIONS.ROUTE_OPTION_SELECT,
    PERMISSIONS.RECOVERY_PROVIDER_READ,
    PERMISSIONS.RECOVERY_PROVIDER_CREATE,
    PERMISSIONS.ANALYTICS_VIEW,
    PERMISSIONS.ANALYTICS_EXPORT,
    PERMISSIONS.COMMAND_CENTER_VIEW,
    PERMISSIONS.ANALYTICS_ALERT_VIEW,
    PERMISSIONS.ANALYTICS_ALERT_ACKNOWLEDGE,
    PERMISSIONS.ANALYTICS_SAVED_VIEW_CREATE,
    PERMISSIONS.ANALYTICS_REPORT_VIEW,
  ],
  [LAYER2_ROLES.OPERATIONS_MANAGER]: [
    PERMISSIONS.BAGGAGE_READ,
    PERMISSIONS.BAGGAGE_CREATE,
    PERMISSIONS.BAGGAGE_UPDATE,
    PERMISSIONS.BAGGAGE_EVENT_READ,
    PERMISSIONS.BAGGAGE_EVENT_CREATE,
    PERMISSIONS.CASE_READ,
    PERMISSIONS.CASE_CREATE,
    PERMISSIONS.CASE_UPDATE,
    PERMISSIONS.CASE_ASSIGN,
    PERMISSIONS.CASE_REASSIGN,
    PERMISSIONS.CASE_REOPEN,
    PERMISSIONS.CASE_ESCALATE,
    PERMISSIONS.CASE_CLOSE,
    PERMISSIONS.TASK_READ,
    PERMISSIONS.TASK_CREATE,
    PERMISSIONS.TASK_UPDATE,
    PERMISSIONS.TASK_ASSIGN,
    PERMISSIONS.TASK_COMPLETE,
    PERMISSIONS.ROUTE_READ,
    PERMISSIONS.ANALYTICS_READ,
    PERMISSIONS.AUDIT_READ,
    PERMISSIONS.NOTIFICATION_READ,
    PERMISSIONS.USER_READ,
    PERMISSIONS.MEMBERSHIP_READ,
    PERMISSIONS.RECOVERY_PLAN_READ,
    PERMISSIONS.RECOVERY_PLAN_CREATE,
    PERMISSIONS.RECOVERY_PLAN_UPDATE,
    PERMISSIONS.RECOVERY_PLAN_APPROVE,
    PERMISSIONS.RECOVERY_PLAN_EXECUTE,
    PERMISSIONS.ROUTE_OPTION_READ,
    PERMISSIONS.ROUTE_OPTION_CREATE,
    PERMISSIONS.ROUTE_OPTION_SELECT,
    PERMISSIONS.RECOVERY_PROVIDER_READ,
    PERMISSIONS.RECOVERY_PROVIDER_CREATE,
    PERMISSIONS.RECOVERY_PROVIDER_UPDATE,
    PERMISSIONS.ANALYTICS_VIEW,
    PERMISSIONS.ANALYTICS_EXPORT,
    PERMISSIONS.ANALYTICS_MANAGE,
    PERMISSIONS.COMMAND_CENTER_VIEW,
    PERMISSIONS.ANALYTICS_ALERT_VIEW,
    PERMISSIONS.ANALYTICS_ALERT_ACKNOWLEDGE,
    PERMISSIONS.ANALYTICS_ALERT_DISMISS,
    PERMISSIONS.ANALYTICS_SAVED_VIEW_CREATE,
    PERMISSIONS.ANALYTICS_SAVED_VIEW_MANAGE,
    PERMISSIONS.ANALYTICS_REPORT_VIEW,
    PERMISSIONS.ANALYTICS_REPORT_CREATE,
  ],
  [LAYER2_ROLES.AIRLINE_ADMIN]: [
    PERMISSIONS.USER_READ,
    PERMISSIONS.USER_CREATE,
    PERMISSIONS.USER_UPDATE,
    PERMISSIONS.USER_SUSPEND,
    PERMISSIONS.ROLE_READ,
    PERMISSIONS.ROLE_CREATE,
    PERMISSIONS.ROLE_UPDATE,
    PERMISSIONS.ROLE_GRANT,
    PERMISSIONS.ORG_READ,
    PERMISSIONS.ORG_UPDATE,
    PERMISSIONS.ORG_MANAGE,
    PERMISSIONS.MEMBERSHIP_READ,
    PERMISSIONS.MEMBERSHIP_CREATE,
    PERMISSIONS.MEMBERSHIP_UPDATE,
    PERMISSIONS.MEMBERSHIP_DELETE,
    PERMISSIONS.INVITATION_CREATE,
    PERMISSIONS.INVITATION_READ,
    PERMISSIONS.BAGGAGE_READ,
    PERMISSIONS.BAGGAGE_CREATE,
    PERMISSIONS.BAGGAGE_UPDATE,
    PERMISSIONS.BAGGAGE_EVENT_READ,
    PERMISSIONS.BAGGAGE_EVENT_CREATE,
    PERMISSIONS.CASE_READ,
    PERMISSIONS.CASE_CREATE,
    PERMISSIONS.CASE_UPDATE,
    PERMISSIONS.CASE_ASSIGN,
    PERMISSIONS.CASE_REASSIGN,
    PERMISSIONS.CASE_REOPEN,
    PERMISSIONS.CASE_ESCALATE,
    PERMISSIONS.CASE_CLOSE,
    PERMISSIONS.TASK_READ,
    PERMISSIONS.TASK_CREATE,
    PERMISSIONS.TASK_UPDATE,
    PERMISSIONS.TASK_ASSIGN,
    PERMISSIONS.TASK_COMPLETE,
    PERMISSIONS.ROUTE_READ,
    PERMISSIONS.ROUTE_CREATE,
    PERMISSIONS.INTEGRATION_READ,
    PERMISSIONS.INTEGRATION_CREATE,
    PERMISSIONS.INTEGRATION_UPDATE,
    PERMISSIONS.ANALYTICS_READ,
    PERMISSIONS.AUDIT_READ,
    PERMISSIONS.NOTIFICATION_READ,
    PERMISSIONS.RECOVERY_PLAN_READ,
    PERMISSIONS.RECOVERY_PLAN_CREATE,
    PERMISSIONS.RECOVERY_PLAN_UPDATE,
    PERMISSIONS.RECOVERY_PLAN_APPROVE,
    PERMISSIONS.ROUTE_OPTION_READ,
    PERMISSIONS.ROUTE_OPTION_CREATE,
    PERMISSIONS.ROUTE_OPTION_SELECT,
    PERMISSIONS.RECOVERY_PROVIDER_READ,
    PERMISSIONS.RECOVERY_PROVIDER_CREATE,
    PERMISSIONS.RECOVERY_PROVIDER_UPDATE,
    PERMISSIONS.ANALYTICS_VIEW,
    PERMISSIONS.ANALYTICS_EXPORT,
    PERMISSIONS.ANALYTICS_MANAGE,
    PERMISSIONS.COMMAND_CENTER_VIEW,
    PERMISSIONS.ANALYTICS_ALERT_VIEW,
    PERMISSIONS.ANALYTICS_ALERT_ACKNOWLEDGE,
    PERMISSIONS.ANALYTICS_SAVED_VIEW_CREATE,
    PERMISSIONS.ANALYTICS_REPORT_VIEW,
    PERMISSIONS.ANALYTICS_REPORT_CREATE,
  ],
  [LAYER2_ROLES.AIRPORT_ADMIN]: [
    PERMISSIONS.USER_READ,
    PERMISSIONS.USER_CREATE,
    PERMISSIONS.USER_UPDATE,
    PERMISSIONS.ROLE_READ,
    PERMISSIONS.ROLE_GRANT,
    PERMISSIONS.ORG_READ,
    PERMISSIONS.ORG_UPDATE,
    PERMISSIONS.MEMBERSHIP_READ,
    PERMISSIONS.MEMBERSHIP_CREATE,
    PERMISSIONS.MEMBERSHIP_UPDATE,
    PERMISSIONS.INVITATION_CREATE,
    PERMISSIONS.INVITATION_READ,
    PERMISSIONS.BAGGAGE_READ,
    PERMISSIONS.BAGGAGE_EVENT_READ,
    PERMISSIONS.CASE_READ,
    PERMISSIONS.CASE_CREATE,
    PERMISSIONS.CASE_UPDATE,
    PERMISSIONS.CASE_ASSIGN,
    PERMISSIONS.TASK_READ,
    PERMISSIONS.TASK_CREATE,
    PERMISSIONS.TASK_UPDATE,
    PERMISSIONS.ANALYTICS_READ,
    PERMISSIONS.AUDIT_READ,
    PERMISSIONS.NOTIFICATION_READ,
    PERMISSIONS.RECOVERY_PLAN_READ,
    PERMISSIONS.RECOVERY_PLAN_CREATE,
    PERMISSIONS.RECOVERY_PLAN_UPDATE,
    PERMISSIONS.ROUTE_OPTION_READ,
    PERMISSIONS.ROUTE_OPTION_CREATE,
    PERMISSIONS.RECOVERY_PROVIDER_READ,
    PERMISSIONS.ANALYTICS_VIEW,
    PERMISSIONS.ANALYTICS_EXPORT,
    PERMISSIONS.COMMAND_CENTER_VIEW,
    PERMISSIONS.ANALYTICS_ALERT_VIEW,
    PERMISSIONS.ANALYTICS_ALERT_ACKNOWLEDGE,
    PERMISSIONS.ANALYTICS_SAVED_VIEW_CREATE,
  ],
  [LAYER2_ROLES.INTEGRATION_ADMIN]: [
    PERMISSIONS.INTEGRATION_READ,
    PERMISSIONS.INTEGRATION_CREATE,
    PERMISSIONS.INTEGRATION_UPDATE,
    PERMISSIONS.INTEGRATION_DELETE,
    PERMISSIONS.SERVICE_IDENTITY_READ,
    PERMISSIONS.SERVICE_IDENTITY_CREATE,
    PERMISSIONS.SERVICE_IDENTITY_UPDATE,
    PERMISSIONS.SERVICE_IDENTITY_DELETE,
    PERMISSIONS.ORG_READ,
    PERMISSIONS.AUDIT_READ,
  ],
  [LAYER2_ROLES.SUPER_ADMIN]: [
    PERMISSIONS.USER_READ,
    PERMISSIONS.USER_CREATE,
    PERMISSIONS.USER_UPDATE,
    PERMISSIONS.USER_SUSPEND,
    PERMISSIONS.ROLE_READ,
    PERMISSIONS.ROLE_CREATE,
    PERMISSIONS.ROLE_UPDATE,
    PERMISSIONS.ROLE_DELETE,
    PERMISSIONS.ROLE_GRANT,
    PERMISSIONS.ORG_READ,
    PERMISSIONS.ORG_UPDATE,
    PERMISSIONS.ORG_DELETE,
    PERMISSIONS.ORG_MANAGE,
    PERMISSIONS.MEMBERSHIP_READ,
    PERMISSIONS.MEMBERSHIP_CREATE,
    PERMISSIONS.MEMBERSHIP_UPDATE,
    PERMISSIONS.MEMBERSHIP_DELETE,
    PERMISSIONS.BAGGAGE_READ,
    PERMISSIONS.BAGGAGE_CREATE,
    PERMISSIONS.BAGGAGE_UPDATE,
    PERMISSIONS.BAGGAGE_DELETE,
    PERMISSIONS.BAGGAGE_EVENT_READ,
    PERMISSIONS.BAGGAGE_EVENT_CREATE,
    PERMISSIONS.BAGGAGE_EVENT_CORRECT,
    PERMISSIONS.CASE_READ,
    PERMISSIONS.CASE_CREATE,
    PERMISSIONS.CASE_UPDATE,
    PERMISSIONS.CASE_ASSIGN,
    PERMISSIONS.CASE_REASSIGN,
    PERMISSIONS.CASE_REOPEN,
    PERMISSIONS.CASE_ESCALATE,
    PERMISSIONS.CASE_CLOSE,
    PERMISSIONS.TASK_READ,
    PERMISSIONS.TASK_CREATE,
    PERMISSIONS.TASK_UPDATE,
    PERMISSIONS.TASK_ASSIGN,
    PERMISSIONS.TASK_COMPLETE,
    PERMISSIONS.ROUTE_READ,
    PERMISSIONS.ROUTE_CREATE,
    PERMISSIONS.ROUTE_APPROVE,
    PERMISSIONS.ROUTE_EXECUTE,
    PERMISSIONS.INTEGRATION_READ,
    PERMISSIONS.INTEGRATION_CREATE,
    PERMISSIONS.INTEGRATION_UPDATE,
    PERMISSIONS.INTEGRATION_DELETE,
    PERMISSIONS.ANALYTICS_READ,
    PERMISSIONS.AUDIT_READ,
    PERMISSIONS.NOTIFICATION_READ,
    PERMISSIONS.PERMISSION_GRANT,
    PERMISSIONS.INVITATION_CREATE,
    PERMISSIONS.INVITATION_READ,
    PERMISSIONS.SERVICE_IDENTITY_READ,
    PERMISSIONS.SERVICE_IDENTITY_CREATE,
    PERMISSIONS.SERVICE_IDENTITY_UPDATE,
    PERMISSIONS.SERVICE_IDENTITY_DELETE,
    PERMISSIONS.ACCESS_POLICY_READ,
    PERMISSIONS.ACCESS_POLICY_CREATE,
    PERMISSIONS.ACCESS_POLICY_UPDATE,
    PERMISSIONS.ACCESS_POLICY_DELETE,
    PERMISSIONS.RECOVERY_PLAN_READ,
    PERMISSIONS.RECOVERY_PLAN_CREATE,
    PERMISSIONS.RECOVERY_PLAN_UPDATE,
    PERMISSIONS.RECOVERY_PLAN_DELETE,
    PERMISSIONS.RECOVERY_PLAN_APPROVE,
    PERMISSIONS.RECOVERY_PLAN_EXECUTE,
    PERMISSIONS.ROUTE_OPTION_READ,
    PERMISSIONS.ROUTE_OPTION_CREATE,
    PERMISSIONS.ROUTE_OPTION_SELECT,
    PERMISSIONS.RECOVERY_PROVIDER_READ,
    PERMISSIONS.RECOVERY_PROVIDER_CREATE,
    PERMISSIONS.RECOVERY_PROVIDER_UPDATE,
    PERMISSIONS.RECOVERY_PROVIDER_DELETE,
    PERMISSIONS.ANALYTICS_VIEW,
    PERMISSIONS.ANALYTICS_EXPORT,
    PERMISSIONS.ANALYTICS_MANAGE,
    PERMISSIONS.COMMAND_CENTER_VIEW,
    PERMISSIONS.ANALYTICS_ALERT_VIEW,
    PERMISSIONS.ANALYTICS_ALERT_ACKNOWLEDGE,
    PERMISSIONS.ANALYTICS_ALERT_DISMISS,
    PERMISSIONS.ANALYTICS_SAVED_VIEW_CREATE,
    PERMISSIONS.ANALYTICS_SAVED_VIEW_MANAGE,
    PERMISSIONS.ANALYTICS_REPORT_VIEW,
    PERMISSIONS.ANALYTICS_REPORT_CREATE,
  ],
} as const;

export const MEMBERSHIP_STATUSES = ['invited', 'active', 'suspended', 'revoked'] as const;

export const INVITATION_STATUSES = ['pending', 'accepted', 'expired', 'revoked'] as const;

export const SERVICE_IDENTITY_TYPES = ['scanner', 'integration', 'worker', 'ai', 'external'] as const;

export const ORG_RELATIONSHIP_TYPES = [
  'parent_child',
  'partnership',
  'service_agreement',
] as const;

export const HIGH_IMPACT_PERMISSIONS = [
  PERMISSIONS.ROUTE_EXECUTE,
  PERMISSIONS.ROUTE_APPROVE,
  PERMISSIONS.BAGGAGE_EVENT_CORRECT,
  PERMISSIONS.CASE_CLOSE,
  PERMISSIONS.CASE_ESCALATE,
  PERMISSIONS.USER_SUSPEND,
  PERMISSIONS.ROLE_GRANT,
  PERMISSIONS.ORG_DELETE,
  PERMISSIONS.INTEGRATION_DELETE,
  PERMISSIONS.PERMISSION_GRANT,
] as const;

// ─── Layer 3: Integration & Data Normalization ───

export const INTEGRATION_TYPES = [
  'rest_api',
  'webhook',
  'polling',
  'csv',
  'sftp',
  'scanner',
  'aviation_messaging',
] as const;

export const INTEGRATION_STATUS = [
  'configuring',
  'active',
  'paused',
  'failing',
  'disabled',
  'revoked',
] as const;

export const INTEGRATION_PROVIDERS = [
  'generic',
  'etihad',
  'sabre',
  'amadeus',
  'sita',
  'bagtag',
  'custom',
] as const;

export const INTEGRATION_EVENT_STATUS = [
  'received',
  'validating',
  'mapping',
  'normalizing',
  'processing',
  'processed',
  'failed',
  'quarantined',
  'duplicate_ignored',
  'pending_resolution',
] as const;

export const CANONICAL_EVENT_TYPES = [
  'baggage_registered',
  'baggage_checked_in',
  'baggage_screened',
  'baggage_loaded',
  'baggage_unloaded',
  'baggage_transferred',
  'baggage_delivered',
  'baggage_missing',
  'baggage_delayed',
  'baggage_damaged',
  'baggage_misrouted',
  'baggage_recovered',
  'flight_scheduled',
  'flight_departed',
  'flight_arrived',
  'flight_cancelled',
  'flight_diverted',
  'flight_delayed',
] as const;

export const DEFAULT_EVENT_TYPE_MAP: Record<string, string> = {
  BAG_ACCEPTED: 'baggage_checked_in',
  BAG_CHECKED_IN: 'baggage_checked_in',
  BAG_SCREENED: 'baggage_screened',
  BAG_LOADED: 'baggage_loaded',
  BAG_UNLOADED: 'baggage_unloaded',
  BAG_TRANSFERRED: 'baggage_transferred',
  BAG_DELIVERED: 'baggage_delivered',
  BAG_MISSING: 'baggage_missing',
  BAG_DELAYED: 'baggage_delayed',
  BAG_DAMAGED: 'baggage_damaged',
  BAG_MISROUTED: 'baggage_misrouted',
  BAG_RECOVERED: 'baggage_recovered',
  LOAD: 'baggage_loaded',
  UNLOAD: 'baggage_unloaded',
  TRANSFER: 'baggage_transferred',
  DELIVER: 'baggage_delivered',
  ACCEPT: 'baggage_checked_in',
  SCREEN: 'baggage_screened',
  MISSING: 'baggage_missing',
  DELAYED: 'baggage_delayed',
  DAMAGED: 'baggage_damaged',
  MISROUTED: 'baggage_misrouted',
  RECOVERED: 'baggage_recovered',
  FLIGHT_SCHEDULED: 'flight_scheduled',
  FLIGHT_DEPARTED: 'flight_departed',
  FLIGHT_ARRIVED: 'flight_arrived',
  FLIGHT_CANCELLED: 'flight_cancelled',
  FLIGHT_DIVERTED: 'flight_diverted',
  FLIGHT_DELAYED: 'flight_delayed',
};

export const OUTBOUND_DELIVERY_STATUS = [
  'pending',
  'sending',
  'delivered',
  'failed',
  'retrying',
] as const;

export const ENTITY_TYPES = [
  'baggage',
  'flight',
  'airport',
  'airline',
  'journey',
  'case',
] as const;

export const DATA_CLASSIFICATIONS = [
  'public',
  'operational',
  'confidential',
  'sensitive',
  'restricted',
] as const;

export const INTEGRATION_PERMISSIONS = [
  PERMISSIONS.INTEGRATION_READ,
  PERMISSIONS.INTEGRATION_CREATE,
  PERMISSIONS.INTEGRATION_UPDATE,
  PERMISSIONS.INTEGRATION_DELETE,
] as const;

export const MAX_WEBHOOK_PAYLOAD_SIZE = 5 * 1024 * 1024; // 5MB
export const WEBHOOK_TIMESTAMP_TOLERANCE_SECONDS = 300; // 5 minutes
export const MAX_INTEGRATION_RETRIES = 3;
export const INTEGRATION_RETRY_BACKOFF_MS = 2000;

// ─── Layer 4: Operations & Event Engine ───

export const OPERATIONAL_EVENT_TYPES = [
  'baggage_created',
  'baggage_accepted',
  'baggage_screened',
  'baggage_sorted',
  'baggage_loaded',
  'baggage_unloaded',
  'baggage_transferred',
  'baggage_arrived',
  'baggage_delivered',
  'baggage_rejected',
  'baggage_mishandled',
  'baggage_found',
  'baggage_released',
  'baggage_handover',
  'baggage_custody_changed',
  'baggage_location_changed',
  'event_corrected',
] as const;

export const BAGGAGE_LIFECYCLE_STATES = [
  'created',
  'accepted',
  'screened',
  'sorted',
  'loaded',
  'in_transit',
  'unloaded',
  'arrived',
  'transfer_pending',
  'transferred',
  'delivery_pending',
  'delivered',
  'rejected',
  'mishandled',
  'found',
  'released',
] as const;

export const BAGGAGE_STATE_TRANSITIONS: Record<string, readonly string[]> = {
  created: ['accepted', 'rejected'],
  accepted: ['screened', 'rejected'],
  screened: ['sorted', 'loaded'],
  sorted: ['loaded'],
  loaded: ['in_transit', 'unloaded'],
  in_transit: ['unloaded', 'arrived'],
  unloaded: ['sorted', 'loaded', 'transfer_pending', 'delivery_pending', 'arrived'],
  arrived: ['transfer_pending', 'delivery_pending', 'sorted', 'loaded'],
  transfer_pending: ['transferred', 'loaded', 'mishandled'],
  transferred: ['loaded', 'in_transit', 'delivery_pending', 'transfer_pending'],
  delivery_pending: ['delivered', 'found', 'mishandled'],
  delivered: ['found'],
  rejected: [],
  mishandled: ['found', 'released'],
  found: ['delivered', 'released', 'loaded', 'transfer_pending'],
  released: [],
};

export const OPERATIONAL_EVENT_TO_STATE: Record<string, string> = {
  baggage_created: 'created',
  baggage_accepted: 'accepted',
  baggage_screened: 'screened',
  baggage_sorted: 'sorted',
  baggage_loaded: 'loaded',
  baggage_unloaded: 'unloaded',
  baggage_transferred: 'transferred',
  baggage_arrived: 'arrived',
  baggage_delivered: 'delivered',
  baggage_rejected: 'rejected',
  baggage_mishandled: 'mishandled',
  baggage_found: 'found',
  baggage_released: 'released',
  baggage_handover: null as unknown as string,
  baggage_custody_changed: null as unknown as string,
  baggage_location_changed: null as unknown as string,
  event_corrected: null as unknown as string,
};

export const EVENT_SOURCES = [
  'external_integration',
  'scanner',
  'manual_operator',
  'system',
  'recovery',
  'correction',
] as const;

export const ACTOR_TYPES = [
  'user',
  'scanner',
  'system',
  'integration',
  'service',
] as const;

export const OPERATIONAL_EXCEPTION_TYPES = [
  'expected_event_missing',
  'unexpected_event',
  'invalid_transition',
  'location_mismatch',
  'custody_mismatch',
  'duplicate_operational_event',
  'out_of_sequence_event',
  'expectation_expired',
] as const;

export const EXCEPTION_SEVERITIES = [
  'info',
  'warning',
  'error',
  'critical',
] as const;

export const CUSTODY_PARTY_TYPES = [
  'airline',
  'airport',
  'ground_handler',
  'transfer_team',
  'recovery_provider',
  'delivery_provider',
  'traveler',
  'system',
] as const;

export const HANDOVER_STATES = [
  'pending',
  'started',
  'bag_verified',
  'receiver_confirmed',
  'completed',
  'failed',
] as const;

export const EXPECTED_EVENT_STATUS = [
  'expected',
  'fulfilled',
  'missed',
  'expired',
  'cancelled',
] as const;

export const EVENT_OUTBOX_STATUS = [
  'pending',
  'sent',
  'failed',
] as const;

// ─── Layer 5: Case & Workflow Engine ───

export const SLA_STATUSES = ['active', 'paused', 'breached', 'completed'] as const;

export const ESCALATION_LEVELS = [
  'level_1',
  'level_2',
  'level_3',
  'critical',
  'executive',
] as const;

export const ESCALATION_STATUSES = ['pending', 'triggered', 'acknowledged', 'resolved'] as const;

export const WORKFLOW_STATUSES = ['draft', 'active', 'inactive', 'archived'] as const;

export const EXCEPTION_TO_CASE_TYPE_MAP: Record<string, string> = {
  expected_event_missing: 'transfer_failure',
  unexpected_event: 'unexpected_event',
  invalid_transition: 'system_exception',
  location_mismatch: 'misrouted',
  custody_mismatch: 'custody_exception',
  duplicate_operational_event: 'system_exception',
  out_of_sequence_event: 'system_exception',
  expectation_expired: 'delivery_failure',
};

export const CASE_SLA_DEFAULTS: Record<string, { responseMinutes: number; resolutionMinutes: number }> = {
  missing: { responseMinutes: 30, resolutionMinutes: 240 },
  transfer_failure: { responseMinutes: 30, resolutionMinutes: 240 },
  delivery_failure: { responseMinutes: 30, resolutionMinutes: 240 },
  damaged: { responseMinutes: 60, resolutionMinutes: 480 },
  delayed: { responseMinutes: 60, resolutionMinutes: 480 },
  misrouted: { responseMinutes: 30, resolutionMinutes: 360 },
  security_exception: { responseMinutes: 15, resolutionMinutes: 120 },
  custody_exception: { responseMinutes: 30, resolutionMinutes: 240 },
  location_exception: { responseMinutes: 30, resolutionMinutes: 240 },
  unexpected_event: { responseMinutes: 30, resolutionMinutes: 240 },
  system_exception: { responseMinutes: 60, resolutionMinutes: 480 },
  disruption: { responseMinutes: 30, resolutionMinutes: 360 },
  tag_failure: { responseMinutes: 60, resolutionMinutes: 480 },
  other: { responseMinutes: 60, resolutionMinutes: 480 },
};

// ─── Layer 6: Recovery & Routing Engine ──────────────────────────────────────

export const RECOVERY_PLAN_STATUSES = [
  'draft', 'planning', 'options_available', 'awaiting_approval',
  'approved', 'scheduled', 'in_progress', 'completed',
  'no_route', 'rejected', 'failed', 'cancelled', 'replanning',
] as const;

export const RECOVERY_TYPES = [
  'air', 'ground', 'air_and_ground', 'courier',
  'interline', 'passenger_hand_carry', 'local_delivery',
  'transfer', 'other',
] as const;

export const RECOVERY_RISK_LEVELS = ['low', 'medium', 'high', 'critical'] as const;

export const ROUTE_SEGMENT_MODES = [
  'flight', 'ground', 'courier', 'transfer', 'delivery', 'other',
] as const;

export const ROUTE_SEGMENT_STATUSES = [
  'planned', 'confirmed', 'in_transit', 'completed', 'failed', 'cancelled',
] as const;

export const ROUTE_CONSTRAINT_TYPES = [
  'flight_not_found', 'connection_impossible', 'airport_unavailable',
  'baggage_not_accepted', 'policy_violated', 'capacity_exceeded',
  'cutoff_missed', 'carrier_restricted',
] as const;

export const ROUTE_CONSTRAINT_SEVERITY = ['hard', 'soft'] as const;

export const RECOVERY_EXECUTION_STATUSES = [
  'pending', 'in_progress', 'completed', 'failed', 'cancelled',
] as const;

export const RECOVERY_EXECUTION_STEP_STATUSES = [
  'pending', 'in_progress', 'completed', 'failed', 'skipped',
] as const;

export const RECOVERY_APPROVAL_LEVELS = [
  'none', 'supervisor', 'manager', 'executive',
] as const;

export const RECOVERY_PLAN_TRANSITIONS: Record<string, readonly string[]> = {
  draft: ['planning', 'cancelled'],
  planning: ['options_available', 'no_route', 'cancelled'],
  options_available: ['awaiting_approval', 'cancelled'],
  awaiting_approval: ['approved', 'rejected', 'cancelled'],
  approved: ['scheduled', 'cancelled'],
  scheduled: ['in_progress', 'cancelled'],
  in_progress: ['completed', 'failed', 'replanning'],
  completed: [],
  no_route: ['planning', 'cancelled'],
  rejected: ['draft', 'cancelled'],
  failed: ['replanning', 'cancelled'],
  cancelled: [],
  replanning: ['options_available', 'no_route', 'cancelled'],
};

export const ROUTE_SCORING_WEIGHTS = {
  slaCompliance: 0.35,
  eta: 0.25,
  operationalRisk: 0.15,
  connectionQuality: 0.10,
  cost: 0.10,
  handlingCapability: 0.05,
} as const;

export const GRAPH_TRAVERSAL_LIMITS = {
  maxHops: 5,
  maxCandidateRoutes: 10,
  maxSearchDepth: 6,
  maxComputationTimeMs: 5000,
} as const;

// ─── Layer 7: Analytics & Command Center ──────────────────────────────────────

export const ANALYTICS_TIME_RANGES = [
  'today', 'yesterday', 'last_7_days', 'last_30_days', 'last_90_days', 'custom_range',
] as const;

export type AnalyticsTimeRange = (typeof ANALYTICS_TIME_RANGES)[number];

export const ANALYTICS_GRANULARITIES = ['hour', 'day', 'week', 'month'] as const;

export type AnalyticsGranularity = (typeof ANALYTICS_GRANULARITIES)[number];

export const ANALYTICS_DIMENSIONS = [
  'airport', 'airline', 'organization', 'handler', 'flight', 'route',
  'provider', 'case_type', 'recovery_type', 'status', 'priority',
  'date', 'hour',
] as const;

export type AnalyticsDimension = (typeof ANALYTICS_DIMENSIONS)[number];

export const ANALYTICS_AGGREGATION_TYPES = [
  'count', 'sum', 'avg', 'min', 'max', 'rate', 'percentage', 'duration', 'trend',
] as const;

export type AnalyticsAggregationType = (typeof ANALYTICS_AGGREGATION_TYPES)[number];

export const METRIC_CATEGORIES = [
  'baggage', 'cases', 'recovery', 'routing', 'providers', 'airports', 'flights', 'sla', 'organization',
] as const;

export type MetricCategory = (typeof METRIC_CATEGORIES)[number];

export const ALERT_STATUSES = ['active', 'acknowledged', 'resolved', 'dismissed'] as const;

export type AlertStatus = (typeof ALERT_STATUSES)[number];

export const ALERT_SEVERITIES = ['info', 'warning', 'critical'] as const;

export type AlertSeverity = (typeof ALERT_SEVERITIES)[number];

export const HEALTH_SCORE_WEIGHTS = {
  transferPerformance: 0.25,
  slaCompliance: 0.25,
  recoveryPerformance: 0.20,
  providerPerformance: 0.15,
  systemReliability: 0.15,
} as const;

export const HEALTH_THRESHOLDS = {
  excellent: 90,
  good: 75,
  fair: 60,
  poor: 0,
} as const;

export const ALERT_COOLDOWN_MINUTES = 30;

export const EXPORT_FORMATS = ['csv', 'json'] as const;

export type ExportFormat = (typeof EXPORT_FORMATS)[number];

export const EXPORT_MAX_ROWS = 10000;

export const BAGGAGE_AGING_BUCKETS = [
  { label: '< 1h', minMinutes: 0, maxMinutes: 60 },
  { label: '1-4h', minMinutes: 60, maxMinutes: 240 },
  { label: '4-12h', minMinutes: 240, maxMinutes: 720 },
  { label: '12-24h', minMinutes: 720, maxMinutes: 1440 },
  { label: '24h+', minMinutes: 1440, maxMinutes: Infinity },
] as const;
