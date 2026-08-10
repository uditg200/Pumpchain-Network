import { eq, desc, sql } from 'drizzle-orm';
import type { Database } from '../index.js';
import { blocks } from '../schema.js';

export interface InsertBlock {
  blockNumber: number;
  blockHash: string;
  parentHash: string;
  stateRoot: string;
  timestamp: Date;
  sequencer: string;
  transactionCount: number;
  gasUsed: number;
  gasLimit: number;
}

export class BlockRepository {
  constructor(private readonly db: Database) {}

  async insert(block: InsertBlock) {
    const [result] = await this.db.insert(blocks).values(block).returning();
    return result;
  }

  async insertMany(blockList: InsertBlock[]) {
    if (blockList.length === 0) return [];
    return this.db.insert(blocks).values(blockList).returning();
  }

  async findByNumber(blockNumber: number) {
    const [result] = await this.db
      .select()
      .from(blocks)
      .where(eq(blocks.blockNumber, blockNumber))
      .limit(1);
    return result ?? null;
  }

  async findByHash(blockHash: string) {
    const [result] = await this.db
      .select()
      .from(blocks)
      .where(eq(blocks.blockHash, blockHash))
      .limit(1);
    return result ?? null;
  }

  async findLatest() {
    const [result] = await this.db
      .select()
      .from(blocks)
      .orderBy(desc(blocks.blockNumber))
      .limit(1);
    return result ?? null;
  }

  async findMany(page: number, pageSize: number) {
    const offset = (page - 1) * pageSize;
    const rows = await this.db
      .select()
      .from(blocks)
      .orderBy(desc(blocks.blockNumber))
      .limit(pageSize)
      .offset(offset);

    const [countResult] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(blocks);
    const total = countResult?.count ?? 0;

    return { blocks: rows, total };
  }

  async getMaxBlockNumber(): Promise<number> {
    const [result] = await this.db
      .select({ max: sql<number>`coalesce(max(${blocks.blockNumber}), -1)` })
      .from(blocks);
    return result?.max ?? -1;
  }

  async exists(blockNumber: number): Promise<boolean> {
    const [result] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(blocks)
      .where(eq(blocks.blockNumber, blockNumber));
    return (result?.count ?? 0) > 0;
  }
}
