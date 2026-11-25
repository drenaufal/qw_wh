'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Plus,
  X,
  Users,
  ShieldCheck,
  Check,
  CheckSquare,
  Square,
  Trash2,
  Edit3,
  AlertTriangle,
  Lock,
} from 'lucide-react';
import { StaffLayout } from '@/components/StaffLayout';
import { User, Role } from '@/lib/types';
import { formatWIB } from '@/lib/utils/datetime';
import { AVAILABLE_MENUS } from '@/lib/constants/menus';

export default function UsersManagementPage() {
  const [activeTab, setActiveTab] = useState<'USERS' | 'ROLES'>('USERS');

  // Users State
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);

  // User Create Modal State
  const [isCreateUserOpen, setIsCreateUserOpen] = useState(false);
  const [userName, setUserName] = useState('');
  const [userUsername, setUserUsername] = useState('');
  const [userPassword, setUserPassword] = useState('');
  const [userRoleCode, setUserRoleCode] = useState<string>('PACKER');

  // Role Create / Edit Modal State
  const [isCreateRoleOpen, setIsCreateRoleOpen] = useState(false);
  const [editRole, setEditRole] = useState<Role | null>(null);
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleCode, setNewRoleCode] = useState('');
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);

  // Feedback State
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

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
      console.error('Failed to fetch users:', e);
    }
  }, []);

  const fetchRoles = useCallback(async () => {
    try {
      const token = localStorage.getItem('wh_auth_token');
      const res = await fetch('/api/roles', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const data = await res.json();
        setRoles(data.roles || []);
      }
    } catch (e) {
      console.error('Failed to fetch roles:', e);
    }
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchUsers(), fetchRoles()]);
    setLoading(false);
  }, [fetchUsers, fetchRoles]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const showNotification = (msg: string, isError = false) => {
    if (isError) {
      setErrorMsg(msg);
      setTimeout(() => setErrorMsg(null), 6000);
    } else {
      setSuccessMsg(msg);
      setTimeout(() => setSuccessMsg(null), 5000);
    }
  };

  // Toggle user active status
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
      if (!res.ok) throw new Error(data.error || 'Gagal mengubah status pengguna');
      showNotification(`Status akun @${user.username} berhasil diubah.`);
      await fetchUsers();
    } catch (err: any) {
      showNotification(err.message, true);
    }
  };

  // Create User
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
          name: userName.trim(),
          username: userUsername.trim(),
          password: userPassword,
          role_code: userRoleCode,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal membuat pengguna');

      showNotification(`Akun staf @${userUsername.trim()} berhasil dibuat!`);
      setIsCreateUserOpen(false);
      setUserName('');
      setUserUsername('');
      setUserPassword('');
      await loadAll();
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Open Create Role Modal
  const openCreateRole = () => {
    setNewRoleName('');
    setNewRoleCode('');
    // Default select Dashboard
    setSelectedPermissions(['/dashboard']);
    setErrorMsg(null);
    setIsCreateRoleOpen(true);
  };

  // Open Edit Role Modal
  const openEditRole = (role: Role) => {
    setEditRole(role);
    setNewRoleName(role.name);
    setSelectedPermissions(role.permissions || []);
    setErrorMsg(null);
  };

  // Toggle single permission checkbox
  const togglePermission = (path: string) => {
    setSelectedPermissions((prev) =>
      prev.includes(path) ? prev.filter((p) => p !== path) : [...prev, path]
    );
  };

  // Select all / Deselect all
  const selectAllPermissions = () => {
    setSelectedPermissions(AVAILABLE_MENUS.map((m) => m.path));
  };

  const clearAllPermissions = () => {
    setSelectedPermissions([]);
  };

  // Submit Create Role
  const handleCreateRole = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMsg(null);
    try {
      const token = localStorage.getItem('wh_auth_token');
      const res = await fetch('/api/roles', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          name: newRoleName.trim(),
          code: newRoleCode.trim(),
          permissions: selectedPermissions,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal membuat peran');

      showNotification(`Peran "${newRoleName.trim()}" berhasil dibuat!`);
      setIsCreateRoleOpen(false);
      await fetchRoles();
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Submit Edit Role
  const handleUpdateRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editRole) return;
    setSubmitting(true);
    setErrorMsg(null);
    try {
      const token = localStorage.getItem('wh_auth_token');
      const res = await fetch(`/api/roles/${editRole.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          name: newRoleName.trim(),
          permissions: selectedPermissions,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal memperbarui peran');

      showNotification(`Hak akses peran "${newRoleName.trim()}" berhasil diperbarui!`);
      setEditRole(null);
      await Promise.all([fetchRoles(), fetchUsers()]);
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Delete Role
  const handleDeleteRole = async (role: Role) => {
    if (!confirm(`Apakah Anda yakin ingin menghapus peran "${role.name}" (${role.code})?`)) {
      return;
    }

    try {
      const token = localStorage.getItem('wh_auth_token');
      const res = await fetch(`/api/roles/${role.id}`, {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menghapus peran');

      showNotification(`Peran "${role.name}" berhasil dihapus.`);
      await fetchRoles();
    } catch (err: any) {
      showNotification(err.message, true);
    }
  };

  const getRoleBadge = (code: string) => {
    switch (code) {
      case 'SUPERADMIN':
        return 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800';
      case 'PACKER':
        return 'bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-800';
      case 'PICKUP_ADMIN':
        return 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800';
      default:
        return 'bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800';
    }
  };

  return (
    <StaffLayout
      title="Manajemen Pengguna & Hak Akses Peran"
      subtitle="Pengaturan akun staf gudang, pembuatan peran kustom (RBAC), dan konfigurasi menu yang diizinkan"
      allowedRoles={['SUPERADMIN']}
      actions={
        activeTab === 'USERS' ? (
          <button
            onClick={() => {
              setIsCreateUserOpen(true);
              setErrorMsg(null);
            }}
            className="px-3.5 py-2 rounded-lg bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white font-bold text-xs shadow-sm transition-colors flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Akun Staf</span>
          </button>
        ) : (
          <button
            onClick={openCreateRole}
            className="px-3.5 py-2 rounded-lg bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white font-bold text-xs shadow-sm transition-colors flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Peran Baru</span>
          </button>
        )
      }
    >
      <div className="space-y-5">
        {/* Toast Notifikasi Sukses / Error */}
        {errorMsg && (
          <div className="p-3.5 rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-300 text-xs font-semibold flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
            <button onClick={() => setErrorMsg(null)} className="text-rose-600 hover:text-rose-800 text-xs font-bold">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {successMsg && (
          <div className="p-3.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 text-emerald-800 dark:text-emerald-300 text-xs font-semibold flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{successMsg}</span>
            </div>
            <button onClick={() => setSuccessMsg(null)} className="text-emerald-600 hover:text-emerald-800 text-xs font-bold">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Tab Selector */}
        <div className="flex items-center gap-2 border-b border-[var(--border-subtle)] pb-2">
          <button
            type="button"
            onClick={() => setActiveTab('USERS')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === 'USERS'
                ? 'bg-[var(--accent-primary)] text-white shadow-xs'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)]'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Daftar Akun Pengguna ({users.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('ROLES')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === 'ROLES'
                ? 'bg-[var(--accent-primary)] text-white shadow-xs'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)]'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Kelola Peran & Hak Akses Menu ({roles.length})</span>
          </button>
        </div>

        {/* TAB 1: USERS MANAGEMENT */}
        {activeTab === 'USERS' && (
          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[var(--bg-primary)] text-[var(--text-muted)] uppercase tracking-wider font-semibold border-b border-[var(--border-subtle)]">
                  <tr>
                    <th className="px-4 py-3">Nama Lengkap</th>
                    <th className="px-4 py-3">Username</th>
                    <th className="px-4 py-3">Peran Akses</th>
                    <th className="px-4 py-3">Menu Diizinkan</th>
                    <th className="px-4 py-3">Login Terakhir</th>
                    <th className="px-4 py-3">Status Akun</th>
                    <th className="px-4 py-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-subtle)] text-[var(--text-secondary)]">
                  {users.map((u) => {
                    const permCount = u.role_code === 'SUPERADMIN' ? AVAILABLE_MENUS.length : (u.role_permissions?.length || 0);
                    return (
                      <tr key={u.id} className="hover:bg-[var(--bg-card-hover)] transition-colors">
                        <td className="px-4 py-3 font-semibold text-[var(--text-primary)]">{u.name}</td>
                        <td className="px-4 py-3 font-mono text-[var(--text-secondary)]">@{u.username}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex px-2 py-0.5 rounded text-[11px] font-mono font-bold border ${getRoleBadge(
                              u.role_code
                            )}`}
                          >
                            {u.role_name || u.role_code}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[var(--bg-subtle)] border border-[var(--border-subtle)] font-mono text-[11px] text-[var(--text-secondary)]">
                            <strong>{permCount}</strong> dari {AVAILABLE_MENUS.length} menu
                          </span>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-[var(--text-muted)]">
                          {formatWIB(u.last_login_at)}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                              u.is_active
                                ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                                : 'bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30'
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                u.is_active ? 'bg-emerald-500' : 'bg-rose-500'
                              }`}
                            />
                            {u.is_active ? 'ACTIVE' : 'DEACTIVATED'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => handleToggleActive(u)}
                            className={`px-3 py-1 rounded-lg border text-xs font-semibold transition-all ${
                              u.is_active
                                ? 'bg-rose-50 hover:bg-rose-100 border-rose-200 text-rose-700 dark:bg-rose-950/30 dark:border-rose-900 dark:text-rose-300'
                                : 'bg-emerald-50 hover:bg-emerald-100 border-emerald-200 text-emerald-700 dark:bg-emerald-950/30 dark:border-emerald-900 dark:text-emerald-300'
                            }`}
                          >
                            {u.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 2: ROLES & PERMISSIONS MANAGEMENT */}
        {activeTab === 'ROLES' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {roles.map((role) => {
              const isSuper = role.code === 'SUPERADMIN';
              const isSystem = ['SUPERADMIN', 'PACKER', 'PICKUP_ADMIN'].includes(role.code);
              const allowedPaths = isSuper ? AVAILABLE_MENUS.map((m) => m.path) : role.permissions || [];
              const userCount = role.user_count || 0;

              return (
                <div
                  key={role.id}
                  className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4 shadow-sm flex flex-col justify-between space-y-4 hover:border-[var(--border-accent)] transition-all"
                >
                  <div className="space-y-2.5">
                    {/* Role Header */}
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="text-sm font-bold text-[var(--text-primary)] leading-tight flex items-center gap-1.5">
                          <span>{role.name}</span>
                          {isSuper && (
                            <span title="Akses Penuh Terproteksi">
                              <Lock className="w-3.5 h-3.5 text-indigo-500" />
                            </span>
                          )}
                        </h4>
                        <span
                          className={`inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${getRoleBadge(
                            role.code
                          )}`}
                        >
                          {role.code}
                        </span>
                      </div>
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[var(--bg-subtle)] text-[var(--text-muted)] border border-[var(--border-subtle)]">
                        {userCount} Staf
                      </span>
                    </div>

                    {/* Permission Menus Preview */}
                    <div>
                      <p className="text-[11px] font-semibold text-[var(--text-muted)] mb-1.5">
                        Menu yang Dapat Dibuka ({allowedPaths.length}/{AVAILABLE_MENUS.length}):
                      </p>
                      <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto pr-1">
                        {AVAILABLE_MENUS.map((menu) => {
                          const hasAccess = allowedPaths.includes(menu.path);
                          return (
                            <span
                              key={menu.key}
                              className={`text-[10px] px-2 py-0.5 rounded font-medium border flex items-center gap-1 ${
                                hasAccess
                                  ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
                                  : 'bg-[var(--bg-primary)] border-[var(--border-subtle)] text-[var(--text-muted)] opacity-50'
                              }`}
                            >
                              {hasAccess ? <Check className="w-3 h-3 text-emerald-600" /> : <X className="w-3 h-3 text-slate-400" />}
                              <span>{menu.name}</span>
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="pt-3 border-t border-[var(--border-subtle)] flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => openEditRole(role)}
                      className="flex-1 py-1.5 px-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-primary)] hover:bg-[var(--bg-card-hover)] text-xs font-semibold text-[var(--text-primary)] flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <Edit3 className="w-3.5 h-3.5 text-indigo-500" />
                      <span>{isSuper ? 'Lihat Izin' : 'Edit Hak Akses'}</span>
                    </button>

                    {!isSystem && (
                      <button
                        type="button"
                        onClick={() => handleDeleteRole(role)}
                        disabled={userCount > 0}
                        title={
                          userCount > 0
                            ? `Tidak dapat dihapus: masih digunakan oleh ${userCount} staf`
                            : 'Hapus peran kustom ini'
                        }
                        className="py-1.5 px-2.5 rounded-lg border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/30 hover:bg-rose-100 dark:hover:bg-rose-900/40 text-rose-700 dark:text-rose-300 text-xs font-semibold flex items-center justify-center transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* MODAL 1: TAMBAH AKUN PENGGUNA */}
      {isCreateUserOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] max-w-md w-full shadow-xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border-subtle)]">
              <h3 className="text-base font-bold text-[var(--text-primary)]">
                Tambah Akun Staf Baru
              </h3>
              <button
                type="button"
                onClick={() => setIsCreateUserOpen(false)}
                className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-[var(--text-primary)] mb-1">
                  Nama Lengkap Staf <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  placeholder="Contoh: Ahmad Fadli"
                  required
                  className="w-full px-3 py-2 rounded-lg bg-[var(--bg-card)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-xs focus:outline-none focus:border-[var(--accent-primary)] font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-primary)] mb-1">
                  Username <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={userUsername}
                  onChange={(e) => setUserUsername(e.target.value)}
                  placeholder="Contoh: ahmad_packer"
                  required
                  className="w-full px-3 py-2 rounded-lg bg-[var(--bg-card)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-xs focus:outline-none focus:border-[var(--accent-primary)] font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-primary)] mb-1">
                  Password <span className="text-rose-500">*</span>
                </label>
                <input
                  type="password"
                  value={userPassword}
                  onChange={(e) => setUserPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full px-3 py-2 rounded-lg bg-[var(--bg-card)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-xs focus:outline-none focus:border-[var(--accent-primary)] font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-primary)] mb-1">
                  Peran Akses (Role) <span className="text-rose-500">*</span>
                </label>
                <select
                  value={userRoleCode}
                  onChange={(e) => setUserRoleCode(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[var(--bg-card)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-xs focus:outline-none focus:border-[var(--accent-primary)] font-medium"
                >
                  {roles.map((r) => (
                    <option key={r.id} value={r.code}>
                      {r.name} ({r.code})
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-[var(--text-muted)] mt-1">
                  Peran ini menentukan menu apa saja yang dapat dibuka staf setelah login.
                </p>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreateUserOpen(false)}
                  className="py-2 px-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-card-hover)]"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="py-2 px-4 rounded-lg bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white text-xs font-bold disabled:opacity-50 transition-colors"
                >
                  {submitting ? 'Menyimpan...' : 'Simpan Akun Staf'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: BUAT PERAN BARU */}
      {isCreateRoleOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] max-w-lg w-full shadow-xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border-subtle)]">
              <h3 className="text-base font-bold text-[var(--text-primary)]">
                Buat Peran Baru (Custom Role)
              </h3>
              <button
                type="button"
                onClick={() => setIsCreateRoleOpen(false)}
                className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateRole} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[var(--text-primary)] mb-1">
                  Nama Peran <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={newRoleName}
                  onChange={(e) => setNewRoleName(e.target.value)}
                  placeholder="Contoh: Supervisor Gudang"
                  required
                  className="w-full px-3 py-2 rounded-lg bg-[var(--bg-card)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-xs focus:outline-none focus:border-[var(--accent-primary)] font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-primary)] mb-1">
                  Kode Peran (Huruf Kapital & Unik) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={newRoleCode}
                  onChange={(e) => setNewRoleCode(e.target.value.toUpperCase())}
                  placeholder="Contoh: SUPERVISOR_WH"
                  required
                  className="w-full px-3 py-2 rounded-lg bg-[var(--bg-card)] border border-[var(--border-subtle)] text-[var(--text-primary)] font-mono text-xs focus:outline-none focus:border-[var(--accent-primary)] font-bold uppercase"
                />
                <p className="text-[10px] text-[var(--text-muted)] mt-1">
                  Kode identitas peran di sistem (misal: LEAD_PACKER, MONITOR_STAFF).
                </p>
              </div>

              {/* Menu Checkboxes */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-semibold text-[var(--text-primary)]">
                    Pilih Menu yang Diizinkan:
                  </label>
                  <div className="flex items-center gap-2 text-xs">
                    <button
                      type="button"
                      onClick={selectAllPermissions}
                      className="text-indigo-600 dark:text-indigo-400 hover:underline font-semibold"
                    >
                      Pilih Semua
                    </button>
                    <span className="text-[var(--border-subtle)]">|</span>
                    <button
                      type="button"
                      onClick={clearAllPermissions}
                      className="text-[var(--text-muted)] hover:underline"
                    >
                      Kosongkan
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5 border border-[var(--border-subtle)] rounded-lg p-2.5 max-h-56 overflow-y-auto bg-[var(--bg-card)]">
                  {AVAILABLE_MENUS.map((menu) => {
                    const isChecked = selectedPermissions.includes(menu.path);
                    return (
                      <label
                        key={menu.key}
                        className={`flex items-start gap-2.5 p-2 rounded-lg cursor-pointer transition-colors ${
                          isChecked
                            ? 'bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-800/40'
                            : 'hover:bg-[var(--bg-card-hover)] border border-transparent'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => togglePermission(menu.path)}
                          className="mt-0.5 text-emerald-600 dark:text-emerald-400"
                        >
                          {isChecked ? (
                            <CheckSquare className="w-4 h-4 text-emerald-600 fill-emerald-100 dark:fill-emerald-950" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-400" />
                          )}
                        </button>
                        <div className="flex-1 text-xs" onClick={() => togglePermission(menu.path)}>
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-[var(--text-primary)]">{menu.name}</span>
                            <span className="font-mono text-[10px] text-[var(--text-muted)]">{menu.path}</span>
                          </div>
                          <p className="text-[11px] text-[var(--text-muted)] mt-0.5">{menu.description}</p>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreateRoleOpen(false)}
                  className="py-2 px-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-card-hover)]"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting || !newRoleName.trim() || !newRoleCode.trim()}
                  className="py-2 px-4 rounded-lg bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white text-xs font-bold disabled:opacity-50 transition-colors"
                >
                  {submitting ? 'Menyimpan...' : 'Simpan Peran'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: EDIT PERAN & HAK AKSES */}
      {editRole && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] max-w-lg w-full shadow-xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border-subtle)]">
              <div>
                <h3 className="text-base font-bold text-[var(--text-primary)]">
                  Edit Hak Akses Menu: {editRole.name}
                </h3>
                <span className="font-mono text-[11px] text-[var(--text-muted)]">
                  Kode: {editRole.code}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setEditRole(null)}
                className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateRole} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[var(--text-primary)] mb-1">
                  Nama Peran
                </label>
                <input
                  type="text"
                  value={newRoleName}
                  onChange={(e) => setNewRoleName(e.target.value)}
                  required
                  className="w-full px-3 py-2 rounded-lg bg-[var(--bg-card)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-xs focus:outline-none focus:border-[var(--accent-primary)] font-medium"
                />
              </div>

              {editRole.code === 'SUPERADMIN' ? (
                <div className="p-3.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 text-indigo-800 dark:text-indigo-300 text-xs font-medium space-y-1">
                  <div className="flex items-center gap-1.5 font-bold">
                    <Lock className="w-4 h-4 text-indigo-600" />
                    <span>Peran SUPERADMIN Memiliki Akses Penuh</span>
                  </div>
                  <p className="text-[11px]">
                    Role ini dilindungi untuk mencegah administrator terkunci keluar dari sistem. Seluruh menu aplikasi otomatis aktif untuk akun SUPERADMIN.
                  </p>
                </div>
              ) : (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-xs font-semibold text-[var(--text-primary)]">
                      Centang Menu yang Diizinkan:
                    </label>
                    <div className="flex items-center gap-2 text-xs">
                      <button
                        type="button"
                        onClick={selectAllPermissions}
                        className="text-indigo-600 dark:text-indigo-400 hover:underline font-semibold"
                      >
                        Pilih Semua
                      </button>
                      <span className="text-[var(--border-subtle)]">|</span>
                      <button
                        type="button"
                        onClick={clearAllPermissions}
                        className="text-[var(--text-muted)] hover:underline"
                      >
                        Kosongkan
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1.5 border border-[var(--border-subtle)] rounded-lg p-2.5 max-h-56 overflow-y-auto bg-[var(--bg-card)]">
                    {AVAILABLE_MENUS.map((menu) => {
                      const isChecked = selectedPermissions.includes(menu.path);
                      return (
                        <label
                          key={menu.key}
                          className={`flex items-start gap-2.5 p-2 rounded-lg cursor-pointer transition-colors ${
                            isChecked
                              ? 'bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-800/40'
                              : 'hover:bg-[var(--bg-card-hover)] border border-transparent'
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => togglePermission(menu.path)}
                            className="mt-0.5 text-emerald-600 dark:text-emerald-400"
                          >
                            {isChecked ? (
                              <CheckSquare className="w-4 h-4 text-emerald-600 fill-emerald-100 dark:fill-emerald-950" />
                            ) : (
                              <Square className="w-4 h-4 text-slate-400" />
                            )}
                          </button>
                          <div className="flex-1 text-xs" onClick={() => togglePermission(menu.path)}>
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-[var(--text-primary)]">{menu.name}</span>
                              <span className="font-mono text-[10px] text-[var(--text-muted)]">{menu.path}</span>
                            </div>
                            <p className="text-[11px] text-[var(--text-muted)] mt-0.5">{menu.description}</p>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditRole(null)}
                  className="py-2 px-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-card-hover)]"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting || !newRoleName.trim()}
                  className="py-2 px-4 rounded-lg bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white text-xs font-bold disabled:opacity-50 transition-colors"
                >
                  {submitting ? 'Menyimpan...' : 'Perbarui Hak Akses'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </StaffLayout>
  );
}
