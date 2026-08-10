import {
  pgTable,
  serial,
  text,
  integer,
  timestamp,
  varchar,
  index,
  uniqueIndex,
  numeric,
  jsonb,
  boolean,
} from 'drizzle-orm/pg-core';

// ─────────────────────────────────────────────────────────────────────────────
// 1. network_metadata
// ─────────────────────────────────────────────────────────────────────────────

export const networkMetadata = pgTable('network_metadata', {
  id: serial('id').primaryKey(),
  networkName: varchar('network_name', { length: 128 }).notNull(),
  chainId: varchar('chain_id', { length: 64 }).notNull().unique(),
  environment: varchar('environment', { length: 32 }).notNull(),
  nativeTokenSymbol: varchar('native_token_symbol', { length: 16 }).notNull(),
  genesisHash: varchar('genesis_hash', { length: 64 }).notNull(),
  currentBlockHeight: integer('current_block_height').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. blocks
// ─────────────────────────────────────────────────────────────────────────────

export const blocks = pgTable(
  'blocks',
  {
    id: serial('id').primaryKey(),
    blockNumber: integer('block_number').notNull(),
    blockHash: varchar('block_hash', { length: 64 }).notNull(),
    parentHash: varchar('parent_hash', { length: 64 }).notNull(),
    stateRoot: varchar('state_root', { length: 64 }).notNull(),
    timestamp: timestamp('timestamp', { withTimezone: true }).notNull(),
    sequencer: varchar('sequencer', { length: 64 }).notNull(),
    transactionCount: integer('transaction_count').notNull().default(0),
    gasUsed: integer('gas_used').notNull().default(0),
    gasLimit: integer('gas_limit').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    blockNumberIdx: uniqueIndex('blocks_block_number_idx').on(table.blockNumber),
    blockHashIdx: uniqueIndex('blocks_block_hash_idx').on(table.blockHash),
    timestampIdx: index('blocks_timestamp_idx').on(table.timestamp),
  }),
);

// ─────────────────────────────────────────────────────────────────────────────
// 3. transactions
// ─────────────────────────────────────────────────────────────────────────────

export const transactions = pgTable(
  'transactions',
  {
    id: serial('id').primaryKey(),
    txHash: varchar('tx_hash', { length: 64 }).notNull(),
    blockNumber: integer('block_number'),
    sender: varchar('sender', { length: 44 }).notNull(),
    recipient: varchar('recipient', { length: 44 }).notNull(),
    /** Stored as numeric(78,0) to support full uint256 range without float precision loss */
    amount: numeric('amount', { precision: 78, scale: 0 }).notNull().default('0'),
    gasLimit: integer('gas_limit').notNull(),
    gasUsed: integer('gas_used').notNull().default(0),
    gasPrice: integer('gas_price').notNull(),
    /** fee = gasUsed * gasPrice, stored as numeric for precision */
    fee: numeric('fee', { precision: 78, scale: 0 }).notNull().default('0'),
    status: varchar('status', { length: 16 }).notNull().default('pending'),
    nonce: integer('nonce').notNull(),
    inputData: text('input_data'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    confirmedAt: timestamp('confirmed_at', { withTimezone: true }),
  },
  (table) => ({
    txHashIdx: uniqueIndex('transactions_tx_hash_idx').on(table.txHash),
    senderIdx: index('transactions_sender_idx').on(table.sender),
    recipientIdx: index('transactions_recipient_idx').on(table.recipient),
    blockNumberIdx: index('transactions_block_number_idx').on(table.blockNumber),
    createdAtIdx: index('transactions_created_at_idx').on(table.createdAt),
  }),
);

// ─────────────────────────────────────────────────────────────────────────────
// 4. accounts
// ─────────────────────────────────────────────────────────────────────────────

export const accounts = pgTable(
  'accounts',
  {
    id: serial('id').primaryKey(),
    address: varchar('address', { length: 44 }).notNull(),
    accountType: varchar('account_type', { length: 32 }).notNull().default('user'),
    /** Stored as numeric(78,0) for precision - never use JS floats */
    balance: numeric('balance', { precision: 78, scale: 0 }).notNull().default('0'),
    nonce: integer('nonce').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    addressIdx: uniqueIndex('accounts_address_idx').on(table.address),
  }),
);

// ─────────────────────────────────────────────────────────────────────────────
// 5. token_balances
// ─────────────────────────────────────────────────────────────────────────────

export const tokenBalances = pgTable(
  'token_balances',
  {
    id: serial('id').primaryKey(),
    address: varchar('address', { length: 44 }).notNull(),
    tokenSymbol: varchar('token_symbol', { length: 16 }).notNull(),
    tokenMint: varchar('token_mint', { length: 44 }).notNull(),
    /** Stored as numeric(78,0) for precision */
    balance: numeric('balance', { precision: 78, scale: 0 }).notNull().default('0'),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    addressTokenIdx: uniqueIndex('token_balances_address_token_idx').on(
      table.address,
      table.tokenMint,
    ),
    addressIdx: index('token_balances_address_idx').on(table.address),
  }),
);

