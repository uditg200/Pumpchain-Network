import type {
  SequencerConfig,
  SequencerStatus,
  SequencerMetrics,
  BlockProductionResult,
} from './sequencer.types.js';
import type { BlockService } from '../blocks/block.service.js';
import type { TransactionService } from '../transactions/transaction.service.js';
import type { AccountService } from '../accounts/account.service.js';
import type { GasService } from '../gas/gas.service.js';
import type { NetworkService } from '../network/network.service.js';
import type { PumpchainTransaction } from '../transactions/transaction.types.js';
import { TxStatus } from '../transactions/transaction.types.js';
import { computeStateRoot } from '../blocks/block.hash.js';
import { PUMPCHAIN_GAS_LIMIT_PER_BLOCK } from '@pumpchain/shared';
import {
  broadcastNewBlock,
  broadcastTransactionConfirmed,
  broadcastTransactionFailed,
  broadcastNetworkMetrics,
} from '../../ws/index.js';

const DEFAULT_SEQUENCER_ADDRESS = 'PumpSequencer11111111111111111111111111111';
const DEFAULT_BLOCK_INTERVAL_MS = 2000;
const DEFAULT_MAX_TXS_PER_BLOCK = 500;

/**
 * SequencerService is the block producer for the Pumpchain L2 network.
 *
 * Key guarantees:
 * - Non-overlapping: only one block production cycle runs at a time
 * - Deterministic ordering: transactions are ordered by nonce, then timestamp, then hash
 * - Graceful shutdown: cleanly stops the production loop
 * - Configurable: block interval, max txs, gas limit, empty block behavior
 */
export class SequencerService {
  private config: SequencerConfig;
  private timeoutHandle: ReturnType<typeof setTimeout> | null = null;
  private isProducing = false;
  private isRunning = false;

  // Metrics state
  private blocksProduced = 0;
  private totalTxsProcessed = 0;
  private totalGasUsed = 0;
  private lastBlockTime: number | null = null;
  private lastBlockDurationMs: number | null = null;
  private recentBlockTimes: number[] = []; // Last 100 block production durations
  private readonly MAX_RECENT_BLOCKS = 100;

  // TPS calculation
  private tpsWindow: { timestamp: number; count: number }[] = [];
  private readonly TPS_WINDOW_MS = 60_000;

  constructor(
    private readonly blockService: BlockService,
    private readonly transactionService: TransactionService,
    private readonly accountService: AccountService,
    private readonly gasService: GasService,
    private readonly networkService: NetworkService,
    config?: Partial<SequencerConfig>,
  ) {
    this.config = {
      blockIntervalMs: config?.blockIntervalMs ?? DEFAULT_BLOCK_INTERVAL_MS,
      sequencerAddress: config?.sequencerAddress ?? DEFAULT_SEQUENCER_ADDRESS,
      maxTransactionsPerBlock: config?.maxTransactionsPerBlock ?? DEFAULT_MAX_TXS_PER_BLOCK,
      blockGasLimit: config?.blockGasLimit ?? PUMPCHAIN_GAS_LIMIT_PER_BLOCK,
      produceEmptyBlocks: config?.produceEmptyBlocks ?? true,
    };
  }

  /**
   * Starts the block production loop.
   * Uses setTimeout chaining (not setInterval) to guarantee non-overlapping execution.
   */
  start(): void {
    if (this.isRunning) {
      throw new Error('Sequencer is already running');
    }

    this.isRunning = true;
    this.scheduleNextBlock();

    console.log(
      `[Sequencer] Started — interval: ${this.config.blockIntervalMs}ms, max txs: ${this.config.maxTransactionsPerBlock}, address: ${this.config.sequencerAddress}`,
    );
  }

  /**
   * Stops the block production loop gracefully.
   * Waits for any in-progress block production to complete.
   */
  stop(): void {
    this.isRunning = false;
    if (this.timeoutHandle) {
      clearTimeout(this.timeoutHandle);
      this.timeoutHandle = null;
    }
    console.log('[Sequencer] Stopped');
  }

  /**
   * Returns the current status of the sequencer.
   */
  getStatus(): SequencerStatus {
    return {
      isRunning: this.isRunning,
      sequencerAddress: this.config.sequencerAddress,
      blocksProduced: this.blocksProduced,
      lastBlockTime: this.lastBlockTime,
      lastBlockDurationMs: this.lastBlockDurationMs,
      pendingTransactions: this.transactionService.getPendingCount(),
      isProducing: this.isProducing,
    };
  }

