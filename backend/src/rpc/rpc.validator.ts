import type { JsonRpcRequest } from './rpc.types.js';
import { RPC_ERRORS } from './rpc.types.js';

/**
 * Validates a JSON-RPC 2.0 request structure.
 * Returns null if valid, or an error object if invalid.
 */
export function validateRpcRequest(body: unknown): { error: { code: number; message: string } } | null {
  if (!body || typeof body !== 'object') {
    return { error: RPC_ERRORS.PARSE_ERROR };
  }

  const req = body as Record<string, unknown>;

  // Must have jsonrpc: "2.0"
  if (req['jsonrpc'] !== '2.0') {
    return { error: RPC_ERRORS.INVALID_REQUEST };
  }

  // Must have method as string
  if (!req['method'] || typeof req['method'] !== 'string') {
    return { error: RPC_ERRORS.INVALID_REQUEST };
  }

  // id must be string, number, or null
  if (req['id'] !== undefined && req['id'] !== null && typeof req['id'] !== 'string' && typeof req['id'] !== 'number') {
    return { error: RPC_ERRORS.INVALID_REQUEST };
  }

  // params must be array if present
  if (req['params'] !== undefined && !Array.isArray(req['params'])) {
    return { error: RPC_ERRORS.INVALID_PARAMS };
  }

  return null; // Valid
}

/**
 * Sanitizes RPC request for logging.
 * Removes signature and any potential secrets from the log.
 */
export function sanitizeForLog(req: JsonRpcRequest): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {
    method: req.method,
    id: req.id,
  };

  if (req.params && req.params.length > 0) {
    sanitized['params'] = req.params.map((p) => {
      if (typeof p === 'object' && p !== null) {
        const obj = { ...p } as Record<string, unknown>;
        // Never log signatures or keys
        if ('signature' in obj) obj['signature'] = '[REDACTED]';
        if ('privateKey' in obj) obj['privateKey'] = '[REDACTED]';
        if ('secret' in obj) obj['secret'] = '[REDACTED]';
        return obj;
      }
      return p;
    });
  }

  return sanitized;
}
