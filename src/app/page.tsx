'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Order } from '@/lib/types';
import { useCamera } from '@/hooks/use-camera';
import { useSSE } from '@/hooks/use-sse';
import { formatWIB, formatDuration, getElapsedSeconds } from '@/lib/utils/datetime';
import { StatusBadge, PriorityBadge, SSEStatusBeacon } from '@/components/ui';

type WizardStage = 'SELECT_ORDER' | 'DRIVER_INFO' | 'CAMERA' | 'REVIEW' | 'SUCCESS';

const COURIER_OPTIONS = [
  'J&T Express',
  'SiCepat',
  'Shopee Xpress',
  'GoSend',
  'GrabExpress',
  'Anteraja',
  'Ninja Van',
  'JNE Express',
  'Internal Fleet',
  'Other',
];

export default function CourierKioskPage() {
  const [stage, setStage] = useState<WizardStage>('SELECT_ORDER');
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  // Driver details cached in localStorage
  const [driverName, setDriverName] = useState('');
  const [courierCompany, setCourierCompany] = useState('J&T Express');
  const [driverPhone, setDriverPhone] = useState('');

  // Early Check-In Modal
  const [earlyCheckInOrder, setEarlyCheckInOrder] = useState<Order | null>(null);
  const [submittingAction, setSubmittingAction] = useState(false);

  // Camera and Review
  const {
    videoRef,
    isReady: isCameraReady,
    cameraError,
    facingMode,
    startCamera,
    stopCamera,
    flipCamera,
    capturePhoto,
  } = useCamera();

  const [capturedPhotoUrl, setCapturedPhotoUrl] = useState<string | null>(null);
  const [successReceipt, setSuccessReceipt] = useState<{
    transaction_id: string;
    order_number: string;
    driver_name: string;
    courier_company: string;
    shipped_at: string;
    wait_duration_seconds?: number;
  } | null>(null);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const { isConnected, subscribe } = useSSE();

  useEffect(() => {
    try {
      const savedName = localStorage.getItem('wh_driver_name');
      const savedCompany = localStorage.getItem('wh_courier_company');
      const savedPhone = localStorage.getItem('wh_driver_phone');
      if (savedName) setDriverName(savedName);
      if (savedCompany) setCourierCompany(savedCompany);
      if (savedPhone) setDriverPhone(savedPhone);
    } catch {
      // ignore
    }
  }, []);

  const fetchOrders = useCallback(async () => {
    try {
      const res = await fetch('/api/orders?limit=100');
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
    const unsubUpdate = subscribe('orderUpdate', (updated: Order) => {
      setOrders((prev) => {
        const exists = prev.some((o) => o.id === updated.id);
        if (exists) {
          return prev.map((o) => (o.id === updated.id ? { ...o, ...updated } : o));
        }
        return [updated, ...prev];
      });
    });

    const unsubShipped = subscribe('pickupShipped', (data: any) => {
      if (data?.order) {
        setOrders((prev) =>
          prev.map((o) => (o.id === data.order.id ? { ...o, ...data.order } : o))
        );
      }
    });

    return () => {
      unsubUpdate();
      unsubShipped();
    };
  }, [subscribe]);

  useEffect(() => {
    if (stage === 'CAMERA') {
      startCamera();
    } else {
      stopCamera();
    }
  }, [stage, startCamera, stopCamera]);

  const persistDriverInfo = (name: string, company: string, phone: string) => {
    try {
      localStorage.setItem('wh_driver_name', name);
      localStorage.setItem('wh_courier_company', company);
      localStorage.setItem('wh_driver_phone', phone);
    } catch {
      // ignore
    }
  };

  const handleDriverArrival = async (order: Order) => {
    setSubmittingAction(true);
    setErrorMessage(null);
    try {
      const res = await fetch(`/api/orders/${order.id}/driver-arrival`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          driver_name: driverName.trim() || 'Courier Driver',
          courier_company: courierCompany || order.courier_name || 'General',
          driver_phone: driverPhone.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to register arrival');

      persistDriverInfo(driverName, courierCompany, driverPhone);
      await fetchOrders();
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setSubmittingAction(false);
    }
  };

  const submitEarlyCheckIn = async () => {
    if (!earlyCheckInOrder) return;
    if (!driverName.trim()) {
      setErrorMessage('Please enter your full name before checking in.');
      return;
    }

    setSubmittingAction(true);
    setErrorMessage(null);
    try {
      const res = await fetch(`/api/orders/${earlyCheckInOrder.id}/driver-arrival`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          driver_name: driverName.trim(),
          courier_company: courierCompany,
          driver_phone: driverPhone.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to submit check-in');

      persistDriverInfo(driverName, courierCompany, driverPhone);
      setEarlyCheckInOrder(null);
      await fetchOrders();
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setSubmittingAction(false);
    }
  };

  const startHandoverWizard = (order: Order) => {
    setSelectedOrder(order);
    setErrorMessage(null);
    if (order.courier_name && COURIER_OPTIONS.includes(order.courier_name)) {
      setCourierCompany(order.courier_name);
    }
    setStage('DRIVER_INFO');
  };

  const handleDriverInfoSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!driverName.trim()) {
      setErrorMessage('Driver name is required.');
      return;
    }
    persistDriverInfo(driverName, courierCompany, driverPhone);
    setErrorMessage(null);
    setStage('CAMERA');
  };

  const handleCapture = () => {
    if (!selectedOrder) return;
    const photoData = capturePhoto({
      orderNumber: selectedOrder.order_number,
      driverName: driverName.trim() || 'Courier',
      courierCompany: courierCompany || selectedOrder.courier_name || 'General',
    });

    if (photoData) {
      setCapturedPhotoUrl(photoData);
      setStage('REVIEW');
    } else {
      setErrorMessage('Failed to capture photo. Please check camera permissions.');
    }
  };

  const handleConfirmPickup = async () => {
    if (!selectedOrder || !capturedPhotoUrl) return;

    setSubmittingAction(true);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/pickup/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_id: selectedOrder.id,
          driver_name: driverName.trim(),
          courier_company: courierCompany,
          photo_base64: capturedPhotoUrl,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to submit handover');

      setSuccessReceipt(data.receipt);
      setStage('SUCCESS');
      await fetchOrders();
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setSubmittingAction(false);
    }
  };

  const resetWizard = () => {
    setSelectedOrder(null);
    setCapturedPhotoUrl(null);
    setSuccessReceipt(null);
    setErrorMessage(null);
    setStage('SELECT_ORDER');
    fetchOrders();
  };

  const filteredOrders = orders.filter((o) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      o.order_number.toLowerCase().includes(q) ||
      (o.customer_name && o.customer_name.toLowerCase().includes(q)) ||
      (o.courier_name && o.courier_name.toLowerCase().includes(q))
    );
  });

  const readyOrders = filteredOrders.filter((o) => o.status === 'READY_FOR_PICKUP');
  const queueOrders = filteredOrders.filter(
    (o) => o.status === 'WAITING' || o.status === 'PACKING'
  );

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-white flex flex-col justify-between relative selection:bg-amber-400 selection:text-slate-950">
      {/* Ambient background light glow */}
      <div className="pointer-events-none fixed top-[-15%] left-1/3 w-[600px] h-[500px] rounded-full bg-amber-500/10 blur-[150px] -z-10" />

      {/* Top Header */}
      <header className="bg-[var(--bg-secondary)] backdrop-blur-2xl border-b border-[var(--border-subtle)] px-6 py-4 sm:px-10 flex items-center justify-between sticky top-0 z-30 shadow-xl">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-500/20 to-orange-500/10 border border-amber-500/40 flex items-center justify-center text-xl shadow-[0_0_20px_rgba(245,158,11,0.25)]">
            🙋‍♂️
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-black tracking-tight text-white leading-tight">
              Loading Dock Terminal
            </h1>
            <p className="text-[11px] text-[var(--text-muted)] font-mono">
              Antigravity Self-Service Handover Kiosk
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3.5">
          <SSEStatusBeacon isConnected={isConnected} />
          <Link
            href="/status"
            target="_blank"
            className="hidden sm:inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl glass-btn text-xs font-bold text-emerald-400 border border-emerald-500/30"
          >
            <span>📺</span>
            <span>Overhead Board</span>
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl glass-btn text-xs font-bold text-slate-300"
          >
            <span>Staff Login</span>
          </Link>
        </div>
      </header>

      {/* Main Body */}
      <main className="flex-1 p-4 sm:p-8 flex justify-center items-start">
        <div className="w-full max-w-3xl">
          {errorMessage && (
            <div className="mb-6 p-4 rounded-2xl bg-rose-500/15 border border-rose-500/40 text-rose-300 text-xs font-medium flex items-center justify-between shadow-lg">
              <div className="flex items-center gap-2.5">
                <span className="text-base">⚠️</span>
                <span>{errorMessage}</span>
              </div>
              <button
                onClick={() => setErrorMessage(null)}
                className="text-rose-400 hover:text-white text-xs font-bold px-2 py-1"
              >
                ✕
              </button>
            </div>
          )}

          {/* STAGE 1: SELECT ORDER */}
          {stage === 'SELECT_ORDER' && (
            <div className="space-y-6">
              {/* Spatial Glass Search Bar */}
              <div className="glass-panel p-4 rounded-3xl shadow-2xl">
                <div className="relative">
                  <span className="absolute left-4 top-3.5 text-base text-[var(--text-muted)]">
                    🔍
                  </span>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search Order Number (e.g. ORD-1001), Customer, or Courier Fleet..."
                    className="w-full pl-11 pr-4 py-3 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-subtle)] text-white text-xs sm:text-sm font-medium focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400/50 transition-all placeholder:text-[var(--text-muted)]"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-4 top-3.5 text-xs font-mono font-bold text-[var(--text-muted)] hover:text-white"
                    >
                      CLEAR
                    </button>
                  )}
                </div>
              </div>

              {/* Section 1: READY FOR PICKUP */}
              <div>
                <div className="flex items-center justify-between mb-3.5 px-1">
                  <div className="flex items-center gap-2.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                    <h2 className="text-xs font-black text-emerald-400 uppercase tracking-widest">
                      Ready For Handover ({readyOrders.length})
                    </h2>
                  </div>
                  <span className="text-[11px] text-[var(--text-muted)]">
                    Packages staged on dock shelves
                  </span>
                </div>

                {readyOrders.length === 0 ? (
                  <div className="glass-panel rounded-3xl p-8 text-center text-[var(--text-muted)] text-xs">
                    No orders currently waiting in staging bay.
                  </div>
                ) : (
                  <div className="grid gap-3.5">
                    {readyOrders.map((order) => {
                      const isWaiting = order.priority_status === 'DRIVER_WAITING';
                      return (
                        <div
                          key={order.id}
                          className={`glass-panel rounded-3xl p-5 sm:p-6 transition-all duration-300 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
                            isWaiting
                              ? 'border-amber-500/70 bg-gradient-to-r from-amber-950/30 via-[var(--bg-card)] to-[var(--bg-card)] glow-amber-3d translate-y-[-2px]'
                              : 'hover:border-emerald-500/50 hover:translate-y-[-2px]'
                          }`}
                        >
                          <div className="space-y-2">
                            <div className="flex items-center gap-3">
                              <span className="text-xl font-black text-white font-mono tracking-tight">
                                {order.order_number}
                              </span>
                              <StatusBadge status={order.status} />
                              {isWaiting && (
                                <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-[10px] font-black bg-amber-500/20 text-amber-300 border border-amber-400/40">
                                  <span>🙋‍♂️</span>
                                  <span>Driver Menunggu</span>
                                </span>
                              )}
                            </div>

                            <p className="text-xs text-[var(--text-secondary)]">
                              Recipient: <span className="text-white font-semibold">{order.customer_name || 'N/A'}</span> • Fleet: <span className="text-amber-400 font-bold">{order.courier_name || 'General'}</span>
                            </p>

                            {order.driver_arrived_at && (
                              <p className="text-[11px] text-amber-300/90 font-mono">
                                ⏳ Arrived: {formatWIB(order.driver_arrived_at)} ({formatDuration(getElapsedSeconds(order.driver_arrived_at))} ago)
                              </p>
                            )}

                            {order.items && order.items.length > 0 && (
                              <p className="text-[11px] text-[var(--text-muted)] line-clamp-1">
                                Items: {order.items.map((i) => `${i.product_name} (${i.quantity}x)`).join(', ')}
                              </p>
                            )}
                          </div>

                          <div className="flex items-center gap-2.5 w-full sm:w-auto">
                            {!isWaiting && (
                              <button
                                onClick={() => handleDriverArrival(order)}
                                disabled={submittingAction}
                                className="flex-1 sm:flex-none px-4 py-3 rounded-2xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-black transition-all flex items-center justify-center gap-1.5 shadow-[0_0_15px_rgba(245,158,11,0.2)]"
                              >
                                <span>🙋‍♂️</span>
                                <span>Driver Sudah Datang</span>
                              </button>
                            )}

                            <button
                              onClick={() => startHandoverWizard(order)}
                              className="flex-1 sm:flex-none px-6 py-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white text-xs font-black shadow-lg shadow-emerald-500/30 transition-all flex items-center justify-center gap-2 hover:scale-105"
                            >
                              <span>Pick Up</span>
                              <span>→</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Section 2: IN PACKAGING QUEUE */}
              <div>
                <div className="flex items-center justify-between mb-3.5 px-1">
                  <div className="flex items-center gap-2.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-cyan-400" />
                    <h2 className="text-xs font-black text-cyan-400 uppercase tracking-widest">
                      In Packaging Queue ({queueOrders.length})
                    </h2>
                  </div>
                  <span className="text-[11px] text-[var(--text-muted)]">
                    Early check-in elevates order to Tier 1 Priority
                  </span>
                </div>

                {queueOrders.length === 0 ? (
                  <div className="glass-panel rounded-3xl p-8 text-center text-[var(--text-muted)] text-xs">
                    No active packing orders in queue.
                  </div>
                ) : (
                  <div className="grid gap-3.5">
                    {queueOrders.map((order) => {
                      const isWaiting = order.priority_status === 'DRIVER_WAITING';
                      return (
                        <div
                          key={order.id}
                          className={`glass-panel rounded-3xl p-5 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
                            isWaiting
                              ? 'border-amber-500/50 bg-amber-950/15'
                              : 'hover:border-white/20'
                          }`}
                        >
                          <div className="space-y-1.5">
                            <div className="flex items-center gap-2.5">
                              <span className="text-base font-bold text-white font-mono">
                                {order.order_number}
                              </span>
                              <StatusBadge status={order.status} />
                              <PriorityBadge priority={order.priority_status} />
                            </div>
                            <p className="text-xs text-[var(--text-secondary)]">
                              Recipient: <span className="text-white font-medium">{order.customer_name || 'N/A'}</span> • Fleet: <span className="text-cyan-400 font-bold">{order.courier_name || 'General'}</span>
                            </p>
                            {isWaiting && order.driver_arrived_at && (
                              <p className="text-[11px] text-amber-300 font-mono">
                                ⏳ Waiting in queue for {formatDuration(getElapsedSeconds(order.driver_arrived_at))}
                              </p>
                            )}
                          </div>

                          <div>
                            {isWaiting ? (
                              <span className="text-xs font-bold text-amber-300 bg-amber-500/15 border border-amber-500/40 px-3.5 py-2 rounded-2xl inline-block shadow-[0_0_15px_rgba(245,158,11,0.2)]">
                                ⚡ Elevated to Tier 1 Priority
                              </span>
                            ) : (
                              <button
                                onClick={() => setEarlyCheckInOrder(order)}
                                className="w-full sm:w-auto px-4 py-2.5 rounded-2xl glass-btn text-amber-400 border-amber-500/40 text-xs font-bold flex items-center justify-center gap-2 hover:bg-amber-500/10"
                              >
                                <span>🙋‍♂️</span>
                                <span>I&apos;m Here (Early Check-In)</span>
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STAGE 2: DRIVER INFO FORM */}
          {stage === 'DRIVER_INFO' && selectedOrder && (
            <div className="glass-panel-elevated rounded-3xl p-6 sm:p-8 shadow-2xl max-w-xl mx-auto">
              <div className="mb-6 pb-4 border-b border-[var(--border-subtle)]">
                <button
                  type="button"
                  onClick={() => setStage('SELECT_ORDER')}
                  className="text-xs text-[var(--text-muted)] hover:text-white mb-2 flex items-center gap-1 font-semibold"
                >
                  ← Back to Order Selection
                </button>
                <h2 className="text-xl font-extrabold text-white tracking-tight">
                  Handover Verification (Stage 2 of 4)
                </h2>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                  Confirm your courier identification details
                </p>
              </div>

              {/* Target Order Summary Card */}
              <div className="glass-panel p-4 rounded-2xl border border-[var(--border-subtle)] mb-6 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[var(--text-muted)] font-mono">Order Number</span>
                  <span className="text-base font-bold font-mono text-emerald-400 drop-shadow">
                    {selectedOrder.order_number}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[var(--text-muted)]">Customer Name</span>
                  <span className="text-xs text-white font-semibold">
                    {selectedOrder.customer_name || 'N/A'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[var(--text-muted)]">Courier Fleet</span>
                  <span className="text-xs text-amber-400 font-bold">
                    {selectedOrder.courier_name || 'General'}
                  </span>
                </div>
              </div>

              <form onSubmit={handleDriverInfoSubmit} className="space-y-4">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-1.5">
                    Driver Full Name <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={driverName}
                    onChange={(e) => setDriverName(e.target.value)}
                    placeholder="Enter your full name"
                    required
                    className="w-full px-4 py-3 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-subtle)] text-white text-xs focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 transition-all font-medium"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-1.5">
                    Courier Partner Fleet <span className="text-rose-400">*</span>
                  </label>
                  <select
                    value={courierCompany}
                    onChange={(e) => setCourierCompany(e.target.value)}
                    className="w-full px-4 py-3 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-subtle)] text-white text-xs focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 transition-all font-medium"
                  >
                    {COURIER_OPTIONS.map((c) => (
                      <option key={c} value={c} className="bg-slate-900">
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-1.5">
                    Phone / WhatsApp Number (Optional)
                  </label>
                  <input
                    type="text"
                    value={driverPhone}
                    onChange={(e) => setDriverPhone(e.target.value)}
                    placeholder="e.g. 08123456789"
                    className="w-full px-4 py-3 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-subtle)] text-white text-xs focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 transition-all font-medium"
                  />
                </div>

                <div className="pt-4 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setStage('SELECT_ORDER')}
                    className="flex-1 py-3 px-4 rounded-2xl glass-btn text-xs font-bold text-[var(--text-secondary)]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-2 py-3 px-5 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs shadow-lg shadow-amber-500/25 transition-all flex items-center justify-center gap-2"
                  >
                    <span>Proceed to Camera Handover</span>
                    <span>📷</span>
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* STAGE 3: LIVE CAMERA WEBRTC STREAM */}
          {stage === 'CAMERA' && selectedOrder && (
            <div className="glass-panel-elevated rounded-3xl p-6 shadow-2xl max-w-xl mx-auto">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-bold text-white tracking-tight">
                    Proof-of-Handover Photo (Stage 3 of 4)
                  </h2>
                  <p className="text-xs text-[var(--text-secondary)]">
                    Hold the parcel steady in the dock viewfinder
                  </p>
                </div>
                <button
                  type="button"
                  onClick={flipCamera}
                  className="px-3.5 py-1.5 rounded-xl glass-btn text-xs text-white flex items-center gap-1.5 font-bold"
                >
                  <span>🔄</span>
                  <span>Flip ({facingMode === 'environment' ? 'Rear' : 'Front'})</span>
                </button>
              </div>

              {cameraError && (
                <div className="mb-4 p-3 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs">
                  {cameraError}
                </div>
              )}

              {/* Viewfinder Frame with High-Tech Antigravity Corner Reticles */}
              <div className="relative aspect-[4/3] bg-black rounded-3xl overflow-hidden border-2 border-emerald-500/50 shadow-2xl flex items-center justify-center">
                <video
                  ref={videoRef}
                  playsInline
                  autoPlay
                  muted
                  className="w-full h-full object-cover"
                />

                {/* Reticle Brackets */}
                <div className="absolute inset-8 border border-white/20 rounded-2xl pointer-events-none flex flex-col justify-between p-3.5">
                  <div className="flex justify-between text-[10px] text-emerald-400 font-mono font-bold">
                    <span>[ALIGN PACKAGE]</span>
                    <span>ORD: {selectedOrder.order_number}</span>
                  </div>
                  <div className="text-center text-xs text-emerald-300 font-bold bg-black/70 px-3 py-1.5 rounded-xl backdrop-blur max-w-xs mx-auto border border-emerald-500/30">
                    Snap live photo of package shipping label
                  </div>
                </div>

                {!isCameraReady && (
                  <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center">
                    <div className="text-center space-y-2">
                      <div className="w-9 h-9 border-2 border-amber-400 border-t-transparent rounded-full animate-spin mx-auto" />
                      <p className="text-xs text-[var(--text-muted)] font-mono">Initializing Camera Sensor...</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Shutter Button Bar */}
              <div className="mt-6 flex items-center justify-between gap-4">
                <button
                  type="button"
                  onClick={() => setStage('DRIVER_INFO')}
                  className="py-3 px-4 rounded-2xl glass-btn text-xs font-bold text-[var(--text-secondary)]"
                >
                  ← Back
                </button>

                <button
                  type="button"
                  onClick={handleCapture}
                  disabled={!isCameraReady}
                  className="flex-1 py-3.5 px-6 rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white font-black text-sm shadow-xl shadow-emerald-500/30 disabled:opacity-50 transition-all flex items-center justify-center gap-2 hover:scale-[1.02]"
                >
                  <span>📸</span>
                  <span>Capture Handover Photo</span>
                </button>
              </div>
            </div>
          )}

          {/* STAGE 4: REVIEW WATERMARKED PHOTO */}
          {stage === 'REVIEW' && selectedOrder && capturedPhotoUrl && (
            <div className="glass-panel-elevated rounded-3xl p-6 sm:p-8 shadow-2xl max-w-xl mx-auto">
              <div className="mb-4">
                <h2 className="text-lg font-bold text-white tracking-tight">
                  Verify Handover Photo (Stage 4 of 4)
                </h2>
                <p className="text-xs text-[var(--text-secondary)]">
                  Inspect the immutable dock watermark banner before final confirmation
                </p>
              </div>

              <div className="rounded-2xl overflow-hidden border border-emerald-500/50 shadow-2xl">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={capturedPhotoUrl}
                  alt="Captured Handover Proof"
                  className="w-full object-contain"
                />
              </div>

              <div className="mt-6 flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setCapturedPhotoUrl(null);
                    setStage('CAMERA');
                  }}
                  disabled={submittingAction}
                  className="flex-1 py-3 px-4 rounded-2xl glass-btn text-xs font-black text-amber-400 flex items-center justify-center gap-1.5"
                >
                  <span>🔄</span>
                  <span>Retake Photo</span>
                </button>

                <button
                  type="button"
                  onClick={handleConfirmPickup}
                  disabled={submittingAction}
                  className="flex-2 py-3 px-6 rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white font-black text-xs shadow-xl shadow-emerald-500/30 disabled:opacity-50 transition-all flex items-center justify-center gap-2 hover:scale-[1.02]"
                >
                  {submittingAction ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Saving Dispatch...</span>
                    </>
                  ) : (
                    <>
                      <span>Confirm & Complete Pickup</span>
                      <span>✓</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* STAGE 5: SUCCESS & DIGITAL RECEIPT */}
          {stage === 'SUCCESS' && successReceipt && (
            <div className="glass-panel-elevated rounded-3xl p-6 sm:p-8 shadow-2xl max-w-lg mx-auto text-center border-emerald-500/50">
              <div className="w-16 h-16 rounded-3xl bg-emerald-500/20 text-emerald-400 border border-emerald-400/50 flex items-center justify-center text-3xl mx-auto mb-4 shadow-[0_0_30px_rgba(16,185,129,0.35)]">
                ✓
              </div>

              <h2 className="text-2xl font-black text-white tracking-tight">
                Pickup Handover Confirmed!
              </h2>
              <p className="text-xs text-[var(--text-secondary)] mt-1">
                Shipment dispatched and marked terminal in warehouse database.
              </p>

              {/* Digital Receipt Card */}
              <div className="mt-6 glass-panel border-white/10 rounded-2xl p-5 text-left space-y-2.5 font-mono text-xs">
                <div className="flex justify-between border-b border-white/[0.08] pb-2">
                  <span className="text-[var(--text-muted)]">Receipt Ref</span>
                  <span className="font-bold text-amber-400">{successReceipt.transaction_id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--text-muted)]">Order Number</span>
                  <span className="font-bold text-white">{successReceipt.order_number}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--text-muted)]">Courier Partner</span>
                  <span className="text-emerald-400 font-bold">{successReceipt.courier_company}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--text-muted)]">Driver Name</span>
                  <span className="text-white font-semibold">{successReceipt.driver_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--text-muted)]">Handover Time</span>
                  <span className="text-[var(--text-secondary)]">{formatWIB(successReceipt.shipped_at)}</span>
                </div>
                {successReceipt.wait_duration_seconds !== undefined && (
                  <div className="flex justify-between border-t border-white/[0.08] pt-2 text-cyan-400">
                    <span>Total Wait Duration</span>
                    <span className="font-bold">{formatDuration(successReceipt.wait_duration_seconds)}</span>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={resetWizard}
                className="w-full mt-6 py-3.5 px-6 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs shadow-xl shadow-amber-500/25 transition-all flex items-center justify-center gap-2 hover:scale-[1.02]"
              >
                <span>📦</span>
                <span>Process Next Package Pickup</span>
              </button>
            </div>
          )}
        </div>
      </main>

      {/* Early Check-In Modal for Queued Orders */}
      {earlyCheckInOrder && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass-panel-elevated border-amber-500/50 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border-subtle)]">
              <div className="flex items-center gap-2.5">
                <span className="text-xl">🙋‍♂️</span>
                <h3 className="text-base font-bold text-white">Driver Early Check-In</h3>
              </div>
              <button
                onClick={() => setEarlyCheckInOrder(null)}
                className="text-[var(--text-muted)] hover:text-white"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
              Registering your dock arrival for order{' '}
              <span className="text-amber-400 font-bold font-mono">
                {earlyCheckInOrder.order_number}
              </span>{' '}
              will immediately escalate it to <span className="text-amber-300 font-bold">Tier 1 Priority</span> on the packer workstation and initiate the SLA wait timer.
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-[var(--text-secondary)] mb-1 uppercase tracking-wider">
                  Driver Name <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  value={driverName}
                  onChange={(e) => setDriverName(e.target.value)}
                  placeholder="Your full name"
                  required
                  className="w-full px-3.5 py-2.5 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-subtle)] text-white text-xs focus:outline-none focus:border-amber-400 font-medium"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[var(--text-secondary)] mb-1 uppercase tracking-wider">
                  Courier Fleet
                </label>
                <select
                  value={courierCompany}
                  onChange={(e) => setCourierCompany(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-subtle)] text-white text-xs focus:outline-none focus:border-amber-400 font-medium"
                >
                  {COURIER_OPTIONS.map((c) => (
                    <option key={c} value={c} className="bg-slate-900">
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="pt-2 flex gap-3">
              <button
                type="button"
                onClick={() => setEarlyCheckInOrder(null)}
                className="flex-1 py-2.5 px-4 rounded-2xl glass-btn text-xs font-bold text-[var(--text-secondary)]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitEarlyCheckIn}
                disabled={submittingAction || !driverName.trim()}
                className="flex-2 py-2.5 px-4 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs disabled:opacity-50 shadow-lg shadow-amber-500/25"
              >
                {submittingAction ? 'Elevating Order...' : 'Confirm Arrival (Tier 1 Priority)'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="bg-[var(--bg-secondary)] backdrop-blur-2xl border-t border-[var(--border-subtle)] p-3 text-center text-[11px] text-[var(--text-muted)] font-mono">
        Antigravity Concurrency Engine • Protected with PostgreSQL Row Locks • WIB Asia/Jakarta
      </footer>
    </div>
  );
}