  /**
   * Returns aggregated sequencer metrics.
   */
  getMetrics(): SequencerMetrics {
    const avgBlockTime =
      this.recentBlockTimes.length > 0
        ? this.recentBlockTimes.reduce((a, b) => a + b, 0) / this.recentBlockTimes.length
        : 0;

    const avgTxsPerBlock =
      this.blocksProduced > 0 ? this.totalTxsProcessed / this.blocksProduced : 0;

    const avgGasPerBlock =
      this.blocksProduced > 0 ? this.totalGasUsed / this.blocksProduced : 0;

    return {
      blocksProduced: this.blocksProduced,
      totalTransactionsProcessed: this.totalTxsProcessed,
      totalGasUsed: this.totalGasUsed,
      avgBlockTimeMs: Math.round(avgBlockTime),
      avgTransactionsPerBlock: Math.round(avgTxsPerBlock * 100) / 100,
      avgGasPerBlock: Math.round(avgGasPerBlock),
      currentTps: this.computeCurrentTps(),
      cumulativeTransactions: this.totalTxsProcessed,
      lastBlockTimes: [...this.recentBlockTimes.slice(-10)],
    };
  }

  /**
   * Manually triggers a single block production cycle.
   * Useful for testing. Returns the result or null if already producing.
   */
  async produceBlockManual(): Promise<BlockProductionResult | null> {
    if (this.isProducing) return null;
    return this.produceBlock();
  }

  /**
   * Schedules the next block production after the configured interval.
   * This creates a non-overlapping chain: produce → wait → produce → wait...
   */
  private scheduleNextBlock(): void {
    if (!this.isRunning) return;

    this.timeoutHandle = setTimeout(async () => {
      await this.produceBlock();
      this.scheduleNextBlock();
    }, this.config.blockIntervalMs);
  }

  /**
   * Produces a single block.
   *
   * Guarantees:
   * - Non-overlapping (isProducing lock)
   * - Deterministic transaction ordering
   * - All state mutations happen atomically within the block
   */
  private async produceBlock(): Promise<BlockProductionResult> {
    if (this.isProducing) {
      // This should never happen due to setTimeout chaining, but safety check
      return {
        blockNumber: -1,
        blockHash: '',
        transactionCount: 0,
        gasUsed: 0,
        durationMs: 0,
        isEmpty: true,
      };
    }

    this.isProducing = true;
    const startTime = performance.now();

    try {
      // 1. Take pending transactions from pool
      const pendingTxs = this.transactionService.takePending(this.config.maxTransactionsPerBlock);

      // Skip empty block production if configured and no transactions
      if (pendingTxs.length === 0 && !this.config.produceEmptyBlocks) {
        return {
          blockNumber: -1,
          blockHash: '',
          transactionCount: 0,
          gasUsed: 0,
          durationMs: performance.now() - startTime,
          isEmpty: true,
        };
      }

      // 2. Order transactions deterministically
      const orderedTxs = this.orderTransactions(pendingTxs);

      // 3. Execute transactions and collect results
      const blockNumber = this.blockService.getCurrentHeight() + 1;
      const blockTransactions: Array<{ hash: string; gasUsed: number }> = [];
      let blockGasUsed = 0;

      for (const tx of orderedTxs) {
        const estimatedGas = this.gasService.computeGasUsed(tx.inputData?.length ?? 0);

        // Check block gas capacity
        if (!this.gasService.hasCapacity(blockGasUsed, estimatedGas)) {
          break; // Block full
        }

        // Execute through the transaction engine
        const executed = this.transactionService.executeTransaction(tx.txHash, blockNumber);
        if (executed) {
          blockTransactions.push({ hash: executed.txHash, gasUsed: executed.gasUsed });
          blockGasUsed += executed.gasUsed;
        }
      }

      // 4. Compute state root
      const previousStateRoot = this.blockService.getLatestBlock()?.stateRoot ?? '';
      const stateRoot = computeStateRoot(this.accountService.getAllStates());

      // 5. Produce the block
      const block = this.blockService.produceBlock({
        proposer: this.config.sequencerAddress,
        transactions: blockTransactions,
        gasLimit: this.config.blockGasLimit,
        previousStateRoot,
        stateRoot,
      });

      // 6. Record metrics
      const durationMs = performance.now() - startTime;
      this.recordBlockMetrics(blockTransactions.length, blockGasUsed, durationMs);

      // 7. Notify network service of confirmed transactions
      if (blockTransactions.length > 0) {
        this.networkService.recordTransactions(blockTransactions.length);
      }

      // 8. Broadcast WebSocket events
      broadcastNewBlock({
        blockNumber: block.blockNumber,
        blockHash: block.blockHash,
        transactionCount: blockTransactions.length,
        gasUsed: blockGasUsed,
        timestamp: block.timestamp,
      });

      // Broadcast individual tx confirmations/failures
      for (const btx of blockTransactions) {
        const txData = this.transactionService.getTransaction(btx.hash);
        if (txData) {
          if (txData.status === TxStatus.Confirmed) {
            broadcastTransactionConfirmed({
              txHash: txData.txHash,
              blockNumber: block.blockNumber,
              gasUsed: txData.gasUsed,
              fee: txData.fee.toString(),
              sender: txData.sender,
              recipient: txData.recipient,
            });
          } else if (txData.status === TxStatus.Failed) {
            broadcastTransactionFailed({
              txHash: txData.txHash,
              blockNumber: block.blockNumber,
              error: txData.errorMessage ?? 'Transaction failed',
            });
          }
        }
      }

      // Broadcast network metrics
      broadcastNetworkMetrics({
        blockHeight: block.blockNumber,
        tps: this.computeCurrentTps(),
        totalTransactions: this.totalTxsProcessed,
        activeAccounts: this.accountService.getTotalCount(),
        pendingTransactions: this.transactionService.getPendingCount(),
      });

      return {
        blockNumber: block.blockNumber,
        blockHash: block.blockHash,
        transactionCount: blockTransactions.length,
        gasUsed: blockGasUsed,
        durationMs: Math.round(durationMs),
        isEmpty: blockTransactions.length === 0,
      };
    } finally {
      this.isProducing = false;
    }
  }

