'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Plus, X } from 'lucide-react';
import { StaffLayout } from '@/components/StaffLayout';
import { User, UserRole } from '@/lib/types';
import { formatWIB } from '@/lib/utils/datetime';

export default function UsersManagementPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  // New staff form state
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [roleCode, setRoleCode] = useState<UserRole>('PACKER');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    try {
      const token = localStorage.getItem('wh_auth_token');
      const res = await fetch('/api/users', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleToggleActive = async (user: User) => {
    try {
      const token = localStorage.getItem('wh_auth_token');
      const res = await fetch(`/api/users/${user.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ is_active: !user.is_active }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update user');
      await fetchUsers();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMsg(null);
    try {
      const token = localStorage.getItem('wh_auth_token');
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          name: name.trim(),
          username: username.trim(),
          password,
          role_code: roleCode,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create user');

      setIsCreateOpen(false);
      setName('');
      setUsername('');
      setPassword('');
      await fetchUsers();
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const getRoleBadge = (role: UserRole) => {
    const map: Record<UserRole, string> = {
      SUPERADMIN: 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800',
      PACKER: 'bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-800',
      PICKUP_ADMIN: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
    };
    return (
      <span className={`inline-flex px-2 py-0.5 rounded text-[11px] font-mono font-bold border ${map[role]}`}>
        {role}
      </span>
    );
  };

  return (
    <StaffLayout
      title="Manajemen Pengguna & Hak Akses"
      subtitle="Pengaturan akun staf gudang, penetapan hak akses peran (RBAC), dan aktivasi akun"
      allowedRoles={['SUPERADMIN']}
      actions={
        <button
          onClick={() => {
            setIsCreateOpen(true);
            setErrorMsg(null);
          }}
          className="px-3.5 py-2 rounded-lg bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white font-bold text-xs shadow-sm transition-colors flex items-center gap-1.5"
        >
          <Plus className="w-4 h-4" />
          <span>Tambah Akun Staf</span>
        </button>
      }
    >
      <div className="space-y-6">
        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[var(--bg-primary)] text-[var(--text-muted)] uppercase tracking-wider font-semibold border-b border-[var(--border-subtle)]">
                <tr>
                  <th className="px-4 py-3">Nama Lengkap</th>
                  <th className="px-4 py-3">Username</th>
                  <th className="px-4 py-3">Peran Akses</th>
                  <th className="px-4 py-3">Login Terakhir</th>
                  <th className="px-4 py-3">Status Akun</th>
                  <th className="px-4 py-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)] text-[var(--text-secondary)]">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-[var(--bg-card-hover)] transition-colors">
                    <td className="px-4 py-3 font-semibold text-[var(--text-primary)]">{u.name}</td>
                    <td className="px-4 py-3 font-mono text-[var(--text-secondary)]">@{u.username}</td>
                    <td className="px-4 py-3">{getRoleBadge(u.role_code)}</td>
                    <td className="px-4 py-3 font-mono text-xs text-[var(--text-muted)]">
                      {formatWIB(u.last_login_at)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          u.is_active
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${u.is_active ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                        {u.is_active ? 'ACTIVE' : 'DEACTIVATED'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => handleToggleActive(u)}
                        className={`px-3 py-1 rounded-xl border text-xs font-semibold transition-all ${
                          u.is_active
                            ? 'bg-rose-500/10 hover:bg-rose-500/20 border-rose-500/30 text-rose-300'
                            : 'bg-emerald-500/10 hover:bg-emerald-500/20 border-emerald-500/30 text-emerald-300'
                        }`}
                      >
                        {u.is_active ? 'Deactivate' : 'Reactivate'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* PROVISION USER MODAL */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass-panel-elevated border-indigo-500/50 rounded-3xl max-w-md w-full shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border-subtle)]">
              <h3 className="text-base font-black text-white tracking-tight">
                Provision New Logistics Staff
              </h3>
              <button
                onClick={() => setIsCreateOpen(false)}
                className="text-[var(--text-muted)] hover:text-white transition-colors"
                title="Tutup"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {errorMsg && (
              <div className="p-3.5 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-1">
                  Full Name <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. John Packer"
                  required
                  className="w-full px-4 py-2.5 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-subtle)] text-white text-xs"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-1">
                  Username <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. packer2"
                  required
                  className="w-full px-4 py-2.5 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-subtle)] text-white text-xs font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-1">
                  Temporary Password <span className="text-rose-400">*</span>
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min 6 characters"
                  required
                  minLength={6}
                  className="w-full px-4 py-2.5 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-subtle)] text-white text-xs"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-1">
                  Role Assignment
                </label>
                <select
                  value={roleCode}
                  onChange={(e) => setRoleCode(e.target.value as UserRole)}
                  className="w-full px-4 py-2.5 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-subtle)] text-white text-xs"
                >
                  <option value="PACKER">PACKER (Workstation Verification)</option>
                  <option value="PICKUP_ADMIN">PICKUP_ADMIN (Staging Bay & Dispatch)</option>
                  <option value="SUPERADMIN">SUPERADMIN (Full Privileges)</option>
                </select>
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="flex-1 py-2.5 px-4 rounded-2xl glass-btn text-xs text-[var(--text-secondary)]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-2 py-2.5 px-5 rounded-2xl bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-400 hover:to-indigo-500 text-white font-black text-xs disabled:opacity-50 shadow-lg shadow-indigo-500/25"
                >
                  {submitting ? 'Creating...' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </StaffLayout>
  );
}
