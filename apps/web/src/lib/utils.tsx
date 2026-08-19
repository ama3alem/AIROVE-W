'use client';

import type { ReactNode } from 'react';

export function formatDate(date: Date | string | null): string {
  if (!date) return '-';
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

export function formatDateTime(date: Date | string | null): string {
  if (!date) return '-';
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function formatRelativeTime(date: Date | string | null): string {
  if (!date) return '-';
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;
  const diffD = Math.floor(diffH / 24);
  return `${diffD}d ago`;
}

export function formatMinutes(minutes: number | null): string {
  if (minutes === null || minutes === undefined) return '-';
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export function formatPercent(value: number | null): string {
  if (value === null || value === undefined) return '-';
  return `${(value * 100).toFixed(1)}%`;
}

export function priorityColor(priority: string): string {
  switch (priority) {
    case 'critical': return 'badge-red';
    case 'high': return 'badge-yellow';
    case 'medium': return 'badge-blue';
    case 'low': return 'badge-gray';
    default: return 'badge-gray';
  }
}

export function statusColor(status: string): string {
  switch (status) {
    case 'active':
    case 'open':
    case 'in_progress':
    case 'in_transit':
      return 'badge-green';
    case 'pending':
    case 'triaged':
    case 'assigned':
    case 'investigating':
    case 'awaiting_approval':
    case 'planning':
    case 'options_available':
      return 'badge-yellow';
    case 'resolved':
    case 'completed':
    case 'closed':
    case 'delivered':
    case 'executed':
      return 'badge-blue';
    case 'failed':
    case 'cancelled':
    case 'breached':
      return 'badge-red';
    case 'paused':
    case 'blocked':
      return 'badge-gray';
    default:
      return 'badge-gray';
  }
}

export function confidenceColor(level: string): string {
  switch (level) {
    case 'VERY_HIGH':
    case 'HIGH': return 'confidence-high';
    case 'MEDIUM': return 'confidence-medium';
    case 'LOW':
    case 'VERY_LOW': return 'confidence-low';
    default: return 'text-gray-500';
  }
}

export function severityColor(severity: string): string {
  switch (severity) {
    case 'critical': return 'badge-red';
    case 'high': return 'badge-red';
    case 'warning': return 'badge-yellow';
    case 'medium': return 'badge-yellow';
    case 'low': return 'badge-blue';
    case 'info': return 'badge-gray';
    default: return 'badge-gray';
  }
}

export function EmptyState({ title, description, icon }: { title: string; description: string; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      {icon && <div className="mb-3 text-gray-400">{icon}</div>}
      <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
      <p className="mt-1 text-sm text-gray-500">{description}</p>
    </div>
  );
}

export function LoadingSpinner({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizeClasses = { sm: 'h-4 w-4', md: 'h-6 w-6', lg: 'h-8 w-8' };
  return (
    <div className="flex items-center justify-center py-8">
      <div className={`${sizeClasses[size]} animate-spin rounded-full border-2 border-gray-300 border-t-brand-600`} />
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="mb-3 text-red-400">
        <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0zm-9 3.75h.008v.008H12v-.008z" /></svg>
      </div>
      <h3 className="text-sm font-semibold text-gray-900">Something went wrong</h3>
      <p className="mt-1 text-sm text-gray-500">{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="btn btn-secondary btn-sm mt-3">Retry</button>
      )}
    </div>
  );
}
