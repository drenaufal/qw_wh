'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { formatWIB } from '@/lib/utils/datetime';

export interface WatermarkData {
  orderNumber: string;
  driverName: string;
  courierCompany: string;
}

export function useCamera() {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [isReady, setIsReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const startCamera = useCallback(async (mode: 'environment' | 'user' = facingMode) => {
    try {
      setCameraError(null);
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }

      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: mode },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      };

      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(mediaStream);
      setFacingMode(mode);

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play().catch(console.error);
          setIsReady(true);
        };
      }
    } catch (err: any) {
      console.error('Camera access error:', err);
      setCameraError(err.message || 'Unable to access device camera');
      setIsReady(false);
    }
  }, [facingMode, stream]);

  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
    setIsReady(false);
  }, [stream]);

  const flipCamera = useCallback(() => {
    const nextMode = facingMode === 'environment' ? 'user' : 'environment';
    startCamera(nextMode);
  }, [facingMode, startCamera]);

  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [stream]);

  /**
   * Captures the current frame to an HTML5 canvas, draws the required
   * 2-line immutable watermark banner, and returns the Base64 JPEG data URL.
   */
  const capturePhoto = useCallback((watermark: WatermarkData): string | null => {
    if (!videoRef.current || !isReady) return null;

    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    const width = video.videoWidth || 1280;
    const height = video.videoHeight || 720;
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // Draw video frame
    ctx.drawImage(video, 0, 0, width, height);

    // Overlay Watermark Banner at the bottom
    const bannerHeight = Math.max(80, Math.floor(height * 0.12));
    ctx.fillStyle = 'rgba(10, 15, 29, 0.88)'; // Dark industrial backdrop
    ctx.fillRect(0, height - bannerHeight, width, bannerHeight);

    // Accent line on top of banner
    ctx.fillStyle = '#10b981'; // Emerald green
    ctx.fillRect(0, height - bannerHeight, width, 4);

    // Font setup
    const fontSize = Math.max(16, Math.floor(bannerHeight * 0.28));
    ctx.font = `bold ${fontSize}px sans-serif`;
    ctx.textAlign = 'left';

    // Line 1: ORDER: <ORDER_NUMBER> | DRIVER: <DRIVER_NAME> (<COURIER>)
    ctx.fillStyle = '#ffffff';
    const line1Text = `ORDER: ${watermark.orderNumber} | DRIVER: ${watermark.driverName} (${watermark.courierCompany || 'General'})`;
    ctx.fillText(line1Text, 24, height - bannerHeight + fontSize + 12);

    // Line 2: TIME: <WIB_TIMESTAMP> | DOCK VERIFIED HANDOVER
    const wibTimestamp = formatWIB(new Date());
    ctx.fillStyle = '#34d399'; // Emerald-400 accent
    const line2Text = `TIME: ${wibTimestamp} | DOCK VERIFIED HANDOVER`;
    ctx.fillText(line2Text, 24, height - 16);

    // Return compressed base64 JPEG (85% quality as specified in PRD NFR)
    return canvas.toDataURL('image/jpeg', 0.85);
  }, [isReady]);

  return {
    videoRef,
    stream,
    isReady,
    cameraError,
    facingMode,
    startCamera,
    stopCamera,
    flipCamera,
    capturePhoto,
  };
}

