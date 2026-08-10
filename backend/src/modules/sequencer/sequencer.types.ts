export interface SequencerConfig {
  /** Target block production interval in ms (default: 2000) */
  blockIntervalMs: number;
  /** Address of the sequencer */
  sequencerAddress: string;
  /** Maximum transactions per block (default: 500) */
  maxTransactionsPerBlock: number;
  /** Maximum gas allowed per block */
  blockGasLimit: number;
  /** Whether to produce empty blocks when no transactions pending */
  produceEmptyBlocks: boolean;
}

export interface SequencerStatus {
  isRunning: boolean;
  sequencerAddress: string;
  blocksProduced: number;
  lastBlockTime: number | null;
  lastBlockDurationMs: number | null;
  pendingTransactions: number;
  isProducing: boolean;
}

export interface BlockProductionResult {
  blockNumber: number;
  blockHash: string;
  transactionCount: number;
  gasUsed: number;
  durationMs: number;
  isEmpty: boolean;
}

export interface SequencerMetrics {
  blocksProduced: number;
  totalTransactionsProcessed: number;
  totalGasUsed: number;
  avgBlockTimeMs: number;
  avgTransactionsPerBlock: number;
  avgGasPerBlock: number;
  currentTps: number;
  cumulativeTransactions: number;
  lastBlockTimes: number[]; // Recent block production durations
}
