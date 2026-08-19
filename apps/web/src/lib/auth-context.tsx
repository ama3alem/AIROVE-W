'use client';

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { authApi, type SessionData } from '@/lib/api/auth';
import { PERMISSIONS } from '@airove/shared';

interface AuthContextType {
  session: SessionData | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
  hasPermission: (permission: string) => boolean;
  hasAnyPermission: (...permissions: string[]) => boolean;
  switchOrg: (orgId: string) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<SessionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await authApi.getSession();
      setSession(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load session');
      setSession(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const signOut = useCallback(async () => {
    await authApi.signOut();
    setSession(null);
    localStorage.removeItem('airove_org_id');
  }, []);

  const hasPermission = useCallback(
    (permission: string) => {
      if (session?.isSuperAdmin) return true;
      return session?.permissions?.includes(permission) ?? false;
    },
    [session]
  );

  const hasAnyPermission = useCallback(
    (...permissions: string[]) => {
      if (session?.isSuperAdmin) return true;
      return permissions.some((p) => session?.permissions?.includes(p) ?? false);
    },
    [session]
  );

  const switchOrg = useCallback((orgId: string) => {
    localStorage.setItem('airove_org_id', orgId);
    refresh();
  }, [refresh]);

  return (
    <AuthContext.Provider value={{ session, loading, error, refresh, signOut, hasPermission, hasAnyPermission, switchOrg }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    return { session: null, loading: false, error: null, refresh: async () => {}, signOut: async () => {}, hasPermission: () => false, hasAnyPermission: () => false, switchOrg: () => {} } as AuthContextType;
  }
  return ctx;
}

export { PERMISSIONS };
