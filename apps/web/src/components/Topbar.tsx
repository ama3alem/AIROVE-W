'use client';

import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useApi } from '@/lib/hooks';
import { notificationsApi, type Notification } from '@/lib/api/organization';
import { formatRelativeTime, severityColor } from '@/lib/utils';
import Link from 'next/link';

export function Topbar() {
  const { session, signOut } = useAuth();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  const {
    data: notifData,
    loading: notifsLoading,
    refetch,
  } = useApi(() => notificationsApi.list({ page: 1, pageSize: 10 }), []);

  const notifications: Notification[] = notifData?.items ?? [];
  const unreadCount = notifications.filter((n) => !n.read).length;

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node))
        setShowUserMenu(false);
      if (notifRef.current && !notifRef.current.contains(e.target as Node))
        setShowNotifications(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  function handleMarkRead(id: string) {
    notificationsApi.markRead(id).then(() => refetch());
  }

  return (
    <header className="fixed top-0 right-0 left-[260px] z-20 h-14 bg-white border-b border-gray-200 flex items-center justify-between px-6">
      <div className="flex items-center gap-4">
        <div className="relative">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
            />
          </svg>
          <input
            type="text"
            placeholder="Search baggage, cases, recovery..."
            className="input pl-9 w-96 text-xs"
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative rounded-md p-2 text-gray-500 hover:bg-gray-100"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"
              />
            </svg>
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>
          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 rounded-lg border border-gray-200 bg-white shadow-lg">
              <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
                <h3 className="text-sm font-semibold text-gray-900">
                  Notifications
                </h3>
                <Link
                  href="/notifications"
                  className="text-xs text-brand-600 hover:text-brand-700"
                >
                  View all
                </Link>
              </div>
              <div className="max-h-80 overflow-y-auto">
                {notifsLoading ? (
                  <div className="px-4 py-6 text-center text-sm text-gray-500">
                    Loading...
                  </div>
                ) : notifications.length === 0 ? (
                  <div className="px-4 py-6 text-center text-sm text-gray-500">
                    No notifications
                  </div>
                ) : (
                  notifications.map((n) => (
                    <div
                      key={n.id}
                      className={`border-b border-gray-50 px-4 py-3 ${!n.read ? 'bg-brand-50/30' : ''}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-gray-900">
                            {n.title}
                          </p>
                          {n.body && (
                            <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">
                              {n.body}
                            </p>
                          )}
                          <div className="mt-1 flex items-center gap-2">
                            {n.severity && (
                              <span
                                className={`badge ${severityColor(n.severity)} text-[10px]`}
                              >
                                {n.severity}
                              </span>
                            )}
                            <span className="text-[10px] text-gray-400">
                              {formatRelativeTime(n.createdAt)}
                            </span>
                          </div>
                        </div>
                        {!n.read && (
                          <button
                            onClick={() => handleMarkRead(n.id)}
                            className="shrink-0 text-[10px] text-brand-600 hover:text-brand-700 font-medium"
                          >
                            Mark read
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-gray-100"
          >
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">
              {session?.user?.name?.[0]?.toUpperCase() ??
                session?.user?.email?.[0]?.toUpperCase() ??
                'U'}
            </div>
            <div className="text-left">
              <p className="text-xs font-medium text-gray-900">
                {session?.user?.name ?? session?.user?.email}
              </p>
              <p className="text-[10px] text-gray-500">
                {session?.membership?.role ?? 'Member'}
              </p>
            </div>
          </button>
          {showUserMenu && (
            <div className="absolute right-0 mt-2 w-56 rounded-lg border border-gray-200 bg-white shadow-lg py-1">
              <div className="border-b border-gray-100 px-4 py-2">
                <p className="text-sm font-medium text-gray-900">
                  {session?.user?.name}
                </p>
                <p className="text-xs text-gray-500">
                  {session?.user?.email}
                </p>
              </div>
              <Link
                href="/settings"
                className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                Settings
              </Link>
              <Link
                href="/organization"
                className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                Organization
              </Link>
              <hr className="my-1" />
              <button
                onClick={signOut}
                className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-50"
              >
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
