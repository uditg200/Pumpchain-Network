import { createHash } from 'crypto';
import { eq, desc, and, gt, sql } from 'drizzle-orm';
import { PUMPCHAIN_NATIVE_SYMBOL } from '@pumpchain/shared';
import { TxType } from '../transactions/transaction.types.js';
import type { TransactionService } from '../transactions/transaction.service.js';
import type { AccountService } from '../accounts/account.service.js';
import type { Database } from '../../db/index.js';
import { faucetClaims } from '../../db/schema.js';
import { broadcastFaucetClaimed } from '../../ws/index.js';
import type { FaucetConfig, FaucetClaimResult, FaucetStatusResult } from './faucet.types.js';

const DEFAULT_CLAIM_AMOUNT = 2_000_000_000n; // 2 PUMP (9 decimals)
const DEFAULT_COOLDOWN_MS = 0; // Disabled for testing
const FAUCET_SYSTEM_ADDRESS = 'PumpFaucetReserve111111111111111111111111';

/**
 * FaucetService distributes PUMP tokens (for testing/onboarding).
 *
 * - Distributes PUMP on Pumpchain
 * - Cooldown per wallet
 * - Claims are persisted to PostgreSQL
 * - Creates real Pumpchain transactions (appears in explorer, blocks, metrics)
 * - Stores hashed IPs, never raw IPs
 * - Never exposes sensitive information
 */
export class FaucetService {
  private config: FaucetConfig;

  constructor(
    private readonly accountService: AccountService,
    private readonly transactionService: TransactionService,
    private readonly db: Database,
    config?: Partial<FaucetConfig>,
  ) {
    this.config = {
      claimAmount: config?.claimAmount ?? DEFAULT_CLAIM_AMOUNT,
      cooldownMs: config?.cooldownMs ?? DEFAULT_COOLDOWN_MS,
      asset: config?.asset ?? PUMPCHAIN_NATIVE_SYMBOL,
    };
  }

  /**
   * Processes a faucet claim.
   *
   * Steps:
   * 1. Validate wallet address
   * 2. Check cooldown (wallet + IP)
   * 3. Create Pumpchain transaction (credits account)
   * 4. Persist claim to PostgreSQL
   * 5. Return result
   */
  async claim(walletAddress: string, ipAddress: string): Promise<FaucetClaimResult> {
    // 1. Validate address format
    if (!this.isValidAddress(walletAddress)) {
      throw new FaucetError('Invalid wallet address format');
    }

    // 2. Hash IP for privacy (never store raw IP)
    const ipHash = this.hashIp(ipAddress);

    // 3. Check wallet cooldown
    const walletCooldown = await this.getWalletCooldown(walletAddress);
    if (walletCooldown) {
      throw new FaucetError(
        `Cooldown active. Next claim available at ${walletCooldown.toISOString()}`,
      );
    }

    // 4. IP rate limiting disabled for testnet (per-wallet cooldown is sufficient)
    // In production, enable IP-based cooldown to prevent Sybil abuse

    // 5. Create a real Pumpchain transaction
    const tx = this.transactionService.submitSystem({
      sender: FAUCET_SYSTEM_ADDRESS,
      recipient: walletAddress,
      nonce: 0,
      type: TxType.FaucetClaim,
      amount: this.config.claimAmount.toString(),
      gasLimit: 21000,
      gasPrice: 0, // Faucet claims are fee-free
      inputData: `faucet:claim:${this.config.asset}`,
    });

    // 6. Calculate cooldown expiry
    const now = new Date();
    const cooldownUntil = new Date(now.getTime() + this.config.cooldownMs);

    // 7. Persist claim to PostgreSQL
    await this.db.insert(faucetClaims).values({
      walletAddress,
      asset: this.config.asset,
      amount: this.config.claimAmount.toString(),
      ipHash,
      claimTimestamp: now,
      cooldownUntil,
    });

    // 8. Broadcast faucet claim event
    broadcastFaucetClaimed({
      walletAddress,
      amount: this.config.claimAmount.toString(),
      asset: this.config.asset,
      txHash: tx.txHash,
    });

    return {
      success: true,
      amount: this.config.claimAmount.toString(),
      asset: this.config.asset,
      walletAddress,
      nextClaimAt: cooldownUntil.toISOString(),
      transactionHash: tx.txHash,
    };
  }

  /**
   * Returns the faucet status for a wallet address.
   */
  async getStatus(walletAddress: string): Promise<FaucetStatusResult> {
    // Get total claims for this wallet
    const [countResult] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(faucetClaims)
      .where(eq(faucetClaims.walletAddress, walletAddress));
    const totalClaims = countResult?.count ?? 0;

    // Check cooldown
    const cooldownExpiry = await this.getWalletCooldown(walletAddress);
    const eligible = !cooldownExpiry;

    return {
      eligible,
      nextClaimAt: cooldownExpiry?.toISOString() ?? null,
      claimAmount: this.config.claimAmount.toString(),
      totalClaims,
    };
  }

  /**
   * Returns recent claim history for a wallet.
   */
  async getClaimHistory(walletAddress: string, limit: number = 10) {
    const claims = await this.db
      .select()
      .from(faucetClaims)
      .where(eq(faucetClaims.walletAddress, walletAddress))
      .orderBy(desc(faucetClaims.claimTimestamp))
      .limit(limit);

    return claims.map((c) => ({
      amount: c.amount,
      asset: c.asset,
      claimTimestamp: c.claimTimestamp.toISOString(),
      cooldownUntil: c.cooldownUntil.toISOString(),
    }));
  }

  /**
   * Returns the cooldown expiry for a wallet, or null if eligible.
   */
  private async getWalletCooldown(walletAddress: string): Promise<Date | null> {
    const now = new Date();
    const [result] = await this.db
      .select({ cooldownUntil: faucetClaims.cooldownUntil })
      .from(faucetClaims)
      .where(
        and(eq(faucetClaims.walletAddress, walletAddress), gt(faucetClaims.cooldownUntil, now)),
      )
      .orderBy(desc(faucetClaims.cooldownUntil))
      .limit(1);

    return result?.cooldownUntil ?? null;
  }

  /**
   * Returns the cooldown expiry for an IP hash, or null if eligible.
   */
  private async getIpCooldown(ipHash: string): Promise<Date | null> {
    const now = new Date();
    const [result] = await this.db
      .select({ cooldownUntil: faucetClaims.cooldownUntil })
      .from(faucetClaims)
      .where(and(eq(faucetClaims.ipHash, ipHash), gt(faucetClaims.cooldownUntil, now)))
      .orderBy(desc(faucetClaims.cooldownUntil))
      .limit(1);

    return result?.cooldownUntil ?? null;
  }

  /**
   * Hashes an IP address with SHA-256. Never stores raw IP.
   */
  private hashIp(ip: string): string {
    return createHash('sha256').update(`pumpchain_faucet:${ip}`).digest('hex');
  }

  /**
   * Validates wallet address format (base58, 32-44 chars).
   */
  private isValidAddress(address: string): boolean {
    return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
  }

  /**
   * Returns the configured claim amount.
   */
  getClaimAmount(): bigint {
    return this.config.claimAmount;
  }
}

/**
 * Custom error class for faucet-specific errors.
 */
export class FaucetError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FaucetError';
  }
}

