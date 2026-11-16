'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { RefreshCw, Zap, Clock } from 'lucide-react';

interface AutoSyncControlsProps {
  onSync: () => Promise<void> | void;
  isSyncing?: boolean;
  className?: string;
}

const INTERVAL_OPTIONS = [
  // { label: '30s', value: 30 },
  // { label: '1m', value: 60 },
  { label: '2m', value: 120 },
  { label: '5m', value: 300 },
];

export function AutoSyncControls({
  onSync,
  isSyncing = false,
  className = '',
}: AutoSyncControlsProps) {
  const [enabled, setEnabled] = useState(false);
  // const [intervalSec, setIntervalSec] = useState(60);
  // const [secondsRemaining, setSecondsRemaining] = useState(60);
  const [intervalSec, setIntervalSec] = useState(120);
  const [secondsRemaining, setSecondsRemaining] = useState(120);
  const [mounted, setMounted] = useState(false);

  // Load preferences from localStorage on mount
  useEffect(() => {
    setMounted(true);
    try {
      const savedEnabled = localStorage.getItem('wh_auto_sync_enabled');
      if (savedEnabled !== null) {
        setEnabled(savedEnabled === 'true');
      }
      const savedInterval = localStorage.getItem('wh_auto_sync_interval');
      if (savedInterval) {
        const val = parseInt(savedInterval, 10);
        // if ([30, 60, 120, 300].includes(val)) {
        if ([120, 300].includes(val)) {
          setIntervalSec(val);
          setSecondsRemaining(val);
        }
      }
    } catch {
      // ignore
    }
  }, []);

  // Save changes to localStorage
  const toggleEnabled = useCallback(() => {
    setEnabled((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('wh_auto_sync_enabled', String(next));
      } catch {
        // ignore
      }
      if (next) {
        setSecondsRemaining(intervalSec);
      }
      return next;
    });
  }, [intervalSec]);

  const changeInterval = useCallback((newSec: number) => {
    setIntervalSec(newSec);
    setSecondsRemaining(newSec);
    try {
      localStorage.setItem('wh_auto_sync_interval', String(newSec));
    } catch {
      // ignore
    }
  }, []);

  // Timer loop for auto-sync countdown
  const onSyncRef = useRef(onSync);
  useEffect(() => {
    onSyncRef.current = onSync;
  }, [onSync]);

  useEffect(() => {
    if (!enabled) return;

    const timer = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          // Trigger sync callback
          if (!isSyncing) {
            try {
              onSyncRef.current();
            } catch (err) {
              console.error('AutoSync execution error:', err);
            }
          }
          return intervalSec;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [enabled, intervalSec, isSyncing]);

  if (!mounted) return null;

  return (
    <div
      className={`inline-flex items-center gap-2 p-1 px-2.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] text-xs text-[var(--text-secondary)] ${className}`}
      title="Pengaturan penarikan data otomatis dari API eksternal (Shipment & Picking)"
    >
      {/* Auto-Sync Toggle Switch */}
      <button
        type="button"
        onClick={toggleEnabled}
        className={`inline-flex items-center gap-1.5 font-semibold transition-colors ${
          enabled
            ? 'text-emerald-700 dark:text-emerald-400'
            : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
        }`}
      >
        <span
          className={`w-2 h-2 rounded-full transition-all ${
            enabled
              ? 'bg-emerald-500 animate-pulse'
              : 'bg-slate-400 dark:bg-slate-600'
          }`}
        />
        <span>Auto-Sync</span>
      </button>

      {/* Interval Selector (Active when enabled) */}
      {enabled && (
        <>
          <span className="text-[var(--border-subtle)]">|</span>
          <div className="flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 text-[var(--text-muted)]" />
            <select
              value={intervalSec}
              onChange={(e) => changeInterval(Number(e.target.value))}
              className="bg-transparent border-0 text-[11px] font-mono font-medium text-[var(--text-primary)] focus:outline-none cursor-pointer py-0.5"
            >
              {INTERVAL_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value} className="bg-[var(--bg-surface)] text-[var(--text-primary)]">
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Countdown indicator */}
          <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-[var(--bg-primary)] text-[var(--text-muted)]">
            {isSyncing ? (
              <RefreshCw className="w-3 h-3 animate-spin text-emerald-500" />
            ) : (
              `${secondsRemaining}s`
            )}
          </span>
        </>
      )}
    </div>
  );
}