  /**
   * Orders transactions deterministically.
   *
   * Ordering criteria (in priority):
   * 1. Nonce (ascending) — ensures correct execution order per account
   * 2. Timestamp (ascending) — earlier submissions first
   * 3. Transaction hash (ascending) — tiebreaker for full determinism
   */
  private orderTransactions(txs: PumpchainTransaction[]): PumpchainTransaction[] {
    return [...txs].sort((a, b) => {
      // Primary: nonce ascending
      if (a.nonce !== b.nonce) return a.nonce - b.nonce;
      // Secondary: timestamp ascending
      if (a.timestamp !== b.timestamp) return a.timestamp - b.timestamp;
      // Tertiary: hash ascending (deterministic tiebreaker)
      return a.txHash.localeCompare(b.txHash);
    });
  }

  /**
   * Records block production metrics.
   */
  private recordBlockMetrics(txCount: number, gasUsed: number, durationMs: number): void {
    this.blocksProduced++;
    this.totalTxsProcessed += txCount;
    this.totalGasUsed += gasUsed;

    // Record time between blocks (actual block interval) rather than production duration
    const now = Date.now();
    if (this.lastBlockTime) {
      const intervalMs = now - this.lastBlockTime;
      this.recentBlockTimes.push(intervalMs);
    } else {
      this.recentBlockTimes.push(this.config.blockIntervalMs);
    }
    this.lastBlockTime = now;
    this.lastBlockDurationMs = Math.round(durationMs);
    if (this.recentBlockTimes.length > this.MAX_RECENT_BLOCKS) {
      this.recentBlockTimes.shift();
    }

    // TPS tracking
    if (txCount > 0) {
      this.tpsWindow.push({ timestamp: Date.now(), count: txCount });
    }
  }

  /**
   * Computes current TPS over a sliding 60-second window.
   */
  private computeCurrentTps(): number {
    const now = Date.now();
    const windowStart = now - this.TPS_WINDOW_MS;

    // Prune old entries
    this.tpsWindow = this.tpsWindow.filter((e) => e.timestamp > windowStart);

    if (this.tpsWindow.length === 0) return 0;

    const totalTx = this.tpsWindow.reduce((sum, e) => sum + e.count, 0);
    return Math.round((totalTx / (this.TPS_WINDOW_MS / 1000)) * 100) / 100;
  }
}
