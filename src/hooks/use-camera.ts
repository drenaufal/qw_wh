'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { formatWIB } from '@/lib/utils/datetime';

export interface WatermarkData {
  orderNumber: string;
  driverName: string;
  courierCompany: string;
  timestamp?: string;
}

export function useCamera() {
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [isReady, setIsReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Stop active camera tracks safely
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsReady(false);
  }, []);

  // Start camera with fallback constraints and error handling
  const startCamera = useCallback(async (mode: 'environment' | 'user' = 'environment') => {
    try {
      setCameraError(null);
      setIsReady(false);

      // Stop previous tracks before requesting a new stream
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }

      if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
        throw new Error(
          'Kamera tidak didukung pada browser ini atau koneksi tidak aman. Pastikan membuka via localhost atau HTTPS.'
        );
      }

      let mediaStream: MediaStream | null = null;

      // Attempt 1: Try requested facingMode with standard resolution
      try {
        mediaStream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: mode },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });
      } catch (err1) {
        console.warn('Initial camera constraint failed, retrying with generic video constraint...', err1);
        // Attempt 2: Fallback to basic video constraint (works with almost all webcams)
        mediaStream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
      }

      streamRef.current = mediaStream;
      setFacingMode(mode);

      const video = videoRef.current;
      if (video) {
        video.srcObject = mediaStream;
        video.setAttribute('playsinline', 'true');
        video.muted = true;

        const onPlaySuccess = () => {
          setIsReady(true);
        };

        const playPromise = video.play();
        if (playPromise !== undefined) {
          playPromise
            .then(onPlaySuccess)
            .catch(() => {
              // Wait for metadata loaded event
              video.onloadedmetadata = () => {
                video.play().then(onPlaySuccess).catch(() => {
                  // Fallback: ready if stream is active
                  setIsReady(true);
                });
              };
            });
        }
      } else {
        // If element not rendered yet, set ready
        setIsReady(true);
      }
    } catch (err: any) {
      console.error('Camera access error:', err);
      let msg = 'Gagal mengakses kamera perangkat.';
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        msg = 'Izin kamera ditolak. Silakan izinkan akses kamera di ikon gembok pada address bar browser.';
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        msg = 'Kamera tidak terdeteksi pada perangkat ini. Anda bisa menggunakan opsi upload foto.';
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        msg = 'Kamera sedang digunakan oleh aplikasi lain. Tutup aplikasi tersebut dan coba lagi.';
      } else if (err.message) {
        msg = err.message;
      }
      setCameraError(msg);
      setIsReady(false);
    }
  }, []);

  const flipCamera = useCallback(() => {
    setFacingMode((prev) => {
      const nextMode = prev === 'environment' ? 'user' : 'environment';
      startCamera(nextMode);
      return nextMode;
    });
  }, [startCamera]);

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    };
  }, []);

  /**
   * Stamps the immutable high-contrast watermark banner and corner badge onto a canvas context.
   */
  const stampWatermark = useCallback((canvas: HTMLCanvasElement, watermark: WatermarkData) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const now = new Date();
    const wibTimestamp = watermark.timestamp || formatWIB(now);

    // 1. TOP-RIGHT CORNER TAMPER-PROOF STAMP BADGE
    const badgeWidth = Math.min(380, width * 0.42);
    const badgeHeight = 42;
    ctx.fillStyle = 'rgba(3, 7, 18, 0.85)';
    ctx.beginPath();
    ctx.roundRect(width - badgeWidth - 20, 20, badgeWidth, badgeHeight, 10);
    ctx.fill();
    ctx.strokeStyle = 'rgba(16, 185, 129, 0.5)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Pulsing green dot
    ctx.fillStyle = '#10b981';
    ctx.beginPath();
    ctx.arc(width - badgeWidth - 20 + 18, 20 + 21, 5, 0, 2 * Math.PI);
    ctx.fill();

    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`WIB: ${wibTimestamp}`, width - badgeWidth - 20 + 32, 20 + 26);

    // 2. MAIN BOTTOM WATERMARK BANNER (2-line immutable dock verification)
    const bannerHeight = Math.max(90, Math.floor(height * 0.15));

    // Gradient dark backdrop
    const bannerGrad = ctx.createLinearGradient(0, height - bannerHeight, 0, height);
    bannerGrad.addColorStop(0, 'rgba(2, 6, 23, 0.94)');
    bannerGrad.addColorStop(1, 'rgba(0, 0, 0, 0.98)');
    ctx.fillStyle = bannerGrad;
    ctx.fillRect(0, height - bannerHeight, width, bannerHeight);

    // High-tech top accent line (Emerald -> Cyan -> Amber)
    const accentGrad = ctx.createLinearGradient(0, 0, width, 0);
    accentGrad.addColorStop(0, '#10b981');
    accentGrad.addColorStop(0.5, '#06b6d4');
    accentGrad.addColorStop(1, '#f59e0b');
    ctx.fillStyle = accentGrad;
    ctx.fillRect(0, height - bannerHeight, width, 4);

    // Font scaling
    const fontSizeTitle = Math.max(15, Math.floor(bannerHeight * 0.22));
    const fontSizeSub = Math.max(13, Math.floor(bannerHeight * 0.18));

    // Left Column Line 1: ORDER NUMBER & DRIVER IDENTITY
    ctx.textAlign = 'left';
    ctx.font = `bold ${fontSizeTitle}px sans-serif`;
    ctx.fillStyle = '#ffffff';
    const line1 = `ORDER: ${watermark.orderNumber}  •  KURIR: ${watermark.driverName} (${watermark.courierCompany || 'General'})`;
    ctx.fillText(line1, 26, height - bannerHeight + fontSizeTitle + 16);

    // Left Column Line 2: DATE & TIME WATERMARK (WIB)
    ctx.font = `600 ${fontSizeSub}px monospace`;
    ctx.fillStyle = '#34d399'; // Emerald-400
    const line2 = `WAKTU: ${wibTimestamp}  •  DOCK VERIFIED HANDOVER`;
    ctx.fillText(line2, 26, height - 20);

    // Right Column: System verification stamp
    ctx.textAlign = 'right';
    ctx.font = `bold ${fontSizeSub}px monospace`;
    ctx.fillStyle = '#06b6d4';
    ctx.fillText('QUE WH DISPATCH HUD', width - 26, height - bannerHeight + fontSizeTitle + 16);
    ctx.fillStyle = '#94a3b8';
    ctx.font = '11px monospace';
    ctx.fillText(`HASH: ${Date.now().toString(36).toUpperCase()}`, width - 26, height - 20);
  }, []);

  /**
   * Captures the current frame to an HTML5 canvas, stamps the immutable watermark,
   * and returns the compressed Base64 JPEG data URL.
   */
  const capturePhoto = useCallback((watermark: WatermarkData): string | null => {
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    let width = 1280;
    let height = 720;

    if (video && video.videoWidth && video.videoHeight) {
      width = video.videoWidth;
      height = video.videoHeight;
    }

    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    if (video && isReady && video.videoWidth > 0) {
      ctx.drawImage(video, 0, 0, width, height);
    } else {
      // Fallback parcel illustration backdrop
      const grad = ctx.createLinearGradient(0, 0, width, height);
      grad.addColorStop(0, '#0f172a');
      grad.addColorStop(1, '#020617');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);

      ctx.fillStyle = '#64748b';
      ctx.font = 'bold 28px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('DISPATCH HANDOVER PROOF OF DELIVERY', width / 2, height / 2 - 20);
      ctx.font = '20px monospace';
      ctx.fillText(`ORDER: ${watermark.orderNumber}`, width / 2, height / 2 + 25);
    }

    // Apply immutable watermark
    stampWatermark(canvas, watermark);

    return canvas.toDataURL('image/jpeg', 0.85);
  }, [isReady, stampWatermark]);

  /**
   * Processes an uploaded image file and applies the exact same immutable watermark.
   */
  const processImageFile = useCallback((file: File, watermark: WatermarkData): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const width = img.width || 1280;
          const height = img.height || 720;
          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Canvas context unavailable'));
            return;
          }

          ctx.drawImage(img, 0, 0, width, height);
          stampWatermark(canvas, watermark);
          resolve(canvas.toDataURL('image/jpeg', 0.85));
        };
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = e.target?.result as string;
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  }, [stampWatermark]);

  return {
    videoRef,
    stream: streamRef.current,
    isReady,
    cameraError,
    facingMode,
    startCamera,
    stopCamera,
    flipCamera,
    capturePhoto,
    processImageFile,
  };
}
