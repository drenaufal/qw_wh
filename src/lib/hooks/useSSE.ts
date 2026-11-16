'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

type SSECallback = (data: any) => void;

const DEFAULT_EVENT_TYPES = [
  'orderUpdate',
  'orderCreated',
  'driverArrival',
  'packingStart',
  'packingComplete',
  'pickupShipped',
  'priorityUpdate',
  'statsUpdate',
  'tvAudioSettingsUpdate',
];

export function useSSE() {
  const [isConnected, setIsConnected] = useState(false);
  const listenersRef = useRef<Map<string, Set<SSECallback>>>(new Map());
  const registeredEventsRef = useRef<Set<string>>(new Set());
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const bindEventListener = useCallback((type: string, es: EventSource) => {
    if (registeredEventsRef.current.has(type) || type === '*') return;

    registeredEventsRef.current.add(type);
    es.addEventListener(type, (e: MessageEvent) => {
      try {
        const data = e.data ? JSON.parse(e.data) : null;
        const callbacks = listenersRef.current.get(type);
        if (callbacks) {
          callbacks.forEach((cb) => cb(data));
        }
        // Also notify wildcard listeners
        const generalCallbacks = listenersRef.current.get('*');
        if (generalCallbacks) {
          generalCallbacks.forEach((cb) => cb({ event: type, data }));
        }
      } catch (err) {
        console.error(`Error parsing SSE data for event ${type}:`, err);
      }
    });
  }, []);

  const subscribe = useCallback((event: string, callback: SSECallback) => {
    if (!listenersRef.current.has(event)) {
      listenersRef.current.set(event, new Set());
    }
    listenersRef.current.get(event)?.add(callback);

    // If EventSource is currently active and this event is not yet bound, bind it now
    if (eventSourceRef.current) {
      bindEventListener(event, eventSourceRef.current);
    }

    return () => {
      listenersRef.current.get(event)?.delete(callback);
    };
  }, [bindEventListener]);

  const connect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }
    registeredEventsRef.current.clear();

    try {
      const es = new EventSource('/api/events');
      eventSourceRef.current = es;

      es.onopen = () => {
        setIsConnected(true);
      };

      es.onerror = () => {
        setIsConnected(false);
        es.close();
        if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, 4000);
      };

      // Bind all default event types
      DEFAULT_EVENT_TYPES.forEach((type) => {
        bindEventListener(type, es);
      });

      // Also bind any currently subscribed events
      listenersRef.current.forEach((_, eventName) => {
        bindEventListener(eventName, es);
      });
    } catch (err) {
      console.error('Failed to initialize EventSource:', err);
      setIsConnected(false);
    }
  }, [bindEventListener]);

  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, [connect]);

  return { isConnected, subscribe };
}
