import { api } from './client';

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  platformRole: string | null;
  status: string;
}

export interface SessionData {
  user: AuthUser;
  session: {
    id: string;
    userId: string;
    expiresAt: Date;
  };
  org: {
    id: string;
    name: string;
    slug: string;
    type: string;
  } | null;
  membership: {
    id: string;
    orgId: string;
    userId: string;
    role: string;
    status: string;
  } | null;
  permissions: string[];
  roles: string[];
  isSuperAdmin: boolean;
}

export interface OrgMembershipInfo {
  id: string;
  orgId: string;
  userId: string;
  role: string;
  status: string;
  org?: { id: string; name: string; slug: string; type: string };
}

export const authApi = {
  async getSession(): Promise<SessionData | null> {
    try {
      const data = await api.get<{ session: SessionData['session']; user: AuthUser; organization: SessionData['org']; membership: OrgMembershipInfo; permissions: string[]; roles: string[]; isSuperAdmin: boolean }>('/auth/session');
      return {
        user: data.user,
        session: data.session,
        org: data.organization ?? null,
        membership: data.membership ?? null,
        permissions: data.permissions ?? [],
        roles: data.roles ?? [],
        isSuperAdmin: data.isSuperAdmin ?? false,
      };
    } catch {
      return null;
    }
  },

  async signIn(email: string, password: string) {
    return api.post<{ user: AuthUser; session: unknown }>('/auth/sign-in', { email, password });
  },

  async signUp(email: string, password: string, name: string) {
    return api.post<{ user: AuthUser }>('/auth/sign-up', { email, password, name });
  },

  async signOut() {
    return api.post('/auth/sign-out');
  },
};
