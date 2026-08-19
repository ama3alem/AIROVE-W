'use client';

import { type ReactNode } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';

export function PageHeader({ title, subtitle, actions, breadcrumbs }: { title: string; subtitle?: string; actions?: ReactNode; breadcrumbs?: Array<{ label: string; href?: string }> }) {
  return (
    <div className="page-header mb-6">
      {breadcrumbs && breadcrumbs.length > 0 && (
        <Breadcrumbs items={breadcrumbs} className="mb-2" />
      )}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="page-title">{title}</h1>
          {subtitle && <p className="page-subtitle">{subtitle}</p>}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}

export function Breadcrumbs({ items, className = '' }: { items: Array<{ label: string; href?: string }>; className?: string }) {
  return (
    <nav className={`flex items-center gap-1.5 text-xs text-gray-500 ${className}`} aria-label="Breadcrumb">
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        return (
          <div key={index} className="flex items-center gap-1.5">
            {index > 0 && <span className="text-gray-400">/</span>}
            {item.href && !isLast ? (
              <Link href={item.href} className="hover:text-brand-600 transition-colors font-medium">
                {item.label}
              </Link>
            ) : (
              <span className={isLast ? 'font-semibold text-gray-800' : ''}>{item.label}</span>
            )}
          </div>
        );
      })}
    </nav>
  );
}

export function PermissionGate({
  permission,
  permissions,
  fallback = null,
  children,
}: {
  permission?: string;
  permissions?: string[];
  fallback?: ReactNode;
  children: ReactNode;
}) {
  const { hasPermission, hasAnyPermission } = useAuth();
  if (permission && !hasPermission(permission)) return <>{fallback}</>;
  if (permissions && permissions.length > 0 && !hasAnyPermission(...permissions)) return <>{fallback}</>;
  return <>{children}</>;
}

export function PermissionButton({
  permission,
  permissions,
  onClick,
  disabled,
  children,
  className = 'btn btn-primary btn-sm',
}: {
  permission?: string;
  permissions?: string[];
  onClick?: () => void;
  disabled?: boolean;
  children: ReactNode;
  className?: string;
}) {
  const { hasPermission, hasAnyPermission } = useAuth();
  const allowed = permission ? hasPermission(permission) : permissions ? hasAnyPermission(...permissions) : true;

  if (!allowed) {
    return (
      <button disabled className={`${className} opacity-50 cursor-not-allowed`} title="You do not have permission for this action">
        {children}
      </button>
    );
  }

  return (
    <button onClick={onClick} disabled={disabled} className={className}>
      {children}
    </button>
  );
}

export function LoadingState({ message = 'Loading operational data...' }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center bg-white rounded-xl border border-gray-200">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
      <p className="mt-3 text-sm text-gray-500 font-medium">{message}</p>
    </div>
  );
}

export function EmptyState({ title = 'No operational data found', message = 'There are no records matching your criteria.', action, icon }: { title?: string; message?: string; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center bg-white rounded-xl border border-gray-200">
      <div className="rounded-full bg-gray-100 p-4 text-gray-400 mb-3">
        {icon ?? (
          <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
          </svg>
        )}
      </div>
      <h3 className="text-base font-semibold text-gray-900">{title}</h3>
      <p className="mt-1 text-sm text-gray-500 max-w-md">{message}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({ title = 'Unable to load operational data', message = 'An unexpected error occurred while fetching details.', onRetry }: { title?: string; message?: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center bg-red-50/50 border border-red-200 rounded-xl">
      <div className="rounded-full bg-red-100 p-3 text-red-600 mb-2">
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      </div>
      <h3 className="text-sm font-semibold text-red-900">{title}</h3>
      <p className="mt-1 text-xs text-red-700 max-w-md">{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="mt-3 btn btn-secondary btn-sm bg-white hover:bg-gray-50 border-red-300 text-red-700">
          Retry Request
        </button>
      )}
    </div>
  );
}

export function UnauthorizedState({ message = 'You do not have permission to view this operational resource.' }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center bg-amber-50/50 border border-amber-200 rounded-xl">
      <div className="rounded-full bg-amber-100 p-3 text-amber-600 mb-2">
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
      </div>
      <h3 className="text-sm font-semibold text-amber-900">Access Restricted</h3>
      <p className="mt-1 text-xs text-amber-700 max-w-md">{message}</p>
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const normalized = status.toLowerCase();
  let variant: 'green' | 'yellow' | 'red' | 'blue' | 'gray' = 'gray';

  if (['delivered', 'resolved', 'closed', 'approved', 'completed', 'active'].includes(normalized)) variant = 'green';
  else if (['delayed', 'pending', 'planning', 'in_transit', 'scheduled', 'in_progress', 'awaiting_approval'].includes(normalized)) variant = 'yellow';
  else if (['missing', 'mishandled', 'misrouted', 'critical', 'escalated', 'failed', 'rejected'].includes(normalized)) variant = 'red';
  else if (['open', 'new', 'replanning'].includes(normalized)) variant = 'blue';

  return <Badge variant={variant}>{status.replace(/_/g, ' ').toUpperCase()}</Badge>;
}

export function PriorityBadge({ priority }: { priority: string }) {
  const normalized = priority.toLowerCase();
  let variant: 'green' | 'yellow' | 'red' | 'gray' = 'gray';

  if (normalized === 'critical' || normalized === 'urgent') variant = 'red';
  else if (normalized === 'high') variant = 'red';
  else if (normalized === 'medium') variant = 'yellow';
  else if (normalized === 'low') variant = 'green';

  return <Badge variant={variant}>{priority.toUpperCase()}</Badge>;
}

export function RiskBadge({ risk }: { risk: string | null | undefined }) {
  if (!risk) return <Badge variant="gray">UNKNOWN</Badge>;
  const normalized = risk.toLowerCase();
  let variant: 'green' | 'yellow' | 'red' | 'gray' = 'gray';

  if (normalized === 'critical' || normalized === 'high') variant = 'red';
  else if (normalized === 'medium') variant = 'yellow';
  else if (normalized === 'low') variant = 'green';

  return <Badge variant={variant}>RISK: {risk.toUpperCase()}</Badge>;
}

export function SLABadge({ compliant, remainingMinutes }: { compliant?: boolean | null; remainingMinutes?: number | null }) {
  if (compliant === false || (remainingMinutes !== undefined && remainingMinutes !== null && remainingMinutes <= 0)) {
    return <Badge variant="red">SLA BREACHED</Badge>;
  }
  if (remainingMinutes !== undefined && remainingMinutes !== null && remainingMinutes <= 60) {
    return <Badge variant="yellow">SLA AT RISK ({remainingMinutes}m)</Badge>;
  }
  if (remainingMinutes !== undefined && remainingMinutes !== null) {
    return <Badge variant="green">SLA OK ({remainingMinutes}m)</Badge>;
  }
  return <Badge variant="gray">SLA MET</Badge>;
}

export function StatCard({ label, value, change, changeType, icon }: { label: string; value: string | number; change?: string; changeType?: 'up' | 'down' | 'neutral'; icon?: ReactNode }) {
  return (
    <div className="stat-card">
      <div className="flex items-start justify-between">
        <div>
          <p className="stat-label">{label}</p>
          <p className="stat-value">{value}</p>
          {change && (
            <p className={`stat-change ${changeType === 'up' ? 'text-emerald-600' : changeType === 'down' ? 'text-red-600' : 'text-gray-500'}`}>
              {changeType === 'up' && '\u2191'}{changeType === 'down' && '\u2193'} {change}
            </p>
          )}
        </div>
        {icon && <div className="rounded-lg bg-gray-50 p-2 text-gray-400">{icon}</div>}
      </div>
    </div>
  );
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`card ${className}`}>{children}</div>;
}

