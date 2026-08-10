import type { PumpchainAccountData } from './account.types.js';

/**
 * AccountService manages Pumpchain L2 account state.
 *
 * Each account has an address, PUMP balance, and nonce.
 * Addresses mirror Solana base58 format.
 */
export class AccountService {
  private accounts: Map<string, PumpchainAccountData> = new Map();

  /**
   * Returns an account by address, creating it if it doesn't exist.
   */
  getOrCreate(address: string): PumpchainAccountData {
    let account = this.accounts.get(address);
    if (!account) {
      account = {
        address,
        balance: 0n,
        nonce: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      this.accounts.set(address, account);
    }
    return account;
  }

  /**
   * Returns an account by address, or null if it doesn't exist.
   */
  getAccount(address: string): PumpchainAccountData | null {
    return this.accounts.get(address) ?? null;
  }

  /**
   * Credits PUMP to an account (e.g., from faucet or bridge deposit).
   */
  credit(address: string, amount: bigint): PumpchainAccountData {
    const account = this.getOrCreate(address);
    account.balance += amount;
    account.updatedAt = Date.now();
    return account;
  }

  /**
   * Debits PUMP from an account. Throws if insufficient balance.
   */
  debit(address: string, amount: bigint): PumpchainAccountData {
    const account = this.getOrCreate(address);
    if (account.balance < amount) {
      throw new Error(`Insufficient balance: has ${account.balance}, needs ${amount}`);
    }
    account.balance -= amount;
    account.updatedAt = Date.now();
    return account;
  }

  /**
   * Increments the nonce for an account (after a transaction).
   */
  incrementNonce(address: string): number {
    const account = this.getOrCreate(address);
    account.nonce += 1;
    account.updatedAt = Date.now();
    return account.nonce;
  }

  /**
   * Returns the current nonce for an account.
   */
  getNonce(address: string): number {
    return this.accounts.get(address)?.nonce ?? 0;
  }

  /**
   * Returns the total number of accounts created.
   */
  getTotalCount(): number {
    return this.accounts.size;
  }

  /**
   * Returns a paginated list of accounts sorted by balance (descending).
   */
  getAccounts(page: number, pageSize: number): { accounts: PumpchainAccountData[]; total: number } {
    const all = [...this.accounts.values()].sort((a, b) => {
      if (b.balance > a.balance) return 1;
      if (b.balance < a.balance) return -1;
      return 0;
    });
    const total = all.length;
    const start = (page - 1) * pageSize;
    const accounts = all.slice(start, start + pageSize);
    return { accounts, total };
  }

  /**
   * Returns all account states for state root computation.
   */
  getAllStates(): Array<{ address: string; balance: string; nonce: number }> {
    return [...this.accounts.values()].map((a) => ({
      address: a.address,
      balance: a.balance.toString(),
      nonce: a.nonce,
    }));
  }
}
