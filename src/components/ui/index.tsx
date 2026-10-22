'use client';

import React from 'react';
import { OrderStatus, PriorityStatus } from '@/lib/types';
import { AntigravityCard } from './AntigravityCard';

export { AntigravityCard };

export function StatusBadge({ status }: { status: OrderStatus }) {
  const config: Record<OrderStatus, { label: string; className: string; dot: string }> = {
    WAITING: {
      label: 'Waiting',
      className: 'bg-slate-500/15 text-slate-300 border-slate-500/30 shadow-[0_0_12px_rgba(148,163,184,0.15)]',
      dot: 'bg-slate-400',
    },
    PACKING: {
      label: 'In Packing',
      className: 'bg-cyan-500/15 text-cyan-300 border-cyan-400/30 shadow-[0_0_14px_rgba(6,182,212,0.2)]',
      dot: 'bg-cyan-400 animate-pulse',
    },
    READY_FOR_PICKUP: {
      label: 'Ready for Pickup',
      className: 'bg-emerald-500/15 text-emerald-300 border-emerald-400/30 shadow-[0_0_14px_rgba(16,185,129,0.2)]',
      dot: 'bg-emerald-400 animate-ping',
    },
    SHIP: {
      label: 'Shipped',
      className: 'bg-purple-500/15 text-purple-300 border-purple-400/30 shadow-[0_0_14px_rgba(168,85,247,0.2)]',
      dot: 'bg-purple-400',
    },
  };

  const item = config[status] || {
    label: status,
    className: 'bg-slate-800 text-slate-300 border-slate-700',
    dot: 'bg-slate-400',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold tracking-wider uppercase border backdrop-blur-md ${item.className}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${item.dot}`} />
      {item.label}
    </span>
  );
}

export function PriorityBadge({
  priority,
  showLabel = true,
}: {
  priority: PriorityStatus;
  showLabel?: boolean;
}) {
  if (priority === 'NORMAL') return null;

  return (
    <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-extrabold bg-amber-500/15 text-amber-300 border border-amber-400/50 backdrop-blur-md shadow-[0_0_20px_rgba(245,158,11,0.35)] glow-amber-3d">
      <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
      {showLabel ? 'Courier Waiting' : 'Waiting'}
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
  const colorMap = {
    indigo: {
      glow: 'rgba(99, 102, 241, 0.25)',
      border: 'border-indigo-500/30 hover:border-indigo-400/60',
      iconBg: 'bg-indigo-500/15 border-indigo-400/30 text-indigo-400 shadow-[0_0_20px_rgba(99,102,241,0.3)]',
    },
    emerald: {
      glow: 'rgba(16, 185, 129, 0.25)',
      border: 'border-emerald-500/30 hover:border-emerald-400/60',
      iconBg: 'bg-emerald-500/15 border-emerald-400/30 text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.3)]',
    },
    amber: {
      glow: 'rgba(245, 158, 11, 0.25)',
      border: 'border-amber-500/30 hover:border-amber-400/60',
      iconBg: 'bg-amber-500/15 border-amber-400/30 text-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.3)]',
    },
    cyan: {
      glow: 'rgba(6, 182, 212, 0.25)',
      border: 'border-cyan-500/30 hover:border-cyan-400/60',
      iconBg: 'bg-cyan-500/15 border-cyan-400/30 text-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.3)]',
    },
    purple: {
      glow: 'rgba(168, 85, 247, 0.25)',
      border: 'border-purple-500/30 hover:border-purple-400/60',
      iconBg: 'bg-purple-500/15 border-purple-400/30 text-purple-400 shadow-[0_0_20px_rgba(168,85,247,0.3)]',
    },
    slate: {
      glow: 'rgba(148, 163, 184, 0.15)',
      border: 'border-slate-700/50 hover:border-slate-500/60',
      iconBg: 'bg-slate-800/50 border-slate-600/30 text-slate-400',
    },
  };

  const themeConfig = colorMap[color];

  return (
    <AntigravityCard
      glowColor={themeConfig.glow}
      className={`glass-panel p-5 ${themeConfig.border} flex flex-col justify-between`}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-widest">
            {label}
          </p>
          <p className="text-3xl font-black mt-1.5 text-white tracking-tight drop-shadow-md">
            {value}
          </p>
          {subtext && (
            <p className="text-xs text-[var(--text-secondary)] mt-1">{subtext}</p>
          )}
        </div>
        <div
          className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl border backdrop-blur-xl ${themeConfig.iconBg}`}
        >
          {icon}
        </div>
      </div>
    </AntigravityCard>
  );
}

export function SSEStatusBeacon({ isConnected }: { isConnected: boolean }) {
  return (
    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold tracking-wider glass-panel border border-[var(--border-subtle)] backdrop-blur-xl">
      <span className="relative flex h-2.5 w-2.5">
        <span
          className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
            isConnected ? 'bg-emerald-400' : 'bg-rose-500'
          }`}
        />
        <span
          className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
            isConnected ? 'bg-emerald-500' : 'bg-rose-500'
          }`}
        />
      </span>
      <span className={isConnected ? 'text-emerald-300' : 'text-rose-400'}>
        {isConnected ? 'LIVE SYNC' : 'OFFLINE'}
      </span>
    </div>
  );
}

export function LoadingSpinner({ text }: { text?: string }) {
  return (
    <div className="flex flex-col items-center justify-center p-12 gap-4 text-[var(--text-secondary)]">
      <div className="relative w-12 h-12">
        <div className="absolute inset-0 rounded-full border-2 border-[var(--accent-primary)]/20" />
        <div className="absolute inset-0 rounded-full border-2 border-t-[var(--accent-primary)] border-transparent animate-spin" />
      </div>
      {text && <span className="text-xs font-semibold tracking-wider uppercase">{text}</span>}
    </div>
  );
}

export function EmptyState({
  title,
  message,
  icon = '📦',
  action,
}: {
  title?: string;
  message: string;
  icon?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center rounded-2xl border border-dashed border-[var(--border-subtle)] bg-[var(--bg-card)] backdrop-blur-xl">
      <div className="w-16 h-16 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] flex items-center justify-center text-3xl mb-3 shadow-lg">
        {icon}
      </div>
      {title && <h4 className="text-base font-bold text-white mb-1 tracking-tight">{title}</h4>}
      <p className="text-xs text-[var(--text-secondary)] max-w-sm mb-4 leading-relaxed">{message}</p>
      {action}
    </div>
  );
}
