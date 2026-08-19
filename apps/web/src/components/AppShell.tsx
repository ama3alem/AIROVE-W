'use client';

import { AuthProvider } from '@/lib/auth-context';
import { ToastProvider } from '@/components/ToastProvider';
import { Sidebar } from '@/components/Sidebar';
import { Topbar } from '@/components/Topbar';

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <ToastProvider>
        <div className="flex min-h-screen">
          <Sidebar />
          <div className="ml-[260px] flex-1 flex flex-col">
            <Topbar />
            <main className="mt-14 flex-1 overflow-y-auto">
              {children}
            </main>
          </div>
        </div>
      </ToastProvider>
    </AuthProvider>
  );
}
