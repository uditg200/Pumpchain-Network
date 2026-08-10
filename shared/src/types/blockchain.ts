import { TransactionStatus, TransactionType } from '../enums/transaction.js';
import { NetworkStatus, BridgeDirection, BridgeStatus } from '../enums/network.js';

/** Pumpchain account representation */
export interface PumpchainAccount {
  address: string;
  balance: bigint;
  nonce: number;
  createdAt: Date;
  updatedAt: Date;
}

/** Pumpchain block */
export interface PumpchainBlock {
  height: number;
  hash: string;
  parentHash: string;
  timestamp: Date;
  transactionCount: number;
  gasUsed: number;
  gasLimit: number;
  sequencer: string;
}

/** Pumpchain transaction */
export interface PumpchainTransaction {
  hash: string;
  blockHeight: number | null;
  from: string;
  to: string;
  amount: bigint;
  gasPrice: number;
  gasUsed: number;
  nonce: number;
  type: TransactionType;
  status: TransactionStatus;
  timestamp: Date;
  data?: string;
}

/** Bridge operation between Solana and Pumpchain */
export interface BridgeOperation {
  id: string;
  direction: BridgeDirection;
  solanaAddress: string;
  pumpchainAddress: string;
  amount: bigint;
  status: BridgeStatus;
  solanaTxHash?: string;
  pumpchainTxHash?: string;
  createdAt: Date;
  updatedAt: Date;
}

/** Network statistics */
export interface NetworkStats {
  status: NetworkStatus;
  currentBlockHeight: number;
  totalTransactions: number;
  totalAccounts: number;
  tps: number;
  avgBlockTime: number;
  gasPrice: number;
  totalSupply: bigint;
}

/** Faucet request */
export interface FaucetRequest {
  address: string;
  amount: bigint;
  txHash: string;
  timestamp: Date;
}
