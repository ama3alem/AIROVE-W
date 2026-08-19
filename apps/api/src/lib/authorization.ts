import { db, users, orgMembers, roles, permissions, rolePermissions, membershipRoles } from '@airove/db';
import { eq, and, inArray } from 'drizzle-orm';
import { LAYER2_ROLES, ORG_ROLE_PERMISSIONS } from '@airove/shared';
import { auditLog } from './audit-logger';

export interface AuthorizationContext {
  userId: string;
  sessionId: string;
  orgId: string;
  membershipId: string;
  orgRole: string;
  permissions: string[];
  isSuperAdmin: boolean;
}

interface ResolvedIdentity {
  userId: string;
  email: string;
  name: string | null;
  platformRole: string | null;
  status: string;
}

interface ResolvedMembership {
  membershipId: string;
  orgId: string;
  role: string;
  status: string;
}

export class AuthorizationService {
  async resolveIdentity(userId: string): Promise<ResolvedIdentity | null> {
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!user || user.status !== 'active') {
      return null;
    }

    return {
      userId: user.id,
      email: user.email,
      name: user.name,
      platformRole: user.platformRole,
      status: user.status,
    };
  }

  async resolveMembership(userId: string, orgId: string): Promise<ResolvedMembership | null> {
    const membership = await db.query.orgMembers.findFirst({
      where: and(
        eq(orgMembers.userId, userId),
        eq(orgMembers.orgId, orgId),
        eq(orgMembers.status, 'active'),
      ),
    });

    if (!membership) {
      return null;
    }

    return {
      membershipId: membership.id,
      orgId: membership.orgId,
      role: membership.role,
      status: membership.status,
    };
  }

  async resolvePermissions(userId: string, orgId: string, orgRole: string): Promise<string[]> {
    const isSuperAdmin = orgRole === LAYER2_ROLES.SUPER_ADMIN;

    if (isSuperAdmin) {
      const perms = ORG_ROLE_PERMISSIONS[LAYER2_ROLES.SUPER_ADMIN] ?? [];
      return [...perms];
    }

    const basePermissions = ORG_ROLE_PERMISSIONS[orgRole] ?? [];

    const memberRecord = await db.query.orgMembers.findFirst({
      where: and(
        eq(orgMembers.userId, userId),
        eq(orgMembers.orgId, orgId),
        eq(orgMembers.status, 'active'),
      ),
    });

    if (!memberRecord) {
      return [...basePermissions];
    }

    const extraRoles = await db.query.membershipRoles.findMany({
      where: eq(membershipRoles.membershipId, memberRecord.id),
    });

    if (extraRoles.length === 0) {
      return [...basePermissions];
    }

    const extraRoleIds = extraRoles.map((r) => r.roleId);
    const rolePerms = await db.query.rolePermissions.findMany({
      where: inArray(rolePermissions.roleId, extraRoleIds),
    });

    if (rolePerms.length === 0) {
      return [...basePermissions];
    }

    const permIds = rolePerms.map((rp) => rp.permissionId);
    const permRecords = await db.query.permissions.findMany({
      where: inArray(permissions.id, permIds),
    });

    const extraPermissionNames = permRecords.map((p) => p.name);
    return [...new Set([...basePermissions, ...extraPermissionNames])];
  }

  async buildAuthorizationContext(
    userId: string,
    sessionId: string,
    orgId: string,
    ip?: string,
    userAgent?: string,
  ): Promise<AuthorizationContext | null> {
    const identity = await this.resolveIdentity(userId);
    if (!identity) return null;

    const membership = await this.resolveMembership(userId, orgId);
    if (!membership) return null;

    const permissionList = await this.resolvePermissions(
      userId,
      orgId,
      membership.role,
    );

    const isSuperAdmin = membership.role === LAYER2_ROLES.SUPER_ADMIN;

    return {
      userId,
      sessionId,
      orgId,
      membershipId: membership.membershipId,
      orgRole: membership.role,
      permissions: permissionList,
      isSuperAdmin,
    };
  }

  hasPermission(context: AuthorizationContext, permission: string): boolean {
    if (context.isSuperAdmin) return true;
    return context.permissions.includes(permission);
  }

  hasAnyPermission(context: AuthorizationContext, perms: string[]): boolean {
    if (context.isSuperAdmin) return true;
    return perms.some((p) => context.permissions.includes(p));
  }

  hasAllPermissions(context: AuthorizationContext, perms: string[]): boolean {
    if (context.isSuperAdmin) return true;
    return perms.every((p) => context.permissions.includes(p));
  }

  canAccessResource(
    context: AuthorizationContext,
    resourceOrgId: string,
  ): boolean {
    if (context.isSuperAdmin) return true;
    return context.orgId === resourceOrgId;
  }

  async auditAuthorization(
    context: AuthorizationContext,
    action: string,
    result: 'ALLOW' | 'DENY',
    details?: Record<string, unknown>,
    ip?: string,
    userAgent?: string,
  ) {
    await auditLog({
      orgId: context.orgId,
      userId: context.userId,
      action,
      entityType: 'authorization',
      changes: JSON.stringify({
        result,
        ...details,
      }),
      ipAddress: ip,
      userAgent,
    });
  }
}

export const authorizationService = new AuthorizationService();
