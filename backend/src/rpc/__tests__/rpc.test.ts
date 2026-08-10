import { describe, it, expect, beforeEach } from 'vitest';
import { RpcService } from '../rpc.service.js';
import { RpcRateLimiter } from '../rpc.rate-limiter.js';
import { validateRpcRequest, sanitizeForLog } from '../rpc.validator.js';
import { BlockService } from '../../modules/blocks/block.service.js';
import { TransactionService } from '../../modules/transactions/transaction.service.js';
import { AccountService } from '../../modules/accounts/account.service.js';
import { GasService } from '../../modules/gas/gas.service.js';
import { NetworkService } from '../../modules/network/network.service.js';

describe('Pumpchain JSON-RPC API', () => {
  let rpc: RpcService;
  let blockService: BlockService;
  let transactionService: TransactionService;
  let accountService: AccountService;
  let gasService: GasService;
  let networkService: NetworkService;

  const SENDER = 'SenderAddr1111111111111111111111111111111';
  const RECIPIENT = 'RecipientAddr11111111111111111111111111111';

  beforeEach(() => {
    blockService = new BlockService();
    accountService = new AccountService();
    gasService = new GasService();
    transactionService = new TransactionService(accountService, gasService);
    networkService = new NetworkService(blockService, transactionService, accountService, gasService);

    // Initialize network (creates genesis block)
    networkService.initialize(1700000000000);

    // Fund sender
    accountService.credit(SENDER, 1_000_000_000n);

    rpc = new RpcService(blockService, transactionService, accountService, gasService, networkService);
  });

  describe('pumpchain_chainId', () => {
    it('returns the chain ID', async () => {
      const res = await rpc.dispatch('pumpchain_chainId', []);
      expect(res.result).toBe('pumpchain-mainnet');
      expect(res.error).toBeUndefined();
    });
  });

  describe('pumpchain_blockNumber', () => {
    it('returns current block height', async () => {
      const res = await rpc.dispatch('pumpchain_blockNumber', []);
      expect(res.result).toBe(0); // Only genesis
    });
  });

  describe('pumpchain_getBlockByNumber', () => {
    it('returns genesis block', async () => {
      const res = await rpc.dispatch('pumpchain_getBlockByNumber', [0]);
      expect(res.error).toBeUndefined();
      const block = res.result as Record<string, unknown>;
      expect(block['blockNumber']).toBe(0);
      expect(block['blockHash']).toMatch(/^[a-f0-9]{64}$/);
      expect(block['parentHash']).toBe('0'.repeat(64));
    });

    it('returns error for non-existent block', async () => {
      const res = await rpc.dispatch('pumpchain_getBlockByNumber', [999]);
      expect(res.error).toBeDefined();
      expect(res.error!.code).toBe(-32001);
    });

    it('returns error for invalid params', async () => {
      const res = await rpc.dispatch('pumpchain_getBlockByNumber', ['invalid']);
      expect(res.error).toBeDefined();
      expect(res.error!.code).toBe(-32602);
    });
  });

  describe('pumpchain_getBlockByHash', () => {
    it('returns block by hash', async () => {
      const genesis = blockService.getBlockByNumber(0)!;
      const res = await rpc.dispatch('pumpchain_getBlockByHash', [genesis.blockHash]);
      expect(res.error).toBeUndefined();
      expect((res.result as Record<string, unknown>)['blockNumber']).toBe(0);
    });

    it('returns error for unknown hash', async () => {
      const fakeHash = 'a'.repeat(64);
      const res = await rpc.dispatch('pumpchain_getBlockByHash', [fakeHash]);
      expect(res.error).toBeDefined();
      expect(res.error!.code).toBe(-32001);
    });

    it('returns error for invalid hash format', async () => {
      const res = await rpc.dispatch('pumpchain_getBlockByHash', ['not-a-hash']);
      expect(res.error).toBeDefined();
      expect(res.error!.code).toBe(-32602);
    });
  });

  describe('pumpchain_getTransactionByHash', () => {
    it('returns transaction after submission', async () => {
      const sendRes = await rpc.dispatch('pumpchain_sendTransaction', [{
        sender: SENDER,
        recipient: RECIPIENT,
        amount: '100000000',
        nonce: 0,
        gasLimit: 21000,
        gasPrice: 1,
        signature: 'test_sig',
      }]);

      const txHash = (sendRes.result as Record<string, unknown>)['txHash'] as string;
      const res = await rpc.dispatch('pumpchain_getTransactionByHash', [txHash]);
      expect(res.error).toBeUndefined();
      const tx = res.result as Record<string, unknown>;
      expect(tx['txHash']).toBe(txHash);
      expect(tx['sender']).toBe(SENDER);
      expect(tx['recipient']).toBe(RECIPIENT);
      expect(tx['amount']).toBe('100000000');
      expect(tx['status']).toBe('PENDING');
    });

    it('returns error for unknown hash', async () => {
      const res = await rpc.dispatch('pumpchain_getTransactionByHash', ['b'.repeat(64)]);
      expect(res.error).toBeDefined();
      expect(res.error!.code).toBe(-32002);
    });
  });

  describe('pumpchain_getBalance', () => {
    it('returns balance for funded account', async () => {
      const res = await rpc.dispatch('pumpchain_getBalance', [SENDER]);
      expect(res.error).toBeUndefined();
      const data = res.result as Record<string, unknown>;
      expect(data['address']).toBe(SENDER);
      expect(data['balance']).toBe('1000000000');
      expect(data['nonce']).toBe(0);
    });

    it('returns zero balance for unknown address', async () => {
      const res = await rpc.dispatch('pumpchain_getBalance', [RECIPIENT]);
      const data = res.result as Record<string, unknown>;
      expect(data['balance']).toBe('0');
    });

    it('returns error for invalid address', async () => {
      const res = await rpc.dispatch('pumpchain_getBalance', ['invalid!!']);
      expect(res.error).toBeDefined();
      expect(res.error!.code).toBe(-32602);
    });
  });

  describe('pumpchain_getTransactionCount', () => {
    it('returns 0 for fresh account', async () => {
      const res = await rpc.dispatch('pumpchain_getTransactionCount', [SENDER]);
      expect(res.result).toBe(0);
    });

    it('returns error for invalid address', async () => {
      const res = await rpc.dispatch('pumpchain_getTransactionCount', ['x']);
      expect(res.error).toBeDefined();
    });
  });

  describe('pumpchain_sendTransaction', () => {
    it('successfully submits a valid transaction', async () => {
      const res = await rpc.dispatch('pumpchain_sendTransaction', [{
        sender: SENDER,
        recipient: RECIPIENT,
        amount: '500000000',
        nonce: 0,
        gasLimit: 5000,
        gasPrice: 1,
        signature: 'valid_sig',
      }]);

      expect(res.error).toBeUndefined();
      const data = res.result as Record<string, unknown>;
      expect(data['txHash']).toMatch(/^[a-f0-9]{64}$/);
      expect(data['status']).toBe('PENDING');
      expect(data['nonce']).toBe(0);
    });

    it('rejects transaction with insufficient balance', async () => {
      const res = await rpc.dispatch('pumpchain_sendTransaction', [{
        sender: SENDER,
        recipient: RECIPIENT,
        amount: '99999999999999',
        nonce: 0,
        gasLimit: 5000,
        gasPrice: 1,
        signature: 'sig',
      }]);

      expect(res.error).toBeDefined();
      expect(res.error!.code).toBe(-32004);
    });

    it('rejects missing sender', async () => {
      const res = await rpc.dispatch('pumpchain_sendTransaction', [{
        recipient: RECIPIENT,
        amount: '100',
        nonce: 0,
        signature: 'sig',
      }]);
      expect(res.error).toBeDefined();
      expect(res.error!.code).toBe(-32602);
    });

    it('rejects missing signature', async () => {
      const res = await rpc.dispatch('pumpchain_sendTransaction', [{
        sender: SENDER,
        recipient: RECIPIENT,
        amount: '100',
        nonce: 0,
      }]);
      expect(res.error).toBeDefined();
      expect(res.error!.code).toBe(-32602);
    });
  });

  describe('pumpchain_estimateGas', () => {
    it('returns gas estimate with no params', async () => {
      const res = await rpc.dispatch('pumpchain_estimateGas', []);
      expect(res.error).toBeUndefined();
      const data = res.result as Record<string, unknown>;
      expect(typeof data['gasLimit']).toBe('number');
      expect(typeof data['gasPrice']).toBe('number');
      expect(typeof data['estimatedFee']).toBe('string');
      expect(Number(data['gasLimit'])).toBeGreaterThan(0);
    });

    it('returns higher gas with input data', async () => {
      const res1 = await rpc.dispatch('pumpchain_estimateGas', [{}]);
      const res2 = await rpc.dispatch('pumpchain_estimateGas', [{ data: 'hello world extra payload' }]);
      const gas1 = (res1.result as Record<string, unknown>)['gasLimit'] as number;
      const gas2 = (res2.result as Record<string, unknown>)['gasLimit'] as number;
      expect(gas2).toBeGreaterThan(gas1);
    });
  });

  describe('pumpchain_getNetworkInfo', () => {
    it('returns network info', async () => {
      const res = await rpc.dispatch('pumpchain_getNetworkInfo', []);
      expect(res.error).toBeUndefined();
      const data = res.result as Record<string, unknown>;
      expect(data['networkId']).toBe('pumpchain-mainnet');
      expect(data['chainName']).toBe('Pumpchain Network');
      expect(data['nativeSymbol']).toBe('PUMP');
      expect(data['environment']).toBe('testnet');
      expect(data['currentBlockHeight']).toBe(0);
      expect(data['status']).toBeDefined();
    });
  });

  describe('Unknown method', () => {
    it('returns method not found error', async () => {
      const res = await rpc.dispatch('unknown_method', []);
      expect(res.error).toBeDefined();
      expect(res.error!.code).toBe(-32601);
    });
  });

  describe('Request Validation', () => {
    it('rejects non-object body', () => {
      expect(validateRpcRequest(null)).not.toBeNull();
      expect(validateRpcRequest('string')).not.toBeNull();
    });

    it('rejects missing jsonrpc', () => {
      expect(validateRpcRequest({ method: 'test', id: 1 })).not.toBeNull();
    });

    it('rejects wrong jsonrpc version', () => {
      expect(validateRpcRequest({ jsonrpc: '1.0', method: 'test', id: 1 })).not.toBeNull();
    });

    it('rejects missing method', () => {
      expect(validateRpcRequest({ jsonrpc: '2.0', id: 1 })).not.toBeNull();
    });

    it('accepts valid request', () => {
      expect(validateRpcRequest({ jsonrpc: '2.0', method: 'test', id: 1 })).toBeNull();
    });

    it('accepts request with params array', () => {
      expect(validateRpcRequest({ jsonrpc: '2.0', method: 'test', id: 1, params: [1, 2] })).toBeNull();
    });

    it('rejects non-array params', () => {
      expect(validateRpcRequest({ jsonrpc: '2.0', method: 'test', id: 1, params: {} })).not.toBeNull();
    });
  });

  describe('Sanitize for logging', () => {
    it('redacts signature field', () => {
      const sanitized = sanitizeForLog({
        jsonrpc: '2.0',
        id: 1,
        method: 'pumpchain_sendTransaction',
        params: [{ sender: 'abc', signature: 'secret123', amount: '100' }],
      });
      const p = (sanitized['params'] as Array<Record<string, unknown>>)[0]!;
      expect(p['signature']).toBe('[REDACTED]');
      expect(p['sender']).toBe('abc');
      expect(p['amount']).toBe('100');
    });
  });

  describe('Rate Limiter', () => {
    it('allows requests under limit', () => {
      const limiter = new RpcRateLimiter({ maxRequests: 5, windowMs: 60000 });
      for (let i = 0; i < 5; i++) {
        expect(limiter.check('1.2.3.4').allowed).toBe(true);
      }
    });

    it('blocks requests over limit', () => {
      const limiter = new RpcRateLimiter({ maxRequests: 3, windowMs: 60000 });
      limiter.check('1.2.3.4');
      limiter.check('1.2.3.4');
      limiter.check('1.2.3.4');
      const result = limiter.check('1.2.3.4');
      expect(result.allowed).toBe(false);
      expect(result.retryAfterMs).toBeGreaterThan(0);
    });

    it('different IPs have separate limits', () => {
      const limiter = new RpcRateLimiter({ maxRequests: 1, windowMs: 60000 });
      expect(limiter.check('1.1.1.1').allowed).toBe(true);
      expect(limiter.check('2.2.2.2').allowed).toBe(true);
      expect(limiter.check('1.1.1.1').allowed).toBe(false);
    });
  });
});
