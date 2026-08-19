import { db, workflowDefinitions, workflowRules, cases, slaPolicies } from '@airove/db';
import { eq, and, sql, asc, desc } from 'drizzle-orm';
import pino from 'pino';
import { EXCEPTION_TO_CASE_TYPE_MAP } from '@airove/shared';
import { auditLog } from './audit-logger';
import { caseService } from './case-service';
import { taskService } from './task-engine';
import { slaService } from './sla-engine';
import { caseActivityService } from './case-activity-service';

const logger = pino({ name: 'layer5-workflow-engine' });

const MAX_WORKFLOW_DEPTH = 5;

interface WorkflowAction {
  type: 'create_task' | 'assign' | 'set_priority' | 'set_description' | 'add_tag' | 'create_case';
  config: Record<string, unknown>;
}

interface WorkflowCondition {
  type: 'exception_type' | 'severity' | 'case_type' | 'priority' | 'has_field';
  config: Record<string, unknown>;
}

interface WorkflowRuleInput {
  ruleOrder?: number;
  conditionType: string;
  conditionConfig: string;
  actionType: string;
  actionConfig: string;
}

interface CreateWorkflowInput {
  name: string;
  description?: string;
  triggerType: string;
  triggerConfig?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

interface UpdateWorkflowInput {
  name?: string;
  description?: string;
  triggerType?: string;
  triggerConfig?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

interface ExceptionInput {
  exceptionType: string;
  severity?: string;
  baggageId?: string;
  flightId?: string;
  journeyId?: string;
  description?: string;
  metadata?: Record<string, unknown>;
  orgId: string;
}

export class WorkflowEngine {
  async createWorkflow(input: CreateWorkflowInput, orgId: string) {
    const result = await db
      .insert(workflowDefinitions)
      .values({
        orgId,
        name: input.name,
        description: input.description ?? null,
        triggerType: input.triggerType,
        triggerConfig: input.triggerConfig ? JSON.stringify(input.triggerConfig) : null,
        metadata: input.metadata ? JSON.stringify(input.metadata) : null,
        status: 'draft',
      })
      .returning();

    const workflow = result[0];
    if (!workflow) {
      throw new Error('Failed to create workflow');
    }

    await auditLog({
      orgId,
      action: 'workflow.create',
      entityType: 'workflow_definition',
      entityId: workflow.id,
      entityRef: input.name,
    });

    logger.info({ workflowId: workflow.id, name: input.name }, 'Workflow created');
    return workflow;
  }

  async getWorkflow(workflowId: string, orgId: string) {
    return db.query.workflowDefinitions.findFirst({
      where: and(
        eq(workflowDefinitions.id, workflowId),
        eq(workflowDefinitions.orgId, orgId),
      ),
    });
  }

  async listWorkflows(orgId: string) {
    return db.query.workflowDefinitions.findMany({
      where: eq(workflowDefinitions.orgId, orgId),
      orderBy: [desc(workflowDefinitions.createdAt)],
    });
  }

  async updateWorkflow(workflowId: string, orgId: string, updates: UpdateWorkflowInput) {
    const existing = await this.getWorkflow(workflowId, orgId);
    if (!existing) {
      throw new Error('Workflow not found');
    }

    const setValues: Record<string, unknown> = { updatedAt: new Date() };
    if (updates.name !== undefined) setValues['name'] = updates.name;
    if (updates.description !== undefined) setValues['description'] = updates.description;
    if (updates.triggerType !== undefined) setValues['triggerType'] = updates.triggerType;
    if (updates.triggerConfig !== undefined) {
      setValues['triggerConfig'] = JSON.stringify(updates.triggerConfig);
    }
    if (updates.metadata !== undefined) {
      setValues['metadata'] = JSON.stringify(updates.metadata);
    }

    const [updated] = await db
      .update(workflowDefinitions)
      .set(setValues)
      .where(
        and(
          eq(workflowDefinitions.id, workflowId),
          eq(workflowDefinitions.orgId, orgId),
        ),
      )
      .returning();

    if (!updated) {
      throw new Error('Failed to update workflow');
    }

    logger.info({ workflowId, changes: Object.keys(updates) }, 'Workflow updated');
    return updated;
  }

  async activateWorkflow(workflowId: string, orgId: string) {
    const existing = await this.getWorkflow(workflowId, orgId);
    if (!existing) {
      throw new Error('Workflow not found');
    }

    const [updated] = await db
      .update(workflowDefinitions)
      .set({ status: 'active', updatedAt: new Date() })
      .where(
        and(
          eq(workflowDefinitions.id, workflowId),
          eq(workflowDefinitions.orgId, orgId),
        ),
      )
      .returning();

    if (!updated) {
      throw new Error('Failed to activate workflow');
    }

    await auditLog({
      orgId,
      action: 'workflow.activate',
      entityType: 'workflow_definition',
      entityId: workflowId,
      entityRef: existing.name,
    });

    logger.info({ workflowId }, 'Workflow activated');
    return updated;
  }

