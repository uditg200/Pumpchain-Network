import { eq, desc, and, gt, sql } from 'drizzle-orm';
import type { Database } from '../index.js';
import { faucetClaims } from '../schema.js';

export interface InsertFaucetClaim {
  walletAddress: string;
  asset: string;
  amount: string;
  ipHash: string;
  cooldownUntil: Date;
}

export class FaucetRepository {
  constructor(private readonly db: Database) {}

  async insert(claim: InsertFaucetClaim) {
    const [result] = await this.db.insert(faucetClaims).values(claim).returning();
    return result;
  }

  async findLastClaim(walletAddress: string) {
    const [result] = await this.db
      .select()
      .from(faucetClaims)
      .where(eq(faucetClaims.walletAddress, walletAddress))
      .orderBy(desc(faucetClaims.claimTimestamp))
      .limit(1);
    return result ?? null;
  }

  async isInCooldown(walletAddress: string): Promise<boolean> {
    const now = new Date();
    const [result] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(faucetClaims)
      .where(
        and(eq(faucetClaims.walletAddress, walletAddress), gt(faucetClaims.cooldownUntil, now)),
      );
    return (result?.count ?? 0) > 0;
  }

  async isIpInCooldown(ipHash: string): Promise<boolean> {
    const now = new Date();
    const [result] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(faucetClaims)
      .where(and(eq(faucetClaims.ipHash, ipHash), gt(faucetClaims.cooldownUntil, now)));
    return (result?.count ?? 0) > 0;
  }
}
