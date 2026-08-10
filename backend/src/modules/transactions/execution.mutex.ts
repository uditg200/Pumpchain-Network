/**
 * ExecutionMutex prevents race conditions during transaction execution.
 *
 * Guarantees:
 * - Only one transaction can be executing at a time
 * - A transaction cannot be executed twice (dedup set)
 * - The sequencer cannot accidentally process a tx concurrently
 */
export class ExecutionMutex {
  private locked = false;
  private executedHashes: Set<string> = new Set();

  /**
   * Acquires the execution lock. Returns false if already locked.
   */
  acquire(): boolean {
    if (this.locked) return false;
    this.locked = true;
    return true;
  }

  /**
   * Releases the execution lock.
   */
  release(): void {
    this.locked = false;
  }

  /**
   * Checks if a transaction has already been executed.
   */
  isExecuted(txHash: string): boolean {
    return this.executedHashes.has(txHash);
  }

  /**
   * Marks a transaction as executed (prevents double-execution).
   */
  markExecuted(txHash: string): void {
    this.executedHashes.add(txHash);
  }

  /**
   * Returns whether the mutex is currently locked.
   */
  isLocked(): boolean {
    return this.locked;
  }
}
