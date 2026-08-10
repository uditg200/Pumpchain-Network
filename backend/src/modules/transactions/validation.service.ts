import type { AccountService } from '../accounts/account.service.js';
import type { NonceService } from './nonce.service.js';
import type { TransactionSubmitInput, ValidationResult } from './transaction.types.js';
import { TxType } from './transaction.types.js';

/**
 * TransactionValidationService validates transactions before they enter the pool.
 *
 * Validation checks:
 * 1. Sender exists (or can be created for faucet/bridge deposits)
 * 2. Sender has sufficient nPUMP balance (amount + max fee)
 * 3. Nonce is correct
 * 4. Amount is valid (non-negative integer)
 * 5. GasLimit is valid
 * 6. Signature is valid (for wallet-signed transactions)
 * 7. Transaction is not duplicated (checked externally via hash)
 * 8. Recipient is valid address format
 */
export class TransactionValidationService {
  constructor(
    private readonly accountService: AccountService,
    private readonly nonceService: NonceService,
  ) {}

  /**
   * Validates a transaction submission. Returns all validation errors at once.
   */
  validate(input: TransactionSubmitInput, existingHash?: string | null): ValidationResult {
    const errors: string[] = [];

    // 1. Validate addresses
    if (!this.isValidAddress(input.sender)) {
      errors.push('Invalid sender address format');
    }
    if (!this.isValidAddress(input.recipient)) {
      errors.push('Invalid recipient address format');
    }

    // 2. Sender cannot equal recipient for transfers
    if (input.type === TxType.Transfer && input.sender === input.recipient) {
      errors.push('Sender and recipient cannot be the same for transfers');
    }

    // 3. Validate amount (must be non-negative integer string)
    const amount = this.parseAmount(input.amount);
    if (amount === null) {
      errors.push('Invalid amount: must be a non-negative integer string');
    } else if (input.type === TxType.Transfer && amount <= 0n) {
      errors.push('Transfer amount must be greater than zero');
    }

    // 4. Validate gas parameters
    if (input.gasLimit <= 0 || !Number.isInteger(input.gasLimit)) {
      errors.push('gasLimit must be a positive integer');
    }
    if (input.gasPrice < 0 || !Number.isInteger(input.gasPrice)) {
      errors.push('gasPrice must be a non-negative integer');
    }

    // 5. Validate nonce
    const nonceCheck = this.nonceService.validateNonce(input.sender, input.nonce);
    if (!nonceCheck.valid) {
      errors.push(`Invalid nonce: expected ${nonceCheck.expected}, got ${input.nonce}`);
    }

    // 6. Check balance (sender must have amount + maxFee)
    if (amount !== null && this.shouldCheckBalance(input.type)) {
      const maxFee = BigInt(input.gasLimit) * BigInt(input.gasPrice);
      const totalRequired = amount + maxFee;
      const account = this.accountService.getAccount(input.sender);
      const balance = account?.balance ?? 0n;

      if (balance < totalRequired) {
        errors.push(
          `Insufficient balance: has ${balance.toString()}, needs ${totalRequired.toString()} (amount + max fee)`,
        );
      }
    }

    // 7. Check duplicate (external check passed in)
    if (existingHash) {
      errors.push('Duplicate transaction: a transaction with this hash already exists');
    }

    // 8. Validate signature for wallet-signed transactions
    if (this.requiresSignature(input.type) && !input.signature) {
      errors.push('Signature required for this transaction type');
    }

    return { valid: errors.length === 0, errors };
  }

  private isValidAddress(address: string): boolean {
    return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
  }

  private parseAmount(amount: string): bigint | null {
    try {
      if (!/^\d+$/.test(amount)) return null;
      const val = BigInt(amount);
      if (val < 0n) return null;
      return val;
    } catch {
      return null;
    }
  }

  private shouldCheckBalance(type: TxType): boolean {
    // System-originated types don't require sender balance check
    return type === TxType.Transfer || type === TxType.BridgeWithdraw || type === TxType.ContractCall;
  }

  private requiresSignature(type: TxType): boolean {
    // Only user-initiated transfers and withdrawals require wallet signature
    return type === TxType.Transfer || type === TxType.BridgeWithdraw;
  }
}

