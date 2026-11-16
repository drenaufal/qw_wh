'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { StaffLayout } from '@/components/StaffLayout';
import { Order, OrderItem } from '@/lib/types';
import { useCamera } from '@/hooks/use-camera';
import { useSSE } from '@/hooks/use-sse';
import { formatWIB, formatDuration, getElapsedSeconds } from '@/lib/utils/datetime';
import { StatusBadge, PriorityBadge } from '@/components/ui';
import {
  AlertTriangle,
  X,
  UserCheck,
  ZoomIn,
  Search,
  Clock,
  Package,
  PackageCheck,
  CheckCircle2,
  Camera,
  UploadCloud,
  RotateCw,
  ChevronDown,
  ChevronUp,
  FileCheck2,
  Sparkles,
  RefreshCw,
  Check,
  Truck,
  Layers,
} from 'lucide-react';

const COURIER_OPTIONS = [
  'J&T Express',
  'SiCepat',
  'Shopee Xpress',
  'GoSend',
  'GrabExpress',
  'JNE',
  'AnterAja',
  'Wahana',
  'Ninja Xpress',
  'ID Express',
  'Kurir Internal Gudang',
];

function OrderItemsManifest({
  items,
  isExpanded,
  onToggle,
}: {
  items?: OrderItem[];
  isExpanded: boolean;
  onToggle: () => void;
}) {
  if (!items || items.length === 0) {
    return (
      <div className="pt-2 border-t border-[var(--border-subtle)] text-[11px] text-[var(--text-muted)] italic">
        Belum ada rincian item produk
      </div>
    );
  }

  const totalQty = items.reduce((s, it) => s + (it.quantity || 1), 0);

  return (
    <div className="pt-2 border-t border-[var(--border-subtle)] space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="font-semibold text-[var(--text-secondary)] flex items-center gap-1.5">
          <Package className="w-3.5 h-3.5 text-sky-500" />
          <span>Produk ({items.length} jenis • {totalQty} pcs)</span>
        </span>
        <button
          type="button"
          onClick={onToggle}
          className="text-[11px] font-semibold text-[var(--accent-primary)] hover:underline flex items-center gap-0.5 cursor-pointer"
        >
          {isExpanded ? (
            <>
              <span>Sembunyikan</span>
              <ChevronUp className="w-3 h-3" />
            </>
          ) : (
            <>
              <span>Lihat Produk</span>
              <ChevronDown className="w-3 h-3" />
            </>
          )}
        </button>
      </div>

      {isExpanded ? (
        <div className="space-y-1.5 bg-[var(--bg-card)] p-2.5 rounded-lg border border-[var(--border-subtle)] max-h-48 overflow-y-auto">
          {items.map((it, idx) => (
            <div
              key={it.id || idx}
              className="flex items-start justify-between gap-2 py-1 border-b border-[var(--border-subtle)] last:border-0 text-xs"
            >
              <div className="min-w-0">
                <p className="font-medium text-[var(--text-primary)] truncate">{it.product_name}</p>
                <div className="flex flex-wrap items-center gap-2 text-[10px] text-[var(--text-muted)] mt-0.5">
                  {it.sku && (
                    <span className="font-mono bg-[var(--bg-surface)] px-1 rounded border border-[var(--border-subtle)]">
                      SKU: {it.sku}
                    </span>
                  )}
                  {it.size && <span>Size: <strong className="text-[var(--text-secondary)]">{it.size}</strong></span>}
                  {it.warna && <span>Warna: <strong className="text-[var(--text-secondary)]">{it.warna}</strong></span>}
                </div>
              </div>
              <span className="font-bold text-xs px-2 py-0.5 rounded bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-primary)] shrink-0">
                {it.quantity}x
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-[11px] text-[var(--text-muted)] truncate">
          {items.slice(0, 2).map((it) => `${it.product_name} (${it.quantity}x)`).join(', ')}
          {items.length > 2 && ` +${items.length - 2} lainnya...`}
        </p>
      )}
    </div>
  );
}

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
    items?: OrderItem[];
  } | null>(null);

  // Assist Driver Arrival Modal
  const [assistOrder, setAssistOrder] = useState<Order | null>(null);
  const [assistDriverName, setAssistDriverName] = useState('');
  const [assistCourier, setAssistCourier] = useState('J&T Express');
  const [submittingAssist, setSubmittingAssist] = useState(false);

  // Assist Package Handover (Ambil Paket) Modal
  const [pickupModalOrder, setPickupModalOrder] = useState<Order | null>(null);
  const [pickupDriverName, setPickupDriverName] = useState('');
  const [pickupCourierCompany, setPickupCourierCompany] = useState('J&T Express');
  const [pickupDriverPhone, setPickupDriverPhone] = useState('');
  const [photoCaptureMode, setPhotoCaptureMode] = useState<'CAMERA' | 'UPLOAD' | 'BADGE'>('CAMERA');
  const [capturedPhotoUrl, setCapturedPhotoUrl] = useState<string | null>(null);
  const [submittingPickup, setSubmittingPickup] = useState(false);
  const [pickupSuccessReceipt, setPickupSuccessReceipt] = useState<{
    transaction_id: string;
    order_number: string;
    driver_name: string;
    courier_company: string;
    shipped_at: string;
    wait_duration_seconds?: number | null;
  } | null>(null);

  // Expandable product items state: Record<orderId, boolean>
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({});

  const [submittingAction, setSubmittingAction] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [nowSec, setNowSec] = useState(0);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const {
    videoRef,
    isReady,
    cameraError,
    startCamera,
    stopCamera,
    capturePhoto,
    processImageFile,
    flipCamera,
    facingMode,
  } = useCamera();

  const { subscribe } = useSSE();

  useEffect(() => {
    setNowSec(Date.now());
    const t = setInterval(() => setNowSec(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const toggleExpandItems = (orderId: string) => {
    setExpandedItems((prev) => ({
      ...prev,
      [orderId]: !prev[orderId],
    }));
  };

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

  // Clean up camera if unmounting
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

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
      if (!res.ok) throw new Error(data.error || 'Gagal mereset status prioritas');
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
      if (!res.ok) throw new Error(data.error || 'Gagal mencatat kedatangan kurir');

      setAssistOrder(null);
      setAssistDriverName('');
      await fetchOrders();
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setSubmittingAssist(false);
    }
  };

  const openPickupModal = (order: Order) => {
    setPickupModalOrder(order);
    setPickupDriverName(order.driver_name || '');
    setPickupCourierCompany(order.courier_name || 'J&T Express');
    setPickupDriverPhone(order.driver_phone || '');
    setCapturedPhotoUrl(null);
    setPhotoCaptureMode('CAMERA');
    setErrorMsg(null);
    startCamera('environment').catch(console.warn);
  };

  const closePickupModal = () => {
    stopCamera();
    setPickupModalOrder(null);
    setCapturedPhotoUrl(null);
  };

  const handleCaptureFromCamera = () => {
    if (!pickupModalOrder) return;
    const nowStamp = formatWIB(new Date());
    const photoData = capturePhoto({
      orderNumber: pickupModalOrder.order_number,
      driverName: pickupDriverName.trim() || 'Driver',
      courierCompany: pickupCourierCompany || pickupModalOrder.courier_name || 'General',
      timestamp: nowStamp,
    });

    if (photoData) {
      setCapturedPhotoUrl(photoData);
      stopCamera();
    } else {
      setErrorMsg('Gagal mengambil foto dari kamera. Silakan coba unggah file atau gunakan badge digital.');
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !pickupModalOrder) return;

    try {
      const nowStamp = formatWIB(new Date());
      const watermarked = await processImageFile(file, {
        orderNumber: pickupModalOrder.order_number,
        driverName: pickupDriverName.trim() || 'Driver',
        courierCompany: pickupCourierCompany || pickupModalOrder.courier_name || 'General',
        timestamp: nowStamp,
      });

      setCapturedPhotoUrl(watermarked);
      stopCamera();
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal memproses file foto.');
    }
  };

  const generateDigitalBadgePhoto = () => {
    if (!pickupModalOrder) return;
    const canvas = document.createElement('canvas');
    canvas.width = 1280;
    canvas.height = 720;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const grad = ctx.createLinearGradient(0, 0, 1280, 720);
    grad.addColorStop(0, '#090d16');
    grad.addColorStop(1, '#020617');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1280, 720);

    ctx.strokeStyle = '#059669';
    ctx.lineWidth = 8;
    ctx.strokeRect(30, 30, 1220, 660);

    ctx.fillStyle = '#10b981';
    ctx.font = 'bold 36px sans-serif';
    ctx.fillText('BUKTI RESMI SERAH TERIMA LOKET GUDANG', 70, 95);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '20px monospace';
    ctx.fillText('DISPATCH DESK VERIFIED HANDOVER RECORD', 70, 130);

    ctx.fillStyle = '#1e293b';
    ctx.fillRect(70, 170, 1140, 420);
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 2;
    ctx.strokeRect(70, 170, 1140, 420);

    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 32px monospace';
    ctx.fillText(`NO. ORDER : ${pickupModalOrder.order_number}`, 105, 230);

    ctx.fillStyle = '#cbd5e1';
    ctx.font = '24px sans-serif';
    ctx.fillText(`Penerima  : ${pickupModalOrder.customer_name || 'N/A'}`, 105, 280);
    ctx.fillText(`Ekspedisi : ${pickupCourierCompany || pickupModalOrder.courier_name || 'General Fleet'}`, 105, 330);
    ctx.fillText(`Kurir     : ${pickupDriverName.trim() || 'Driver Terverifikasi'}`, 105, 380);

    const itemCount = pickupModalOrder.items?.length || 0;
    const totalQty = pickupModalOrder.items?.reduce((s, it) => s + (it.quantity || 1), 0) || 0;
    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 22px sans-serif';
    ctx.fillText(`Total Isi Paket: ${itemCount} Jenis Produk (${totalQty} Pcs)`, 105, 440);

    if (pickupModalOrder.items && pickupModalOrder.items.length > 0) {
      ctx.fillStyle = '#94a3b8';
      ctx.font = '18px monospace';
      const itemsList = pickupModalOrder.items
        .slice(0, 3)
        .map((i) => `${i.product_name} (${i.quantity}x)`)
        .join(' • ');
      ctx.fillText(
        itemsList + (pickupModalOrder.items.length > 3 ? ` + ${pickupModalOrder.items.length - 3} lainnya` : ''),
        105,
        480
      );
    }

    const nowWib = formatWIB(new Date());
    ctx.fillStyle = '#34d399';
    ctx.font = 'bold 20px monospace';
    ctx.fillText(`WAKTU STAMP: ${nowWib} (WIB)`, 105, 540);

    const hash = `DESK-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    ctx.fillStyle = '#64748b';
    ctx.font = '16px monospace';
    ctx.fillText(`VERIFIKASI ID: ${hash} • STAFF AUDIT CONFIRMED`, 105, 570);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
    setCapturedPhotoUrl(dataUrl);
    stopCamera();
  };

  const handleConfirmPickupSubmit = async () => {
    if (!pickupModalOrder) return;
    if (!pickupDriverName.trim()) {
      setErrorMsg('Nama kurir/driver wajib diisi sebelum menyerahkan paket.');
      return;
    }
    if (!capturedPhotoUrl) {
      setErrorMsg('Bukti foto atau badge serah terima paket wajib diambil.');
      return;
    }

    setSubmittingPickup(true);
    setErrorMsg(null);

    try {
      const token = localStorage.getItem('wh_auth_token');
      const res = await fetch('/api/pickup/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          order_id: pickupModalOrder.id,
          driver_name: pickupDriverName.trim(),
          courier_company: pickupCourierCompany,
          photo_base64: capturedPhotoUrl,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Gagal menyerahkan paket');
      }

      closePickupModal();

      if (data.receipt) {
        setPickupSuccessReceipt(data.receipt);
      }

      await fetchOrders();
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setSubmittingPickup(false);
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
      items: order.items,
    });
  };

  const waitingCouriers = orders
    .filter((o) => o.priority_status === 'DRIVER_WAITING' && o.status !== 'SHIP')
    .sort((a, b) => {
      if (a.queue_number && b.queue_number) {
        return a.queue_number - b.queue_number;
      }
      const tA = a.driver_arrived_at ? new Date(a.driver_arrived_at).getTime() : 0;
      const tB = b.driver_arrived_at ? new Date(b.driver_arrived_at).getTime() : 0;
      return tA - tB;
    });

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
      title="Loket Pickup Kurir (Pickup Desk)"
      subtitle="Manajemen rak serah terima, an penyerahan paket, verifikasi produk, dan audit foto bukti"
      allowedRoles={['PICKUP_ADMIN', 'SUPERADMIN']}
    >
      <div className="space-y-6">
        {errorMsg && (
          <div className="p-3.5 rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-300 text-xs font-semibold flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
            <button
              onClick={() => setErrorMsg(null)}
              className="text-rose-600 hover:text-rose-800 text-xs font-bold"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* ZONE 1: COURIERS WAITING AT DOCK BAYS */}
        <div>
          <div className="flex items-center justify-between mb-3 px-1">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
              <h2 className="text-sm font-bold text-amber-900 dark:text-amber-300 uppercase tracking-wider">
                Area 1: Kurir Sedang Menunggu di Loket ({waitingCouriers.length})
              </h2>
            </div>
            <span className="text-xs text-[var(--text-muted)]">
              Waktu tunggu berjalan (Live)
            </span>
          </div>

          {waitingCouriers.length === 0 ? (
            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 text-center text-xs text-[var(--text-muted)]">
              Saat ini tidak ada kurir yang menunggu di loket penyerahan.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {waitingCouriers.map((order, idx) => {
                const elapsedSec = order.driver_arrived_at
                  ? getElapsedSeconds(order.driver_arrived_at)
                  : 0;
                const isReady = order.status === 'READY_FOR_PICKUP';

                return (
                  <div
                    key={order.id}
                    className="rounded-xl p-4 border-2 border-amber-400 bg-amber-50/40 dark:bg-amber-950/20 shadow-sm flex flex-col justify-between gap-3"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold px-2 py-0.5 rounded bg-amber-500 text-slate-950 font-mono">
                          ANTREAN #{order.queue_number ?? (idx + 1)}
                        </span>
                        <span className="font-mono font-bold text-base text-[var(--text-primary)]">
                          {order.order_number}
                        </span>
                        <StatusBadge status={order.status} />
                      </div>

                      <div className="text-xs space-y-0.5 text-[var(--text-secondary)]">
                        <p className="font-semibold text-amber-800 dark:text-amber-300">
                          Ekspedisi: {order.courier_name || 'General Fleet'}
                        </p>
                        <p>
                          Penerima: <span className="font-medium text-[var(--text-primary)]">{order.customer_name || 'N/A'}</span>
                        </p>
                        {order.driver_name && (
                          <p className="text-[var(--text-muted)]">Nama Driver: <strong className="text-[var(--text-primary)]">{order.driver_name}</strong></p>
                        )}
                      </div>

                      <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-950 border border-amber-300 dark:border-amber-800 flex items-center justify-between text-xs font-mono font-semibold text-amber-800 dark:text-amber-300">
                        <span>Lama Menunggu:</span>
                        <span className="flex items-center gap-1" suppressHydrationWarning>
                          <Clock className="w-3 h-3 text-amber-600" />
                          <span>{formatDuration(elapsedSec)}</span>
                        </span>
                      </div>

                      {/* Manifest Produk yang Masuk di Order */}
                      <OrderItemsManifest
                        items={order.items}
                        isExpanded={!!expandedItems[order.id]}
                        onToggle={() => toggleExpandItems(order.id)}
                      />
                    </div>

                    <div className="flex gap-2 pt-2">
                      {isReady ? (
                        <button
                          onClick={() => openPickupModal(order)}
                          className="flex-1 py-2 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors flex items-center justify-center gap-1.5 shadow-xs"
                        >
                          <PackageCheck className="w-3.5 h-3.5" />
                          <span> Ambil Paket</span>
                        </button>
                      ) : (
                        <div className="flex-1 py-2 px-2.5 rounded-lg bg-sky-50 dark:bg-sky-950/40 border border-sky-300 dark:border-sky-800 text-[11px] font-semibold text-sky-800 dark:text-sky-300 text-center flex items-center justify-center gap-1">
                          <Clock className="w-3 h-3 shrink-0" />
                          <span>Masih Packing</span>
                        </div>
                      )}
                      <button
                        onClick={() => handleResetPriority(order.id)}
                        disabled={submittingAction}
                        className="py-2 px-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:bg-[var(--bg-card-hover)] text-xs font-semibold text-[var(--text-secondary)] transition-colors shrink-0"
                        title="Kembalikan status prioritas kurir ke antrian normal"
                      >
                        Reset Antrian
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
          <div className="flex items-center justify-between mb-3 px-1">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              <h2 className="text-sm font-bold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider">
                Area 2: Rak Serah Terima Siap Diambil ({stagingShelves.length})
              </h2>
            </div>
            <span className="text-xs text-[var(--text-muted)]">
              Paket sudah dipacking rapi dan siap diserahkan ke kurir
            </span>
          </div>

          {stagingShelves.length === 0 ? (
            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 text-center text-xs text-[var(--text-muted)]">
              Rak serah terima saat ini kosong.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {stagingShelves.map((order) => {
                const isDriverWaiting = order.priority_status === 'DRIVER_WAITING';

                return (
                  <div
                    key={order.id}
                    className={`rounded-xl p-4 border shadow-sm flex flex-col justify-between gap-3 transition-colors ${
                      isDriverWaiting
                        ? 'border-amber-400 bg-amber-50/40 dark:bg-amber-950/20'
                        : 'border-emerald-300 dark:border-emerald-800 bg-[var(--bg-card)]'
                    }`}
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-base text-[var(--text-primary)]">
                          {order.order_number}
                        </span>
                        <PriorityBadge priority={order.priority_status} />
                      </div>

                      <div className="text-xs space-y-0.5 text-[var(--text-secondary)]">
                        <p>
                          Penerima: <span className="font-semibold text-[var(--text-primary)]">{order.customer_name || 'N/A'}</span>
                        </p>
                        <p className="font-semibold text-emerald-700 dark:text-emerald-400">
                          Ekspedisi: {order.courier_name || 'General'}
                        </p>
                        {order.driver_name && (
                          <p className="text-[var(--text-muted)]">
                            Kurir Standby: <strong className="text-[var(--text-primary)]">{order.driver_name}</strong>
                          </p>
                        )}
                        {order.packed_at && (
                          <p className="text-[11px] text-[var(--text-muted)] font-mono" suppressHydrationWarning>
                            Selesai dikemas {formatDuration(getElapsedSeconds(order.packed_at))} yang lalu
                          </p>
                        )}
                      </div>

                      {/* Manifest Produk yang Masuk di Order */}
                      <OrderItemsManifest
                        items={order.items}
                        isExpanded={!!expandedItems[order.id]}
                        onToggle={() => toggleExpandItems(order.id)}
                      />
                    </div>

                    <div className="pt-2 flex flex-col gap-2">
                      <button
                        onClick={() => openPickupModal(order)}
                        className="w-full py-2.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors flex items-center justify-center gap-1.5 shadow-xs"
                      >
                        <PackageCheck className="w-4 h-4" />
                        <span> Ambil Paket (Handover)</span>
                      </button>

                      {!isDriverWaiting && (
                        <button
                          onClick={() => {
                            setAssistOrder(order);
                            setAssistDriverName('');
                            setAssistCourier(order.courier_name || 'J&T Express');
                          }}
                          className="w-full py-1.5 px-3 rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50/50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 text-xs font-semibold hover:bg-amber-100 transition-colors flex items-center justify-center gap-1"
                        >
                          <UserCheck className="w-3.5 h-3.5" />
                          <span>Catat Check-in Saja</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ZONE 3: RECENTLY DISPATCHED & PHOTO AUDIT */}
        <div>
          <div className="flex items-center justify-between mb-3 px-1">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-purple-500" />
              <h2 className="text-sm font-bold text-purple-800 dark:text-purple-300 uppercase tracking-wider">
                Area 3: Riwayat Penyerahan & Bukti Foto ({dispatchedOrders.length})
              </h2>
            </div>
            <span className="text-xs text-[var(--text-muted)]">
              Foto bukti serah terima terstempel tanggal, jam, dan produk yang diserahkan
            </span>
          </div>

          {dispatchedOrders.length === 0 ? (
            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 text-center text-xs text-[var(--text-muted)]">
              Belum ada foto bukti serah terima paket terbaru.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {dispatchedOrders.map((order) => {
                const pt = order.pickup_transaction;
                return (
                  <div
                    key={order.id}
                    className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-3.5 shadow-sm flex flex-col justify-between gap-2.5 hover:border-[var(--border-strong)] transition-colors"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-xs text-[var(--text-primary)]">
                          {order.order_number}
                        </span>
                        <StatusBadge status="SHIP" />
                      </div>

                      {/* Thumbnail Preview */}
                      {pt?.photo_key && (
                        <div
                          onClick={() => inspectPhoto(order)}
                          className="relative aspect-video rounded-lg overflow-hidden border border-[var(--border-subtle)] bg-black cursor-pointer group"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={pt.photo_key}
                            alt="Preview Serah Terima"
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                          />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-xs font-semibold text-white gap-1">
                            <ZoomIn className="w-3.5 h-3.5" />
                            <span>Periksa Foto</span>
                          </div>
                        </div>
                      )}

                      <div className="text-xs text-[var(--text-secondary)] space-y-0.5">
                        <p>Driver: <span className="font-medium text-[var(--text-primary)]">{pt?.driver_name}</span></p>
                        <p>Ekspedisi: <span className="font-semibold text-purple-700 dark:text-purple-400">{pt?.courier_company}</span></p>
                        <p className="text-[11px] text-[var(--text-muted)] font-mono">
                          {formatWIB(pt?.picked_up_at)}
                        </p>
                      </div>

                      {/* Manifest Produk yang Masuk di Order */}
                      <OrderItemsManifest
                        items={order.items}
                        isExpanded={!!expandedItems[order.id]}
                        onToggle={() => toggleExpandItems(order.id)}
                      />
                    </div>

                    <button
                      onClick={() => inspectPhoto(order)}
                      className="w-full py-2 px-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:bg-[var(--bg-card-hover)] text-xs font-semibold text-[var(--text-primary)] flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <Search className="w-3.5 h-3.5" />
                      <span>Lihat Foto Penuh</span>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* MODAL 1:  AMBIL PAKET (HANDOVER) DENGAN MANIFEST PRODUK & FOTO */}
      {pickupModalOrder && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] max-w-2xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[92vh] my-auto">
            {/* Header */}
            <div className="p-4 sm:p-5 border-b border-[var(--border-subtle)] bg-[var(--bg-card)] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 flex items-center justify-center shrink-0">
                  <PackageCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[var(--text-primary)] flex items-center gap-2">
                    <span> Ambil & Serah Terima Paket</span>
                    <span className="px-2 py-0.5 rounded text-xs font-mono font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                      {pickupModalOrder.order_number}
                    </span>
                  </h3>
                  <p className="text-xs text-[var(--text-muted)] mt-0.5">
                    Verifikasi fisik barang, data kurir, dan ambil foto bukti serah terima resmi
                  </p>
                </div>
              </div>
              <button
                onClick={closePickupModal}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 sm:p-6 overflow-y-auto space-y-5 flex-1 text-xs">
              {/* Ringkasan Order */}
              <div className="p-3.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <span className="text-[var(--text-muted)] block text-[11px]">No. Order:</span>
                  <span className="font-mono font-bold text-[var(--text-primary)] text-sm">{pickupModalOrder.order_number}</span>
                </div>
                <div>
                  <span className="text-[var(--text-muted)] block text-[11px]">Nama Penerima:</span>
                  <span className="font-medium text-[var(--text-primary)]">{pickupModalOrder.customer_name || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-[var(--text-muted)] block text-[11px]">Ekspedisi Default:</span>
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">{pickupModalOrder.courier_name || 'General'}</span>
                </div>
                <div>
                  <span className="text-[var(--text-muted)] block text-[11px]">Status Paket:</span>
                  <span className="font-semibold text-emerald-700 dark:text-emerald-400">SIAP DIAMBIL</span>
                </div>
              </div>

              {/* DAFTAR PRODUK YANG MASUK DI ORDER INI */}
              <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] overflow-hidden">
                <div className="p-3 border-b border-[var(--border-subtle)] bg-[var(--bg-surface)] flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Package className="w-4 h-4 text-sky-500" />
                    <span className="font-bold text-[var(--text-primary)]">
                      Produk dalam Order ({pickupModalOrder.items?.length || 0} Item •{' '}
                      {pickupModalOrder.items?.reduce((s, i) => s + (i.quantity || 1), 0) || 0} Pcs)
                    </span>
                  </div>
                  <span className="text-[11px] text-[var(--text-muted)]">
                    Periksa isi fisik paket sebelum serah terima
                  </span>
                </div>

                <div className="max-h-48 overflow-y-auto divide-y divide-[var(--border-subtle)]">
                  {pickupModalOrder.items && pickupModalOrder.items.length > 0 ? (
                    pickupModalOrder.items.map((it, idx) => (
                      <div key={it.id || idx} className="p-3 flex items-center justify-between gap-3 hover:bg-[var(--bg-surface)]/50 transition-colors">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="w-5 h-5 rounded-full bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[10px] font-bold text-[var(--text-secondary)] flex items-center justify-center shrink-0">
                            {idx + 1}
                          </span>
                          <div className="min-w-0">
                            <p className="font-semibold text-[var(--text-primary)] truncate">{it.product_name}</p>
                            <div className="flex flex-wrap items-center gap-2 text-[10px] text-[var(--text-muted)] mt-0.5">
                              {it.sku && <span className="font-mono bg-[var(--bg-surface)] px-1.5 py-0.2 rounded border border-[var(--border-subtle)]">SKU: {it.sku}</span>}
                              {it.size && <span>Ukuran: <strong className="text-[var(--text-secondary)]">{it.size}</strong></span>}
                              {it.warna && <span>Warna: <strong className="text-[var(--text-secondary)]">{it.warna}</strong></span>}
                            </div>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-xs font-bold px-2.5 py-1 rounded-md bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                            {it.quantity} Pcs
                          </span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="p-4 text-center text-xs text-[var(--text-muted)]">
                      Tidak ada detail manifest barang untuk order ini.
                    </div>
                  )}
                </div>
              </div>

              {/* DATA KURIR PENERIMA */}
              <div className="p-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] space-y-3">
                <h4 className="font-bold text-[var(--text-primary)] flex items-center gap-2">
                  <Truck className="w-4 h-4 text-amber-500" />
                  <span>Data Kurir Pengambil Paket</span>
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[var(--text-primary)] mb-1">
                      Nama Kurir / Driver <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={pickupDriverName}
                      onChange={(e) => setPickupDriverName(e.target.value)}
                      placeholder="Contoh: Budi Santoso"
                      className="w-full px-3 py-2 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-xs focus:outline-none focus:border-[var(--accent-primary)] font-medium"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[var(--text-primary)] mb-1">
                      Perusahaan Ekspedisi
                    </label>
                    <div className="flex gap-2">
                      <select
                        value={pickupCourierCompany}
                        onChange={(e) => setPickupCourierCompany(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-xs focus:outline-none focus:border-[var(--accent-primary)] font-medium"
                      >
                        {COURIER_OPTIONS.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              {/* BUKTI FOTO SERAH TERIMA */}
              <div className="p-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-[var(--text-primary)] flex items-center gap-2">
                    <Camera className="w-4 h-4 text-emerald-500" />
                    <span>Bukti Foto Serah Terima (Watermarked)</span>
                    <span className="text-rose-500">*</span>
                  </h4>

                  {!capturedPhotoUrl && (
                    <div className="flex items-center gap-1 p-0.5 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)]">
                      <button
                        type="button"
                        onClick={() => {
                          setPhotoCaptureMode('CAMERA');
                          startCamera(facingMode).catch(console.warn);
                        }}
                        className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors ${
                          photoCaptureMode === 'CAMERA'
                            ? 'bg-[var(--accent-primary)] text-white'
                            : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                        }`}
                      >
                        Kamera Web
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setPhotoCaptureMode('UPLOAD');
                          stopCamera();
                        }}
                        className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors ${
                          photoCaptureMode === 'UPLOAD'
                            ? 'bg-[var(--accent-primary)] text-white'
                            : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                        }`}
                      >
                        Upload File
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setPhotoCaptureMode('BADGE');
                          stopCamera();
                        }}
                        className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors ${
                          photoCaptureMode === 'BADGE'
                            ? 'bg-[var(--accent-primary)] text-white'
                            : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                        }`}
                      >
                        Badge Digital
                      </button>
                    </div>
                  )}
                </div>

                {capturedPhotoUrl ? (
                  <div className="space-y-2">
                    <div className="relative aspect-video max-h-56 rounded-xl overflow-hidden border-2 border-emerald-500 bg-black mx-auto">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={capturedPhotoUrl}
                        alt="Foto Serah Terima"
                        className="w-full h-full object-contain"
                      />
                      <div className="absolute top-2 right-2 px-2 py-0.5 rounded bg-emerald-600 text-white font-bold text-[10px] flex items-center gap-1 shadow-md">
                        <Check className="w-3 h-3" />
                        <span>Foto Siap Diserahkan</span>
                      </div>
                    </div>

                    <div className="flex justify-center">
                      <button
                        type="button"
                        onClick={() => {
                          setCapturedPhotoUrl(null);
                          if (photoCaptureMode === 'CAMERA') {
                            startCamera(facingMode).catch(console.warn);
                          }
                        }}
                        className="px-3 py-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:bg-[var(--bg-card-hover)] text-xs font-semibold text-[var(--text-secondary)] flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <RefreshCw className="w-3 h-3" />
                        <span>Foto / Ganti Ulang</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    {photoCaptureMode === 'CAMERA' && (
                      <div className="space-y-3">
                        <div className="relative aspect-video max-h-56 rounded-xl overflow-hidden border border-[var(--border-subtle)] bg-slate-950 flex items-center justify-center mx-auto">
                          <video
                            ref={videoRef}
                            autoPlay
                            playsInline
                            muted
                            className="w-full h-full object-cover"
                          />
                          {!isReady && !cameraError && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center text-xs text-slate-400 gap-2 bg-slate-950/80">
                              <RefreshCw className="w-5 h-5 animate-spin text-emerald-500" />
                              <span>Menghubungkan ke sensor kamera...</span>
                            </div>
                          )}
                          {cameraError && (
                            <div className="absolute inset-0 p-4 flex flex-col items-center justify-center text-center text-xs text-rose-300 bg-slate-950/95 gap-2">
                              <AlertTriangle className="w-6 h-6 text-rose-500" />
                              <p>{cameraError}</p>
                              <div className="flex gap-2 mt-1">
                                <button
                                  type="button"
                                  onClick={() => startCamera(facingMode)}
                                  className="px-2.5 py-1 rounded bg-rose-600 text-white font-semibold"
                                >
                                  Coba Lagi
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setPhotoCaptureMode('BADGE')}
                                  className="px-2.5 py-1 rounded bg-emerald-600 text-white font-semibold"
                                >
                                  Gunakan Badge Digital
                                </button>
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="flex items-center justify-between gap-2">
                          <button
                            type="button"
                            onClick={flipCamera}
                            className="px-3 py-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-card-hover)] flex items-center gap-1.5"
                          >
                            <RotateCw className="w-3 h-3" />
                            <span>Balik ({facingMode === 'environment' ? 'Belakang' : 'Depan'})</span>
                          </button>

                          <button
                            type="button"
                            onClick={handleCaptureFromCamera}
                            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-2 shadow-sm transition-colors cursor-pointer"
                          >
                            <Camera className="w-4 h-4" />
                            <span>Ambil Foto Sekarang</span>
                          </button>
                        </div>
                      </div>
                    )}

                    {photoCaptureMode === 'UPLOAD' && (
                      <div className="p-6 rounded-xl border border-dashed border-[var(--border-subtle)] bg-[var(--bg-surface)] text-center space-y-3">
                        <UploadCloud className="w-8 h-8 text-[var(--text-muted)] mx-auto" />
                        <div>
                          <p className="font-semibold text-xs text-[var(--text-primary)]">
                            Unggah Foto Bukti Serah Terima
                          </p>
                          <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                            Pilih file JPG/PNG dari perangkat (watermark akan ditambahkan otomatis)
                          </p>
                        </div>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          onChange={handleFileUpload}
                          className="hidden"
                        />
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="px-4 py-2 rounded-lg bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white font-bold text-xs inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <UploadCloud className="w-3.5 h-3.5" />
                          <span>Pilih Foto dari Perangkat</span>
                        </button>
                      </div>
                    )}

                    {photoCaptureMode === 'BADGE' && (
                      <div className="p-5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-center space-y-3">
                        <FileCheck2 className="w-8 h-8 text-emerald-500 mx-auto" />
                        <div>
                          <p className="font-bold text-xs text-[var(--text-primary)]">
                            Generate Badge Digital Handover Resmi
                          </p>
                          <p className="text-[11px] text-[var(--text-muted)] mt-0.5 max-w-md mx-auto">
                            Cocok jika komputer loket admin tidak memiliki kamera fisik. Sistem akan membuat sertifikat bukti serah terima digital lengkap dengan detail paket & timestamp WIB.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={generateDigitalBadgePhoto}
                          className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs inline-flex items-center gap-2 shadow-xs transition-colors cursor-pointer"
                        >
                          <Sparkles className="w-4 h-4" />
                          <span>Buat Badge Digital Resmi</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Modal Actions */}
            <div className="p-4 border-t border-[var(--border-subtle)] bg-[var(--bg-card)] flex items-center justify-between">
              <button
                type="button"
                onClick={closePickupModal}
                className="py-2 px-4 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:bg-[var(--bg-card-hover)] text-xs font-semibold text-[var(--text-secondary)] transition-colors"
              >
                Batal
              </button>

              <button
                type="button"
                onClick={handleConfirmPickupSubmit}
                disabled={submittingPickup || !pickupDriverName.trim() || !capturedPhotoUrl}
                className="py-2.5 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs disabled:opacity-50 transition-colors flex items-center gap-2 shadow-xs cursor-pointer"
              >
                <PackageCheck className="w-4 h-4" />
                <span>{submittingPickup ? 'Menyerahkan Paket...' : 'Konfirmasi & Serah Terima Paket'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2:  CATAT KEDATANGAN KURIR (CHECK-IN) */}
      {assistOrder && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 max-w-md w-full shadow-lg space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border-subtle)]">
              <h3 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-amber-500" />
                <span> Catat Kedatangan Kurir</span>
              </h3>
              <button
                onClick={() => setAssistOrder(null)}
                className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
              Mencatat kedatangan kurir untuk order{' '}
              <span className="font-bold font-mono text-[var(--text-primary)]">
                {assistOrder.order_number}
              </span>
              . Ini akan mengaktifkan penghitung durasi tunggu dan menandai order pada layar TV status.
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-[var(--text-primary)] mb-1">
                  Nama Driver / Kurir <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={assistDriverName}
                  onChange={(e) => setAssistDriverName(e.target.value)}
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
                  value={assistCourier}
                  onChange={(e) => setAssistCourier(e.target.value)}
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
                onClick={() => setAssistOrder(null)}
                className="flex-1 py-2 px-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-card-hover)]"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleAssistSubmit}
                disabled={submittingAssist || !assistDriverName.trim()}
                className="flex-2 py-2 px-4 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs disabled:opacity-50 transition-colors"
              >
                {submittingAssist ? 'Menyimpan...' : 'Konfirmasi Kedatangan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: FULL-RESOLUTION PHOTO AUDIT & PRODUCT LIST */}
      {selectedPhotoAudit && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] max-w-3xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
            <div className="p-4 sm:p-5 border-b border-[var(--border-subtle)] flex items-center justify-between bg-[var(--bg-card)]">
              <div>
                <h3 className="text-sm sm:text-base font-bold text-[var(--text-primary)] flex items-center gap-2">
                  <ZoomIn className="w-4 h-4 text-[var(--accent-primary)]" />
                  <span>Inspeksi Bukti Foto Serah Terima</span>
                </h3>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">
                  Order <span className="font-mono font-bold text-[var(--text-primary)]">{selectedPhotoAudit.orderNumber}</span> • Driver: {selectedPhotoAudit.driverName} ({selectedPhotoAudit.courierCompany})
                </p>
              </div>
              <button
                onClick={() => setSelectedPhotoAudit(null)}
                className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4">
              <div className="rounded-xl overflow-hidden border border-[var(--border-subtle)] shadow-sm max-w-full bg-black flex items-center justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={selectedPhotoAudit.photoUrl}
                  alt="Bukti Foto Penuh"
                  className="max-h-[55vh] object-contain"
                />
              </div>

              <div className="w-full p-3.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div>
                  <span className="text-[var(--text-muted)] block">Waktu Serah Terima:</span>
                  <span className="font-semibold text-[var(--text-primary)]">{formatWIB(selectedPhotoAudit.pickedUpAt)}</span>
                </div>
                <div>
                  <span className="text-[var(--text-muted)] block">Ekspedisi:</span>
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">{selectedPhotoAudit.courierCompany}</span>
                </div>
                <div>
                  <span className="text-[var(--text-muted)] block">Nama Kurir:</span>
                  <span className="font-semibold text-[var(--text-primary)]">{selectedPhotoAudit.driverName}</span>
                </div>
                <div>
                  <span className="text-[var(--text-muted)] block">Durasi Menunggu:</span>
                  <span className="font-semibold text-[var(--accent-primary)]">
                    {formatDuration(selectedPhotoAudit.waitDurationSec)}
                  </span>
                </div>
              </div>

              {/* Produk yang diserahkan */}
              {selectedPhotoAudit.items && selectedPhotoAudit.items.length > 0 && (
                <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] p-3 space-y-2">
                  <span className="text-xs font-bold text-[var(--text-primary)] flex items-center gap-1.5">
                    <Package className="w-3.5 h-3.5 text-sky-500" />
                    <span>Daftar Produk yang Diserahkan ({selectedPhotoAudit.items.length} item)</span>
                  </span>
                  <div className="divide-y divide-[var(--border-subtle)] text-xs">
                    {selectedPhotoAudit.items.map((it, idx) => (
                      <div key={it.id || idx} className="py-1.5 flex items-center justify-between">
                        <div>
                          <p className="font-medium text-[var(--text-primary)]">{it.product_name}</p>
                          <div className="flex gap-2 text-[10px] text-[var(--text-muted)]">
                            {it.sku && <span>SKU: {it.sku}</span>}
                            {it.size && <span>Size: {it.size}</span>}
                            {it.warna && <span>Warna: {it.warna}</span>}
                          </div>
                        </div>
                        <span className="font-bold text-[var(--text-primary)]">{it.quantity}x</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-[var(--border-subtle)] bg-[var(--bg-card)] flex justify-end">
              <button
                onClick={() => setSelectedPhotoAudit(null)}
                className="py-2 px-4 rounded-lg bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white text-xs font-semibold transition-colors"
              >
                Tutup Inspeksi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: SUCCESS RECEIPT AFTER HANDOVER */}
      {pickupSuccessReceipt && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="rounded-2xl border border-emerald-500/30 bg-[var(--bg-surface)] p-6 max-w-md w-full shadow-2xl text-center space-y-4 animate-in zoom-in-95 duration-200">
            <div className="w-14 h-14 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div>
              <h3 className="text-base font-bold text-[var(--text-primary)]">
                Paket Berhasil Diserahterimakan!
              </h3>
              <p className="text-xs text-[var(--text-muted)] mt-1">
                Status pesanan telah diperbarui menjadi <strong className="text-emerald-600 dark:text-emerald-400">SHIP</strong> di seluruh sistem
              </p>
            </div>

            <div className="p-3.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] text-left text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-[var(--text-muted)]">No. Transaksi:</span>
                <span className="font-mono font-bold text-[var(--text-primary)]">{pickupSuccessReceipt.transaction_id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--text-muted)]">No. Order:</span>
                <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">{pickupSuccessReceipt.order_number}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--text-muted)]">Nama Kurir:</span>
                <span className="font-semibold text-[var(--text-primary)]">{pickupSuccessReceipt.driver_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--text-muted)]">Ekspedisi:</span>
                <span className="font-semibold text-[var(--text-primary)]">{pickupSuccessReceipt.courier_company}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--text-muted)]">Waktu Serah Terima:</span>
                <span className="font-mono text-[var(--text-secondary)]">{formatWIB(pickupSuccessReceipt.shipped_at)}</span>
              </div>
              {pickupSuccessReceipt.wait_duration_seconds !== null && pickupSuccessReceipt.wait_duration_seconds !== undefined && (
                <div className="flex justify-between">
                  <span className="text-[var(--text-muted)]">Durasi Tunggu Kurir:</span>
                  <span className="font-semibold text-[var(--accent-primary)]">{formatDuration(pickupSuccessReceipt.wait_duration_seconds)}</span>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => setPickupSuccessReceipt(null)}
              className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm transition-colors cursor-pointer"
            >
              Selesai & Tutup Resi
            </button>
          </div>
        </div>
      )}
    </StaffLayout>
  );
}
