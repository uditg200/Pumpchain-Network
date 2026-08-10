/**
 * API Contract definitions
 * These define the request/response shapes for each API endpoint.
 */

import type {
  PumpchainBlock,
  PumpchainTransaction,
  PumpchainAccount,
  NetworkStats,
  BridgeOperation,
  FaucetRequest,
} from '../types/blockchain.js';
import type { ApiResponse, PaginationParams, HealthCheckResponse } from '../types/api.js';

// --- Health ---
export type GetHealthResponse = ApiResponse<HealthCheckResponse>;

// --- Blocks ---
export type GetBlocksParams = PaginationParams;
export type GetBlocksResponse = ApiResponse<PumpchainBlock[]>;
export type GetBlockByHeightResponse = ApiResponse<PumpchainBlock>;

// --- Transactions ---
export type GetTransactionsParams = PaginationParams & {
  address?: string;
  type?: string;
  status?: string;
};
export type GetTransactionsResponse = ApiResponse<PumpchainTransaction[]>;
export type GetTransactionByHashResponse = ApiResponse<PumpchainTransaction>;

// --- Accounts ---
export type GetAccountResponse = ApiResponse<PumpchainAccount>;
export type GetAccountTransactionsParams = PaginationParams;
export type GetAccountTransactionsResponse = ApiResponse<PumpchainTransaction[]>;

// --- Network ---
export type GetNetworkStatsResponse = ApiResponse<NetworkStats>;

// --- Bridge ---
export interface CreateBridgeOperationRequest {
  direction: 'deposit' | 'withdraw';
  solanaAddress: string;
  pumpchainAddress: string;
  amount: string; // String representation of bigint
}
export type CreateBridgeOperationResponse = ApiResponse<BridgeOperation>;
export type GetBridgeOperationsParams = PaginationParams & {
  address?: string;
};
export type GetBridgeOperationsResponse = ApiResponse<BridgeOperation[]>;

// --- Faucet ---
export interface FaucetDripRequest {
  address: string;
}
export type FaucetDripResponse = ApiResponse<FaucetRequest>;
