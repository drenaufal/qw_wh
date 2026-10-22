'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { StaffLayout } from '@/components/StaffLayout';
import { Order } from '@/lib/types';
import { useSSE } from '@/hooks/use-sse';
import { formatWIB, formatDuration } from '@/lib/utils/datetime';
import { StatusBadge, PriorityBadge } from '@/components/ui';

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

  const { subscribe } = useSSE();

  const fetchOrders = useCallback(async () => {
    try {
      let url = '/api/orders?limit=150';
      if (statusFilter !== 'ALL') url += `&status=${statusFilter}`;
      if (priorityFilter !== 'ALL') url += `&priority=${priorityFilter}`;
      if (search.trim()) url += `&search=${encodeURIComponent(search.trim())}`;

      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setOrders(data.orders || []);
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
      title="Order Lifecycle & Manifest Database"
      subtitle="Complete state mutation log, manual order injection, SLA performance analysis, and photo audit"
      actions={
        <button
          onClick={() => {
            const randomSuffix = Math.floor(1000 + Math.random() * 9000);
            setCreateOrderNumber(`ORD-${randomSuffix}`);
            setIsCreateOpen(true);
          }}
          className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-400 hover:to-indigo-500 text-white font-black text-xs shadow-lg shadow-indigo-500/30 transition-all flex items-center gap-2 hover:scale-105"
        >
          <span>+ Create Order</span>
        </button>
      }
    >
      <div className="space-y-6">
        {/* Search & Filters */}
        <div className="glass-panel p-5 rounded-3xl flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="relative w-full md:w-96">
            <span className="absolute left-4 top-3 text-sm text-[var(--text-muted)]">🔍</span>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search Order Number, Customer, or Fleet..."
              className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-subtle)] text-white text-xs focus:outline-none focus:border-indigo-500 font-medium"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            {/* Status Filter */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-[var(--text-muted)]">Status:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3.5 py-2.5 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-subtle)] text-white text-xs focus:outline-none focus:border-indigo-500 font-medium"
              >
                <option value="ALL">All Statuses</option>
                <option value="WAITING">WAITING</option>
                <option value="PACKING">PACKING</option>
                <option value="READY_FOR_PICKUP">READY_FOR_PICKUP</option>
                <option value="SHIP">SHIP</option>
              </select>
            </div>

            {/* Priority Filter */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-[var(--text-muted)]">Priority:</span>
              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
                className="px-3.5 py-2.5 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-subtle)] text-white text-xs focus:outline-none focus:border-indigo-500 font-medium"
              >
                <option value="ALL">All Priorities</option>
                <option value="DRIVER_WAITING">DRIVER_WAITING</option>
                <option value="NORMAL">NORMAL</option>
              </select>
            </div>
          </div>
        </div>

        {/* Orders Table */}
        <div className="glass-panel border-[var(--border-subtle)] rounded-3xl shadow-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-white/[0.02] text-[var(--text-muted)] uppercase tracking-wider font-semibold border-b border-[var(--border-subtle)]">
                <tr>
                  <th className="px-6 py-4">Order Number</th>
                  <th className="px-6 py-4">Customer</th>
                  <th className="px-6 py-4">Courier Fleet</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Priority</th>
                  <th className="px-6 py-4">SLA Durations</th>
                  <th className="px-6 py-4">Created At (WIB)</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)] text-[var(--text-secondary)]">
                {orders.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center text-[var(--text-muted)]">
                      No matching orders found.
                    </td>
                  </tr>
                ) : (
                  orders.map((ord) => (
                    <tr
                      key={ord.id}
                      className="hover:bg-white/[0.03] transition-colors"
                    >
                      <td className="px-6 py-4 font-mono font-bold text-white">
                        {ord.order_number}
                      </td>
                      <td className="px-6 py-4 font-semibold text-white">
                        {ord.customer_name || 'N/A'}
                      </td>
                      <td className="px-6 py-4 text-cyan-400 font-bold">
                        {ord.courier_name || 'General Fleet'}
                      </td>
                      <td className="px-6 py-4">
                        <StatusBadge status={ord.status} />
                      </td>
                      <td className="px-6 py-4">
                        <PriorityBadge priority={ord.priority_status} />
                      </td>
                      <td className="px-6 py-4 font-mono text-[11px] space-y-0.5">
                        {ord.packing_duration_seconds !== null && (
                          <div className="text-cyan-400 font-bold">
                            Pack: {formatDuration(ord.packing_duration_seconds)}
                          </div>
                        )}
                        {ord.driver_wait_duration_seconds !== null && (
                          <div className="text-amber-400 font-bold">
                            Wait: {formatDuration(ord.driver_wait_duration_seconds)}
                          </div>
                        )}
                        {ord.packing_duration_seconds === null &&
                          ord.driver_wait_duration_seconds === null && (
                            <span className="text-[var(--text-muted)]">-</span>
                          )}
                      </td>
                      <td className="px-6 py-4 font-mono text-[11px] text-[var(--text-muted)]">
                        {formatWIB(ord.created_at)}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => openDetail(ord.id)}
                          className="px-3.5 py-1.5 rounded-xl glass-btn text-xs font-bold text-slate-300 hover:text-white"
                        >
                          View Trace →
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
                className="text-[var(--text-muted)] hover:text-white font-bold"
              >
                ✕
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
                        ✕
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
                  <PriorityBadge priority={selectedOrderDetail.priority_status} />
                </div>
                <p className="text-xs text-[var(--text-secondary)] mt-1">
                  Recipient: <span className="text-white font-medium">{selectedOrderDetail.customer_name || 'N/A'}</span> • Fleet: {selectedOrderDetail.courier_name}
                </p>
              </div>
              <button
                onClick={() => setSelectedOrderDetail(null)}
                className="text-[var(--text-muted)] hover:text-white text-base"
              >
                ✕
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
                        <span className="font-bold text-white">{it.product_name}</span>
                        {it.sku && (
                          <span className="font-mono text-[var(--text-muted)] ml-2 text-[11px]">
                            ({it.sku})
                          </span>
                        )}
                      </div>
                      <span className="font-mono font-bold text-cyan-400 px-2.5 py-0.5 rounded-lg bg-[var(--bg-primary)]">
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
