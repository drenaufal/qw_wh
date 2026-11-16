'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { Order, TVAudioSettings } from '@/lib/types';
import { useSSE } from '@/hooks/use-sse';
import { formatWIB, formatDuration, getElapsedSeconds } from '@/lib/utils/datetime';
import { SSEStatusBeacon } from '@/components/ui';
import { playNotificationSound } from '@/lib/utils/audio';
import { TVAudioSettingsModal } from '@/components/TVAudioSettingsModal';
import {
  Tv,
  Settings2,
  Volume2,
  VolumeX,
  Clock,
  Maximize,
  Minimize,
  ExternalLink,
  X,
  EyeOff,
  PackageCheck,
  UserCheck,
  Box,
  Layers,
  Truck,
  Play,
  Bell,
} from 'lucide-react';

export default function OverheadTVStatusPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentClock, setCurrentClock] = useState('');
  const [nowTimestamp, setNowTimestamp] = useState(0);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsModalTab, setSettingsModalTab] = useState<'COLUMNS' | 'AUDIO'>('COLUMNS');
  const [isAdminAudioModalOpen, setIsAdminAudioModalOpen] = useState(false);

  const [tvAudioSettings, setTvAudioSettings] = useState<TVAudioSettings>({
    enabled: true,
    preset: 'airport',
    volume: 0.8,
    customAudioBase64: null,
    customAudioName: null,
    triggers: {
      driverArrival: true,
      packingComplete: false,
      orderUpdate: false,
    },
  });

  const tvAudioSettingsRef = useRef<TVAudioSettings>(tvAudioSettings);
  tvAudioSettingsRef.current = tvAudioSettings;

  const soundEnabledRef = useRef(soundEnabled);
  soundEnabledRef.current = soundEnabled;

  const lastSoundPlayedRef = useRef<number>(0);

  // Column visibility state with localStorage persistence
  const [visibleColumns, setVisibleColumns] = useState<{
    packing: boolean;
    ready: boolean;
    driver_waiting: boolean;
    shipped: boolean;
    waiting: boolean;
  }>({
    packing: true,
    ready: true,
    driver_waiting: true,
    shipped: true,
    waiting: false,
  });

  // Load preferences from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('wh_tv_column_settings_v2');
      if (saved) {
        const parsed = JSON.parse(saved);
        setVisibleColumns((prev) => ({ ...prev, ...parsed }));
      }
    } catch (e) {
      console.warn('Failed to load column settings:', e);
    }
  }, []);

  const toggleColumn = (key: keyof typeof visibleColumns) => {
    setVisibleColumns((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      try {
        localStorage.setItem('wh_tv_column_settings_v2', JSON.stringify(next));
      } catch (e) {
        console.warn('Failed to save column settings:', e);
      }
      return next;
    });
  };

  const setAllColumns = (val: boolean) => {
    const next = {
      packing: val,
      ready: val,
      driver_waiting: val,
      shipped: val,
      waiting: val,
    };
    setVisibleColumns(next);
    try {
      localStorage.setItem('wh_tv_column_settings_v2', JSON.stringify(next));
    } catch (e) {
      console.warn('Failed to save column settings:', e);
    }
  };

  const { isConnected, subscribe } = useSSE();

  // Load TV audio settings from backend on mount
  useEffect(() => {
    fetch('/api/settings/tv-audio')
      .then((res) => res.json())
      .then((data) => {
        if (data.settings) {
          setTvAudioSettings(data.settings);
          tvAudioSettingsRef.current = data.settings;
          setSoundEnabled(data.settings.enabled);
          soundEnabledRef.current = data.settings.enabled;
        }
      })
      .catch((err) => console.warn('Failed to load initial TV audio settings:', err));
  }, []);

  // Trigger notification sound based on configured preset, volume, and event trigger
  const triggerNotificationSound = useCallback(
    (eventType: 'driverArrival' | 'packingComplete' | 'orderUpdate', force = false) => {
      const currentSettings = tvAudioSettingsRef.current;
      const currentSoundEnabled = soundEnabledRef.current;

      if (!currentSoundEnabled || !currentSettings.enabled) return;
      if (!currentSettings.triggers[eventType]) return;

      const now = Date.now();
      // Cooldown 3.5 detik untuk mencegah spam audio berulang saat order update beruntun
      if (!force && now - lastSoundPlayedRef.current < 3500) {
        return;
      }

      lastSoundPlayedRef.current = now;
      playNotificationSound(currentSettings);
    },
    []
  );

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

  useEffect(() => {
    setNowTimestamp(Date.now());
    setCurrentClock(formatWIB(new Date()));
    const timer = setInterval(() => {
      setNowTimestamp(Date.now());
      setCurrentClock(formatWIB(new Date()));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // SSE real-time listener for orders and audio configuration updates
  useEffect(() => {
    // Real-time audio settings update pushed from Admin
    const unsubAudio = subscribe('tvAudioSettingsUpdate', (updated: TVAudioSettings) => {
      if (updated) {
        setTvAudioSettings(updated);
        tvAudioSettingsRef.current = updated;
        setSoundEnabled(updated.enabled);
        soundEnabledRef.current = updated.enabled;
      }
    });

    const handleDriverArrival = (order: any) => {
      fetchOrders();
      triggerNotificationSound('driverArrival');
    };

    const handlePackingComplete = (order: any) => {
      fetchOrders();
      triggerNotificationSound('packingComplete');
    };

    const handleGeneralUpdate = (order: any) => {
      fetchOrders();
      // Jika order memiliki status Kurir Menunggu, bunyikan trigger driverArrival
      if (order?.priority_status === 'DRIVER_WAITING') {
        triggerNotificationSound('driverArrival');
      } else {
        // Pembaruan order reguler hanya memicu suara jika orderUpdate diaktifkan di pengaturan
        triggerNotificationSound('orderUpdate');
      }
    };

    const unsubUpdate = subscribe('orderUpdate', handleGeneralUpdate);
    const unsubArrival = subscribe('driverArrival', handleDriverArrival);
    const unsubPacking = subscribe('packingStart', (order: any) => {
      fetchOrders();
      if (order?.priority_status === 'DRIVER_WAITING') {
        triggerNotificationSound('driverArrival');
      } else {
        triggerNotificationSound('orderUpdate');
      }
    });
    const unsubComplete = subscribe('packingComplete', handlePackingComplete);
    const unsubShipped = subscribe('pickupShipped', () => {
      fetchOrders();
      triggerNotificationSound('orderUpdate');
    });

    return () => {
      unsubAudio();
      unsubUpdate();
      unsubArrival();
      unsubPacking();
      unsubComplete();
      unsubShipped();
    };
  }, [subscribe, fetchOrders, triggerNotificationSound]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(console.error);
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(console.error);
      setIsFullscreen(false);
    }
  };

  const readyOrders = orders.filter((o) => o.status === 'READY_FOR_PICKUP');

  const driverWaitingOrders = orders
    .filter((o) => o.priority_status === 'DRIVER_WAITING' && o.status !== 'SHIP')
    .sort((a, b) => {
      if (a.queue_number && b.queue_number) {
        return a.queue_number - b.queue_number;
      }
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

  const activeCount = Object.values(visibleColumns).filter(Boolean).length;

  const getGridColsClass = () => {
    switch (activeCount) {
      case 5:
        return 'grid-cols-1 md:grid-cols-3 lg:grid-cols-5';
      case 4:
        return 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4';
      case 3:
        return 'grid-cols-1 md:grid-cols-3 lg:grid-cols-3';
      case 2:
        return 'grid-cols-1 md:grid-cols-2 lg:grid-cols-2';
      case 1:
        return 'grid-cols-1 max-w-3xl mx-auto w-full';
      default:
        return 'grid-cols-1';
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] flex flex-col justify-between p-4 gap-4">
      {/* Top TV Command Header */}
      <header className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-6 py-3.5 flex items-center justify-between shadow-sm sticky top-2 z-40">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-lg bg-[var(--accent-primary)] text-white flex items-center justify-center shadow-sm">
            <Tv className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-base sm:text-lg font-bold tracking-tight text-[var(--text-primary)] uppercase">
                Monitor Antrian & Dispatch Gudang
              </h1>
              <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded bg-[var(--bg-primary)] text-[var(--text-secondary)] border border-[var(--border-subtle)]">
                OVERHEAD DISPLAY
              </span>
            </div>
            <p className="text-xs text-[var(--text-muted)] font-mono">
              Live Stream Antrian Real-time • WIB Asia/Jakarta
            </p>
          </div>
        </div>

        {/* Live Controls */}
        <div className="flex items-center gap-2.5 sm:gap-3 flex-wrap">
          {/* Column Display Settings Button */}
          <button
            onClick={() => setIsSettingsOpen(true)}
            title="Atur Tampilan Kolom Status"
            className={`px-3 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition-colors ${
              activeCount < 5
                ? 'border-amber-400 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300'
                : 'border-[var(--border-subtle)] bg-[var(--bg-card)] text-[var(--text-secondary)] hover:bg-[var(--bg-card-hover)]'
            }`}
          >
            <Settings2 className="w-3.5 h-3.5" />
            <span>Kolom ({activeCount}/5)</span>
          </button>

          {/* Sound Toggle */}
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            title="Aktifkan / Matikan Notifikasi Suara"
            className="px-3 py-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-card-hover)] flex items-center gap-1.5"
          >
            {soundEnabled ? <Volume2 className="w-3.5 h-3.5 text-emerald-500" /> : <VolumeX className="w-3.5 h-3.5 text-slate-400" />}
            <span>Audio: {soundEnabled ? 'ON' : 'OFF'}</span>
          </button>

          {/* Clock */}
          <div className="font-mono text-xs sm:text-sm font-semibold text-[var(--text-primary)] border border-[var(--border-subtle)] bg-[var(--bg-card)] px-3 py-1.5 rounded-lg flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-[var(--text-muted)]" />
            <span>{currentClock || 'WIB'}</span>
          </div>

          <SSEStatusBeacon isConnected={isConnected} />

          {/* Fullscreen Toggle */}
          <button
            onClick={toggleFullscreen}
            className="px-3 py-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-card-hover)] flex items-center gap-1.5"
          >
            {isFullscreen ? <Minimize className="w-3.5 h-3.5" /> : <Maximize className="w-3.5 h-3.5" />}
            <span>{isFullscreen ? 'Keluar' : 'Fullscreen'}</span>
          </button>

          <Link
            href="/"
            target="_blank"
            className="px-3.5 py-1.5 rounded-lg bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white font-bold text-xs transition-colors flex items-center gap-1"
          >
            <span>Kiosk Driver</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </Link>
        </div>
      </header>

      {/* Settings Modal */}
      {isSettingsOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
          onClick={() => setIsSettingsOpen(false)}
        >
          <div
            className="w-full max-w-lg rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] shadow-2xl p-6 space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border-subtle)]">
              <div>
                <h3 className="text-base font-bold text-[var(--text-primary)] flex items-center gap-2">
                  <Settings2 className="w-4 h-4 text-[var(--accent-primary)]" />
                  <span>Pengaturan Monitor TV</span>
                </h3>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">
                  Sesuaikan tampilan kolom antrian dan pantau konfigurasi audio speaker TV.
                </p>
              </div>
              <button
                onClick={() => setIsSettingsOpen(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card)] transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Tabs */}
            <div className="flex items-center gap-1 p-1 bg-[var(--bg-card)] rounded-xl border border-[var(--border-subtle)]">
              <button
                type="button"
                onClick={() => setSettingsModalTab('COLUMNS')}
                className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                  settingsModalTab === 'COLUMNS'
                    ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-xs'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Kolom Tampilan</span>
              </button>
              <button
                type="button"
                onClick={() => setSettingsModalTab('AUDIO')}
                className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                  settingsModalTab === 'AUDIO'
                    ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-xs'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                }`}
              >
                <Volume2 className="w-3.5 h-3.5" />
                <span>Suara & Audio TV</span>
              </button>
            </div>

            {settingsModalTab === 'COLUMNS' ? (
              <div className="space-y-2.5">
                {/* 1. Packing */}
                <label
                  className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer ${
                    visibleColumns.packing
                      ? 'border-sky-300 dark:border-sky-800 bg-sky-50/50 dark:bg-sky-950/20'
                      : 'border-[var(--border-subtle)] bg-[var(--bg-card)] opacity-60'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="w-3.5 h-3.5 rounded-full bg-sky-500 shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-[var(--text-primary)]">
                        1. Sedang Packing (In Process)
                      </p>
                      <p className="text-xs text-[var(--text-muted)]">
                        Pesanan yang sedang dikemas oleh tim picker/packer • {packingOrders.length} antrian
                      </p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={visibleColumns.packing}
                    onChange={() => toggleColumn('packing')}
                    className="w-5 h-5 rounded accent-sky-600 cursor-pointer"
                  />
                </label>

                {/* 2. Ready for Pickup */}
                <label
                  className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer ${
                    visibleColumns.ready
                      ? 'border-emerald-300 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20'
                      : 'border-[var(--border-subtle)] bg-[var(--bg-card)] opacity-60'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="w-3.5 h-3.5 rounded-full bg-emerald-500 shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-[var(--text-primary)]">
                        2. Siap Diambil (Ready for Pickup)
                      </p>
                      <p className="text-xs text-[var(--text-muted)]">
                        Paket yang sudah dikemas dan menunggu kurir di staging • {readyOrders.length} antrian
                      </p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={visibleColumns.ready}
                    onChange={() => toggleColumn('ready')}
                    className="w-5 h-5 rounded accent-emerald-600 cursor-pointer"
                  />
                </label>

                {/* 3. Driver Waiting */}
                <label
                  className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer ${
                    visibleColumns.driver_waiting
                      ? 'border-amber-300 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20'
                      : 'border-[var(--border-subtle)] bg-[var(--bg-card)] opacity-60'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="w-3.5 h-3.5 rounded-full bg-amber-500 shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-[var(--text-primary)]">
                        3. Kurir Menunggu (Driver Waiting)
                      </p>
                      <p className="text-xs text-[var(--text-muted)]">
                        Prioritas kurir fisik yang sudah check-in di kiosk • {driverWaitingOrders.length} antrian
                      </p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={visibleColumns.driver_waiting}
                    onChange={() => toggleColumn('driver_waiting')}
                    className="w-5 h-5 rounded accent-amber-600 cursor-pointer"
                  />
                </label>

                {/* 4. Shipped */}
                <label
                  className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer ${
                    visibleColumns.shipped
                      ? 'border-purple-300 dark:border-purple-800 bg-purple-50/50 dark:bg-purple-950/20'
                      : 'border-[var(--border-subtle)] bg-[var(--bg-card)] opacity-60'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="w-3.5 h-3.5 rounded-full bg-purple-500 shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-[var(--text-primary)]">
                        4. Telah Dikirim (Recently Shipped)
                      </p>
                      <p className="text-xs text-[var(--text-muted)]">
                        Riwayat paket yang sudah diserahterimakan ke kurir • {shippedOrders.length} riwayat
                      </p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={visibleColumns.shipped}
                    onChange={() => toggleColumn('shipped')}
                    className="w-5 h-5 rounded accent-purple-600 cursor-pointer"
                  />
                </label>

                {/* 5. Waiting Queue (Optional) */}
                <label
                  className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer ${
                    visibleColumns.waiting
                      ? 'border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/30'
                      : 'border-[var(--border-subtle)] bg-[var(--bg-card)] opacity-60'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="w-3.5 h-3.5 rounded-full bg-slate-400 shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-[var(--text-primary)]">
                        5. Antrian Menunggu (Waiting Queue)
                      </p>
                      <p className="text-xs text-[var(--text-muted)]">
                        Daftar antrian urutan FIFO yang belum mulai diproses • {waitingOrders.length} antrian
                      </p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={visibleColumns.waiting}
                    onChange={() => toggleColumn('waiting')}
                    className="w-5 h-5 rounded accent-slate-600 cursor-pointer"
                  />
                </label>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="p-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-[var(--text-secondary)]">
                      Preset Suara Aktif
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20 uppercase">
                      {tvAudioSettings.preset}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-[var(--text-secondary)]">
                      Status Audio
                    </span>
                    <span className="text-xs font-bold text-[var(--text-primary)]">
                      {tvAudioSettings.enabled && soundEnabled ? 'Aktif (Membunyikan Bel)' : 'Mute / Dinonaktifkan'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-[var(--text-secondary)]">
                      Tingkat Volume Speaker
                    </span>
                    <span className="text-xs font-mono font-bold text-[var(--text-primary)]">
                      {Math.round(tvAudioSettings.volume * 100)}%
                    </span>
                  </div>

                  {tvAudioSettings.customAudioName && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-[var(--text-secondary)]">
                        File Audio Kustom
                      </span>
                      <span className="text-xs font-mono truncate max-w-[180px] text-[var(--text-primary)]">
                        {tvAudioSettings.customAudioName}
                      </span>
                    </div>
                  )}

                  <div className="pt-2 border-t border-[var(--border-subtle)] space-y-1.5">
                    <span className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider block">
                      Pemicu Suara Otomatis
                    </span>
                    <div className="grid grid-cols-1 gap-1 text-xs text-[var(--text-secondary)]">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${tvAudioSettings.triggers.driverArrival ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                        <span>Kurir Tiba / Check-in Mandiri: {tvAudioSettings.triggers.driverArrival ? 'ON' : 'OFF'}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${tvAudioSettings.triggers.packingComplete ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                        <span>Pesanan Siap Diambil di Rak: {tvAudioSettings.triggers.packingComplete ? 'ON' : 'OFF'}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${tvAudioSettings.triggers.orderUpdate ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                        <span>Pembaruan Antrian Umum: {tvAudioSettings.triggers.orderUpdate ? 'ON' : 'OFF'}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => playNotificationSound(tvAudioSettings)}
                    className="flex-1 py-2 px-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] hover:bg-[var(--bg-card-hover)] text-xs font-semibold text-[var(--text-primary)] flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <Play className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                    <span>Uji Suara di TV</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsSettingsOpen(false);
                      setIsAdminAudioModalOpen(true);
                    }}
                    className="flex-1 py-2 px-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-900 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors shadow-xs"
                  >
                    <Settings2 className="w-3.5 h-3.5" />
                    <span>Ubah Konfigurasi (Admin)</span>
                  </button>
                </div>
              </div>
            )}

            {/* Modal Actions */}
            <div className="flex items-center justify-between pt-3 border-t border-[var(--border-subtle)]">
              {settingsModalTab === 'COLUMNS' ? (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setAllColumns(true)}
                    className="text-xs font-semibold text-[var(--accent-primary)] hover:underline"
                  >
                    Tampilkan Semua
                  </button>
                  <span className="text-[var(--text-muted)] text-xs">•</span>
                  <button
                    type="button"
                    onClick={() => setAllColumns(false)}
                    className="text-xs font-semibold text-[var(--text-muted)] hover:underline"
                  >
                    Sembunyikan Semua
                  </button>
                </div>
              ) : (
                <p className="text-[11px] text-[var(--text-muted)]">
                  Sinkronisasi audio diperbarui otomatis tanpa reload via SSE
                </p>
              )}

              <button
                type="button"
                onClick={() => setIsSettingsOpen(false)}
                className="px-4 py-2 rounded-lg bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white text-xs font-bold transition-colors"
              >
                Selesai
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dynamic Kanban Board */}
      {activeCount === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] my-4">
          <EyeOff className="w-12 h-12 text-[var(--text-muted)] mb-3" />
          <h3 className="text-base font-bold text-[var(--text-primary)] mb-1">
            Semua Kolom Status Dinonaktifkan
          </h3>
          <p className="text-xs text-[var(--text-muted)] max-w-sm mb-4">
            Anda telah menyembunyikan semua kolom status antrian monitor. Aktifkan kembali kolom yang ingin Anda pantau.
          </p>
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="px-4 py-2 rounded-lg bg-[var(--accent-primary)] text-white font-bold text-xs hover:bg-[var(--accent-hover)] transition-colors flex items-center gap-1.5"
          >
            <Settings2 className="w-3.5 h-3.5" />
            <span>Buka Pengaturan Kolom</span>
          </button>
        </div>
      ) : (
        <main className={`flex-1 grid ${getGridColsClass()} gap-3.5 items-start`}>
          {/* COLUMN 1: IN PACKING (Sky Blue) */}
          {visibleColumns.packing && (
            <div className="rounded-xl border border-sky-300 dark:border-sky-800 bg-[var(--bg-surface)] flex flex-col h-[calc(100vh-140px)] shadow-sm overflow-hidden">
              <div className="p-3.5 bg-sky-50 dark:bg-sky-950/40 border-b border-sky-200 dark:border-sky-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-sky-500" />
                  <h2 className="text-xs font-bold text-sky-800 dark:text-sky-300 uppercase tracking-wider">
                    1. Sedang Packing ({packingOrders.length})
                  </h2>
                </div>
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-sky-100 dark:bg-sky-900 text-sky-800 dark:text-sky-200">
                  PROSES
                </span>
              </div>

              <div className="flex-1 p-3 overflow-y-auto space-y-2.5">
                {packingOrders.length === 0 ? (
                  <div className="h-32 flex flex-col items-center justify-center text-xs text-[var(--text-muted)] text-center">
                    <Box className="w-8 h-8 text-sky-500/40 mb-1.5" />
                    Tidak ada pesanan sedang dikemas
                  </div>
                ) : (
                  packingOrders.map((ord) => (
                    <div
                      key={ord.id}
                      className="p-3 rounded-lg border border-sky-200 dark:border-sky-900 bg-[var(--bg-card)] shadow-xs space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-base text-[var(--text-primary)]">
                          {ord.order_number}
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800">
                          PACKING
                        </span>
                      </div>

                      <p className="text-xs text-[var(--text-secondary)]">
                        Penerima: <span className="font-medium text-[var(--text-primary)]">{ord.customer_name || 'N/A'}</span>
                      </p>

                      <div className="flex items-center justify-between text-xs text-[var(--text-muted)] pt-1.5 border-t border-[var(--border-subtle)]">
                        <span className="text-sky-600 dark:text-sky-400 font-semibold">{ord.courier_name || 'General Fleet'}</span>
                        {ord.packing_started_at && (
                          <span className="font-mono text-[11px] flex items-center gap-1" suppressHydrationWarning>
                            <Clock className="w-3 h-3 text-[var(--text-muted)]" />
                            <span suppressHydrationWarning>{formatDuration(getElapsedSeconds(ord.packing_started_at))}</span>
                          </span>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* COLUMN 2: READY FOR PICKUP (Emerald) */}
          {visibleColumns.ready && (
            <div className="rounded-xl border border-emerald-300 dark:border-emerald-800 bg-[var(--bg-surface)] flex flex-col h-[calc(100vh-140px)] shadow-sm overflow-hidden">
              <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/40 border-b border-emerald-200 dark:border-emerald-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  <h2 className="text-xs font-bold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider">
                    2. Siap Diambil ({readyOrders.length})
                  </h2>
                </div>
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200">
                  STAGING
                </span>
              </div>

              <div className="flex-1 p-3 overflow-y-auto space-y-2.5">
                {readyOrders.length === 0 ? (
                  <div className="h-32 flex flex-col items-center justify-center text-xs text-[var(--text-muted)] text-center">
                    <PackageCheck className="w-8 h-8 text-emerald-500/40 mb-1.5" />
                    Belum ada paket di rak staging
                  </div>
                ) : (
                  readyOrders.map((ord) => (
                    <div
                      key={ord.id}
                      className="p-3 rounded-lg border border-emerald-200 dark:border-emerald-900 bg-[var(--bg-card)] shadow-xs space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-base text-[var(--text-primary)]">
                          {ord.order_number}
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                          SIAP
                        </span>
                      </div>

                      <p className="text-xs text-[var(--text-secondary)]">
                        Penerima: <span className="font-medium text-[var(--text-primary)]">{ord.customer_name || 'N/A'}</span>
                      </p>

                      <div className="flex items-center justify-between text-xs text-[var(--text-muted)] pt-1.5 border-t border-[var(--border-subtle)]">
                        <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{ord.courier_name || 'General Fleet'}</span>
                        {ord.packed_at && (
                          <span className="font-mono text-[11px] flex items-center gap-1" suppressHydrationWarning>
                            <Clock className="w-3 h-3 text-[var(--text-muted)]" />
                            <span suppressHydrationWarning>{formatDuration(getElapsedSeconds(ord.packed_at))} lalu</span>
                          </span>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* COLUMN 3: DRIVER WAITING (Amber - Strict FIFO) */}
          {visibleColumns.driver_waiting && (
            <div className="rounded-xl border-2 border-amber-400 dark:border-amber-600 bg-[var(--bg-surface)] flex flex-col h-[calc(100vh-140px)] shadow-sm overflow-hidden">
              <div className="p-3.5 bg-amber-50 dark:bg-amber-950/40 border-b border-amber-300 dark:border-amber-700 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                  <h2 className="text-xs font-bold text-amber-900 dark:text-amber-300 uppercase tracking-wider">
                    3. Kurir Menunggu ({driverWaitingOrders.length})
                  </h2>
                </div>
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-200">
                  PRIORITAS
                </span>
              </div>

              <div className="flex-1 p-3 overflow-y-auto space-y-2.5">
                {driverWaitingOrders.length === 0 ? (
                  <div className="h-32 flex flex-col items-center justify-center text-xs text-[var(--text-muted)] text-center">
                    <UserCheck className="w-8 h-8 text-amber-500/40 mb-1.5" />
                    Tidak ada kurir menunggu
                  </div>
                ) : (
                  driverWaitingOrders.map((ord, idx) => {
                    const elapsedSec = ord.driver_arrived_at
                      ? getElapsedSeconds(ord.driver_arrived_at)
                      : 0;
                    return (
                      <div
                        key={ord.id}
                        className="p-3 rounded-lg border border-amber-300 dark:border-amber-800 bg-[var(--bg-card)] shadow-xs space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-amber-500 text-slate-950">
                            #{String(ord.queue_number ?? (idx + 1)).padStart(2, '0')}
                          </span>
                          <span className="font-mono font-bold text-base text-[var(--text-primary)]">
                            {ord.order_number}
                          </span>
                        </div>

                        <div className="text-xs space-y-0.5">
                          <p className="text-amber-800 dark:text-amber-300 font-semibold">
                            Ekspedisi: {ord.courier_name || 'General Fleet'}
                          </p>
                          {ord.driver_name && (
                            <p className="text-[var(--text-secondary)]">Driver: {ord.driver_name}</p>
                          )}
                          <p className="text-[var(--text-muted)] text-[11px]">
                            Penerima: {ord.customer_name || 'N/A'}
                          </p>
                        </div>

                        <div className="pt-1.5 border-t border-[var(--border-subtle)] flex items-center justify-between">
                          <span className="text-[11px] font-semibold text-[var(--text-muted)]">
                            Status: {ord.status}
                          </span>
                          <div className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800 flex items-center gap-1" suppressHydrationWarning>
                            <Clock className="w-3 h-3 text-amber-600" />
                            <span suppressHydrationWarning>{formatDuration(elapsedSec)}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* COLUMN 4: RECENTLY SHIPPED (Purple) */}
          {visibleColumns.shipped && (
            <div className="rounded-xl border border-purple-200 dark:border-purple-900 bg-[var(--bg-surface)] flex flex-col h-[calc(100vh-140px)] shadow-sm overflow-hidden">
              <div className="p-3.5 bg-purple-50 dark:bg-purple-950/40 border-b border-purple-200 dark:border-purple-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-purple-500" />
                  <h2 className="text-xs font-bold text-purple-800 dark:text-purple-300 uppercase tracking-wider">
                    4. Telah Dikirim ({shippedOrders.length})
                  </h2>
                </div>
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200">
                  DISPATCHED
                </span>
              </div>

              <div className="flex-1 p-3 overflow-y-auto space-y-2">
                {shippedOrders.length === 0 ? (
                  <div className="h-32 flex flex-col items-center justify-center text-xs text-[var(--text-muted)] text-center">
                    <Truck className="w-8 h-8 text-purple-500/40 mb-1.5" />
                    Belum ada paket dikirim
                  </div>
                ) : (
                  shippedOrders.map((ord) => (
                    <div
                      key={ord.id}
                      className="p-2.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] shadow-xs space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-semibold text-xs text-[var(--text-primary)]">
                          {ord.order_number}
                        </span>
                        <span className="text-[10px] font-bold text-purple-700 dark:text-purple-400">
                          SHIP
                        </span>
                      </div>
                      <p className="text-xs text-[var(--text-secondary)] truncate">
                        {ord.courier_name} • {ord.customer_name}
                      </p>
                      {ord.shipped_at && (
                        <p className="text-[10px] font-mono text-[var(--text-muted)]">
                          {formatWIB(ord.shipped_at)}
                        </p>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* COLUMN 5: WAITING QUEUE (Neutral Slate - Optional) */}
          {visibleColumns.waiting && (
            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] flex flex-col h-[calc(100vh-140px)] shadow-sm overflow-hidden">
              <div className="p-3.5 bg-[var(--bg-primary)] border-b border-[var(--border-subtle)] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-slate-400" />
                  <h2 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">
                    5. Antrian Menunggu ({waitingOrders.length})
                  </h2>
                </div>
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-[var(--bg-card)] text-[var(--text-muted)] border border-[var(--border-subtle)]">
                  QUEUE
                </span>
              </div>

              <div className="flex-1 p-3 overflow-y-auto space-y-2">
                {waitingOrders.length === 0 ? (
                  <div className="h-32 flex flex-col items-center justify-center text-xs text-[var(--text-muted)] text-center">
                    <Layers className="w-8 h-8 text-slate-400/40 mb-1.5" />
                    Antrian kosong
                  </div>
                ) : (
                  waitingOrders.map((ord) => (
                    <div
                      key={ord.id}
                      className="p-2.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] shadow-xs space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-semibold text-xs text-[var(--text-primary)]">
                          {ord.order_number}
                        </span>
                        <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[var(--bg-primary)] text-[var(--text-muted)]">
                          FIFO
                        </span>
                      </div>
                      <p className="text-xs text-[var(--text-muted)] truncate">
                        {ord.customer_name || 'N/A'} • {ord.courier_name || 'General Fleet'}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </main>
      )}

      {/* Admin Central TV Audio Modal */}
      <TVAudioSettingsModal
        isOpen={isAdminAudioModalOpen}
        onClose={() => setIsAdminAudioModalOpen(false)}
      />
    </div>
  );
}
