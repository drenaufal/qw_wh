'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { StaffLayout } from '@/components/StaffLayout';
import { Order } from '@/lib/types';
import { useSSE } from '@/hooks/use-sse';
import { formatWIB, formatDuration, getElapsedSeconds } from '@/lib/utils/datetime';
import { StatusBadge, PriorityBadge } from '@/components/ui';

export default function PickupAdminPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPhotoAudit, setSelectedPhotoAudit] = useState<{
    orderNumber: string;
    driverName: string;
    courierCompany: string;
    pickedUpAt: string;
    photoUrl: string;
    waitDurationSec?: number;
  } | null>(null);

  // Assist Driver Modal
  const [assistOrder, setAssistOrder] = useState<Order | null>(null);
  const [assistDriverName, setAssistDriverName] = useState('');
  const [assistCourier, setAssistCourier] = useState('J&T Express');
  const [submittingAssist, setSubmittingAssist] = useState(false);

  const [submittingAction, setSubmittingAction] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [nowSec, setNowSec] = useState(0);

  const { subscribe } = useSSE();

  useEffect(() => {
    setNowSec(Date.now());
    const t = setInterval(() => setNowSec(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const fetchOrders = useCallback(async () => {
    try {
      const res = await fetch('/api/orders?limit=150');
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
    const unsub3 = subscribe('pickupShipped', handleUpdate);
    const unsub4 = subscribe('priorityUpdate', handleUpdate);

    return () => {
      unsub1();
      unsub2();
      unsub3();
      unsub4();
    };
  }, [subscribe, fetchOrders]);

  const handleResetPriority = async (orderId: string) => {
    setSubmittingAction(true);
    setErrorMsg(null);
    try {
      const token = localStorage.getItem('wh_auth_token');
      const res = await fetch(`/api/orders/${orderId}/set-priority`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ priority: 'NORMAL', reason: 'Admin dock reset' }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to reset priority');
      await fetchOrders();
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setSubmittingAction(false);
    }
  };

  const handleAssistSubmit = async () => {
    if (!assistOrder || !assistDriverName.trim()) return;

    setSubmittingAssist(true);
    setErrorMsg(null);
    try {
      const token = localStorage.getItem('wh_auth_token');
      const res = await fetch(`/api/orders/${assistOrder.id}/driver-arrival`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          driver_name: assistDriverName.trim(),
          courier_company: assistCourier,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to register driver arrival');

      setAssistOrder(null);
      setAssistDriverName('');
      await fetchOrders();
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setSubmittingAssist(false);
    }
  };

  const inspectPhoto = (order: Order) => {
    if (!order.pickup_transaction?.photo_key) return;
    setSelectedPhotoAudit({
      orderNumber: order.order_number,
      driverName: order.pickup_transaction.driver_name,
      courierCompany: order.pickup_transaction.courier_company,
      pickedUpAt: order.pickup_transaction.picked_up_at,
      photoUrl: order.pickup_transaction.photo_key,
      waitDurationSec: order.driver_wait_duration_seconds ?? undefined,
    });
  };

  const waitingCouriers = orders.filter(
    (o) => o.priority_status === 'DRIVER_WAITING' && o.status !== 'SHIP'
  );

  const stagingShelves = orders.filter((o) => o.status === 'READY_FOR_PICKUP');

  const dispatchedOrders = orders
    .filter((o) => o.status === 'SHIP' && o.pickup_transaction?.photo_key)
    .sort((a, b) => {
      const tA = a.shipped_at ? new Date(a.shipped_at).getTime() : 0;
      const tB = b.shipped_at ? new Date(b.shipped_at).getTime() : 0;
      return tB - tA;
    });

  return (
    <StaffLayout
      title="Pickup Admin Control Desk"
      subtitle="Staging bay telemetry, arrival assistance, priority resets, and full-resolution photo audit"
      allowedRoles={['PICKUP_ADMIN', 'SUPERADMIN']}
    >
      <div className="space-y-8">
        {errorMsg && (
          <div className="p-4 rounded-2xl bg-rose-500/15 border border-rose-500/40 text-rose-300 text-xs font-semibold flex items-center justify-between shadow-lg">
            <div className="flex items-center gap-2.5">
              <span>⚠️</span>
              <span>{errorMsg}</span>
            </div>
            <button
              onClick={() => setErrorMsg(null)}
              className="text-rose-400 hover:text-white text-xs font-bold"
            >
              ✕
            </button>
          </div>
        )}

        {/* ZONE 1: COURIERS WAITING AT DOCK BAYS */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <span className="w-3 h-3 rounded-full bg-amber-400 animate-ping" />
              <h2 className="text-base font-black text-amber-400 uppercase tracking-widest">
                Zone 1: Couriers Waiting at Dock Bays ({waitingCouriers.length})
              </h2>
            </div>
            <span className="text-xs text-[var(--text-muted)] font-mono">
              Live Dwell Duration
            </span>
          </div>

          {waitingCouriers.length === 0 ? (
            <div className="glass-panel rounded-3xl p-6 text-center text-xs text-[var(--text-muted)]">
              No courier drivers currently waiting on dock bays.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {waitingCouriers.map((order, idx) => {
                const elapsedSec = order.driver_arrived_at
                  ? getElapsedSeconds(order.driver_arrived_at)
                  : 0;

                return (
                  <div
                    key={order.id}
                    className="glass-panel border-2 border-amber-500/60 rounded-3xl p-6 shadow-2xl flex flex-col justify-between gap-4 glow-amber-3d transform hover:translate-y-[-3px] transition-all"
                  >
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black px-2.5 py-0.5 rounded-lg bg-amber-400 text-slate-950 font-mono">
                          QUEUE #{idx + 1}
                        </span>
                        <span className="font-mono font-black text-lg text-white">
                          {order.order_number}
                        </span>
                        <StatusBadge status={order.status} />
                      </div>

                      <div className="text-xs space-y-1">
                        <p className="text-amber-300 font-bold">
                          Fleet: {order.courier_name || 'General Fleet'}
                        </p>
                        <p className="text-white">
                          Customer: <span className="text-slate-300">{order.customer_name || 'N/A'}</span>
                        </p>
                        {order.driver_name && (
                          <p className="text-slate-400">Driver: {order.driver_name}</p>
                        )}
                      </div>

                      <div className="p-3 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-between text-xs font-mono font-black text-amber-300 shadow-inner">
                        <span>Dock Wait Time:</span>
                        <span>⏳ {formatDuration(elapsedSec)}</span>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => handleResetPriority(order.id)}
                        disabled={submittingAction}
                        className="w-full py-2.5 px-4 rounded-2xl glass-btn text-xs font-bold text-[var(--text-secondary)] hover:text-white transition-all"
                      >
                        Reset to Normal Priority
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ZONE 2: STAGING BAY SHELVES (READY FOR PICKUP) */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <span className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse" />
              <h2 className="text-base font-black text-emerald-400 uppercase tracking-widest">
                Zone 2: Staging Bay Shelves ({stagingShelves.length})
              </h2>
            </div>
            <span className="text-xs text-[var(--text-muted)] font-mono">
              Ready for driver collection
            </span>
          </div>

          {stagingShelves.length === 0 ? (
            <div className="glass-panel rounded-3xl p-6 text-center text-xs text-[var(--text-muted)]">
              Staging rack is currently empty.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {stagingShelves.map((order) => {
                const isDriverWaiting = order.priority_status === 'DRIVER_WAITING';

                return (
                  <div
                    key={order.id}
                    className={`glass-panel rounded-3xl p-6 shadow-xl flex flex-col justify-between gap-4 transition-all duration-300 ${
                      isDriverWaiting
                        ? 'border-amber-500/70 bg-gradient-to-br from-amber-950/25 to-[var(--bg-card)] glow-amber-3d translate-y-[-2px]'
                        : 'border-emerald-500/30 hover:border-emerald-500/60 hover:translate-y-[-2px]'
                    }`}
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-lg text-white">
                          {order.order_number}
                        </span>
                        <PriorityBadge priority={order.priority_status} />
                      </div>

                      <div className="text-xs space-y-1">
                        <p className="text-slate-300">
                          Recipient: <span className="text-white font-semibold">{order.customer_name || 'N/A'}</span>
                        </p>
                        <p className="text-emerald-400 font-bold">
                          Fleet: {order.courier_name || 'General'}
                        </p>
                        {order.packed_at && (
                          <p className="text-[11px] text-[var(--text-muted)] font-mono">
                            Staged {formatDuration(getElapsedSeconds(order.packed_at))} ago
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="pt-2">
                      {!isDriverWaiting ? (
                        <button
                          onClick={() => {
                            setAssistOrder(order);
                            setAssistDriverName('');
                            setAssistCourier(order.courier_name || 'J&T Express');
                          }}
                          className="w-full py-3 px-4 rounded-2xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-black transition-all flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(245,158,11,0.2)]"
                        >
                          <span>🙋‍♂️ Assist Driver Arrival</span>
                        </button>
                      ) : (
                        <div className="text-center py-2.5 px-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-xs font-bold text-amber-300">
                          Driver Checked In • Handover at Terminal
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ZONE 3: RECENTLY DISPATCHED & PHOTO FORENSIC AUDIT */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <span className="w-3 h-3 rounded-full bg-purple-400" />
              <h2 className="text-base font-black text-purple-400 uppercase tracking-widest">
                Zone 3: Dispatched & Handover Photo Audit ({dispatchedOrders.length})
              </h2>
            </div>
            <span className="text-xs text-[var(--text-muted)] font-mono">
              Immutable watermarked photographic proof
            </span>
          </div>

          {dispatchedOrders.length === 0 ? (
            <div className="glass-panel rounded-3xl p-6 text-center text-xs text-[var(--text-muted)]">
              No recent dispatches with captured handover photos.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-5">
              {dispatchedOrders.map((order) => {
                const pt = order.pickup_transaction;
                return (
                  <div
                    key={order.id}
                    className="glass-panel border-purple-500/30 rounded-3xl p-4 shadow-lg flex flex-col justify-between gap-3 hover:border-purple-500/60 hover:translate-y-[-2px] transition-all"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-sm text-purple-300">
                          {order.order_number}
                        </span>
                        <StatusBadge status="SHIP" />
                      </div>

                      {/* Thumbnail Preview */}
                      {pt?.photo_key && (
                        <div
                          onClick={() => inspectPhoto(order)}
                          className="relative aspect-video rounded-2xl overflow-hidden border border-purple-500/40 bg-black cursor-pointer group shadow-inner"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={pt.photo_key}
                            alt="Handover Preview"
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-xs font-black text-white backdrop-blur-sm">
                            🔍 Inspect Photo
                          </div>
                        </div>
                      )}

                      <div className="text-[11px] text-slate-300 space-y-0.5">
                        <p>Driver: <span className="text-white font-medium">{pt?.driver_name}</span></p>
                        <p>Fleet: <span className="text-purple-300 font-semibold">{pt?.courier_company}</span></p>
                        <p className="text-[10px] text-[var(--text-muted)] font-mono">
                          {formatWIB(pt?.picked_up_at)}
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={() => inspectPhoto(order)}
                      className="w-full py-2.5 px-3 rounded-2xl glass-btn text-purple-300 border-purple-500/40 text-xs font-black flex items-center justify-center gap-1.5 hover:bg-purple-500/20"
                    >
                      <span>🔍 Inspect Photo</span>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* FULL-RESOLUTION PHOTO AUDIT MODAL */}
      {selectedPhotoAudit && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass-panel-elevated border-purple-500/60 rounded-3xl max-w-3xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
            <div className="p-5 bg-white/[0.03] border-b border-[var(--border-subtle)] flex items-center justify-between">
              <div>
                <h3 className="text-base font-black text-white tracking-tight">
                  Handover Photo Forensic Inspection
                </h3>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                  Order <span className="font-mono font-bold text-purple-300">{selectedPhotoAudit.orderNumber}</span> • Driver: {selectedPhotoAudit.driverName} ({selectedPhotoAudit.courierCompany})
                </p>
              </div>
              <button
                onClick={() => setSelectedPhotoAudit(null)}
                className="text-[var(--text-muted)] hover:text-white text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 flex flex-col items-center">
              <div className="rounded-2xl overflow-hidden border-2 border-emerald-500/50 shadow-2xl max-w-full">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={selectedPhotoAudit.photoUrl}
                  alt="Full Forensic Handover Proof"
                  className="max-h-[60vh] object-contain"
                />
              </div>

              <div className="mt-4 w-full glass-panel p-4 rounded-2xl border border-[var(--border-subtle)] grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
                <div>
                  <span className="text-[var(--text-muted)] block">Dispatched Timestamp:</span>
                  <span className="text-white font-bold">{formatWIB(selectedPhotoAudit.pickedUpAt)}</span>
                </div>
                <div>
                  <span className="text-[var(--text-muted)] block">Courier Partner:</span>
                  <span className="text-emerald-400 font-bold">{selectedPhotoAudit.courierCompany}</span>
                </div>
                <div>
                  <span className="text-[var(--text-muted)] block">Courier Driver:</span>
                  <span className="text-white font-bold">{selectedPhotoAudit.driverName}</span>
                </div>
                <div>
                  <span className="text-[var(--text-muted)] block">Wait Duration:</span>
                  <span className="text-cyan-400 font-bold">
                    {formatDuration(selectedPhotoAudit.waitDurationSec)}
                  </span>
                </div>
              </div>
            </div>

            <div className="p-4 bg-white/[0.03] border-t border-[var(--border-subtle)] flex justify-end">
              <button
                onClick={() => setSelectedPhotoAudit(null)}
                className="py-2.5 px-6 rounded-2xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition-all"
              >
                Close Inspection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ASSIST DRIVER ARRIVAL MODAL */}
      {assistOrder && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass-panel-elevated border-amber-500/50 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border-subtle)]">
              <h3 className="text-base font-bold text-white">
                Assist Driver Arrival (Manual Check-In)
              </h3>
              <button
                onClick={() => setAssistOrder(null)}
                className="text-[var(--text-muted)] hover:text-white"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
              Assisting driver arrival for order{' '}
              <span className="text-amber-400 font-bold font-mono">
                {assistOrder.order_number}
              </span>
              . This will start the live dwell timer and mark the order on the TV board.
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-1">
                  Driver Name <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  value={assistDriverName}
                  onChange={(e) => setAssistDriverName(e.target.value)}
                  placeholder="Driver's full name"
                  required
                  className="w-full px-4 py-2.5 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-subtle)] text-white text-xs focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-1">
                  Courier Fleet
                </label>
                <input
                  type="text"
                  value={assistCourier}
                  onChange={(e) => setAssistCourier(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-subtle)] text-white text-xs focus:outline-none focus:border-amber-400"
                />
              </div>
            </div>

            <div className="pt-2 flex gap-3">
              <button
                type="button"
                onClick={() => setAssistOrder(null)}
                className="flex-1 py-2.5 px-4 rounded-2xl glass-btn text-xs text-[var(--text-secondary)]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAssistSubmit}
                disabled={submittingAssist || !assistDriverName.trim()}
                className="flex-2 py-2.5 px-5 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs disabled:opacity-50 shadow-lg shadow-amber-500/25"
              >
                {submittingAssist ? 'Recording...' : 'Confirm Arrival'}
              </button>
            </div>
          </div>
        </div>
      )}
    </StaffLayout>
  );
}
