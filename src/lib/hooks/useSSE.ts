'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

type SSECallback = (data: any) => void;

export function useSSE() {
  const [isConnected, setIsConnected] = useState(false);
  const listenersRef = useRef<Map<string, Set<SSECallback>>>(new Map());
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const subscribe = useCallback((event: string, callback: SSECallback) => {
    if (!listenersRef.current.has(event)) {
      listenersRef.current.set(event, new Set());
    }
    listenersRef.current.get(event)?.add(callback);

    return () => {
      listenersRef.current.get(event)?.delete(callback);
    };
  }, []);

  const connect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

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

      // Built-in event dispatch
      const eventTypes = [
        'orderUpdate',
        'orderCreated',
        'driverArrival',
        'packingStart',
        'packingComplete',
        'pickupShipped',
        'priorityUpdate',
        'statsUpdate',
      ];

      eventTypes.forEach((type) => {
        es.addEventListener(type, (e: MessageEvent) => {
          try {
            const data = JSON.parse(e.data);
            const callbacks = listenersRef.current.get(type);
            if (callbacks) {
              callbacks.forEach((cb) => cb(data));
            }
            // Also notify any general wildcard listeners
            const generalCallbacks = listenersRef.current.get('*');
            if (generalCallbacks) {
              generalCallbacks.forEach((cb) => cb({ event: type, data }));
            }
          } catch (err) {
            console.error(`Error parsing SSE data for event ${type}:`, err);
          }
        });
      });
    } catch (err) {
      console.error('Failed to initialize EventSource:', err);
      setIsConnected(false);
    }
  }, []);

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
