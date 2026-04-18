'use client';

import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import mqtt from 'mqtt';

export interface RealtimeMessage {
  'detail-type': string;
  detail: Record<string, unknown>;
  [key: string]: unknown;
}

type MessageCallback = (topic: string, payload: RealtimeMessage) => void;

interface Subscription {
  topics: string[];
  callback: MessageCallback;
}

interface RealtimeContextType {
  isConnected: boolean;
  error: Error | null;
  subscribe: (topics: string[], callback: MessageCallback) => () => void;
}

const RealtimeContext = createContext<RealtimeContextType | null>(null);

export function useRealtimeContext() {
  const context = useContext(RealtimeContext);
  if (!context) {
    throw new Error('useRealtimeContext must be used within a RealtimeProvider');
  }
  return context;
}

export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const [isConnected, setIsConnected] = useState(false);
  const isConnectedRef = useRef(false);
  const mountedRef = useRef(true);
  const [error, setError] = useState<Error | null>(null);
  const mqttClientRef = useRef<mqtt.MqttClient | null>(null);
  const connectingRef = useRef(false);
  const lastAttemptRef = useRef(0);
  const subscriptionsRef = useRef<Set<Subscription>>(new Set());
  const pendingSubscriptionsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const batchSubscribe = useCallback(() => {
    const client = mqttClientRef.current;
    if (!client || !isConnectedRef.current) return;

    const allTopics = new Set<string>();
    subscriptionsRef.current.forEach(sub => {
      sub.topics.forEach(t => allTopics.add(t));
    });

    if (allTopics.size > 0) {
      const topicList = Array.from(allTopics).sort();
      console.log(`[Realtime] Batch subscribing to ${topicList.length} topics`);
      client.subscribe(topicList);
    }
  }, []);

  const connect = useCallback(async () => {
    if (!mountedRef.current || mqttClientRef.current || connectingRef.current) return;

    // Minimum 1 second between connection attempts to break fast loops
    const now = Date.now();
    if (now - lastAttemptRef.current < 1000) {
      console.warn('[Realtime] Throttling connection attempt');
      return;
    }

    connectingRef.current = true;
    lastAttemptRef.current = now;

    try {
      const res = await fetch('/api/config');
      const config = await res.json();
      if (!mountedRef.current) {
        return;
      }
      if (!config.realtime?.url) {
        console.warn('[Realtime] IoT URL missing in config. This usually happens if the RealtimeBus is not linked or deployed. Streaming and LIVE updates will not work.');
        return;
      }

      const baseUrl = config.realtime.url.endsWith('/mqtt')
        ? config.realtime.url
        : `${config.realtime.url}/mqtt`;

      let token: string | null = null;
      try {
        const tokenKey = 'sc_realtime_token';
        token = localStorage.getItem(tokenKey);
        if (!token) {
          token = `${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
          localStorage.setItem(tokenKey, token);
        }
      } catch {
        token = `${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
      }

      console.log('[Realtime] Generating connection URL with token:', token.substring(0, 8) + '...');
      const mqttUrl = config.realtime.authorizer
        ? `${baseUrl}?x-amz-customauthorizer-name=${config.realtime.authorizer}&token=${encodeURIComponent(token)}`
        : `${baseUrl}?token=${encodeURIComponent(token)}`;

      // Derive a base clientId from token to associate with user, but add a random suffix
      // to avoid conflicts between multiple tabs (which would cause connection flapping).
      // We use the 'dashboard-' prefix as it is explicitly allowed in the IoT policy.
      const safeToken = token.substring(0, 16).replace(/[^a-zA-Z0-9]/g, '');
      const tabId = Math.random().toString(36).slice(2, 6);
      const clientId = `dashboard-${safeToken}-${tabId}`;
      
      console.log('[Realtime] Establishing shared connection:', clientId);
      const client = mqtt.connect(mqttUrl, {
        clientId,
        clean: true,
        connectTimeout: 30000,
        reconnectPeriod: 5000, // Try to reconnect every 5 seconds
        manualConnect: false,
      });

      client.on('connect', () => {
        setIsConnected(true);
        isConnectedRef.current = true;
        setError(null);
        console.log('[Realtime] MQTT Connection Success. Shared connection active.');
        
        // Re-subscribe to all existing topics on reconnect
        batchSubscribe();
      });

      client.on('error', (err) => {
        console.error('[Realtime] MQTT Connection Error:', err);
        setError(err);
        // If it's an auth error, we might want to stop, but mqtt.js doesn't always 
        // give us clear auth error codes in the browser.
      });

      client.on('close', () => {
        console.warn('[Realtime] MQTT Connection Closed (Check connection budget or broker logs)');
        setIsConnected(false);
        isConnectedRef.current = false;
      });

      client.on('offline', () => {
        console.warn('[Realtime] MQTT Client Offline');
      });

      client.on('message', (topic: string, payload: Buffer) => {
        try {
          const data = JSON.parse(payload.toString()) as RealtimeMessage;
          subscriptionsRef.current.forEach(sub => {
            const matches = sub.topics.some(t => {
              if (t === topic) return true;
              if (t.endsWith('/#')) {
                const prefix = t.slice(0, -2);
                return topic.startsWith(prefix);
              }
              if (t.includes('+')) {
                const parts = t.split('/');
                const topicParts = topic.split('/');
                if (parts.length !== topicParts.length) return false;
                return parts.every((p, i) => p === '+' || p === topicParts[i]);
              }
              return false;
            });

            if (matches) {
              sub.callback(topic, data);
            }
          });
        } catch (e) {
          console.error('[Realtime] Dispatch error:', e);
        }
      });

      mqttClientRef.current = client;
    } catch (e) {
      console.error('[Realtime] Initialization failed critical error:', e);
      setError(e instanceof Error ? e : new Error(String(e)));
    } finally {
      connectingRef.current = false;
    }
  }, [batchSubscribe]);

  useEffect(() => {
    mountedRef.current = true;
    console.log('[Realtime] Provider mounted');
    connect();
    return () => {
      mountedRef.current = false;
      console.log('[Realtime] Provider unmounting');
      if (mqttClientRef.current) {
        console.log('[Realtime] Closing shared connection');
        mqttClientRef.current.end(true);
        mqttClientRef.current = null;
      }
    };
  }, [connect]);

  const subscribe = useCallback((topics: string[], callback: MessageCallback) => {
    const sub: Subscription = { topics, callback };
    subscriptionsRef.current.add(sub);

    // Batch new subscriptions using a short delay to group multiple useRealtime() calls
    if (mqttClientRef.current && isConnectedRef.current) {
      if (pendingSubscriptionsTimeoutRef.current) {
        clearTimeout(pendingSubscriptionsTimeoutRef.current);
      }
      pendingSubscriptionsTimeoutRef.current = setTimeout(() => {
        batchSubscribe();
        pendingSubscriptionsTimeoutRef.current = null;
      }, 50);
    }

    return () => {
      subscriptionsRef.current.delete(sub);
    };
  }, [batchSubscribe]);

  return (
    <RealtimeContext.Provider value={{ isConnected, error, subscribe }}>
      {children}
    </RealtimeContext.Provider>
  );
}
