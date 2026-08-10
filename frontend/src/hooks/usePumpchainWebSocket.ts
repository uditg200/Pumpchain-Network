import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';

/**
 * WebSocket event types from the Pumpchain backend.
 */
type WsEvent =
  | 'block:new'
  | 'transaction:submitted'
  | 'transaction:confirmed'
  | 'transaction:failed'
  | 'bridge:updated'
  | 'faucet:claimed'
  | 'network:metrics';

interface WsPayload {
  event: WsEvent;
  data: unknown;
  timestamp: number;
}

/**
 * Singleton WebSocket connection manager.
 * Ensures only ONE WebSocket connection exists globally,
 * regardless of how many components use the hook.
 */
let globalWs: WebSocket | null = null;
let globalListeners = new Set<(payload: WsPayload) => void>();
let reconnectAttempt = 0;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let isConnecting = false;

const MAX_RECONNECT_DELAY_MS = 30_000;
const BASE_RECONNECT_DELAY_MS = 1_000;

function getWsUrl(): string {
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${window.location.host}/ws`;
}

function connect(): void {
  if (isConnecting || (globalWs && globalWs.readyState === WebSocket.OPEN)) return;
  isConnecting = true;

  try {
    const ws = new WebSocket(getWsUrl());

    ws.onopen = () => {
      console.log('[WS] Connected');
      isConnecting = false;
      reconnectAttempt = 0;
      globalWs = ws;
    };

    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data) as WsPayload;
        for (const listener of globalListeners) {
          listener(payload);
        }
      } catch { /* ignore parse errors */ }
    };

    ws.onclose = () => {
      isConnecting = false;
      globalWs = null;
      scheduleReconnect();
    };

    ws.onerror = () => {
      isConnecting = false;
      ws.close();
    };
  } catch {
    isConnecting = false;
    scheduleReconnect();
  }
}

function scheduleReconnect(): void {
  if (reconnectTimer) return;
  if (globalListeners.size === 0) return; // No subscribers, don't reconnect

  // Exponential backoff: 1s, 2s, 4s, 8s, 16s, 30s max
  const delay = Math.min(
    BASE_RECONNECT_DELAY_MS * Math.pow(2, reconnectAttempt),
    MAX_RECONNECT_DELAY_MS,
  );
  reconnectAttempt++;

  console.log(`[WS] Reconnecting in ${delay}ms (attempt ${reconnectAttempt})`);
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connect();
  }, delay);
}

function subscribe(listener: (payload: WsPayload) => void): () => void {
  globalListeners.add(listener);

  // Connect if first subscriber
  if (globalListeners.size === 1 && !globalWs) {
    connect();
  }

  // Return unsubscribe function
  return () => {
    globalListeners.delete(listener);
    // Disconnect if no more subscribers
    if (globalListeners.size === 0 && globalWs) {
      globalWs.close();
      globalWs = null;
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
    }
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// React Hook
// ─────────────────────────────────────────────────────────────────────────────

/**
 * usePumpchainWebSocket — subscribes to real-time Pumpchain events.
 *
 * Guarantees:
 * - Single WebSocket connection globally (no duplicates)
 * - Auto-reconnect with exponential backoff
 * - TanStack Query invalidation on relevant events
 * - Cleans up on unmount
 *
 * Place this hook ONCE in a top-level component (e.g., Layout).
 */
export function usePumpchainWebSocket(): void {
  const queryClient = useQueryClient();
  const lastBlockInvalidation = useRef<number>(0);

  useEffect(() => {
    const BLOCK_THROTTLE_MS = 10_000; // Only refresh on block:new at most every 10s

    const handler = (payload: WsPayload) => {
      switch (payload.event) {
        case 'block:new': {
          // Throttle: don't spam refetches on every empty block (every 2s)
          const now = Date.now();
          if (now - lastBlockInvalidation.current < BLOCK_THROTTLE_MS) break;
          lastBlockInvalidation.current = now;

          queryClient.invalidateQueries({ queryKey: ['explorer-overview'] });
          queryClient.invalidateQueries({ queryKey: ['network-stats'] });
          queryClient.invalidateQueries({ queryKey: ['sequencer-metrics'] });
          queryClient.invalidateQueries({ queryKey: ['sequencer-metrics-home'] });
          break;
        }

        case 'transaction:submitted':
          // Update transaction lists
          queryClient.invalidateQueries({ queryKey: ['explorer-txs'] });
          break;

        case 'transaction:confirmed':
          // Update tx detail, wallet activity, balances
          queryClient.invalidateQueries({ queryKey: ['explorer-txs'] });
          queryClient.invalidateQueries({ queryKey: ['explorer-overview'] });
          queryClient.invalidateQueries({ queryKey: ['wallet-account'] });
          queryClient.invalidateQueries({ queryKey: ['wallet-tx-history'] });
          queryClient.invalidateQueries({ queryKey: ['pumpchain-balance'] });
          break;

        case 'transaction:failed':
          queryClient.invalidateQueries({ queryKey: ['explorer-txs'] });
          queryClient.invalidateQueries({ queryKey: ['wallet-tx-history'] });
          break;

        case 'bridge:updated':
          queryClient.invalidateQueries({ queryKey: ['bridge-stats'] });
          queryClient.invalidateQueries({ queryKey: ['bridge-stats-home'] });
          queryClient.invalidateQueries({ queryKey: ['bridge-history'] });
          break;

        case 'faucet:claimed':
          queryClient.invalidateQueries({ queryKey: ['faucet-data'] });
          queryClient.invalidateQueries({ queryKey: ['wallet-account'] });
          queryClient.invalidateQueries({ queryKey: ['pumpchain-balance'] });
          break;

        case 'network:metrics':
          queryClient.invalidateQueries({ queryKey: ['network-stats'] });
          queryClient.invalidateQueries({ queryKey: ['sequencer-metrics'] });
          queryClient.invalidateQueries({ queryKey: ['sequencer-metrics-home'] });
          break;
      }
    };

    const unsubscribe = subscribe(handler);
    return unsubscribe;
  }, [queryClient]);
}
