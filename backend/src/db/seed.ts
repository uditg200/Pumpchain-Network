import { db } from './index.js';
import { createRepositories } from './repositories/index.js';
import { createGenesisBlock } from '../modules/blocks/block.producer.js';
import { env } from '../config/env.js';
import {
  PUMPCHAIN_NETWORK_ID,
  PUMPCHAIN_CHAIN_NAME,
  PUMPCHAIN_NATIVE_SYMBOL,
  PUMPCHAIN_ENVIRONMENT,
  FAUCET_AMOUNT,
} from '@pumpchain/shared';

/**
 * Test accounts for the Pumpchain testnet.
 * These are seeded with initial PUMP balances.
 * No private keys are stored — these are just address + balance state.
 */
const TEST_ACCOUNTS = [
  {
    address: 'PumpTestAcct1111111111111111111111111111111',
    accountType: 'test',
    balance: '100000000000000', // 100,000 PUMP (9 decimals)
  },
  {
    address: 'PumpTestAcct2222222222222222222222222222222',
    accountType: 'test',
    balance: '50000000000000', // 50,000 PUMP
  },
  {
    address: 'PumpTestAcct3333333333333333333333333333333',
    accountType: 'test',
    balance: '25000000000000', // 25,000 PUMP
  },
  {
    address: 'PumpFaucetReserve111111111111111111111111',
    accountType: 'system',
    balance: '1000000000000000', // 1,000,000 PUMP (faucet reserve)
  },
  {
    address: 'PumpBridgeReserve111111111111111111111111',
    accountType: 'system',
    balance: '10000000000000000', // 10,000,000 nPUMP (bridge reserve)
  },
];

/**
 * Seeds the database with initial data.
 * This function is IDEMPOTENT — safe to run multiple times.
 */
export async function seedDatabase(): Promise<void> {
  const repos = createRepositories(db);

  console.log('[Seed] Starting database seed...');

  // 1. Seed network metadata (upsert = idempotent)
  const genesis = createGenesisBlock(Date.now());

  await repos.networkMetadata.upsert({
    networkName: PUMPCHAIN_CHAIN_NAME,
    chainId: PUMPCHAIN_NETWORK_ID,
    environment: PUMPCHAIN_ENVIRONMENT,
    nativeTokenSymbol: PUMPCHAIN_NATIVE_SYMBOL,
    genesisHash: genesis.blockHash,
    currentBlockHeight: 0,
  });
  console.log('[Seed] Network metadata seeded');

  // 2. Seed genesis block (check if exists first = idempotent)
  const existingGenesis = await repos.blocks.findByNumber(0);
  if (!existingGenesis) {
    await repos.blocks.insert({
      blockNumber: genesis.blockNumber,
      blockHash: genesis.blockHash,
      parentHash: genesis.parentHash,
      stateRoot: genesis.stateRoot,
      timestamp: new Date(genesis.timestamp),
      sequencer: genesis.proposer,
      transactionCount: genesis.transactionCount,
      gasUsed: genesis.gasUsed,
      gasLimit: genesis.gasLimit,
    });
    console.log('[Seed] Genesis block created');
  } else {
    console.log('[Seed] Genesis block already exists, skipping');
  }

  // 3. Seed test accounts (upsert = idempotent)
  for (const account of TEST_ACCOUNTS) {
    await repos.accounts.upsert(account);
  }
  console.log(`[Seed] ${TEST_ACCOUNTS.length} test accounts seeded`);

  // 4. Seed initial network metrics snapshot
  const latestMetric = await repos.metrics.findLatestOne();
  if (!latestMetric) {
    await repos.metrics.insert({
      blockHeight: 0,
      tps: '0',
      totalTransactions: 0,
      activeAccounts: TEST_ACCOUNTS.length,
      gasUsed: '0',
      totalGasFees: '0',
    });
    console.log('[Seed] Initial network metrics snapshot created');
  }

  console.log('[Seed] Database seed complete');
}

// Allow running directly: npx tsx src/db/seed.ts
const isDirectRun = process.argv[1]?.endsWith('seed.ts') || process.argv[1]?.endsWith('seed.js');
if (isDirectRun) {
  seedDatabase()
    .then(() => {
      console.log('[Seed] Done');
      process.exit(0);
    })
    .catch((err) => {
      console.error('[Seed] Failed:', err);
      process.exit(1);
    });
}

