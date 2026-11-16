'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/context/AuthContext';
import { Sidebar } from './Sidebar';
import { UserRole } from '@/lib/types';
import { LoadingSpinner, SSEStatusBeacon } from './ui';
import { useSSE } from '@/lib/hooks/useSSE';
import { formatWIB } from '@/lib/utils/datetime';
import { ShieldAlert, Clock } from 'lucide-react';

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
        <LoadingSpinner text="Memuat data operasional..." />
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
      <div className="flex min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
        <Sidebar />
        <main className="flex-1 p-6 flex flex-col items-center justify-center text-center">
          <div className="w-14 h-14 rounded-xl bg-rose-100 dark:bg-rose-950/40 text-rose-600 border border-rose-200 dark:border-rose-900 flex items-center justify-center mb-4">
            <ShieldAlert className="w-7 h-7" />
          </div>
          <h2 className="text-lg font-bold text-[var(--text-primary)] mb-1">Akses Dibatasi</h2>
          <p className="text-xs text-[var(--text-secondary)] max-w-md mb-5 leading-relaxed">
            Peran akun Anda (<span className="font-semibold text-amber-600 dark:text-amber-400 font-mono">{user.role_code}</span>) tidak memiliki izin untuk modul ini.
          </p>
          <button
            onClick={() => router.push('/dashboard')}
            className="px-4 py-2 bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white text-xs font-semibold rounded-lg shadow-sm transition-colors"
          >
            Kembali ke Dashboard
          </button>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Operational Command Bar */}
        <header className="h-14 bg-[var(--bg-surface)] border-b border-[var(--border-subtle)] px-6 flex items-center justify-between sticky top-0 z-30">
          <div className="flex items-center gap-3">
            <div>
              <h1 className="text-sm sm:text-base font-bold text-[var(--text-primary)] leading-tight">
                {title}
              </h1>
              {subtitle && (
                <p className="text-[11px] text-[var(--text-muted)] font-normal">{subtitle}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            {actions}
            <div className="text-xs font-mono font-medium text-[var(--text-secondary)] hidden md:flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-[var(--text-muted)]" />
              <span>{currentClock || 'WIB'}</span>
            </div>
            <SSEStatusBeacon isConnected={isConnected} />
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 p-4 sm:p-6 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
