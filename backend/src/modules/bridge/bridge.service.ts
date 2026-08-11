import { eq, desc, sql, or } from 'drizzle-orm';
import type { Database } from '../../db/index.js';
import type { SolanaService } from '../solana/solana.service.js';
import type { TransactionService } from '../transactions/transaction.service.js';
import type { AccountService } from '../accounts/account.service.js';
import { bridgeTransactions } from '../../db/schema.js';
import { BridgeDepositService } from './deposit.service.js';
import { BridgeWithdrawalService } from './withdrawal.service.js';
import {
  BridgeStatus,
  type BridgeDepositInput,
  type BridgeWithdrawInput,
  type BridgeOperation,
  type BridgeDashboardStats,
} from './bridge.types.js';

/**
 * BridgeService is the main coordinator for the Pumpchain Testnet Bridge.
 *
 * IMPORTANT: This is a TESTNET BRIDGE PROTOTYPE.
 * It demonstrates cross-chain architecture between Solana Devnet and Pumpchain Testnet.
 * It is NOT a production trustless bridge.
 */
export class BridgeService {
  private readonly depositService: BridgeDepositService;
  private readonly withdrawalService: BridgeWithdrawalService;

  constructor(
    private readonly solanaService: SolanaService,
    private readonly transactionService: TransactionService,
    private readonly accountService: AccountService,
    private readonly db: Database,
  ) {
    this.depositService = new BridgeDepositService(
      solanaService,
      transactionService,
      accountService,
      db,
    );
    this.withdrawalService = new BridgeWithdrawalService(
      accountService,
      transactionService,
      db,
    );
  }

  /**
   * Process a deposit (Solana Devnet → Pumpchain Testnet).
   */
  async deposit(input: BridgeDepositInput): Promise<BridgeOperation> {
    return this.depositService.processDeposit(input);
  }

  /**
   * Process a withdrawal (Pumpchain Testnet → Solana Devnet).
   */
  async withdraw(input: BridgeWithdrawInput): Promise<BridgeOperation> {
    return this.withdrawalService.processWithdrawal(input);
  }

  /**
   * Get a bridge operation by ID.
   */
  async getOperation(bridgeId: string): Promise<BridgeOperation | null> {
    const [row] = await this.db
      .select()
      .from(bridgeTransactions)
      .where(eq(bridgeTransactions.bridgeTxId, bridgeId))
      .limit(1);

    if (!row) return null;
    return this.mapRow(row);
  }

  /**
   * Get bridge history for a wallet address.
   */
  async getHistory(
    walletAddress: string,
    page: number,
    pageSize: number,
  ): Promise<{ operations: BridgeOperation[]; total: number }> {
    const offset = (page - 1) * pageSize;

    const rows = await this.db
      .select()
      .from(bridgeTransactions)
      .where(eq(bridgeTransactions.walletAddress, walletAddress))
      .orderBy(desc(bridgeTransactions.createdAt))
      .limit(pageSize)
      .offset(offset);

    const [countResult] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(bridgeTransactions)
      .where(eq(bridgeTransactions.walletAddress, walletAddress));

    const total = countResult?.count ?? 0;
    const operations = rows.map((r) => this.mapRow(r));

    return { operations, total };
  }

  /**
   * Get dashboard statistics.
   */
  async getDashboardStats(): Promise<BridgeDashboardStats> {
    const [totalResult] = await this.db
      .select({ total: sql<string>`coalesce(sum(amount), 0)::text` })
      .from(bridgeTransactions)
      .where(eq(bridgeTransactions.status, BridgeStatus.Confirmed));

    const [pendingResult] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(bridgeTransactions)
      .where(
        or(
          eq(bridgeTransactions.status, BridgeStatus.Initiated),
          eq(bridgeTransactions.status, BridgeStatus.Detected),
          eq(bridgeTransactions.status, BridgeStatus.Processing),
        ),
      );

    const [completedResult] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(bridgeTransactions)
      .where(eq(bridgeTransactions.status, BridgeStatus.Confirmed));

    const [totalOpsResult] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(bridgeTransactions);

    return {
      totalBridged: totalResult?.total ?? '0',
      pendingTransfers: pendingResult?.count ?? 0,
      completedTransfers: completedResult?.count ?? 0,
      totalOperations: totalOpsResult?.count ?? 0,
    };
  }

  private mapRow(row: typeof bridgeTransactions.$inferSelect): BridgeOperation {
    return {
      id: row.bridgeTxId,
      direction: row.direction as BridgeOperation['direction'],
      sourceChain: row.sourceChain,
      destinationChain: row.destinationChain,
      sourceTxHash: row.sourceTxHash,
      destinationTxHash: row.destinationTxHash,
      walletAddress: row.walletAddress,
      asset: row.asset as BridgeOperation['asset'],
      amount: row.amount,
      status: row.status as BridgeOperation['status'],
      errorMessage: null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.createdAt.toISOString(),
      completedAt: row.completedAt?.toISOString() ?? null,
    };
  }
}
