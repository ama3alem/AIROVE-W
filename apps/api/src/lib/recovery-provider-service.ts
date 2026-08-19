import { db, recoveryProviders, providerServices, recoveryProviderAssignments } from '@airove/db';
import { eq, and, sql } from 'drizzle-orm';
import pino from 'pino';
import { auditLog } from './audit-logger.js';

const logger = pino({ name: 'layer6-provider-service' });

export interface CreateProviderInput {
  name: string;
  description?: string;
  coverage?: string[];
  contactEmail?: string;
  contactPhone?: string;
  metadata?: Record<string, unknown>;
}

export interface UpdateProviderInput {
  name?: string;
  description?: string;
  coverage?: string[];
  status?: string;
  contactEmail?: string;
  contactPhone?: string;
  metadata?: Record<string, unknown>;
}

export interface CreateServiceInput {
  serviceName: string;
  serviceType: string;
  coverage?: string[];
  estimatedDurationMinutes?: number;
  cost?: number;
  capacity?: number;
  metadata?: Record<string, unknown>;
}

export interface UpdateServiceInput {
  serviceName?: string;
  serviceType?: string;
  coverage?: string[];
  estimatedDurationMinutes?: number;
  cost?: number;
  capacity?: number;
  status?: string;
  metadata?: Record<string, unknown>;
}

export class RecoveryProviderService {
  async createProvider(input: CreateProviderInput, orgId: string, userId: string) {
    const result = await db
      .insert(recoveryProviders)
      .values({
        orgId,
        name: input.name,
        description: input.description ?? null,
        coverage: JSON.stringify(input.coverage ?? []),
        contactEmail: input.contactEmail ?? null,
        contactPhone: input.contactPhone ?? null,
        metadata: input.metadata ? JSON.stringify(input.metadata) : null,
      })
      .returning();

    const created = result[0];
    if (!created) {
      throw new Error('Failed to create provider');
    }

    await auditLog({
      orgId,
      userId,
      action: 'provider.create',
      entityType: 'recovery_provider',
      entityId: created.id,
      entityRef: created.name,
    });

    logger.info({ providerId: created.id, name: created.name }, 'Provider created');
    return created;
  }

  async getProvider(providerId: string, orgId: string) {
    const provider = await db.query.recoveryProviders.findFirst({
      where: and(eq(recoveryProviders.id, providerId), eq(recoveryProviders.orgId, orgId)),
    });

    if (!provider) {
      throw new Error('Provider not found');
    }

    return provider;
  }

  async listProviders(orgId: string) {
    return db.query.recoveryProviders.findMany({
      where: eq(recoveryProviders.orgId, orgId),
    });
  }

  async updateProvider(
    providerId: string,
    orgId: string,
    input: UpdateProviderInput,
    userId: string,
  ) {
    const existing = await this.getProvider(providerId, orgId);

    const setValues: Record<string, unknown> = { updatedAt: new Date() };
    if (input.name !== undefined) setValues['name'] = input.name;
    if (input.description !== undefined) setValues['description'] = input.description;
    if (input.coverage !== undefined) setValues['coverage'] = JSON.stringify(input.coverage);
    if (input.status !== undefined) setValues['status'] = input.status;
    if (input.contactEmail !== undefined) setValues['contactEmail'] = input.contactEmail;
    if (input.contactPhone !== undefined) setValues['contactPhone'] = input.contactPhone;
    if (input.metadata !== undefined) setValues['metadata'] = JSON.stringify(input.metadata);

    const [updated] = await db
      .update(recoveryProviders)
      .set(setValues)
      .where(and(eq(recoveryProviders.id, providerId), eq(recoveryProviders.orgId, orgId)))
      .returning();

    if (!updated) {
      throw new Error('Failed to update provider');
    }

    await auditLog({
      orgId,
      userId,
      action: 'provider.update',
      entityType: 'recovery_provider',
      entityId: providerId,
      entityRef: existing.name,
      changes: JSON.stringify(input),
    });

    logger.info({ providerId, changes: Object.keys(input) }, 'Provider updated');
    return updated;
  }

  async createService(providerId: string, orgId: string, input: CreateServiceInput) {
    await this.getProvider(providerId, orgId);

    const result = await db
      .insert(providerServices)
      .values({
        orgId,
        providerId,
        serviceName: input.serviceName,
        serviceType: input.serviceType,
        coverage: JSON.stringify(input.coverage ?? []),
        estimatedDurationMinutes: input.estimatedDurationMinutes ?? null,
        cost: input.cost != null ? String(input.cost) : null,
        capacity: input.capacity ?? null,
        metadata: input.metadata ? JSON.stringify(input.metadata) : null,
      })
      .returning();

    const created = result[0];
    if (!created) {
      throw new Error('Failed to create provider service');
    }

    logger.info(
      { serviceId: created.id, providerId, serviceName: input.serviceName },
      'Provider service created',
    );
    return created;
  }

  async getService(serviceId: string, orgId: string) {
    const service = await db.query.providerServices.findFirst({
      where: and(eq(providerServices.id, serviceId), eq(providerServices.orgId, orgId)),
    });

    if (!service) {
      throw new Error('Provider service not found');
    }

    return service;
  }

