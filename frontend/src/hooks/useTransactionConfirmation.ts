import { useState, useEffect, useRef, useCallback } from 'react';

export type TxConfirmationStatus =
  | 'idle'
  | 'preparing'
  | 'waiting_signature'
  | 'submitted'
  | 'pending'
  | 'confirmed'
  | 'failed';

interface ConfirmationResult {
  status: TxConfirmationStatus;
  txHash: string | null;
  blockNumber: number | null;
  error: string | null;
}

/**
 * Hook that monitors transaction confirmation via WebSocket with polling fallback.
 * Does NOT update balance optimistically — only after confirmed.
 */
export function useTransactionConfirmation() {
  const [result, setResult] = useState<ConfirmationResult>({
    status: 'idle',
    txHash: null,
    blockNumber: null,
    error: null,
  });

  const wsRef = useRef<WebSocket | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const cleanup = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  const waitForConfirmation = useCallback(
    (txHash: string) => {
      cleanup();
      setResult({ status: 'pending', txHash, blockNumber: null, error: null });

      // Try WebSocket first
      try {
        const wsUrl = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws`;
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data);
            if (msg.event === 'transaction:confirmed' && msg.data?.txHash === txHash) {
              setResult({
                status: 'confirmed',
                txHash,
                blockNumber: msg.data.blockNumber,
                error: null,
              });
              cleanup();
            }
            if (msg.event === 'transaction:failed' && msg.data?.txHash === txHash) {
              setResult({
                status: 'failed',
                txHash,
                blockNumber: msg.data.blockNumber,
                error: msg.data.error ?? 'Transaction failed',
              });
              cleanup();
            }
          } catch { /* ignore parse errors */ }
        };

        ws.onerror = () => {
          // WebSocket failed, fall through to polling
          ws.close();
          startPolling(txHash);
        };

        ws.onclose = () => {
          // If not yet confirmed, start polling
          if (
            result.status !== 'confirmed' &&
            result.status !== 'failed'
          ) {
            startPolling(txHash);
          }
        };
      } catch {
        // WebSocket not available, use polling
        startPolling(txHash);
      }
    },
    [cleanup],
  );

  const startPolling = useCallback(
    (txHash: string) => {
      if (pollRef.current) return; // Already polling

      pollRef.current = setInterval(async () => {
        try {
          const res = await fetch(`/api/transactions/${txHash}/status`);
          const json = await res.json();
          if (!json.success) return;

          const { status } = json.data;
          if (status === 'CONFIRMED') {
            setResult((prev) => ({
              ...prev,
              status: 'confirmed',
              blockNumber: json.data.blockNumber ?? null,
            }));
            cleanup();
          } else if (status === 'FAILED') {
            setResult((prev) => ({
              ...prev,
              status: 'failed',
              error: json.data.errorMessage ?? 'Transaction failed',
            }));
            cleanup();
          }
        } catch { /* retry next interval */ }
      }, 2500);
    },
    [cleanup],
  );

  const reset = useCallback(() => {
    cleanup();
    setResult({ status: 'idle', txHash: null, blockNumber: null, error: null });
  }, [cleanup]);

  const setStatus = useCallback((status: TxConfirmationStatus, txHash?: string) => {
    setResult((prev) => ({ ...prev, status, txHash: txHash ?? prev.txHash }));
  }, []);

  return { ...result, waitForConfirmation, reset, setStatus };
}
