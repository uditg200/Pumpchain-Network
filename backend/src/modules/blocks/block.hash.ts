import { createHash } from 'crypto';

/**
 * Deterministic hashing utilities for the Pumpchain block model.
 *
 * All hashes are computed from canonical JSON serialization of block headers.
 * This ensures that identical block data always produces identical hashes,
 * and any mutation of block data produces a completely different hash.
 */

/**
 * Canonical block header fields used for hash computation.
 * The order of fields is fixed to ensure determinism.
 */
interface BlockHeaderForHashing {
  blockNumber: number;
  parentHash: string;
  timestamp: number;
  proposer: string;
  transactionCount: number;
  gasUsed: number;
  gasLimit: number;
  stateRoot: string;
  previousStateRoot: string;
}

/**
 * Computes a SHA-256 hash of the canonical serialized block header.
 * The serialization is deterministic: fields are ordered alphabetically by key.
 */
export function hashBlockHeader(header: BlockHeaderForHashing): string {
  const canonical = serializeBlockHeader(header);
  return sha256(canonical);
}

/**
 * Produces a deterministic canonical string representation of the block header.
 * Keys are sorted alphabetically to guarantee consistent ordering.
 */
export function serializeBlockHeader(header: BlockHeaderForHashing): string {
  const ordered: Record<string, unknown> = {};
  const keys = Object.keys(header).sort();
  for (const key of keys) {
    ordered[key] = header[key as keyof BlockHeaderForHashing];
  }
  return JSON.stringify(ordered);
}

/**
 * Computes SHA-256 hash of arbitrary data and returns a hex string.
 */
export function sha256(data: string): string {
  return createHash('sha256').update(data, 'utf-8').digest('hex');
}

/**
 * Computes a transaction hash from its canonical data.
 */
export function hashTransaction(txData: {
  from: string;
  to: string;
  amount: string;
  nonce: number;
  timestamp: number;
  data?: string;
}): string {
  const canonical = JSON.stringify({
    amount: txData.amount,
    data: txData.data ?? '',
    from: txData.from,
    nonce: txData.nonce,
    timestamp: txData.timestamp,
    to: txData.to,
  });
  return sha256(canonical);
}

/**
 * Computes a simple state root from a list of account states.
 * In a production system this would be a Merkle tree root.
 * For the prototype, we hash the sorted concatenation of account hashes.
 */
export function computeStateRoot(
  accountStates: Array<{ address: string; balance: string; nonce: number }>,
): string {
  if (accountStates.length === 0) {
    return sha256('empty_state');
  }
  const sorted = [...accountStates].sort((a, b) => a.address.localeCompare(b.address));
  const serialized = JSON.stringify(sorted);
  return sha256(serialized);
}

/** The null/zero hash used for genesis block's parentHash */
export const ZERO_HASH = '0'.repeat(64);
