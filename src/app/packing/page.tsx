'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { StaffLayout } from '@/components/StaffLayout';
import { Order, OrderItem } from '@/lib/types';
import { useAuth } from '@/lib/context/AuthContext';
import { useSSE } from '@/hooks/use-sse';
import { formatWIB, formatDuration, getElapsedSeconds } from '@/lib/utils/datetime';
import { StatusBadge, PriorityBadge } from '@/components/ui';
import { AutoSyncControls } from '@/components/AutoSyncControls';
import {
  Check,
  Zap,
  Clock,
  ClipboardCheck,
  AlertTriangle,
  X,
  RefreshCw,
  Box,
  CheckCircle2,
} from 'lucide-react';

export default function PackerStationPage() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeChecklistOrder, setActiveChecklistOrder] = useState<Order | null>(null);
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});
  const [packingNotes, setPackingNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [syncSuccessMsg, setSyncSuccessMsg] = useState<string | null>(null);
  const [syncingExternal, setSyncingExternal] = useState(false);
  const [nowSec, setNowSec] = useState(0);

  const handleSync = async () => {
    setSyncingExternal(true);
    setSyncSuccessMsg(null);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/orders/sync-external?type=all');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menarik data order');
      setSyncSuccessMsg(`Berhasil sinkronisasi: ${data.count} order (${data.insertedCount} baru, ${data.updatedCount} diupdate)!`);
      await fetchOrders();
      setTimeout(() => setSyncSuccessMsg(null), 5000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal menarik data order');
    } finally {
      setSyncingExternal(false);
    }
  };

  const { subscribe } = useSSE();

  useEffect(() => {
    setNowSec(Date.now());
    const t = setInterval(() => setNowSec(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const fetchOrders = useCallback(async () => {
    try {
      const res = await fetch('/api/orders?status=WAITING,PACKING&limit=150');
      if (res.ok) {
        const data = await res.json();
        setOrders(data.orders || []);
      }
    } catch (err) {
      console.error('Failed to fetch orders:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  useEffect(() => {
    const handleUpdate = () => {
      fetchOrders();
    };

    const unsub1 = subscribe('orderUpdate', handleUpdate);
    const unsub2 = subscribe('driverArrival', handleUpdate);
    const unsub3 = subscribe('packingStart', handleUpdate);
    const unsub4 = subscribe('packingComplete', handleUpdate);

    return () => {
      unsub1();
      unsub2();
      unsub3();
      unsub4();
    };
  }, [subscribe, fetchOrders]);

  const handleStartPacking = async (orderId: string) => {
    setSubmitting(true);
    setErrorMsg(null);
    try {
      const token = localStorage.getItem('wh_auth_token');
      const res = await fetch(`/api/orders/${orderId}/packing/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Gagal memulai proses packing');
      }

      await fetchOrders();
      if (data.order) {
        openChecklist(data.order);
      }
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const openChecklist = (order: Order) => {
    setActiveChecklistOrder(order);
    const initialChecks: Record<string, boolean> = {};
    if (order.items) {
      order.items.forEach((it) => {
        initialChecks[it.id] = false;
      });
    }
    setCheckedItems(initialChecks);
    setPackingNotes('');
  };

  const toggleItem = (itemId: string) => {
    setCheckedItems((prev) => ({
      ...prev,
      [itemId]: !prev[itemId],
    }));
  };

  const itemsList = activeChecklistOrder?.items || [];
  const allVerified =
    itemsList.length > 0 && itemsList.every((it) => checkedItems[it.id]);

  const handleCompletePacking = async () => {
    if (!activeChecklistOrder) return;
    setSubmitting(true);
    setErrorMsg(null);
    try {
      const token = localStorage.getItem('wh_auth_token');
      const res = await fetch(`/api/orders/${activeChecklistOrder.id}/packing/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          notes: packingNotes.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Gagal menyelesaikan packing');
      }

      setActiveChecklistOrder(null);
      await fetchOrders();
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const priorityQueue = orders
    .filter((o) => o.priority_status === 'DRIVER_WAITING')
    .sort((a, b) => {
      if (a.queue_number && b.queue_number) {
        return a.queue_number - b.queue_number;
      }
      const tA = a.driver_arrived_at ? new Date(a.driver_arrived_at).getTime() : 0;
      const tB = b.driver_arrived_at ? new Date(b.driver_arrived_at).getTime() : 0;
      return tA - tB;
    });
  const activeBench = orders.filter((o) => o.status === 'PACKING');
  const standardQueue = orders.filter(
    (o) => o.status === 'WAITING' && o.priority_status === 'NORMAL'
  );

  return (
    <StaffLayout
      title="Meja Pengepakan (Packing Bench)"
      subtitle="Verifikasi manifest SKU barang, proses antrian prioritas kurir, dan pengecekan kualitas kemasan"
      allowedRoles={['PACKER', 'SUPERADMIN']}
    >
      <div className="space-y-6">
        {/* Action Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] shadow-xs">
          <div className="flex items-center gap-2">
            <Box className="w-4 h-4 text-[var(--accent-primary)]" />
            <span className="text-xs font-semibold text-[var(--text-primary)]">
              Antrian Pengepakan Gudang ({orders.length} order)
            </span>
          </div>
          <div className="flex items-center gap-2">
            <AutoSyncControls onSync={handleSync} isSyncing={syncingExternal} />
            <button
              onClick={handleSync}
              disabled={syncingExternal}
              title="Tarik data terbaru dari API eksternal (Shipment & Picking)"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-xs font-bold transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncingExternal ? 'animate-spin' : ''}`} />
              <span>{syncingExternal ? 'Menarik...' : 'Tarik API'}</span>
            </button>
          </div>
        </div>

        {syncSuccessMsg && (
          <div className="p-3.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 text-emerald-800 dark:text-emerald-300 text-xs font-semibold flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
              <span>{syncSuccessMsg}</span>
            </div>
            <button
              onClick={() => setSyncSuccessMsg(null)}
              className="text-emerald-600 hover:text-emerald-800 p-0.5 rounded transition-colors"
              title="Tutup"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {errorMsg && (
          <div className="p-3.5 rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-300 text-xs font-semibold flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
              <span>{errorMsg}</span>
            </div>
            <button
              onClick={() => setErrorMsg(null)}
              className="text-rose-600 hover:text-rose-800 p-0.5 rounded transition-colors"
              title="Tutup"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* QUEUE 1: TIER 1 PRIORITY QUEUE (COURIER WAITING) */}
        <div>
          <div className="flex items-center justify-between mb-3 px-1">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
              <h2 className="text-sm font-bold text-amber-900 dark:text-amber-300 uppercase tracking-wider">
                Prioritas Utama: Kurir Sedang Menunggu ({priorityQueue.length})
              </h2>
            </div>
            <span className="inline-flex items-center gap-1.5 text-xs text-amber-800 dark:text-amber-300 font-semibold bg-amber-100 dark:bg-amber-900/50 border border-amber-300 dark:border-amber-700 px-2.5 py-0.5 rounded-md">
              <Zap className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              <span>Wajib Diproses Sebelum Antrian Reguler</span>
            </span>
          </div>

          {priorityQueue.length === 0 ? (
            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 text-center text-xs text-[var(--text-muted)]">
              Tidak ada kurir yang sedang menunggu di dock untuk pengepakan.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {priorityQueue.map((order) => {
                const waitSec = order.driver_arrived_at
                  ? getElapsedSeconds(order.driver_arrived_at)
                  : 0;

                return (
                  <div
                    key={order.id}
                    className="rounded-xl p-4 border-2 border-amber-400 bg-amber-50/40 dark:bg-amber-950/20 shadow-sm flex flex-col justify-between gap-3"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {order.queue_number && (
                            <span className="text-xs font-bold px-2 py-0.5 rounded bg-amber-500 text-slate-950 font-mono">
                              #{order.queue_number}
                            </span>
                          )}
                          <span className="text-base font-bold font-mono text-[var(--text-primary)]">
                            {order.order_number}
                          </span>
                        </div>
                        <StatusBadge status={order.status} />
                      </div>

                      <div className="text-xs space-y-0.5 text-[var(--text-secondary)]">
                        <p>
                          Penerima: <span className="font-semibold text-[var(--text-primary)]">{order.customer_name || 'N/A'}</span>
                        </p>
                        <p className="font-medium text-amber-800 dark:text-amber-300">
                          Ekspedisi: {order.courier_name || 'General Fleet'}
                        </p>
                      </div>

                      {/* Wait Timer */}
                      <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-950 border border-amber-300 dark:border-amber-800 flex items-center justify-between text-xs font-mono font-semibold text-amber-800 dark:text-amber-300">
                        <span>Kurir Menunggu:</span>
                        <span className="flex items-center gap-1" suppressHydrationWarning>
                          <Clock className="w-3 h-3" />
                          <span>{formatDuration(waitSec)}</span>
                        </span>
                      </div>

                      {order.items && order.items.length > 0 && (
                        <div className="pt-2 border-t border-amber-300/40 text-xs text-[var(--text-secondary)]">
                          <p className="font-semibold text-[var(--text-primary)] mb-1 uppercase text-[10px] tracking-wider">
                            Manifest Barang ({order.items.length} item):
                          </p>
                          <ul className="space-y-1 text-xs">
                            {order.items.slice(0, 3).map((it) => (
                              <li key={it.id} className="flex justify-between truncate">
                                <span>{it.product_name}</span>
                                <span className="font-semibold ml-2">({it.quantity}x)</span>
                              </li>
                            ))}
                            {order.items.length > 3 && (
                              <li className="text-[11px] text-[var(--text-muted)]">
                                + {order.items.length - 3} item lainnya...
                              </li>
                            )}
                          </ul>
                        </div>
                      )}
                    </div>

                    <div className="pt-1">
                      {order.status === 'PACKING' ? (
                        <button
                          onClick={() => openChecklist(order)}
                          className="w-full py-2.5 px-3 rounded-lg bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white font-bold text-xs shadow-sm transition-colors flex items-center justify-center gap-1.5"
                        >
                          <span>Buka Checklist SKU</span>
                          <Check className="w-3.5 h-3.5" />
                        </button>
                      ) : (
                        <button
                          onClick={() => handleStartPacking(order.id)}
                          disabled={submitting}
                          className="w-full py-2.5 px-3 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-sm transition-colors flex items-center justify-center gap-1.5"
                        >
                          <Zap className="w-3.5 h-3.5" />
                          <span>Klaim & Mulai Packing</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* QUEUE 2: ACTIVE PACKING BENCH */}
        <div>
          <div className="flex items-center justify-between mb-3 px-1">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-sky-500" />
              <h2 className="text-sm font-bold text-sky-800 dark:text-sky-300 uppercase tracking-wider">
                Sedang Dikerjakan di Meja ({activeBench.length})
              </h2>
            </div>
            <span className="text-xs text-[var(--text-muted)]">
              Pesanan yang sedang aktif diverifikasi packer
            </span>
          </div>

          {activeBench.length === 0 ? (
            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 text-center text-xs text-[var(--text-muted)]">
              Tidak ada pesanan yang sedang aktif di meja. Silakan klaim dari antrian!
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {activeBench.map((order) => {
                const packingSec = order.packing_started_at
                  ? getElapsedSeconds(order.packing_started_at)
                  : 0;

                return (
                  <div
                    key={order.id}
                    className="rounded-xl p-4 border border-sky-300 dark:border-sky-800 bg-[var(--bg-card)] shadow-sm flex flex-col justify-between gap-3"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold font-mono text-[var(--text-primary)]">
                          {order.order_number}
                        </span>
                        <PriorityBadge priority={order.priority_status} queueNumber={order.queue_number} />
                      </div>

                      <p className="text-xs text-[var(--text-secondary)]">
                        Penerima: <span className="font-semibold text-[var(--text-primary)]">{order.customer_name || 'N/A'}</span> • Ekspedisi: <span className="font-semibold text-[var(--text-primary)]">{order.courier_name || 'General'}</span>
                      </p>

                      <div className="p-2 rounded-lg bg-sky-50 dark:bg-sky-950 border border-sky-200 dark:border-sky-800 flex items-center justify-between text-xs font-mono text-sky-800 dark:text-sky-300">
                        <span>Durasi Kemas:</span>
                        <span className="font-semibold flex items-center gap-1" suppressHydrationWarning>
                          <Clock className="w-3 h-3" />
                          <span suppressHydrationWarning>{formatDuration(packingSec)}</span>
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={() => openChecklist(order)}
                      className="w-full py-2.5 px-3 rounded-lg bg-sky-600 hover:bg-sky-700 text-white font-semibold text-xs transition-colors flex items-center justify-center gap-1.5"
                    >
                      <ClipboardCheck className="w-3.5 h-3.5" />
                      <span>Buka Form Verifikasi</span>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* QUEUE 3: STANDARD PACKAGING QUEUE */}
        <div>
          <div className="flex items-center justify-between mb-3 px-1">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-400" />
              <h2 className="text-sm font-bold text-[var(--text-secondary)] uppercase tracking-wider">
                Antrian Reguler ({standardQueue.length})
              </h2>
            </div>
            <span className="text-xs text-[var(--text-muted)]">
              Antrian umum FIFO siap dipacking
            </span>
          </div>

          {standardQueue.length === 0 ? (
            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 text-center text-xs text-[var(--text-muted)]">
              Antrian reguler saat ini kosong!
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
              {standardQueue.map((order) => (
                <div
                  key={order.id}
                  className="rounded-xl p-3.5 border border-[var(--border-subtle)] bg-[var(--bg-card)] shadow-xs flex flex-col justify-between gap-2.5 hover:border-[var(--border-strong)] transition-colors"
                >
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-xs text-[var(--text-primary)]">
                        {order.order_number}
                      </span>
                      <StatusBadge status={order.status} />
                    </div>
                    <p className="text-xs text-[var(--text-secondary)]">
                      {order.customer_name || 'N/A'} • {order.courier_name || 'General Fleet'}
                    </p>
                    {order.items && (
                      <p className="text-[11px] text-[var(--text-muted)] truncate">
                        {order.items.length} item barang
                      </p>
                    )}
                  </div>

                  <button
                    onClick={() => handleStartPacking(order.id)}
                    disabled={submitting}
                    className="w-full py-2 px-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:bg-[var(--bg-card-hover)] text-xs font-semibold text-[var(--text-primary)] transition-colors flex items-center justify-center gap-1"
                  >
                    <span>Klaim Pesanan</span>
                    <span>→</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ITEM VERIFICATION CHECKLIST MODAL */}
      {activeChecklistOrder && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] max-w-2xl w-full shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 sm:p-5 border-b border-[var(--border-subtle)] flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <ClipboardCheck className="w-5 h-5 text-[var(--accent-primary)]" />
                  <h3 className="text-sm sm:text-base font-bold text-[var(--text-primary)]">
                    Verifikasi SKU & Kualitas Kemasan
                  </h3>
                </div>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">
                  Order <span className="font-mono font-bold text-[var(--text-primary)]">{activeChecklistOrder.order_number}</span> • Penerima: {activeChecklistOrder.customer_name}
                </p>
              </div>

              <button
                onClick={() => setActiveChecklistOrder(null)}
                className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
              <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-xs flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <strong>Standar Kualitas:</strong> Setiap item barang dan jumlahnya harus diperiksa secara fisik sebelum kardus/plastik disegel.
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                  Daftar Barang ({Object.values(checkedItems).filter(Boolean).length} / {itemsList.length} Tercentang)
                </p>

                {itemsList.map((item) => {
                  const isChecked = !!checkedItems[item.id];
                  return (
                    <label
                      key={item.id}
                      onClick={() => toggleItem(item.id)}
                      className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                        isChecked
                          ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-400 dark:border-emerald-800 text-[var(--text-primary)]'
                          : 'bg-[var(--bg-card)] border-[var(--border-subtle)] text-[var(--text-secondary)] hover:bg-[var(--bg-card-hover)]'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleItem(item.id)}
                        className="mt-0.5 w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                      />
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-[var(--text-primary)]">
                            {item.product_name}
                          </span>
                          <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-[var(--bg-primary)] text-[var(--text-secondary)] border border-[var(--border-subtle)]">
                            Qty: {item.quantity}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 mt-1">
                          {item.sku && (
                            <p className="text-[11px] text-[var(--text-muted)] font-mono">
                              SKU: {item.sku}
                            </p>
                          )}
                          {item.size && (
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[var(--bg-primary)] border border-[var(--border-subtle)]">
                              Ukuran: {item.size}
                            </span>
                          )}
                          {item.warna && (
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[var(--bg-primary)] border border-[var(--border-subtle)]">
                              Warna: {item.warna}
                            </span>
                          )}
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                  Catatan Kemasan / Kondisi Paket (Opsional)
                </label>
                <textarea
                  rows={2}
                  value={packingNotes}
                  onChange={(e) => setPackingNotes(e.target.value)}
                  placeholder="Contoh: Bubble wrap ganda, lakban fragile, kardus ukuran #3"
                  className="w-full px-3 py-2 rounded-lg bg-[var(--bg-card)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-xs focus:outline-none focus:border-[var(--accent-primary)] font-medium"
                />
              </div>
            </div>

            <div className="p-4 border-t border-[var(--border-subtle)] flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setActiveChecklistOrder(null)}
                className="py-2 px-3.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-card-hover)]"
              >
                Tutup
              </button>

              <button
                type="button"
                onClick={handleCompletePacking}
                disabled={!allVerified || submitting}
                className="py-2.5 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm disabled:opacity-50 transition-colors flex items-center gap-1.5"
              >
                {submitting ? (
                  <span>Menyimpan...</span>
                ) : (
                  <>
                    <span>{allVerified ? 'Selesai & Tempatkan di Rak Pickup' : 'Centang Semua SKU Dulu'}</span>
                    <Check className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </StaffLayout>
  );
}
