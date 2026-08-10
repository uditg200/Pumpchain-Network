import { describe, it, expect, beforeEach } from 'vitest';
import { BlockService } from '../block.service.js';
import { createGenesisBlock, createBlock, computeBlockHash } from '../block.producer.js';
import { hashBlockHeader, serializeBlockHeader, sha256, ZERO_HASH } from '../block.hash.js';
import type { PumpchainBlockData } from '../block.types.js';

describe('Pumpchain Blockchain Integrity', () => {
  let blockService: BlockService;

  beforeEach(() => {
    blockService = new BlockService();
  });

  describe('Genesis Block', () => {
    it('genesis block exists after initialization', () => {
      blockService.initialize(1000000);
      const genesis = blockService.getBlockByNumber(0);
      expect(genesis).not.toBeNull();
      expect(genesis!.blockNumber).toBe(0);
    });

    it('genesis block has zero parent hash', () => {
      blockService.initialize(1000000);
      const genesis = blockService.getBlockByNumber(0)!;
      expect(genesis.parentHash).toBe(ZERO_HASH);
      expect(genesis.parentHash).toBe('0'.repeat(64));
    });

    it('genesis block has blockNumber 0', () => {
      blockService.initialize(1000000);
      const genesis = blockService.getBlockByNumber(0)!;
      expect(genesis.blockNumber).toBe(0);
    });

    it('genesis block has zero transactions and gas', () => {
      blockService.initialize(1000000);
      const genesis = blockService.getBlockByNumber(0)!;
      expect(genesis.transactionCount).toBe(0);
      expect(genesis.gasUsed).toBe(0);
    });

    it('genesis block timestamp matches initialization time', () => {
      const timestamp = 1700000000000;
      blockService.initialize(timestamp);
      const genesis = blockService.getBlockByNumber(0)!;
      expect(genesis.timestamp).toBe(timestamp);
    });

    it('genesis block has a valid non-empty hash', () => {
      blockService.initialize(1000000);
      const genesis = blockService.getBlockByNumber(0)!;
      expect(genesis.blockHash).toBeDefined();
      expect(genesis.blockHash.length).toBe(64);
      expect(/^[a-f0-9]{64}$/.test(genesis.blockHash)).toBe(true);
    });
  });

  describe('Block Chaining (Block N references Block N-1)', () => {
    it('block 1 parentHash equals genesis blockHash', () => {
      blockService.initialize(1000000);
      const genesis = blockService.getBlockByNumber(0)!;

      blockService.produceBlock({
        proposer: 'TestSequencer111111111111111111111111111111',
        transactions: [],
        gasLimit: 50_000_000,
        previousStateRoot: genesis.stateRoot,
        stateRoot: sha256('state_after_block_1'),
      });

      const block1 = blockService.getBlockByNumber(1)!;
      expect(block1.parentHash).toBe(genesis.blockHash);
    });

    it('block 2 parentHash equals block 1 blockHash', () => {
      blockService.initialize(1000000);
      const genesis = blockService.getBlockByNumber(0)!;

      blockService.produceBlock({
        proposer: 'TestSequencer111111111111111111111111111111',
        transactions: [],
        gasLimit: 50_000_000,
        previousStateRoot: genesis.stateRoot,
        stateRoot: sha256('state_after_block_1'),
      });

      const block1 = blockService.getBlockByNumber(1)!;

      blockService.produceBlock({
        proposer: 'TestSequencer111111111111111111111111111111',
        transactions: [],
        gasLimit: 50_000_000,
        previousStateRoot: block1.stateRoot,
        stateRoot: sha256('state_after_block_2'),
      });

      const block2 = blockService.getBlockByNumber(2)!;
      expect(block2.parentHash).toBe(block1.blockHash);
    });

    it('entire chain validates correctly', () => {
      blockService.initialize(1000000);

      for (let i = 0; i < 5; i++) {
        const latest = blockService.getLatestBlock()!;
        blockService.produceBlock({
          proposer: 'TestSequencer111111111111111111111111111111',
          transactions: [{ hash: sha256(`tx_${i}`), gasUsed: 5000 }],
          gasLimit: 50_000_000,
          previousStateRoot: latest.stateRoot,
          stateRoot: sha256(`state_${i + 1}`),
        });
      }

      const result = blockService.validateChain();
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('Deterministic Block Hashes', () => {
    it('same block data produces same hash', () => {
      const genesis1 = createGenesisBlock(1700000000000);
      const genesis2 = createGenesisBlock(1700000000000);
      expect(genesis1.blockHash).toBe(genesis2.blockHash);
    });

    it('different timestamps produce different hashes', () => {
      const genesis1 = createGenesisBlock(1700000000000);
      const genesis2 = createGenesisBlock(1700000000001);
      expect(genesis1.blockHash).not.toBe(genesis2.blockHash);
    });

    it('recomputing hash matches stored hash', () => {
      blockService.initialize(1700000000000);
      const genesis = blockService.getBlockByNumber(0)!;
      const recomputed = computeBlockHash(genesis);
      expect(recomputed).toBe(genesis.blockHash);
    });

    it('recomputing hash for produced blocks matches stored hash', () => {
      blockService.initialize(1700000000000);

      blockService.produceBlock({
        proposer: 'TestSequencer111111111111111111111111111111',
        transactions: [
          { hash: sha256('tx_a'), gasUsed: 5000 },
          { hash: sha256('tx_b'), gasUsed: 8000 },
        ],
        gasLimit: 50_000_000,
        previousStateRoot: sha256('prev_state'),
        stateRoot: sha256('new_state'),
      });

      const block1 = blockService.getBlockByNumber(1)!;
      const recomputed = computeBlockHash(block1);
      expect(recomputed).toBe(block1.blockHash);
    });

    it('serialization is canonical (sorted keys)', () => {
      const header = {
        blockNumber: 1,
        parentHash: 'abc',
        timestamp: 123,
        proposer: 'xyz',
        transactionCount: 2,
        gasUsed: 10000,
        gasLimit: 50000000,
        stateRoot: 'def',
        previousStateRoot: 'ghi',
      };
      const serialized = serializeBlockHeader(header);
      const parsed = JSON.parse(serialized);
      const keys = Object.keys(parsed);
      const sortedKeys = [...keys].sort();
      expect(keys).toEqual(sortedKeys);
    });
  });

  describe('Changing Transaction Data Changes Block Hash', () => {
    it('block with different transactions has different hash', () => {
      blockService.initialize(1700000000000);
      const genesis = blockService.getBlockByNumber(0)!;

      // We need to create two separate chains to compare
      const service1 = new BlockService();
      service1.initialize(1700000000000);
      service1.produceBlock({
        proposer: 'TestSequencer111111111111111111111111111111',
        transactions: [{ hash: sha256('tx_AAA'), gasUsed: 5000 }],
        gasLimit: 50_000_000,
        previousStateRoot: sha256('state0'),
        stateRoot: sha256('state1a'),
      });

      const service2 = new BlockService();
      service2.initialize(1700000000000);
      service2.produceBlock({
        proposer: 'TestSequencer111111111111111111111111111111',
        transactions: [{ hash: sha256('tx_BBB'), gasUsed: 5000 }],
        gasLimit: 50_000_000,
        previousStateRoot: sha256('state0'),
        stateRoot: sha256('state1b'),
      });

      const block1a = service1.getBlockByNumber(1)!;
      const block1b = service2.getBlockByNumber(1)!;

      // Blocks have different state roots (different transactions change state)
      // so their hashes must differ
      expect(block1a.blockHash).not.toBe(block1b.blockHash);
    });

    it('different gas usage produces different block hash', () => {
      const service1 = new BlockService();
      service1.initialize(1700000000000);
      service1.produceBlock({
        proposer: 'TestSequencer111111111111111111111111111111',
        transactions: [{ hash: sha256('tx_1'), gasUsed: 5000 }],
        gasLimit: 50_000_000,
        previousStateRoot: sha256('s0'),
        stateRoot: sha256('s1'),
      });

      const service2 = new BlockService();
      service2.initialize(1700000000000);
      service2.produceBlock({
        proposer: 'TestSequencer111111111111111111111111111111',
        transactions: [{ hash: sha256('tx_1'), gasUsed: 9999 }],
        gasLimit: 50_000_000,
        previousStateRoot: sha256('s0'),
        stateRoot: sha256('s1'),
      });

      const b1 = service1.getBlockByNumber(1)!;
      const b2 = service2.getBlockByNumber(1)!;
      expect(b1.blockHash).not.toBe(b2.blockHash);
    });

    it('different transaction count produces different block hash', () => {
      const service1 = new BlockService();
      service1.initialize(1700000000000);
      service1.produceBlock({
        proposer: 'TestSequencer111111111111111111111111111111',
        transactions: [{ hash: sha256('tx_1'), gasUsed: 5000 }],
        gasLimit: 50_000_000,
        previousStateRoot: sha256('s0'),
        stateRoot: sha256('s1'),
      });

      const service2 = new BlockService();
      service2.initialize(1700000000000);
      service2.produceBlock({
        proposer: 'TestSequencer111111111111111111111111111111',
        transactions: [
          { hash: sha256('tx_1'), gasUsed: 3000 },
          { hash: sha256('tx_2'), gasUsed: 2000 },
        ],
        gasLimit: 50_000_000,
        previousStateRoot: sha256('s0'),
        stateRoot: sha256('s1'),
      });

      const b1 = service1.getBlockByNumber(1)!;
      const b2 = service2.getBlockByNumber(1)!;
      expect(b1.blockHash).not.toBe(b2.blockHash);
    });
  });

  describe('Block Height Increases Monotonically', () => {
    it('height starts at 0 after genesis', () => {
      blockService.initialize(1000000);
      expect(blockService.getCurrentHeight()).toBe(0);
    });

    it('height increases by 1 with each produced block', () => {
      blockService.initialize(1000000);

      for (let i = 1; i <= 10; i++) {
        const latest = blockService.getLatestBlock()!;
        blockService.produceBlock({
          proposer: 'TestSequencer111111111111111111111111111111',
          transactions: [],
          gasLimit: 50_000_000,
          previousStateRoot: latest.stateRoot,
          stateRoot: sha256(`state_${i}`),
        });
        expect(blockService.getCurrentHeight()).toBe(i);
      }
    });

    it('block numbers are consecutive with no gaps', () => {
      blockService.initialize(1000000);

      for (let i = 0; i < 20; i++) {
        const latest = blockService.getLatestBlock()!;
        blockService.produceBlock({
          proposer: 'TestSequencer111111111111111111111111111111',
          transactions: [],
          gasLimit: 50_000_000,
          previousStateRoot: latest.stateRoot,
          stateRoot: sha256(`state_${i + 1}`),
        });
      }

      // Verify every block number from 0 to 20
      for (let i = 0; i <= 20; i++) {
        const block = blockService.getBlockByNumber(i);
        expect(block).not.toBeNull();
        expect(block!.blockNumber).toBe(i);
      }
    });

    it('getTotalBlocks returns correct count', () => {
      blockService.initialize(1000000);
      expect(blockService.getTotalBlocks()).toBe(1); // genesis

      for (let i = 0; i < 5; i++) {
        const latest = blockService.getLatestBlock()!;
        blockService.produceBlock({
          proposer: 'TestSequencer111111111111111111111111111111',
          transactions: [],
          gasLimit: 50_000_000,
          previousStateRoot: latest.stateRoot,
          stateRoot: sha256(`state_${i + 1}`),
        });
      }

      expect(blockService.getTotalBlocks()).toBe(6); // genesis + 5
    });
  });

  describe('Chain Validation', () => {
    it('detects tampered parent hash', () => {
      blockService.initialize(1000000);
      const latest = blockService.getLatestBlock()!;
      blockService.produceBlock({
        proposer: 'TestSequencer111111111111111111111111111111',
        transactions: [],
        gasLimit: 50_000_000,
        previousStateRoot: latest.stateRoot,
        stateRoot: sha256('s1'),
      });

      // Tamper with the block's parent hash directly (simulating corruption)
      const block1 = blockService.getBlockByNumber(1)!;
      (block1 as any).parentHash = sha256('fake_parent');

      const result = blockService.validateChain();
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('detects tampered block hash', () => {
      blockService.initialize(1000000);
      const latest = blockService.getLatestBlock()!;
      blockService.produceBlock({
        proposer: 'TestSequencer111111111111111111111111111111',
        transactions: [],
        gasLimit: 50_000_000,
        previousStateRoot: latest.stateRoot,
        stateRoot: sha256('s1'),
      });

      // Tamper with the stored block hash
      const block1 = blockService.getBlockByNumber(1)!;
      (block1 as any).blockHash = sha256('wrong_hash');

      const result = blockService.validateChain();
      expect(result.valid).toBe(false);
    });
  });
});