  async deactivateWorkflow(workflowId: string, orgId: string) {
    const existing = await this.getWorkflow(workflowId, orgId);
    if (!existing) {
      throw new Error('Workflow not found');
    }

    const [updated] = await db
      .update(workflowDefinitions)
      .set({ status: 'inactive', updatedAt: new Date() })
      .where(
        and(
          eq(workflowDefinitions.id, workflowId),
          eq(workflowDefinitions.orgId, orgId),
        ),
      )
      .returning();

    if (!updated) {
      throw new Error('Failed to deactivate workflow');
    }

    await auditLog({
      orgId,
      action: 'workflow.deactivate',
      entityType: 'workflow_definition',
      entityId: workflowId,
      entityRef: existing.name,
    });

    logger.info({ workflowId }, 'Workflow deactivated');
    return updated;
  }

  async addRule(workflowId: string, orgId: string, ruleInput: WorkflowRuleInput) {
    const existing = await this.getWorkflow(workflowId, orgId);
    if (!existing) {
      throw new Error('Workflow not found');
    }

    const result = await db
      .insert(workflowRules)
      .values({
        workflowId,
        orgId,
        ruleOrder: ruleInput.ruleOrder ?? 0,
        conditionType: ruleInput.conditionType,
        conditionConfig: ruleInput.conditionConfig,
        actionType: ruleInput.actionType,
        actionConfig: ruleInput.actionConfig,
        enabled: true,
      })
      .returning();

    const rule = result[0];
    if (!rule) {
      throw new Error('Failed to add workflow rule');
    }

    logger.info({ workflowId, ruleId: rule.id, actionType: ruleInput.actionType }, 'Workflow rule added');
    return rule;
  }

  async listRules(workflowId: string, orgId: string) {
    return db.query.workflowRules.findMany({
      where: and(
        eq(workflowRules.workflowId, workflowId),
        eq(workflowRules.orgId, orgId),
      ),
      orderBy: [asc(workflowRules.ruleOrder)],
    });
  }

  async getActiveWorkflow(triggerType: string, orgId: string) {
    return db.query.workflowDefinitions.findFirst({
      where: and(
        eq(workflowDefinitions.orgId, orgId),
        eq(workflowDefinitions.triggerType, triggerType),
        eq(workflowDefinitions.status, 'active'),
      ),
    });
  }

  async evaluateWorkflow(exception: ExceptionInput, orgId: string) {
    const workflow = await this.getActiveWorkflow(exception.exceptionType, orgId);
    if (!workflow) {
      return { workflow: null, actions: [] as WorkflowAction[] };
    }

    const rules = await this.listRules(workflow.id, orgId);
    const actions: WorkflowAction[] = [];

    for (const rule of rules) {
      if (!rule.enabled) continue;

      const condition: WorkflowCondition = JSON.parse(rule.conditionConfig);
      if (this.evaluateCondition(condition, exception)) {
        const action: WorkflowAction = JSON.parse(rule.actionConfig);
        actions.push(action);
      }
    }

    logger.info(
      { workflowId: workflow.id, exceptionType: exception.exceptionType, actionCount: actions.length },
      'Workflow evaluated',
    );

    return { workflow, actions };
  }

  private evaluateCondition(condition: WorkflowCondition, exception: ExceptionInput): boolean {
    switch (condition.type) {
      case 'exception_type':
        return exception.exceptionType === (condition.config as Record<string, unknown>)['exceptionType'];
      case 'severity':
        return exception.severity === (condition.config as Record<string, unknown>)['severity'];
      case 'case_type':
        return true;
      case 'priority':
        return true;
      case 'has_field': {
        const field = String((condition.config as Record<string, unknown>)['field'] ?? '');
        return field in (exception as unknown as Record<string, unknown>) && (exception as unknown as Record<string, unknown>)[field] !== undefined;
      }
      default:
        return false;
    }
  }

