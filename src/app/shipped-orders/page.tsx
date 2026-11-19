'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { StaffLayout } from '@/components/StaffLayout';
import { Order } from '@/lib/types';
import { useSSE } from '@/hooks/use-sse';
import { formatWIB, formatDuration } from '@/lib/utils/datetime';
import { StatusBadge } from '@/components/ui';
import {
  RefreshCw,
  Package,
  CheckCircle2,
  Camera,
  ShieldCheck,
  Truck,
  Clock,
  Search,
  Tag,
  Phone,
  X,
  Maximize,
  Download,
  ZoomIn,
  AlertTriangle,
} from 'lucide-react';

export default function ShippedOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [courierFilter, setCourierFilter] = useState('ALL');

  // Detail Modal
  const [selectedOrderDetail, setSelectedOrderDetail] = useState<any | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Fullscreen Photo Lightbox
  const [activePhotoUrl, setActivePhotoUrl] = useState<string | null>(null);
  const [activePhotoTitle, setActivePhotoTitle] = useState('');

  // Retry ERP Dispatch
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const { subscribe } = useSSE();

  const fetchShippedOrders = useCallback(async () => {
    try {
      let url = '/api/orders?status=SHIP&limit=200';
      if (search.trim()) url += `&search=${encodeURIComponent(search.trim())}`;

      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setOrders(data.orders || []);
      }
    } catch (err) {
      console.error('Failed to fetch shipped orders:', err);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    fetchShippedOrders();
  }, [fetchShippedOrders]);

  // Real-time synchronization
  useEffect(() => {
    const unsubShipped = subscribe('pickupShipped', () => fetchShippedOrders());
    const unsubUpdate = subscribe('orderUpdate', () => fetchShippedOrders());

    return () => {
      unsubShipped();
      unsubUpdate();
    };
  }, [subscribe, fetchShippedOrders]);

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

  const handleRetryDispatch = async (orderId: string) => {
    try {
      setRetryingId(orderId);
      const res = await fetch(`/api/orders/${orderId}/retry-dispatch`, {
        method: 'POST',
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setNotification({
          type: 'success',
          message: `Berhasil sinkronisasi createDispatch ke ERP untuk order ${data.order?.order_number || ''}!`,
        });
        if (selectedOrderDetail && selectedOrderDetail.id === orderId) {
          setSelectedOrderDetail((prev: any) => ({ ...prev, ...data.order }));
        }
        await fetchShippedOrders();
      } else {
        setNotification({
          type: 'error',
          message: data.message || data.error || 'Gagal sinkronisasi ke ERP',
        });
        if (selectedOrderDetail && selectedOrderDetail.id === orderId) {
          setSelectedOrderDetail((prev: any) => ({ ...prev, ...data.order }));
        }
        await fetchShippedOrders();
      }
    } catch (err: any) {
      setNotification({
        type: 'error',
        message: err.message || 'Terjadi kesalahan saat kirim ulang API ERP',
      });
    } finally {
      setRetryingId(null);
      setTimeout(() => setNotification(null), 6000);
    }
  };

  // Filter by courier fleet
  const filteredOrders = orders.filter((o) => {
    if (courierFilter !== 'ALL' && o.courier_name !== courierFilter) {
      return false;
    }
    return true;
  });

  // Calculate high-level metrics
  const totalShipped = filteredOrders.length;
  const withPhotoCount = filteredOrders.filter(
    (o) => o.pickup_transaction?.photo_key
  ).length;
  const syncedCount = filteredOrders.filter(
    (o) => o.dispatch_sync_status === 'SYNCED'
  ).length;
  const failedCount = filteredOrders.filter(
    (o) => o.dispatch_sync_status === 'FAILED'
  ).length;

  // Available couriers for filter dropdown
  const couriers = Array.from(
    new Set(orders.map((o) => o.courier_name).filter(Boolean))
  ) as string[];

  return (
    <StaffLayout
      title="Riwayat Pesanan Terkirim & Bukti Foto"
      subtitle="Arsip pesanan yang telah diserahkan ke kurir dan audit bukti foto serah terima ber-watermark"
      actions={
        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchShippedOrders()}
            className="px-3 py-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:bg-[var(--bg-card-hover)] text-xs font-semibold text-[var(--text-secondary)] flex items-center gap-1.5 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Segarkan</span>
          </button>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Notification Banner */}
        {notification && (
          <div
            className={`p-3.5 rounded-2xl border text-xs font-bold flex items-center justify-between transition-all ${
              notification.type === 'success'
                ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300 shadow-[0_0_20px_rgba(16,185,129,0.15)]'
                : 'bg-rose-500/15 border-rose-500/40 text-rose-300 shadow-[0_0_20px_rgba(244,63,94,0.15)]'
            }`}
          >
            <div className="flex items-center gap-2">
              {notification.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              )}
              <span>{notification.message}</span>
            </div>
            <button
              onClick={() => setNotification(null)}
              className="text-current opacity-70 hover:opacity-100 font-bold px-1"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* KPI Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          <div className="p-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] shadow-sm">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                  Total Terkirim
                </p>
                <h3 className="text-2xl font-bold text-[var(--text-primary)] mt-1 font-mono">
                  {totalShipped}
                </h3>
              </div>
              <div className="w-9 h-9 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--accent-primary)]">
                <Package className="w-4 h-4" />
              </div>
            </div>
            <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium mt-2 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> Berstatus SHIP di database
            </p>
          </div>

          <div className="p-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] shadow-sm">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                  Bukti Foto Watermark
                </p>
                <h3 className="text-2xl font-bold text-[var(--text-primary)] mt-1 font-mono">
                  {withPhotoCount}
                </h3>
              </div>
              <div className="w-9 h-9 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-subtle)] flex items-center justify-center text-sky-500">
                <Camera className="w-4 h-4" />
              </div>
            </div>
            <p className="text-xs text-sky-600 dark:text-sky-400 font-medium mt-2 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" /> Bukti foto serah terima terekam
            </p>
          </div>

          <div className="p-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] shadow-sm">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                  Sync ERP Sukses
                </p>
                <h3 className="text-2xl font-bold text-emerald-400 mt-1 font-mono">
                  {syncedCount}
                </h3>
              </div>
              <div className="w-9 h-9 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-subtle)] flex items-center justify-center text-emerald-400">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            </div>
            <p className="text-xs text-emerald-400 font-medium mt-2 flex items-center gap-1">
              <span>createDispatch berhasil di ERP</span>
            </p>
          </div>

          <div className="p-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] shadow-sm">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                  Tidak Sync (Perlu Retry)
                </p>
                <h3 className={`text-2xl font-bold mt-1 font-mono ${failedCount > 0 ? 'text-rose-400' : 'text-slate-400'}`}>
                  {failedCount}
                </h3>
              </div>
              <div className={`w-9 h-9 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-subtle)] flex items-center justify-center ${failedCount > 0 ? 'text-rose-400' : 'text-slate-500'}`}>
                <AlertTriangle className="w-4 h-4" />
              </div>
            </div>
            <p className={`text-xs font-medium mt-2 flex items-center gap-1 ${failedCount > 0 ? 'text-rose-400' : 'text-slate-400'}`}>
              <span>{failedCount > 0 ? 'Klik "Kirim Ulang" pada tabel' : 'Semua dispatch tersinkron'}</span>
            </p>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="glass-panel p-5 rounded-3xl flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="relative w-full md:w-96">
            <Search className="absolute left-4 top-3 w-4 h-4 text-[var(--text-muted)]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by Order Number, Customer, Driver..."
              className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-subtle)] text-white text-xs focus:outline-none focus:border-emerald-500 font-medium"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            {/* Courier Filter */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-[var(--text-muted)]">Courier:</span>
              <select
                value={courierFilter}
                onChange={(e) => setCourierFilter(e.target.value)}
                className="px-3.5 py-2.5 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-subtle)] text-white text-xs focus:outline-none focus:border-emerald-500 font-medium"
              >
                <option value="ALL">All Couriers ({orders.length})</option>
                {couriers.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Shipped Orders Table */}
        <div className="glass-panel border-[var(--border-subtle)] rounded-3xl shadow-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-white/[0.02] text-[var(--text-muted)] uppercase tracking-wider font-semibold border-b border-[var(--border-subtle)]">
                <tr>
                  <th className="px-6 py-4">Foto Serah Terima</th>
                  <th className="px-6 py-4">No. Order / WSA</th>
                  <th className="px-6 py-4">Customer</th>
                  <th className="px-6 py-4">Ekspedisi & Driver</th>
                  <th className="px-6 py-4">Waktu Handover (WIB)</th>
                  <th className="px-6 py-4">Wait Time</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Status Sync ERP</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)] text-[var(--text-secondary)]">
                {loading ? (
                  <tr>
                    <td colSpan={9} className="px-6 py-12 text-center text-[var(--text-muted)]">
                      <div className="flex flex-col items-center gap-2">
                        <div className="w-8 h-8 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
                        <span>Memuat data pesanan terkirim...</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-6 py-12 text-center text-[var(--text-muted)]">
                      <div className="space-y-1">
                        <Tag className="w-8 h-8 text-slate-500 mx-auto mb-2" />
                        <p className="font-bold text-white text-sm">Tidak ada pesanan dengan status Shipped</p>
                        <p className="text-xs text-slate-400">
                          Pesanan yang sudah diserahterimakan ke kurir akan otomatis muncul di sini lengkap dengan foto.
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredOrders.map((ord) => {
                    const photo = ord.pickup_transaction?.photo_key;
                    return (
                      <tr
                        key={ord.id}
                        className="hover:bg-white/[0.03] transition-colors group"
                      >
                        {/* Photo Thumbnail */}
                        <td className="px-6 py-3.5">
                          {photo ? (
                            <button
                              type="button"
                              onClick={() => {
                                setActivePhotoUrl(photo);
                                setActivePhotoTitle(`Handover Proof: ${ord.order_number}`);
                              }}
                              className="relative w-16 h-12 rounded-xl overflow-hidden border border-emerald-500/40 hover:border-emerald-400 transition-all shadow-md group/thumb block cursor-pointer"
                              title="Klik untuk perbesar foto watermark"
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={photo}
                                alt={`Proof ${ord.order_number}`}
                                className="w-full h-full object-cover group-hover/thumb:scale-110 transition-transform duration-300"
                              />
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/thumb:opacity-100 flex items-center justify-center transition-opacity text-white text-xs">
                                <ZoomIn className="w-4 h-4" />
                              </div>
                            </button>
                          ) : (
                            <div className="w-16 h-12 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-[10px] text-slate-500 text-center font-mono p-1">
                              No Photo
                            </div>
                          )}
                        </td>

                        {/* Order Number */}
                        <td className="px-6 py-3.5">
                          <span className="font-mono font-bold text-white text-sm block">
                            {ord.order_number}
                          </span>
                          <div className="flex flex-wrap items-center gap-1.5 mt-1 font-mono text-[10px]">
                            {ord.no_wsa && (
                              <span className="px-1.5 py-0.5 rounded bg-indigo-500/15 border border-indigo-500/30 text-indigo-300">
                                WSA: {ord.no_wsa}
                              </span>
                            )}
                            {ord.picking_no && (
                              <span className="px-1.5 py-0.5 rounded bg-cyan-500/15 border border-cyan-500/30 text-cyan-300">
                                Pick: {ord.picking_no}
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-slate-400 font-mono mt-0.5 block">
                            {ord.items?.length || 0} SKU items
                          </span>
                        </td>

                        {/* Customer */}
                        <td className="px-6 py-3.5">
                          <span className="font-semibold text-white block">
                            {ord.customer_name || 'N/A'}
                          </span>
                        </td>

                        {/* Courier & Driver */}
                        <td className="px-6 py-3.5">
                          <div className="font-medium">
                            <span className="text-cyan-400 font-bold block">
                              {ord.courier_name || ord.pickup_transaction?.courier_company || 'Fleet'}
                            </span>
                            <span className="text-slate-300 text-xs">
                              {ord.pickup_transaction?.driver_name || ord.driver_name || '-'}
                            </span>
                            {ord.driver_phone && (
                              <span className="text-[10px] text-slate-400 font-mono flex items-center gap-1 mt-0.5">
                                <Phone className="w-2.5 h-2.5" />
                                <span>{ord.driver_phone}</span>
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Shipped At */}
                        <td className="px-6 py-3.5 font-mono text-xs">
                          <span className="text-emerald-300 font-bold block">
                            {formatWIB(ord.shipped_at || ord.pickup_transaction?.picked_up_at)}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            Created: {formatWIB(ord.created_at)}
                          </span>
                        </td>

                        {/* Wait Time */}
                        <td className="px-6 py-3.5">
                          {ord.driver_wait_duration_seconds !== null ? (
                            <span className="font-mono text-xs px-2.5 py-1 rounded-xl bg-slate-900 border border-white/10 text-amber-300 font-bold inline-flex items-center gap-1">
                              <Clock className="w-3 h-3 text-amber-400" />
                              <span>{formatDuration(ord.driver_wait_duration_seconds)}</span>
                            </span>
                          ) : (
                            <span className="text-slate-500 font-mono text-xs">-</span>
                          )}
                        </td>

                        {/* Status Badge */}
                        <td className="px-6 py-3.5">
                          <StatusBadge status="SHIP" />
                        </td>

                        {/* Status Sync ERP */}
                        <td className="px-6 py-3.5">
                          {ord.dispatch_sync_status === 'SYNCED' ? (
                            <div className="space-y-1">
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-bold text-[11px]">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                                <span>Sync ERP</span>
                              </span>
                              {ord.dispatch_synced_at && (
                                <span className="text-[10px] text-slate-400 block font-mono">
                                  {formatWIB(ord.dispatch_synced_at)}
                                </span>
                              )}
                            </div>
                          ) : ord.dispatch_sync_status === 'FAILED' ? (
                            <div className="space-y-1.5">
                              <div
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 font-bold text-[11px]"
                                title={ord.dispatch_sync_error || 'Gagal sinkronisasi ke ERP createDispatch'}
                              >
                                <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                                <span>Tidak Sync</span>
                              </div>
                              {ord.dispatch_sync_error && (
                                <p
                                  className="text-[10px] text-rose-300/80 max-w-[170px] line-clamp-2 leading-tight"
                                  title={ord.dispatch_sync_error}
                                >
                                  {ord.dispatch_sync_error}
                                </p>
                              )}
                              <div>
                                <button
                                  type="button"
                                  onClick={() => handleRetryDispatch(ord.id)}
                                  disabled={retryingId === ord.id}
                                  className="px-2.5 py-1 rounded-lg bg-indigo-600/40 hover:bg-indigo-600/70 border border-indigo-500/40 text-indigo-200 font-bold text-[10px] inline-flex items-center gap-1.5 transition-all disabled:opacity-50 shadow-sm"
                                  title="Kirim ulang createDispatch ke ERP Business Central"
                                >
                                  <RefreshCw className={`w-3 h-3 ${retryingId === ord.id ? 'animate-spin' : ''}`} />
                                  <span>{retryingId === ord.id ? 'Mengirim...' : 'Kirim Ulang'}</span>
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="space-y-1.5">
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-slate-500/15 border border-slate-500/30 text-slate-300 font-medium text-[11px]">
                                <Clock className="w-3 h-3 text-slate-400" />
                                <span>Pending</span>
                              </span>
                              {ord.no_wsa && (
                                <div>
                                  <button
                                    type="button"
                                    onClick={() => handleRetryDispatch(ord.id)}
                                    disabled={retryingId === ord.id}
                                    className="px-2.5 py-1 rounded-lg bg-indigo-600/40 hover:bg-indigo-600/70 border border-indigo-500/40 text-indigo-200 font-bold text-[10px] inline-flex items-center gap-1.5 transition-all disabled:opacity-50 shadow-sm"
                                  >
                                    <RefreshCw className={`w-3 h-3 ${retryingId === ord.id ? 'animate-spin' : ''}`} />
                                    <span>{retryingId === ord.id ? 'Mengirim...' : 'Kirim ERP'}</span>
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="px-6 py-3.5 text-right">
                          <button
                            onClick={() => openDetail(ord.id)}
                            className="px-3.5 py-1.5 rounded-xl glass-btn text-xs font-bold text-white hover:text-cyan-300 border-white/10 hover:border-cyan-400/40 transition-all inline-flex items-center gap-1"
                          >
                            <span>Detail & Foto</span>
                            <Maximize className="w-3 h-3" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* DETAIL MODAL WITH ORDER METADATA & FULL PHOTO */}
      {selectedOrderDetail && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-xl flex items-center justify-center p-4 overflow-y-auto">
          <div className="glass-panel-elevated rounded-3xl border border-white/15 max-w-3xl w-full p-6 sm:p-8 space-y-6 my-8 shadow-2xl max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-white/[0.08] pb-4">
              <div>
                <div className="flex items-center gap-3">
                  <h2 className="text-2xl font-black text-white font-mono">
                    {selectedOrderDetail.order_number}
                  </h2>
                  <StatusBadge status={selectedOrderDetail.status} />
                </div>
                <p className="text-xs text-[var(--text-secondary)] mt-1">
                  Recipient Customer: <span className="text-white font-bold">{selectedOrderDetail.customer_name || 'N/A'}</span>
                </p>
              </div>
              <button
                onClick={() => setSelectedOrderDetail(null)}
                className="w-9 h-9 rounded-full glass-btn text-slate-400 hover:text-white flex items-center justify-center font-bold"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Handover Photo Proof Section */}
            {selectedOrderDetail.pickup_transaction?.storage_key ||
            selectedOrderDetail.pickup_transaction?.photo_key ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-black uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                    <Camera className="w-4 h-4" />
                    <span>Bukti Foto Serah Terima (Watermarked Handover Proof)</span>
                  </h3>
                  <button
                    type="button"
                    onClick={() => {
                      const photoUrl =
                        selectedOrderDetail.pickup_transaction?.storage_key ||
                        selectedOrderDetail.pickup_transaction?.photo_key;
                      setActivePhotoUrl(photoUrl);
                      setActivePhotoTitle(`Full Photo: ${selectedOrderDetail.order_number}`);
                    }}
                    className="text-xs text-cyan-400 hover:text-cyan-300 font-bold underline underline-offset-4 flex items-center gap-1"
                  >
                    <Maximize className="w-3.5 h-3.5" />
                    <span>Perbesar Layar Penuh</span>
                  </button>
                </div>

                <div
                  className="rounded-2xl overflow-hidden border-2 border-emerald-500/50 shadow-2xl bg-black cursor-pointer group/modalphoto relative"
                  onClick={() => {
                    const photoUrl =
                      selectedOrderDetail.pickup_transaction?.storage_key ||
                      selectedOrderDetail.pickup_transaction?.photo_key;
                    setActivePhotoUrl(photoUrl);
                    setActivePhotoTitle(`Full Photo: ${selectedOrderDetail.order_number}`);
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={
                      selectedOrderDetail.pickup_transaction?.storage_key ||
                      selectedOrderDetail.pickup_transaction?.photo_key
                    }
                    alt={`Handover proof for ${selectedOrderDetail.order_number}`}
                    className="w-full max-h-96 object-contain"
                  />
                  <div className="absolute inset-0 bg-black/30 opacity-0 group-hover/modalphoto:opacity-100 flex items-center justify-center transition-opacity text-white font-bold text-sm gap-1.5">
                    <ZoomIn className="w-4 h-4" />
                    <span>Klik untuk Melihat Ukuran Asli</span>
                  </div>
                </div>

                <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2 text-emerald-300 font-mono font-bold">
                    <ShieldCheck className="w-4 h-4" />
                    <span>Watermark Tanggal & Waktu: Terverifikasi Asia/Jakarta (WIB)</span>
                  </div>
                  <span className="text-slate-400 font-mono text-[11px]">
                    Captured: {formatWIB(selectedOrderDetail.shipped_at || selectedOrderDetail.pickup_transaction?.picked_up_at)}
                  </span>
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-2xl bg-slate-900 border border-white/10 text-xs text-slate-400 text-center">
                Belum ada foto serah terima yang tercatat untuk pesanan ini.
              </div>
            )}

            {/* Courier & Dispatch Info Card */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="glass-panel p-4 rounded-2xl border border-white/10 space-y-2 text-xs">
                <h4 className="font-bold text-white uppercase text-[11px] tracking-wider text-cyan-400 flex items-center gap-1.5">
                  <Truck className="w-3.5 h-3.5" />
                  <span>Informasi Kurir & Handover</span>
                </h4>
                <div className="flex justify-between border-b border-white/[0.06] pb-1.5">
                  <span className="text-slate-400">Ekspedisi:</span>
                  <span className="font-bold text-white">
                    {selectedOrderDetail.courier_name || selectedOrderDetail.pickup_transaction?.courier_company || 'General'}
                  </span>
                </div>
                <div className="flex justify-between border-b border-white/[0.06] pb-1.5">
                  <span className="text-slate-400">Nama Driver:</span>
                  <span className="font-bold text-white">
                    {selectedOrderDetail.pickup_transaction?.driver_name || selectedOrderDetail.driver_name || '-'}
                  </span>
                </div>
                <div className="flex justify-between border-b border-white/[0.06] pb-1.5">
                  <span className="text-slate-400">No. Telepon:</span>
                  <span className="font-mono text-white">
                    {selectedOrderDetail.driver_phone || '-'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Waktu Handover:</span>
                  <span className="font-mono text-emerald-400 font-bold">
                    {formatWIB(selectedOrderDetail.shipped_at || selectedOrderDetail.pickup_transaction?.picked_up_at)}
                  </span>
                </div>
              </div>

              <div className="glass-panel p-4 rounded-2xl border border-white/10 space-y-2 text-xs">
                <h4 className="font-bold text-white uppercase text-[11px] tracking-wider text-indigo-400 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Metrik Waktu & SLA</span>
                </h4>
                <div className="flex justify-between border-b border-white/[0.06] pb-1.5">
                  <span className="text-slate-400">Waktu Order Masuk:</span>
                  <span className="font-mono text-white">{formatWIB(selectedOrderDetail.created_at)}</span>
                </div>
                <div className="flex justify-between border-b border-white/[0.06] pb-1.5">
                  <span className="text-slate-400">Driver Tiba di Kiosk:</span>
                  <span className="font-mono text-amber-300">
                    {selectedOrderDetail.driver_arrived_at ? formatWIB(selectedOrderDetail.driver_arrived_at) : 'Langsung Pickup'}
                  </span>
                </div>
                <div className="flex justify-between border-b border-white/[0.06] pb-1.5">
                  <span className="text-slate-400">Durasi Menunggu Driver:</span>
                  <span className="font-mono text-amber-400 font-bold">
                    {formatDuration(selectedOrderDetail.driver_wait_duration_seconds)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Durasi Pengepakan (Packing):</span>
                  <span className="font-mono text-indigo-300 font-bold">
                    {formatDuration(selectedOrderDetail.packing_duration_seconds)}
                  </span>
                </div>
              </div>
            </div>

            {/* ERP Business Central Integration (createDispatch) */}
            <div className="glass-panel p-4 rounded-2xl border border-white/10 space-y-3 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="font-bold text-white uppercase text-[11px] tracking-wider text-emerald-400 flex items-center gap-1.5">
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Status Integrasi ERP Business Central (createDispatch)</span>
                </h4>
                {selectedOrderDetail.no_wsa && (
                  <button
                    type="button"
                    onClick={() => handleRetryDispatch(selectedOrderDetail.id)}
                    disabled={retryingId === selectedOrderDetail.id}
                    className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs inline-flex items-center gap-1.5 transition-all disabled:opacity-50 shadow-md cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${retryingId === selectedOrderDetail.id ? 'animate-spin' : ''}`} />
                    <span>{retryingId === selectedOrderDetail.id ? 'Mengirim ke ERP...' : 'Kirim Ulang ke ERP'}</span>
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div className="flex justify-between border-b border-white/[0.06] pb-1.5">
                  <span className="text-slate-400">Nomor WSA (Shipment No):</span>
                  <span className="font-mono font-bold text-indigo-300">
                    {selectedOrderDetail.no_wsa || '-'}
                  </span>
                </div>
                <div className="flex justify-between border-b border-white/[0.06] pb-1.5">
                  <span className="text-slate-400">Status Sinkronisasi:</span>
                  {selectedOrderDetail.dispatch_sync_status === 'SYNCED' ? (
                    <span className="inline-flex items-center gap-1 text-emerald-400 font-bold">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>SYNCED (Berhasil)</span>
                    </span>
                  ) : selectedOrderDetail.dispatch_sync_status === 'FAILED' ? (
                    <span className="inline-flex items-center gap-1 text-rose-400 font-bold">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span>FAILED (Tidak Sync)</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-amber-400 font-bold">
                      <Clock className="w-3.5 h-3.5" />
                      <span>PENDING</span>
                    </span>
                  )}
                </div>
                <div className="flex justify-between border-b border-white/[0.06] pb-1.5">
                  <span className="text-slate-400">Waktu Terkirim ke ERP:</span>
                  <span className="font-mono text-white">
                    {selectedOrderDetail.dispatch_synced_at ? formatWIB(selectedOrderDetail.dispatch_synced_at) : '-'}
                  </span>
                </div>
                <div className="flex justify-between border-b border-white/[0.06] pb-1.5">
                  <span className="text-slate-400">Jumlah Percobaan:</span>
                  <span className="font-mono text-white">
                    {selectedOrderDetail.dispatch_retry_count || 0} kali
                  </span>
                </div>
              </div>

              {selectedOrderDetail.dispatch_sync_error && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-[11px] uppercase tracking-wide">Pesan Error Integrasi ERP:</p>
                    <p className="mt-0.5 font-mono text-[11px] leading-relaxed break-all">
                      {selectedOrderDetail.dispatch_sync_error}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Items / SKU Table */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                <Package className="w-3.5 h-3.5 text-cyan-400" />
                <span>Daftar Barang Dalam Pesanan ({selectedOrderDetail.items?.length || 0} SKU)</span>
              </h4>
              <div className="glass-panel rounded-2xl overflow-hidden border border-white/10">
                <table className="w-full text-left text-xs">
                  <thead className="bg-white/[0.03] text-slate-400 uppercase text-[10px] border-b border-white/10">
                    <tr>
                      <th className="px-4 py-2.5">SKU</th>
                      <th className="px-4 py-2.5">Varian / Size</th>
                      <th className="px-4 py-2.5">Warna</th>
                      <th className="px-4 py-2.5">Nama Produk</th>
                      <th className="px-4 py-2.5 text-right">Quantity</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.06] text-slate-300">
                    {selectedOrderDetail.items && selectedOrderDetail.items.length > 0 ? (
                      selectedOrderDetail.items.map((item: any) => (
                        <tr key={item.id}>
                          <td className="px-4 py-2 font-mono text-cyan-400 font-semibold">{item.sku || '-'}</td>
                          <td className="px-4 py-2 font-mono">
                            {item.size ? (
                              <span className="px-2 py-0.5 rounded-lg bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-bold text-[11px]">
                                {item.size}
                              </span>
                            ) : (
                              <span className="text-slate-500">-</span>
                            )}
                          </td>
                          <td className="px-4 py-2 font-mono">
                            {item.warna ? (
                              <span className="px-2 py-0.5 rounded-lg bg-pink-500/20 text-pink-300 border border-pink-500/30 font-bold text-[11px]">
                                {item.warna}
                              </span>
                            ) : (
                              <span className="text-slate-500">-</span>
                            )}
                          </td>
                          <td className="px-4 py-2 text-white font-medium">{item.product_name}</td>
                          <td className="px-4 py-2 text-right font-mono font-bold text-white">{item.quantity} pcs</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="px-4 py-4 text-center text-slate-500">
                          Tidak ada rincian item SKU.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedOrderDetail(null)}
                className="px-6 py-2.5 rounded-2xl glass-btn text-xs font-bold text-white hover:border-white/30"
              >
                Tutup Rincian
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FULLSCREEN PHOTO LIGHTBOX MODAL */}
      {activePhotoUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/95 backdrop-blur-2xl flex flex-col justify-between p-4 sm:p-6"
          onClick={() => setActivePhotoUrl(null)}
        >
          {/* Top Bar */}
          <div
            className="flex items-center justify-between z-10 p-2"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <Camera className="w-5 h-5 text-emerald-400" />
              <div>
                <h3 className="text-white font-bold text-sm sm:text-base font-mono">
                  {activePhotoTitle || 'Foto Serah Terima Watermark'}
                </h3>
                <p className="text-xs text-emerald-400 font-mono">
                  Asia/Jakarta (WIB) • Tamper-proof Dock Verification
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <a
                href={activePhotoUrl}
                download={`PROOF-${Date.now()}.jpg`}
                className="px-4 py-2 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-lg shadow-emerald-500/20"
                onClick={(e) => e.stopPropagation()}
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download Foto</span>
              </a>
              <button
                onClick={() => setActivePhotoUrl(null)}
                className="w-10 h-10 rounded-2xl glass-btn text-white text-base font-bold flex items-center justify-center hover:bg-white/20"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Centered Image */}
          <div
            className="flex-1 flex items-center justify-center p-2 sm:p-4 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={activePhotoUrl}
              alt="Handover Full Proof"
              className="max-h-[82vh] max-w-full rounded-2xl shadow-2xl border-2 border-emerald-500/50 object-contain"
            />
          </div>

          {/* Bottom Caption */}
          <div
            className="text-center text-xs text-slate-400 font-mono py-2"
            onClick={(e) => e.stopPropagation()}
          >
            Klik di luar gambar atau tekan tombol tutup untuk menutup tampilan.
          </div>
        </div>
      )}
    </StaffLayout>
  );
}
