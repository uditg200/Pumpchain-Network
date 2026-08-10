import { hashBlockHeader, computeStateRoot, ZERO_HASH } from './block.hash.js';
import type { PumpchainBlockData, BlockProducerInput } from './block.types.js';
import {
  PUMPCHAIN_GAS_LIMIT_PER_BLOCK,
  PUMPCHAIN_BLOCK_TIME_MS,
} from '@pumpchain/shared';

/** Default sequencer address for the testnet prototype */
const GENESIS_PROPOSER = 'PumpGenesisSequencer1111111111111111111111';

/**
 * Creates the genesis block (block 0) for the Pumpchain network.
 *
 * The genesis block has:
 * - blockNumber = 0
 * - parentHash = 64 zeroes
 * - transactionCount = 0
 * - gasUsed = 0
 * - empty state root
 */
export function createGenesisBlock(timestamp?: number): PumpchainBlockData {
  const genesisTimestamp = timestamp ?? Date.now();
  const emptyStateRoot = computeStateRoot([]);

  const header = {
    blockNumber: 0,
    parentHash: ZERO_HASH,
    timestamp: genesisTimestamp,
    proposer: GENESIS_PROPOSER,
    transactionCount: 0,
    gasUsed: 0,
    gasLimit: PUMPCHAIN_GAS_LIMIT_PER_BLOCK,
    stateRoot: emptyStateRoot,
    previousStateRoot: ZERO_HASH,
  };

  const blockHash = hashBlockHeader(header);

  return {
    ...header,
    blockHash,
  };
}

/**
 * Creates a new block from the given input.
 * Computes the block hash deterministically from the header fields.
 */
export function createBlock(input: BlockProducerInput): PumpchainBlockData {
  const timestamp = Date.now();
  const totalGasUsed = input.transactions.reduce((sum, tx) => sum + tx.gasUsed, 0);

  const header = {
    blockNumber: input.parentBlockNumber + 1,
    parentHash: input.parentHash,
    timestamp,
    proposer: input.proposer,
    transactionCount: input.transactions.length,
    gasUsed: totalGasUsed,
    gasLimit: input.gasLimit,
    stateRoot: input.stateRoot,
    previousStateRoot: input.previousStateRoot,
  };

  const blockHash = hashBlockHeader(header);

  return {
    ...header,
    blockHash,
  };
}

/**
 * Recomputes the block hash from an existing block's header fields.
 * Useful for verification — if the result matches blockHash, the block is valid.
 */
export function computeBlockHash(block: Omit<PumpchainBlockData, 'blockHash'>): string {
  return hashBlockHeader({
    blockNumber: block.blockNumber,
    parentHash: block.parentHash,
    timestamp: block.timestamp,
    proposer: block.proposer,
    transactionCount: block.transactionCount,
    gasUsed: block.gasUsed,
    gasLimit: block.gasLimit,
    stateRoot: block.stateRoot,
    previousStateRoot: block.previousStateRoot,
  });
}
