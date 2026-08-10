import { z } from 'zod';

// ─────────────────────────────────────────────────────────────────────────────
// Address validation (base58, 32-44 characters)
// ─────────────────────────────────────────────────────────────────────────────

const addressSchema = z
  .string()
  .min(32, 'Address too short')
  .max(44, 'Address too long')
  .regex(/^[1-9A-HJ-NP-Za-km-z]+$/, 'Invalid base58 address');

// ─────────────────────────────────────────────────────────────────────────────
// Amount validation: positive integer string, no floats, no negative
// Max safe value: 2^256 represented as string (prevents overflow)
// ─────────────────────────────────────────────────────────────────────────────

const amountSchema = z
  .string()
  .regex(/^\d+$/, 'Amount must be a non-negative integer string')
  .refine((val) => {
    try {
      const n = BigInt(val);
      // Prevent overflow: max 78 digits (same as DB numeric(78,0))
      return n >= 0n && val.length <= 78;
    } catch {
      return false;
    }
  }, 'Amount overflow or invalid');

// ─────────────────────────────────────────────────────────────────────────────
// Transaction submission
// ─────────────────────────────────────────────────────────────────────────────

export const submitTransactionSchema = z.object({
  sender: addressSchema,
  recipient: addressSchema,
  nonce: z.number().int().min(0).max(2_147_483_647),
  type: z.enum(['TRANSFER', 'CONTRACT_CALL', 'BRIDGE_DEPOSIT', 'BRIDGE_WITHDRAW', 'FAUCET_CLAIM']).default('TRANSFER'),
  amount: amountSchema,
  gasLimit: z.number().int().min(1).max(50_000_000),
  gasPrice: z.number().int().min(0).max(1_000_000),
  inputData: z.string().max(10_000).nullable().optional(),
  signature: z.string().min(1).max(256).nullable().optional(),
});

// ─────────────────────────────────────────────────────────────────────────────
// Transaction estimate
// ─────────────────────────────────────────────────────────────────────────────

export const estimateGasSchema = z.object({
  type: z.enum(['TRANSFER', 'CONTRACT_CALL', 'BRIDGE_DEPOSIT', 'BRIDGE_WITHDRAW', 'FAUCET_CLAIM']).optional(),
  inputData: z.string().max(10_000).nullable().optional(),
});

// ─────────────────────────────────────────────────────────────────────────────
// Faucet
// ─────────────────────────────────────────────────────────────────────────────

export const faucetClaimSchema = z.object({
  walletAddress: addressSchema,
});

// ─────────────────────────────────────────────────────────────────────────────
// Bridge
// ─────────────────────────────────────────────────────────────────────────────

export const bridgeDepositSchema = z.object({
  walletAddress: addressSchema,
  asset: z.enum(['SOL', 'PUMP']).default('PUMP'),
  amount: amountSchema,
  solanaSignature: z.string().min(20).max(128),
});

export const bridgeWithdrawSchema = z.object({
  walletAddress: addressSchema,
  asset: z.enum(['SOL', 'PUMP']).default('PUMP'),
  amount: amountSchema,
});

// ─────────────────────────────────────────────────────────────────────────────
// Pagination
// ─────────────────────────────────────────────────────────────────────────────

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.enum(['latest', 'oldest', 'highestGas', 'lowestGas']).optional(),
});

// ─────────────────────────────────────────────────────────────────────────────
// RPC
// ─────────────────────────────────────────────────────────────────────────────

export const rpcRequestSchema = z.object({
  jsonrpc: z.literal('2.0'),
  id: z.union([z.string(), z.number(), z.null()]),
  method: z.string().min(1).max(100),
  params: z.array(z.unknown()).optional(),
});
