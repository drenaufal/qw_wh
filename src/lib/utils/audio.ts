import { SoundPreset, TVAudioSettings } from '@/lib/types';

let globalAudioCtx: AudioContext | null = null;
let currentHtmlAudio: HTMLAudioElement | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!globalAudioCtx) {
    const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioCtxClass) {
      globalAudioCtx = new AudioCtxClass();
    }
  }
  if (globalAudioCtx && globalAudioCtx.state === 'suspended') {
    globalAudioCtx.resume().catch(() => {});
  }
  return globalAudioCtx;
}

/**
 * Plays a chime preset or custom audio using Web Audio API / HTML5 Audio
 */
export function playNotificationSound(settings: TVAudioSettings) {
  if (!settings.enabled) return;
  const volume = Math.min(1.0, Math.max(0.0, Number(settings.volume) || 0.8));

  // If custom audio file is selected and available
  if (settings.preset === 'custom' && settings.customAudioBase64) {
    try {
      if (currentHtmlAudio) {
        currentHtmlAudio.pause();
        currentHtmlAudio.currentTime = 0;
      }
      const audio = new Audio(settings.customAudioBase64);
      audio.volume = volume;
      currentHtmlAudio = audio;
      audio.play().catch((err) => {
        console.warn('Custom audio playback blocked or failed:', err);
      });
      return;
    } catch (e) {
      console.warn('Failed to play custom audio, falling back to synthesizer:', e);
    }
  }

  // Synthesizer Web Audio API for presets
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;

  switch (settings.preset) {
    case 'airport': {
      // Modern Airport Ding-Dong (F5 698.46 Hz -> A5 880.00 Hz)
      playTone(ctx, 698.46, now, 0.45, volume, 'sine');
      playTone(ctx, 880.00, now + 0.35, 0.95, volume, 'sine');
      break;
    }

    case 'elevator': {
      // Crisp High Bell (C6 1046.50 Hz -> E6 1318.51 Hz)
      playTone(ctx, 1046.50, now, 0.18, volume * 0.9, 'triangle');
      playTone(ctx, 1318.51, now + 0.15, 0.85, volume, 'sine');
      break;
    }

    case 'marimba': {
      // Warm Triad (C5 523.25 Hz -> E5 659.25 Hz -> G5 783.99 Hz)
      playTone(ctx, 523.25, now, 0.35, volume * 0.9, 'sine');
      playTone(ctx, 659.25, now + 0.12, 0.35, volume * 0.9, 'sine');
      playTone(ctx, 783.99, now + 0.24, 0.75, volume, 'sine');
      break;
    }

    case 'digital': {
      // Futuristic Cyber Ping (Dual square/sine ping)
      playTone(ctx, 880.00, now, 0.12, volume * 0.6, 'sine');
      playTone(ctx, 1760.00, now + 0.08, 0.55, volume * 0.7, 'sine');
      break;
    }

    case 'bell':
    default: {
      // Classic Warehouse Bell (D5 587.33 Hz)
      playTone(ctx, 587.33, now, 0.85, volume, 'sine');
      break;
    }
  }
}

function playTone(
  ctx: AudioContext,
  freq: number,
  startTime: number,
  duration: number,
  volume: number,
  type: OscillatorType = 'sine'
) {
  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, startTime);

    // Envelope: quick attack, exponential decay
    const attackTime = 0.02;
    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.linearRampToValueAtTime(volume * 0.5, startTime + attackTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(startTime);
    osc.stop(startTime + duration + 0.05);
  } catch (err) {
    console.warn('Tone generation error:', err);
  }
}
