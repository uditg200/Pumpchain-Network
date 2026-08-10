import { eq, desc, or, sql } from 'drizzle-orm';
import type { Database } from '../index.js';
import { transactions } from '../schema.js';

export interface InsertTransaction {
  txHash: string;
  blockNumber?: number | null;
  sender: string;
  recipient: string;
  amount: string;
  gasLimit: number;
  gasUsed?: number;
  gasPrice: number;
  fee?: string;
  status: string;
  nonce: number;
  inputData?: string | null;
  confirmedAt?: Date | null;
}

export class TransactionRepository {
  constructor(private readonly db: Database) {}

  async insert(tx: InsertTransaction) {
    const [result] = await this.db.insert(transactions).values(tx).returning();
    return result;
  }

  async insertMany(txList: InsertTransaction[]) {
    if (txList.length === 0) return [];
    return this.db.insert(transactions).values(txList).returning();
  }

  async findByHash(txHash: string) {
    const [result] = await this.db
      .select()
      .from(transactions)
      .where(eq(transactions.txHash, txHash))
      .limit(1);
    return result ?? null;
  }

  async findByAddress(address: string, page: number, pageSize: number) {
    const offset = (page - 1) * pageSize;
    const rows = await this.db
      .select()
      .from(transactions)
      .where(or(eq(transactions.sender, address), eq(transactions.recipient, address)))
      .orderBy(desc(transactions.createdAt))
      .limit(pageSize)
      .offset(offset);

    const [countResult] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(transactions)
      .where(or(eq(transactions.sender, address), eq(transactions.recipient, address)));
    const total = countResult?.count ?? 0;

    return { transactions: rows, total };
  }

  async findByBlockNumber(blockNumber: number) {
    return this.db
      .select()
      .from(transactions)
      .where(eq(transactions.blockNumber, blockNumber))
      .orderBy(desc(transactions.createdAt));
  }

  async findMany(page: number, pageSize: number) {
    const offset = (page - 1) * pageSize;
    const rows = await this.db
      .select()
      .from(transactions)
      .orderBy(desc(transactions.createdAt))
      .limit(pageSize)
      .offset(offset);

    const [countResult] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(transactions);
    const total = countResult?.count ?? 0;

    return { transactions: rows, total };
  }

  async updateStatus(txHash: string, status: string, gasUsed: number, fee: string) {
    await this.db
      .update(transactions)
      .set({
        status,
        gasUsed,
        fee,
        confirmedAt: status === 'confirmed' ? new Date() : null,
      })
      .where(eq(transactions.txHash, txHash));
  }

  async getTotalCount(): Promise<number> {
    const [result] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(transactions);
    return result?.count ?? 0;
  }
}
