import type { AccountService } from '../accounts/account.service.js';
import type { GasService } from '../gas/gas.service.js';
import { hashTransaction } from '../blocks/block.hash.js';
import { NonceService } from './nonce.service.js';
import { TransactionValidationService } from './validation.service.js';
import { TransactionExecutionService } from './execution.service.js';
import { TransactionPool } from './transaction.pool.js';
import { ExecutionMutex } from './execution.mutex.js';
import { broadcastTransactionSubmitted } from '../../ws/index.js';
import type {
  PumpchainTransaction,
  TransactionSubmitInput,
  TransactionReceipt,
  GasEstimation,
  ValidationResult,
} from './transaction.types.js';
import { TxType, TxStatus } from './transaction.types.js';

/**
 * TransactionService is the main orchestrator for the Pumpchain transaction engine.
 *
 * It coordinates validation → pool → execution → confirmation.
 */
export class TransactionService {
  private transactions: Map<string, PumpchainTransaction> = new Map();
  public readonly pool: TransactionPool;
  public readonly nonceService: NonceService;
  public readonly validationService: TransactionValidationService;
  public readonly executionService: TransactionExecutionService;
  private readonly mutex: ExecutionMutex;

  constructor(
    private readonly accountService: AccountService,
    private readonly gasService: GasService,
  ) {
    this.nonceService = new NonceService(accountService);
    this.validationService = new TransactionValidationService(accountService, this.nonceService);
    this.executionService = new TransactionExecutionService(accountService, gasService);
    this.pool = new TransactionPool();
    this.mutex = new ExecutionMutex();
  }

  /**
   * Submits a new transaction. Goes through validation → pool.
   * Returns the transaction with PENDING status or validation errors.
   */
  submit(input: TransactionSubmitInput): { tx: PumpchainTransaction | null; errors: string[] } {
    // Compute deterministic hash
    const timestamp = Date.now();
    const txHash = hashTransaction({
      from: input.sender,
      to: input.recipient,
      amount: input.amount,
      nonce: input.nonce,
      timestamp,
      data: input.inputData ?? undefined,
    });

    // Check for duplicate
    const existingHash = this.transactions.has(txHash) ? txHash : null;

    // Validate
    const validation = this.validationService.validate(input, existingHash);
    if (!validation.valid) {
      return { tx: null, errors: validation.errors };
    }

    // Create transaction object
    const tx: PumpchainTransaction = {
      txHash,
      sender: input.sender,
      recipient: input.recipient,
      nonce: input.nonce,
      type: input.type,
      amount: BigInt(input.amount),
      gasLimit: input.gasLimit,
      gasPrice: input.gasPrice,
      inputData: input.inputData ?? null,
      signature: input.signature ?? null,
      timestamp,
      status: TxStatus.Pending,
      blockNumber: null,
      gasUsed: 0,
      fee: 0n,
      errorMessage: null,
    };

    // Reserve nonce and add to pool
    this.nonceService.reserveNonce(input.sender, input.nonce);
    this.transactions.set(txHash, tx);
    this.pool.add(tx);

    // Broadcast submission event
    broadcastTransactionSubmitted({
      txHash: tx.txHash,
      sender: tx.sender,
      recipient: tx.recipient,
      amount: tx.amount.toString(),
      type: tx.type,
    });

    return { tx, errors: [] };
  }

  /**
   * Submits a system transaction (faucet, bridge) that bypasses signature validation.
   */
  submitSystem(input: Omit<TransactionSubmitInput, 'signature'>): PumpchainTransaction {
    const timestamp = Date.now();
    const txHash = hashTransaction({
      from: input.sender,
      to: input.recipient,
      amount: input.amount,
      nonce: input.nonce,
      timestamp,
      data: input.inputData ?? undefined,
    });

    const tx: PumpchainTransaction = {
      txHash,
      sender: input.sender,
      recipient: input.recipient,
      nonce: input.nonce,
      type: input.type,
      amount: BigInt(input.amount),
      gasLimit: input.gasLimit,
      gasPrice: input.gasPrice,
      inputData: input.inputData ?? null,
      signature: null,
      timestamp,
      status: TxStatus.Pending,
      blockNumber: null,
      gasUsed: 0,
      fee: 0n,
      errorMessage: null,
    };

    this.transactions.set(txHash, tx);
    this.pool.add(tx);
    return tx;
  }

  /**
   * Takes pending transactions from the pool for block inclusion.
   */
  takePending(maxCount: number): PumpchainTransaction[] {
    return this.pool.take(maxCount);
  }

