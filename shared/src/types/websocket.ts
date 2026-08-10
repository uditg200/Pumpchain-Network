import type { PumpchainBlock, PumpchainTransaction, NetworkStats } from './blockchain.js';

export enum WsEventType {
  NewBlock = 'new_block',
  NewTransaction = 'new_transaction',
  NetworkStatsUpdate = 'network_stats_update',
  Subscribe = 'subscribe',
  Unsubscribe = 'unsubscribe',
  Error = 'error',
}

export enum WsChannel {
  Blocks = 'blocks',
  Transactions = 'transactions',
  NetworkStats = 'network_stats',
  AccountUpdates = 'account_updates',
}

export interface WsMessage<T = unknown> {
  event: WsEventType;
  channel?: WsChannel;
  data: T;
  timestamp: number;
}

export interface WsNewBlockEvent {
  block: PumpchainBlock;
}

export interface WsNewTransactionEvent {
  transaction: PumpchainTransaction;
}

export interface WsNetworkStatsEvent {
  stats: NetworkStats;
}

export interface WsSubscribeMessage {
  event: WsEventType.Subscribe;
  channel: WsChannel;
  params?: Record<string, string>;
}

export interface WsUnsubscribeMessage {
  event: WsEventType.Unsubscribe;
  channel: WsChannel;
}
