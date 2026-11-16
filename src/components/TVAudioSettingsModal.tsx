'use client';

import React, { useState, useEffect, useRef } from 'react';
import { TVAudioSettings, SoundPreset } from '@/lib/types';
import { playNotificationSound } from '@/lib/utils/audio';
import {
  Volume2,
  VolumeX,
  Play,
  UploadCloud,
  Check,
  X,
  AlertTriangle,
  Music,
  Radio,
  Bell,
  Sparkles,
  Layers,
  FileAudio,
} from 'lucide-react';

interface TVAudioSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const PRESET_OPTIONS: {
  id: SoundPreset;
  title: string;
  desc: string;
  icon: React.ComponentType<{ className?: string }>;
  tag: string;
}[] = [
  {
    id: 'airport',
    title: 'Airport Chime (Ding-Dong Melodis)',
    desc: 'Dua nada F5 → A5 kontras, standar panggilan boarding bandara yang sangat jelas di ruangan bising.',
    icon: Bell,
    tag: 'Rekomendasi',
  },
  {
    id: 'bell',
    title: 'Warehouse Bell (Classic Chime)',
    desc: 'Nada tunggal D5 hangat dengan decay lembut (suara bawaan sistem).',
    icon: Music,
    tag: 'Klasik',
  },
  {
    id: 'elevator',
    title: 'Elevator Crisp Ding',
    desc: 'Lonceng tajam frekuensi tinggi C6 → E6 yang cepat dan langsung menarik perhatian.',
    icon: Sparkles,
    tag: 'Crisp',
  },
  {
    id: 'marimba',
    title: 'Marimba Triad (Melodi Hangat)',
    desc: 'Arpeggio 3 nada lembut C5 → E5 → G5 yang ramah di telinga operator.',
    icon: Layers,
    tag: 'Lembut',
  },
  {
    id: 'digital',
    title: 'Digital Cyber Ping',
    desc: 'Nada synthesizer futuristik cepat, cocok untuk monitor berkonsep high-tech.',
    icon: Radio,
    tag: 'Digital',
  },
  {
    id: 'custom',
    title: 'Upload Audio Sendiri (.mp3 / .wav)',
    desc: 'Gunakan jingle perusahaan, rekaman suara pengumuman, atau file bel khusus milik Anda.',
    icon: FileAudio,
    tag: 'Kustom',
  },
];

