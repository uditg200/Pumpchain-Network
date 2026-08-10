/**
 * Pumpchain Transaction Engine Types
 *
 * All monetary values use integer base units (lamports, 9 decimals).
 * No floating point arithmetic for balances or fees.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Transaction Types
// ─────────────────────────────────────────────────────────────────────────────

export enum TxType {
  Transfer = 'TRANSFER',
  ContractCall = 'CONTRACT_CALL',
  BridgeDeposit = 'BRIDGE_DEPOSIT',
  BridgeWithdraw = 'BRIDGE_WITHDRAW',
  FaucetClaim = 'FAUCET_CLAIM',
}

// ─────────────────────────────────────────────────────────────────────────────
// Transaction Lifecycle States
// ─────────────────────────────────────────────────────────────────────────────

export enum TxStatus {
  Pending = 'PENDING',
  Validating = 'VALIDATING',
  Executing = 'EXECUTING',
  Confirmed = 'CONFIRMED',
  Rejected = 'REJECTED',
  Failed = 'FAILED',
}

// ─────────────────────────────────────────────────────────────────────────────
// Core Transaction Structure
// ─────────────────────────────────────────────────────────────────────────────

export interface PumpchainTransaction {
  /** SHA-256 hash of canonical serialized transaction data */
  txHash: string;
  /** Sender address (base58) */
  sender: string;
  /** Recipient address (base58) */
  recipient: string;
  /** Sender's nonce (must equal current account nonce) */
  nonce: number;
  /** Transaction type */
  type: TxType;
  /** Amount in base units (integer, no floats) */
  amount: bigint;
  /** Maximum gas this transaction may consume */
  gasLimit: number;
  /** Price per unit of gas in base units */
  gasPrice: number;
  /** Optional calldata / memo */
  inputData: string | null;
  /** Wallet signature (hex) — required for wallet-signed txs */
  signature: string | null;
  /** Unix timestamp in ms when the tx was created */
  timestamp: number;
  /** Current lifecycle status */
  status: TxStatus;
  /** Block number (set after confirmation) */
  blockNumber: number | null;
  /** Actual gas consumed (set after execution) */
  gasUsed: number;
  /** fee = gasUsed * gasPrice (set after execution) */
  fee: bigint;
  /** Error message if rejected/failed */
  errorMessage: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Transaction Submission Input
// ─────────────────────────────────────────────────────────────────────────────

export interface TransactionSubmitInput {
  sender: string;
  recipient: string;
  nonce: number;
  type: TxType;
  /** Amount as string (for JSON transport of bigint) */
  amount: string;
  gasLimit: number;
  gasPrice: number;
  inputData?: string | null;
  signature?: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Transaction Receipt (returned after confirmation)
// ─────────────────────────────────────────────────────────────────────────────

export interface TransactionReceipt {
  txHash: string;
  status: TxStatus;
  blockNumber: number | null;
  gasUsed: number;
  /** fee as string for JSON serialization */
  fee: string;
  sender: string;
  recipient: string;
  /** amount as string for JSON serialization */
  amount: string;
  timestamp: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Gas Estimation
// ─────────────────────────────────────────────────────────────────────────────

export interface GasEstimation {
  gasLimit: number;
  gasPrice: number;
  /** Estimated max fee as string */
  estimatedFee: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Validation Result
// ─────────────────────────────────────────────────────────────────────────────

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}
