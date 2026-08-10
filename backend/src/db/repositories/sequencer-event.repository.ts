import { desc, eq, sql } from 'drizzle-orm';
import type { Database } from '../index.js';
import { sequencerEvents } from '../schema.js';

export interface InsertSequencerEvent {
  eventType: string;
  blockNumber?: number | null;
  eventData?: unknown;
}

export class SequencerEventRepository {
  constructor(private readonly db: Database) {}

  async insert(event: InsertSequencerEvent) {
    const [result] = await this.db.insert(sequencerEvents).values(event).returning();
    return result;
  }

  async findByType(eventType: string, limit: number = 50) {
    return this.db
      .select()
      .from(sequencerEvents)
      .where(eq(sequencerEvents.eventType, eventType))
      .orderBy(desc(sequencerEvents.createdAt))
      .limit(limit);
  }

  async findRecent(limit: number = 50) {
    return this.db
      .select()
      .from(sequencerEvents)
      .orderBy(desc(sequencerEvents.createdAt))
      .limit(limit);
  }
}
