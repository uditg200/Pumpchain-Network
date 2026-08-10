import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'http';

// ─────────────────────────────────────────────────────────────────────────────
// WebSocket Event Types
// ─────────────────────────────────────────────────────────────────────────────

export enum WsEvent {
  BlockNew = 'block:new',
  TransactionSubmitted = 'transaction:submitted',
  TransactionConfirmed = 'transaction:confirmed',
  TransactionFailed = 'transaction:failed',
  BridgeUpdated = 'bridge:updated',
  FaucetClaimed = 'faucet:claimed',
  NetworkMetrics = 'network:metrics',
}

export interface WsPayload {
  event: WsEvent;
  data: unknown;
  timestamp: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Server singleton
// ─────────────────────────────────────────────────────────────────────────────

let wss: WebSocketServer | null = null;

export function initWebSocket(server: Server): WebSocketServer {
  wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws) => {
    console.log(`[WebSocket] Client connected (total: ${wss!.clients.size})`);

    ws.on('close', () => {
      console.log(`[WebSocket] Client disconnected (total: ${wss!.clients.size})`);
    });

    ws.on('error', (err) => {
      console.error('[WebSocket] Error:', err.message);
    });
  });

  console.log('[WebSocket] Server initialized on /ws');
  return wss;
}

// ─────────────────────────────────────────────────────────────────────────────
// Broadcasting
// ─────────────────────────────────────────────────────────────────────────────

function broadcast(event: WsEvent, data: unknown): void {
  if (!wss) return;
  const payload: WsPayload = { event, data, timestamp: Date.now() };
  const message = JSON.stringify(payload);

  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  }
}

// ─── Event-specific broadcast helpers ────────────────────────────────────────

export function broadcastNewBlock(block: {
  blockNumber: number;
  blockHash: string;
  transactionCount: number;
  gasUsed: number;
  timestamp: number;
}): void {
  broadcast(WsEvent.BlockNew, block);
}

export function broadcastTransactionSubmitted(tx: {
  txHash: string;
  sender: string;
  recipient: string;
  amount: string;
  type: string;
}): void {
  broadcast(WsEvent.TransactionSubmitted, tx);
}

export function broadcastTransactionConfirmed(tx: {
  txHash: string;
  blockNumber: number;
  gasUsed: number;
  fee: string;
  sender: string;
  recipient: string;
}): void {
  broadcast(WsEvent.TransactionConfirmed, tx);
}

export function broadcastTransactionFailed(tx: {
  txHash: string;
  blockNumber: number;
  error: string;
}): void {
  broadcast(WsEvent.TransactionFailed, tx);
}

export function broadcastBridgeUpdated(op: {
  id: string;
  direction: string;
  status: string;
  amount: string;
  asset: string;
  walletAddress: string;
}): void {
  broadcast(WsEvent.BridgeUpdated, op);
}

export function broadcastFaucetClaimed(claim: {
  walletAddress: string;
  amount: string;
  asset: string;
  txHash: string;
}): void {
  broadcast(WsEvent.FaucetClaimed, claim);
}

export function broadcastNetworkMetrics(metrics: {
  blockHeight: number;
  tps: number;
  totalTransactions: number;
  activeAccounts: number;
  pendingTransactions: number;
}): void {
  broadcast(WsEvent.NetworkMetrics, metrics);
}

// ─────────────────────────────────────────────────────────────────────────────
// Lifecycle
// ─────────────────────────────────────────────────────────────────────────────

export function closeWebSocket(): Promise<void> {
  return new Promise((resolve) => {
    if (!wss) { resolve(); return; }
    for (const client of wss.clients) { client.terminate(); }
    wss.close(() => { console.log('[WebSocket] Server closed'); wss = null; resolve(); });
  });
}

export function getConnectedClients(): number {
  return wss?.clients.size ?? 0;
}
