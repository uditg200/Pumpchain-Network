import { randomUUID } from 'crypto';
import { eq } from 'drizzle-orm';
import type { SolanaService } from '../solana/solana.service.js';
import type { TransactionService } from '../transactions/transaction.service.js';
import type { AccountService } from '../accounts/account.service.js';
import type { Database } from '../../db/index.js';
import { bridgeTransactions } from '../../db/schema.js';
import { broadcastBridgeUpdated } from '../../ws/index.js';
import { SOLANA_TO_PUMPCHAIN_MULTIPLIER } from '../../config/token.js';
import {
  BridgeDirection,
  BridgeStatus,
  type BridgeDepositInput,
  type BridgeOperation,
} from './bridge.types.js';

const PUMPCHAIN_BRIDGE_ADDRESS = 'BxQLsf52hzmSENtbnTWMoTbtNrDdcd5fewoj5Pmtyk3p';

/**
 * BridgeDepositService handles PUMP token deposits: Solana → Pumpchain.
 *
 * Flow:
 * 1. User transfers PUMP SPL tokens to bridge deposit address on Solana
 * 2. User sends the Solana transaction signature to this service
 * 3. Service verifies the PUMP token transfer on Solana
 * 4. Service credits equivalent PUMP on Pumpchain (adjusted for decimals)
 * 5. Bridge status: INITIATED → DETECTED → PROCESSING → CONFIRMED
 *
 * NOTE: This is a prototype. Production would use watchers/oracles.
 */
export class BridgeDepositService {
  constructor(
    private readonly solanaService: SolanaService,
    private readonly transactionService: TransactionService,
    private readonly accountService: AccountService,
    private readonly db: Database,
  ) {}

  async processDeposit(input: BridgeDepositInput): Promise<BridgeOperation> {
    const bridgeId = randomUUID();
    const now = new Date();

    // 1. Record as INITIATED
    await this.db.insert(bridgeTransactions).values({
      bridgeTxId: bridgeId,
      direction: BridgeDirection.Deposit,
      sourceChain: 'solana',
      destinationChain: 'pumpchain',
      sourceTxHash: input.solanaSignature,
      destinationTxHash: null,
      walletAddress: input.walletAddress,
      asset: input.asset,
      amount: input.amount,
      status: BridgeStatus.Initiated,
      createdAt: now,
    });

    // 2. Verify the PUMP token transfer on Solana
    // Simulated signatures (from prototype mode) are skipped
    // Real Solana signatures are verified on-chain via Helius RPC
    const isSimulated = input.solanaSignature.startsWith('deposit_') || input.solanaSignature.startsWith('sim_');

    if (!isSimulated) {
      // Real signature — verify the transaction exists and succeeded on Solana
      const verification = await this.solanaService.verifyPumpDeposit(
        input.solanaSignature,
        input.walletAddress,
        input.amount,
      );

      if (!verification.verified) {
        await this.updateStatus(bridgeId, BridgeStatus.Failed);
        return this.buildResult(bridgeId, input, BridgeStatus.Failed, null, now,
          verification.error ?? 'Failed to verify Solana PUMP transfer');
      }
    }

    await this.updateStatus(bridgeId, BridgeStatus.Detected);

    // 3. Process: Convert amount (Solana 6 decimals → Pumpchain 9 decimals) and credit
    await this.updateStatus(bridgeId, BridgeStatus.Processing);

    // Convert: multiply by 1000 to go from 6 to 9 decimal places
    const solanaAmount = BigInt(input.amount);
    const pumpchainAmount = (solanaAmount * SOLANA_TO_PUMPCHAIN_MULTIPLIER).toString();

    // Directly credit the account (instant, no sequencer needed)
    this.accountService.credit(input.walletAddress, BigInt(pumpchainAmount));

    // Generate a tx hash for record-keeping (not submitted to pool to avoid double-credit)
    const { hashTransaction } = await import('../blocks/block.hash.js');
    const txHash = hashTransaction({
      from: PUMPCHAIN_BRIDGE_ADDRESS,
      to: input.walletAddress,
      amount: pumpchainAmount,
      nonce: 0,
      timestamp: Date.now(),
      data: `bridge:deposit:PUMP:${bridgeId}`,
    });

    // 4. Confirm
    await this.db
      .update(bridgeTransactions)
      .set({
        status: BridgeStatus.Confirmed,
        destinationTxHash: txHash,
        completedAt: new Date(),
      })
      .where(eq(bridgeTransactions.bridgeTxId, bridgeId));

    return this.buildResult(bridgeId, input, BridgeStatus.Confirmed, txHash, now, null);
  }

  private async updateStatus(bridgeId: string, status: BridgeStatus) {
    await this.db
      .update(bridgeTransactions)
      .set({ status })
      .where(eq(bridgeTransactions.bridgeTxId, bridgeId));
  }

  private buildResult(
    id: string,
    input: BridgeDepositInput,
    status: BridgeStatus,
    destinationTxHash: string | null,
    createdAt: Date,
    errorMessage: string | null,
  ): BridgeOperation {
    const op: BridgeOperation = {
      id,
      direction: BridgeDirection.Deposit,
      sourceChain: 'solana',
      destinationChain: 'pumpchain',
      sourceTxHash: input.solanaSignature,
      destinationTxHash,
      walletAddress: input.walletAddress,
      asset: input.asset,
      amount: input.amount,
      status,
      errorMessage,
      createdAt: createdAt.toISOString(),
      updatedAt: new Date().toISOString(),
      completedAt: status === BridgeStatus.Confirmed ? new Date().toISOString() : null,
    };

    broadcastBridgeUpdated({
      id: op.id,
      direction: op.direction,
      status: op.status,
      amount: op.amount,
      asset: op.asset,
      walletAddress: op.walletAddress,
    });

    return op;
  }
}
