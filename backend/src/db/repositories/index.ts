import type { Database } from '../index.js';
import { BlockRepository } from './block.repository.js';
import { TransactionRepository } from './transaction.repository.js';
import { AccountRepository } from './account.repository.js';
import { NetworkMetadataRepository } from './network-metadata.repository.js';
import { BridgeRepository } from './bridge.repository.js';
import { FaucetRepository } from './faucet.repository.js';
import { MetricsRepository } from './metrics.repository.js';
import { SequencerEventRepository } from './sequencer-event.repository.js';

export interface Repositories {
  blocks: BlockRepository;
  transactions: TransactionRepository;
  accounts: AccountRepository;
  networkMetadata: NetworkMetadataRepository;
  bridge: BridgeRepository;
  faucet: FaucetRepository;
  metrics: MetricsRepository;
  sequencerEvents: SequencerEventRepository;
}

/**
 * Creates all repository instances with the given database connection.
 */
export function createRepositories(db: Database): Repositories {
  return {
    blocks: new BlockRepository(db),
    transactions: new TransactionRepository(db),
    accounts: new AccountRepository(db),
    networkMetadata: new NetworkMetadataRepository(db),
    bridge: new BridgeRepository(db),
    faucet: new FaucetRepository(db),
    metrics: new MetricsRepository(db),
    sequencerEvents: new SequencerEventRepository(db),
  };
}

export { BlockRepository } from './block.repository.js';
export { TransactionRepository } from './transaction.repository.js';
export { AccountRepository } from './account.repository.js';
export { NetworkMetadataRepository } from './network-metadata.repository.js';
export { BridgeRepository } from './bridge.repository.js';
export { FaucetRepository } from './faucet.repository.js';
export { MetricsRepository } from './metrics.repository.js';
export { SequencerEventRepository } from './sequencer-event.repository.js';
