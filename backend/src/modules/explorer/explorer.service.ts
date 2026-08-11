import { eq, sql } from 'drizzle-orm';
import type { Database } from '../../db/index.js';
import { blocks, accounts, tokenBalances } from '../../db/schema.js';
import type { BlockService } from '../blocks/block.service.js';
import type { TransactionService } from '../transactions/transaction.service.js';
import type { AccountService } from '../accounts/account.service.js';
import type { NetworkService } from '../network/network.service.js';

export type SortOrder = 'latest' | 'oldest' | 'highestGas' | 'lowestGas';
export interface PaginationParams { page: number; pageSize: number; sort?: SortOrder; }
export interface PaginatedResult<T> { items: T[]; total: number; page: number; pageSize: number; totalPages: number; }
export interface ExplorerOverview { currentBlock: number; latestBlockHash: string; totalTransactions: number; tps: number; activeAccounts: number; totalGasUsed: string; totalGasFees: string; networkUptime: number; latestBlocks: ExplorerBlock[]; latestTransactions: ExplorerTransaction[]; }
export interface ExplorerBlock { blockNumber: number; blockHash: string; parentHash: string; stateRoot: string; timestamp: string; sequencer: string; transactionCount: number; gasUsed: number; gasLimit: number; }
export interface ExplorerTransaction { txHash: string; blockNumber: number | null; sender: string; recipient: string; amount: string; gasUsed: number; gasPrice: number; fee: string; status: string; type: string; nonce: number; timestamp: string; }
export interface ExplorerAccount { address: string; accountType: string; balance: string; nonce: number; createdAt: string; updatedAt: string; }
export interface ExplorerTokenBalance { address: string; tokenSymbol: string; tokenMint: string; balance: string; }
export interface ExplorerStats { totalBlocks: number; totalTransactions: number; totalAccounts: number; totalGasUsed: string; totalGasFees: string; avgBlockTime: number; avgTxPerBlock: number; tps: number; latestBlockTime: string | null; }
export interface SearchResult { type: 'block' | 'transaction' | 'account' | 'token' | 'unknown'; found: boolean; data: unknown; }

export class ExplorerService {
  private startTime = Date.now();

  constructor(
    private readonly db: Database,
    private readonly blockService: BlockService,
    private readonly transactionService: TransactionService,
    private readonly accountService: AccountService,
    private readonly networkService: NetworkService,
  ) {}

  async getOverview(): Promise<ExplorerOverview> {
    const latestBlocks = this.getMemBlocks(1, 5);
    const latestTxs = this.getMemTxs(1, 10);
    const latestBlock = this.blockService.getLatestBlock();
    return {
      currentBlock: latestBlock?.blockNumber ?? 0,
      latestBlockHash: latestBlock?.blockHash ?? '',
      totalTransactions: this.transactionService.getTotalCount(),
      tps: this.networkService.getCurrentTps(),
      activeAccounts: this.accountService.getTotalCount(),
      totalGasUsed: '0',
      totalGasFees: '0',
      networkUptime: Date.now() - this.startTime,
      latestBlocks: latestBlocks.items,
      latestTransactions: latestTxs.items,
    };
  }

  async getBlocks(params: PaginationParams): Promise<PaginatedResult<ExplorerBlock>> {
    return this.getMemBlocks(params.page, params.pageSize);
  }

  async getBlockByNumber(blockNumber: number): Promise<ExplorerBlock | null> {
    const memBlock = this.blockService.getBlockByNumber(blockNumber);
    if (!memBlock) return null;
    return this.mapMemoryBlock(memBlock);
  }

  async getTransactions(params: PaginationParams): Promise<PaginatedResult<ExplorerTransaction>> {
    return this.getMemTxs(params.page, params.pageSize);
  }

  async getTransactionByHash(hash: string): Promise<ExplorerTransaction | null> {
    const tx = this.transactionService.getTransaction(hash);
    if (!tx) return null;
    return { txHash: tx.txHash, blockNumber: tx.blockNumber, sender: tx.sender, recipient: tx.recipient, amount: tx.amount.toString(), gasUsed: tx.gasUsed, gasPrice: tx.gasPrice, fee: tx.fee.toString(), status: tx.status, type: tx.type, nonce: tx.nonce, timestamp: new Date(tx.timestamp).toISOString() };
  }

