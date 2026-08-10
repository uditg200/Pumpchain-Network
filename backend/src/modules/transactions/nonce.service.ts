import type { AccountService } from '../accounts/account.service.js';

/**
 * NonceService tracks and validates transaction nonces.
 *
 * Each account has a sequential nonce starting at 0.
 * A transaction is only valid if its nonce equals the account's current nonce.
 * This prevents replay attacks and ensures transaction ordering.
 */
export class NonceService {
  /** Pending nonces: track nonces reserved by txs in the pool not yet confirmed */
  private pendingNonces: Map<string, number> = new Map();

  constructor(private readonly accountService: AccountService) {}

  /**
   * Returns the next expected nonce for an address.
   * If there are pending transactions, returns the next pending nonce.
   */
  getExpectedNonce(address: string): number {
    const pending = this.pendingNonces.get(address);
    if (pending !== undefined) {
      return pending;
    }
    return this.accountService.getNonce(address);
  }

  /**
   * Validates that the provided nonce matches what we expect.
   */
  validateNonce(address: string, nonce: number): { valid: boolean; expected: number } {
    const expected = this.getExpectedNonce(address);
    return { valid: nonce === expected, expected };
  }

  /**
   * Reserves the next nonce for a pending transaction.
   * Called when a transaction enters the pool.
   */
  reserveNonce(address: string, nonce: number): void {
    this.pendingNonces.set(address, nonce + 1);
  }

  /**
   * Releases a reserved nonce (e.g., if tx is rejected before execution).
   */
  releaseNonce(address: string): void {
    const current = this.pendingNonces.get(address);
    if (current !== undefined && current > 0) {
      const baseNonce = this.accountService.getNonce(address);
      if (current - 1 <= baseNonce) {
        this.pendingNonces.delete(address);
      } else {
        this.pendingNonces.set(address, current - 1);
      }
    }
  }

  /**
   * Clears pending nonce tracking for an address after confirmation.
   * The account's persisted nonce is now the source of truth.
   */
  confirmNonce(address: string): void {
    const baseNonce = this.accountService.getNonce(address);
    const pending = this.pendingNonces.get(address);
    if (pending !== undefined && pending <= baseNonce + 1) {
      this.pendingNonces.delete(address);
    }
  }
}
