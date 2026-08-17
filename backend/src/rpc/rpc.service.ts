import type { BlockService } from '../modules/blocks/block.service.js';
import type { TransactionService } from '../modules/transactions/transaction.service.js';
import type { AccountService } from '../modules/accounts/account.service.js';
import type { GasService } from '../modules/gas/gas.service.js';
import type { NetworkService } from '../modules/network/network.service.js';
import { TxType } from '../modules/transactions/transaction.types.js';
import type { JsonRpcResponse } from './rpc.types.js';
import { RPC_ERRORS } from './rpc.types.js';

/**
 * RpcService encapsulates all JSON-RPC method logic.
 * Business logic lives here — the route handler only dispatches.
 *
 * Supported methods:
 *   pumpchain_chainId
 *   pumpchain_blockNumber
 *   pumpchain_getBlockByNumber
 *   pumpchain_getBlockByHash
 *   pumpchain_getTransactionByHash
 *   pumpchain_getBalance
 *   pumpchain_getTransactionCount
 *   pumpchain_sendTransaction
 *   pumpchain_estimateGas
 *   pumpchain_getNetworkInfo
 */
export class RpcService {
  constructor(
    private readonly blockService: BlockService,
    private readonly transactionService: TransactionService,
    private readonly accountService: AccountService,
    private readonly gasService: GasService,
    private readonly networkService: NetworkService,
  ) {}

