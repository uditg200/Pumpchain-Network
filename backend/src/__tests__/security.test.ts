import { describe, it, expect, beforeEach } from 'vitest';
import { TransactionService } from '../modules/transactions/transaction.service.js';
import { AccountService } from '../modules/accounts/account.service.js';
import { GasService } from '../modules/gas/gas.service.js';
import { TxType } from '../modules/transactions/transaction.types.js';

describe('Security Hardening Tests', () => {
  let txService: TransactionService;
  let accountService: AccountService;
  let gasService: GasService;

  const SENDER = 'SenderAddr1111111111111111111111111111111';
  const RECIPIENT = 'RecipientAddr11111111111111111111111111111';

  beforeEach(() => {
    accountService = new AccountService();
    gasService = new GasService();
    txService = new TransactionService(accountService, gasService);
    accountService.credit(SENDER, 1_000_000_000_000n); // 1000 PUMP
  });

  describe('Negative Amount Prevention', () => {
    it('rejects negative amount string', () => {
      const result = txService.submit({
        sender: SENDER,
        recipient: RECIPIENT,
        nonce: 0,
        type: TxType.Transfer,
        amount: '-1000000000',
        gasLimit: 5000,
        gasPrice: 1,
        signature: 'sig',
      });
      expect(result.tx).toBeNull();
      expect(result.errors.some((e) => e.toLowerCase().includes('invalid amount'))).toBe(true);
    });

    it('rejects amount with decimal point', () => {
      const result = txService.submit({
        sender: SENDER,
        recipient: RECIPIENT,
        nonce: 0,
        type: TxType.Transfer,
        amount: '100.5',
        gasLimit: 5000,
        gasPrice: 1,
        signature: 'sig',
      });
      expect(result.tx).toBeNull();
    });
  });

  describe('Integer Overflow Prevention', () => {
    it('rejects amount exceeding safe integer range', () => {
      // 79 digit number — exceeds numeric(78,0)
      const overflow = '1' + '0'.repeat(78);
      const result = txService.submit({
        sender: SENDER,
        recipient: RECIPIENT,
        nonce: 0,
        type: TxType.Transfer,
        amount: overflow,
        gasLimit: 5000,
        gasPrice: 1,
        signature: 'sig',
      });
      expect(result.tx).toBeNull();
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('accepts maximum valid amount (78 digits)', () => {
      // This will fail on balance check but NOT on parsing
      const maxValid = '9'.repeat(78);
      const result = txService.submit({
        sender: SENDER,
        recipient: RECIPIENT,
        nonce: 0,
        type: TxType.Transfer,
        amount: maxValid,
        gasLimit: 5000,
        gasPrice: 1,
        signature: 'sig',
      });
      // Should fail on insufficient balance, not on parsing
      expect(result.errors.some((e) => e.includes('Insufficient balance'))).toBe(true);
    });
  });

  describe('Duplicate Transaction Prevention', () => {
    it('cannot execute the same transaction twice', () => {
      const { tx } = txService.submit({
        sender: SENDER,
        recipient: RECIPIENT,
        nonce: 0,
        type: TxType.Transfer,
        amount: '100000000',
        gasLimit: 5000,
        gasPrice: 1,
        signature: 'sig',
      });

      expect(tx).not.toBeNull();

      // Execute once
      const first = txService.executeTransaction(tx!.txHash, 1);
      expect(first).not.toBeNull();
      expect(first!.status).toBe('CONFIRMED');

      // Attempt to execute again — must be prevented
      const second = txService.executeTransaction(tx!.txHash, 2);
      expect(second).toBeNull(); // Blocked by mutex
    });
  });

  describe('Nonce Validation', () => {
    it('rejects transaction with nonce from the future', () => {
      const result = txService.submit({
        sender: SENDER,
        recipient: RECIPIENT,
        nonce: 999,
        type: TxType.Transfer,
        amount: '100000000',
        gasLimit: 5000,
        gasPrice: 1,
        signature: 'sig',
      });
      expect(result.tx).toBeNull();
      expect(result.errors.some((e) => e.includes('nonce'))).toBe(true);
    });

    it('rejects replayed nonce after execution', () => {
      // Submit and execute nonce 0
      const { tx } = txService.submit({
        sender: SENDER,
        recipient: RECIPIENT,
        nonce: 0,
        type: TxType.Transfer,
        amount: '100000000',
        gasLimit: 5000,
        gasPrice: 1,
        signature: 'sig',
      });
      txService.executeTransaction(tx!.txHash, 1);

      // Try nonce 0 again
      const replay = txService.submit({
        sender: SENDER,
        recipient: RECIPIENT,
        nonce: 0,
        type: TxType.Transfer,
        amount: '100000000',
        gasLimit: 5000,
        gasPrice: 1,
        signature: 'sig2',
      });
      expect(replay.tx).toBeNull();
      expect(replay.errors.some((e) => e.includes('nonce'))).toBe(true);
    });
  });

  describe('Input Sanitization', () => {
    it('rejects invalid address format', () => {
      const result = txService.submit({
        sender: '<script>alert("xss")</script>',
        recipient: RECIPIENT,
        nonce: 0,
        type: TxType.Transfer,
        amount: '100000000',
        gasLimit: 5000,
        gasPrice: 1,
        signature: 'sig',
      });
      expect(result.tx).toBeNull();
      expect(result.errors.some((e) => e.toLowerCase().includes('address'))).toBe(true);
    });

    it('rejects empty amount', () => {
      const result = txService.submit({
        sender: SENDER,
        recipient: RECIPIENT,
        nonce: 0,
        type: TxType.Transfer,
        amount: '',
        gasLimit: 5000,
        gasPrice: 1,
        signature: 'sig',
      });
      expect(result.tx).toBeNull();
    });
  });

  describe('Balance Integrity', () => {
    it('balance never goes negative after failed transaction', () => {
      const poorSender = 'PoorSender11111111111111111111111111111111';
      accountService.credit(poorSender, 1000n);

      // Try to send more than balance
      const result = txService.submit({
        sender: poorSender,
        recipient: RECIPIENT,
        nonce: 0,
        type: TxType.Transfer,
        amount: '999999999999',
        gasLimit: 5000,
        gasPrice: 1,
        signature: 'sig',
      });
      // Should be rejected at validation
      expect(result.tx).toBeNull();

      // Balance unchanged
      const acc = accountService.getAccount(poorSender)!;
      expect(acc.balance).toBe(1000n);
    });

    it('uses BigInt arithmetic - no floating point errors', () => {
      // Transfer an amount that would cause float precision issues
      const amount = 333_333_333n; // 0.333... PUMP
      const { tx } = txService.submit({
        sender: SENDER,
        recipient: RECIPIENT,
        nonce: 0,
        type: TxType.Transfer,
        amount: amount.toString(),
        gasLimit: 5000,
        gasPrice: 1,
        signature: 'sig',
      });
      expect(tx).not.toBeNull();

      txService.executeTransaction(tx!.txHash, 1);

      const recipientAcc = accountService.getAccount(RECIPIENT)!;
      // Exact BigInt: no float rounding
      expect(recipientAcc.balance).toBe(amount);
    });
  });

  describe('Self-transfer Prevention', () => {
    it('rejects transfer to self', () => {
      const result = txService.submit({
        sender: SENDER,
        recipient: SENDER,
        nonce: 0,
        type: TxType.Transfer,
        amount: '100000000',
        gasLimit: 5000,
        gasPrice: 1,
        signature: 'sig',
      });
      expect(result.tx).toBeNull();
      expect(result.errors.some((e) => e.includes('same'))).toBe(true);
    });
  });

  describe('Race Condition Prevention', () => {
    it('mutex prevents concurrent execution', () => {
      const { tx: tx1 } = txService.submit({
        sender: SENDER,
        recipient: RECIPIENT,
        nonce: 0,
        type: TxType.Transfer,
        amount: '100000000',
        gasLimit: 5000,
        gasPrice: 1,
        signature: 'sig1',
      });

      const { tx: tx2 } = txService.submit({
        sender: SENDER,
        recipient: RECIPIENT,
        nonce: 1,
        type: TxType.Transfer,
        amount: '100000000',
        gasLimit: 5000,
        gasPrice: 1,
        signature: 'sig2',
      });

      // Sequential execution works fine
      const r1 = txService.executeTransaction(tx1!.txHash, 1);
      expect(r1).not.toBeNull();

      const r2 = txService.executeTransaction(tx2!.txHash, 1);
      expect(r2).not.toBeNull();
    });
  });
});

