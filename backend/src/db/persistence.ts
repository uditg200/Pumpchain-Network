import { eq, desc, sql } from 'drizzle-orm';
import { db } from './index.js';
import { blocks, transactions, accounts } from './schema.js';
import type { PumpchainBlockData } from '../modules/blocks/block.types.js';
import type { PumpchainTransaction } from '../modules/transactions/transaction.types.js';
import type { PumpchainAccountData } from '../modules/accounts/account.types.js';

/**
 * Persistence layer — writes in-memory state to PostgreSQL.
 * Called after each block production and bridge operation.
 */

// ─── Blocks ──────────────────────────────────────────────────────────────────

export async function persistBlock(block: PumpchainBlockData): Promise<void> {
  try {
    await db.insert(blocks).values({
      blockNumber: block.blockNumber,
      blockHash: block.blockHash,
      parentHash: block.parentHash,
      stateRoot: block.stateRoot,
      timestamp: new Date(block.timestamp),
      sequencer: block.proposer,
      transactionCount: block.transactionCount,
      gasUsed: block.gasUsed,
      gasLimit: block.gasLimit,
    }).onConflictDoNothing();
  } catch (err) {
    console.error('[Persistence] Failed to persist block:', (err as Error).message);
  }
}

// ─── Transactions ────────────────────────────────────────────────────────────

export async function persistTransaction(tx: PumpchainTransaction): Promise<void> {
  try {
    await db.insert(transactions).values({
      txHash: tx.txHash,
      blockNumber: tx.blockNumber,
      sender: tx.sender,
      recipient: tx.recipient,
      amount: tx.amount.toString(),
      gasLimit: tx.gasLimit,
      gasUsed: tx.gasUsed,
      gasPrice: tx.gasPrice,
      fee: tx.fee.toString(),
      status: tx.status,
      nonce: tx.nonce,
      inputData: tx.inputData,
      confirmedAt: tx.status === 'CONFIRMED' ? new Date() : null,
    }).onConflictDoNothing();
  } catch (err) {
    console.error('[Persistence] Failed to persist transaction:', (err as Error).message);
  }
}

// ─── Accounts ────────────────────────────────────────────────────────────────

export async function persistAccount(account: PumpchainAccountData): Promise<void> {
  try {
    await db.insert(accounts).values({
      address: account.address,
      accountType: 'user',
      balance: account.balance.toString(),
      nonce: account.nonce,
    }).onConflictDoUpdate({
      target: accounts.address,
      set: {
        balance: account.balance.toString(),
        nonce: account.nonce,
        updatedAt: new Date(),
      },
    });
  } catch (err) {
    console.error('[Persistence] Failed to persist account:', (err as Error).message);
  }
}

// ─── Load State on Startup ───────────────────────────────────────────────────

export async function loadBlocks(): Promise<PumpchainBlockData[]> {
  try {
    const rows = await db.select().from(blocks).orderBy(blocks.blockNumber);
    return rows.map((r) => ({
      blockNumber: r.blockNumber,
      blockHash: r.blockHash,
      parentHash: r.parentHash,
      stateRoot: r.stateRoot,
      timestamp: r.timestamp.getTime(),
      proposer: r.sequencer,
      transactionCount: r.transactionCount,
      gasUsed: r.gasUsed,
      gasLimit: r.gasLimit,
      previousStateRoot: '', // Not stored separately, stateRoot is sufficient
    }));
  } catch (err) {
    console.error('[Persistence] Failed to load blocks:', (err as Error).message);
    return [];
  }
}

export async function loadTransactions(): Promise<PumpchainTransaction[]> {
  try {
    const rows = await db.select().from(transactions).orderBy(desc(transactions.createdAt));
    return rows.map((r) => ({
      txHash: r.txHash,
      sender: r.sender,
      recipient: r.recipient,
      nonce: r.nonce,
      type: (r.inputData?.includes('bridge:deposit') ? 'BRIDGE_DEPOSIT' :
             r.inputData?.includes('bridge:withdraw') ? 'BRIDGE_WITHDRAW' :
             r.inputData?.includes('faucet') ? 'FAUCET_CLAIM' : 'TRANSFER') as any,
      amount: BigInt(r.amount),
      gasLimit: r.gasLimit,
      gasPrice: r.gasPrice,
      inputData: r.inputData,
      signature: null,
      timestamp: r.createdAt.getTime(),
      status: r.status as any,
      blockNumber: r.blockNumber,
      gasUsed: r.gasUsed,
      fee: BigInt(r.fee),
      errorMessage: null,
    }));
  } catch (err) {
    console.error('[Persistence] Failed to load transactions:', (err as Error).message);
    return [];
  }
}

export async function loadAccounts(): Promise<PumpchainAccountData[]> {
  try {
    const rows = await db.select().from(accounts);
    return rows.map((r) => ({
      address: r.address,
      balance: BigInt(r.balance),
      nonce: r.nonce,
      createdAt: r.createdAt.getTime(),
      updatedAt: r.updatedAt.getTime(),
    }));
  } catch (err) {
    console.error('[Persistence] Failed to load accounts:', (err as Error).message);
    return [];
  }
}
