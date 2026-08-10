import { desc, sql } from 'drizzle-orm';
import type { Database } from '../index.js';
import { networkMetrics } from '../schema.js';

export interface InsertMetrics {
  blockHeight: number;
  tps: string;
  totalTransactions: number;
  activeAccounts: number;
  gasUsed: string;
  totalGasFees: string;
}

export class MetricsRepository {
  constructor(private readonly db: Database) {}

  async insert(metrics: InsertMetrics) {
    const [result] = await this.db.insert(networkMetrics).values(metrics).returning();
    return result;
  }

  async findLatest(limit: number = 60) {
    return this.db
      .select()
      .from(networkMetrics)
      .orderBy(desc(networkMetrics.timestamp))
      .limit(limit);
  }

  async findLatestOne() {
    const [result] = await this.db
      .select()
      .from(networkMetrics)
      .orderBy(desc(networkMetrics.timestamp))
      .limit(1);
    return result ?? null;
  }
}
