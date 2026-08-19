'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useApi } from '@/lib/hooks';
import { notificationsApi } from '@/lib/api/organization';
import { PERMISSIONS } from '@airove/shared';

interface NavItem {
  label: string;
  href: string;
  icon: string;
  permissions?: string[];
}

const NAV_SECTIONS: { title: string; items: NavItem[] }[] = [
  {
    title: 'COMMAND CENTER',
    items: [
      { label: 'Dashboard', href: '/', icon: 'M3.75 3v11.25A2.25 2.25 0 0 0 6 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0 1 18 16.5h-2.25m-7.5 0h7.5m-7.5 0-1 3m8.5-3 1 3m0 0 .5 1.5m-.5-1.5h-9.5m0 0-.5 1.5M9 11.25v1.5M12 9v3.75m3-6v6' },
    ],
  },
  {
    title: 'OPERATIONS',
    items: [
      { label: 'Baggage', href: '/baggage', icon: 'M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z', permissions: [PERMISSIONS.BAGGAGE_READ] },
      { label: 'Cases', href: '/cases', icon: 'M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z', permissions: [PERMISSIONS.CASE_READ] },
      { label: 'Recovery', href: '/recovery', icon: 'M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182', permissions: [PERMISSIONS.RECOVERY_PLAN_READ] },
    ],
  },
  {
    title: 'ANALYTICS',
    items: [
      { label: 'Analytics', href: '/analytics', icon: 'M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z', permissions: [PERMISSIONS.ANALYTICS_READ] },
      { label: 'Alerts', href: '/alerts', icon: 'M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0', permissions: [PERMISSIONS.ANALYTICS_READ] },
    ],
  },
  {
    title: 'INTELLIGENCE',
    items: [
      { label: 'Intelligence', href: '/intelligence', icon: 'M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z', permissions: ['intelligence:read'] },
      { label: 'AI Assistant', href: '/assistant', icon: 'M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 01-.825-.242m9.345-8.334a2.126 2.126 0 00-.476-.095 48.64 48.64 0 00-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0011.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155', permissions: ['assistant:use'] },
      { label: 'Action Proposals', href: '/action-proposals', icon: 'M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z', permissions: ['action_proposals:read'] },
      { label: 'Approvals', href: '/approvals', icon: 'M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z', permissions: ['approvals:read'] },
    ],
  },
  {
    title: 'NETWORK',
    items: [
      { label: 'Integrations', href: '/integrations', icon: 'M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m9.86-2.813a4.5 4.5 0 00-1.242-7.244l4.5-4.5a4.5 4.5 0 016.364 6.364l-1.757 1.757', permissions: [PERMISSIONS.INTEGRATION_READ] },
      { label: 'Organization', href: '/organization', icon: 'M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21', permissions: [PERMISSIONS.ORG_READ] },
    ],
  },
  {
    title: 'GOVERNANCE',
    items: [
      { label: 'Audit', href: '/audit', icon: 'M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z', permissions: [PERMISSIONS.AUDIT_READ] },
      { label: 'Notifications', href: '/notifications', icon: 'M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0', permissions: [PERMISSIONS.NOTIFICATION_READ] },
      { label: 'Settings', href: '/settings', icon: 'M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z', permissions: ['settings:read'] },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const { session, hasAnyPermission } = useAuth();
  const { data: notifData } = useApi(
    () => notificationsApi.list({ page: 1, pageSize: 20 }),
    []
  );

  const unreadCount = notifData?.items?.filter((n) => !n.read).length ?? 0;
  const showAssistant = hasAnyPermission('assistant:use');

  function isActive(href: string) {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  }

  function isItemVisible(item: NavItem) {
    if (!item.permissions || item.permissions.length === 0) return true;
    return hasAnyPermission(...item.permissions);
  }

  function getInitials(name: string | null | undefined, email: string | null | undefined) {
    if (name) {
      const parts = name.split(' ').filter((s) => s.length > 0);
      const first = parts[0] ?? '';
      const second = parts[1] ?? '';
      if (first.length > 0 && second.length > 0) return (first[0]! + second[0]!).toUpperCase();
      if (first.length > 0) return first[0]!.toUpperCase();
    }
    if (email && email.length > 0) return email[0]!.toUpperCase();
    return 'U';
  }

  return (
    <aside className={`${collapsed ? 'w-16' : 'w-[260px]'} fixed inset-y-0 left-0 z-30 flex flex-col bg-aviation-950 text-white transition-all duration-200`}>
      <div className="flex h-14 items-center justify-between px-4 border-b border-white/10">
        {!collapsed && (
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-500 text-xs font-bold">AV</div>
            <span className="text-sm font-bold tracking-wide">AIROVE</span>
          </Link>
        )}
        <button onClick={() => setCollapsed(!collapsed)} className="rounded p-1 hover:bg-white/10 text-gray-400 hover:text-white">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            {collapsed ? <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" /> : <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12" />}
          </svg>
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-1">
        {NAV_SECTIONS.map((section) => {
          const visibleItems = section.items.filter(isItemVisible);
          if (visibleItems.length === 0) return null;

          return (
            <div key={section.title} className="mb-3">
              {!collapsed && (
                <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-gray-500">
                  {section.title}
                </div>
              )}
              {visibleItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={isActive(item.href) ? 'sidebar-link-active' : 'sidebar-link'}
                  title={collapsed ? item.label : undefined}
                >
                  <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
                  </svg>
                  {!collapsed && <span>{item.label}</span>}
                  {!collapsed && item.label === 'Notifications' && unreadCount > 0 && (
                    <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  )}
                </Link>
              ))}
            </div>
          );
        })}
      </nav>

      {showAssistant && (
        <div className="px-2 pb-3">
          <Link
            href="/assistant"
            className={`flex items-center gap-3 rounded-xl bg-gradient-to-r from-purple-600 to-violet-600 px-3 py-2.5 text-sm font-semibold text-white shadow-lg shadow-purple-500/25 transition hover:from-purple-500 hover:to-violet-500 hover:shadow-purple-500/40 ${collapsed ? 'justify-center' : ''}`}
            title={collapsed ? 'Ask AI' : undefined}
          >
            <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
            </svg>
            {!collapsed && <span>Ask AI</span>}
          </Link>
        </div>
      )}

      {session?.user && (
        <div className={`border-t border-white/10 px-3 py-3 ${collapsed ? 'flex justify-center' : ''}`}>
          {collapsed ? (
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-500/20 text-xs font-bold text-brand-400" title={`${session.user.name ?? session.user.email}`}>
              {getInitials(session.user.name, session.user.email)}
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-500/20 text-xs font-bold text-brand-400">
                {getInitials(session.user.name, session.user.email)}
              </div>
              <div className="min-w-0">
                <p className="truncate text-xs font-medium text-white">{session.user.name ?? 'User'}</p>
                <p className="truncate text-[10px] text-gray-400">{session.user.email}</p>
              </div>
            </div>
          )}
        </div>
      )}
    </aside>
  );
}
