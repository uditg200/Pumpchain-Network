import { eq, desc, sql } from 'drizzle-orm';
import type { Database } from '../index.js';
import { accounts } from '../schema.js';

export interface InsertAccount {
  address: string;
  accountType?: string;
  balance?: string;
  nonce?: number;
}

export class AccountRepository {
  constructor(private readonly db: Database) {}

  async upsert(account: InsertAccount) {
    const [result] = await this.db
      .insert(accounts)
      .values({
        address: account.address,
        accountType: account.accountType ?? 'user',
        balance: account.balance ?? '0',
        nonce: account.nonce ?? 0,
      })
      .onConflictDoUpdate({
        target: accounts.address,
        set: {
          balance: sql`EXCLUDED.balance`,
          nonce: sql`EXCLUDED.nonce`,
          updatedAt: new Date(),
        },
      })
      .returning();
    return result;
  }

  async findByAddress(address: string) {
    const [result] = await this.db
      .select()
      .from(accounts)
      .where(eq(accounts.address, address))
      .limit(1);
    return result ?? null;
  }

  async findMany(page: number, pageSize: number) {
    const offset = (page - 1) * pageSize;
    const rows = await this.db
      .select()
      .from(accounts)
      .orderBy(desc(accounts.updatedAt))
      .limit(pageSize)
      .offset(offset);

    const [countResult] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(accounts);
    const total = countResult?.count ?? 0;

    return { accounts: rows, total };
  }

  async updateBalance(address: string, balance: string, nonce?: number) {
    const setValues: Record<string, unknown> = {
      balance,
      updatedAt: new Date(),
    };
    if (nonce !== undefined) {
      setValues['nonce'] = nonce;
    }
    await this.db.update(accounts).set(setValues).where(eq(accounts.address, address));
  }

  async creditBalance(address: string, amount: string) {
    await this.db
      .update(accounts)
      .set({
        balance: sql`(${accounts.balance}::numeric + ${amount}::numeric)::text`,
        updatedAt: new Date(),
      })
      .where(eq(accounts.address, address));
  }

  async debitBalance(address: string, amount: string) {
    await this.db
      .update(accounts)
      .set({
        balance: sql`(${accounts.balance}::numeric - ${amount}::numeric)::text`,
        updatedAt: new Date(),
      })
      .where(eq(accounts.address, address));
  }

  async incrementNonce(address: string) {
    await this.db
      .update(accounts)
      .set({
        nonce: sql`${accounts.nonce} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(accounts.address, address));
  }

  async getTotalCount(): Promise<number> {
    const [result] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(accounts);
    return result?.count ?? 0;
  }

  async exists(address: string): Promise<boolean> {
    const [result] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(accounts)
      .where(eq(accounts.address, address));
    return (result?.count ?? 0) > 0;
  }
}
