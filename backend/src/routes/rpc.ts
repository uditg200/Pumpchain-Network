import { Router } from 'express';
import type { ServiceRegistry } from '../modules/index.js';
import { RpcService } from '../rpc/rpc.service.js';
import { RpcRateLimiter } from '../rpc/rpc.rate-limiter.js';
import { validateRpcRequest, sanitizeForLog } from '../rpc/rpc.validator.js';
import { RPC_ERRORS } from '../rpc/rpc.types.js';
import type { JsonRpcRequest, JsonRpcResponse } from '../rpc/rpc.types.js';

export const rpcRouter = Router();

// Rate limiter: 100 requests per minute per IP
const rateLimiter = new RpcRateLimiter({ maxRequests: 100, windowMs: 60_000 });

// Cleanup expired rate limit entries every 5 minutes
setInterval(() => rateLimiter.cleanup(), 5 * 60_000);

/**
 * POST /api/rpc
 *
 * Pumpchain JSON-RPC 2.0 endpoint.
 * Handles request validation, rate limiting, logging, and dispatch.
 * No business logic lives here — it's all in RpcService.
 */
rpcRouter.post('/', (req, res) => {
  const startTime = Date.now();

  // Rate limiting
  const clientIp =
    (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
    req.socket.remoteAddress ||
    'unknown';

  const rateCheck = rateLimiter.check(clientIp);
  if (!rateCheck.allowed) {
    const response: JsonRpcResponse = {
      jsonrpc: '2.0',
      id: null,
      error: { ...RPC_ERRORS.RATE_LIMITED, data: { retryAfterMs: rateCheck.retryAfterMs } },
    };
    res.status(429).json(response);
    return;
  }

  // Validate structure
  const validationError = validateRpcRequest(req.body);
  if (validationError) {
    const response: JsonRpcResponse = {
      jsonrpc: '2.0',
      id: (req.body as Record<string, unknown>)?.['id'] as number | string | null ?? null,
      error: validationError.error,
    };
    res.status(400).json(response);
    return;
  }

  const rpcReq = req.body as JsonRpcRequest;
  const params = rpcReq.params ?? [];

  // Log request (sanitized — no secrets)
  console.log('[RPC]', sanitizeForLog(rpcReq));

  // Get or create RPC service from registry
  const registry = req.app.locals['registry'] as ServiceRegistry;
  const rpcService = new RpcService(
    registry.blockService,
    registry.transactionService,
    registry.accountService,
    registry.gasService,
    registry.networkService,
  );

  // Dispatch
  rpcService.dispatch(rpcReq.method, params).then((outcome) => {
    const duration = Date.now() - startTime;

    if (outcome.error) {
      const response: JsonRpcResponse = {
        jsonrpc: '2.0',
        id: rpcReq.id,
        error: outcome.error,
      };
      console.log(`[RPC] ${rpcReq.method} → error (${duration}ms)`);
      res.json(response);
    } else {
      const response: JsonRpcResponse = {
        jsonrpc: '2.0',
        id: rpcReq.id,
        result: outcome.result,
      };
      console.log(`[RPC] ${rpcReq.method} → ok (${duration}ms)`);
      res.json(response);
    }
  }).catch((err) => {
    const message = err instanceof Error ? err.message : 'Internal error';
    console.error(`[RPC] ${rpcReq.method} → internal error:`, message);
    const response: JsonRpcResponse = {
      jsonrpc: '2.0',
      id: rpcReq.id,
      error: { ...RPC_ERRORS.INTERNAL_ERROR, data: message },
    };
    res.status(500).json(response);
  });
});
