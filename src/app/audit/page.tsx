'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Search, X } from 'lucide-react';
import { StaffLayout } from '@/components/StaffLayout';
import { AuditLog } from '@/lib/types';
import { formatWIB } from '@/lib/utils/datetime';

export default function ForensicAuditPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState('');
  const [entityFilter, setEntityFilter] = useState('');
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  const fetchLogs = useCallback(async () => {
    try {
      const token = localStorage.getItem('wh_auth_token');
      let url = '/api/audit-logs?limit=100';
      if (actionFilter) url += `&action=${actionFilter}`;
      if (entityFilter) url += `&entity_type=${entityFilter}`;

      const res = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [actionFilter, entityFilter]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  return (
    <StaffLayout
      title="Log Audit Aktivitas & Mutasi Sistem"
      subtitle="Catatan riwayat perubahan status transaksi, pengguna yang melakukan aksi, dan selisih data"
      allowedRoles={['SUPERADMIN']}
    >
      <div className="space-y-6">
        {/* Filter bar */}
        <div className="p-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] flex flex-wrap items-center gap-3 shadow-sm">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-[var(--text-muted)]">Tipe Aksi:</span>
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-xs focus:outline-none focus:border-[var(--accent-primary)] font-medium"
            >
              <option value="">Semua Aksi</option>
              <option value="USER_LOGIN">USER_LOGIN</option>
              <option value="ORDER_CREATED">ORDER_CREATED</option>
              <option value="DRIVER_ARRIVAL">DRIVER_ARRIVAL</option>
              <option value="PACKING_STARTED">PACKING_STARTED</option>
              <option value="PACKING_COMPLETED">PACKING_COMPLETED</option>
              <option value="ORDER_PICKUP_HANDOVER">ORDER_PICKUP_HANDOVER</option>
              <option value="PRIORITY_OVERRIDE">PRIORITY_OVERRIDE</option>
              <option value="USER_CREATED">USER_CREATED</option>
              <option value="USER_UPDATED">USER_UPDATED</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-[var(--text-muted)]">Entitas:</span>
            <select
              value={entityFilter}
              onChange={(e) => setEntityFilter(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-xs focus:outline-none focus:border-[var(--accent-primary)] font-medium"
            >
              <option value="">Semua Entitas</option>
              <option value="ORDER">ORDER</option>
              <option value="USER">USER</option>
            </select>
          </div>

          <span className="text-xs text-[var(--text-muted)] ml-auto font-mono">
            Total log: <span className="text-[var(--text-primary)] font-bold">{logs.length}</span> aktivitas
          </span>
        </div>

        {/* Logs Table */}
        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[var(--bg-primary)] text-[var(--text-muted)] uppercase tracking-wider font-semibold border-b border-[var(--border-subtle)]">
                <tr>
                  <th className="px-4 py-3">Waktu (WIB)</th>
                  <th className="px-4 py-3">Pelaku</th>
                  <th className="px-4 py-3">Tipe Aksi</th>
                  <th className="px-4 py-3">Entitas</th>
                  <th className="px-4 py-3">ID Entitas</th>
                  <th className="px-4 py-3 text-right">Detail Diff</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)] text-[var(--text-secondary)]">
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-[var(--text-muted)]">
                      No audit events recorded matching current filters.
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <tr key={log.id} className="hover:bg-white/[0.03] transition-colors">
                      <td className="px-6 py-4 font-mono text-[11px] text-[var(--text-muted)]">
                        {formatWIB(log.created_at)}
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-bold text-white block">{log.actor_name || 'System'}</span>
                        <span className="text-[10px] text-[var(--text-muted)] font-mono">
                          [{log.actor_type}]
                        </span>
                      </td>
                      <td className="px-6 py-4 font-mono font-bold text-amber-400">
                        {log.action}
                      </td>
                      <td className="px-6 py-4 font-semibold text-slate-300">
                        {log.entity_type}
                      </td>
                      <td className="px-6 py-4 font-mono text-[10px] text-[var(--text-muted)]">
                        {log.entity_id ? log.entity_id.substring(0, 13) + '...' : '-'}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => setSelectedLog(log)}
                          className="px-3.5 py-1.5 rounded-xl glass-btn text-xs font-bold text-slate-300 hover:text-white inline-flex items-center gap-1.5"
                        >
                          <Search className="w-3.5 h-3.5 text-slate-400" />
                          <span>Inspect Diff</span>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* JSON STATE DIFF VIEWER MODAL */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass-panel-elevated border-indigo-500/50 rounded-3xl max-w-3xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 bg-white/[0.03] border-b border-[var(--border-subtle)] flex items-center justify-between">
              <div>
                <h3 className="text-base font-black text-white font-mono">
                  Diff: {selectedLog.action}
                </h3>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">
                  Actor: {selectedLog.actor_name} • {formatWIB(selectedLog.created_at)}
                </p>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="text-[var(--text-muted)] hover:text-white transition-colors"
                title="Tutup"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 flex-1 font-mono text-xs">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Old Values */}
                <div className="bg-slate-950/80 rounded-2xl p-4 border border-rose-500/30 shadow-inner">
                  <div className="flex items-center gap-2 mb-2 text-rose-400 font-bold uppercase tracking-wider text-[10px]">
                    <span>- OLD STATE</span>
                  </div>
                  <pre className="text-slate-300 whitespace-pre-wrap break-all overflow-x-auto text-[11px]">
                    {selectedLog.old_values
                      ? JSON.stringify(selectedLog.old_values, null, 2)
                      : '<INITIAL / NULL>'}
                  </pre>
                </div>

                {/* New Values */}
                <div className="bg-slate-950/80 rounded-2xl p-4 border border-emerald-500/30 shadow-inner">
                  <div className="flex items-center gap-2 mb-2 text-emerald-400 font-bold uppercase tracking-wider text-[10px]">
                    <span>+ NEW STATE</span>
                  </div>
                  <pre className="text-slate-300 whitespace-pre-wrap break-all overflow-x-auto text-[11px]">
                    {selectedLog.new_values
                      ? JSON.stringify(selectedLog.new_values, null, 2)
                      : '<REMOVED / NULL>'}
                  </pre>
                </div>
              </div>

              {selectedLog.metadata && (
                <div className="bg-slate-950/80 rounded-2xl p-4 border border-slate-800 shadow-inner">
                  <div className="text-cyan-400 font-bold uppercase tracking-wider text-[10px] mb-2">
                    Metadata & Audit Context
                  </div>
                  <pre className="text-slate-400 whitespace-pre-wrap break-all overflow-x-auto text-[11px]">
                    {JSON.stringify(selectedLog.metadata, null, 2)}
                  </pre>
                </div>
              )}
            </div>

            <div className="p-5 bg-white/[0.03] border-t border-[var(--border-subtle)] flex justify-end">
              <button
                onClick={() => setSelectedLog(null)}
                className="py-2.5 px-6 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all"
              >
                Close Diff Viewer
              </button>
            </div>
          </div>
        </div>
      )}
    </StaffLayout>
  );
}
