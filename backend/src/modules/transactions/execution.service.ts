import type { AccountService } from '../accounts/account.service.js';
import type { GasService } from '../gas/gas.service.js';
import type { PumpchainTransaction, TransactionReceipt } from './transaction.types.js';
import { TxType, TxStatus } from './transaction.types.js';

/**
 * Execution result from processing a single transaction.
 */
export interface ExecutionResult {
  success: boolean;
  gasUsed: number;
  fee: bigint;
  error?: string;
}

/**
 * TransactionExecutionService handles the actual state mutations
 * for confirmed transactions.
 *
 * It modifies persisted account balances — every successful transaction
 * permanently changes state.
 */
export class TransactionExecutionService {
  constructor(
    private readonly accountService: AccountService,
    private readonly gasService: GasService,
  ) {}

  /**
   * Executes a single transaction, mutating account state.
   *
   * State changes:
   * - Debit sender: amount + fee
   * - Credit recipient: amount
   * - Increment sender nonce
   *
   * Returns the execution result with actual gas used.
   */
  execute(tx: PumpchainTransaction): ExecutionResult {
    const gasUsed = this.gasService.computeGasUsed(tx.inputData?.length ?? 0);
    const fee = BigInt(gasUsed) * BigInt(tx.gasPrice);

    // Verify gas doesn't exceed limit
    if (gasUsed > tx.gasLimit) {
      return {
        success: false,
        gasUsed: tx.gasLimit, // Charge full gas limit on OOG
        fee: BigInt(tx.gasLimit) * BigInt(tx.gasPrice),
        error: 'Out of gas: execution exceeded gasLimit',
      };
    }

    try {
      switch (tx.type) {
        case TxType.Transfer:
          return this.executeTransfer(tx, gasUsed, fee);

        case TxType.FaucetClaim:
          return this.executeFaucetClaim(tx, gasUsed);

        case TxType.BridgeDeposit:
          return this.executeBridgeDeposit(tx, gasUsed);

        case TxType.BridgeWithdraw:
          return this.executeBridgeWithdraw(tx, gasUsed, fee);

        case TxType.ContractCall:
          // Placeholder: contract calls are not yet fully implemented
          return this.executeTransfer(tx, gasUsed, fee);

        default:
          return { success: false, gasUsed, fee, error: `Unknown tx type: ${tx.type}` };
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Execution failed';
      return { success: false, gasUsed, fee, error: message };
    }
  }

  /**
   * Executes a TRANSFER: debit sender (amount + fee), credit recipient (amount).
   */
  private executeTransfer(tx: PumpchainTransaction, gasUsed: number, fee: bigint): ExecutionResult {
    const totalDebit = tx.amount + fee;

    // Verify sender balance one final time (could have changed since validation)
    const senderAccount = this.accountService.getAccount(tx.sender);
    if (!senderAccount || senderAccount.balance < totalDebit) {
      return {
        success: false,
        gasUsed,
        fee,
        error: `Insufficient balance at execution: has ${senderAccount?.balance.toString() ?? '0'}, needs ${totalDebit.toString()}`,
      };
    }

    // Mutate state
    this.accountService.debit(tx.sender, totalDebit);
    this.accountService.credit(tx.recipient, tx.amount);
    this.accountService.incrementNonce(tx.sender);

    return { success: true, gasUsed, fee };
  }

  /**
   * Executes a FAUCET_CLAIM: credit recipient, no fee charged.
   */
  private executeFaucetClaim(tx: PumpchainTransaction, gasUsed: number): ExecutionResult {
    this.accountService.credit(tx.recipient, tx.amount);
    return { success: true, gasUsed, fee: 0n };
  }

  /**
   * Executes a BRIDGE_DEPOSIT: credit recipient on Pumpchain, no fee.
   */
  private executeBridgeDeposit(tx: PumpchainTransaction, gasUsed: number): ExecutionResult {
    this.accountService.credit(tx.recipient, tx.amount);
    return { success: true, gasUsed, fee: 0n };
  }

  /**
   * Executes a BRIDGE_WITHDRAW: debit sender (amount + fee).
   */
  private executeBridgeWithdraw(
    tx: PumpchainTransaction,
    gasUsed: number,
    fee: bigint,
  ): ExecutionResult {
    const totalDebit = tx.amount + fee;
    const senderAccount = this.accountService.getAccount(tx.sender);
    if (!senderAccount || senderAccount.balance < totalDebit) {
      return {
        success: false,
        gasUsed,
        fee,
        error: 'Insufficient balance for bridge withdrawal',
      };
    }

    this.accountService.debit(tx.sender, totalDebit);
    this.accountService.incrementNonce(tx.sender);
    return { success: true, gasUsed, fee };
  }

  /**
   * Generates a receipt from a processed transaction.
   */
  generateReceipt(tx: PumpchainTransaction): TransactionReceipt {
    return {
      txHash: tx.txHash,
      status: tx.status,
      blockNumber: tx.blockNumber,
      gasUsed: tx.gasUsed,
      fee: tx.fee.toString(),
      sender: tx.sender,
      recipient: tx.recipient,
      amount: tx.amount.toString(),
      timestamp: tx.timestamp,
    };
  }
}
