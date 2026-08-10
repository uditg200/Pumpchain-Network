/**
 * Database model schemas for Drizzle ORM
 * These define the shape of data stored in the Pumpchain database.
 */

export interface BlockRecord {
  height: number;
  hash: string;
  parentHash: string;
  timestamp: Date;
  transactionCount: number;
  gasUsed: number;
  gasLimit: number;
  sequencer: string;
  createdAt: Date;
}

export interface TransactionRecord {
  hash: string;
  blockHeight: number | null;
  fromAddress: string;
  toAddress: string;
  amount: string; // Stored as string for bigint compatibility
  gasPrice: number;
  gasUsed: number;
  nonce: number;
  type: string;
  status: string;
  data: string | null;
  timestamp: Date;
  createdAt: Date;
}

export interface AccountRecord {
  address: string;
  balance: string; // Stored as string for bigint compatibility
  nonce: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface BridgeOperationRecord {
  id: string;
  direction: string;
  solanaAddress: string;
  pumpchainAddress: string;
  amount: string;
  status: string;
  solanaTxHash: string | null;
  pumpchainTxHash: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface FaucetRequestRecord {
  id: string;
  address: string;
  amount: string;
  txHash: string;
  createdAt: Date;
}