// ─────────────────────────────────────────────────────────────────────────────
// 6. bridge_transactions
// ─────────────────────────────────────────────────────────────────────────────

export const bridgeTransactions = pgTable(
  'bridge_transactions',
  {
    id: serial('id').primaryKey(),
    bridgeTxId: varchar('bridge_tx_id', { length: 36 }).notNull(),
    direction: varchar('direction', { length: 16 }).notNull(), // 'deposit' | 'withdraw'
    sourceChain: varchar('source_chain', { length: 32 }).notNull(),
    destinationChain: varchar('destination_chain', { length: 32 }).notNull(),
    sourceTxHash: varchar('source_tx_hash', { length: 128 }),
    destinationTxHash: varchar('destination_tx_hash', { length: 128 }),
    walletAddress: varchar('wallet_address', { length: 44 }).notNull(),
    asset: varchar('asset', { length: 16 }).notNull(),
    /** Stored as numeric(78,0) for precision */
    amount: numeric('amount', { precision: 78, scale: 0 }).notNull(),
    status: varchar('status', { length: 16 }).notNull().default('pending'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
  },
  (table) => ({
    bridgeTxIdIdx: uniqueIndex('bridge_transactions_bridge_tx_id_idx').on(table.bridgeTxId),
    walletAddressIdx: index('bridge_transactions_wallet_address_idx').on(table.walletAddress),
    statusIdx: index('bridge_transactions_status_idx').on(table.status),
  }),
);

// ─────────────────────────────────────────────────────────────────────────────
// 7. faucet_claims
// ─────────────────────────────────────────────────────────────────────────────

export const faucetClaims = pgTable(
  'faucet_claims',
  {
    id: serial('id').primaryKey(),
    walletAddress: varchar('wallet_address', { length: 44 }).notNull(),
    asset: varchar('asset', { length: 16 }).notNull(),
    /** Stored as numeric(78,0) for precision */
    amount: numeric('amount', { precision: 78, scale: 0 }).notNull(),
    ipHash: varchar('ip_hash', { length: 64 }).notNull(),
    claimTimestamp: timestamp('claim_timestamp', { withTimezone: true }).notNull().defaultNow(),
    cooldownUntil: timestamp('cooldown_until', { withTimezone: true }).notNull(),
  },
  (table) => ({
    walletAddressIdx: index('faucet_claims_wallet_address_idx').on(table.walletAddress),
    ipHashIdx: index('faucet_claims_ip_hash_idx').on(table.ipHash),
    cooldownIdx: index('faucet_claims_cooldown_idx').on(table.cooldownUntil),
  }),
);

// ─────────────────────────────────────────────────────────────────────────────
// 8. network_metrics
// ─────────────────────────────────────────────────────────────────────────────

export const networkMetrics = pgTable(
  'network_metrics',
  {
    id: serial('id').primaryKey(),
    timestamp: timestamp('timestamp', { withTimezone: true }).notNull().defaultNow(),
    blockHeight: integer('block_height').notNull(),
    tps: numeric('tps', { precision: 10, scale: 2 }).notNull().default('0'),
    totalTransactions: integer('total_transactions').notNull().default(0),
    activeAccounts: integer('active_accounts').notNull().default(0),
    gasUsed: numeric('gas_used', { precision: 78, scale: 0 }).notNull().default('0'),
    totalGasFees: numeric('total_gas_fees', { precision: 78, scale: 0 }).notNull().default('0'),
  },
  (table) => ({
    timestampIdx: index('network_metrics_timestamp_idx').on(table.timestamp),
    blockHeightIdx: index('network_metrics_block_height_idx').on(table.blockHeight),
  }),
);

// ─────────────────────────────────────────────────────────────────────────────
// 9. sequencer_events
// ─────────────────────────────────────────────────────────────────────────────

export const sequencerEvents = pgTable(
  'sequencer_events',
  {
    id: serial('id').primaryKey(),
    eventType: varchar('event_type', { length: 64 }).notNull(),
    blockNumber: integer('block_number'),
    eventData: jsonb('event_data'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    eventTypeIdx: index('sequencer_events_event_type_idx').on(table.eventType),
    blockNumberIdx: index('sequencer_events_block_number_idx').on(table.blockNumber),
    createdAtIdx: index('sequencer_events_created_at_idx').on(table.createdAt),
  }),
);
