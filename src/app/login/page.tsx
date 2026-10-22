'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/context/AuthContext';
import Link from 'next/link';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const { login } = useAuth();
  const router = useRouter();

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
      setError(res.error || 'Invalid credentials');
    }
  };

  const fillSeed = (u: string) => {
    setUsername(u);
    setPassword('admin123');
  };

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] flex flex-col justify-center items-center p-4 relative overflow-hidden">
      {/* Background ambient light for weightless spatial vibe */}
      <div className="pointer-events-none fixed top-1/4 left-1/3 w-[500px] h-[500px] rounded-full bg-indigo-600/15 blur-[150px] -z-10" />
      <div className="pointer-events-none fixed bottom-1/4 right-1/3 w-[500px] h-[500px] rounded-full bg-cyan-600/10 blur-[150px] -z-10" />

      {/* Spatial Card Container */}
      <div className="w-full max-w-md glass-panel-elevated rounded-3xl p-8 sm:p-10 shadow-2xl relative z-10 border border-white/10">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-indigo-500/20 to-purple-500/10 border border-indigo-400/40 flex items-center justify-center text-3xl mx-auto mb-4 shadow-[0_0_25px_rgba(99,102,241,0.35)] antigravity-float">
            📦
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">Staff Portal Login</h1>
          <p className="text-xs text-[var(--text-secondary)] mt-1">
            Antigravity Spatial Telemetry & Dispatch Workstation
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-semibold flex items-center gap-2 shadow-lg">
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-1.5">
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. admin, packer1, pickup1"
              required
              className="w-full px-4 py-3 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-subtle)] text-white text-xs focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400/50 transition-all font-medium"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-1.5">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              className="w-full px-4 py-3 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-subtle)] text-white text-xs focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400/50 transition-all font-medium"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full mt-2 py-3.5 px-4 rounded-2xl bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-400 hover:to-indigo-500 text-white font-black text-xs shadow-xl shadow-indigo-500/30 disabled:opacity-50 transition-all flex items-center justify-center gap-2 hover:scale-[1.02]"
          >
            {submitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Authenticating...</span>
              </>
            ) : (
              <span>Sign In to Station →</span>
            )}
          </button>
        </form>

        {/* Quick Demo Credentials */}
        <div className="mt-8 pt-6 border-t border-[var(--border-subtle)]">
          <p className="text-[10px] font-mono font-bold text-[var(--text-muted)] uppercase tracking-widest text-center mb-3">
            Quick Fill Demo Accounts (Password: admin123)
          </p>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => fillSeed('admin')}
              className="py-2 px-2 rounded-xl glass-btn text-xs text-center hover:scale-105"
            >
              <div className="font-bold text-white text-[11px]">admin</div>
              <div className="text-[9px] font-mono text-indigo-400 font-bold">SUPERADMIN</div>
            </button>
            <button
              type="button"
              onClick={() => fillSeed('packer1')}
              className="py-2 px-2 rounded-xl glass-btn text-xs text-center hover:scale-105"
            >
              <div className="font-bold text-white text-[11px]">packer1</div>
              <div className="text-[9px] font-mono text-cyan-400 font-bold">PACKER</div>
            </button>
            <button
              type="button"
              onClick={() => fillSeed('pickup1')}
              className="py-2 px-2 rounded-xl glass-btn text-xs text-center hover:scale-105"
            >
              <div className="font-bold text-white text-[11px]">pickup1</div>
              <div className="text-[9px] font-mono text-emerald-400 font-bold">PICKUP_ADMIN</div>
            </button>
          </div>
        </div>

        {/* Public Kiosk Links */}
        <div className="mt-6 flex items-center justify-between text-xs text-[var(--text-muted)] border-t border-[var(--border-subtle)] pt-4 font-semibold">
          <Link href="/" className="hover:text-amber-400 transition-colors flex items-center gap-1.5">
            <span>🙋‍♂️</span>
            <span>Courier Kiosk</span>
          </Link>
          <Link href="/status" className="hover:text-emerald-400 transition-colors flex items-center gap-1.5">
            <span>📺</span>
            <span>Overhead Board</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
