import { z } from 'zod';
import { PERMISSIONS } from '@airove/shared';

export type ToolClassification = 'READ_ONLY' | 'LOW_IMPACT' | 'MEDIUM_IMPACT' | 'HIGH_IMPACT' | 'CRITICAL';

export interface AIToolDefinition {
  name: string;
  description: string;
  inputSchema: z.ZodType;
  outputSchema: z.ZodType;
  requiredPermission: string;
  riskLevel: ToolClassification;
  classification: 'READ' | 'WRITE';
  allowedResourceTypes: string[];
  requiresTenantScope: boolean;
  auditRequired: boolean;
}

export interface ToolExecutionContext {
  orgId: string;
  userId: string;
  permissions: string[];
  isSuperAdmin: boolean;
}

export interface ToolExecutionResult {
  success: boolean;
  data?: unknown;
  error?: string;
  toolName: string;
  authorizationResult: string;
  durationMs: number;
}

const getBaggageInputSchema = z.object({
  baggageId: z.string().uuid(),
});

const getBaggageEventsInputSchema = z.object({
  baggageId: z.string().uuid(),
  limit: z.number().int().min(1).max(100).optional(),
});

const getCaseInputSchema = z.object({
  caseId: z.string().uuid(),
});

const getCaseTasksInputSchema = z.object({
  caseId: z.string().uuid(),
});

const getCaseSlaInputSchema = z.object({
  caseId: z.string().uuid(),
});

const getRecoveryPlanInputSchema = z.object({
  planId: z.string().uuid(),
});

const getRecoveryRoutesInputSchema = z.object({
  planId: z.string().uuid(),
});

const getAirportMetricsInputSchema = z.object({
  airportCode: z.string().length(3),
});

const getAlertsInputSchema = z.object({
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
  status: z.enum(['active', 'acknowledged', 'resolved', 'dismissed']).optional(),
});

const getOperationalSummaryInputSchema = z.object({
  airportCode: z.string().length(3).optional(),
});

const genericOutputSchema = z.record(z.unknown());

