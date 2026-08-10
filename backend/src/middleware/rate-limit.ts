import type { Request, Response, NextFunction } from 'express';

interface RateLimitEntry {
  count: number;
  windowStart: number;
}

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  message?: string;
}

/**
 * In-memory rate limiting middleware.
 * Per-IP tracking with configurable window and limits.
 */
export function createRateLimiter(config: RateLimitConfig) {
  const entries = new Map<string, RateLimitEntry>();

  // Periodic cleanup
  setInterval(() => {
    const now = Date.now();
    for (const [ip, entry] of entries) {
      if (now - entry.windowStart >= config.windowMs) entries.delete(ip);
    }
  }, config.windowMs);

  return (req: Request, res: Response, next: NextFunction): void => {
    const ip =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.socket.remoteAddress ||
      'unknown';

    const now = Date.now();
    const entry = entries.get(ip);

    if (!entry || now - entry.windowStart >= config.windowMs) {
      entries.set(ip, { count: 1, windowStart: now });
      next();
      return;
    }

    if (entry.count >= config.maxRequests) {
      const retryAfter = Math.ceil((config.windowMs - (now - entry.windowStart)) / 1000);
      res.setHeader('Retry-After', String(retryAfter));
      res.status(429).json({
        success: false,
        error: {
          code: 'RATE_LIMITED',
          message: config.message ?? 'Too many requests. Please try again later.',
          retryAfterSeconds: retryAfter,
        },
      });
      return;
    }

    entry.count++;
    next();
  };
}
