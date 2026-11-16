'use client';

import React from 'react';
import { Package } from 'lucide-react';
import { OrderStatus, PriorityStatus } from '@/lib/types';
import { AntigravityCard } from './AntigravityCard';

export { AntigravityCard };

export function StatusBadge({ status }: { status: OrderStatus }) {
  const config: Record<OrderStatus, { label: string; className: string; dot: string }> = {
    WAITING: {
      label: 'Menunggu',
      className: 'bg-[var(--status-waiting-bg)] text-[var(--status-waiting-text)] border-[var(--status-waiting-border)]',
      dot: 'bg-slate-400',
    },
    PACKING: {
      label: 'Sedang Dipacking',
      className: 'bg-[var(--status-packing-bg)] text-[var(--status-packing-text)] border-[var(--status-packing-border)]',
      dot: 'bg-sky-500',
    },
    READY_FOR_PICKUP: {
      label: 'Siap Pickup',
      className: 'bg-[var(--status-ready-bg)] text-[var(--status-ready-text)] border-[var(--status-ready-border)] font-semibold',
      dot: 'bg-emerald-500',
    },
    SHIP: {
      label: 'Telah Dikirim',
      className: 'bg-[var(--status-shipped-bg)] text-[var(--status-shipped-text)] border-[var(--status-shipped-border)]',
      dot: 'bg-purple-500',
    },
  };

  const item = config[status] || {
    label: status,
    className: 'bg-[var(--status-waiting-bg)] text-[var(--status-waiting-text)] border-[var(--status-waiting-border)]',
    dot: 'bg-slate-400',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-medium border ${item.className}`}
    >
      <span className={`w-2 h-2 rounded-full ${item.dot}`} />
      <span>{item.label}</span>
    </span>
  );
}

export function PriorityBadge({
  priority,
  showLabel = true,
  queueNumber,
}: {
  priority: PriorityStatus;
  showLabel?: boolean;
  queueNumber?: number | null;
}) {
  if (priority === 'NORMAL') return null;

  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-bold bg-[var(--status-priority-bg)] text-[var(--status-priority-text)] border border-[var(--status-priority-border)]">
      <span className="w-2 h-2 rounded-full bg-amber-500" />
      <span>
        {queueNumber
          ? `Antrean #${queueNumber}`
          : showLabel
          ? 'Kurir Menunggu di Loket'
          : 'Prioritas'}
      </span>
    </span>
  );
}

export function StatCard({
  label,
  value,
  icon,
  subtext,
  color = 'indigo',
}: {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  subtext?: string;
  color?: 'indigo' | 'emerald' | 'amber' | 'cyan' | 'purple' | 'slate';
}) {
  return (
    <div className="p-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] shadow-sm hover:border-[var(--border-strong)] transition-all flex flex-col justify-between">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
            {label}
          </p>
          <p className="text-2xl font-bold mt-1 text-[var(--text-primary)] tracking-tight">
            {value}
          </p>
          {subtext && (
            <p className="text-xs text-[var(--text-muted)] mt-1">{subtext}</p>
          )}
        </div>
        <div className="w-10 h-10 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-subtle)] flex items-center justify-center text-lg text-[var(--text-secondary)] shrink-0">
          {icon}
        </div>
      </div>
    </div>
  );
}

export function SSEStatusBeacon({ isConnected }: { isConnected: boolean }) {
  return (
    <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md text-xs font-semibold border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-secondary)]">
      <span
        className={`w-2 h-2 rounded-full ${
          isConnected ? 'bg-emerald-500' : 'bg-rose-500'
        }`}
      />
      <span>{isConnected ? 'Real-time Aktif' : 'Offline'}</span>
    </div>
  );
}

export function LoadingSpinner({ text }: { text?: string }) {
  return (
    <div className="flex flex-col items-center justify-center p-8 gap-3 text-[var(--text-secondary)]">
      <div className="w-8 h-8 rounded-full border-2 border-[var(--border-subtle)] border-t-[var(--accent-primary)] animate-spin" />
      {text && <span className="text-xs font-medium text-[var(--text-muted)]">{text}</span>}
    </div>
  );
}

export function EmptyState({
  title,
  message,
  icon,
  action,
}: {
  title?: string;
  message: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center rounded-xl border border-dashed border-[var(--border-subtle)] bg-[var(--bg-card)]">
      <div className="w-12 h-12 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-subtle)] flex items-center justify-center mb-2 text-[var(--text-secondary)]">
        {icon || <Package className="w-6 h-6 text-[var(--text-muted)]" />}
      </div>
      {title && <h4 className="text-sm font-semibold text-[var(--text-primary)] mb-1">{title}</h4>}
      <p className="text-xs text-[var(--text-muted)] max-w-sm mb-3 leading-relaxed">{message}</p>
      {action}
    </div>
  );
}
