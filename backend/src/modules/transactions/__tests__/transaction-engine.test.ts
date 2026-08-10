import { describe, it, expect, beforeEach } from 'vitest';
import { TransactionService } from '../transaction.service.js';
import { AccountService } from '../../accounts/account.service.js';
import { GasService } from '../../gas/gas.service.js';
import { TxType, TxStatus } from '../transaction.types.js';
import { hashTransaction } from '../../blocks/block.hash.js';

describe('Pumpchain Transaction Engine', () => {
  let txService: TransactionService;
  let accountService: AccountService;
  let gasService: GasService;

  const SENDER = 'SenderAddr1111111111111111111111111111111';
  const RECIPIENT = 'RecipientAddr11111111111111111111111111111';
  const INITIAL_BALANCE = 1_000_000_000n; // 1 PUMP

  beforeEach(() => {
    accountService = new AccountService();
    gasService = new GasService();
    txService = new TransactionService(accountService, gasService);

    // Seed sender with balance
    accountService.credit(SENDER, INITIAL_BALANCE);
  });

  describe('Successful Transfer', () => {
    it('submits a valid transfer and it enters PENDING', () => {
      const result = txService.submit({
        sender: SENDER,
        recipient: RECIPIENT,
        nonce: 0,
        type: TxType.Transfer,
        amount: '500000000', // 0.5 PUMP
        gasLimit: 21000,
        gasPrice: 1,
        signature: 'valid_sig_placeholder',
      });

      expect(result.errors).toHaveLength(0);
      expect(result.tx).not.toBeNull();
      expect(result.tx!.status).toBe(TxStatus.Pending);
      expect(result.tx!.txHash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('executing a transfer debits sender and credits recipient', () => {
      const { tx } = txService.submit({
        sender: SENDER,
        recipient: RECIPIENT,
        nonce: 0,
        type: TxType.Transfer,
        amount: '500000000',
        gasLimit: 21000,
        gasPrice: 1,
        signature: 'valid_sig',
      });

      // Execute (as sequencer would)
      const executed = txService.executeTransaction(tx!.txHash, 1);
      expect(executed).not.toBeNull();
      expect(executed!.status).toBe(TxStatus.Confirmed);
      expect(executed!.blockNumber).toBe(1);
      expect(executed!.gasUsed).toBeGreaterThan(0);
      expect(executed!.fee).toBeGreaterThan(0n);

      // Verify state changes
      const senderAccount = accountService.getAccount(SENDER)!;
      const recipientAccount = accountService.getAccount(RECIPIENT)!;
      expect(recipientAccount.balance).toBe(500000000n);
      expect(senderAccount.balance).toBeLessThan(INITIAL_BALANCE);
      // sender lost amount + fee
      expect(senderAccount.balance).toBe(INITIAL_BALANCE - 500000000n - executed!.fee);
    });

    it('sender nonce increments after successful transfer', () => {
      expect(accountService.getNonce(SENDER)).toBe(0);

      const { tx } = txService.submit({
        sender: SENDER,
        recipient: RECIPIENT,
        nonce: 0,
        type: TxType.Transfer,
        amount: '100000000',
        gasLimit: 21000,
        gasPrice: 1,
        signature: 'sig',
      });

      txService.executeTransaction(tx!.txHash, 1);
      expect(accountService.getNonce(SENDER)).toBe(1);
    });
  });

  describe('Insufficient Balance', () => {
    it('rejects transfer when sender has insufficient balance', () => {
      const result = txService.submit({
        sender: SENDER,
        recipient: RECIPIENT,
        nonce: 0,
        type: TxType.Transfer,
        amount: '2000000000', // 2 PUMP, but sender only has 1
        gasLimit: 21000,
        gasPrice: 1,
        signature: 'sig',
      });

      expect(result.tx).toBeNull();
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some((e) => e.includes('Insufficient balance'))).toBe(true);
    });

    it('rejects when balance is sufficient for amount but not amount+fee', () => {
      // Sender has exactly 1 PUMP
      const result = txService.submit({
        sender: SENDER,
        recipient: RECIPIENT,
        nonce: 0,
        type: TxType.Transfer,
        amount: INITIAL_BALANCE.toString(), // Exactly all the balance
        gasLimit: 21000,
        gasPrice: 1,
        signature: 'sig',
      });

      // Should fail because amount + (gasLimit * gasPrice) > balance
      expect(result.tx).toBeNull();
      expect(result.errors.some((e) => e.includes('Insufficient balance'))).toBe(true);
    });
  });

  describe('Invalid Nonce', () => {
    it('rejects transaction with wrong nonce (too high)', () => {
      const result = txService.submit({
        sender: SENDER,
        recipient: RECIPIENT,
        nonce: 5, // Expected: 0
        type: TxType.Transfer,
        amount: '100000000',
        gasLimit: 21000,
        gasPrice: 1,
        signature: 'sig',
      });

      expect(result.tx).toBeNull();
      expect(result.errors.some((e) => e.includes('Invalid nonce'))).toBe(true);
    });

    it('rejects transaction with wrong nonce (too low after increment)', () => {
      // First transaction succeeds
      const { tx } = txService.submit({
        sender: SENDER,
        recipient: RECIPIENT,
        nonce: 0,
        type: TxType.Transfer,
        amount: '100000000',
        gasLimit: 21000,
        gasPrice: 1,
        signature: 'sig',
      });
      txService.executeTransaction(tx!.txHash, 1);

      // Second with nonce 0 should fail (expected 1)
      const result = txService.submit({
        sender: SENDER,
        recipient: RECIPIENT,
        nonce: 0, // Should be 1
        type: TxType.Transfer,
        amount: '100000000',
        gasLimit: 21000,
        gasPrice: 1,
        signature: 'sig',
      });

      expect(result.tx).toBeNull();
      expect(result.errors.some((e) => e.includes('Invalid nonce'))).toBe(true);
    });
  });

  describe('Duplicate Transaction', () => {
    it('rejects duplicate transaction with same hash', () => {
      const input = {
        sender: SENDER,
        recipient: RECIPIENT,
        nonce: 0,
        type: TxType.Transfer as TxType,
        amount: '100000000',
        gasLimit: 21000,
        gasPrice: 1,
        signature: 'sig',
      };

      const first = txService.submit(input);
      expect(first.tx).not.toBeNull();

      // The second submit with nonce 0 will fail due to nonce (already reserved as 1)
      // This effectively prevents duplicates by nonce management
      const second = txService.submit(input);
      expect(second.tx).toBeNull();
      expect(second.errors.length).toBeGreaterThan(0);
    });
  });

  describe('Invalid Amount', () => {
    it('rejects negative amount', () => {
      const result = txService.submit({
        sender: SENDER,
        recipient: RECIPIENT,
        nonce: 0,
        type: TxType.Transfer,
        amount: '-100',
        gasLimit: 21000,
        gasPrice: 1,
        signature: 'sig',
      });

      expect(result.tx).toBeNull();
      expect(result.errors.some((e) => e.includes('Invalid amount'))).toBe(true);
    });

    it('rejects non-numeric amount', () => {
      const result = txService.submit({
        sender: SENDER,
        recipient: RECIPIENT,
        nonce: 0,
        type: TxType.Transfer,
        amount: 'not_a_number',
        gasLimit: 21000,
        gasPrice: 1,
        signature: 'sig',
      });

      expect(result.tx).toBeNull();
      expect(result.errors.some((e) => e.includes('Invalid amount'))).toBe(true);
    });

    it('rejects zero amount for transfers', () => {
      const result = txService.submit({
        sender: SENDER,
        recipient: RECIPIENT,
        nonce: 0,
        type: TxType.Transfer,
        amount: '0',
        gasLimit: 21000,
        gasPrice: 1,
        signature: 'sig',
      });

      expect(result.tx).toBeNull();
      expect(result.errors.some((e) => e.includes('greater than zero'))).toBe(true);
    });
  });

  describe('Gas Calculation', () => {
    it('fee equals gasUsed * gasPrice', () => {
      const { tx } = txService.submit({
        sender: SENDER,
        recipient: RECIPIENT,
        nonce: 0,
        type: TxType.Transfer,
        amount: '100000000',
        gasLimit: 21000,
        gasPrice: 2,
        signature: 'sig',
      });

      const executed = txService.executeTransaction(tx!.txHash, 1);
      expect(executed).not.toBeNull();
      expect(executed!.fee).toBe(BigInt(executed!.gasUsed) * 2n);
    });

    it('gas estimation returns correct values', () => {
      const estimation = txService.estimateGas({ type: TxType.Transfer });
      expect(estimation.gasLimit).toBeGreaterThan(0);
      expect(estimation.gasPrice).toBeGreaterThan(0);
      expect(BigInt(estimation.estimatedFee)).toBe(
        BigInt(estimation.gasLimit) * BigInt(estimation.gasPrice),
      );
    });

    it('gas includes input data cost', () => {
      const baseEstimation = txService.estimateGas({ type: TxType.Transfer });
      const dataEstimation = txService.estimateGas({
        type: TxType.Transfer,
        inputData: 'hello world extra data for the transaction',
      });

      expect(dataEstimation.gasLimit).toBeGreaterThan(baseEstimation.gasLimit);
    });

    it('uses integer arithmetic for fees (no floating point)', () => {
      const { tx } = txService.submit({
        sender: SENDER,
        recipient: RECIPIENT,
        nonce: 0,
        type: TxType.Transfer,
        amount: '333333333', // Odd number that could cause float issues
        gasLimit: 21000,
        gasPrice: 3,
        signature: 'sig',
      });

      const executed = txService.executeTransaction(tx!.txHash, 1);
      // Fee must be exactly gasUsed * gasPrice with no rounding
      const expectedFee = BigInt(executed!.gasUsed) * 3n;
      expect(executed!.fee).toBe(expectedFee);
      // Verify it's an integer (bigint is always integer)
      expect(typeof executed!.fee).toBe('bigint');
    });
  });

  describe('Transaction Receipt Generation', () => {
    it('generates receipt with all required fields', () => {
      const { tx } = txService.submit({
        sender: SENDER,
        recipient: RECIPIENT,
        nonce: 0,
        type: TxType.Transfer,
        amount: '200000000',
        gasLimit: 21000,
        gasPrice: 1,
        signature: 'sig',
      });

      txService.executeTransaction(tx!.txHash, 5);

      const receipt = txService.getReceipt(tx!.txHash);
      expect(receipt).not.toBeNull();
      expect(receipt!.txHash).toBe(tx!.txHash);
      expect(receipt!.status).toBe(TxStatus.Confirmed);
      expect(receipt!.blockNumber).toBe(5);
      expect(receipt!.gasUsed).toBeGreaterThan(0);
      expect(BigInt(receipt!.fee)).toBeGreaterThan(0n);
      expect(receipt!.sender).toBe(SENDER);
      expect(receipt!.recipient).toBe(RECIPIENT);
      expect(receipt!.amount).toBe('200000000');
      expect(receipt!.timestamp).toBeGreaterThan(0);
    });

    it('receipt for failed transaction has FAILED status', () => {
      // Create sender with exactly enough to pass validation but execution
      // may fail if state changes between validation and execution.
      // We simulate this by using a high gas price that makes total > balance at execution.
      const POOR_SENDER = 'PoorSender11111111111111111111111111111111';
      accountService.credit(POOR_SENDER, 100000n); // 100k lamports

      const { tx } = txService.submit({
        sender: POOR_SENDER,
        recipient: RECIPIENT,
        nonce: 0,
        type: TxType.Transfer,
        amount: '50000', // 50k
        gasLimit: 5000,
        gasPrice: 20, // fee = 5000 * 20 = 100k; total = 150k > 100k balance
        signature: 'sig',
      });

      // Should be rejected at validation (balance check catches amount + maxFee)
      // so let's give just barely enough to pass validation:
      // We need: amount + gasLimit * gasPrice <= balance at validation
      // Let's do: balance = 200k, amount = 150k, gas = 5000 * 20 = 100k
      // total = 250k > 200k → still rejected
      // Instead, test execution failure by draining balance between submit and execute

      // Reset: use a sender that passes validation, then drain before execution
      const DRAIN_SENDER = 'DrainSender1111111111111111111111111111111';
      accountService.credit(DRAIN_SENDER, 500000n);

      const result = txService.submit({
        sender: DRAIN_SENDER,
        recipient: RECIPIENT,
        nonce: 0,
        type: TxType.Transfer,
        amount: '400000',
        gasLimit: 5000,
        gasPrice: 1,
        signature: 'sig',
      });

      expect(result.tx).not.toBeNull();

      // Drain the sender's balance before execution (simulates concurrent state change)
      accountService.debit(DRAIN_SENDER, 500000n);

      txService.executeTransaction(result.tx!.txHash, 2);

      const receipt = txService.getReceipt(result.tx!.txHash);
      expect(receipt).not.toBeNull();
      expect(receipt!.status).toBe(TxStatus.Failed);
    });
  });

  describe('Deterministic Transaction Hash', () => {
    it('same inputs produce same hash', () => {
      const timestamp = 1700000000000;
      const hash1 = hashTransaction({
        from: SENDER,
        to: RECIPIENT,
        amount: '100000000',
        nonce: 0,
        timestamp,
        data: undefined,
      });
      const hash2 = hashTransaction({
        from: SENDER,
        to: RECIPIENT,
        amount: '100000000',
        nonce: 0,
        timestamp,
        data: undefined,
      });
      expect(hash1).toBe(hash2);
    });

    it('different amount produces different hash', () => {
      const timestamp = 1700000000000;
      const hash1 = hashTransaction({
        from: SENDER,
        to: RECIPIENT,
        amount: '100000000',
        nonce: 0,
        timestamp,
      });
      const hash2 = hashTransaction({
        from: SENDER,
        to: RECIPIENT,
        amount: '200000000',
        nonce: 0,
        timestamp,
      });
      expect(hash1).not.toBe(hash2);
    });

    it('different nonce produces different hash', () => {
      const timestamp = 1700000000000;
      const hash1 = hashTransaction({
        from: SENDER,
        to: RECIPIENT,
        amount: '100000000',
        nonce: 0,
        timestamp,
      });
      const hash2 = hashTransaction({
        from: SENDER,
        to: RECIPIENT,
        amount: '100000000',
        nonce: 1,
        timestamp,
      });
      expect(hash1).not.toBe(hash2);
    });

    it('different sender produces different hash', () => {
      const timestamp = 1700000000000;
      const hash1 = hashTransaction({
        from: SENDER,
        to: RECIPIENT,
        amount: '100000000',
        nonce: 0,
        timestamp,
      });
      const hash2 = hashTransaction({
        from: RECIPIENT,
        to: SENDER,
        amount: '100000000',
        nonce: 0,
        timestamp,
      });
      expect(hash1).not.toBe(hash2);
    });

    it('hash is 64 hex characters (SHA-256)', () => {
      const hash = hashTransaction({
        from: SENDER,
        to: RECIPIENT,
        amount: '100000000',
        nonce: 0,
        timestamp: Date.now(),
      });
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  describe('Transaction Status Tracking', () => {
    it('returns PENDING for submitted but unexecuted transaction', () => {
      const { tx } = txService.submit({
        sender: SENDER,
        recipient: RECIPIENT,
        nonce: 0,
        type: TxType.Transfer,
        amount: '100000000',
        gasLimit: 21000,
        gasPrice: 1,
        signature: 'sig',
      });

      const status = txService.getStatus(tx!.txHash);
      expect(status).not.toBeNull();
      expect(status!.status).toBe(TxStatus.Pending);
    });

    it('returns CONFIRMED after execution', () => {
      const { tx } = txService.submit({
        sender: SENDER,
        recipient: RECIPIENT,
        nonce: 0,
        type: TxType.Transfer,
        amount: '100000000',
        gasLimit: 21000,
        gasPrice: 1,
        signature: 'sig',
      });

      txService.executeTransaction(tx!.txHash, 1);

      const status = txService.getStatus(tx!.txHash);
      expect(status!.status).toBe(TxStatus.Confirmed);
    });

    it('returns null for non-existent transaction', () => {
      const status = txService.getStatus('nonexistent_hash_123456');
      expect(status).toBeNull();
    });
  });
});

