'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { StaffLayout } from '@/components/StaffLayout';
import { Order } from '@/lib/types';
import { useSSE } from '@/hooks/use-sse';
import { formatWIB, formatDuration } from '@/lib/utils/datetime';
import { StatusBadge, PriorityBadge } from '@/components/ui';
import {
  RefreshCw,
  Plus,
  CheckCircle2,
  AlertTriangle,
  Search,
  Truck,
  ArrowRight,
  X,
} from 'lucide-react';

export default function OrderManagementPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [priorityFilter, setPriorityFilter] = useState<string>('ALL');

  // Modals
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedOrderDetail, setSelectedOrderDetail] = useState<any | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Create form state
  const [createOrderNumber, setCreateOrderNumber] = useState('');
  const [createCustomerName, setCreateCustomerName] = useState('');
  const [createCourierName, setCreateCourierName] = useState('J&T Express');
  const [createItems, setCreateItems] = useState<
    { sku: string; product_name: string; quantity: number }[]
  >([{ sku: '', product_name: '', quantity: 1 }]);
  const [submittingCreate, setSubmittingCreate] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Sync state
  const [syncingExternal, setSyncingExternal] = useState(false);
  const [syncNotification, setSyncNotification] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const { subscribe } = useSSE();

  const fetchOrders = useCallback(async () => {
    try {
      let url = '/api/orders?limit=150';
      if (statusFilter !== 'ALL') {
        url += `&status=${statusFilter}`;
      } else {
        url += '&exclude_status=SHIP';
      }
      if (priorityFilter !== 'ALL') url += `&priority=${priorityFilter}`;
      if (search.trim()) url += `&search=${encodeURIComponent(search.trim())}`;

      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        // Strictly exclude any shipped orders from active processing list
        const activeOrders = (data.orders || []).filter((o: Order) => o.status !== 'SHIP');
        setOrders(activeOrders);
      }
    } catch (err) {
      console.error('Failed to fetch orders:', err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, priorityFilter, search]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  useEffect(() => {
    const unsub1 = subscribe('orderCreated', () => fetchOrders());
    const unsub2 = subscribe('orderUpdate', () => fetchOrders());
    const unsub3 = subscribe('pickupShipped', () => fetchOrders());

    return () => {
      unsub1();
      unsub2();
      unsub3();
    };
  }, [subscribe, fetchOrders]);

  const handleSyncExternal = async () => {
    setSyncingExternal(true);
    setSyncNotification(null);
    try {
      const res = await fetch('/api/orders/sync-external');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to sync orders from external API');

      setSyncNotification({
        type: 'success',
        text: `Berhasil sinkronisasi ${data.count} order (${data.insertedCount} baru, ${data.updatedCount} diupdate)!`,
      });
      await fetchOrders();
      setTimeout(() => setSyncNotification(null), 6000);
    } catch (err: any) {
      setSyncNotification({
        type: 'error',
        text: err.message || 'Gagal menarik data dari external API',
      });
      setTimeout(() => setSyncNotification(null), 6000);
    } finally {
      setSyncingExternal(false);
    }
  };

  const openDetail = async (orderId: string) => {
    setDetailLoading(true);
    setSelectedOrderDetail(null);
    try {
      const res = await fetch(`/api/orders/${orderId}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedOrderDetail(data.order);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setDetailLoading(false);
    }
  };

  const addItemRow = () => {
    setCreateItems([...createItems, { sku: '', product_name: '', quantity: 1 }]);
  };

  const removeItemRow = (index: number) => {
    if (createItems.length <= 1) return;
    setCreateItems(createItems.filter((_, idx) => idx !== index));
  };

  const updateItemRow = (index: number, field: string, val: any) => {
    const next = [...createItems];
    next[index] = { ...next[index], [field]: val };
    setCreateItems(next);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingCreate(true);
    setCreateError(null);

    const validItems = createItems.filter((it) => it.product_name.trim());
    if (validItems.length === 0) {
      setCreateError('Please provide at least one product name');
      setSubmittingCreate(false);
      return;
    }

    try {
      const token = localStorage.getItem('wh_auth_token');
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          order_number: createOrderNumber.trim() || undefined,
          customer_name: createCustomerName.trim() || undefined,
          courier_name: createCourierName,
          items: validItems,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create order');

      setIsCreateOpen(false);
      setCreateOrderNumber('');
      setCreateCustomerName('');
      setCreateItems([{ sku: '', product_name: '', quantity: 1 }]);
      await fetchOrders();
    } catch (err: any) {
      setCreateError(err.message);
    } finally {
      setSubmittingCreate(false);
    }
  };

  return (
    <StaffLayout
      title="Daftar Antrian & Manajemen Pesanan"
      subtitle="Monitoring status pesanan aktif, pembuatan order baru, analisis SLA waktu kemas, dan pelacakan mutasi"
      actions={
        <div className="flex items-center gap-2.5">
          <button
            onClick={handleSyncExternal}
            disabled={syncingExternal}
            className="px-3.5 py-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:bg-[var(--bg-card-hover)] font-semibold text-xs text-[var(--text-secondary)] transition-colors flex items-center gap-1.5 disabled:opacity-50"
            title="Tarik data order dari external ERP / WMS"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncingExternal ? 'animate-spin' : ''}`} />
            <span>{syncingExternal ? 'Menarik Data...' : 'Tarik Order dari API'}</span>
          </button>

          <button
            onClick={() => {
              const randomSuffix = Math.floor(1000 + Math.random() * 9000);
              setCreateOrderNumber(`ORD-${randomSuffix}`);
              setIsCreateOpen(true);
            }}
            className="px-3.5 py-2 rounded-lg bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white font-bold text-xs shadow-sm transition-colors flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Buat Order Baru</span>
          </button>
        </div>
      }
    >
      <div className="space-y-6">
        {syncNotification && (
          <div
            className={`p-4 rounded-2xl border text-xs font-bold flex items-center justify-between transition-all ${
              syncNotification.type === 'success'
                ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300 shadow-[0_0_20px_rgba(16,185,129,0.2)]'
                : 'bg-rose-500/15 border-rose-500/40 text-rose-300 shadow-[0_0_20px_rgba(244,63,94,0.2)]'
            }`}
          >
            <div className="flex items-center gap-2.5">
              {syncNotification.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              )}
              <span>{syncNotification.text}</span>
            </div>
            <button
              onClick={() => setSyncNotification(null)}
              className="text-white/60 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Search & Filters */}
        <div className="p-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] flex flex-col md:flex-row items-center justify-between gap-3 shadow-sm">
          <div className="relative w-full md:w-96">
            <Search className="absolute left-3.5 top-2.5 w-4 h-4 text-[var(--text-muted)]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari No. Order, Penerima, atau Ekspedisi..."
              className="w-full pl-9 pr-3 py-2 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-xs focus:outline-none focus:border-[var(--accent-primary)] font-medium"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
            {/* Status Filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-[var(--text-muted)]">Status:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-xs focus:outline-none focus:border-[var(--accent-primary)] font-medium"
              >
                <option value="ALL">Semua Aktif (Non-Shipped)</option>
                <option value="WAITING">WAITING (Menunggu)</option>
                <option value="PACKING">PACKING (Sedang Kemas)</option>
                <option value="READY_FOR_PICKUP">READY_FOR_PICKUP (Siap Ambil)</option>
              </select>
            </div>

            {/* Priority Filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-[var(--text-muted)]">Prioritas:</span>
              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-xs focus:outline-none focus:border-[var(--accent-primary)] font-medium"
              >
                <option value="ALL">Semua Prioritas</option>
                <option value="DRIVER_WAITING">DRIVER_WAITING (Kurir Tiba)</option>
                <option value="NORMAL">NORMAL</option>
              </select>
            </div>

            <Link
              href="/shipped-orders"
              className="px-3 py-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:bg-[var(--bg-card-hover)] text-xs font-semibold text-[var(--text-primary)] flex items-center gap-1.5 transition-colors"
            >
              <Truck className="w-3.5 h-3.5 text-purple-500" />
              <span>Riwayat Terkirim</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* Orders Table */}
        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[var(--bg-primary)] text-[var(--text-muted)] uppercase tracking-wider font-semibold border-b border-[var(--border-subtle)]">
                <tr>
                  <th className="px-4 py-3">Nomor Order</th>
                  <th className="px-4 py-3">Nama Penerima</th>
                  <th className="px-4 py-3">Ekspedisi / Armada</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Prioritas</th>
                  <th className="px-4 py-3">Durasi SLA</th>
                  <th className="px-4 py-3">Dibuat Pada</th>
                  <th className="px-4 py-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)] text-[var(--text-secondary)]">
                {orders.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center text-[var(--text-muted)]">
                      Tidak ada pesanan yang sesuai dengan filter.
                    </td>
                  </tr>
                ) : (
                  orders.map((ord) => (
                    <tr
                      key={ord.id}
                      className="hover:bg-[var(--bg-card-hover)] transition-colors"
                    >
                      <td className="px-4 py-3">
                        <span className="font-mono font-bold text-[var(--text-primary)] text-sm block">
                          {ord.order_number}
                        </span>
                        <div className="flex flex-wrap items-center gap-1 mt-1 font-mono text-[10px]">
                          {ord.no_wsa && (
                            <span className="px-1.5 py-0.5 rounded bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-[var(--text-secondary)]">
                              WSA: {ord.no_wsa}
                            </span>
                          )}
                          {ord.picking_no && (
                            <span className="px-1.5 py-0.5 rounded bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-[var(--text-secondary)]">
                              Pick: {ord.picking_no}
                            </span>
                          )}
                          {ord.pickup_code && (
                            <span className="px-1.5 py-0.5 rounded bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-[var(--text-secondary)]">
                              Code: {ord.pickup_code}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-medium text-[var(--text-primary)]">
                        {ord.customer_name || 'N/A'}
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-semibold text-[var(--text-primary)] block">
                          {ord.courier_name || ord.courier_type || 'General Fleet'}
                        </span>
                        {ord.courier_type && ord.courier_type !== ord.courier_name && (
                          <span className="text-[10px] text-[var(--text-muted)] font-mono">
                            Tipe: {ord.courier_type}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={ord.status} />
                      </td>
                      <td className="px-4 py-3">
                        <PriorityBadge priority={ord.priority_status} queueNumber={ord.queue_number} />
                      </td>
                      <td className="px-4 py-3 font-mono text-[11px] space-y-0.5">
                        {ord.packing_duration_seconds !== null && (
                          <div className="text-sky-700 dark:text-sky-400 font-semibold">
                            Kemas: {formatDuration(ord.packing_duration_seconds)}
                          </div>
                        )}
                        {ord.driver_wait_duration_seconds !== null && (
                          <div className="text-amber-700 dark:text-amber-400 font-semibold">
                            Menunggu: {formatDuration(ord.driver_wait_duration_seconds)}
                          </div>
                        )}
                        {ord.packing_duration_seconds === null &&
                          ord.driver_wait_duration_seconds === null && (
                            <span className="text-[var(--text-muted)]">-</span>
                          )}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-[var(--text-muted)]">
                        {formatWIB(ord.created_at)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => openDetail(ord.id)}
                          className="px-2.5 py-1.5 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:bg-[var(--bg-card-hover)] text-xs font-semibold text-[var(--text-primary)] transition-colors"
                        >
                          Detail →
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

      {/* MANUAL ORDER CREATION MODAL */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass-panel-elevated border-indigo-500/50 rounded-3xl max-w-xl w-full shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border-subtle)]">
              <h3 className="text-base font-black text-white tracking-tight">
                Create New Warehouse Order
              </h3>
              <button
                onClick={() => setIsCreateOpen(false)}
                className="text-[var(--text-muted)] hover:text-white transition-colors"
                title="Tutup"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {createError && (
              <div className="p-3.5 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs">
                {createError}
              </div>
            )}

            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-1">
                    Order Number
                  </label>
                  <input
                    type="text"
                    value={createOrderNumber}
                    onChange={(e) => setCreateOrderNumber(e.target.value)}
                    placeholder="e.g. ORD-1006"
                    className="w-full px-3.5 py-2.5 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-subtle)] text-white text-xs font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-1">
                    Customer Name
                  </label>
                  <input
                    type="text"
                    value={createCustomerName}
                    onChange={(e) => setCreateCustomerName(e.target.value)}
                    placeholder="Recipient name"
                    className="w-full px-3.5 py-2.5 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-subtle)] text-white text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-1">
                  Courier Partner Fleet
                </label>
                <select
                  value={createCourierName}
                  onChange={(e) => setCreateCourierName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-subtle)] text-white text-xs"
                >
                  <option value="J&T Express">J&T Express</option>
                  <option value="SiCepat">SiCepat</option>
                  <option value="Shopee Xpress">Shopee Xpress</option>
                  <option value="GoSend">GoSend</option>
                  <option value="GrabExpress">GrabExpress</option>
                  <option value="Anteraja">Anteraja</option>
                  <option value="Ninja Van">Ninja Van</option>
                  <option value="JNE Express">JNE Express</option>
                  <option value="Internal Fleet">Internal Fleet</option>
                </select>
              </div>

              {/* Dynamic SKU Items Table */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                    Order SKU Items
                  </label>
                  <button
                    type="button"
                    onClick={addItemRow}
                    className="text-xs text-indigo-400 hover:text-indigo-300 font-bold"
                  >
                    + Add Item
                  </button>
                </div>

                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {createItems.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={item.sku}
                        onChange={(e) => updateItemRow(idx, 'sku', e.target.value)}
                        placeholder="SKU-XXX"
                        className="w-28 px-3 py-2 rounded-xl bg-[var(--bg-card)] border border-[var(--border-subtle)] text-white text-xs font-mono"
                      />
                      <input
                        type="text"
                        value={item.product_name}
                        onChange={(e) => updateItemRow(idx, 'product_name', e.target.value)}
                        placeholder="Product Name"
                        required
                        className="flex-1 px-3 py-2 rounded-xl bg-[var(--bg-card)] border border-[var(--border-subtle)] text-white text-xs"
                      />
                      <input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) =>
                          updateItemRow(idx, 'quantity', parseInt(e.target.value) || 1)
                        }
                        className="w-16 px-2 py-2 rounded-xl bg-[var(--bg-card)] border border-[var(--border-subtle)] text-white text-xs text-center font-mono font-bold"
                      />
                      <button
                        type="button"
                        onClick={() => removeItemRow(idx)}
                        disabled={createItems.length === 1}
                        className="text-slate-500 hover:text-rose-400 px-1 disabled:opacity-30"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-3 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="flex-1 py-2.5 px-4 rounded-2xl glass-btn text-xs font-bold text-[var(--text-secondary)]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingCreate}
                  className="flex-2 py-2.5 px-5 rounded-2xl bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-400 hover:to-indigo-500 text-white font-black text-xs disabled:opacity-50 shadow-lg shadow-indigo-500/25"
                >
                  {submittingCreate ? 'Saving...' : 'Create Order & Enqueue'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* LIFECYCLE DETAIL MODAL */}
      {selectedOrderDetail && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass-panel-elevated border-indigo-500/50 rounded-3xl max-w-3xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 bg-white/[0.03] border-b border-[var(--border-subtle)] flex items-center justify-between">
              <div>
                <div className="flex items-center gap-3">
                  <h3 className="text-xl font-mono font-black text-white">
                    {selectedOrderDetail.order_number}
                  </h3>
                  <StatusBadge status={selectedOrderDetail.status} />
                  <PriorityBadge priority={selectedOrderDetail.priority_status} queueNumber={selectedOrderDetail.queue_number} />
                </div>
                <div className="flex flex-wrap items-center gap-2 mt-1.5 font-mono text-[11px]">
                  {selectedOrderDetail.no_wsa && (
                    <span className="px-2 py-0.5 rounded-lg bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-bold">
                      No. WSA: {selectedOrderDetail.no_wsa}
                    </span>
                  )}
                  {selectedOrderDetail.picking_no && (
                    <span className="px-2 py-0.5 rounded-lg bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-bold">
                      Picking No: {selectedOrderDetail.picking_no}
                    </span>
                  )}
                  {selectedOrderDetail.courier_type && (
                    <span className="px-2 py-0.5 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold">
                      Agent: {selectedOrderDetail.courier_type}
                    </span>
                  )}
                  {selectedOrderDetail.pickup_code && (
                    <span className="px-2 py-0.5 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold">
                      Pickup Code: {selectedOrderDetail.pickup_code}
                    </span>
                  )}
                </div>
                <p className="text-xs text-[var(--text-secondary)] mt-1">
                  Recipient: <span className="text-white font-medium">{selectedOrderDetail.customer_name || 'N/A'}</span> • Fleet: {selectedOrderDetail.courier_name}
                </p>
              </div>
              <button
                onClick={() => setSelectedOrderDetail(null)}
                className="text-[var(--text-muted)] hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
              {/* SLA Metrics Box */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 glass-panel p-4 rounded-2xl border border-[var(--border-subtle)]">
                <div>
                  <span className="text-[var(--text-muted)] block text-[10px] uppercase font-bold">Driver Wait Duration</span>
                  <span className="font-mono text-amber-400 font-black text-sm">
                    {formatDuration(selectedOrderDetail.driver_wait_duration_seconds)}
                  </span>
                </div>
                <div>
                  <span className="text-[var(--text-muted)] block text-[10px] uppercase font-bold">Packing Turnaround</span>
                  <span className="font-mono text-cyan-400 font-black text-sm">
                    {formatDuration(selectedOrderDetail.packing_duration_seconds)}
                  </span>
                </div>
                <div>
                  <span className="text-[var(--text-muted)] block text-[10px] uppercase font-bold">Created At</span>
                  <span className="font-mono text-slate-300">
                    {formatWIB(selectedOrderDetail.created_at)}
                  </span>
                </div>
                <div>
                  <span className="text-[var(--text-muted)] block text-[10px] uppercase font-bold">Shipped At</span>
                  <span className="font-mono text-purple-300">
                    {formatWIB(selectedOrderDetail.shipped_at)}
                  </span>
                </div>
              </div>

              {/* Items List */}
              <div>
                <h4 className="font-bold text-white uppercase tracking-wider text-[11px] mb-2.5">
                  SKU Item Manifest
                </h4>
                <div className="glass-panel rounded-2xl divide-y divide-[var(--border-subtle)] overflow-hidden">
                  {selectedOrderDetail.items?.map((it: any) => (
                    <div key={it.id} className="p-3.5 flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          {it.line_no && (
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/10 text-slate-400">
                              #{it.line_no}
                            </span>
                          )}
                          <span className="font-bold text-white">{it.product_name}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-1 font-mono text-[11px]">
                          {it.sku && (
                            <span className="text-cyan-400 font-semibold">
                              SKU: {it.sku}
                            </span>
                          )}
                          {it.size && (
                            <span className="px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-bold">
                              Size: {it.size}
                            </span>
                          )}
                          {it.warna && (
                            <span className="px-1.5 py-0.2 rounded bg-pink-500/20 text-pink-300 border border-pink-500/30 font-bold">
                              Warna: {it.warna}
                            </span>
                          )}
                        </div>
                      </div>
                      <span className="font-mono font-bold text-cyan-400 px-2.5 py-1 rounded-lg bg-[var(--bg-primary)] border border-white/10">
                        Qty: {it.quantity}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Status History Timeline */}
              <div>
                <h4 className="font-bold text-white uppercase tracking-wider text-[11px] mb-2.5">
                  State Mutation Timeline
                </h4>
                <div className="space-y-3 border-l-2 border-indigo-500/40 pl-4 ml-2">
                  {selectedOrderDetail.status_history?.map((sh: any) => (
                    <div key={sh.id} className="relative">
                      <span className="absolute -left-[22px] top-1.5 w-2.5 h-2.5 rounded-full bg-indigo-400 shadow-[0_0_8px_rgba(99,102,241,0.8)]" />
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white uppercase tracking-wide">
                          {sh.to_status}
                        </span>
                        <span className="text-[var(--text-muted)]">
                          by {sh.user_name || sh.changed_by_type}
                        </span>
                        <span className="text-[var(--text-muted)] font-mono text-[11px]">
                          • {formatWIB(sh.changed_at)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Handover Photo if available */}
              {selectedOrderDetail.pickup_transaction?.photo_key && (
                <div>
                  <h4 className="font-bold text-white uppercase tracking-wider text-[11px] mb-2.5">
                    Verified Camera Handover Proof
                  </h4>
                  <div className="rounded-2xl overflow-hidden border border-emerald-500/40 shadow-xl max-w-md">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={selectedOrderDetail.pickup_transaction.photo_key}
                      alt="Handover Snapshot"
                      className="w-full object-cover"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </StaffLayout>
  );
}