  async listServices(providerId: string, orgId: string) {
    await this.getProvider(providerId, orgId);

    return db.query.providerServices.findMany({
      where: and(
        eq(providerServices.providerId, providerId),
        eq(providerServices.orgId, orgId),
      ),
    });
  }

  async updateService(serviceId: string, orgId: string, input: UpdateServiceInput) {
    const existing = await this.getService(serviceId, orgId);

    const setValues: Record<string, unknown> = { updatedAt: new Date() };
    if (input.serviceName !== undefined) setValues['serviceName'] = input.serviceName;
    if (input.serviceType !== undefined) setValues['serviceType'] = input.serviceType;
    if (input.coverage !== undefined) setValues['coverage'] = JSON.stringify(input.coverage);
    if (input.estimatedDurationMinutes !== undefined)
      setValues['estimatedDurationMinutes'] = input.estimatedDurationMinutes;
    if (input.cost !== undefined) setValues['cost'] = String(input.cost);
    if (input.capacity !== undefined) setValues['capacity'] = input.capacity;
    if (input.status !== undefined) setValues['status'] = input.status;
    if (input.metadata !== undefined) setValues['metadata'] = JSON.stringify(input.metadata);

    const [updated] = await db
      .update(providerServices)
      .set(setValues)
      .where(and(eq(providerServices.id, serviceId), eq(providerServices.orgId, orgId)))
      .returning();

    if (!updated) {
      throw new Error('Failed to update provider service');
    }

    logger.info({ serviceId, changes: Object.keys(input) }, 'Provider service updated');
    return updated;
  }

  async assignProvider(
    recoveryPlanId: string,
    providerId: string,
    orgId: string,
    userId: string,
    serviceId?: string,
  ) {
    await this.getProvider(providerId, orgId);

    const result = await db
      .insert(recoveryProviderAssignments)
      .values({
        orgId,
        recoveryPlanId,
        providerId,
        providerServiceId: serviceId ?? null,
        assignedBy: userId,
        status: 'assigned',
      })
      .returning();

    const created = result[0];
    if (!created) {
      throw new Error('Failed to assign provider');
    }

    await auditLog({
      orgId,
      userId,
      action: 'provider.assign',
      entityType: 'recovery_provider_assignment',
      entityId: created.id,
      changes: JSON.stringify({ recoveryPlanId, providerId, serviceId }),
    });

    logger.info(
      { assignmentId: created.id, recoveryPlanId, providerId },
      'Provider assigned to recovery plan',
    );
    return created;
  }

  async listAssignments(recoveryPlanId: string, orgId: string) {
    return db.query.recoveryProviderAssignments.findMany({
      where: and(
        eq(recoveryProviderAssignments.recoveryPlanId, recoveryPlanId),
        eq(recoveryProviderAssignments.orgId, orgId),
      ),
    });
  }

  async getAssignment(assignmentId: string, orgId: string) {
    const assignment = await db.query.recoveryProviderAssignments.findFirst({
      where: and(
        eq(recoveryProviderAssignments.id, assignmentId),
        eq(recoveryProviderAssignments.orgId, orgId),
      ),
    });

    if (!assignment) {
      throw new Error('Provider assignment not found');
    }

    return assignment;
  }

  async unassignProvider(assignmentId: string, orgId: string, userId: string) {
    const existing = await this.getAssignment(assignmentId, orgId);

    const [updated] = await db
      .update(recoveryProviderAssignments)
      .set({ status: 'unassigned' })
      .where(
        and(
          eq(recoveryProviderAssignments.id, assignmentId),
          eq(recoveryProviderAssignments.orgId, orgId),
        ),
      )
      .returning();

    if (!updated) {
      throw new Error('Failed to unassign provider');
    }

    await auditLog({
      orgId,
      userId,
      action: 'provider.unassign',
      entityType: 'recovery_provider_assignment',
      entityId: assignmentId,
      changes: JSON.stringify({
        recoveryPlanId: existing.recoveryPlanId,
        providerId: existing.providerId,
      }),
    });

    logger.info(
      { assignmentId, providerId: existing.providerId },
      'Provider unassigned',
    );
    return updated;
  }

  async findProvidersForRoute(origin: string, destination: string, orgId: string) {
    return db.query.recoveryProviders.findMany({
      where: and(
        eq(recoveryProviders.orgId, orgId),
        eq(recoveryProviders.status, 'active'),
        sql`${recoveryProviders.coverage}::jsonb ?| ARRAY[${origin}, ${destination}]`,
      ),
    });
  }

  async findServicesForRoute(
    origin: string,
    destination: string,
    providerId: string,
    orgId: string,
  ) {
    await this.getProvider(providerId, orgId);

    return db.query.providerServices.findMany({
      where: and(
        eq(providerServices.orgId, orgId),
        eq(providerServices.providerId, providerId),
        eq(providerServices.status, 'active'),
        sql`${providerServices.coverage}::jsonb ?| ARRAY[${origin}, ${destination}]`,
      ),
    });
  }
}

export const recoveryProviderService = new RecoveryProviderService();
