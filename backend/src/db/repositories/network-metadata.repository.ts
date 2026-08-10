import { eq, sql } from 'drizzle-orm';
import type { Database } from '../index.js';
import { networkMetadata } from '../schema.js';

export interface InsertNetworkMetadata {
  networkName: string;
  chainId: string;
  environment: string;
  nativeTokenSymbol: string;
  genesisHash: string;
  currentBlockHeight?: number;
}

export class NetworkMetadataRepository {
  constructor(private readonly db: Database) {}

  async upsert(data: InsertNetworkMetadata) {
    const [result] = await this.db
      .insert(networkMetadata)
      .values(data)
      .onConflictDoUpdate({
        target: networkMetadata.chainId,
        set: {
          networkName: data.networkName,
          environment: data.environment,
          nativeTokenSymbol: data.nativeTokenSymbol,
          genesisHash: data.genesisHash,
          updatedAt: new Date(),
        },
      })
      .returning();
    return result;
  }

  async findByChainId(chainId: string) {
    const [result] = await this.db
      .select()
      .from(networkMetadata)
      .where(eq(networkMetadata.chainId, chainId))
      .limit(1);
    return result ?? null;
  }

  async updateBlockHeight(chainId: string, blockHeight: number) {
    await this.db
      .update(networkMetadata)
      .set({
        currentBlockHeight: blockHeight,
        updatedAt: new Date(),
      })
      .where(eq(networkMetadata.chainId, chainId));
  }
}
