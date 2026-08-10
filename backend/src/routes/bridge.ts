import { Router } from 'express';
import type { ServiceRegistry } from '../modules/index.js';
import { BridgeAsset } from '../modules/bridge/bridge.types.js';

export const bridgeRouter = Router();

/**
 * POST /api/bridge/deposit
 */
bridgeRouter.post('/deposit', async (req, res) => {
  const registry = req.app.locals['registry'] as ServiceRegistry;
  const { walletAddress, asset, amount, solanaSignature } = req.body;

  if (!walletAddress || !amount || !solanaSignature) {
    res.status(400).json({
      success: false,
      error: { code: 'BAD_REQUEST', message: 'walletAddress, amount, and solanaSignature are required' },
    });
    return;
  }

  try {
    const result = await registry.bridgeService.deposit({
      walletAddress,
      asset: (asset as BridgeAsset) ?? BridgeAsset.PUMP,
      amount: String(amount),
      solanaSignature,
    });
    res.status(201).json({ success: true, data: result });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Bridge deposit failed';
    res.status(500).json({ success: false, error: { code: 'BRIDGE_ERROR', message } });
  }
});

/**
 * POST /api/bridge/withdraw
 */
bridgeRouter.post('/withdraw', async (req, res) => {
  const registry = req.app.locals['registry'] as ServiceRegistry;
  const { walletAddress, asset, amount } = req.body;

  if (!walletAddress || !amount) {
    res.status(400).json({
      success: false,
      error: { code: 'BAD_REQUEST', message: 'walletAddress and amount are required' },
    });
    return;
  }

  try {
    const result = await registry.bridgeService.withdraw({
      walletAddress,
      asset: (asset as BridgeAsset) ?? BridgeAsset.PUMP,
      amount: String(amount),
    });

    if (result.status === 'FAILED') {
      res.status(400).json({
        success: false,
        error: { code: 'BRIDGE_FAILED', message: result.errorMessage ?? 'Withdrawal failed' },
        data: result,
      });
      return;
    }

    res.status(201).json({ success: true, data: result });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Bridge withdrawal failed';
    res.status(500).json({ success: false, error: { code: 'BRIDGE_ERROR', message } });
  }
});

/**
 * GET /api/bridge/stats
 * Must be BEFORE /:id to avoid conflict.
 */
bridgeRouter.get('/stats', async (req, res) => {
  const registry = req.app.locals['registry'] as ServiceRegistry;

  try {
    const stats = await registry.bridgeService.getDashboardStats();
    res.json({ success: true, data: stats });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to get stats';
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message } });
  }
});

/**
 * GET /api/bridge/history/:walletAddress
 * Must be BEFORE /:id to avoid conflict.
 */
bridgeRouter.get('/history/:walletAddress', async (req, res) => {
  const registry = req.app.locals['registry'] as ServiceRegistry;
  const walletAddress = req.params['walletAddress']!;
  const page = parseInt(req.query['page'] as string) || 1;
  const pageSize = parseInt(req.query['pageSize'] as string) || 20;

  try {
    const { operations, total } = await registry.bridgeService.getHistory(walletAddress, page, pageSize);
    res.json({
      success: true,
      data: operations,
      meta: { page, pageSize, totalItems: total, totalPages: Math.ceil(total / pageSize) },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to get history';
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message } });
  }
});

/**
 * GET /api/bridge/:id
 */
bridgeRouter.get('/:id', async (req, res) => {
  const registry = req.app.locals['registry'] as ServiceRegistry;
  const id = req.params['id']!;

  try {
    const operation = await registry.bridgeService.getOperation(id);
    if (!operation) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Bridge operation not found' },
      });
      return;
    }
    res.json({ success: true, data: operation });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to get operation';
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message } });
  }
});
