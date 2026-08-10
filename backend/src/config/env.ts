import dotenv from 'dotenv';
import { z } from 'zod';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: resolve(__dirname, '../../.env') });

const envSchema = z.object({
  PORT: z.coerce.number().default(3001),
  DATABASE_URL: z.string().min(1),
  SOLANA_RPC_URL: z.string().url().default('https://api.devnet.solana.com'),
  PUMPCHAIN_NETWORK_ID: z.string().default('pumpchain-mainnet'),
  PUMPCHAIN_CHAIN_NAME: z.string().default('Pumpchain Network'),
  PUMPCHAIN_NATIVE_SYMBOL: z.string().default('PUMP'),
  PUMPCHAIN_ENVIRONMENT: z.enum(['testnet', 'mainnet', 'devnet']).default('mainnet'),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  BRIDGE_WALLET_PRIVATE_KEY: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('[Pumpchain Backend] Invalid environment variables:');
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export type Env = z.infer<typeof envSchema>;
