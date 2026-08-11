import { BlockService } from './blocks/block.service.js';
import { TransactionService } from './transactions/transaction.service.js';
import { AccountService } from './accounts/account.service.js';
import { GasService } from './gas/gas.service.js';
import { NetworkService } from './network/network.service.js';
import { SequencerService } from './sequencer/sequencer.service.js';
import { BridgeService } from './bridge/bridge.service.js';
import { FaucetService } from './faucet/faucet.service.js';
import { SolanaService } from './solana/solana.service.js';
import { ExplorerService } from './explorer/explorer.service.js';
import { db } from '../db/index.js';

export interface ServiceRegistry {
  blockService: BlockService;
  transactionService: TransactionService;
  accountService: AccountService;
  gasService: GasService;
  networkService: NetworkService;
  sequencerService: SequencerService;
  bridgeService: BridgeService;
  faucetService: FaucetService;
  solanaService: SolanaService;
  explorerService: ExplorerService;
}

export function createServiceRegistry(): ServiceRegistry {
  const blockService = new BlockService();
  const accountService = new AccountService();
  const gasService = new GasService();
  const solanaService = new SolanaService();

  const transactionService = new TransactionService(accountService, gasService);

  const networkService = new NetworkService(
    blockService,
    transactionService,
    accountService,
    gasService,
  );

  const sequencerService = new SequencerService(
    blockService,
    transactionService,
    accountService,
    gasService,
    networkService,
    {
      blockIntervalMs: 2000,
      maxTransactionsPerBlock: 500,
      produceEmptyBlocks: false,
    },
  );

  const bridgeService = new BridgeService(solanaService, transactionService, accountService, db);
  const faucetService = new FaucetService(accountService, transactionService, db);
  const explorerService = new ExplorerService(db, blockService, transactionService, accountService, networkService);

  return {
    blockService,
    transactionService,
    accountService,
    gasService,
    networkService,
    sequencerService,
    bridgeService,
    faucetService,
    solanaService,
    explorerService,
  };
}

export async function startNetwork(registry: ServiceRegistry): Promise<void> {
  // Load persisted state from PostgreSQL
  const hasBlocks = await registry.blockService.loadFromDb();
  await registry.transactionService.loadFromDb();
  await registry.accountService.loadFromDb();

  // Only create genesis if no blocks exist in DB
  if (!hasBlocks) {
    registry.networkService.initialize();
    console.log('[Pumpchain] Network initialized with genesis block');
  } else {
    // Mark network as initialized without creating duplicate genesis
    console.log(`[Pumpchain] Restored from database — block height: ${registry.blockService.getCurrentHeight()}`);
  }

  // Start the sequencer
  registry.sequencerService.start();
  console.log(`[Pumpchain] Block height: ${registry.blockService.getCurrentHeight()}`);
}
