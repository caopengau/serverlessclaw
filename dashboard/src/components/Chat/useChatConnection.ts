import { useState, useEffect, useRef } from 'react';
import mqtt from 'mqtt';
import { ChatMessage, ConversationMeta } from './types';
import { shouldProcessChunk, applyChunkToMessages, mergeHistoryWithMessages } from './message-handler';

export function useChatConnection(activeSessionId: string, setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>, setIsLoading: React.Dispatch<React.SetStateAction<boolean>>, isPostInFlight: React.MutableRefObject<boolean>) {
  const [isRealtimeActive, setIsRealtimeActive] = useState(false);
  const [sessions, setSessions] = useState<ConversationMeta[]>([]);
  const mqttClientRef = useRef<mqtt.MqttClient | null>(null);
  const activeSessionRef = useRef<string>(activeSessionId);
  const skipNextHistoryFetch = useRef<boolean>(false);
  const seenMessageIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    activeSessionRef.current = activeSessionId;
  }, [activeSessionId]);

  const fetchSessions = async () => {
    try {
      const response = await fetch('/api/chat');
      const data = await response.json();
      if (data.sessions) {
        setSessions(data.sessions);
      }
    } catch (error) {
      console.error('Failed to fetch sessions:', error);
    }
  };

  const fetchHistorySilently = async (sessionId: string) => {
    if (isPostInFlight.current) return;
    try {
      const response = await fetch(`/api/chat?sessionId=${sessionId}`);
      const data = await response.json();
      if (data.history) {
        setMessages(prev => {
          const { messages, seenIds } = mergeHistoryWithMessages(prev, data.history);
          seenMessageIds.current = seenIds;
          return messages;
        });
      }
    } catch (e) {
      console.warn('Silent History fetch failed:', e);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, []);

  useEffect(() => {
    const userId = 'dashboard-user';
    const connect = async () => {
      try {
        const res = await fetch('/api/config');
        const config = await res.json();
        if (!config.realtime?.url) return;

        // AWS IoT WebSockets require the /mqtt path
        const baseUrl = config.realtime.url.endsWith('/mqtt') 
          ? config.realtime.url 
          : `${config.realtime.url}/mqtt`;

        // Append authorizer name to the URL if provided
        const mqttUrl = config.realtime.authorizer 
          ? `${baseUrl}?x-amz-customauthorizer-name=${config.realtime.authorizer}`
          : baseUrl;

        const client = mqtt.connect(mqttUrl, {
          protocol: 'wss',
          clientId: `dashboard-${Math.random().toString(16).slice(2, 10)}`,
          username: 'dashboardUser',
          password: 'auth-token',
          clean: true,
          connectTimeout: 30000,
          reconnectPeriod: 5000,
        });

        console.log('[Realtime] MQTT Client created, waiting for connection...');        
        client.on('connect', () => {
          console.log('[Realtime] Connected to push bus');
          setIsRealtimeActive(true);
          // Subscribe to ALL signals for this user using a wildcard
          // This covers both generic user signals and session-specific signals
          const userTopicWildcard = `users/${userId}/#`;
          console.log(`[Realtime] Subscribing to wildcard: ${userTopicWildcard}`);
          client.subscribe(userTopicWildcard);
        });

        client.on('message', (t: string, payload: unknown) => {
          try {
            const data = JSON.parse(String(payload));
            const currentActiveId = activeSessionRef.current;
            console.log(`[Realtime] Received signal on topic: ${t} | MsgId: ${data.messageId} | Agent: ${data.agentName}`);
            
            if (shouldProcessChunk(data, currentActiveId, userId)) {
              console.log(`[Realtime] Applying chunk to UI for session: ${currentActiveId}`);
              setMessages(prev => applyChunkToMessages(prev, data, seenMessageIds.current));
            } else {
              console.log(`[Realtime] Discarding signal for inactive session or wrong user. ChunkSession: ${data.sessionId} | ActiveSession: ${currentActiveId}`);
              if (currentActiveId && !isPostInFlight.current) {
                fetchHistorySilently(currentActiveId);
              }
            }
          } catch (e) {
            console.error('[Realtime] Failed to parse message:', e);
          }
        });

        client.on('error', (err: unknown) => {
          console.error('[Realtime] MQTT Error:', err);
          setIsRealtimeActive(false);
        });

        client.on('offline', () => console.log('[Realtime] MQTT Client offline'));
        client.on('reconnect', () => console.log('[Realtime] MQTT Client reconnecting...'));

        client.on('close', () => {
          console.log('[Realtime] MQTT Connection closed');
          setIsRealtimeActive(false);
        });
        mqttClientRef.current = client;
      } catch (e) {
        console.error('[Realtime] Setup failed:', e);
      }
    };

    connect();
    return () => {
      if (mqttClientRef.current) {
        mqttClientRef.current.end();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Session-specific subscriptions are now handled by the wildcard subscription in the main connect useEffect
  useEffect(() => {
    const client = mqttClientRef.current;
    if (!client || !client.connected || !activeSessionId) return;
    
    console.log(`[Realtime] Active session changed to: ${activeSessionId}. (Already covered by wildcard subscription)`);
  }, [activeSessionId, isRealtimeActive]);

  useEffect(() => {
    if (!activeSessionId) return;
    const interval = setInterval(() => {
      const isIdle = !document.hidden;
      if (isIdle && !isPostInFlight.current) {
        fetchHistorySilently(activeSessionId);
      }
    }, isRealtimeActive ? 60000 : 10000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSessionId, isRealtimeActive]);

  return { isRealtimeActive, sessions, fetchSessions, skipNextHistoryFetch, seenMessageIds };
}
