/**
 * Simple in-memory rate limiter for the RPC endpoint.
 * Tracks requests per IP with a sliding window.
 */

interface RateEntry {
  count: number;
  windowStart: number;
}

export interface RateLimiterConfig {
  /** Maximum requests per window */
  maxRequests: number;
  /** Window duration in ms */
  windowMs: number;
}

const DEFAULT_CONFIG: RateLimiterConfig = {
  maxRequests: 100,
  windowMs: 60_000, // 100 requests per minute
};

export class RpcRateLimiter {
  private entries: Map<string, RateEntry> = new Map();
  private config: RateLimiterConfig;

  constructor(config?: Partial<RateLimiterConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Checks if a request from the given IP is allowed.
   * Returns { allowed: true } or { allowed: false, retryAfterMs }.
   */
  check(ip: string): { allowed: boolean; retryAfterMs?: number } {
    const now = Date.now();
    const entry = this.entries.get(ip);

    if (!entry || now - entry.windowStart >= this.config.windowMs) {
      // New window
      this.entries.set(ip, { count: 1, windowStart: now });
      return { allowed: true };
    }

    if (entry.count >= this.config.maxRequests) {
      const retryAfterMs = this.config.windowMs - (now - entry.windowStart);
      return { allowed: false, retryAfterMs };
    }

    entry.count++;
    return { allowed: true };
  }

  /**
   * Cleans up expired entries (call periodically to prevent memory growth).
   */
  cleanup(): void {
    const now = Date.now();
    for (const [ip, entry] of this.entries) {
      if (now - entry.windowStart >= this.config.windowMs) {
        this.entries.delete(ip);
      }
    }
  }
}
