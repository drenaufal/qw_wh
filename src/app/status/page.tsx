'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { Order } from '@/lib/types';
import { useSSE } from '@/hooks/use-sse';
import { formatWIB, formatDuration, getElapsedSeconds } from '@/lib/utils/datetime';
import { SSEStatusBeacon } from '@/components/ui';

export default function OverheadTVStatusPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentClock, setCurrentClock] = useState('');
  const [nowTimestamp, setNowTimestamp] = useState(0);
  const audioContextRef = useRef<AudioContext | null>(null);

  const { isConnected, subscribe } = useSSE();

  // Play D5 Chime using Web Audio API (587.33 Hz)
  const playChime = useCallback(() => {
    if (!soundEnabled) return;
    try {
      if (!audioContextRef.current) {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) {
          audioContextRef.current = new AudioCtx();
        }
      }
      const ctx = audioContextRef.current;
      if (!ctx) return;

      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime);

      gain.gain.setValueAtTime(0.18, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.85);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.9);
    } catch (e) {
      console.warn('Web Audio chime error:', e);
    }
  }, [soundEnabled]);

  const fetchOrders = useCallback(async () => {
    try {
      const res = await fetch('/api/orders?limit=150');
      if (res.ok) {
        const data = await res.json();
        setOrders(data.orders || []);
      }
    } catch (err) {
      console.error('Failed to fetch status board orders:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // Live timer interval (every second)
  useEffect(() => {
    setNowTimestamp(Date.now());
    setCurrentClock(formatWIB(new Date()));
    const timer = setInterval(() => {
      setNowTimestamp(Date.now());
      setCurrentClock(formatWIB(new Date()));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Subscribe to SSE updates
  useEffect(() => {
    const handleUpdate = () => {
      fetchOrders();
      playChime();
    };

    const unsubUpdate = subscribe('orderUpdate', handleUpdate);
    const unsubArrival = subscribe('driverArrival', handleUpdate);
    const unsubPacking = subscribe('packingStart', handleUpdate);
    const unsubComplete = subscribe('packingComplete', handleUpdate);
    const unsubShipped = subscribe('pickupShipped', handleUpdate);

    return () => {
      unsubUpdate();
      unsubArrival();
      unsubPacking();
      unsubComplete();
      unsubShipped();
    };
  }, [subscribe, fetchOrders, playChime]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(console.error);
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(console.error);
      setIsFullscreen(false);
    }
  };

  // Group columns
  const readyOrders = orders.filter((o) => o.status === 'READY_FOR_PICKUP');

  const driverWaitingOrders = orders
    .filter((o) => o.priority_status === 'DRIVER_WAITING' && o.status !== 'SHIP')
    .sort((a, b) => {
      const tA = a.driver_arrived_at ? new Date(a.driver_arrived_at).getTime() : 0;
      const tB = b.driver_arrived_at ? new Date(b.driver_arrived_at).getTime() : 0;
      return tA - tB;
    });

  const packingOrders = orders.filter((o) => o.status === 'PACKING');
  const waitingOrders = orders.filter((o) => o.status === 'WAITING' && o.priority_status === 'NORMAL');

  const shippedOrders = orders
    .filter((o) => o.status === 'SHIP')
    .sort((a, b) => {
      const tA = a.shipped_at ? new Date(a.shipped_at).getTime() : 0;
      const tB = b.shipped_at ? new Date(b.shipped_at).getTime() : 0;
      return tB - tA;
    })
    .slice(0, 15);

  return (
    <div className="min-h-screen bg-[#05070e] text-white flex flex-col justify-between overflow-x-hidden selection:bg-indigo-500 selection:text-white relative">
      {/* Background Spatial Nebula Gradients */}
      <div className="pointer-events-none fixed top-0 left-1/4 w-[600px] h-[400px] rounded-full bg-indigo-600/10 blur-[130px] -z-10" />
      <div className="pointer-events-none fixed bottom-0 right-1/4 w-[600px] h-[400px] rounded-full bg-cyan-600/10 blur-[130px] -z-10" />
      <div className="pointer-events-none fixed top-1/2 right-10 w-[400px] h-[400px] rounded-full bg-amber-600/10 blur-[140px] -z-10" />

      {/* Top TV Command HUD Header */}
      <header className="bg-[#0b1021]/80 backdrop-blur-2xl border-b border-white/[0.08] px-8 py-4 flex items-center justify-between sticky top-0 z-40 shadow-2xl">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-500/10 border border-indigo-400/40 flex items-center justify-center text-2xl shadow-[0_0_20px_rgba(99,102,241,0.35)]">
            📦
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl font-black tracking-tight text-white uppercase drop-shadow">
                Logistics Dispatch Board
              </h1>
              <span className="text-[10px] font-mono font-black px-2.5 py-0.5 rounded-full bg-gradient-to-r from-indigo-500/30 to-purple-500/30 text-indigo-300 border border-indigo-400/40 shadow-[0_0_12px_rgba(99,102,241,0.25)]">
                SPATIAL OVERHEAD KIOSK
              </span>
            </div>
            <p className="text-xs text-slate-400 font-mono tracking-wide mt-0.5">
              Real-Time Concurrency HUD • Asia/Jakarta (WIB)
            </p>
          </div>
        </div>

        {/* Live Controls and Status */}
        <div className="flex items-center gap-4">
          <div className="font-mono text-sm font-bold text-slate-200 glass-panel px-4 py-2 rounded-2xl border border-white/10 flex items-center gap-2.5 shadow-lg">
            <span className="text-indigo-400 animate-pulse">🕒</span>
            <span>{currentClock || 'WIB'}</span>
          </div>

          <SSEStatusBeacon isConnected={isConnected} />

          {/* Sound Toggle */}
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            title="Toggle Notification Chime"
            className={`px-3.5 py-2 rounded-2xl border text-xs font-bold flex items-center gap-2 transition-all ${
              soundEnabled
                ? 'bg-indigo-600/20 border-indigo-400/50 text-indigo-300 shadow-[0_0_15px_rgba(99,102,241,0.3)]'
                : 'bg-white/[0.04] border-white/10 text-slate-500'
            }`}
          >
            <span>{soundEnabled ? '🔔' : '🔕'}</span>
            <span>Chime {soundEnabled ? 'ON' : 'OFF'}</span>
          </button>

          {/* Fullscreen Toggle */}
          <button
            onClick={toggleFullscreen}
            className="px-3.5 py-2 rounded-2xl glass-btn text-xs font-bold text-slate-200 flex items-center gap-2"
          >
            <span>⛶</span>
            <span>{isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}</span>
          </button>

          <Link
            href="/"
            target="_blank"
            className="px-4 py-2 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs shadow-lg shadow-amber-500/25 transition-all"
          >
            Terminal ↗
          </Link>
        </div>
      </header>

      {/* 5-Column Live Kanban Layout with Antigravity Depth */}
      <main className="flex-1 p-6 grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-5 items-start">
        {/* COLUMN 1: READY FOR PICKUP (Emerald Green) */}
        <div className="bg-[#0b1021]/60 backdrop-blur-2xl rounded-3xl border border-emerald-500/30 flex flex-col h-[calc(100vh-140px)] shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden">
          <div className="p-4 bg-gradient-to-r from-emerald-950/40 via-[#0b1021] to-[#0b1021] border-b border-emerald-500/30 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
              <h2 className="text-xs font-black tracking-widest text-emerald-400 uppercase">
                1. Ready for Pickup
              </h2>
            </div>
            <span className="text-xs font-mono font-black px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-[0_0_12px_rgba(16,185,129,0.25)]">
              {readyOrders.length}
            </span>
          </div>

          <div className="flex-1 p-3.5 overflow-y-auto space-y-3">
            {readyOrders.length === 0 ? (
              <div className="h-44 flex flex-col items-center justify-center text-xs text-slate-500 text-center">
                <span className="text-2xl mb-1">🏷️</span>
                No orders ready on shelf
              </div>
            ) : (
              readyOrders.map((ord) => (
                <div
                  key={ord.id}
                  className="glass-panel border-emerald-500/30 rounded-2xl p-4 shadow-lg hover:border-emerald-400/70 hover:translate-y-[-2px] transition-all space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-black text-lg text-white drop-shadow">
                      {ord.order_number}
                    </span>
                    <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                      STAGED
                    </span>
                  </div>

                  <p className="text-xs text-slate-300">
                    Recipient: <span className="font-semibold text-white">{ord.customer_name || 'N/A'}</span>
                  </p>

                  <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-white/[0.06]">
                    <span className="text-emerald-400 font-bold">{ord.courier_name || 'General Fleet'}</span>
                    {ord.packed_at && (
                      <span className="font-mono text-[10px] text-slate-400">
                        Packed {formatDuration(getElapsedSeconds(ord.packed_at))} ago
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* COLUMN 2: DRIVER WAITING (Amber Yellow - Strict FIFO ASC & Sequence Badges) */}
        <div className="bg-[#0b1021]/80 backdrop-blur-2xl rounded-3xl border-2 border-amber-500/60 flex flex-col h-[calc(100vh-140px)] shadow-[0_25px_60px_rgba(245,158,11,0.25)] overflow-hidden ring-1 ring-amber-500/30">
          <div className="p-4 bg-gradient-to-r from-amber-950/60 via-[#0b1021] to-[#0b1021] border-b border-amber-500/40 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping" />
              <h2 className="text-xs font-black tracking-widest text-amber-400 uppercase">
                2. Driver Waiting (FIFO)
              </h2>
            </div>
            <span className="text-xs font-mono font-black px-2.5 py-0.5 rounded-full bg-amber-500/30 text-amber-300 border border-amber-500/60 shadow-[0_0_15px_rgba(245,158,11,0.35)]">
              {driverWaitingOrders.length}
            </span>
          </div>

          <div className="flex-1 p-3.5 overflow-y-auto space-y-3">
            {driverWaitingOrders.length === 0 ? (
              <div className="h-44 flex flex-col items-center justify-center text-xs text-slate-500 text-center">
                <span className="text-2xl mb-1">🙋‍♂️</span>
                No couriers currently waiting on dock
              </div>
            ) : (
              driverWaitingOrders.map((ord, idx) => {
                const elapsedSec = ord.driver_arrived_at
                  ? getElapsedSeconds(ord.driver_arrived_at)
                  : 0;
                return (
                  <div
                    key={ord.id}
                    className="bg-gradient-to-br from-amber-950/40 to-slate-900/90 border-2 border-amber-500/70 rounded-2xl p-4 shadow-xl space-y-2.5 glow-amber-3d transform hover:translate-y-[-3px] transition-all"
                  >
                    {/* Header with FIFO Sequence Badge */}
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-black px-2.5 py-0.5 rounded-lg bg-amber-400 text-slate-950 tracking-wider shadow-[0_0_12px_rgba(245,158,11,0.6)]">
                        NO. {idx + 1}
                      </span>
                      <span className="font-mono font-black text-lg text-white">
                        {ord.order_number}
                      </span>
                    </div>

                    {/* Driver details */}
                    <div className="text-xs space-y-0.5">
                      <p className="text-amber-200 font-bold">
                        Fleet: {ord.courier_name || 'General Fleet'}
                      </p>
                      {ord.driver_name && (
                        <p className="text-slate-300">Driver: {ord.driver_name}</p>
                      )}
                      <p className="text-slate-400 text-[11px]">
                        Customer: {ord.customer_name || 'N/A'}
                      </p>
                    </div>

                    {/* Live Elapsed Waiting Timer */}
                    <div className="pt-2 border-t border-amber-500/30 flex items-center justify-between">
                      <span className="text-[10px] uppercase font-mono font-bold text-amber-400">
                        Status: {ord.status}
                      </span>
                      <div className="font-mono text-xs font-black px-2.5 py-1 rounded-xl bg-amber-500/25 text-amber-300 border border-amber-500/50 shadow-inner">
                        ⏳ Wait: {formatDuration(elapsedSec)}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* COLUMN 3: IN PACKING (Cyan Blue) */}
        <div className="bg-[#0b1021]/60 backdrop-blur-2xl rounded-3xl border border-cyan-500/30 flex flex-col h-[calc(100vh-140px)] shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden">
          <div className="p-4 bg-gradient-to-r from-cyan-950/40 via-[#0b1021] to-[#0b1021] border-b border-cyan-500/30 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse" />
              <h2 className="text-xs font-black tracking-widest text-cyan-400 uppercase">
                3. In Packing
              </h2>
            </div>
            <span className="text-xs font-mono font-black px-2.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-[0_0_12px_rgba(6,182,212,0.25)]">
              {packingOrders.length}
            </span>
          </div>

          <div className="flex-1 p-3.5 overflow-y-auto space-y-3">
            {packingOrders.length === 0 ? (
              <div className="h-44 flex flex-col items-center justify-center text-xs text-slate-500 text-center">
                <span className="text-2xl mb-1">⚡</span>
                No orders actively packaging
              </div>
            ) : (
              packingOrders.map((ord) => (
                <div
                  key={ord.id}
                  className="glass-panel border-cyan-500/30 rounded-2xl p-4 shadow-lg hover:border-cyan-400/70 hover:translate-y-[-2px] transition-all space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-black text-lg text-white">
                      {ord.order_number}
                    </span>
                    <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                      PACKING
                    </span>
                  </div>

                  <p className="text-xs text-slate-300">
                    Recipient: <span className="font-semibold text-white">{ord.customer_name || 'N/A'}</span>
                  </p>

                  <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-white/[0.06]">
                    <span className="text-cyan-400 font-bold">{ord.courier_name || 'General Fleet'}</span>
                    {ord.packing_started_at && (
                      <span className="font-mono text-[10px] text-cyan-300">
                        Elapsed: {formatDuration(getElapsedSeconds(ord.packing_started_at))}
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* COLUMN 4: WAITING QUEUE (Slate Gray) */}
        <div className="bg-[#0b1021]/60 backdrop-blur-2xl rounded-3xl border border-slate-700/40 flex flex-col h-[calc(100vh-140px)] shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden">
          <div className="p-4 bg-gradient-to-r from-slate-900/40 via-[#0b1021] to-[#0b1021] border-b border-slate-700/40 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-500" />
              <h2 className="text-xs font-black tracking-widest text-slate-400 uppercase">
                4. Waiting Queue
              </h2>
            </div>
            <span className="text-xs font-mono font-black px-2.5 py-0.5 rounded-full bg-white/[0.06] text-slate-300 border border-white/10">
              {waitingOrders.length}
            </span>
          </div>

          <div className="flex-1 p-3.5 overflow-y-auto space-y-3">
            {waitingOrders.length === 0 ? (
              <div className="h-44 flex flex-col items-center justify-center text-xs text-slate-500 text-center">
                <span className="text-2xl mb-1">📦</span>
                Waiting queue is clear
              </div>
            ) : (
              waitingOrders.map((ord) => (
                <div
                  key={ord.id}
                  className="glass-panel border-white/[0.06] rounded-2xl p-3.5 shadow-sm space-y-1 hover:border-white/20 transition-all"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-sm text-slate-200">
                      {ord.order_number}
                    </span>
                    <span className="text-[9px] font-mono font-bold px-2 py-0.5 rounded-md bg-white/[0.06] text-slate-400">
                      QUEUED
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 truncate">
                    {ord.customer_name || 'N/A'} • {ord.courier_name || 'General Fleet'}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>

        {/* COLUMN 5: RECENTLY SHIPPED (Purple - Last 15 Dispatched) */}
        <div className="bg-[#0b1021]/60 backdrop-blur-2xl rounded-3xl border border-purple-500/30 flex flex-col h-[calc(100vh-140px)] shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden">
          <div className="p-4 bg-gradient-to-r from-purple-950/40 via-[#0b1021] to-[#0b1021] border-b border-purple-500/30 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-purple-400" />
              <h2 className="text-xs font-black tracking-widest text-purple-400 uppercase">
                5. Recently Shipped (15)
              </h2>
            </div>
            <span className="text-xs font-mono font-black px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-[0_0_12px_rgba(168,85,247,0.25)]">
              {shippedOrders.length}
            </span>
          </div>

          <div className="flex-1 p-3.5 overflow-y-auto space-y-3">
            {shippedOrders.length === 0 ? (
              <div className="h-44 flex flex-col items-center justify-center text-xs text-slate-500 text-center">
                <span className="text-2xl mb-1">🚚</span>
                No parcels dispatched yet
              </div>
            ) : (
              shippedOrders.map((ord) => (
                <div
                  key={ord.id}
                  className="glass-panel border-purple-500/30 rounded-2xl p-3.5 shadow-sm space-y-1.5 hover:border-purple-400/60 transition-all"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-sm text-purple-200">
                      {ord.order_number}
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                      SHIPPED ✓
                    </span>
                  </div>

                  <p className="text-xs text-slate-300">
                    Recipient: {ord.customer_name || 'N/A'}
                  </p>

                  <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1.5 border-t border-white/[0.06]">
                    <span className="text-purple-300 font-semibold">{ord.courier_name || 'General Fleet'}</span>
                    {ord.shipped_at && (
                      <span className="font-mono text-[10px]">
                        {formatWIB(ord.shipped_at).split(' ')[1]}
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </main>

      {/* Footer Ticker */}
      <footer className="bg-[#0b1021]/80 backdrop-blur-2xl border-t border-white/[0.08] px-8 py-3 flex items-center justify-between text-xs text-slate-400">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-2 text-emerald-400 font-bold">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Antigravity Telemetry Pipeline Active</span>
          </span>
          <span className="hidden sm:inline text-slate-600">|</span>
          <span className="hidden sm:inline">Automated Real-Time Status Updates for Logistics Staff</span>
        </div>

        <div className="font-mono text-xs text-slate-300">
          Total Tracked Orders: <span className="font-bold text-white">{orders.length}</span>
        </div>
      </footer>
    </div>
  );
}
