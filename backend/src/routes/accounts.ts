import { Router } from 'express';
import type { ApiResponse } from '@pumpchain/shared';
import type { ServiceRegistry } from '../modules/index.js';
import type { PumpchainAccountData } from '../modules/accounts/account.types.js';

export const accountsRouter = Router();

accountsRouter.get('/:address', (req, res) => {
  const registry = req.app.locals['registry'] as ServiceRegistry;
  const address = req.params['address']!;
  const account = registry.accountService.getAccount(address);

  if (!account) {
    res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Account not found' },
    });
    return;
  }

  res.json({
    success: true,
    data: {
      address: account.address,
      balance: account.balance.toString(),
      nonce: account.nonce,
      createdAt: account.createdAt,
      updatedAt: account.updatedAt,
    },
  });
});

accountsRouter.get('/:address/transactions', (req, res) => {
  const registry = req.app.locals['registry'] as ServiceRegistry;
  const address = req.params['address']!;
  const page = parseInt(req.query['page'] as string) || 1;
  const pageSize = parseInt(req.query['pageSize'] as string) || 20;

  const { transactions, total } = registry.transactionService.getByAddress(address, page, pageSize);

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
      timestamp: tx.timestamp,
    })),
    meta: { page, pageSize, totalItems: total, totalPages: Math.ceil(total / pageSize) },
  });
});
