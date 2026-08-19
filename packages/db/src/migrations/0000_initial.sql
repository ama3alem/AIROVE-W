-- AIROVE Database Schema — Complete Initial Migration
-- Generated for Layer 5 with all dependency layers
-- PostgreSQL

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- CORE TABLES (no FK dependencies)
-- ============================================================

CREATE TABLE IF NOT EXISTS organizations (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          varchar(255) NOT NULL,
  slug          varchar(100) NOT NULL UNIQUE,
  type          varchar(50) NOT NULL,
  status        varchar(20) NOT NULL DEFAULT 'active',
  metadata      text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS users (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  email         varchar(255) NOT NULL UNIQUE,
  name          varchar(255),
  avatar_url    text,
  status        varchar(20) NOT NULL DEFAULT 'active',
  platform_role varchar(50) DEFAULT 'user',
  last_login_at timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS org_members (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id        uuid NOT NULL,
  user_id       uuid NOT NULL,
  role          varchar(50) NOT NULL,
  status        varchar(20) NOT NULL DEFAULT 'active',
  invited_by    uuid,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS airports (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id        uuid NOT NULL,
  iata_code     varchar(3) NOT NULL UNIQUE,
  icao_code     varchar(4),
  name          varchar(255) NOT NULL,
  city          varchar(255),
  country       varchar(100),
  timezone      varchar(50),
  metadata      text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS airlines (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id        uuid NOT NULL,
  iata_code     varchar(3) NOT NULL UNIQUE,
  icao_code     varchar(4),
  name          varchar(255) NOT NULL,
  country       varchar(100),
  metadata      text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS roles (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id        uuid NOT NULL,
  name          varchar(100) NOT NULL,
  description   text,
  is_system     boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS permissions (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  resource      varchar(50) NOT NULL,
  action        varchar(50) NOT NULL,
  description   text,
  UNIQUE(resource, action)
);

CREATE TABLE IF NOT EXISTS role_permissions (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  role_id       uuid NOT NULL,
  permission_id uuid NOT NULL,
  UNIQUE(role_id, permission_id)
);

CREATE TABLE IF NOT EXISTS membership_roles (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  membership_id uuid NOT NULL,
  role_id       uuid NOT NULL,
  UNIQUE(membership_id, role_id)
);

-- ============================================================
-- ENTITY TABLES
-- ============================================================

CREATE TABLE IF NOT EXISTS flights (
  id                    uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id                uuid NOT NULL,
  airline_id            uuid,
  flight_number         varchar(20) NOT NULL,
  departure_airport_id  uuid,
  arrival_airport_id    uuid,
  scheduled_departure   timestamptz,
  scheduled_arrival     timestamptz,
  actual_departure      timestamptz,
  actual_arrival        timestamptz,
  status                varchar(30) NOT NULL DEFAULT 'scheduled',
  flight_date           date,
  tail_number           varchar(20),
  aircraft_type         varchar(50),
  metadata              text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS journeys (
  id                    uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id                uuid NOT NULL,
  passenger_name        varchar(255),
  passenger_reference   varchar(100),
  pnr                   varchar(10),
  origin_airport_id     uuid,
  destination_airport_id uuid,
  status                varchar(30) NOT NULL DEFAULT 'active',
  total_bags            integer DEFAULT 0,
  connecting_flights    text,
  metadata              text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS baggage (
  id                        uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id                    uuid NOT NULL,
  tag_number                varchar(50) NOT NULL,
  journey_id                uuid,
  flight_id                 uuid,
  passenger_name            varchar(255),
  passenger_reference       varchar(100),
  origin_airport_id         uuid,
  destination_airport_id    uuid,
  current_location          varchar(255),
  current_state             varchar(50) NOT NULL DEFAULT 'registered',
  current_custodian         varchar(100),
  current_custodian_type    varchar(50),
  last_event_id             uuid,
  expected_next_event       varchar(50),
  weight                    integer,
  dimensions                varchar(50),
  bag_type                  varchar(50),
  priority                  varchar(20) DEFAULT 'normal',
  status                    varchar(20) NOT NULL DEFAULT 'active',
  metadata                  text,
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- EVENT TABLES
-- ============================================================

CREATE TABLE IF NOT EXISTS baggage_events (
  id                    uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id                uuid NOT NULL,
  baggage_id            uuid NOT NULL,
  flight_id             uuid,
  event_type            varchar(50) NOT NULL,
  event_source          varchar(100),
  actor_type            varchar(50),
  actor_id              varchar(100),
  location              varchar(255),
  airport_code          varchar(3),
  terminal              varchar(20),
  handler               varchar(100),
  status                varchar(30) NOT NULL DEFAULT 'processed',
  sequence_number       integer,
  correction_of         uuid,
  event_hash            varchar(128),
  previous_event_hash   varchar(128),
  schema_version        varchar(20) NOT NULL DEFAULT '1.0',
  idempotency_key       varchar(255),
  raw_payload           text,
  metadata              text,
  occurred_at           timestamptz NOT NULL,
  processed_at          timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE(org_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_baggage_events_baggage ON baggage_events (baggage_id);
CREATE INDEX IF NOT EXISTS idx_baggage_events_sequence ON baggage_events (baggage_id, sequence_number);
CREATE INDEX IF NOT EXISTS idx_baggage_events_type ON baggage_events (event_type);

CREATE TABLE IF NOT EXISTS handovers (
  id                uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id            uuid NOT NULL,
  baggage_id        uuid NOT NULL,
  flight_id         uuid,
  from_party        varchar(100) NOT NULL,
  from_party_type   varchar(50),
  to_party          varchar(100) NOT NULL,
  to_party_type     varchar(50),
  handover_type     varchar(50) NOT NULL,
  location          varchar(100),
  airport_code      varchar(3),
  status            varchar(30) NOT NULL DEFAULT 'pending',
  accepted_at       timestamptz,
  notes             text,
  metadata          text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id        uuid NOT NULL,
  user_id       uuid,
  action        varchar(100) NOT NULL,
  entity_type   varchar(50) NOT NULL,
  entity_id     uuid,
  entity_ref    varchar(100),
  changes       text,
  ip_address    varchar(45),
  user_agent    text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- INTEGRATION TABLES
-- ============================================================

CREATE TABLE IF NOT EXISTS integrations (
  id                      uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id                  uuid NOT NULL,
  name                    varchar(255) NOT NULL,
  type                    varchar(50) NOT NULL,
  provider                varchar(100),
  status                  varchar(30) NOT NULL DEFAULT 'configuring',
  config                  text,
  mapping_config          jsonb,
  webhook_secret          varchar(500),
  credential_ref          varchar(500),
  last_sync_at            timestamptz,
  last_error_at           timestamptz,
  last_error              text,
  consecutive_failures    integer DEFAULT 0,
  total_events_received   integer DEFAULT 0,
  total_events_failed     integer DEFAULT 0,
  metadata                text,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS integration_events (
  id                  uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  integration_id      uuid NOT NULL,
  org_id              uuid NOT NULL,
  external_event_id   varchar(255) NOT NULL,
  event_type          varchar(100) NOT NULL,
  status              varchar(30) NOT NULL DEFAULT 'received',
  raw_payload         text,
  normalized_payload  text,
  mapping_version     varchar(20),
  failure_reason      text,
  retry_count         integer DEFAULT 0,
  max_retries         integer DEFAULT 3,
  correlation_id      varchar(100),
  received_at         timestamptz NOT NULL DEFAULT now(),
  processed_at        timestamptz,
  failed_at           timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_integration_events_integration ON integration_events (integration_id);
CREATE INDEX IF NOT EXISTS idx_integration_events_external_id ON integration_events (external_event_id);
CREATE INDEX IF NOT EXISTS idx_integration_events_status ON integration_events (status);

CREATE TABLE IF NOT EXISTS entity_mappings (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id          uuid NOT NULL,
  integration_id  uuid NOT NULL,
  entity_type     varchar(50) NOT NULL,
  external_id     varchar(255) NOT NULL,
  internal_id     uuid NOT NULL,
  metadata        text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_entity_mappings_lookup ON entity_mappings (integration_id, entity_type, external_id);

CREATE TABLE IF NOT EXISTS outbound_deliveries (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  integration_id  uuid NOT NULL,
  org_id          uuid NOT NULL,
  event_type      varchar(100) NOT NULL,
  status          varchar(30) NOT NULL DEFAULT 'pending',
  payload         text,
  response        text,
  status_code     integer,
  attempt_count   integer DEFAULT 0,
  max_attempts    integer DEFAULT 3,
  last_error      text,
  correlation_id  varchar(100),
  scheduled_at    timestamptz NOT NULL DEFAULT now(),
  delivered_at    timestamptz,
  failed_at       timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- MISC TABLES
-- ============================================================

CREATE TABLE IF NOT EXISTS notifications (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id        uuid NOT NULL,
  user_id       uuid NOT NULL,
  type          varchar(50) NOT NULL,
  title         varchar(255) NOT NULL,
  body          text,
  entity_type   varchar(50),
  entity_id     uuid,
  read_at       timestamptz,
  metadata      text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS invitations (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id        uuid NOT NULL,
  email         varchar(255) NOT NULL,
  role          varchar(50) NOT NULL,
  status        varchar(20) NOT NULL DEFAULT 'pending',
  invited_by    uuid NOT NULL,
  token         varchar(255) NOT NULL,
  expires_at    timestamptz NOT NULL,
  accepted_at   timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS service_identities (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id          uuid NOT NULL,
  name            varchar(255) NOT NULL,
  service_type    varchar(50) NOT NULL,
  status          varchar(20) NOT NULL DEFAULT 'active',
  api_key_hash    varchar(255),
  webhook_url     text,
  metadata        text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS org_relationships (
  id                  uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id              uuid NOT NULL,
  related_org_id      uuid NOT NULL,
  relationship_type   varchar(50) NOT NULL,
  status              varchar(20) NOT NULL DEFAULT 'active',
  metadata            text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS access_policies (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id        uuid NOT NULL,
  name          varchar(255) NOT NULL,
  policy_type   varchar(50) NOT NULL,
  config        text,
  enabled       boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- LAYER 4 TABLES
-- ============================================================

CREATE TABLE IF NOT EXISTS baggage_custody (
  id                      uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id                  uuid NOT NULL,
  baggage_id              uuid NOT NULL,
  flight_id               uuid,
  custodian_name          varchar(100) NOT NULL,
  custodian_type          varchar(50) NOT NULL,
  previous_custodian      varchar(100),
  previous_custodian_type varchar(50),
  location                varchar(255),
  airport_code            varchar(3),
  transferred_at          timestamptz NOT NULL DEFAULT now(),
  transferred_by          uuid,
  handover_id             uuid,
  notes                   text,
  metadata                text,
  created_at              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_custody_baggage ON baggage_custody (baggage_id);

CREATE TABLE IF NOT EXISTS baggage_state_projections (
  id                        uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id                    uuid NOT NULL,
  baggage_id                uuid NOT NULL UNIQUE,
  current_state             varchar(50) NOT NULL DEFAULT 'created',
  current_location          varchar(255),
  current_airport_code      varchar(3),
  current_custodian         varchar(100),
  current_custodian_type    varchar(50),
  last_event_id             uuid,
  last_event_type           varchar(50),
  last_event_at             timestamptz,
  expected_next_event       varchar(50),
  expected_next_event_at    timestamptz,
  sequence_number           integer NOT NULL DEFAULT 0,
  last_event_hash           varchar(128),
  event_count               integer NOT NULL DEFAULT 0,
  updated_at                timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS expected_events (
  id                      uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id                  uuid NOT NULL,
  baggage_id              uuid NOT NULL,
  flight_id               uuid,
  journey_id              uuid,
  expected_type           varchar(50) NOT NULL,
  expected_at             timestamptz NOT NULL,
  expected_location       varchar(255),
  expected_airport_code   varchar(3),
  status                  varchar(30) NOT NULL DEFAULT 'expected',
  fulfilled_by_event_id   uuid,
  fulfilled_at            timestamptz,
  expired_at              timestamptz,
  notes                   text,
  metadata                text,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_expected_events_baggage ON expected_events (baggage_id);
CREATE INDEX IF NOT EXISTS idx_expected_events_status ON expected_events (status);

CREATE TABLE IF NOT EXISTS operational_exceptions (
  id                  uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id              uuid NOT NULL,
  baggage_id          uuid,
  flight_id           uuid,
  journey_id          uuid,
  exception_type      varchar(50) NOT NULL,
  severity            varchar(20) NOT NULL DEFAULT 'warning',
  description         text NOT NULL,
  expected_event_id   uuid,
  actual_event_id     uuid,
  location            varchar(255),
  airport_code        varchar(3),
  resolved            boolean NOT NULL DEFAULT false,
  resolved_at         timestamptz,
  resolved_by         uuid,
  resolution          text,
  case_id             uuid,
  metadata            text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_exceptions_baggage ON operational_exceptions (baggage_id);
CREATE INDEX IF NOT EXISTS idx_exceptions_type ON operational_exceptions (exception_type);
CREATE INDEX IF NOT EXISTS idx_exceptions_resolved ON operational_exceptions (resolved);
CREATE INDEX IF NOT EXISTS idx_exceptions_case ON operational_exceptions (case_id);

CREATE TABLE IF NOT EXISTS event_outbox (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id          uuid NOT NULL,
  event_type      varchar(100) NOT NULL,
  aggregate_type  varchar(50) NOT NULL,
  aggregate_id    uuid NOT NULL,
  payload         text NOT NULL,
  status          varchar(30) NOT NULL DEFAULT 'pending',
  attempts        integer NOT NULL DEFAULT 0,
  max_attempts    integer NOT NULL DEFAULT 5,
  last_error      text,
  next_retry_at   timestamptz,
  sent_at         timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_outbox_status ON event_outbox (status);

CREATE TABLE IF NOT EXISTS journey_segments (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id          uuid NOT NULL,
  journey_id      uuid NOT NULL,
  flight_id       uuid NOT NULL,
  segment_order   integer NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- LAYER 5 TABLES
-- ============================================================

CREATE TABLE IF NOT EXISTS cases (
  id                        uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id                    uuid NOT NULL,
  case_number               varchar(50) NOT NULL,
  case_type                 varchar(50) NOT NULL,
  baggage_id                uuid,
  flight_id                 uuid,
  journey_id                uuid,
  title                     varchar(255),
  priority                  varchar(20) NOT NULL DEFAULT 'medium',
  status                    varchar(30) NOT NULL DEFAULT 'open',
  assigned_to               uuid,
  assigned_organization_id  uuid,
  origin_organization_id    uuid,
  source_exception_id       uuid,
  source                    varchar(50) NOT NULL DEFAULT 'operator',
  description               text,
  resolution                text,
  resolution_code           varchar(50),
  resolved_at               timestamptz,
  closed_at                 timestamptz,
  escalated_at              timestamptz,
  workflow_id               uuid,
  metadata                  text,
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now(),
  UNIQUE(org_id, case_number)
);

CREATE INDEX IF NOT EXISTS idx_cases_org ON cases (org_id);
CREATE INDEX IF NOT EXISTS idx_cases_status ON cases (status);
CREATE INDEX IF NOT EXISTS idx_cases_baggage ON cases (baggage_id);

CREATE TABLE IF NOT EXISTS tasks (
  id                        uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id                    uuid NOT NULL,
  case_id                   uuid,
  baggage_id                uuid,
  title                     varchar(255) NOT NULL,
  description               text,
  task_type                 varchar(50) NOT NULL,
  priority                  varchar(20) NOT NULL DEFAULT 'medium',
  status                    varchar(30) NOT NULL DEFAULT 'pending',
  assigned_to               uuid,
  assigned_organization_id  uuid,
  assigned_at               timestamptz,
  started_at                timestamptz,
  due_at                    timestamptz,
  completed_at              timestamptz,
  completed_by              uuid,
  blocked_at                timestamptz,
  blocked_reason            text,
  result                    text,
  metadata                  text,
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tasks_org ON tasks (org_id);
CREATE INDEX IF NOT EXISTS idx_tasks_case ON tasks (case_id);

CREATE TABLE IF NOT EXISTS case_activities (
  id                        uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_id                   uuid NOT NULL REFERENCES cases(id),
  org_id                    uuid NOT NULL,
  activity_type             varchar(50) NOT NULL,
  actor_id                  uuid,
  actor_organization_id     uuid,
  description               text,
  previous_value            text,
  new_value                 text,
  metadata                  text,
  created_at                timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS case_comments (
  id                        uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_id                   uuid NOT NULL REFERENCES cases(id),
  org_id                    uuid NOT NULL,
  author_id                 uuid NOT NULL,
  author_organization_id    uuid,
  content                   text NOT NULL,
  metadata                  text,
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sla_policies (
  id                              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id                          uuid NOT NULL,
  name                            varchar(255) NOT NULL,
  description                     text,
  case_type                       varchar(50) NOT NULL,
  priority                        varchar(20) NOT NULL,
  response_minutes                integer NOT NULL,
  resolution_minutes              integer NOT NULL,
  warning_threshold_percent       integer NOT NULL DEFAULT 75,
  escalation_threshold_percent    integer NOT NULL DEFAULT 100,
  pause_on_pending_external       boolean NOT NULL DEFAULT true,
  enabled                         boolean NOT NULL DEFAULT true,
  metadata                        text,
  created_at                      timestamptz NOT NULL DEFAULT now(),
  updated_at                      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS case_sla (
  id                    uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_id               uuid NOT NULL REFERENCES cases(id),
  org_id                uuid NOT NULL,
  sla_policy_id         uuid NOT NULL REFERENCES sla_policies(id),
  status                varchar(20) NOT NULL DEFAULT 'active',
  response_due_at       timestamptz NOT NULL,
  resolution_due_at     timestamptz NOT NULL,
  responded_at          timestamptz,
  resolved_at           timestamptz,
  paused_at             timestamptz,
  resumed_at            timestamptz,
  total_paused_ms       integer NOT NULL DEFAULT 0,
  warning_triggered_at  timestamptz,
  breach_triggered_at   timestamptz,
  metadata              text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_case_sla_org ON case_sla (org_id);

CREATE TABLE IF NOT EXISTS case_escalations (
  id                  uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_id             uuid NOT NULL REFERENCES cases(id),
  org_id              uuid NOT NULL,
  escalation_level    varchar(30) NOT NULL,
  status              varchar(20) NOT NULL DEFAULT 'pending',
  sla_case_id         uuid,
  triggered_at        timestamptz NOT NULL DEFAULT now(),
  acknowledged_at     timestamptz,
  acknowledged_by     uuid,
  resolved_at         timestamptz,
  resolved_by         uuid,
  reason              text,
  metadata            text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_escalations_org ON case_escalations (org_id);

CREATE TABLE IF NOT EXISTS workflow_definitions (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id        uuid NOT NULL,
  name          varchar(255) NOT NULL,
  description   text,
  version       integer NOT NULL DEFAULT 1,
  status        varchar(20) NOT NULL DEFAULT 'draft',
  trigger_type  varchar(50) NOT NULL,
  trigger_config text,
  metadata      text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS workflow_rules (
  id                uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  workflow_id       uuid NOT NULL REFERENCES workflow_definitions(id),
  org_id            uuid NOT NULL,
  rule_order        integer NOT NULL DEFAULT 0,
  condition_type    varchar(50) NOT NULL,
  condition_config  text NOT NULL,
  action_type       varchar(50) NOT NULL,
  action_config     text NOT NULL,
  enabled           boolean NOT NULL DEFAULT true,
  metadata          text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
