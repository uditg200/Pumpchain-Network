import { Router } from 'express';
import type { ApiResponse } from '@pumpchain/shared';
import type { ServiceRegistry } from '../modules/index.js';
import type { PumpchainBlockData } from '../modules/blocks/block.types.js';

export const blocksRouter = Router();

/**
 * GET /api/blocks/latest
 * Returns the most recent block.
 */
blocksRouter.get('/latest', (req, res) => {
  const registry = req.app.locals['registry'] as ServiceRegistry;
  const block = registry.blockService.getLatestBlock();

  if (!block) {
    res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'No blocks found' },
    });
    return;
  }

  const response: ApiResponse<PumpchainBlockData> = {
    success: true,
    data: block,
  };
  res.json(response);
});

/**
 * GET /api/blocks
 * Returns paginated blocks (most recent first).
 */
blocksRouter.get('/', (req, res) => {
  const registry = req.app.locals['registry'] as ServiceRegistry;
  const page = parseInt(req.query['page'] as string) || 1;
  const pageSize = parseInt(req.query['pageSize'] as string) || 20;

  const { blocks, total } = registry.blockService.getBlocks(page, pageSize);

  const response: ApiResponse<PumpchainBlockData[]> = {
    success: true,
    data: blocks,
    meta: {
      page,
      pageSize,
      totalItems: total,
      totalPages: Math.ceil(total / pageSize),
    },
  };
  res.json(response);
});

/**
 * GET /api/blocks/hash/:hash
 * Returns a block by its hash.
 */
blocksRouter.get('/hash/:hash', (req, res) => {
  const registry = req.app.locals['registry'] as ServiceRegistry;
  const hash = req.params['hash']!;

  const block = registry.blockService.getBlockByHash(hash);
  if (!block) {
    res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Block not found' },
    });
    return;
  }

  const response: ApiResponse<PumpchainBlockData> = {
    success: true,
    data: block,
  };
  res.json(response);
});

/**
 * GET /api/blocks/:blockNumber
 * Returns a block by its number.
 */
blocksRouter.get('/:blockNumber', (req, res) => {
  const registry = req.app.locals['registry'] as ServiceRegistry;
  const numStr = req.params['blockNumber']!;

  if (!/^\d+$/.test(numStr)) {
    res.status(400).json({
      success: false,
      error: { code: 'BAD_REQUEST', message: 'Block number must be an integer' },
    });
    return;
  }

  const blockNumber = parseInt(numStr, 10);
  const block = registry.blockService.getBlockByNumber(blockNumber);

  if (!block) {
    res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Block not found' },
    });
    return;
  }

  const response: ApiResponse<PumpchainBlockData> = {
    success: true,
    data: block,
  };
  res.json(response);
});