  /**
   * Dispatches a method call and returns the result or error.
   */
  async dispatch(method: string, params: unknown[]): Promise<{ result?: unknown; error?: { code: number; message: string; data?: unknown } }> {
    switch (method) {
      case 'pumpchain_chainId':
        return this.chainId();
      case 'pumpchain_blockNumber':
        return this.blockNumber();
      case 'pumpchain_getBlockByNumber':
        return this.getBlockByNumber(params);
      case 'pumpchain_getBlockByHash':
        return this.getBlockByHash(params);
      case 'pumpchain_getTransactionByHash':
        return this.getTransactionByHash(params);
      case 'pumpchain_getBalance':
        return this.getBalance(params);
      case 'pumpchain_getTransactionCount':
        return this.getTransactionCount(params);
      case 'pumpchain_sendTransaction':
        return this.sendTransaction(params);
      case 'pumpchain_estimateGas':
        return this.estimateGas(params);
      case 'pumpchain_getNetworkInfo':
        return this.getNetworkInfo();
      default:
        return { error: { ...RPC_ERRORS.METHOD_NOT_FOUND, data: { method } } };
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // pumpchain_chainId
  // Returns the chain identifier string.
  // Params: none
  // ─────────────────────────────────────────────────────────────────────────
  private chainId() {
    return { result: 'ansem-mainnet' };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // pumpchain_blockNumber
  // Returns the current block height as a number.
  // Params: none
  // ─────────────────────────────────────────────────────────────────────────
  private blockNumber() {
    return { result: this.blockService.getCurrentHeight() };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // pumpchain_getBlockByNumber
  // Returns block data for the given block number.
  // Params: [blockNumber: number]
  // ─────────────────────────────────────────────────────────────────────────
  private getBlockByNumber(params: unknown[]) {
    const blockNum = this.parseBlockNumber(params[0]);
    if (blockNum === null) {
      return { error: { ...RPC_ERRORS.INVALID_PARAMS, data: 'params[0] must be a valid block number' } };
    }

    const block = this.blockService.getBlockByNumber(blockNum);
    if (!block) {
      return { error: { ...RPC_ERRORS.BLOCK_NOT_FOUND, data: { blockNumber: blockNum } } };
    }

    return { result: this.formatBlock(block) };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // pumpchain_getBlockByHash
  // Returns block data for the given block hash.
  // Params: [blockHash: string (64 hex chars)]
  // ─────────────────────────────────────────────────────────────────────────
  private getBlockByHash(params: unknown[]) {
    const hash = this.parseHash(params[0]);
    if (!hash) {
      return { error: { ...RPC_ERRORS.INVALID_PARAMS, data: 'params[0] must be a 64-character hex hash' } };
    }

    const block = this.blockService.getBlockByHash(hash);
    if (!block) {
      return { error: { ...RPC_ERRORS.BLOCK_NOT_FOUND, data: { blockHash: hash } } };
    }

    return { result: this.formatBlock(block) };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // pumpchain_getTransactionByHash
  // Returns transaction data for the given tx hash.
  // Params: [txHash: string (64 hex chars)]
  // ─────────────────────────────────────────────────────────────────────────
  private getTransactionByHash(params: unknown[]) {
    const hash = this.parseHash(params[0]);
    if (!hash) {
      return { error: { ...RPC_ERRORS.INVALID_PARAMS, data: 'params[0] must be a 64-character hex hash' } };
    }

    const tx = this.transactionService.getTransaction(hash);
    if (!tx) {
      return { error: { ...RPC_ERRORS.TX_NOT_FOUND, data: { txHash: hash } } };
    }

    return {
      result: {
        txHash: tx.txHash,
        sender: tx.sender,
        recipient: tx.recipient,
        amount: tx.amount.toString(),
        nonce: tx.nonce,
        type: tx.type,
        status: tx.status,
        blockNumber: tx.blockNumber,
        gasLimit: tx.gasLimit,
        gasUsed: tx.gasUsed,
        gasPrice: tx.gasPrice,
        fee: tx.fee.toString(),
        timestamp: tx.timestamp,
      },
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // pumpchain_getBalance
  // Returns the nPUMP balance for an address (in base units as string).
  // Params: [address: string]
  // ─────────────────────────────────────────────────────────────────────────
  private getBalance(params: unknown[]) {
    const address = this.parseAddress(params[0]);
    if (!address) {
      return { error: { ...RPC_ERRORS.INVALID_PARAMS, data: 'params[0] must be a valid base58 address (32-44 chars)' } };
    }

    const account = this.accountService.getAccount(address);
    return {
      result: {
        address,
        balance: account?.balance.toString() ?? '0',
        nonce: account?.nonce ?? 0,
      },
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // pumpchain_getTransactionCount
  // Returns the nonce (number of sent transactions) for an address.
  // Params: [address: string]
  // ─────────────────────────────────────────────────────────────────────────
  private getTransactionCount(params: unknown[]) {
    const address = this.parseAddress(params[0]);
    if (!address) {
      return { error: { ...RPC_ERRORS.INVALID_PARAMS, data: 'params[0] must be a valid base58 address' } };
    }

    const nonce = this.accountService.getNonce(address);
    return { result: nonce };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // pumpchain_sendTransaction
  // Submits a signed transaction to the mempool.
  // Params: [{ sender, recipient, amount, nonce, gasLimit, gasPrice, signature, data? }]
  // ─────────────────────────────────────────────────────────────────────────
  private sendTransaction(params: unknown[]) {
    const txParams = params[0] as Record<string, unknown> | undefined;
    if (!txParams || typeof txParams !== 'object') {
      return { error: { ...RPC_ERRORS.INVALID_PARAMS, data: 'params[0] must be a transaction object' } };
    }

    const { sender, recipient, amount, nonce, gasLimit, gasPrice, signature, data } = txParams;

    // Validate required fields
    if (!sender || typeof sender !== 'string') {
      return { error: { ...RPC_ERRORS.INVALID_PARAMS, data: 'sender is required and must be a string' } };
    }
    if (!recipient || typeof recipient !== 'string') {
      return { error: { ...RPC_ERRORS.INVALID_PARAMS, data: 'recipient is required and must be a string' } };
    }
    if (amount === undefined || amount === null) {
      return { error: { ...RPC_ERRORS.INVALID_PARAMS, data: 'amount is required' } };
    }
    if (!signature || typeof signature !== 'string') {
      return { error: { ...RPC_ERRORS.INVALID_PARAMS, data: 'signature is required' } };
    }

    const result = this.transactionService.submit({
      sender: String(sender),
      recipient: String(recipient),
      nonce: Number(nonce ?? 0),
      type: TxType.Transfer,
      amount: String(amount),
      gasLimit: Number(gasLimit ?? 21000),
      gasPrice: Number(gasPrice ?? 1),
      signature: String(signature),
      inputData: data ? String(data) : null,
    });

    if (result.errors.length > 0) {
      return { error: { ...RPC_ERRORS.TX_VALIDATION_FAILED, data: result.errors } };
    }

    return {
      result: {
        txHash: result.tx!.txHash,
        status: result.tx!.status,
        nonce: result.tx!.nonce,
      },
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // pumpchain_estimateGas
  // Estimates gas for a transaction.
  // Params: [{ type?, data? }] or []
  // ─────────────────────────────────────────────────────────────────────────
  private estimateGas(params: unknown[]) {
    const opts = (params[0] as Record<string, unknown>) ?? {};
    const inputData = opts['data'] ? String(opts['data']) : null;
    const gasLimit = this.gasService.computeGasUsed(inputData?.length ?? 0);
    const gasPrice = this.gasService.getCurrentGasPrice();
    const estimatedFee = (BigInt(gasLimit) * BigInt(gasPrice)).toString();

    return {
      result: { gasLimit, gasPrice, estimatedFee },
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // pumpchain_getNetworkInfo
  // Returns overall network information.
  // Params: none
  // ─────────────────────────────────────────────────────────────────────────
  private getNetworkInfo() {
    const info = this.networkService.getNetworkInfo();
    return {
      result: {
        networkId: info.networkId,
        chainName: info.chainName,
        nativeSymbol: info.nativeSymbol,
        environment: info.environment,
        currentBlockHeight: info.currentBlockHeight,
        tps: info.tps,
        totalTransactions: info.totalTransactions,
        activeAccounts: info.activeAccounts,
        status: info.status,
      },
    };
  }

  // ─── Helpers ───

  private formatBlock(block: { blockNumber: number; blockHash: string; parentHash: string; timestamp: number; proposer: string; transactionCount: number; gasUsed: number; gasLimit: number; stateRoot: string; previousStateRoot: string }) {
    return {
      blockNumber: block.blockNumber,
      blockHash: block.blockHash,
      parentHash: block.parentHash,
      timestamp: block.timestamp,
      proposer: block.proposer,
      transactionCount: block.transactionCount,
      gasUsed: block.gasUsed,
      gasLimit: block.gasLimit,
      stateRoot: block.stateRoot,
      previousStateRoot: block.previousStateRoot,
    };
  }

  private parseBlockNumber(value: unknown): number | null {
    if (typeof value === 'number' && Number.isInteger(value) && value >= 0) return value;
    if (typeof value === 'string' && /^\d+$/.test(value)) return parseInt(value, 10);
    return null;
  }

  private parseHash(value: unknown): string | null {
    if (typeof value === 'string' && /^[a-f0-9]{64}$/i.test(value)) return value.toLowerCase();
    return null;
  }

  private parseAddress(value: unknown): string | null {
    if (typeof value === 'string' && /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value)) return value;
    return null;
  }
}