export function TVAudioSettingsModal({ isOpen, onClose }: TVAudioSettingsModalProps) {
  const [settings, setSettings] = useState<TVAudioSettings>({
    enabled: true,
    preset: 'airport',
    volume: 0.8,
    customAudioBase64: null,
    customAudioName: null,
    triggers: {
      driverArrival: true,
      packingComplete: true,
      orderUpdate: true,
    },
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Fetch current settings on open
  useEffect(() => {
    if (!isOpen) return;
    setStatusMessage(null);
    setLoading(true);

    fetch('/api/settings/tv-audio')
      .then((res) => res.json())
      .then((data) => {
        if (data.settings) {
          setSettings(data.settings);
        }
      })
      .catch((err) => {
        console.error('Failed to load audio settings:', err);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [isOpen]);

  if (!isOpen) return null;

  const handleTestSound = () => {
    playNotificationSound(settings);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 3 * 1024 * 1024) {
      setStatusMessage({
        type: 'error',
        text: 'Ukuran file terlalu besar! Maksimal 3MB agar sinkronisasi lancar.',
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      setSettings((prev) => ({
        ...prev,
        preset: 'custom',
        customAudioBase64: base64,
        customAudioName: file.name,
      }));
      setStatusMessage({
        type: 'success',
        text: `File "${file.name}" berhasil diunggah. Klik tombol "Uji Suara" untuk mendengarkan.`,
      });
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    setSaving(true);
    setStatusMessage(null);
    try {
      const token = localStorage.getItem('wh_auth_token');
      const res = await fetch('/api/settings/tv-audio', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(settings),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Gagal menyimpan pengaturan audio TV');
      }

      setStatusMessage({
        type: 'success',
        text: 'Pengaturan audio berhasil disimpan dan disiarkan real-time ke semua layar TV!',
      });
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err.message || 'Terjadi kesalahan saat menyimpan pengaturan.',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-5 border-b border-[var(--border-subtle)] flex items-center justify-between bg-[var(--bg-card)]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 flex items-center justify-center">
              <Volume2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[var(--text-primary)]">
                Kustomisasi Suara Monitor Antrian TV
              </h2>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">
                Pengaturan terpusat untuk mengontrol nada, volume speaker, dan pemicu bel di layar TV overhead
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card)] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
          {statusMessage && (
            <div
              className={`p-3 rounded-xl border text-xs font-semibold flex items-center gap-2 ${
                statusMessage.type === 'success'
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400'
                  : 'bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-400'
              }`}
            >
              {statusMessage.type === 'success' ? (
                <Check className="w-4 h-4 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 shrink-0" />
              )}
              <span>{statusMessage.text}</span>
            </div>
          )}

          {/* Master Enable Audio Toggle */}
          <div className="p-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] flex items-center justify-between">
            <div className="flex items-center gap-3">
              {settings.enabled ? (
                <Volume2 className="w-5 h-5 text-emerald-500" />
              ) : (
                <VolumeX className="w-5 h-5 text-[var(--text-muted)]" />
              )}
              <div>
                <p className="text-sm font-bold text-[var(--text-primary)]">
                  Master Notifikasi Suara TV
                </p>
                <p className="text-[11px] text-[var(--text-muted)]">
                  {settings.enabled
                    ? 'Audio TV aktif dan akan berbunyi saat ada pembaruan antrean.'
                    : 'Audio TV dibisukan (mute total).'}
                </p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.enabled}
                onChange={(e) =>
                  setSettings((prev) => ({ ...prev, enabled: e.target.checked }))
                }
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
            </label>
          </div>

          {/* Preset Selection */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider">
                Pilih Karakter Nada Notifikasi
              </label>
              <span className="text-[11px] text-[var(--text-muted)]">
                Diputar instan tanpa buffering
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {PRESET_OPTIONS.map((item) => {
                const isSelected = settings.preset === item.id;
                const Icon = item.icon;
                return (
                  <div
                    key={item.id}
                    onClick={() =>
                      setSettings((prev) => ({
                        ...prev,
                        preset: item.id,
                      }))
                    }
                    className={`p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between gap-2 ${
                      isSelected
                        ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/10 shadow-xs'
                        : 'border-[var(--border-subtle)] bg-[var(--bg-card)] hover:border-[var(--border-strong)]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Icon
                          className={`w-4 h-4 ${
                            isSelected
                              ? 'text-[var(--accent-primary)]'
                              : 'text-[var(--text-muted)]'
                          }`}
                        />
                        <span
                          className={`font-bold text-xs ${
                            isSelected
                              ? 'text-[var(--accent-primary)]'
                              : 'text-[var(--text-primary)]'
                          }`}
                        >
                          {item.title}
                        </span>
                      </div>
                      <span className="text-[10px] px-1.5 py-0.2 rounded font-mono font-semibold bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-muted)] shrink-0">
                        {item.tag}
                      </span>
                    </div>
                    <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
                      {item.desc}
                    </p>
                  </div>
                );
              })}
            </div>

            {/* Custom File Upload Box (Shown if preset === 'custom') */}
            {settings.preset === 'custom' && (
              <div className="mt-3 p-4 rounded-xl border border-dashed border-amber-400/60 bg-amber-500/5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileAudio className="w-4 h-4 text-amber-600" />
                    <span className="font-bold text-xs text-[var(--text-primary)]">
                      File Audio Kustom Anda:
                    </span>
                  </div>
                  {settings.customAudioName && (
                    <span className="text-[11px] font-mono font-bold text-emerald-600 dark:text-emerald-400">
                      {settings.customAudioName}
                    </span>
                  )}
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="audio/mp3,audio/wav,audio/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex-1 py-2 px-3 rounded-lg border border-amber-400 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 font-bold text-xs hover:bg-amber-100 transition-colors flex items-center justify-center gap-2"
                  >
                    <UploadCloud className="w-3.5 h-3.5" />
                    <span>
                      {settings.customAudioBase64
                        ? 'Ganti File Audio (.mp3 / .wav)'
                        : 'Pilih File Audio (.mp3 / .wav)'}
                    </span>
                  </button>

                  {settings.customAudioBase64 && (
                    <button
                      type="button"
                      onClick={() =>
                        setSettings((prev) => ({
                          ...prev,
                          customAudioBase64: null,
                          customAudioName: null,
                          preset: 'airport',
                        }))
                      }
                      className="px-3 py-2 rounded-lg border border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-rose-500 text-xs font-semibold"
                    >
                      Hapus
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Volume Slider & Test Button */}
          <div className="p-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider">
                Volume Speaker TV: {Math.round(settings.volume * 100)}%
              </label>
              <button
                type="button"
                onClick={handleTestSound}
                className="px-3 py-1.5 rounded-lg bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Uji Suara (Preview)</span>
              </button>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-[11px] text-[var(--text-muted)]">10%</span>
              <input
                type="range"
                min="0.1"
                max="1.0"
                step="0.05"
                value={settings.volume}
                onChange={(e) =>
                  setSettings((prev) => ({
                    ...prev,
                    volume: parseFloat(e.target.value),
                  }))
                }
                className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-[var(--accent-primary)]"
              />
              <span className="text-[11px] text-[var(--text-muted)]">100%</span>
            </div>
            <p className="text-[11px] text-[var(--text-muted)]">
              Gunakan volume 80% - 100% jika speaker TV berada di ruangan gudang yang luas dan bising.
            </p>
          </div>

          {/* Event Triggers Checklist */}
          <div className="space-y-2.5">
            <label className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider block">
              Pemicu Notifikasi Suara (Kapan Bel Berbunyi)
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <label className="p-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] flex items-center justify-between cursor-pointer">
                <div>
                  <p className="font-bold text-xs text-[var(--text-primary)]">Kurir Tiba</p>
                  <p className="text-[10px] text-[var(--text-muted)]">Check-in di loket</p>
                </div>
                <input
                  type="checkbox"
                  checked={settings.triggers.driverArrival}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      triggers: {
                        ...prev.triggers,
                        driverArrival: e.target.checked,
                      },
                    }))
                  }
                  className="w-4 h-4 rounded accent-[var(--accent-primary)] cursor-pointer"
                />
              </label>

              <label className="p-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] flex items-center justify-between cursor-pointer">
                <div>
                  <p className="font-bold text-xs text-[var(--text-primary)]">Selesai Packing</p>
                  <p className="text-[10px] text-[var(--text-muted)]">Siap diambil di rak</p>
                </div>
                <input
                  type="checkbox"
                  checked={settings.triggers.packingComplete}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      triggers: {
                        ...prev.triggers,
                        packingComplete: e.target.checked,
                      },
                    }))
                  }
                  className="w-4 h-4 rounded accent-[var(--accent-primary)] cursor-pointer"
                />
              </label>

              <label className="p-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] flex items-center justify-between cursor-pointer">
                <div>
                  <p className="font-bold text-xs text-[var(--text-primary)]">Update Order</p>
                  <p className="text-[10px] text-[var(--text-muted)]">Status transaksi lain</p>
                </div>
                <input
                  type="checkbox"
                  checked={settings.triggers.orderUpdate}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      triggers: {
                        ...prev.triggers,
                        orderUpdate: e.target.checked,
                      },
                    }))
                  }
                  className="w-4 h-4 rounded accent-[var(--accent-primary)] cursor-pointer"
                />
              </label>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-[var(--bg-card)] border-t border-[var(--border-subtle)] flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:bg-[var(--bg-surface)] text-xs font-semibold"
          >
            Batal
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={saving || loading}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-400 hover:to-indigo-500 text-white font-bold text-xs shadow-md shadow-indigo-500/20 disabled:opacity-50 transition-all flex items-center gap-2"
          >
            {saving ? (
              <span>Menyimpan ke TV...</span>
            ) : (
              <>
                <Check className="w-4 h-4" />
                <span>Simpan Pengaturan TV</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
