import { Router } from 'express';
import type { ApiResponse } from '@pumpchain/shared';
import type { ServiceRegistry } from '../modules/index.js';
import type { NetworkInfo, NetworkStatusSummary } from '../modules/network/network.types.js';
import type { SequencerStatus, SequencerMetrics } from '../modules/sequencer/sequencer.types.js';

export const networkRouter = Router();

networkRouter.get('/info', (req, res) => {
  const registry = req.app.locals['registry'] as ServiceRegistry;
  const info = registry.networkService.getNetworkInfo();

  const response: ApiResponse<NetworkInfo> = {
    success: true,
    data: info,
  };
  res.json(response);
});

networkRouter.get('/stats', (req, res) => {
  const registry = req.app.locals['registry'] as ServiceRegistry;
  const summary = registry.networkService.getNetworkStatusSummary();

  const response: ApiResponse<NetworkStatusSummary> = {
    success: true,
    data: summary,
  };
  res.json(response);
});

networkRouter.get('/sequencer', (req, res) => {
  const registry = req.app.locals['registry'] as ServiceRegistry;
  const status = registry.sequencerService.getStatus();

  const response: ApiResponse<SequencerStatus> = {
    success: true,
    data: status,
  };
  res.json(response);
});

networkRouter.get('/metrics', (req, res) => {
  const registry = req.app.locals['registry'] as ServiceRegistry;
  const metrics = registry.sequencerService.getMetrics();

  const response: ApiResponse<SequencerMetrics> = {
    success: true,
    data: metrics,
  };
  res.json(response);
});
