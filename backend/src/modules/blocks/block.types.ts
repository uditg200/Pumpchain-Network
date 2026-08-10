/**
 * Pumpchain Block - the fundamental unit of the L2 chain.
 *
 * Each block references the previous block hash, forming
 * an immutable chain of execution state.
 */
export interface PumpchainBlockData {
  /** Sequential block number starting from 0 (genesis) */
  blockNumber: number;

  /** SHA-256 hash of the canonical serialized block header */
  blockHash: string;

  /** Hash of the previous block (0x000...000 for genesis) */
  parentHash: string;

  /** Unix timestamp in milliseconds when the block was produced */
  timestamp: number;

  /** Address of the sequencer/proposer that produced this block */
  proposer: string;

  /** Number of transactions included in this block */
  transactionCount: number;

  /** Total gas consumed by all transactions in this block */
  gasUsed: number;

  /** Maximum gas allowed in this block */
  gasLimit: number;

  /** Merkle root of the state after applying this block's transactions */
  stateRoot: string;

  /** Merkle root of the state before this block's transactions */
  previousStateRoot: string;
}

/**
 * Input for producing a new block (before hash computation).
 */
export interface BlockProducerInput {
  parentHash: string;
  parentBlockNumber: number;
  proposer: string;
  transactions: BlockTransaction[];
  gasLimit: number;
  previousStateRoot: string;
  stateRoot: string;
}

/**
 * Minimal transaction representation needed for block production.
 */
export interface BlockTransaction {
  hash: string;
  gasUsed: number;
}
