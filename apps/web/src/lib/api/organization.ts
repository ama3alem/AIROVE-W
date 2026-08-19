import { api, type PaginatedData, type PaginationParams } from './client';

export interface Organization {
  id: string;
  name: string;
  slug: string;
  type: string;
  status: string;
  metadata: string | null;
  createdAt: Date;
}

export interface User {
  id: string;
  email: string;
  name: string | null;
  platformRole: string | null;
  status: string;
  lastLoginAt: Date | null;
  createdAt: Date;
  membership?: OrgMembershipInfo;
}

export interface OrgMembershipInfo {
  id: string;
  orgId: string;
  userId: string;
  role: string;
  status: string;
}

export interface Role {
  id: string;
  name: string;
  displayName: string;
  description: string | null;
  isSystem: boolean;
  isPlatform: boolean;
  status: string;
  permissions?: string[];
  createdAt: Date;
}

export interface Invitation {
  id: string;
  orgId: string;
  email: string;
  role: string;
  status: string;
  expiresAt: Date;
  acceptedAt: Date | null;
  createdAt: Date;
}

export interface AuditLog {
  id: string;
  orgId: string;
  userId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  entityRef: string | null;
  changes: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
}

export interface Notification {
  id: string;
  orgId: string;
  userId: string;
  title: string;
  body: string | null;
  type: string;
  severity: string;
  read: boolean;
  readAt: Date | null;
  entityType: string | null;
  entityId: string | null;
  createdAt: Date;
}

export const organizationApi = {
  list() {
    return api.get<Organization[]>('/organizations');
  },

  get(id: string) {
    return api.get<Organization>(`/organizations/${id}`);
  },

  update(id: string, data: { name?: string }) {
    return api.patch<Organization>(`/organizations/${id}`, data);
  },
};

export const usersApi = {
  list(params?: PaginationParams) {
    return api.get<PaginatedData<User>>('/users', params as Record<string, string | number | undefined>);
  },

  get(userId: string) {
    return api.get<User>(`/users/${userId}`);
  },

  updateMembership(userId: string, data: { role?: string }) {
    return api.patch<OrgMembershipInfo>(`/users/${userId}/membership`, data);
  },

  suspend(userId: string) {
    return api.post<{ status: string }>(`/users/${userId}/suspend`);
  },
};

export const rolesApi = {
  list(params?: PaginationParams) {
    return api.get<PaginatedData<Role>>('/roles', params as Record<string, string | number | undefined>);
  },

  get(id: string) {
    return api.get<Role>(`/roles/${id}`);
  },

  create(data: { name: string; displayName: string; description?: string; permissionIds?: string[] }) {
    return api.post<Role>('/roles', data);
  },

  deleteRole(id: string) {
    return api.delete(`/roles/${id}`);
  },

  assign(data: { userId: string; roleId: string }) {
    return api.post('/roles/assign', data);
  },
};

export const invitationsApi = {
  list(params?: PaginationParams) {
    return api.get<PaginatedData<Invitation>>('/invitations', params as Record<string, string | number | undefined>);
  },

  create(data: { email: string; role: string }) {
    return api.post<{ id: string; token: string }>('/invitations', data);
  },

  accept(token: string) {
    return api.post('/invitations/accept', { token });
  },
};

export const auditApi = {
  list(params?: PaginationParams & { entityType?: string; action?: string }) {
    return api.get<PaginatedData<AuditLog>>('/audit', params as Record<string, string | number | undefined>);
  },
};

export const notificationsApi = {
  list(params?: PaginationParams) {
    return api.get<PaginatedData<Notification>>('/notifications', params as Record<string, string | number | undefined>);
  },

  markRead(id: string) {
    return api.patch<Notification>(`/notifications/${id}/read`);
  },
};
