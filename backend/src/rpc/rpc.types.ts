/**
 * Pumpchain JSON-RPC 2.0 Types
 */

export interface JsonRpcRequest {
  jsonrpc: string;
  id: number | string | null;
  method: string;
  params?: unknown[];
}

export interface JsonRpcSuccessResponse {
  jsonrpc: '2.0';
  id: number | string | null;
  result: unknown;
}

export interface JsonRpcErrorResponse {
  jsonrpc: '2.0';
  id: number | string | null;
  error: JsonRpcError;
}

export interface JsonRpcError {
  code: number;
  message: string;
  data?: unknown;
}

export type JsonRpcResponse = JsonRpcSuccessResponse | JsonRpcErrorResponse;

// Standard JSON-RPC 2.0 error codes
export const RPC_ERRORS = {
  PARSE_ERROR: { code: -32700, message: 'Parse error' },
  INVALID_REQUEST: { code: -32600, message: 'Invalid Request' },
  METHOD_NOT_FOUND: { code: -32601, message: 'Method not found' },
  INVALID_PARAMS: { code: -32602, message: 'Invalid params' },
  INTERNAL_ERROR: { code: -32603, message: 'Internal error' },
  // Custom application errors (-32000 to -32099)
  BLOCK_NOT_FOUND: { code: -32001, message: 'Block not found' },
  TX_NOT_FOUND: { code: -32002, message: 'Transaction not found' },
  ACCOUNT_NOT_FOUND: { code: -32003, message: 'Account not found' },
  TX_VALIDATION_FAILED: { code: -32004, message: 'Transaction validation failed' },
  RATE_LIMITED: { code: -32005, message: 'Rate limit exceeded' },
} as const;
