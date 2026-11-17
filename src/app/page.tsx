'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { Order } from '@/lib/types';
import { useCamera } from '@/hooks/use-camera';
import { useSSE } from '@/hooks/use-sse';
import { formatWIB, formatDuration, getElapsedSeconds } from '@/lib/utils/datetime';
import { StatusBadge, PriorityBadge, SSEStatusBeacon } from '@/components/ui';
import { AutoSyncControls } from '@/components/AutoSyncControls';
import {
  Truck,
  RefreshCw,
  Tv,
  LogIn,
  AlertTriangle,
  CheckCircle2,
  X,
  Search,
  UserCheck,
  Camera,
  UploadCloud,
  RotateCcw,
  Check,
  Package,
  ArrowRight,
  ArrowLeft,
  RotateCw,
  Clock,
  PackageCheck,
} from 'lucide-react';

type WizardStage = 'SELECT_ORDER' | 'DRIVER_INFO' | 'CAMERA' | 'REVIEW' | 'SUCCESS';
type CategoryTab = 'ALL' | 'ARRIVED' | 'READY' | 'PACKING';

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
  const [categoryTab, setCategoryTab] = useState<CategoryTab>('ALL');
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

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
    processImageFile,
  } = useCamera();

  const [liveTimestamp, setLiveTimestamp] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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
  const [syncingExternal, setSyncingExternal] = useState(false);
  const [syncNotification, setSyncNotification] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const [mounted, setMounted] = useState(false);
  const { isConnected, subscribe } = useSSE();

  useEffect(() => {
    setMounted(true);
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

  useEffect(() => {
    if (stage === 'SELECT_ORDER') {
      searchInputRef.current?.focus();
    }
  }, [stage]);

  const fetchOrders = useCallback(async () => {
    try {
      const res = await fetch('/api/orders?limit=200');
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

  // Real-time synchronization
  useEffect(() => {
    const handleUpdate = () => {
      fetchOrders();
    };

    const unsub1 = subscribe('orderUpdate', handleUpdate);
    const unsub2 = subscribe('driverArrival', handleUpdate);
    const unsub3 = subscribe('packingComplete', handleUpdate);
    const unsub4 = subscribe('pickupShipped', handleUpdate);

    return () => {
      unsub1();
      unsub2();
      unsub3();
      unsub4();
    };
  }, [subscribe, fetchOrders]);

  // Real-time clock for camera watermark HUD
  useEffect(() => {
    if (stage === 'CAMERA') {
      const updateStamp = () => setLiveTimestamp(formatWIB(new Date()));
      updateStamp();
      const interval = setInterval(updateStamp, 1000);
      return () => clearInterval(interval);
    }
  }, [stage]);

  // Manage camera lifecycle
  useEffect(() => {
    if (stage === 'CAMERA') {
      startCamera();
    } else {
      stopCamera();
    }
  }, [stage, startCamera, stopCamera]);

  const persistDriverInfo = (name: string, comp: string, phone: string) => {
    try {
      localStorage.setItem('wh_driver_name', name);
      localStorage.setItem('wh_courier_company', comp);
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
          driver_name: driverName.trim() || 'Driver Standby',
          courier_company: courierCompany || order.courier_name || 'General',
          driver_phone: driverPhone.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal mencatat kedatangan driver');

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
      setErrorMessage('Harap masukkan nama lengkap sebelum check-in.');
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
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan check-in');

      persistDriverInfo(driverName, courierCompany, driverPhone);
      setEarlyCheckInOrder(null);
      await fetchOrders();
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setSubmittingAction(false);
    }
  };

  const handleSyncExternal = async () => {
    setSyncingExternal(true);
    setSyncNotification(null);
    try {
      const res = await fetch('/api/orders/sync-external?type=all');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menarik data order dari external API');

      let detailText = data.message || `Berhasil sinkronisasi total ${data.count} order (${data.insertedCount} baru, ${data.updatedCount} diupdate)!`;
      if (data.shipment && data.picking) {
        detailText = `Berhasil sync ${data.count} order (${data.shipment.count} Siap Diambil, ${data.picking.count} Sedang Packing)!`;
        if (data.picking?.error) {
          detailText += ` [Picking: ${data.picking.error}]`;
        }
        if (data.shipment?.error) {
          detailText += ` [Shipment: ${data.shipment.error}]`;
        }
      }

      setSyncNotification({
        type: 'success',
        text: detailText,
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
      setErrorMessage('Nama driver wajib diisi.');
      return;
    }
    persistDriverInfo(driverName, courierCompany, driverPhone);
    setErrorMessage(null);
    setStage('CAMERA');
  };

  const handleCapture = () => {
    if (!selectedOrder) return;
    const nowStamp = formatWIB(new Date());
    const photoData = capturePhoto({
      orderNumber: selectedOrder.order_number,
      driverName: driverName.trim() || 'Kurir',
      courierCompany: courierCompany || selectedOrder.courier_name || 'General',
      timestamp: nowStamp,
    });

    if (photoData) {
      setCapturedPhotoUrl(photoData);
      setStage('REVIEW');
    } else {
      setErrorMessage('Gagal mengambil foto. Pastikan kamera diizinkan atau gunakan opsi upload.');
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedOrder) return;

    try {
      const nowStamp = formatWIB(new Date());
      const watermarked = await processImageFile(file, {
        orderNumber: selectedOrder.order_number,
        driverName: driverName.trim() || 'Kurir',
        courierCompany: courierCompany || selectedOrder.courier_name || 'General',
        timestamp: nowStamp,
      });

      setCapturedPhotoUrl(watermarked);
      setStage('REVIEW');
    } catch (err: any) {
      setErrorMessage(err.message || 'Gagal memproses file foto');
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
          driver_name: driverName.trim() || 'Driver',
          courier_company: courierCompany,
          driver_phone: driverPhone.trim() || undefined,
          photo_base64: capturedPhotoUrl,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Gagal memproses serah terima');
      }

      const receipt = data.receipt || data.data;
      if (!receipt) {
        throw new Error('Data receipt tidak ditemukan dalam respon server');
      }

      setSuccessReceipt({
        transaction_id: receipt.transaction_id,
        order_number: receipt.order_number,
        driver_name: receipt.driver_name,
        courier_company: receipt.courier_company,
        shipped_at: receipt.shipped_at,
        wait_duration_seconds: receipt.wait_duration_seconds,
      });

      setStage('SUCCESS');
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
    setSearchQuery('');
    setCategoryTab('ALL');
    fetchOrders();
  };

  const isSearching = searchQuery.trim().length > 0;

  const filteredOrders = isSearching
    ? orders.filter((o) => {
        const q = searchQuery.toLowerCase().trim();
        return (
          o.order_number.toLowerCase().includes(q) ||
          (o.no_wsa && o.no_wsa.toLowerCase().includes(q)) ||
          (o.pickup_code && o.pickup_code.toLowerCase().includes(q)) ||
          (o.picking_no && o.picking_no.toLowerCase().includes(q)) ||
          (o.customer_name && o.customer_name.toLowerCase().includes(q)) ||
          (o.courier_name && o.courier_name.toLowerCase().includes(q))
        );
      })
    : [];

  // Category 1: Orders where courier has arrived (Priority Waiting Queue, not yet shipped)
  const arrivedOrders = filteredOrders
    .filter((o) => o.priority_status === 'DRIVER_WAITING' && o.status !== 'SHIP')
    .sort((a, b) => {
      if (a.queue_number && b.queue_number) {
        return a.queue_number - b.queue_number;
      }
      const tA = a.driver_arrived_at ? new Date(a.driver_arrived_at).getTime() : 0;
      const tB = b.driver_arrived_at ? new Date(b.driver_arrived_at).getTime() : 0;
      return tA - tB;
    });

  // Category 2: Orders ready on staging shelf where courier has not yet checked in
  const readyOrders = filteredOrders.filter(
    (o) => o.status === 'READY_FOR_PICKUP' && o.priority_status !== 'DRIVER_WAITING'
  );

  // Category 3: Orders still being packed where courier has not yet checked in
  const packingOrders = filteredOrders.filter(
    (o) => o.status === 'PACKING' && o.priority_status !== 'DRIVER_WAITING'
  );

  // Category 4: Orders that have already been shipped / handed over
  const shippedOrders = filteredOrders.filter((o) => o.status === 'SHIP');

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] flex flex-col justify-between">
      {/* Top Header */}
      <header className="bg-[var(--bg-surface)] border-b border-[var(--border-subtle)] px-4 sm:px-8 py-3.5 flex items-center justify-between sticky top-0 z-30 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[var(--accent-primary)] text-white flex items-center justify-center shadow-sm">
            <Truck className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-sm sm:text-base font-bold text-[var(--text-primary)] leading-tight">
              Kiosk Mandiri Pickup Kurir
            </h1>
            <p className="text-xs text-[var(--text-muted)] font-normal">
              Terminal Serah Terima Paket & Konfirmasi Kedatangan
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <SSEStatusBeacon isConnected={isConnected} />

          {/* Auto-Sync Toggle & Interval Controls */}
          <AutoSyncControls onSync={handleSyncExternal} isSyncing={syncingExternal} className="hidden sm:inline-flex" />

          {/* Sync / GET External API Button */}
          <button
            onClick={handleSyncExternal}
            disabled={syncingExternal}
            title="Tarik data order terbaru dari external API (Shipment & Picking)"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-xs font-bold transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncingExternal ? 'animate-spin' : ''}`} />
            <span>{syncingExternal ? 'Menarik...' : 'Tarik API'}</span>
          </button>

          <Link
            href="/status"
            target="_blank"
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-card-hover)]"
          >
            <Tv className="w-3.5 h-3.5" />
            <span>Monitor TV</span>
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-card-hover)]"
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>Login Staf</span>
          </Link>
        </div>
      </header>

      {/* Main Body */}
      <main className="flex-1 p-4 sm:p-6 flex justify-center items-start">
        <div className="w-full max-w-3xl">
          {errorMessage && (
            <div className="mb-4 p-3.5 rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-300 text-xs font-medium flex items-center justify-between shadow-sm">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{errorMessage}</span>
              </div>
              <button
                onClick={() => setErrorMessage(null)}
                className="text-rose-600 hover:text-rose-800 text-xs font-bold px-2 py-1"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* STAGE 1: SELECT ORDER */}
          {stage === 'SELECT_ORDER' && (
            <div className="space-y-6">
              {/* Sync Notification Banner */}
              {syncNotification && (
                <div
                  className={`p-3.5 rounded-xl border text-xs font-bold flex items-center justify-between transition-all ${
                    syncNotification.type === 'success'
                      ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-700 dark:text-emerald-300 shadow-[0_0_20px_rgba(16,185,129,0.15)]'
                      : 'bg-rose-500/15 border-rose-500/40 text-rose-700 dark:text-rose-300 shadow-[0_0_20px_rgba(244,63,94,0.15)]'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {syncNotification.type === 'success' ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                    )}
                    <span>{syncNotification.text}</span>
                  </div>
                  <button
                    onClick={() => setSyncNotification(null)}
                    className="text-current opacity-70 hover:opacity-100 font-bold px-1"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Clean Search Input & Prominent Sync Button */}
              <div className="p-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] shadow-sm">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                  <div className="relative flex-1">
                    <Search className="absolute left-3.5 top-3 w-4 h-4 text-[var(--text-muted)]" />
                    <input
                      ref={searchInputRef}
                      type="text"
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                        setCategoryTab('ALL');
                      }}
                      placeholder="Cari No. Order, WSA, PIN Pickup, Penerima, atau Ekspedisi..."
                      className="w-full pl-10 pr-16 py-2.5 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-xs sm:text-sm font-medium focus:outline-none focus:border-[var(--accent-primary)] placeholder:text-[var(--text-muted)]"
                    />
                    {searchQuery && (
                      <button
                        onClick={() => {
                          setSearchQuery('');
                          searchInputRef.current?.focus();
                        }}
                        className="absolute right-3 top-3 text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                      >
                        RESET
                      </button>
                    )}
                  </div>

                  <button
                    onClick={handleSyncExternal}
                    disabled={syncingExternal}
                    className="px-4 py-2.5 rounded-lg border border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-xs font-bold transition-colors flex items-center justify-center gap-2 shrink-0 disabled:opacity-50 shadow-xs"
                    title="Tarik data order dari external API"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${syncingExternal ? 'animate-spin' : ''}`} />
                    <span>{syncingExternal ? 'Menarik...' : 'Tarik Order dari API'}</span>
                  </button>
                </div>
              </div>

              {!isSearching ? (
                /* HERO / INITIAL SEARCH GUIDE (Ketika belum dicari) */
                <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 sm:p-10 text-center space-y-6 shadow-sm">
                  <div className="mx-auto w-16 h-16 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shadow-inner">
                    <Search className="w-8 h-8" />
                  </div>

                  <div className="max-w-md mx-auto space-y-2">
                    <h2 className="text-base sm:text-lg font-bold text-[var(--text-primary)]">
                      Cari Order untuk Memulai Serah Terima
                    </h2>
                    <p className="text-xs sm:text-sm text-[var(--text-muted)] leading-relaxed">
                      Silakan ketik atau scan barcode <strong className="text-[var(--text-secondary)]">Nomor Order</strong>, <strong className="text-[var(--text-secondary)]">No. WSA</strong>, <strong className="text-[var(--text-secondary)]">PIN Pickup</strong>, atau <strong className="text-[var(--text-secondary)]">Nama Penerima</strong> pada kolom pencarian di atas.
                    </p>
                  </div>

                  {/* 3 Langkah Cepat Kiosk */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-left">
                    <div className="p-3.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-primary)] space-y-1.5">
                      <div className="flex items-center gap-2 text-xs font-bold text-[var(--accent-primary)]">
                        <span className="w-5 h-5 rounded-full bg-[var(--accent-primary)]/15 flex items-center justify-center text-[11px] font-mono font-bold">1</span>
                        <span>Cari Paket</span>
                      </div>
                      <p className="text-[11px] text-[var(--text-muted)] leading-normal">
                        Ketik nomor order atau scan barcode dari surat jalan / aplikasi kurir Anda.
                      </p>
                    </div>

                    <div className="p-3.5 rounded-xl border border-amber-300/40 dark:border-amber-800/40 bg-amber-500/5 space-y-1.5">
                      <div className="flex items-center gap-2 text-xs font-bold text-amber-700 dark:text-amber-400">
                        <span className="w-5 h-5 rounded-full bg-amber-500/20 flex items-center justify-center text-[11px] font-mono font-bold">2</span>
                        <span>Lapor Kedatangan</span>
                      </div>
                      <p className="text-[11px] text-[var(--text-muted)] leading-normal">
                        Tekan <strong className="text-amber-700 dark:text-amber-400">&quot;Saya Sudah Tiba&quot;</strong> jika paket sedang dipersiapkan di meja staf packing.
                      </p>
                    </div>

                    <div className="p-3.5 rounded-xl border border-emerald-300/40 dark:border-emerald-800/40 bg-emerald-500/5 space-y-1.5">
                      <div className="flex items-center gap-2 text-xs font-bold text-emerald-700 dark:text-emerald-400">
                        <span className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center text-[11px] font-mono font-bold">3</span>
                        <span>Ambil Paket</span>
                      </div>
                      <p className="text-[11px] text-[var(--text-muted)] leading-normal">
                        Tekan <strong className="text-emerald-700 dark:text-emerald-400">&quot;Ambil Paket&quot;</strong> untuk konfirmasi data dan foto bukti serah terima paket.
                      </p>
                    </div>
                  </div>
                </div>
              ) : filteredOrders.length === 0 ? (
                /* EMPTY STATE: ORDER TIDAK DITEMUKAN */
                <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-8 text-center space-y-4 shadow-sm">
                  <div className="mx-auto w-14 h-14 rounded-2xl bg-rose-500/10 text-rose-500 flex items-center justify-center">
                    <Package className="w-7 h-7" />
                  </div>
                  <div className="max-w-md mx-auto space-y-1.5">
                    <h3 className="text-sm sm:text-base font-bold text-[var(--text-primary)]">
                      Order Tidak Ditemukan
                    </h3>
                    <p className="text-xs text-[var(--text-muted)]">
                      Tidak ditemukan pesanan yang cocok dengan kata kunci <span className="font-mono font-bold text-[var(--text-primary)]">&quot;{searchQuery}&quot;</span>.
                    </p>
                    <p className="text-[11px] text-[var(--text-muted)]">
                      Pastikan ejaan nomor resi/order benar, atau tekan tombol &quot;Tarik Order dari API&quot; jika order baru saja diterbitkan di ERP.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setSearchQuery('');
                        searchInputRef.current?.focus();
                      }}
                      className="px-4 py-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-primary)] hover:bg-[var(--bg-card-hover)] text-xs font-semibold text-[var(--text-secondary)] transition-colors"
                    >
                      Reset Pencarian
                    </button>
                    <button
                      type="button"
                      onClick={handleSyncExternal}
                      disabled={syncingExternal}
                      className="px-4 py-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-xs font-bold transition-colors inline-flex items-center gap-1.5 disabled:opacity-50"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${syncingExternal ? 'animate-spin' : ''}`} />
                      <span>{syncingExternal ? 'Menarik...' : 'Tarik Order dari API'}</span>
                    </button>
                  </div>
                </div>
              ) : (
                /* SEARCH RESULTS (Ketika sedang dicari dan ditemukan) */
                <div className="space-y-6">
                  {/* Results Header Info */}
                  <div className="flex items-center justify-between px-1">
                    <span className="text-xs text-[var(--text-muted)] font-medium">
                      Ditemukan <strong className="text-[var(--text-primary)]">{filteredOrders.length}</strong> pesanan yang cocok untuk <span className="font-mono font-bold text-[var(--text-primary)]">&quot;{searchQuery}&quot;</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setSearchQuery('');
                        searchInputRef.current?.focus();
                      }}
                      className="text-xs text-[var(--accent-primary)] hover:underline font-semibold"
                    >
                      Hapus Pencarian
                    </button>
                  </div>

                  {/* Category Tab Filter Pills */}
                  <div className="flex items-center gap-2 overflow-x-auto pb-1">
                    <button
                      type="button"
                      onClick={() => setCategoryTab('ALL')}
                      className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                        categoryTab === 'ALL'
                          ? 'bg-[var(--accent-primary)] text-white shadow-sm'
                          : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] border border-[var(--border-subtle)] hover:bg-[var(--bg-card-hover)]'
                      }`}
                    >
                      <span>Semua Hasil</span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/20 text-current font-mono font-semibold">
                        {filteredOrders.length}
                      </span>
                    </button>

                    {arrivedOrders.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setCategoryTab('ARRIVED')}
                        className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                          categoryTab === 'ARRIVED'
                            ? 'bg-amber-500 text-slate-950 shadow-sm'
                            : 'bg-[var(--bg-surface)] text-amber-700 dark:text-amber-400 border border-amber-300/40 dark:border-amber-800/40 hover:bg-amber-500/10'
                        }`}
                      >
                        <UserCheck className="w-3.5 h-3.5" />
                        <span>Kurir Sudah Tiba</span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded-full font-mono font-semibold bg-black/20 text-current">
                          {arrivedOrders.length}
                        </span>
                      </button>
                    )}

                    {readyOrders.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setCategoryTab('READY')}
                        className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                          categoryTab === 'READY'
                            ? 'bg-emerald-600 text-white shadow-sm'
                            : 'bg-[var(--bg-surface)] text-emerald-700 dark:text-emerald-400 border border-emerald-300/40 dark:border-emerald-800/40 hover:bg-emerald-500/10'
                        }`}
                      >
                        <PackageCheck className="w-3.5 h-3.5" />
                        <span>Siap Diambil di Rak</span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded-full font-mono font-semibold bg-black/20 text-current">
                          {readyOrders.length}
                        </span>
                      </button>
                    )}

                    {packingOrders.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setCategoryTab('PACKING')}
                        className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                          categoryTab === 'PACKING'
                            ? 'bg-sky-600 text-white shadow-sm'
                            : 'bg-[var(--bg-surface)] text-sky-700 dark:text-sky-400 border border-sky-300/40 dark:border-sky-800/40 hover:bg-sky-500/10'
                        }`}
                      >
                        <Clock className="w-3.5 h-3.5" />
                        <span>Sedang Packing</span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded-full font-mono font-semibold bg-black/20 text-current">
                          {packingOrders.length}
                        </span>
                      </button>
                    )}
                  </div>

                  {/* CATEGORY 1: KURIR SUDAH TIBA (ANTREAN LOKET) */}
                  {(categoryTab === 'ALL' || categoryTab === 'ARRIVED') && arrivedOrders.length > 0 && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between px-1">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
                          <h2 className="text-xs font-bold text-amber-800 dark:text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                            <UserCheck className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                            <span>Kurir Sudah Tiba ({arrivedOrders.length})</span>
                          </h2>
                        </div>
                        <span className="text-xs text-[var(--text-muted)]">
                          Antrean kurir yang sedang menunggu serah terima di loket
                        </span>
                      </div>

                      <div className="grid gap-3">
                        {arrivedOrders.map((order, idx) => {
                          const isReadyForPickup = order.status === 'READY_FOR_PICKUP';
                          return (
                            <div
                              key={order.id}
                              className="rounded-xl p-4 sm:p-5 border-2 border-amber-400 dark:border-amber-600/70 bg-amber-50/40 dark:bg-amber-950/20 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 transition-all"
                            >
                              <div className="space-y-1.5 flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-amber-500 text-slate-950 shadow-xs">
                                    ANTREAN #{order.queue_number ?? (idx + 1)}
                                  </span>
                                  <span className="text-base sm:text-lg font-bold font-mono text-[var(--text-primary)]">
                                    {order.order_number}
                                  </span>

                                  {order.no_wsa && (
                                    <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-[var(--bg-primary)] text-[var(--text-secondary)] border border-[var(--border-subtle)] font-semibold">
                                      WSA: {order.no_wsa}
                                    </span>
                                  )}

                                  {order.picking_no && (
                                    <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-[var(--bg-primary)] text-[var(--text-muted)] border border-[var(--border-subtle)]">
                                      Pick #{order.picking_no}
                                    </span>
                                  )}
                                  <StatusBadge status={order.status} />
                                </div>

                                <p className="text-xs text-[var(--text-secondary)]">
                                  Penerima: <span className="font-semibold text-[var(--text-primary)]">{order.customer_name || 'N/A'}</span> • Ekspedisi: <span className="font-semibold text-amber-800 dark:text-amber-300">{order.courier_name || 'General'}</span>
                                  {order.driver_name && (
                                    <span className="ml-1 text-[var(--text-muted)]">
                                      • Driver: <strong className="text-[var(--text-primary)]">{order.driver_name}</strong>
                                    </span>
                                  )}
                                </p>

                                {order.driver_arrived_at && (
                                  <p
                                    className="text-xs text-amber-700 dark:text-amber-400 font-mono flex items-center gap-1"
                                    suppressHydrationWarning
                                  >
                                    <Clock className="w-3.5 h-3.5 text-amber-600" />
                                    <span suppressHydrationWarning>
                                      Tiba: {formatWIB(order.driver_arrived_at)} {mounted ? `(${formatDuration(getElapsedSeconds(order.driver_arrived_at))} yang lalu)` : ''}
                                    </span>
                                  </p>
                                )}
                              </div>

                              <div className="flex items-center gap-2 w-full sm:w-auto shrink-0 pt-2 sm:pt-0">
                                {isReadyForPickup ? (
                                  <button
                                    onClick={() => startHandoverWizard(order)}
                                    className="w-full sm:w-auto px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition-colors flex items-center justify-center gap-1.5 min-h-[44px]"
                                  >
                                    <span>Ambil Paket</span>
                                    <ArrowRight className="w-3.5 h-3.5" />
                                  </button>
                                ) : (
                                  <span className="w-full sm:w-auto px-3.5 py-2.5 rounded-lg bg-sky-100 dark:bg-sky-950 border border-sky-300 dark:border-sky-800 text-sky-800 dark:text-sky-300 text-xs font-semibold flex items-center justify-center gap-1.5">
                                    <Clock className="w-3.5 h-3.5 animate-spin" />
                                    <span>Sedang Dipacking di Meja</span>
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* CATEGORY 2: SIAP DIAMBIL DI RAK */}
                  {(categoryTab === 'ALL' || categoryTab === 'READY') && readyOrders.length > 0 && (
                    <div className="space-y-3 pt-2">
                      <div className="flex items-center justify-between px-1">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                          <h2 className="text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                            <PackageCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                            <span>Siap Diambil di Rak ({readyOrders.length})</span>
                          </h2>
                        </div>
                        <span className="text-xs text-[var(--text-muted)]">
                          Paket sudah berada di rak serah terima (belum lapor tiba)
                        </span>
                      </div>

                      <div className="grid gap-3">
                        {readyOrders.map((order) => (
                          <div
                            key={order.id}
                            className="rounded-xl p-4 sm:p-5 border border-[var(--border-subtle)] bg-[var(--bg-card)] hover:border-[var(--border-strong)] transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm"
                          >
                            <div className="space-y-1.5 flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-base sm:text-lg font-bold font-mono text-[var(--text-primary)]">
                                  {order.order_number}
                                </span>

                                {order.no_wsa && (
                                  <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-[var(--bg-primary)] text-[var(--text-secondary)] border border-[var(--border-subtle)] font-semibold">
                                    WSA: {order.no_wsa}
                                  </span>
                                )}

                                {order.picking_no && (
                                  <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-[var(--bg-primary)] text-[var(--text-muted)] border border-[var(--border-subtle)]">
                                    Pick #{order.picking_no}
                                  </span>
                                )}
                                <StatusBadge status={order.status} />
                              </div>

                              <p className="text-xs text-[var(--text-secondary)]">
                                Penerima: <span className="font-semibold text-[var(--text-primary)]">{order.customer_name || 'N/A'}</span> • Ekspedisi: <span className="font-semibold text-[var(--text-primary)]">{order.courier_name || 'General'}</span>
                              </p>
                            </div>

                            <div className="flex items-center gap-2 w-full sm:w-auto shrink-0 pt-2 sm:pt-0">
                              <button
                                onClick={() => handleDriverArrival(order)}
                                disabled={submittingAction}
                                className="flex-1 sm:flex-none px-3.5 py-2.5 rounded-lg border border-amber-400 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 text-xs font-bold hover:bg-amber-100 transition-colors flex items-center justify-center gap-1.5"
                              >
                                <UserCheck className="w-3.5 h-3.5" />
                                <span>Saya Sudah Tiba</span>
                              </button>

                              <button
                                onClick={() => startHandoverWizard(order)}
                                className="flex-1 sm:flex-none px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition-colors flex items-center justify-center gap-1.5 min-h-[44px]"
                              >
                                <span>Ambil Paket</span>
                                <ArrowRight className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* CATEGORY 3: SEDANG DIPACKING DI MEJA */}
                  {(categoryTab === 'ALL' || categoryTab === 'PACKING') && packingOrders.length > 0 && (
                    <div className="space-y-3 pt-2">
                      <div className="flex items-center justify-between px-1">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-sky-500" />
                          <h2 className="text-xs font-bold text-sky-700 dark:text-sky-400 uppercase tracking-wider flex items-center gap-1.5">
                            <Clock className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                            <span>Sedang Dipacking di Meja ({packingOrders.length})</span>
                          </h2>
                        </div>
                        <span className="text-xs text-[var(--text-muted)]">
                          Paket sedang disiapkan oleh staf gudang
                        </span>
                      </div>

                      <div className="grid gap-3">
                        {packingOrders.map((order) => (
                          <div
                            key={order.id}
                            className="rounded-xl p-4 sm:p-5 border border-sky-200 dark:border-sky-800/50 bg-sky-50/20 dark:bg-sky-950/10 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 transition-all"
                          >
                            <div className="space-y-1.5 flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-base sm:text-lg font-bold font-mono text-[var(--text-primary)]">
                                  {order.order_number}
                                </span>

                                {order.no_wsa && (
                                  <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-[var(--bg-primary)] text-[var(--text-secondary)] border border-[var(--border-subtle)] font-semibold">
                                    WSA: {order.no_wsa}
                                  </span>
                                )}

                                {order.picking_no && (
                                  <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-[var(--bg-primary)] text-[var(--text-muted)] border border-[var(--border-subtle)]">
                                    Pick #{order.picking_no}
                                  </span>
                                )}
                                <StatusBadge status={order.status} />
                              </div>

                              <p className="text-xs text-[var(--text-secondary)]">
                                Penerima: <span className="font-semibold text-[var(--text-primary)]">{order.customer_name || 'N/A'}</span> • Ekspedisi: <span className="font-semibold text-[var(--text-primary)]">{order.courier_name || 'General'}</span>
                              </p>
                              <p className="text-[11px] text-sky-700 dark:text-sky-400">
                                Paket sedang disiapkan. Jika Anda sudah menunggu di gudang, tekan tombol &quot;Saya Sudah Tiba&quot; agar staf packing memprioritaskan paket ini.
                              </p>
                            </div>

                            <div className="flex items-center gap-2 w-full sm:w-auto shrink-0 pt-2 sm:pt-0">
                              <button
                                onClick={() => handleDriverArrival(order)}
                                disabled={submittingAction}
                                className="w-full sm:w-auto px-4 py-2.5 rounded-lg border border-amber-400 bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-bold shadow-sm transition-colors flex items-center justify-center gap-1.5 min-h-[44px]"
                              >
                                <UserCheck className="w-3.5 h-3.5" />
                                <span>Saya Sudah Tiba (Prioritaskan)</span>
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* CATEGORY 4: TELAH SELESAI DISERAHKAN */}
                  {categoryTab === 'ALL' && shippedOrders.length > 0 && (
                    <div className="space-y-3 pt-2">
                      <div className="flex items-center justify-between px-1">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-slate-400" />
                          <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                            <CheckCircle2 className="w-4 h-4 text-slate-500" />
                            <span>Telah Diserahkan / Selesai ({shippedOrders.length})</span>
                          </h2>
                        </div>
                      </div>

                      <div className="grid gap-3 opacity-75">
                        {shippedOrders.map((order) => (
                          <div
                            key={order.id}
                            className="rounded-xl p-4 border border-[var(--border-subtle)] bg-[var(--bg-surface)] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
                          >
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-bold text-sm text-[var(--text-secondary)]">{order.order_number}</span>
                                <StatusBadge status={order.status} />
                              </div>
                              <p className="text-xs text-[var(--text-muted)]">
                                Penerima: {order.customer_name} • Driver: {order.driver_name || 'N/A'} • {order.shipped_at ? `Diambil: ${formatWIB(order.shipped_at)}` : ''}
                              </p>
                            </div>
                            <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                              <Check className="w-3.5 h-3.5" /> Paket Selesai
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* STAGE 2: DRIVER INFO FORM */}
          {stage === 'DRIVER_INFO' && selectedOrder && (
            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 sm:p-6 shadow-sm max-w-xl mx-auto">
              <div className="mb-5 pb-3 border-b border-[var(--border-subtle)]">
                <button
                  type="button"
                  onClick={() => setStage('SELECT_ORDER')}
                  className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] mb-2 flex items-center gap-1 font-semibold"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Kembali ke Pilih Pesanan</span>
                </button>
                <h2 className="text-base font-bold text-[var(--text-primary)]">
                  Konfirmasi Identitas Kurir (Tahap 2 dari 4)
                </h2>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">
                  Masukkan identitas Anda sebelum mengambil foto bukti serah terima
                </p>
              </div>

              {/* Target Order Summary Card */}
              <div className="p-3.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] mb-5 space-y-1.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[var(--text-muted)]">Nomor Order:</span>
                  <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                    {selectedOrder.order_number}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[var(--text-muted)]">Nama Penerima:</span>
                  <span className="font-medium text-[var(--text-primary)]">
                    {selectedOrder.customer_name || 'N/A'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[var(--text-muted)]">Ekspedisi:</span>
                  <span className="font-semibold text-[var(--text-primary)]">
                    {selectedOrder.courier_name || 'General'}
                  </span>
                </div>
              </div>

              <form onSubmit={handleDriverInfoSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-primary)] mb-1">
                    Nama Lengkap Driver <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={driverName}
                    onChange={(e) => setDriverName(e.target.value)}
                    placeholder="Contoh: Budi Santoso"
                    required
                    className="w-full px-3.5 py-2.5 rounded-lg bg-[var(--bg-card)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-xs focus:outline-none focus:border-[var(--accent-primary)] font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[var(--text-primary)] mb-1">
                    Perusahaan Ekspedisi <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={courierCompany}
                    onChange={(e) => setCourierCompany(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-lg bg-[var(--bg-card)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-xs focus:outline-none focus:border-[var(--accent-primary)] font-medium"
                  >
                    {COURIER_OPTIONS.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[var(--text-primary)] mb-1">
                    Nomor WhatsApp / HP (Opsional)
                  </label>
                  <input
                    type="text"
                    value={driverPhone}
                    onChange={(e) => setDriverPhone(e.target.value)}
                    placeholder="Contoh: 08123456789"
                    className="w-full px-3.5 py-2.5 rounded-lg bg-[var(--bg-card)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-xs focus:outline-none focus:border-[var(--accent-primary)] font-medium"
                  />
                </div>

                <div className="pt-3 flex gap-2.5">
                  <button
                    type="button"
                    onClick={() => setStage('SELECT_ORDER')}
                    className="flex-1 py-2.5 px-4 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-card-hover)]"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="flex-2 py-2.5 px-5 rounded-lg bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white text-xs font-bold transition-colors flex items-center justify-center gap-2"
                  >
                    <span>Lanjut ke Kamera Bukti</span>
                    <Camera className="w-4 h-4" />
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* STAGE 3: LIVE CAMERA VIEW */}
          {stage === 'CAMERA' && selectedOrder && (
            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 shadow-sm max-w-xl mx-auto">
              <div className="flex items-center justify-between mb-3 pb-3 border-b border-[var(--border-subtle)]">
                <div>
                  <h2 className="text-sm font-bold text-[var(--text-primary)]">
                    Foto Bukti Serah Terima Paket
                  </h2>
                  <p className="text-xs text-[var(--text-muted)]">
                    Arahkan resi dan paket ke dalam bingkai kamera
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={flipCamera}
                    title="Ganti Kamera Depan/Belakang"
                    className="px-2.5 py-1.5 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-card)] text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-card-hover)] flex items-center gap-1.5"
                  >
                    <RotateCw className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Balik ({facingMode === 'environment' ? 'Belakang' : 'Depan'})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => startCamera(facingMode)}
                    title="Reload Sensor Kamera"
                    className="px-2.5 py-1.5 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-card)] text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-card-hover)] flex items-center gap-1"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Reload</span>
                  </button>
                </div>
              </div>

              {cameraError && (
                <div className="mb-3 p-3 rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-300 text-xs space-y-2">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                    <div>
                      <p className="font-bold">Kendala Sensor Kamera:</p>
                      <p className="mt-0.5">{cameraError}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-rose-200 dark:border-rose-900">
                    <button
                      type="button"
                      onClick={() => startCamera(facingMode)}
                      className="px-2.5 py-1 rounded bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs"
                    >
                      Coba Buka Kamera Lagi
                    </button>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-2.5 py-1 rounded bg-[var(--accent-primary)] text-white font-semibold text-xs flex items-center gap-1"
                    >
                      <UploadCloud className="w-3.5 h-3.5" />
                      <span>Upload File Foto</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleCapture}
                      className="px-2.5 py-1 rounded border border-amber-400 bg-amber-50 dark:bg-amber-950 text-amber-800 dark:text-amber-300 font-semibold text-xs"
                    >
                      Simulasi Foto Dummy
                    </button>
                  </div>
                </div>
              )}

              {/* Viewfinder Frame */}
              <div className="relative aspect-[4/3] bg-black rounded-lg overflow-hidden border border-[var(--border-strong)] flex items-center justify-center">
                <video
                  ref={videoRef}
                  playsInline
                  autoPlay
                  muted
                  className="w-full h-full object-cover"
                />

                {/* Top Watermark Badge */}
                <div className="absolute top-2 inset-x-2 flex items-center justify-between z-20 pointer-events-none">
                  <div className="px-2 py-1 rounded bg-black/75 text-emerald-400 font-mono text-[11px] font-semibold border border-emerald-500/30">
                    REC • {liveTimestamp || 'WIB'}
                  </div>
                  <div className="px-2 py-1 rounded bg-black/75 text-white font-mono text-[11px] border border-white/20">
                    ORD: {selectedOrder.order_number}
                  </div>
                </div>

                {/* Center Target Box */}
                <div className="absolute inset-8 border border-dashed border-white/60 rounded pointer-events-none flex flex-col justify-between p-2 z-10">
                  <span className="text-[10px] text-white/80 font-mono">AREA LABEL RESI</span>
                  <span className="text-[10px] text-white/80 font-mono text-right">QC VERIFIED</span>
                </div>

                {/* Bottom Driver Badge */}
                <div className="absolute bottom-2 inset-x-2 flex items-center justify-between z-20 pointer-events-none text-xs text-white">
                  <div className="px-2 py-1 rounded bg-black/75 font-mono">
                    Kurir: {driverName || 'Driver'} ({courierCompany})
                  </div>
                </div>

                {/* Loading state indicator */}
                {!isCameraReady && !cameraError && (
                  <div className="absolute inset-0 bg-slate-900/90 flex items-center justify-center z-30">
                    <div className="text-center space-y-2 p-4">
                      <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
                      <p className="text-xs text-emerald-400 font-semibold">
                        Mengaktifkan Kamera...
                      </p>
                      <p className="text-[11px] text-slate-400">
                        Klik &quot;Allow / Izinkan&quot; jika muncul pop-up izin browser.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileUpload}
              />

              {/* Shutter Bar */}
              <div className="mt-4 space-y-2.5">
                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => setStage('DRIVER_INFO')}
                    className="py-2.5 px-4 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-card-hover)] flex items-center gap-1.5"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Kembali</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleCapture}
                    disabled={!isCameraReady && !cameraError}
                    className="flex-1 py-3 px-5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm transition-colors flex items-center justify-center gap-2 min-h-[44px]"
                  >
                    <Camera className="w-4 h-4" />
                    <span>Ambil Foto Bukti Serah Terima</span>
                  </button>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-[var(--border-subtle)] text-xs text-[var(--text-muted)]">
                  <span>Tidak bisa akses webcam?</span>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-[var(--accent-primary)] hover:underline font-semibold flex items-center gap-1"
                  >
                    <UploadCloud className="w-3.5 h-3.5" />
                    <span>Upload File Foto</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* STAGE 4: REVIEW PHOTO */}
          {stage === 'REVIEW' && selectedOrder && capturedPhotoUrl && (
            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 sm:p-6 shadow-sm max-w-xl mx-auto">
              <div className="mb-4 pb-3 border-b border-[var(--border-subtle)]">
                <h2 className="text-sm font-bold text-[var(--text-primary)]">
                  Verifikasi Hasil Foto (Tahap 4 dari 4)
                </h2>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">
                  Pastikan foto resi jelas dan stempel watermark sudah tersemat rapi
                </p>
              </div>

              <div className="rounded-lg overflow-hidden border border-[var(--border-subtle)] bg-black">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={capturedPhotoUrl}
                  alt="Captured Handover Proof with Watermark"
                  className="w-full object-contain max-h-[380px]"
                />
              </div>

              <div className="mt-3 p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 flex items-center justify-between text-xs text-emerald-800 dark:text-emerald-300">
                <span className="font-medium flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Stempel Waktu & Resi Berhasil Tersemat</span>
                </span>
                <span className="font-mono text-[11px]" suppressHydrationWarning>{liveTimestamp}</span>
              </div>

              <div className="mt-5 flex gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setCapturedPhotoUrl(null);
                    setStage('CAMERA');
                  }}
                  disabled={submittingAction}
                  className="flex-1 py-2.5 px-4 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-card-hover)] flex items-center justify-center gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Foto Ulang</span>
                </button>

                <button
                  type="button"
                  onClick={handleConfirmPickup}
                  disabled={submittingAction}
                  className="flex-2 py-2.5 px-5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm transition-colors flex items-center justify-center gap-2 min-h-[44px]"
                >
                  {submittingAction ? (
                    <span>Menyimpan Serah Terima...</span>
                  ) : (
                    <>
                      <span>Konfirmasi & Selesaikan Serah Terima</span>
                      <Check className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* STAGE 5: SUCCESS RECEIPT */}
          {stage === 'SUCCESS' && successReceipt && (
            <div className="rounded-xl border border-emerald-300 dark:border-emerald-800 bg-[var(--bg-surface)] p-6 sm:p-8 shadow-sm max-w-lg mx-auto text-center">
              <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto mb-3">
                <CheckCircle2 className="w-6 h-6" />
              </div>

              <h2 className="text-base font-bold text-[var(--text-primary)]">
                Serah Terima Berhasil Dikonfirmasi!
              </h2>
              <p className="text-xs text-[var(--text-muted)] mt-1">
                Status paket telah diperbarui menjadi &quot;Telah Dikirim (SHIP)&quot; di sistem gudang.
              </p>

              {/* Digital Receipt Card */}
              <div className="mt-5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4 text-left space-y-2 text-xs">
                <div className="flex justify-between border-b border-[var(--border-subtle)] pb-2">
                  <span className="text-[var(--text-muted)]">ID Transaksi:</span>
                  <span className="font-mono font-bold text-[var(--text-primary)]">{successReceipt.transaction_id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--text-muted)]">Nomor Order:</span>
                  <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">{successReceipt.order_number}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--text-muted)]">Ekspedisi:</span>
                  <span className="font-semibold text-[var(--text-primary)]">{successReceipt.courier_company}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--text-muted)]">Nama Kurir:</span>
                  <span className="font-semibold text-[var(--text-primary)]">{successReceipt.driver_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--text-muted)]">Waktu Serah Terima:</span>
                  <span className="text-[var(--text-secondary)]" suppressHydrationWarning>{formatWIB(successReceipt.shipped_at)}</span>
                </div>
                {successReceipt.wait_duration_seconds !== undefined && (
                  <div className="flex justify-between border-t border-[var(--border-subtle)] pt-2 text-amber-700 dark:text-amber-400 font-semibold">
                    <span>Durasi Menunggu Kurir:</span>
                    <span suppressHydrationWarning>{formatDuration(successReceipt.wait_duration_seconds)}</span>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={resetWizard}
                className="w-full mt-5 py-3 px-5 rounded-lg bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white font-bold text-xs shadow-sm transition-colors flex items-center justify-center gap-2 min-h-[44px]"
              >
                <Package className="w-4 h-4" />
                <span>Proses Paket Berikutnya</span>
              </button>
            </div>
          )}
        </div>
      </main>

      {/* Early Check-In Modal for Queued Orders */}
      {earlyCheckInOrder && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 max-w-md w-full shadow-lg space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border-subtle)]">
              <div className="flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-amber-600" />
                <h3 className="text-sm font-bold text-[var(--text-primary)]">Konfirmasi Kedatangan Kurir</h3>
              </div>
              <button
                onClick={() => setEarlyCheckInOrder(null)}
                className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
              Mencatat kedatangan kurir untuk order{' '}
              <span className="font-bold font-mono text-[var(--text-primary)]">
                {earlyCheckInOrder.order_number}
              </span>{' '}
              akan langsung menaikkan status antrian ke <span className="font-semibold text-amber-600 dark:text-amber-400">Prioritas Utama</span> di meja packing staf.
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-[var(--text-primary)] mb-1">
                  Nama Driver <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={driverName}
                  onChange={(e) => setDriverName(e.target.value)}
                  placeholder="Contoh: Budi Santoso"
                  required
                  className="w-full px-3 py-2 rounded-lg bg-[var(--bg-card)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-xs focus:outline-none focus:border-[var(--accent-primary)] font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-primary)] mb-1">
                  Ekspedisi
                </label>
                <select
                  value={courierCompany}
                  onChange={(e) => setCourierCompany(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[var(--bg-card)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-xs focus:outline-none focus:border-[var(--accent-primary)] font-medium"
                >
                  {COURIER_OPTIONS.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="pt-2 flex gap-2.5">
              <button
                type="button"
                onClick={() => setEarlyCheckInOrder(null)}
                className="flex-1 py-2 px-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-card-hover)]"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={submitEarlyCheckIn}
                disabled={submittingAction || !driverName.trim()}
                className="flex-2 py-2 px-4 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs disabled:opacity-50 transition-colors"
              >
                {submittingAction ? 'Menyimpan...' : 'Konfirmasi Tiba (Prioritaskan)'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="bg-[var(--bg-surface)] border-t border-[var(--border-subtle)] p-3 text-center text-xs text-[var(--text-muted)]">
        Sistem Antrian Gudang & Pickup Ekspedisi Terpadu • Asia/Jakarta (WIB)
      </footer>
    </div>
  );
}
