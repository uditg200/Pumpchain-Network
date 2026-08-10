import type { PumpchainTransaction } from './transaction.types.js';
import { TxStatus } from './transaction.types.js';

/**
 * TransactionPool is the mempool for pending Pumpchain transactions.
 *
 * Transactions enter PENDING and are consumed by the sequencer
 * during block production.
 *
 * Ordering: FIFO (first in, first out) for the prototype.
 * A production system would use priority queues based on gas price.
 */
export class TransactionPool {
  private queue: PumpchainTransaction[] = [];

  /**
   * Adds a transaction to the pool.
   */
  add(tx: PumpchainTransaction): void {
    if (tx.status !== TxStatus.Pending) {
      throw new Error(`Cannot add non-pending transaction to pool: ${tx.status}`);
    }
    this.queue.push(tx);
  }

  /**
   * Takes up to `maxCount` transactions from the pool.
   * Removes them from the queue.
   */
  take(maxCount: number): PumpchainTransaction[] {
    const batch = this.queue.splice(0, Math.min(maxCount, this.queue.length));
    return batch;
  }

  /**
   * Returns the number of pending transactions in the pool.
   */
  size(): number {
    return this.queue.length;
  }

  /**
   * Peeks at the next transactions without removing them.
   */
  peek(count: number): PumpchainTransaction[] {
    return this.queue.slice(0, count);
  }

  /**
   * Removes a specific transaction from the pool (e.g., after rejection).
   */
  remove(txHash: string): boolean {
    const idx = this.queue.findIndex((tx) => tx.txHash === txHash);
    if (idx >= 0) {
      this.queue.splice(idx, 1);
      return true;
    }
    return false;
  }

  /**
   * Clears the entire pool.
   */
  clear(): void {
    this.queue = [];
  }
}