  async getAccount(address: string): Promise<ExplorerAccount | null> {
    const memAccount = this.accountService.getAccount(address);
    if (!memAccount) return null;
    return { address: memAccount.address, accountType: 'user', balance: memAccount.balance.toString(), nonce: memAccount.nonce, createdAt: new Date(memAccount.createdAt).toISOString(), updatedAt: new Date(memAccount.updatedAt).toISOString() };
  }

  async getTokenHolders(symbol: string, page: number, pageSize: number): Promise<PaginatedResult<ExplorerTokenBalance>> {
    return { items: [], total: 0, page, pageSize, totalPages: 0 };
  }

  async search(query: string): Promise<SearchResult> {
    const q = query.trim();
    if (!q) return { type: 'unknown', found: false, data: null };
    if (/^\d+$/.test(q)) {
      const block = this.blockService.getBlockByNumber(parseInt(q, 10));
      if (block) return { type: 'block', found: true, data: this.mapMemoryBlock(block) };
    }
    if (/^[a-f0-9]{64}$/i.test(q)) {
      const tx = this.transactionService.getTransaction(q.toLowerCase());
      if (tx) return { type: 'transaction', found: true, data: { txHash: tx.txHash, sender: tx.sender, recipient: tx.recipient, amount: tx.amount.toString(), status: tx.status } };
      const block = this.blockService.getBlockByHash(q.toLowerCase());
      if (block) return { type: 'block', found: true, data: this.mapMemoryBlock(block) };
    }
    if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(q)) {
      const account = this.accountService.getAccount(q);
      if (account) return { type: 'account', found: true, data: { address: account.address, balance: account.balance.toString(), nonce: account.nonce } };
      return { type: 'account', found: false, data: { address: q } };
    }
    return { type: 'unknown', found: false, data: null };
  }

  async getStats(): Promise<ExplorerStats> {
    const totalBlocks = this.blockService.getTotalBlocks();
    const totalTxs = this.transactionService.getTotalCount();
    const totalAccounts = this.accountService.getTotalCount();
    const latestBlock = this.blockService.getLatestBlock();
    return {
      totalBlocks,
      totalTransactions: totalTxs,
      totalAccounts,
      totalGasUsed: '0',
      totalGasFees: '0',
      avgBlockTime: 2000,
      avgTxPerBlock: totalBlocks > 0 ? Math.round((totalTxs / totalBlocks) * 100) / 100 : 0,
      tps: this.networkService.getCurrentTps(),
      latestBlockTime: latestBlock ? new Date(latestBlock.timestamp).toISOString() : null,
    };
  }

  private getMemBlocks(page: number, pageSize: number): PaginatedResult<ExplorerBlock> {
    const { blocks: memBlocks, total } = this.blockService.getBlocks(page, pageSize);
    return { items: memBlocks.map((b) => this.mapMemoryBlock(b)), total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }

  private getMemTxs(page: number, pageSize: number): PaginatedResult<ExplorerTransaction> {
    const { transactions: memTxs, total } = this.transactionService.getTransactions(page, pageSize);
    return {
      items: memTxs.map((tx) => ({ txHash: tx.txHash, blockNumber: tx.blockNumber, sender: tx.sender, recipient: tx.recipient, amount: tx.amount.toString(), gasUsed: tx.gasUsed, gasPrice: tx.gasPrice, fee: tx.fee.toString(), status: tx.status, type: tx.type, nonce: tx.nonce, timestamp: new Date(tx.timestamp).toISOString() })),
      total, page, pageSize, totalPages: Math.ceil(total / pageSize),
    };
  }

  private mapMemoryBlock(block: { blockNumber: number; blockHash: string; parentHash: string; stateRoot: string; timestamp: number; proposer: string; transactionCount: number; gasUsed: number; gasLimit: number }): ExplorerBlock {
    return { blockNumber: block.blockNumber, blockHash: block.blockHash, parentHash: block.parentHash, stateRoot: block.stateRoot, timestamp: new Date(block.timestamp).toISOString(), sequencer: block.proposer, transactionCount: block.transactionCount, gasUsed: block.gasUsed, gasLimit: block.gasLimit };
  }

  private mapBlockRow(row: typeof blocks.$inferSelect): ExplorerBlock {
    return { blockNumber: row.blockNumber, blockHash: row.blockHash, parentHash: row.parentHash, stateRoot: row.stateRoot, timestamp: row.timestamp.toISOString(), sequencer: row.sequencer, transactionCount: row.transactionCount, gasUsed: row.gasUsed, gasLimit: row.gasLimit };
  }
}
