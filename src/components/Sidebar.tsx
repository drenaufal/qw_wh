'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/context/AuthContext';
import { useTheme, ThemeName } from '@/lib/context/ThemeContext';

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();

  const isSuperAdmin = user?.role_code === 'SUPERADMIN';
  const isPacker = user?.role_code === 'PACKER' || isSuperAdmin;
  const isPickupAdmin = user?.role_code === 'PICKUP_ADMIN' || isSuperAdmin;

  const navItems = [
    {
      name: 'Dashboard',
      href: '/dashboard',
      icon: '📊',
      show: true,
    },
    {
      name: 'Packer Workstation',
      href: '/packing',
      icon: '⚡',
      show: isPacker,
    },
    {
      name: 'Pickup Admin Desk',
      href: '/pickup-admin',
      icon: '🚚',
      show: isPickupAdmin,
    },
    {
      name: 'Order Lifecycle',
      href: '/orders',
      icon: '📦',
      show: true,
    },
    {
      name: 'Overhead TV Board',
      href: '/status',
      icon: '📺',
      show: true,
      external: true,
    },
    {
      name: 'Courier Self-Kiosk',
      href: '/',
      icon: '🙋‍♂️',
      show: true,
      external: true,
    },
    {
      name: 'Staff Accounts',
      href: '/users',
      icon: '👥',
      show: isSuperAdmin,
    },
    {
      name: 'Forensic Audit Logs',
      href: '/audit',
      icon: '🛡️',
      show: isSuperAdmin,
    },
  ];

  const themes: { id: ThemeName; name: string; color: string }[] = [
    { id: 'theme-navy', name: 'Navy', color: '#6366f1' },
    { id: 'theme-slate', name: 'Slate', color: '#0ea5e9' },
    { id: 'theme-charcoal', name: 'Charcoal', color: '#f59e0b' },
  ];

  return (
    <aside className="w-64 flex-shrink-0 bg-[var(--bg-secondary)] backdrop-blur-2xl border-r border-[var(--border-subtle)] flex flex-col justify-between h-screen sticky top-0 z-40 shadow-2xl">
      <div>
        {/* Brand Header */}
        <div className="p-5 border-b border-[var(--border-subtle)] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-500/10 border border-indigo-400/40 flex items-center justify-center text-xl shadow-[0_0_15px_rgba(99,102,241,0.25)]">
              📦
            </div>
            <div>
              <h1 className="font-extrabold text-sm tracking-tight text-white leading-tight">
                Que Warehouse
              </h1>
              <p className="text-[11px] text-[var(--text-muted)] font-mono">Antigravity HUD</p>
            </div>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="p-3.5 space-y-1.5">
          {navItems
            .filter((it) => it.show)
            .map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  target={item.external ? '_blank' : undefined}
                  className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all duration-300 ${
                    isActive
                      ? 'bg-gradient-to-r from-[var(--accent-primary)] to-indigo-600 text-white shadow-[0_10px_20px_-5px_var(--glow-color)] border border-white/20 translate-x-1'
                      : 'text-[var(--text-secondary)] hover:bg-white/[0.04] hover:text-white hover:translate-x-0.5'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-base">{item.icon}</span>
                    <span>{item.name}</span>
                  </div>
                  {item.external && (
                    <span className="text-[9px] uppercase font-mono font-bold px-1.5 py-0.5 rounded-md bg-white/10 text-white/70 border border-white/10">
                      Kiosk
                    </span>
                  )}
                </Link>
              );
            })}
        </nav>
      </div>

      {/* Footer Settings & User Card */}
      <div className="p-4 border-t border-[var(--border-subtle)] space-y-3.5">
        {/* Theme Picker */}
        <div>
          <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)] block mb-1.5">
            Spatial Theme
          </label>
          <div className="grid grid-cols-3 gap-1.5">
            {themes.map((t) => (
              <button
                key={t.id}
                onClick={() => setTheme(t.id)}
                title={t.name}
                className={`flex items-center justify-center py-1.5 px-2 rounded-xl border text-[11px] transition-all font-semibold ${
                  theme === t.id
                    ? 'border-[var(--accent-primary)] bg-[var(--accent-light)] text-white shadow-[0_0_15px_var(--glow-color)]'
                    : 'border-[var(--border-subtle)] bg-white/[0.02] text-[var(--text-muted)] hover:text-white hover:border-white/20'
                }`}
              >
                <span
                  className="w-2.5 h-2.5 rounded-full mr-1.5"
                  style={{ backgroundColor: t.color, boxShadow: `0 0 8px ${t.color}` }}
                />
                <span className="truncate">{t.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* User Card */}
        {user ? (
          <div className="glass-panel p-3 rounded-2xl flex items-center justify-between">
            <div className="overflow-hidden">
              <p className="text-xs font-bold text-white truncate">{user.name}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-[9px] font-mono font-black px-1.5 py-0.2 rounded-md bg-[var(--accent-primary)]/20 text-[var(--accent-primary)] border border-[var(--border-color)]">
                  {user.role_code}
                </span>
                <span className="text-[10px] text-[var(--text-muted)]">@{user.username}</span>
              </div>
            </div>
            <button
              onClick={logout}
              title="Sign Out"
              className="w-8 h-8 rounded-xl bg-white/[0.04] hover:bg-rose-500/20 text-[var(--text-muted)] hover:text-rose-400 flex items-center justify-center border border-white/5 transition-colors"
            >
              🚪
            </button>
          </div>
        ) : (
          <Link
            href="/login"
            className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-gradient-to-r from-[var(--accent-primary)] to-indigo-600 text-white text-xs font-bold shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 transition-all"
          >
            <span>Staff Login</span> →
          </Link>
        )}
      </div>
    </aside>
  );
}
