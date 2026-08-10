import type { NetworkStatus } from '@pumpchain/shared';

export interface NetworkInfo {
  networkId: string;
  chainName: string;
  nativeSymbol: string;
  environment: string;
  genesisTimestamp: number;
  currentBlockHeight: number;
  latestBlockHash: string;
  tps: number;
  totalTransactions: number;
  activeAccounts: number;
  status: NetworkStatus;
}

export interface NetworkStatusSummary {
  status: NetworkStatus;
  blockHeight: number;
  tps: number;
  avgBlockTimeMs: number;
  gasPrice: number;
}
