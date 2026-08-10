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

export function startNetwork(registry: ServiceRegistry): void {
  registry.networkService.initialize();
  registry.sequencerService.start();

  console.log('[Pumpchain] Network initialized with genesis block');
  console.log(`[Pumpchain] Block height: ${registry.networkService.getCurrentBlockHeight()}`);
}
