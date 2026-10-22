'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { StaffLayout } from '@/components/StaffLayout';
import { StatCard, StatusBadge, PriorityBadge, AntigravityCard } from '@/components/ui';
import { Order, DashboardStats } from '@/lib/types';
import { useSSE } from '@/hooks/use-sse';
import { formatWIB, formatDuration, getElapsedSeconds } from '@/lib/utils/datetime';

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
  const priorityOrders = recentOrders.filter(
    (o) => o.priority_status === 'DRIVER_WAITING' && o.status !== 'SHIP'
  );

  return (
    <StaffLayout
      title="Operations Command Matrix"
      subtitle="Antigravity spatial telemetry, live KPI indicators, and dynamic queue orchestration"
    >
      <div className="space-y-8">
        {/* 6 REAL-TIME FLOATING KPI CARDS */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <StatCard
            label="Orders Today"
            value={stats.total_orders_today}
            icon="📅"
            color="indigo"
          />
          <StatCard
            label="Waiting Queue"
            value={stats.waiting_count}
            icon="⏳"
            color="slate"
          />
          <StatCard
            label="In Packing"
            value={stats.packing_count}
            icon="📦"
            color="cyan"
          />
          <StatCard
            label="Ready for Pickup"
            value={stats.ready_count}
            icon="🏷️"
            color="emerald"
          />
          <StatCard
            label="Shipped Parcels"
            value={stats.shipped_count}
            icon="🚚"
            color="purple"
          />
          <StatCard
            label="Couriers Waiting"
            value={stats.driver_waiting_count}
            icon="🚨"
            color="amber"
          />
        </div>

        {/* QUICK SHORTCUTS WITH 3D TILT */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Link href="/packing" className="block">
            <AntigravityCard glowColor="rgba(6, 182, 212, 0.2)" className="h-full">
              <div className="p-5 flex items-center justify-between group">
                <div>
                  <p className="text-[10px] font-mono font-bold text-cyan-400 uppercase tracking-widest">
                    Workstation Bench
                  </p>
                  <h4 className="text-sm font-black text-white mt-0.5 group-hover:text-cyan-300 transition-colors">
                    Packer Station →
                  </h4>
                  <p className="text-[11px] text-[var(--text-muted)] mt-1">
                    SKU verification checklist
                  </p>
                </div>
                <div className="w-11 h-11 rounded-2xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-xl shadow-[0_0_15px_rgba(6,182,212,0.25)]">
                  ⚡
                </div>
              </div>
            </AntigravityCard>
          </Link>

          <Link href="/pickup-admin" className="block">
            <AntigravityCard glowColor="rgba(16, 185, 129, 0.2)" className="h-full">
              <div className="p-5 flex items-center justify-between group">
                <div>
                  <p className="text-[10px] font-mono font-bold text-emerald-400 uppercase tracking-widest">
                    Dock Bay Staging
                  </p>
                  <h4 className="text-sm font-black text-white mt-0.5 group-hover:text-emerald-300 transition-colors">
                    Pickup Admin →
                  </h4>
                  <p className="text-[11px] text-[var(--text-muted)] mt-1">
                    Staging & photo audit
                  </p>
                </div>
                <div className="w-11 h-11 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-xl shadow-[0_0_15px_rgba(16,185,129,0.25)]">
                  🚚
                </div>
              </div>
            </AntigravityCard>
          </Link>

          <Link href="/status" target="_blank" className="block">
            <AntigravityCard glowColor="rgba(99, 102, 241, 0.2)" className="h-full">
              <div className="p-5 flex items-center justify-between group">
                <div>
                  <p className="text-[10px] font-mono font-bold text-indigo-400 uppercase tracking-widest">
                    Overhead Screen
                  </p>
                  <h4 className="text-sm font-black text-white mt-0.5 group-hover:text-indigo-300 transition-colors">
                    Live TV Kanban ↗
                  </h4>
                  <p className="text-[11px] text-[var(--text-muted)] mt-1">
                    55&quot;-75&quot; wall display HUD
                  </p>
                </div>
                <div className="w-11 h-11 rounded-2xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-xl shadow-[0_0_15px_rgba(99,102,241,0.25)]">
                  📺
                </div>
              </div>
            </AntigravityCard>
          </Link>

          <Link href="/" target="_blank" className="block">
            <AntigravityCard glowColor="rgba(245, 158, 11, 0.2)" className="h-full">
              <div className="p-5 flex items-center justify-between group">
                <div>
                  <p className="text-[10px] font-mono font-bold text-amber-400 uppercase tracking-widest">
                    Driver Terminal
                  </p>
                  <h4 className="text-sm font-black text-white mt-0.5 group-hover:text-amber-300 transition-colors">
                    Self-Service Kiosk ↗
                  </h4>
                  <p className="text-[11px] text-[var(--text-muted)] mt-1">
                    Touch arrival & camera
                  </p>
                </div>
                <div className="w-11 h-11 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-xl shadow-[0_0_15px_rgba(245,158,11,0.25)]">
                  🙋‍♂️
                </div>
              </div>
            </AntigravityCard>
          </Link>
        </div>

        {/* PRIORITY ESCALATION ZONE */}
        {priorityOrders.length > 0 && (
          <div className="glass-panel border-2 border-amber-500/70 rounded-3xl p-6 shadow-2xl space-y-4 glow-amber-3d">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="w-3 h-3 rounded-full bg-amber-400 animate-ping" />
                <h3 className="text-base font-black text-amber-400 uppercase tracking-wider">
                  Active Priority Escalation: Couriers on Dock ({priorityOrders.length})
                </h3>
              </div>
              <span className="text-xs text-amber-300 font-mono font-bold bg-amber-500/20 px-3 py-1 rounded-full border border-amber-500/40">
                Dynamic Priority Engine Active
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {priorityOrders.map((order, idx) => {
                const waitSec = order.driver_arrived_at
                  ? getElapsedSeconds(order.driver_arrived_at)
                  : 0;

                return (
                  <div
                    key={order.id}
                    className="glass-panel border-amber-500/40 rounded-2xl p-4 shadow-lg flex items-center justify-between hover:translate-y-[-2px] transition-all"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-black px-2 py-0.5 rounded-lg bg-amber-400 text-slate-950">
                          #{idx + 1}
                        </span>
                        <span className="font-mono font-bold text-sm text-white">
                          {order.order_number}
                        </span>
                        <StatusBadge status={order.status} />
                      </div>
                      <p className="text-xs text-[var(--text-secondary)] mt-1.5">
                        Fleet: <span className="text-amber-400 font-bold">{order.courier_name}</span> • {order.customer_name}
                      </p>
                    </div>

                    <div className="font-mono text-xs font-black text-amber-300 bg-amber-500/20 border border-amber-500/40 px-3 py-1.5 rounded-xl shadow-inner">
                      ⏳ {formatDuration(waitSec)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* RECENT ORDERS REAL-TIME STREAM TABLE */}
        <div className="glass-panel rounded-3xl shadow-2xl overflow-hidden border border-[var(--border-subtle)]">
          <div className="p-6 bg-white/[0.02] border-b border-[var(--border-subtle)] flex items-center justify-between">
            <div>
              <h3 className="text-sm font-black text-white uppercase tracking-wider">
                Live Order Pipeline (Latest 20)
              </h3>
              <p className="text-xs text-[var(--text-muted)]">
                Server-Sent Events streaming from PostgreSQL database
              </p>
            </div>
            <Link
              href="/orders"
              className="text-xs font-bold text-indigo-400 hover:text-indigo-300 glass-btn px-3.5 py-1.5 rounded-xl"
            >
              View Full Archive →
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-white/[0.02] text-[var(--text-muted)] uppercase tracking-wider font-semibold border-b border-[var(--border-subtle)]">
                <tr>
                  <th className="px-6 py-4">Order Number</th>
                  <th className="px-6 py-4">Customer</th>
                  <th className="px-6 py-4">Fleet</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Priority</th>
                  <th className="px-6 py-4">SLA Metrics</th>
                  <th className="px-6 py-4 font-mono">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)] text-[var(--text-secondary)]">
                {recentOrders.map((ord) => (
                  <tr key={ord.id} className="hover:bg-white/[0.03] transition-colors">
                    <td className="px-6 py-4 font-mono font-bold text-white">
                      {ord.order_number}
                    </td>
                    <td className="px-6 py-4 text-white font-medium">{ord.customer_name || 'N/A'}</td>
                    <td className="px-6 py-4 text-cyan-400 font-semibold">
                      {ord.courier_name || 'General Fleet'}
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge status={ord.status} />
                    </td>
                    <td className="px-6 py-4">
                      <PriorityBadge priority={ord.priority_status} />
                    </td>
                    <td className="px-6 py-4 font-mono text-[11px]">
                      {ord.packing_duration_seconds !== null ? (
                        <span className="text-cyan-400 font-bold">
                          Pack: {formatDuration(ord.packing_duration_seconds)}
                        </span>
                      ) : ord.driver_wait_duration_seconds !== null ? (
                        <span className="text-amber-400 font-bold">
                          Wait: {formatDuration(ord.driver_wait_duration_seconds)}
                        </span>
                      ) : (
                        <span className="text-[var(--text-muted)]">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 font-mono text-[11px] text-[var(--text-muted)]">
                      {formatWIB(ord.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </StaffLayout>
  );
}