export const AI_TOOL_REGISTRY: Map<string, AIToolDefinition> = new Map([
  [
    'get_baggage',
    {
      name: 'get_baggage',
      description: 'Retrieve baggage details by ID',
      inputSchema: getBaggageInputSchema,
      outputSchema: genericOutputSchema,
      requiredPermission: PERMISSIONS.BAGGAGE_READ,
      riskLevel: 'READ_ONLY',
      classification: 'READ',
      allowedResourceTypes: ['baggage'],
      requiresTenantScope: true,
      auditRequired: true,
    },
  ],
  [
    'get_baggage_events',
    {
      name: 'get_baggage_events',
      description: 'Retrieve event history for a baggage item',
      inputSchema: getBaggageEventsInputSchema,
      outputSchema: genericOutputSchema,
      requiredPermission: PERMISSIONS.BAGGAGE_EVENT_READ,
      riskLevel: 'READ_ONLY',
      classification: 'READ',
      allowedResourceTypes: ['baggage', 'event'],
      requiresTenantScope: true,
      auditRequired: true,
    },
  ],
  [
    'get_case',
    {
      name: 'get_case',
      description: 'Retrieve case details by ID',
      inputSchema: getCaseInputSchema,
      outputSchema: genericOutputSchema,
      requiredPermission: PERMISSIONS.CASE_READ,
      riskLevel: 'READ_ONLY',
      classification: 'READ',
      allowedResourceTypes: ['case'],
      requiresTenantScope: true,
      auditRequired: true,
    },
  ],
  [
    'get_case_tasks',
    {
      name: 'get_case_tasks',
      description: 'Retrieve tasks associated with a case',
      inputSchema: getCaseTasksInputSchema,
      outputSchema: genericOutputSchema,
      requiredPermission: PERMISSIONS.TASK_READ,
      riskLevel: 'READ_ONLY',
      classification: 'READ',
      allowedResourceTypes: ['task'],
      requiresTenantScope: true,
      auditRequired: true,
    },
  ],
  [
    'get_case_sla',
    {
      name: 'get_case_sla',
      description: 'Retrieve SLA status for a case',
      inputSchema: getCaseSlaInputSchema,
      outputSchema: genericOutputSchema,
      requiredPermission: PERMISSIONS.CASE_READ,
      riskLevel: 'READ_ONLY',
      classification: 'READ',
      allowedResourceTypes: ['sla'],
      requiresTenantScope: true,
      auditRequired: true,
    },
  ],
  [
    'get_recovery_plan',
    {
      name: 'get_recovery_plan',
      description: 'Retrieve recovery plan details by ID',
      inputSchema: getRecoveryPlanInputSchema,
      outputSchema: genericOutputSchema,
      requiredPermission: PERMISSIONS.RECOVERY_PLAN_READ,
      riskLevel: 'READ_ONLY',
      classification: 'READ',
      allowedResourceTypes: ['recovery_plan'],
      requiresTenantScope: true,
      auditRequired: true,
    },
  ],
  [
    'get_recovery_routes',
    {
      name: 'get_recovery_routes',
      description: 'Retrieve route options for a recovery plan',
      inputSchema: getRecoveryRoutesInputSchema,
      outputSchema: genericOutputSchema,
      requiredPermission: PERMISSIONS.RECOVERY_PLAN_READ,
      riskLevel: 'READ_ONLY',
      classification: 'READ',
      allowedResourceTypes: ['recovery_plan', 'route_option'],
      requiresTenantScope: true,
      auditRequired: true,
    },
  ],
  [
    'get_airport_metrics',
    {
      name: 'get_airport_metrics',
      description: 'Retrieve analytics metrics for an airport',
      inputSchema: getAirportMetricsInputSchema,
      outputSchema: genericOutputSchema,
      requiredPermission: PERMISSIONS.ANALYTICS_VIEW,
      riskLevel: 'READ_ONLY',
      classification: 'READ',
      allowedResourceTypes: ['analytics'],
      requiresTenantScope: true,
      auditRequired: true,
    },
  ],
  [
    'get_alerts',
    {
      name: 'get_alerts',
      description: 'Retrieve active alerts',
      inputSchema: getAlertsInputSchema,
      outputSchema: genericOutputSchema,
      requiredPermission: PERMISSIONS.ANALYTICS_ALERT_VIEW,
      riskLevel: 'READ_ONLY',
      classification: 'READ',
      allowedResourceTypes: ['alert'],
      requiresTenantScope: true,
      auditRequired: true,
    },
  ],
  [
    'get_operational_summary',
    {
      name: 'get_operational_summary',
      description: 'Retrieve operational summary for command center',
      inputSchema: getOperationalSummaryInputSchema,
      outputSchema: genericOutputSchema,
      requiredPermission: PERMISSIONS.COMMAND_CENTER_VIEW,
      riskLevel: 'READ_ONLY',
      classification: 'READ',
      allowedResourceTypes: ['analytics', 'command_center'],
      requiresTenantScope: true,
      auditRequired: true,
    },
  ],
]);

export class AIToolRegistry {
  getTool(name: string): AIToolDefinition | undefined {
    return AI_TOOL_REGISTRY.get(name);
  }

  listTools(): AIToolDefinition[] {
    return Array.from(AI_TOOL_REGISTRY.values());
  }

  listToolsByClassification(classification: 'READ' | 'WRITE'): AIToolDefinition[] {
    return this.listTools().filter((tool) => tool.classification === classification);
  }

  validateToolInput(toolName: string, input: unknown): { valid: boolean; data?: unknown; error?: string } {
    const tool = this.getTool(toolName);
    if (!tool) {
      return { valid: false, error: `Unknown tool: ${toolName}` };
    }

    const result = tool.inputSchema.safeParse(input);
    if (!result.success) {
      return { valid: false, error: `Invalid input: ${result.error.message}` };
    }

    return { valid: true, data: result.data };
  }
}

export const aiToolRegistry = new AIToolRegistry();
