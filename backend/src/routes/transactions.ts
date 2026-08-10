import { Router } from 'express';
import type { ApiResponse } from '@pumpchain/shared';
import type { ServiceRegistry } from '../modules/index.js';
import type { TransactionReceipt, GasEstimation } from '../modules/transactions/transaction.types.js';
import { TxType } from '../modules/transactions/transaction.types.js';
import { validateBody } from '../middleware/validate.js';
import { submitTransactionSchema, estimateGasSchema } from '../middleware/schemas.js';

export const transactionsRouter = Router();

/**
 * POST /api/transactions/estimate
 * Estimates gas for a transaction.
 */
transactionsRouter.post('/estimate', validateBody(estimateGasSchema), (req, res) => {
  const registry = req.app.locals['registry'] as ServiceRegistry;

  const { type, inputData } = req.body;
  const txType = (type as TxType) ?? TxType.Transfer;

  const estimation = registry.transactionService.estimateGas({ type: txType, inputData });

  const response: ApiResponse<GasEstimation> = {
    success: true,
    data: estimation,
  };
  res.json(response);
});

/**
 * POST /api/transactions/submit
 * Submits a new transaction to the pool.
 */
transactionsRouter.post('/submit', validateBody(submitTransactionSchema), (req, res) => {
  const registry = req.app.locals['registry'] as ServiceRegistry;

  const { sender, recipient, nonce, type, amount, gasLimit, gasPrice, inputData, signature } =
    req.body;

  const result = registry.transactionService.submit({
    sender,
    recipient,
    nonce: Number(nonce),
    type: (type as TxType) ?? TxType.Transfer,
    amount: String(amount),
    gasLimit: Number(gasLimit) || 21000,
    gasPrice: Number(gasPrice) || 1,
    inputData: inputData ?? null,
    signature: signature ?? null,
  });

  if (result.errors.length > 0) {
    res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_FAILED',
        message: 'Transaction validation failed',
        details: result.errors,
      },
    });
    return;
  }

  const tx = result.tx!;
  res.status(201).json({
    success: true,
    data: {
      txHash: tx.txHash,
      status: tx.status,
      sender: tx.sender,
      recipient: tx.recipient,
      amount: tx.amount.toString(),
      nonce: tx.nonce,
      type: tx.type,
      gasLimit: tx.gasLimit,
      gasPrice: tx.gasPrice,
      timestamp: tx.timestamp,
    },
  });
});

/**
 * GET /api/transactions/:hash
 * Returns full transaction data including receipt if confirmed.
 */
transactionsRouter.get('/:hash', (req, res) => {
  const registry = req.app.locals['registry'] as ServiceRegistry;
  const hash = req.params['hash']!;

  const receipt = registry.transactionService.getReceipt(hash);
  if (!receipt) {
    res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Transaction not found' },
    });
    return;
  }

  const response: ApiResponse<TransactionReceipt> = {
    success: true,
    data: receipt,
  };
  res.json(response);
});

/**
 * GET /api/transactions/:hash/status
 * Returns just the transaction status.
 */
transactionsRouter.get('/:hash/status', (req, res) => {
  const registry = req.app.locals['registry'] as ServiceRegistry;
  const hash = req.params['hash']!;

  const status = registry.transactionService.getStatus(hash);
  if (!status) {
    res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Transaction not found' },
    });
    return;
  }

  res.json({
    success: true,
    data: status,
  });
});

/**
 * GET /api/transactions
 * Returns paginated transactions.
 */
transactionsRouter.get('/', (req, res) => {
  const registry = req.app.locals['registry'] as ServiceRegistry;
  const page = parseInt(req.query['page'] as string) || 1;
  const pageSize = parseInt(req.query['pageSize'] as string) || 20;

  const { transactions, total } = registry.transactionService.getTransactions(page, pageSize);

  res.json({
    success: true,
    data: transactions.map((tx) => ({
      txHash: tx.txHash,
      sender: tx.sender,
      recipient: tx.recipient,
      amount: tx.amount.toString(),
      status: tx.status,
      type: tx.type,
      blockNumber: tx.blockNumber,
      gasUsed: tx.gasUsed,
      fee: tx.fee.toString(),
      timestamp: tx.timestamp,
    })),
    meta: { page, pageSize, totalItems: total, totalPages: Math.ceil(total / pageSize) },
  });
});