  /**
   * Returns number of pending transactions in the pool.
   */
  getPendingCount(): number {
    return this.pool.size();
  }

  /**
   * Executes a transaction and updates its status.
   * Called by the sequencer during block production.
   */
  executeTransaction(txHash: string, blockNumber: number): PumpchainTransaction | null {
    const tx = this.transactions.get(txHash);
    if (!tx) return null;

    // SECURITY: Prevent double-execution
    if (this.mutex.isExecuted(txHash)) {
      return null;
    }

    // SECURITY: Acquire execution lock (prevents race conditions)
    if (!this.mutex.acquire()) {
      return null; // Another execution in progress
    }

    try {
      // Transition: PENDING → EXECUTING
      tx.status = TxStatus.Executing;

    const result = this.executionService.execute(tx);

    if (result.success) {
      tx.status = TxStatus.Confirmed;
      tx.blockNumber = blockNumber;
      tx.gasUsed = result.gasUsed;
      tx.fee = result.fee;
      this.nonceService.confirmNonce(tx.sender);
    } else {
      tx.status = TxStatus.Failed;
      tx.blockNumber = blockNumber;
      tx.gasUsed = result.gasUsed;
      tx.fee = result.fee;
      tx.errorMessage = result.error ?? 'Execution failed';
      this.nonceService.releaseNonce(tx.sender);
    }

      // Mark as executed and release lock
      this.mutex.markExecuted(txHash);
      return tx;
    } finally {
      this.mutex.release();
    }
  }

  /**
   * Marks a transaction as confirmed (external use when sequencer already executed).
   */
  confirm(txHash: string, blockNumber: number, gasUsed: number): void {
    const tx = this.transactions.get(txHash);
    if (tx) {
      tx.status = TxStatus.Confirmed;
      tx.blockNumber = blockNumber;
      tx.gasUsed = gasUsed;
      tx.fee = BigInt(gasUsed) * BigInt(tx.gasPrice);
    }
  }

  /**
   * Marks a transaction as failed.
   */
  fail(txHash: string, blockNumber: number, error?: string): void {
    const tx = this.transactions.get(txHash);
    if (tx) {
      tx.status = TxStatus.Failed;
      tx.blockNumber = blockNumber;
      tx.errorMessage = error ?? 'Transaction failed';
    }
  }

  /**
   * Returns a transaction by hash.
   */
  getTransaction(hash: string): PumpchainTransaction | null {
    return this.transactions.get(hash) ?? null;
  }

  /**
   * Returns a transaction receipt.
   */
  getReceipt(hash: string): TransactionReceipt | null {
    const tx = this.transactions.get(hash);
    if (!tx) return null;
    return this.executionService.generateReceipt(tx);
  }

  /**
   * Returns the status of a transaction.
   */
  getStatus(hash: string): { status: TxStatus; errorMessage: string | null } | null {
    const tx = this.transactions.get(hash);
    if (!tx) return null;
    return { status: tx.status, errorMessage: tx.errorMessage };
  }

  /**
   * Estimates gas for a transaction.
   */
  estimateGas(input: { type: TxType; inputData?: string | null }): GasEstimation {
    const gasLimit = this.gasService.computeGasUsed(input.inputData?.length ?? 0);
    const gasPrice = this.gasService.getCurrentGasPrice();
    const estimatedFee = (BigInt(gasLimit) * BigInt(gasPrice)).toString();
    return { gasLimit, gasPrice, estimatedFee };
  }

  /**
   * Returns transactions for a specific address (sender or recipient).
   */
  getByAddress(address: string, page: number, pageSize: number): { transactions: PumpchainTransaction[]; total: number } {
    const filtered = [...this.transactions.values()].filter(
      (tx) => tx.sender === address || tx.recipient === address,
    );
    const total = filtered.length;
    const start = (page - 1) * pageSize;
    const transactions = filtered
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(start, start + pageSize);
    return { transactions, total };
  }

  /**
   * Returns total transaction count.
   */
  getTotalCount(): number {
    return this.transactions.size;
  }

  /**
   * Returns paginated transactions (most recent first).
   */
  getTransactions(page: number, pageSize: number): { transactions: PumpchainTransaction[]; total: number } {
    const all = [...this.transactions.values()].sort((a, b) => b.timestamp - a.timestamp);
    const total = all.length;
    const start = (page - 1) * pageSize;
    const transactions = all.slice(start, start + pageSize);
    return { transactions, total };
  }
}
