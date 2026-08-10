import { eq, desc, sql } from 'drizzle-orm';
import type { Database } from '../index.js';
import { bridgeTransactions } from '../schema.js';

export interface InsertBridgeTransaction {
  bridgeTxId: string;
  direction: string;
  sourceChain: string;
  destinationChain: string;
  sourceTxHash?: string | null;
  destinationTxHash?: string | null;
  walletAddress: string;
  asset: string;
  amount: string;
  status?: string;
}

export class BridgeRepository {
  constructor(private readonly db: Database) {}

  async insert(tx: InsertBridgeTransaction) {
    const [result] = await this.db.insert(bridgeTransactions).values(tx).returning();
    return result;
  }

  async findByBridgeTxId(bridgeTxId: string) {
    const [result] = await this.db
      .select()
      .from(bridgeTransactions)
      .where(eq(bridgeTransactions.bridgeTxId, bridgeTxId))
      .limit(1);
    return result ?? null;
  }

  async findByWallet(walletAddress: string, page: number, pageSize: number) {
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

    return { transactions: rows, total };
  }

  async updateStatus(bridgeTxId: string, status: string, destinationTxHash?: string) {
    const setValues: Record<string, unknown> = { status };
    if (destinationTxHash) {
      setValues['destinationTxHash'] = destinationTxHash;
    }
    if (status === 'finalized' || status === 'confirmed') {
      setValues['completedAt'] = new Date();
    }
    await this.db
      .update(bridgeTransactions)
      .set(setValues)
      .where(eq(bridgeTransactions.bridgeTxId, bridgeTxId));
  }
}
