'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { StaffLayout } from '@/components/StaffLayout';
import { StatCard, StatusBadge, PriorityBadge } from '@/components/ui';
import { Order, DashboardStats } from '@/lib/types';
import { useSSE } from '@/hooks/use-sse';
import { formatWIB, formatDuration, getElapsedSeconds } from '@/lib/utils/datetime';
import {
  ClipboardList,
  Clock,
  Package,
  PackageCheck,
  Truck,
  AlertTriangle,
  Zap,
  Tv,
  UserCheck,
} from 'lucide-react';

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats>({
    total_orders_today: 0,
    waiting_count: 0,
    packing_count: 0,
    ready_count: 0,
    shipped_count: 0,
    driver_waiting_count: 0,
  });
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [nowSec, setNowSec] = useState(0);

  const { subscribe } = useSSE();

  useEffect(() => {
    setNowSec(Date.now());
    const t = setInterval(() => setNowSec(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const fetchDashboardData = useCallback(async () => {
    try {
      const [statsRes, ordersRes] = await Promise.all([
        fetch('/api/dashboard/stats'),
        fetch('/api/orders?limit=20'),
      ]);

      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData.stats);
      }

      if (ordersRes.ok) {
        const ordersData = await ordersRes.json();
        setRecentOrders(ordersData.orders || []);
      }
    } catch (err) {
      console.error('Failed to fetch dashboard data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Real-time synchronization
  useEffect(() => {
    const handleUpdate = () => {
      fetchDashboardData();
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
  }, [subscribe, fetchDashboardData]);

  // Priority Escalation orders
  const priorityOrders = recentOrders
    .filter((o) => o.priority_status === 'DRIVER_WAITING' && o.status !== 'SHIP')
    .sort((a, b) => {
      if (a.queue_number && b.queue_number) {
        return a.queue_number - b.queue_number;
      }
      const tA = a.driver_arrived_at ? new Date(a.driver_arrived_at).getTime() : 0;
      const tB = b.driver_arrived_at ? new Date(b.driver_arrived_at).getTime() : 0;
      return tA - tB;
    });

  return (
    <StaffLayout
      title="Dashboard Operasional Gudang"
      subtitle="Pemantauan metrik antrian packing, barang siap pickup, dan eskalasi kurir tiba secara real-time"
    >
      <div className="space-y-6">
        {/* 6 Clean KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
          <StatCard
            label="Total Order Hari Ini"
            value={stats.total_orders_today}
            icon={<ClipboardList className="w-5 h-5 text-indigo-500" />}
          />
          <StatCard
            label="Antrian Menunggu"
            value={stats.waiting_count}
            icon={<Clock className="w-5 h-5 text-slate-400" />}
          />
          <StatCard
            label="Sedang Dipacking"
            value={stats.packing_count}
            icon={<Package className="w-5 h-5 text-sky-500" />}
          />
          <StatCard
            label="Siap Diambil Kurir"
            value={stats.ready_count}
            icon={<PackageCheck className="w-5 h-5 text-emerald-500" />}
          />
          <StatCard
            label="Telah Dikirim"
            value={stats.shipped_count}
            icon={<Truck className="w-5 h-5 text-purple-500" />}
          />
          <StatCard
            label="Kurir Menunggu"
            value={stats.driver_waiting_count}
            icon={<AlertTriangle className="w-5 h-5 text-amber-500" />}
          />
        </div>

        {/* Quick Action Station Shortcuts */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <Link
            href="/packing"
            className="p-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] hover:border-[var(--accent-primary)] hover:bg-[var(--bg-card-hover)] transition-all flex items-center justify-between group shadow-sm"
          >
            <div>
              <p className="text-[11px] font-semibold text-[var(--accent-primary)] uppercase tracking-wider">
                Stasiun Kerja
              </p>
              <h4 className="text-sm font-bold text-[var(--text-primary)] mt-0.5">
                Meja Packing →
              </h4>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">
                Verifikasi SKU barang & kemas
              </p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-subtle)] flex items-center justify-center">
              <Zap className="w-5 h-5 text-[var(--accent-primary)]" />
            </div>
          </Link>

          <Link
            href="/pickup-admin"
            className="p-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] hover:border-emerald-500 hover:bg-[var(--bg-card-hover)] transition-all flex items-center justify-between group shadow-sm"
          >
            <div>
              <p className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                Staging Area
              </p>
              <h4 className="text-sm font-bold text-[var(--text-primary)] mt-0.5">
                Loket Pickup Kurir →
              </h4>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">
                Serah terima & verifikasi foto
              </p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-subtle)] flex items-center justify-center">
              <Truck className="w-5 h-5 text-emerald-500" />
            </div>
          </Link>

          <Link
            href="/status"
            target="_blank"
            className="p-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] hover:border-blue-500 hover:bg-[var(--bg-card-hover)] transition-all flex items-center justify-between group shadow-sm"
          >
            <div>
              <p className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
                Layar Display
              </p>
              <h4 className="text-sm font-bold text-[var(--text-primary)] mt-0.5">
                Monitor TV Status ↗
              </h4>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">
                Tampilan antrian dinding gudang
              </p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-subtle)] flex items-center justify-center">
              <Tv className="w-5 h-5 text-blue-500" />
            </div>
          </Link>

          <Link
            href="/kiosk"
            target="_blank"
            className="p-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] hover:border-amber-500 hover:bg-[var(--bg-card-hover)] transition-all flex items-center justify-between group shadow-sm"
          >
            <div>
              <p className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
                Layar Sentuh Kurir
              </p>
              <h4 className="text-sm font-bold text-[var(--text-primary)] mt-0.5">
                Kiosk Driver ↗
              </h4>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">
                Check-in mandiri & foto bukti
              </p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-subtle)] flex items-center justify-center">
              <UserCheck className="w-5 h-5 text-amber-500" />
            </div>
          </Link>
        </div>

        {/* Priority Escalation Zone (Kurir Tiba di Loket) */}
        {priorityOrders.length > 0 && (
          <div className="p-4 sm:p-5 rounded-xl border-2 border-amber-500 bg-amber-50/60 dark:bg-amber-950/20 shadow-sm space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                <h3 className="text-sm font-bold text-amber-900 dark:text-amber-300 uppercase tracking-wider">
                  Prioritas Utama: Kurir Sedang Menunggu di Gudang ({priorityOrders.length})
                </h3>
              </div>
              <span className="text-xs text-amber-800 dark:text-amber-300 font-semibold bg-amber-100 dark:bg-amber-900/50 px-2.5 py-1 rounded-md border border-amber-300 dark:border-amber-700">
                Wajib Diprioritaskan
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {priorityOrders.map((order, idx) => {
                const waitSec = order.driver_arrived_at
                  ? getElapsedSeconds(order.driver_arrived_at)
                  : 0;

                return (
                  <div
                    key={order.id}
                    className="p-3.5 rounded-lg border border-amber-300 dark:border-amber-800 bg-[var(--bg-surface)] flex items-center justify-between gap-3 shadow-sm"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-bold px-1.5 py-0.5 rounded bg-amber-500 text-slate-950 font-mono">
                          #{order.queue_number ?? (idx + 1)}
                        </span>
                        <span className="font-mono font-bold text-sm text-[var(--text-primary)]">
                          {order.order_number}
                        </span>
                        <StatusBadge status={order.status} />
                      </div>
                      <p className="text-xs text-[var(--text-secondary)] mt-1">
                        Ekspedisi: <span className="font-semibold text-[var(--text-primary)]">{order.courier_name}</span> • {order.customer_name}
                      </p>
                    </div>

                    <div className="font-mono text-xs font-bold text-amber-800 dark:text-amber-300 bg-amber-100 dark:bg-amber-950 px-2.5 py-1 rounded border border-amber-300 dark:border-amber-800 shrink-0 flex items-center gap-1" suppressHydrationWarning>
                      <Clock className="w-3 h-3 text-amber-600" />
                      <span suppressHydrationWarning>{formatDuration(waitSec)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Live Orders Table */}
        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] shadow-sm overflow-hidden">
          <div className="p-4 border-b border-[var(--border-subtle)] flex items-center justify-between flex-wrap gap-2">
            <div>
              <h3 className="text-sm font-bold text-[var(--text-primary)]">
                Daftar Pesanan Terbaru (20 Terakhir)
              </h3>
              <p className="text-xs text-[var(--text-muted)]">
                Tersinkronisasi otomatis via Server-Sent Events (SSE)
              </p>
            </div>
            <Link
              href="/orders"
              className="text-xs font-semibold text-[var(--accent-primary)] hover:underline"
            >
              Lihat Seluruh Pesanan →
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[var(--bg-primary)] text-[var(--text-muted)] uppercase tracking-wider font-semibold border-b border-[var(--border-subtle)]">
                <tr>
                  <th className="px-4 py-3">Nomor Order</th>
                  <th className="px-4 py-3">Nama Penerima</th>
                  <th className="px-4 py-3">Ekspedisi / Armada</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Prioritas</th>
                  <th className="px-4 py-3">Durasi Waktu</th>
                  <th className="px-4 py-3 font-mono">Dibuat Pada</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)] text-[var(--text-secondary)]">
                {recentOrders.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-xs text-[var(--text-muted)]">
                      Belum ada data pesanan yang masuk.
                    </td>
                  </tr>
                ) : (
                  recentOrders.map((ord) => (
                    <tr key={ord.id} className="hover:bg-[var(--bg-card-hover)] transition-colors">
                      <td className="px-4 py-3 font-mono font-bold text-[var(--text-primary)]">
                        {ord.order_number}
                      </td>
                      <td className="px-4 py-3 text-[var(--text-primary)] font-medium">
                        {ord.customer_name || 'N/A'}
                      </td>
                      <td className="px-4 py-3 font-semibold text-[var(--text-secondary)]">
                        {ord.courier_name || 'General Fleet'}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={ord.status} />
                      </td>
                      <td className="px-4 py-3">
                        <PriorityBadge priority={ord.priority_status} />
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">
                        {ord.packing_duration_seconds !== null ? (
                          <span className="text-sky-600 dark:text-sky-400 font-semibold">
                            Kemas: {formatDuration(ord.packing_duration_seconds)}
                          </span>
                        ) : ord.driver_wait_duration_seconds !== null ? (
                          <span className="text-amber-600 dark:text-amber-400 font-semibold">
                            Menunggu: {formatDuration(ord.driver_wait_duration_seconds)}
                          </span>
                        ) : (
                          <span className="text-[var(--text-muted)]">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-[var(--text-muted)]">
                        {formatWIB(ord.created_at)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </StaffLayout>
  );
}
