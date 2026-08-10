import type { PumpchainBlockData, BlockProducerInput } from './block.types.js';
import { createGenesisBlock, createBlock, computeBlockHash } from './block.producer.js';
import { ZERO_HASH } from './block.hash.js';

/**
 * BlockService manages the Pumpchain block state.
 *
 * In this prototype, blocks are stored in-memory.
 * A production implementation would persist to the database.
 */
export class BlockService {
  private blocks: PumpchainBlockData[] = [];
  private blocksByHash: Map<string, PumpchainBlockData> = new Map();

  /**
   * Initializes the chain with the genesis block.
   */
  initialize(genesisTimestamp?: number): PumpchainBlockData {
    if (this.blocks.length > 0) {
      throw new Error('BlockService already initialized');
    }

    const genesis = createGenesisBlock(genesisTimestamp);
    this.blocks.push(genesis);
    this.blocksByHash.set(genesis.blockHash, genesis);
    return genesis;
  }

  /**
   * Returns whether the chain has been initialized.
   */
  isInitialized(): boolean {
    return this.blocks.length > 0;
  }

  /**
   * Produces a new block from the given input.
   */
  produceBlock(input: Omit<BlockProducerInput, 'parentHash' | 'parentBlockNumber'>): PumpchainBlockData {
    const latest = this.getLatestBlock();
    if (!latest) {
      throw new Error('Cannot produce block: chain not initialized');
    }

    const block = createBlock({
      ...input,
      parentHash: latest.blockHash,
      parentBlockNumber: latest.blockNumber,
    });

    this.blocks.push(block);
    this.blocksByHash.set(block.blockHash, block);
    return block;
  }

  /**
   * Returns the latest block in the chain.
   */
  getLatestBlock(): PumpchainBlockData | null {
    return this.blocks[this.blocks.length - 1] ?? null;
  }

  /**
   * Returns the current block height (latest block number).
   */
  getCurrentHeight(): number {
    const latest = this.getLatestBlock();
    return latest?.blockNumber ?? -1;
  }

  /**
   * Returns a block by its block number.
   */
  getBlockByNumber(blockNumber: number): PumpchainBlockData | null {
    return this.blocks[blockNumber] ?? null;
  }

  /**
   * Returns a block by its hash.
   */
  getBlockByHash(hash: string): PumpchainBlockData | null {
    return this.blocksByHash.get(hash) ?? null;
  }

  /**
   * Returns a paginated list of blocks (most recent first).
   */
  getBlocks(page: number, pageSize: number): { blocks: PumpchainBlockData[]; total: number } {
    const total = this.blocks.length;
    const start = Math.max(0, total - page * pageSize);
    const end = Math.max(0, total - (page - 1) * pageSize);
    const blocks = this.blocks.slice(start, end).reverse();
    return { blocks, total };
  }

  /**
   * Validates the integrity of the entire chain.
   * Verifies that each block references the correct parent hash.
   */
  validateChain(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    for (let i = 0; i < this.blocks.length; i++) {
      const block = this.blocks[i]!;

      // Verify genesis
      if (i === 0) {
        if (block.parentHash !== ZERO_HASH) {
          errors.push(`Genesis block has non-zero parentHash: ${block.parentHash}`);
        }
        if (block.blockNumber !== 0) {
          errors.push(`Genesis block number is ${block.blockNumber}, expected 0`);
        }
      } else {
        const parent = this.blocks[i - 1]!;
        if (block.parentHash !== parent.blockHash) {
          errors.push(
            `Block ${block.blockNumber} parentHash mismatch: expected ${parent.blockHash}, got ${block.parentHash}`,
          );
        }
        if (block.blockNumber !== parent.blockNumber + 1) {
          errors.push(
            `Block number not monotonic: ${parent.blockNumber} -> ${block.blockNumber}`,
          );
        }
      }

      // Verify block hash is deterministic
      const recomputed = computeBlockHash(block);
      if (recomputed !== block.blockHash) {
        errors.push(
          `Block ${block.blockNumber} hash mismatch: stored=${block.blockHash}, computed=${recomputed}`,
        );
      }
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Returns total number of blocks in the chain.
   */
  getTotalBlocks(): number {
    return this.blocks.length;
  }
}
