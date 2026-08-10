import { Router } from 'express';
import type { ServiceRegistry } from '../modules/index.js';
import type { SortOrder } from '../modules/explorer/explorer.service.js';

export const explorerRouter = Router();

/**
 * GET /api/explorer/overview
 * Returns comprehensive network overview for the explorer dashboard.
 */
explorerRouter.get('/overview', async (req, res) => {
  const registry = req.app.locals['registry'] as ServiceRegistry;

  try {
    const overview = await registry.explorerService.getOverview();
    res.json({ success: true, data: overview });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to get overview';
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message } });
  }
});

/**
 * GET /api/explorer/blocks
 * Returns paginated blocks with sorting.
 * Query: page, pageSize, sort (latest|oldest|highestGas|lowestGas)
 */
explorerRouter.get('/blocks', async (req, res) => {
  const registry = req.app.locals['registry'] as ServiceRegistry;
  const page = Math.max(1, parseInt(req.query['page'] as string) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(req.query['pageSize'] as string) || 20));
  const sort = (req.query['sort'] as SortOrder) || 'latest';

  try {
    const result = await registry.explorerService.getBlocks({ page, pageSize, sort });
    res.json({
      success: true,
      data: result.items,
      meta: {
        page: result.page,
        pageSize: result.pageSize,
        totalItems: result.total,
        totalPages: result.totalPages,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to get blocks';
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message } });
  }
});

/**
 * GET /api/explorer/blocks/:blockNumber
 * Returns a single block by number.
 */
explorerRouter.get('/blocks/:blockNumber', async (req, res) => {
  const registry = req.app.locals['registry'] as ServiceRegistry;
  const numStr = req.params['blockNumber']!;

  if (!/^\d+$/.test(numStr)) {
    res.status(400).json({
      success: false,
      error: { code: 'BAD_REQUEST', message: 'Block number must be an integer' },
    });
    return;
  }

  try {
    const block = await registry.explorerService.getBlockByNumber(parseInt(numStr, 10));
    if (!block) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Block not found' },
      });
      return;
    }
    res.json({ success: true, data: block });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to get block';
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message } });
  }
});

/**
 * GET /api/explorer/transactions
 * Returns paginated transactions with sorting.
 * Query: page, pageSize, sort (latest|oldest|highestGas|lowestGas)
 */
explorerRouter.get('/transactions', async (req, res) => {
  const registry = req.app.locals['registry'] as ServiceRegistry;
  const page = Math.max(1, parseInt(req.query['page'] as string) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(req.query['pageSize'] as string) || 20));
  const sort = (req.query['sort'] as SortOrder) || 'latest';

  try {
    const result = await registry.explorerService.getTransactions({ page, pageSize, sort });
    res.json({
      success: true,
      data: result.items,
      meta: {
        page: result.page,
        pageSize: result.pageSize,
        totalItems: result.total,
        totalPages: result.totalPages,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to get transactions';
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message } });
  }
});

/**
 * GET /api/explorer/transactions/:hash
 * Returns a single transaction by hash.
 */
explorerRouter.get('/transactions/:hash', async (req, res) => {
  const registry = req.app.locals['registry'] as ServiceRegistry;
  const hash = req.params['hash']!;

  try {
    const tx = await registry.explorerService.getTransactionByHash(hash);
    if (!tx) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Transaction not found' },
      });
      return;
    }
    res.json({ success: true, data: tx });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to get transaction';
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message } });
  }
});

/**
 * GET /api/explorer/accounts/:address
 * Returns account details by address.
 */
explorerRouter.get('/accounts/:address', async (req, res) => {
  const registry = req.app.locals['registry'] as ServiceRegistry;
  const address = req.params['address']!;

  try {
    const account = await registry.explorerService.getAccount(address);
    if (!account) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Account not found' },
      });
      return;
    }
    res.json({ success: true, data: account });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to get account';
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message } });
  }
});

/**
 * GET /api/explorer/tokens/:symbol
 * Returns token holders for a given symbol.
 * Query: page, pageSize
 */
explorerRouter.get('/tokens/:symbol', async (req, res) => {
  const registry = req.app.locals['registry'] as ServiceRegistry;
  const symbol = req.params['symbol']!.toUpperCase();
  const page = Math.max(1, parseInt(req.query['page'] as string) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(req.query['pageSize'] as string) || 20));

  try {
    const result = await registry.explorerService.getTokenHolders(symbol, page, pageSize);
    res.json({
      success: true,
      data: result.items,
      meta: {
        page: result.page,
        pageSize: result.pageSize,
        totalItems: result.total,
        totalPages: result.totalPages,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to get token data';
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message } });
  }
});

/**
 * GET /api/explorer/search?q=
 * Universal search: block number, tx hash, wallet address, or token symbol.
 */
explorerRouter.get('/search', async (req, res) => {
  const registry = req.app.locals['registry'] as ServiceRegistry;
  const query = (req.query['q'] as string) ?? '';

  if (!query.trim()) {
    res.status(400).json({
      success: false,
      error: { code: 'BAD_REQUEST', message: 'Search query (q) is required' },
    });
    return;
  }

  try {
    const result = await registry.explorerService.search(query);
    res.json({ success: true, data: result });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Search failed';
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message } });
  }
});

/**
 * GET /api/explorer/stats
 * Returns aggregate network statistics.
 */
explorerRouter.get('/stats', async (req, res) => {
  const registry = req.app.locals['registry'] as ServiceRegistry;

  try {
    const stats = await registry.explorerService.getStats();
    res.json({ success: true, data: stats });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to get stats';
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message } });
  }
});
