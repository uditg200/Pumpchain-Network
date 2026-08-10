import { z } from 'zod';

/** Validates a Pumpchain address (base58 encoded, 32-44 chars like Solana) */
export const pumpchainAddressSchema = z
  .string()
  .min(32)
  .max(44)
  .regex(/^[1-9A-HJ-NP-Za-km-z]+$/, 'Invalid base58 address');

/** Validates a transaction hash (64 hex characters) */
export const transactionHashSchema = z
  .string()
  .length(64)
  .regex(/^[a-f0-9]+$/, 'Invalid transaction hash');

/** Pagination parameters */
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

/** Faucet drip request */
export const faucetDripSchema = z.object({
  address: pumpchainAddressSchema,
});

/** Bridge operation request */
export const bridgeOperationSchema = z.object({
  direction: z.enum(['deposit', 'withdraw']),
  solanaAddress: pumpchainAddressSchema,
  pumpchainAddress: pumpchainAddressSchema,
  amount: z
    .string()
    .regex(/^\d+$/, 'Amount must be a numeric string')
    .refine((val) => BigInt(val) > 0n, 'Amount must be positive'),
});

/** Transaction query params */
export const transactionQuerySchema = paginationSchema.extend({
  address: pumpchainAddressSchema.optional(),
  type: z.string().optional(),
  status: z.string().optional(),
});

/** Block query params */
export const blockQuerySchema = paginationSchema;
