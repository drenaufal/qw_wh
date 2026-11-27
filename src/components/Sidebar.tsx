'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/context/AuthContext';
import { useTheme } from '@/lib/context/ThemeContext';
import {
  LayoutDashboard,
  Package,
  Truck,
  ClipboardList,
  CheckCircle2,
  Tv,
  UserCheck,
  Users,
  ShieldCheck,
  Sun,
  Moon,
  LogOut,
  Volume2,
} from 'lucide-react';
import { TVAudioSettingsModal } from './TVAudioSettingsModal';

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { setTheme, isLight } = useTheme();
  const [isAudioModalOpen, setIsAudioModalOpen] = useState(false);

  const isSuperAdmin = user?.role_code === 'SUPERADMIN';
  const userPermissions = user?.role_permissions || [];
  const isPickupAdmin = user?.role_code === 'PICKUP_ADMIN' || isSuperAdmin || userPermissions.includes('/pickup-admin');

  const checkAccess = (path: string) => {
    if (isSuperAdmin) return true;
    return userPermissions.includes(path);
  };

  const navItems = [
    {
      name: 'Dashboard Operasional',
      href: '/dashboard',
      icon: LayoutDashboard,
      badge: 'LIVE',
      show: checkAccess('/dashboard'),
    },
    {
      name: 'Meja Packing',
      href: '/packing',
      icon: Package,
      badge: 'STASIUN',
      show: checkAccess('/packing'),
    },
    {
      name: 'Loket Pickup Driver',
      href: '/pickup-admin',
      icon: Truck,
      badge: 'DOCK',
      show: checkAccess('/pickup-admin'),
    },
    {
      name: 'Antrian Order Aktif',
      href: '/orders',
      icon: ClipboardList,
      badge: 'ANTREAN',
      show: checkAccess('/orders'),
    },
    {
      name: 'Riwayat Terkirim',
      href: '/shipped-orders',
      icon: CheckCircle2,
      badge: 'BUKTI',
      show: checkAccess('/shipped-orders'),
    },
    {
      name: 'Layar Monitor TV',
      href: '/status',
      icon: Tv,
      badge: 'OVERHEAD',
      show: checkAccess('/status'),
      external: true,
    },
    {
      name: 'Monitor Pickup & Penerima',
      href: '/status-pickup',
      icon: Tv,
      badge: 'PICKUP TV',
      show: checkAccess('/status-pickup'),
      external: true,
    },
    {
      name: 'Kiosk Kedatangan Driver',
      href: '/kiosk',
      icon: UserCheck,
      badge: 'TOUCH',
      show: checkAccess('/kiosk'),
      external: true,
    },
    {
      name: 'Kelola Akun & Peran',
      href: '/users',
      icon: Users,
      badge: 'AKSES',
      show: checkAccess('/users'),
    },
    {
      name: 'Log Audit Sistem',
      href: '/audit',
      icon: ShieldCheck,
      badge: 'LOG',
      show: checkAccess('/audit'),
    },
  ];

  return (
    <aside className="w-64 flex-shrink-0 bg-[var(--bg-surface)] border-r border-[var(--border-subtle)] flex flex-col justify-between h-screen sticky top-0 z-40">
      <div>
        {/* Brand Header */}
        <div className="p-4 border-b border-[var(--border-subtle)] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[var(--accent-primary)] text-white flex items-center justify-center text-lg font-bold shadow-sm">
              WH
            </div>
            <div>
              <h2 className="text-sm font-bold text-[var(--text-primary)] leading-tight">
                Warehouse Queue
              </h2>
              <p className="text-[11px] text-[var(--text-muted)] font-medium">
                Sistem Pengepakan & Pickup
              </p>
            </div>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="p-3 space-y-1 overflow-y-auto max-h-[calc(100vh-200px)]">
          {navItems
            .filter((item) => item.show)
            .map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  target={item.external ? '_blank' : undefined}
                  className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                    isActive
                      ? 'bg-[var(--accent-subtle)] text-[var(--accent-primary)] font-semibold border border-[var(--border-accent)]'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)]'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <item.icon className="w-4 h-4 shrink-0" />
                    <span>{item.name}</span>
                  </div>
                  {item.badge && (
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                        isActive
                          ? 'bg-[var(--accent-primary)] text-white'
                          : 'bg-[var(--bg-primary)] text-[var(--text-muted)] border border-[var(--border-subtle)]'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}

          {(isPickupAdmin || isSuperAdmin) && (
            <div className="pt-2 mt-2 border-t border-[var(--border-subtle)]">
              <button
                type="button"
                onClick={() => setIsAudioModalOpen(true)}
                className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium text-amber-700 dark:text-amber-400 border border-amber-300/40 dark:border-amber-800/40 hover:bg-amber-500/10 transition-colors"
                title="Atur nada & volume speaker TV monitor antrian"
              >
                <div className="flex items-center gap-2.5">
                  <Volume2 className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  <span>Suara Monitor TV</span>
                </div>
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-800 dark:text-amber-300">
                  AUDIO
                </span>
              </button>
            </div>
          )}
        </nav>
      </div>

      <TVAudioSettingsModal
        isOpen={isAudioModalOpen}
        onClose={() => setIsAudioModalOpen(false)}
      />

      {/* Footer Controls: Theme Toggle & User Info */}
      <div className="p-3 border-t border-[var(--border-subtle)] space-y-2 bg-[var(--bg-surface)]">
        {/* Theme Toggle (Light / Dark) */}
        <div className="flex items-center justify-between p-1.5 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-subtle)]">
          <span className="text-xs font-medium text-[var(--text-secondary)] px-1.5">
            Tema
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setTheme('theme-light')}
              className={`px-2 py-1 rounded text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                isLight
                  ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-sm'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}
              title="Aktifkan Tema Terang"
            >
              <Sun className="w-3.5 h-3.5" />
              <span>Terang</span>
            </button>
            <button
              onClick={() => setTheme('theme-dark')}
              className={`px-2 py-1 rounded text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                !isLight
                  ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-sm'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}
              title="Aktifkan Tema Gelap"
            >
              <Moon className="w-3.5 h-3.5" />
              <span>Gelap</span>
            </button>
          </div>
        </div>

        {/* User Status & Logout */}
        {user && (
          <div className="flex items-center justify-between pt-1 px-1">
            <div className="truncate pr-2">
              <p className="text-xs font-semibold text-[var(--text-primary)] truncate">
                {user.name || user.username}
              </p>
              <p className="text-[10px] text-[var(--text-muted)] font-mono">
                {user.role_code}
              </p>
            </div>
            <button
              onClick={logout}
              title="Keluar dari akun"
              className="text-xs text-[var(--text-muted)] hover:text-rose-600 font-semibold px-2 py-1 rounded border border-[var(--border-subtle)] hover:border-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors flex items-center gap-1"
            >
              <LogOut className="w-3 h-3" />
              <span>Keluar</span>
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
