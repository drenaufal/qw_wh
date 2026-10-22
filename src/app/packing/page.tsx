'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { StaffLayout } from '@/components/StaffLayout';
import { Order, OrderItem } from '@/lib/types';
import { useAuth } from '@/lib/context/AuthContext';
import { useSSE } from '@/hooks/use-sse';
import { formatWIB, formatDuration, getElapsedSeconds } from '@/lib/utils/datetime';
import { StatusBadge, PriorityBadge } from '@/components/ui';

export default function PackerStationPage() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeChecklistOrder, setActiveChecklistOrder] = useState<Order | null>(null);
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});
  const [packingNotes, setPackingNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
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
        throw new Error(data.error || 'Failed to claim order');
      }

      await fetchOrders();
      const claimed = orders.find((o) => o.id === orderId) || data.order;
      openChecklist(claimed);
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const openChecklist = (order: Order) => {
    setActiveChecklistOrder(order);
    setPackingNotes('');
    setErrorMsg(null);

    const initialChecked: Record<string, boolean> = {};
    if (order.items) {
      order.items.forEach((it) => {
        initialChecked[it.id] = false;
      });
    }
    setCheckedItems(initialChecked);
  };

  const toggleItem = (itemId: string) => {
    setCheckedItems((prev) => ({
      ...prev,
      [itemId]: !prev[itemId],
    }));
  };

  const itemsList = activeChecklistOrder?.items || [];
  const allVerified =
    itemsList.length > 0 && itemsList.every((it) => !!checkedItems[it.id]);

  const handleCompletePacking = async () => {
    if (!activeChecklistOrder || !allVerified) return;

    setSubmitting(true);
    setErrorMsg(null);
    try {
      const token = localStorage.getItem('wh_auth_token');
      const payload = {
        notes: packingNotes.trim() || undefined,
        items: itemsList.map((it) => ({
          order_item_id: it.id,
          packed_quantity: it.quantity,
          is_verified: true,
        })),
      };

      const res = await fetch(`/api/orders/${activeChecklistOrder.id}/packing/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to complete packing checklist');
      }

      setActiveChecklistOrder(null);
      await fetchOrders();
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const priorityQueue = orders.filter((o) => o.priority_status === 'DRIVER_WAITING');
  const activeBench = orders.filter((o) => o.status === 'PACKING');
  const standardQueue = orders.filter(
    (o) => o.status === 'WAITING' && o.priority_status === 'NORMAL'
  );

  return (
    <StaffLayout
      title="Packer Workstation Matrix"
      subtitle="Antigravity spatial verification benches, priority escalation claim, and carton QA"
      allowedRoles={['PACKER', 'SUPERADMIN']}
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

        {/* QUEUE 1: TIER 1 PRIORITY QUEUE (COURIER WAITING) */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <span className="w-3 h-3 rounded-full bg-amber-400 animate-ping" />
              <h2 className="text-base font-black text-amber-400 uppercase tracking-widest">
                Tier 1 Priority: Couriers Waiting ({priorityQueue.length})
              </h2>
            </div>
            <span className="text-xs text-amber-300 font-mono font-bold bg-amber-500/15 border border-amber-500/40 px-3.5 py-1 rounded-full shadow-[0_0_15px_rgba(245,158,11,0.2)]">
              ⚡ Action Mandatory: Process Before FIFO Backlog
            </span>
          </div>

          {priorityQueue.length === 0 ? (
            <div className="glass-panel rounded-3xl p-6 text-center text-xs text-[var(--text-muted)]">
              No couriers currently waiting in dock for packaging.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {priorityQueue.map((order) => {
                const waitSec = order.driver_arrived_at
                  ? getElapsedSeconds(order.driver_arrived_at)
                  : 0;

                return (
                  <div
                    key={order.id}
                    className="glass-panel border-2 border-amber-500/70 rounded-3xl p-6 shadow-2xl relative overflow-hidden flex flex-col justify-between gap-4 glow-amber-3d transform hover:translate-y-[-3px] transition-all"
                  >
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xl font-black font-mono text-white drop-shadow">
                          {order.order_number}
                        </span>
                        <StatusBadge status={order.status} />
                      </div>

                      <div className="text-xs space-y-1">
                        <p className="text-slate-300">
                          Recipient: <span className="font-semibold text-white">{order.customer_name || 'N/A'}</span>
                        </p>
                        <p className="text-amber-300 font-bold">
                          Fleet: {order.courier_name || 'General Fleet'}
                        </p>
                      </div>

                      {/* Wait Timer HUD */}
                      <div className="p-3 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-between text-xs font-mono font-black text-amber-300 shadow-inner">
                        <span>Courier Waiting:</span>
                        <span>⏳ {formatDuration(waitSec)}</span>
                      </div>

                      {order.items && order.items.length > 0 && (
                        <div className="pt-2.5 border-t border-amber-500/30 text-xs text-[var(--text-secondary)]">
                          <p className="font-bold text-white mb-1.5 uppercase text-[10px] tracking-wider">
                            SKU Manifest ({order.items.length} items):
                          </p>
                          <ul className="space-y-1 text-[11px] text-slate-300">
                            {order.items.slice(0, 3).map((it) => (
                              <li key={it.id} className="flex justify-between truncate">
                                <span>{it.product_name}</span>
                                <span className="text-amber-400 font-bold ml-2">({it.quantity}x)</span>
                              </li>
                            ))}
                            {order.items.length > 3 && (
                              <li className="text-[10px] text-amber-400 font-bold">
                                + {order.items.length - 3} more items in carton...
                              </li>
                            )}
                          </ul>
                        </div>
                      )}
                    </div>

                    <div className="pt-2">
                      {order.status === 'PACKING' ? (
                        <button
                          onClick={() => openChecklist(order)}
                          className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 text-white font-black text-xs shadow-lg shadow-cyan-500/30 transition-all flex items-center justify-center gap-2"
                        >
                          <span>Open Verification Checklist</span>
                          <span>✓</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => handleStartPacking(order.id)}
                          disabled={submitting}
                          className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs shadow-lg shadow-amber-500/30 disabled:opacity-50 transition-all flex items-center justify-center gap-2 hover:scale-[1.02]"
                        >
                          <span>⚡ Claim & Start Packing</span>
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
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <span className="w-3 h-3 rounded-full bg-cyan-400 animate-pulse" />
              <h2 className="text-base font-black text-cyan-400 uppercase tracking-widest">
                Active Packing Bench ({activeBench.length})
              </h2>
            </div>
            <span className="text-xs text-[var(--text-muted)]">
              Orders currently on workstation benches
            </span>
          </div>

          {activeBench.length === 0 ? (
            <div className="glass-panel rounded-3xl p-6 text-center text-xs text-[var(--text-muted)]">
              No orders actively on the packing bench. Claim from queue below!
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {activeBench.map((order) => {
                const packingSec = order.packing_started_at
                  ? getElapsedSeconds(order.packing_started_at)
                  : 0;

                return (
                  <div
                    key={order.id}
                    className="glass-panel border-cyan-500/40 rounded-3xl p-6 shadow-xl flex flex-col justify-between gap-4 hover:border-cyan-400 transition-all"
                  >
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-lg font-bold font-mono text-white">
                          {order.order_number}
                        </span>
                        <PriorityBadge priority={order.priority_status} />
                      </div>

                      <p className="text-xs text-slate-300">
                        Customer: <span className="text-white font-medium">{order.customer_name || 'N/A'}</span> • Fleet: <span className="text-cyan-400 font-bold">{order.courier_name || 'General'}</span>
                      </p>

                      <div className="p-2.5 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-between text-xs font-mono text-cyan-300">
                        <span>Packing Duration:</span>
                        <span className="font-bold">{formatDuration(packingSec)}</span>
                      </div>
                    </div>

                    <button
                      onClick={() => openChecklist(order)}
                      className="w-full py-2.5 px-4 rounded-2xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2"
                    >
                      <span>Open Checklist Modal</span>
                      <span>📋</span>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* QUEUE 3: STANDARD PACKAGING QUEUE */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <span className="w-3 h-3 rounded-full bg-slate-500" />
              <h2 className="text-base font-bold text-slate-300 uppercase tracking-widest">
                Standard Packaging Queue ({standardQueue.length})
              </h2>
            </div>
            <span className="text-xs text-[var(--text-muted)]">
              General FIFO backlog waiting for bench assignment
            </span>
          </div>

          {standardQueue.length === 0 ? (
            <div className="glass-panel rounded-3xl p-6 text-center text-xs text-[var(--text-muted)]">
              Standard packaging backlog is clear!
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {standardQueue.map((order) => (
                <div
                  key={order.id}
                  className="glass-panel rounded-3xl p-5 shadow-sm flex flex-col justify-between gap-3 hover:border-white/20 transition-all"
                >
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-sm text-white">
                        {order.order_number}
                      </span>
                      <StatusBadge status={order.status} />
                    </div>
                    <p className="text-xs text-[var(--text-secondary)]">
                      {order.customer_name || 'N/A'} • {order.courier_name || 'General Fleet'}
                    </p>
                    {order.items && (
                      <p className="text-[11px] text-[var(--text-muted)] truncate">
                        {order.items.length} items to verify
                      </p>
                    )}
                  </div>

                  <button
                    onClick={() => handleStartPacking(order.id)}
                    disabled={submitting}
                    className="w-full py-2.5 px-3 rounded-2xl glass-btn text-xs font-bold text-slate-300 hover:text-white transition-all flex items-center justify-center gap-1.5"
                  >
                    <span>Claim Order</span>
                    <span>→</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ITEM VERIFICATION CHECKLIST MODAL (QA GATE) */}
      {activeChecklistOrder && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass-panel-elevated border-cyan-500/50 rounded-3xl max-w-2xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 bg-white/[0.03] border-b border-[var(--border-subtle)] flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2.5">
                  <span className="text-xl">📋</span>
                  <h3 className="text-lg font-black text-white tracking-tight">
                    Packer QA Verification Checklist
                  </h3>
                </div>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                  Order <span className="font-mono font-bold text-amber-400">{activeChecklistOrder.order_number}</span> • Recipient: {activeChecklistOrder.customer_name}
                </p>
              </div>

              <button
                onClick={() => setActiveChecklistOrder(null)}
                className="text-[var(--text-muted)] hover:text-white text-base"
              >
                ✕
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 flex-1">
              <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs">
                ⚠️ <strong>Quality Gate Mandatory:</strong> Every SKU and quantity must be physically verified inside the carton box before sealing.
              </div>

              <div className="space-y-2">
                <p className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                  SKU Checklist ({Object.values(checkedItems).filter(Boolean).length} / {itemsList.length} Checked)
                </p>

                {itemsList.map((item) => {
                  const isChecked = !!checkedItems[item.id];
                  return (
                    <label
                      key={item.id}
                      onClick={() => toggleItem(item.id)}
                      className={`flex items-start gap-3.5 p-4 rounded-2xl border cursor-pointer transition-all ${
                        isChecked
                          ? 'bg-emerald-950/20 border-emerald-500/50 text-white shadow-[0_0_15px_rgba(16,185,129,0.2)]'
                          : 'glass-panel text-[var(--text-secondary)] hover:border-cyan-500/40'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleItem(item.id)}
                        className="mt-1 w-5 h-5 rounded-lg border-slate-600 text-emerald-500 focus:ring-0 focus:outline-none"
                      />
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-bold text-white">
                            {item.product_name}
                          </span>
                          <span className="font-mono text-xs font-black px-2.5 py-0.5 rounded-lg bg-[var(--bg-primary)] text-cyan-400 border border-[var(--border-subtle)]">
                            Qty: {item.quantity}
                          </span>
                        </div>
                        {item.sku && (
                          <p className="text-xs text-[var(--text-muted)] font-mono mt-0.5">
                            SKU: {item.sku}
                          </p>
                        )}
                      </div>
                    </label>
                  );
                })}
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-1.5">
                  Carton Sealing Notes & Condition (Optional)
                </label>
                <textarea
                  rows={2}
                  value={packingNotes}
                  onChange={(e) => setPackingNotes(e.target.value)}
                  placeholder="e.g. Double bubble wrapped, fragile tape applied, carton box #4"
                  className="w-full px-4 py-2.5 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-subtle)] text-white text-xs focus:outline-none focus:border-cyan-400"
                />
              </div>
            </div>

            <div className="p-6 bg-white/[0.03] border-t border-[var(--border-subtle)] flex items-center justify-between gap-4">
              <button
                type="button"
                onClick={() => setActiveChecklistOrder(null)}
                className="py-2.5 px-5 rounded-2xl glass-btn text-xs font-bold text-[var(--text-secondary)]"
              >
                Close & Return
              </button>

              <button
                type="button"
                onClick={handleCompletePacking}
                disabled={!allVerified || submitting}
                className="py-3 px-6 rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white font-black text-xs shadow-xl shadow-emerald-500/30 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-2 hover:scale-[1.02]"
              >
                {submitting ? (
                  <span>Saving Completion...</span>
                ) : (
                  <>
                    <span>{allVerified ? 'Complete & Stage for Pickup' : 'Check All Items First'}</span>
                    <span>✓</span>
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
