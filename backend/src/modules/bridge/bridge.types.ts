/**
 * Pumpchain Testnet Bridge Types
 *
 * This is a TESTNET BRIDGE PROTOTYPE — not a production trustless bridge.
 * It demonstrates the architecture of cross-chain asset movement between
 * Solana Devnet (settlement) and Pumpchain Testnet (execution).
 */

// ─────────────────────────────────────────────────────────────────────────────
// Bridge Direction
// ─────────────────────────────────────────────────────────────────────────────

export enum BridgeDirection {
  /** Solana Devnet → Pumpchain Testnet */
  Deposit = 'DEPOSIT',
  /** Pumpchain Testnet → Solana Devnet */
  Withdraw = 'WITHDRAW',
}

// ─────────────────────────────────────────────────────────────────────────────
// Bridge Status State Machine
// ─────────────────────────────────────────────────────────────────────────────

export enum BridgeStatus {
  /** User initiated the bridge operation */
  Initiated = 'INITIATED',
  /** Source transaction detected on-chain */
  Detected = 'DETECTED',
  /** Bridge is processing the cross-chain transfer */
  Processing = 'PROCESSING',
  /** Both sides confirmed, bridge complete */
  Confirmed = 'CONFIRMED',
  /** Bridge operation failed */
  Failed = 'FAILED',
  /** User or system cancelled the operation */
  Cancelled = 'CANCELLED',
}

// ─────────────────────────────────────────────────────────────────────────────
// Supported Bridge Assets
// ─────────────────────────────────────────────────────────────────────────────

export enum BridgeAsset {
  SOL = 'SOL',
  PUMP = 'PUMP',
}

// ─────────────────────────────────────────────────────────────────────────────
// Bridge Operation Record
// ─────────────────────────────────────────────────────────────────────────────

export interface BridgeOperation {
  /** Unique bridge operation ID */
  id: string;
  /** Direction: deposit or withdraw */
  direction: BridgeDirection;
  /** Source chain identifier */
  sourceChain: string;
  /** Destination chain identifier */
  destinationChain: string;
  /** Transaction hash/signature on source chain */
  sourceTxHash: string | null;
  /** Transaction hash on destination chain */
  destinationTxHash: string | null;
  /** User's wallet address (Solana format) */
  walletAddress: string;
  /** Asset being bridged */
  asset: BridgeAsset;
  /** Amount in base units (integer, no floats) */
  amount: string;
  /** Current status */
  status: BridgeStatus;
  /** Error message if failed */
  errorMessage: string | null;
  /** Timestamps */
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// API Input Types
// ─────────────────────────────────────────────────────────────────────────────

export interface BridgeDepositInput {
  /** Solana wallet address (source) */
  walletAddress: string;
  /** Asset to bridge */
  asset: BridgeAsset;
  /** Amount in base units */
  amount: string;
  /** Solana transaction signature (user signed client-side) */
  solanaSignature: string;
}

export interface BridgeWithdrawInput {
  /** Wallet address (same on both chains for prototype) */
  walletAddress: string;
  /** Asset to withdraw */
  asset: BridgeAsset;
  /** Amount in base units */
  amount: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Bridge Dashboard Stats
// ─────────────────────────────────────────────────────────────────────────────

export interface BridgeDashboardStats {
  totalBridged: string;
  pendingTransfers: number;
  completedTransfers: number;
  totalOperations: number;
}
