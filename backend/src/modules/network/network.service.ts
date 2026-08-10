import { NetworkStatus } from '@pumpchain/shared';
import type { NetworkInfo, NetworkStatusSummary } from './network.types.js';
import type { BlockService } from '../blocks/block.service.js';
import type { TransactionService } from '../transactions/transaction.service.js';
import type { AccountService } from '../accounts/account.service.js';
import type { GasService } from '../gas/gas.service.js';
import { env } from '../../config/env.js';

/**
 * NetworkService is the central service for Pumpchain network state.
 *
 * It aggregates data from BlockService, TransactionService, AccountService,
 * and GasService to provide a unified view of the L2 network.
 */
export class NetworkService {
  private genesisTimestamp: number = 0;
  private tpsWindow: number[] = []; // timestamps of recent transactions
  private readonly TPS_WINDOW_SECONDS = 60;

  constructor(
    private readonly blockService: BlockService,
    private readonly transactionService: TransactionService,
    private readonly accountService: AccountService,
    private readonly gasService: GasService,
  ) {}

  /**
   * Initializes the network. Must be called once at startup.
   */
  initialize(genesisTimestamp?: number): void {
    const genesis = this.blockService.initialize(genesisTimestamp);
    this.genesisTimestamp = genesis.timestamp;
  }

  /**
   * Returns comprehensive network information.
   */
  getNetworkInfo(): NetworkInfo {
    const latestBlock = this.blockService.getLatestBlock();
    return {
      networkId: env.PUMPCHAIN_NETWORK_ID,
      chainName: env.PUMPCHAIN_CHAIN_NAME,
      nativeSymbol: env.PUMPCHAIN_NATIVE_SYMBOL,
      environment: env.PUMPCHAIN_ENVIRONMENT,
      genesisTimestamp: this.genesisTimestamp,
      currentBlockHeight: latestBlock?.blockNumber ?? 0,
      latestBlockHash: latestBlock?.blockHash ?? '',
      tps: this.getCurrentTps(),
      totalTransactions: this.getTotalTransactions(),
      activeAccounts: this.getActiveAccounts(),
      status: this.getNetworkStatus(),
    };
  }

  /**
   * Returns the latest block produced by the network.
   */
  getLatestBlock() {
    return this.blockService.getLatestBlock();
  }

  /**
   * Returns the current block height (number of the latest block).
   */
  getCurrentBlockHeight(): number {
    return this.blockService.getCurrentHeight();
  }

  /**
   * Computes the current transactions per second over a sliding window.
   */
  getCurrentTps(): number {
    const now = Date.now();
    const windowStart = now - this.TPS_WINDOW_SECONDS * 1000;

    // Prune old entries
    this.tpsWindow = this.tpsWindow.filter((ts) => ts > windowStart);

    if (this.tpsWindow.length === 0) return 0;
    return Math.round((this.tpsWindow.length / this.TPS_WINDOW_SECONDS) * 100) / 100;
  }

  /**
   * Records transaction timestamps for TPS calculation.
   */
  recordTransactions(count: number): void {
    const now = Date.now();
    for (let i = 0; i < count; i++) {
      this.tpsWindow.push(now);
    }
  }

  /**
   * Returns total number of transactions processed by the network.
   */
  getTotalTransactions(): number {
    return this.transactionService.getTotalCount();
  }

  /**
   * Returns the number of active (non-zero balance or >0 nonce) accounts.
   */
  getActiveAccounts(): number {
    return this.accountService.getTotalCount();
  }

  /**
   * Returns the current network status.
   */
  getNetworkStatus(): NetworkStatus {
    if (!this.blockService.isInitialized()) {
      return NetworkStatus.Offline;
    }

    const latestBlock = this.blockService.getLatestBlock();
    if (!latestBlock) {
      return NetworkStatus.Offline;
    }

    const timeSinceLastBlock = Date.now() - latestBlock.timestamp;
    // If more than 30 seconds since last block, consider degraded
    if (timeSinceLastBlock > 30_000) {
      return NetworkStatus.Degraded;
    }

    return NetworkStatus.Online;
  }

  /**
   * Returns a summary of network status for quick display.
   */
  getNetworkStatusSummary(): NetworkStatusSummary {
    return {
      status: this.getNetworkStatus(),
      blockHeight: this.getCurrentBlockHeight(),
      tps: this.getCurrentTps(),
      avgBlockTimeMs: this.getAverageBlockTime(),
      gasPrice: this.gasService.getCurrentGasPrice(),
    };
  }

  /**
   * Computes average block time from recent blocks.
   */
  private getAverageBlockTime(): number {
    const height = this.blockService.getCurrentHeight();
    if (height < 2) return 0;

    const lookback = Math.min(height, 10);
    const recent = this.blockService.getBlockByNumber(height);
    const older = this.blockService.getBlockByNumber(height - lookback);

    if (!recent || !older) return 0;
    return Math.round((recent.timestamp - older.timestamp) / lookback);
  }
}