  async executeActions(
    actions: WorkflowAction[],
    caseId: string,
    orgId: string,
    exception?: ExceptionInput,
    depth: number = 0,
    executingWorkflows?: Set<string>,
  ) {
    const results: Array<{ type: string; success: boolean; detail?: string }> = [];

    for (const action of actions) {
      try {
        switch (action.type) {
          case 'create_task': {
            const config = action.config as {
              title?: string;
              description?: string;
              taskType?: string;
              priority?: string;
            };
            await taskService.createTask(
              {
                caseId,
                title: config.title ?? 'Workflow task',
                description: config.description,
                taskType: config.taskType ?? 'workflow',
                priority: config.priority,
              },
              orgId,
            );
            results.push({ type: 'create_task', success: true });
            break;
          }
          case 'assign': {
            const config = action.config as {
              assignedTo?: string;
              assignedOrganizationId?: string;
            };
            if (config.assignedTo) {
              await caseService.assignCase(
                caseId,
                orgId,
                config.assignedTo,
                config.assignedOrganizationId,
              );
            }
            results.push({ type: 'assign', success: true });
            break;
          }
          case 'set_priority': {
            const config = action.config as { priority?: string };
            if (config.priority) {
              await caseService.updateCase(caseId, orgId, {
                priority: config.priority,
              });
            }
            results.push({ type: 'set_priority', success: true });
            break;
          }
          case 'set_description': {
            const config = action.config as { description?: string };
            if (config.description) {
              await caseService.updateCase(caseId, orgId, {
                description: config.description,
              });
            }
            results.push({ type: 'set_description', success: true });
            break;
          }
          case 'create_case': {
            if (exception) {
              const cfg = action.config as Record<string, unknown>;
              const childException: ExceptionInput = {
                exceptionType: (cfg['exceptionType'] as string) ?? exception.exceptionType,
                severity: (cfg['severity'] as string) ?? exception.severity,
                baggageId: (cfg['baggageId'] as string) ?? exception.baggageId,
                flightId: (cfg['flightId'] as string) ?? exception.flightId,
                journeyId: (cfg['journeyId'] as string) ?? exception.journeyId,
                description: (cfg['description'] as string) ?? exception.description,
                metadata: (cfg['metadata'] as Record<string, unknown>) ?? exception.metadata,
                orgId,
              };
              await this.processExceptionToCase(childException, orgId, depth + 1, executingWorkflows);
            }
            results.push({ type: 'create_case', success: true });
            break;
          }
          default:
            results.push({ type: action.type, success: false, detail: 'Unknown action type' });
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        results.push({ type: action.type, success: false, detail: message });
        logger.error({ actionType: action.type, caseId, error: message }, 'Workflow action failed');
      }
    }

    return results;
  }

  async processExceptionToCase(
    exception: ExceptionInput,
    orgId: string,
    depth: number = 0,
    executingWorkflows: Set<string> = new Set(),
  ) {
    if (depth >= MAX_WORKFLOW_DEPTH) {
      logger.warn(
        { depth, exceptionType: exception.exceptionType },
        'Maximum workflow depth reached, skipping action execution',
      );
    }

    const { exceptionType, baggageId } = exception;

    if (baggageId) {
      const existingCase = await caseService.findOpenCaseByBaggage(baggageId, orgId);
      if (existingCase) {
        logger.info(
          { caseId: existingCase.id, caseNumber: existingCase.caseNumber },
          'Reusing existing open case for baggage',
        );
        return existingCase;
      }
    }

    const caseType = EXCEPTION_TO_CASE_TYPE_MAP[exceptionType] ?? 'general';

    const { workflow, actions } = await this.evaluateWorkflow(exception, orgId);

    let skipActions = depth >= MAX_WORKFLOW_DEPTH;

    if (workflow && executingWorkflows.has(workflow.id)) {
      logger.warn(
        { workflowId: workflow.id, exceptionType },
        'Circular workflow detected, skipping action execution',
      );
      skipActions = true;
    }

    const createdCase = await caseService.createCase(
      {
        caseType,
        baggageId: exception.baggageId,
        flightId: exception.flightId,
        journeyId: exception.journeyId,
        title: `[${exceptionType}] ${exception.description ?? 'Operational exception'}`,
        priority: exception.severity === 'critical' ? 'critical'
          : exception.severity === 'high' ? 'high'
          : exception.severity === 'medium' ? 'medium'
          : 'low',
        source: 'system',
        description: exception.description,
        sourceExceptionId: undefined,
        workflowId: workflow?.id,
        metadata: exception.metadata,
      },
      orgId,
      'system',
    );

    if (workflow && !skipActions) {
      executingWorkflows.add(workflow.id);
      try {
        await this.executeActions(actions, createdCase.id, orgId, exception, depth, executingWorkflows);
      } finally {
        executingWorkflows.delete(workflow.id);
      }
    }

    const policy = await slaService.findMatchingPolicy(caseType, createdCase.priority, orgId);
    if (policy) {
      await slaService.startSLA(createdCase.id, orgId, policy.id);
      await caseActivityService.logSLAStarted(createdCase.id, orgId, 'system');
    }

    await caseActivityService.logCaseCreated(createdCase.id, orgId, 'system');

    logger.info(
      { caseId: createdCase.id, caseNumber: createdCase.caseNumber, caseType, exceptionType },
      'Exception processed to case',
    );

    return createdCase;
  }
}

export const workflowEngine = new WorkflowEngine();
