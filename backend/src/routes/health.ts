import { Router } from 'express';
import type { HealthCheckResponse, ApiResponse } from '@pumpchain/shared';
import type { ServiceRegistry } from '../modules/index.js';
import { checkDatabaseHealth } from '../db/health.js';

export const healthRouter = Router();

const startTime = Date.now();

healthRouter.get('/', (req, res) => {
  const registry = req.app.locals['registry'] as ServiceRegistry;

  const response: ApiResponse<HealthCheckResponse> = {
    success: true,
    data: {
      status: 'healthy',
      version: '0.1.0',
      uptime: Date.now() - startTime,
      services: {
        database: true,
        sequencer: registry.sequencerService.getStatus().isRunning,
        solanaRpc: true,
      },
    },
  };
  res.json(response);
});

/**
 * GET /api/health/database
 * Returns database connection status and latency.
 */
healthRouter.get('/database', async (_req, res) => {
  const health = await checkDatabaseHealth();

  const statusCode = health.connected ? 200 : 503;
  res.status(statusCode).json({
    success: health.connected,
    data: {
      status: health.connected ? 'connected' : 'disconnected',
      latencyMs: health.latencyMs,
      provider: 'neon-postgresql',
      error: health.error ?? null,
    },
  });
});
