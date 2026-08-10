import { sql } from 'drizzle-orm';
import { db } from './index.js';

export interface DatabaseHealthStatus {
  connected: boolean;
  latencyMs: number;
  error?: string;
}

/**
 * Checks database connectivity and measures latency.
 */
export async function checkDatabaseHealth(): Promise<DatabaseHealthStatus> {
  const start = Date.now();
  try {
    // Simple query to verify connectivity
    await db.execute(sql`SELECT 1`);
    const latencyMs = Date.now() - start;
    return { connected: true, latencyMs };
  } catch (err) {
    const latencyMs = Date.now() - start;
    const message = err instanceof Error ? err.message : 'Unknown database error';
    return { connected: false, latencyMs, error: message };
  }
}
