'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/context/AuthContext';
import { Sidebar } from './Sidebar';
import { UserRole } from '@/lib/types';
import { LoadingSpinner, SSEStatusBeacon } from './ui';
import { useSSE } from '@/lib/hooks/useSSE';
import { formatWIB } from '@/lib/utils/datetime';

interface StaffLayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
  allowedRoles?: UserRole[];
  actions?: React.ReactNode;
}

export function StaffLayout({
  children,
  title,
  subtitle,
  allowedRoles,
  actions,
}: StaffLayoutProps) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { isConnected } = useSSE();
  const [currentClock, setCurrentClock] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      setCurrentClock(formatWIB(new Date()));
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg-primary)]">
        <LoadingSpinner text="Connecting to Antigravity Relay..." />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  if (
    allowedRoles &&
    allowedRoles.length > 0 &&
    user.role_code !== 'SUPERADMIN' &&
    !allowedRoles.includes(user.role_code)
  ) {
    return (
      <div className="flex min-h-screen bg-[var(--bg-primary)]">
        <Sidebar />
        <main className="flex-1 p-8 flex flex-col items-center justify-center text-center">
          <div className="w-16 h-16 rounded-2xl bg-rose-500/15 text-rose-400 border border-rose-500/40 flex items-center justify-center text-3xl mb-4 shadow-[0_0_30px_rgba(244,63,94,0.3)]">
            ⛔
          </div>
          <h2 className="text-xl font-extrabold text-white mb-2 tracking-tight">Access Restricted</h2>
          <p className="text-xs text-[var(--text-secondary)] max-w-md mb-6 leading-relaxed">
            Your role (<span className="text-amber-400 font-mono font-bold">{user.role_code}</span>) is not permitted to access this workstation module.
          </p>
          <button
            onClick={() => router.push('/dashboard')}
            className="px-5 py-2.5 bg-gradient-to-r from-[var(--accent-primary)] to-indigo-600 text-white text-xs font-bold rounded-xl shadow-lg shadow-indigo-500/25 transition-all hover:scale-105"
          >
            Return to Dashboard
          </button>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] relative overflow-hidden">
      {/* Ambient background light orbs for spatial depth */}
      <div className="pointer-events-none fixed top-[-20%] left-[-10%] w-[500px] h-[500px] rounded-full bg-[var(--accent-light)] blur-[120px] opacity-40 -z-10" />
      <div className="pointer-events-none fixed bottom-[-20%] right-[-10%] w-[600px] h-[600px] rounded-full bg-[var(--glow-color)] blur-[140px] opacity-30 -z-10" />

      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Operational Bar */}
        <header className="h-16 bg-[var(--bg-secondary)] backdrop-blur-2xl border-b border-[var(--border-subtle)] px-8 flex items-center justify-between sticky top-0 z-30 shadow-md">
          <div>
            <h1 className="text-base font-extrabold text-white tracking-tight flex items-center gap-2">
              <span>{title}</span>
            </h1>
            {subtitle && <p className="text-[11px] text-[var(--text-muted)]">{subtitle}</p>}
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-2 font-mono text-xs text-slate-300 glass-panel px-3.5 py-1.5 rounded-xl border border-[var(--border-subtle)]">
              <span className="text-[var(--accent-primary)]">🕒</span>
              <span>{currentClock}</span>
            </div>

            <SSEStatusBeacon isConnected={isConnected} />

            {actions && <div className="flex items-center gap-2">{actions}</div>}
          </div>
        </header>

        {/* Workspace Body */}
        <main className="flex-1 p-8 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