export function CardHeader({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`card-header ${className}`}>{children}</div>;
}

export function CardTitle({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <h3 className={`card-title ${className}`}>{children}</h3>;
}

export function CardBody({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`card-body ${className}`}>{children}</div>;
}

export function Badge({ variant = 'gray', children }: { variant?: 'green' | 'yellow' | 'red' | 'blue' | 'gray'; children: ReactNode }) {
  const map: Record<string, string> = { green: 'badge-green', yellow: 'badge-yellow', red: 'badge-red', blue: 'badge-blue', gray: 'badge-gray' };
  return <span className={`badge ${map[variant]}`}>{children}</span>;
}

export function Tabs({ tabs, active, onChange }: { tabs: Array<{ key: string; label: string; count?: number }>; active: string; onChange: (key: string) => void }) {
  return (
    <div className="border-b border-gray-200">
      <nav className="flex gap-0 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => onChange(tab.key)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
              active === tab.key
                ? 'border-brand-600 text-brand-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">{tab.count}</span>
            )}
          </button>
        ))}
      </nav>
    </div>
  );
}

export function DataTable({ columns, data, onRowClick }: { columns: Array<{ key: string; label: string; render?: (val: unknown, row: Record<string, unknown>) => ReactNode }>; data: Record<string, unknown>[]; onRowClick?: (row: Record<string, unknown>) => void }) {
  return (
    <div className="table-container">
      <table className="table">
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col.key}>{col.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr><td colSpan={columns.length} className="text-center py-8 text-sm text-gray-500">No data</td></tr>
          ) : (
            data.map((row, i) => (
              <tr
                key={i}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={onRowClick ? 'cursor-pointer hover:bg-gray-50' : ''}
              >
                {columns.map((col) => (
                  <td key={col.key}>{col.render ? col.render(row[col.key], row) : String(row[col.key] ?? '-')}</td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

export function Pagination({ page, totalPages, onPageChange }: { page: number; totalPages: number; onPageChange: (p: number) => void }) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
      <p className="text-xs text-gray-500">Page {page} of {totalPages}</p>
      <div className="flex gap-1">
        <button onClick={() => onPageChange(Math.max(1, page - 1))} disabled={page <= 1} className="btn btn-secondary btn-sm">Previous</button>
        <button onClick={() => onPageChange(Math.min(totalPages, page + 1))} disabled={page >= totalPages} className="btn btn-secondary btn-sm">Next</button>
      </div>
    </div>
  );
}

export function ConfirmDialog({ open, title, message, onConfirm, onCancel, variant = 'danger' }: { open: boolean; title: string; message: string; onConfirm: () => void; onCancel: () => void; variant?: 'danger' | 'primary' }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        <p className="mt-2 text-sm text-gray-600">{message}</p>
        <div className="mt-4 flex justify-end gap-3">
          <button onClick={onCancel} className="btn btn-secondary btn-sm">Cancel</button>
          <button onClick={onConfirm} className={`btn btn-sm ${variant === 'danger' ? 'btn-danger' : 'btn-primary'}`}>Confirm</button>
        </div>
      </div>
    </div>
  );
}
