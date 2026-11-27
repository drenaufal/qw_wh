'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/context/AuthContext';
import Link from 'next/link';
import { AlertTriangle, ArrowRight, UserCheck, Tv } from 'lucide-react';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const { user, loading, login } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      router.replace('/dashboard');
    }
  }, [user, loading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) return;

    setSubmitting(true);
    setError(null);

    const res = await login(username, password);
    setSubmitting(false);

    if (res.success) {
      router.push('/dashboard');
    } else {
      setError(res.error || 'Username atau password tidak sesuai');
    }
  };

  const fillSeed = (u: string) => {
    setUsername(u);
    setPassword('admin123');
  };

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-md rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 sm:p-8 shadow-sm">
        <div className="text-center mb-6">
          <div className="w-28 h-16 rounded-xl bg-white border border-[var(--border-subtle)] flex items-center justify-center mx-auto mb-3 p-1.5 shadow-xs overflow-hidden">
            <img
              src="/logowh.png"
              alt="Logo Warehouse Queue"
              className="w-full h-full object-contain scale-110"
            />
          </div>
          <h1 className="text-xl font-bold text-[var(--text-primary)] tracking-tight">
            Portal Masuk Staf Gudang
          </h1>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            Sistem Pengepakan, Pickup Kurir & Monitoring Antrian
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-300 text-xs font-semibold flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[var(--text-primary)] mb-1">
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Contoh: admin, packer1, pickup1"
              required
              className="w-full px-3.5 py-2.5 rounded-lg bg-[var(--bg-card)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-xs focus:outline-none focus:border-[var(--accent-primary)] font-medium"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[var(--text-primary)] mb-1">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              className="w-full px-3.5 py-2.5 rounded-lg bg-[var(--bg-card)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-xs focus:outline-none focus:border-[var(--accent-primary)] font-medium"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full mt-2 py-2.5 px-4 rounded-lg bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white font-bold text-xs shadow-sm disabled:opacity-50 transition-colors flex items-center justify-center gap-2 min-h-[44px]"
          >
            {submitting ? (
              <span>Memverifikasi Akun...</span>
            ) : (
              <span className="flex items-center gap-1.5">
                <span>Masuk ke Dashboard Staf</span>
                <ArrowRight className="w-4 h-4" />
              </span>
            )}
          </button>
        </form>

        {/* Quick Demo Credentials */}
        {/* <div className="mt-6 pt-5 border-t border-[var(--border-subtle)]">
          <p className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider text-center mb-2.5">
            Akun Cepat Uji Coba (Password: admin123)
          </p>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => fillSeed('admin')}
              className="py-2 px-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] hover:bg-[var(--bg-card-hover)] text-xs text-center transition-colors"
            >
              <div className="font-bold text-[var(--text-primary)] text-xs">admin</div>
              <div className="text-[10px] text-[var(--text-muted)]">SUPERADMIN</div>
            </button>
            <button
              type="button"
              onClick={() => fillSeed('packer1')}
              className="py-2 px-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] hover:bg-[var(--bg-card-hover)] text-xs text-center transition-colors"
            >
              <div className="font-bold text-[var(--text-primary)] text-xs">packer1</div>
              <div className="text-[10px] text-[var(--text-muted)]">PACKER</div>
            </button>
            <button
              type="button"
              onClick={() => fillSeed('pickup1')}
              className="py-2 px-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] hover:bg-[var(--bg-card-hover)] text-xs text-center transition-colors"
            >
              <div className="font-bold text-[var(--text-primary)] text-xs">pickup1</div>
              <div className="text-[10px] text-[var(--text-muted)]">PICKUP_ADMIN</div>
            </button>
          </div>
        </div> */}

        {/* Public Kiosk Links */}
        <div className="mt-5 flex items-center justify-between text-xs text-[var(--text-muted)] border-t border-[var(--border-subtle)] pt-3 font-medium">
          <Link href="/kiosk" className="hover:text-[var(--accent-primary)] transition-colors flex items-center gap-1.5">
            <UserCheck className="w-3.5 h-3.5" />
            <span>Kiosk Kurir</span>
          </Link>
          <Link href="/status" className="hover:text-[var(--accent-primary)] transition-colors flex items-center gap-1.5">
            <Tv className="w-3.5 h-3.5" />
            <span>Monitor TV Antrian</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
