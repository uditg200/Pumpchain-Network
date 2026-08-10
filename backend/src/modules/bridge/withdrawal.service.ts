import { randomUUID } from 'crypto';
import { eq } from 'drizzle-orm';
import { Keypair, PublicKey, Transaction, Connection } from '@solana/web3.js';
import {
  getAssociatedTokenAddress,
  createTransferCheckedInstruction,
  createAssociatedTokenAccountInstruction,
  TOKEN_2022_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import type { AccountService } from '../accounts/account.service.js';
import type { Database } from '../../db/index.js';
import { bridgeTransactions } from '../../db/schema.js';
import { broadcastBridgeUpdated } from '../../ws/index.js';
import { env } from '../../config/env.js';
import { PUMP_TOKEN_MINT, PUMP_TOKEN_DECIMALS } from '../../config/token.js';
import {
  BridgeDirection,
  BridgeStatus,
  type BridgeWithdrawInput,
  type BridgeOperation,
} from './bridge.types.js';

const PUMPCHAIN_BRIDGE_ADDRESS = 'BxQLsf52hzmSENtbnTWMoTbtNrDdcd5fewoj5Pmtyk3p';

/**
 * BridgeWithdrawalService handles Pumpchain → Solana withdrawals.
 *
 * Flow:
 * 1. Validate Pumpchain balance
 * 2. Debit from Pumpchain account
 * 3. Sign and send a REAL Solana token transfer from bridge wallet to user
 * 4. Wait for Solana confirmation
 * 5. Mark as CONFIRMED with real Solana tx signature
 *
 * SECURITY: Private key is read from env var only, never logged or exposed.
 */
export class BridgeWithdrawalService {
  private connection: Connection;

  constructor(
    private readonly accountService: AccountService,
    private readonly db: Database,
  ) {
    this.connection = new Connection(env.SOLANA_RPC_URL, 'confirmed');
  }

  async processWithdrawal(input: BridgeWithdrawInput): Promise<BridgeOperation> {
    const bridgeId = randomUUID();
    const now = new Date();

    // 1. Validate balance
    const account = this.accountService.getAccount(input.walletAddress);
    const balance = account?.balance ?? 0n;
    // Input amount is in Pumpchain units (9 decimals)
    const amount = BigInt(input.amount);

    if (balance < amount) {
      await this.db.insert(bridgeTransactions).values({
        bridgeTxId: bridgeId,
        direction: BridgeDirection.Withdraw,
        sourceChain: 'pumpchain-mainnet',
        destinationChain: 'solana-mainnet',
        sourceTxHash: null,
        destinationTxHash: null,
        walletAddress: input.walletAddress,
        asset: input.asset,
        amount: input.amount,
        status: BridgeStatus.Failed,
        createdAt: now,
      });

      return {
        id: bridgeId,
        direction: BridgeDirection.Withdraw,
        sourceChain: 'pumpchain-mainnet',
        destinationChain: 'solana-mainnet',
        sourceTxHash: null,
        destinationTxHash: null,
        walletAddress: input.walletAddress,
        asset: input.asset,
        amount: input.amount,
        status: BridgeStatus.Failed,
        errorMessage: `Insufficient balance: has ${balance.toString()}, needs ${input.amount}`,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
        completedAt: null,
      };
    }

    // 2. Record as INITIATED
    await this.db.insert(bridgeTransactions).values({
      bridgeTxId: bridgeId,
      direction: BridgeDirection.Withdraw,
      sourceChain: 'pumpchain-mainnet',
      destinationChain: 'solana-mainnet',
      sourceTxHash: null,
      destinationTxHash: null,
      walletAddress: input.walletAddress,
      asset: input.asset,
      amount: input.amount,
      status: BridgeStatus.Initiated,
      createdAt: now,
    });

    // 3. Debit Pumpchain balance (instant)
    this.accountService.debit(input.walletAddress, amount);

    // 4. Send REAL PUMP tokens on Solana from bridge wallet to user
    let solanaSignature: string;
    try {
      // Convert Pumpchain amount (9 dec) to Solana amount (6 dec): divide by 1000
      const solanaAmount = amount / 1000n;
      solanaSignature = await this.sendPumpTokens(input.walletAddress, solanaAmount);
    } catch (err) {
      // Solana transfer failed — refund Pumpchain balance
      this.accountService.credit(input.walletAddress, amount);

      await this.db
        .update(bridgeTransactions)
        .set({ status: BridgeStatus.Failed })
        .where(eq(bridgeTransactions.bridgeTxId, bridgeId));

      const errorMsg = err instanceof Error ? err.message : 'Solana transfer failed';
      return {
        id: bridgeId,
        direction: BridgeDirection.Withdraw,
        sourceChain: 'pumpchain-mainnet',
        destinationChain: 'solana-mainnet',
        sourceTxHash: null,
        destinationTxHash: null,
        walletAddress: input.walletAddress,
        asset: input.asset,
        amount: input.amount,
        status: BridgeStatus.Failed,
        errorMessage: errorMsg,
        createdAt: now.toISOString(),
        updatedAt: new Date().toISOString(),
        completedAt: null,
      };
    }

    // 5. Mark as CONFIRMED with real Solana signature
    await this.db
      .update(bridgeTransactions)
      .set({
        status: BridgeStatus.Confirmed,
        sourceTxHash: `pumpchain:debit:${bridgeId}`,
        destinationTxHash: solanaSignature,
        completedAt: new Date(),
      })
      .where(eq(bridgeTransactions.bridgeTxId, bridgeId));

    const result: BridgeOperation = {
      id: bridgeId,
      direction: BridgeDirection.Withdraw,
      sourceChain: 'pumpchain-mainnet',
      destinationChain: 'solana-mainnet',
      sourceTxHash: `pumpchain:debit:${bridgeId}`,
      destinationTxHash: solanaSignature,
      walletAddress: input.walletAddress,
      asset: input.asset,
      amount: input.amount,
      status: BridgeStatus.Confirmed,
      errorMessage: null,
      createdAt: now.toISOString(),
      updatedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
    };

    broadcastBridgeUpdated({
      id: result.id,
      direction: result.direction,
      status: result.status,
      amount: result.amount,
      asset: result.asset,
      walletAddress: result.walletAddress,
    });

    return result;
  }

  /**
   * Signs and sends a real PUMP token transfer on Solana.
   * Sends tokens from the bridge wallet to the user's address.
   * Returns the Solana transaction signature.
   */
  private async sendPumpTokens(recipientAddress: string, amount: bigint): Promise<string> {
    const privateKeyStr = env.BRIDGE_WALLET_PRIVATE_KEY;
    if (!privateKeyStr) {
      throw new Error('Bridge wallet private key not configured');
    }

    // Decode the bridge wallet keypair from base58 private key
    const bs58 = await import('bs58');
    const secretKey = bs58.default.decode(privateKeyStr);
    const bridgeKeypair = Keypair.fromSecretKey(secretKey);

    const mintPubkey = new PublicKey(PUMP_TOKEN_MINT);
    const recipientPubkey = new PublicKey(recipientAddress);

    // Get bridge wallet's PUMP token account
    const bridgeTokenAccount = await getAssociatedTokenAddress(
      mintPubkey,
      bridgeKeypair.publicKey,
      false,
      TOKEN_2022_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID,
    );

    // Get recipient's PUMP token account
    const recipientTokenAccount = await getAssociatedTokenAddress(
      mintPubkey,
      recipientPubkey,
      false,
      TOKEN_2022_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID,
    );

    const transaction = new Transaction();

    // Create recipient ATA if it doesn't exist
    const recipientAccountInfo = await this.connection.getAccountInfo(recipientTokenAccount);
    if (!recipientAccountInfo) {
      transaction.add(
        createAssociatedTokenAccountInstruction(
          bridgeKeypair.publicKey,  // payer
          recipientTokenAccount,    // ATA to create
          recipientPubkey,          // owner
          mintPubkey,               // mint
          TOKEN_2022_PROGRAM_ID,
          ASSOCIATED_TOKEN_PROGRAM_ID,
        ),
      );
    }

    // Transfer PUMP tokens using transfer_checked (required for Token-2022)
    transaction.add(
      createTransferCheckedInstruction(
        bridgeTokenAccount,       // source
        mintPubkey,               // mint
        recipientTokenAccount,    // destination
        bridgeKeypair.publicKey,  // owner of source
        amount,                   // amount in base units (6 decimals)
        PUMP_TOKEN_DECIMALS,      // decimals
        [],                       // no multisig
        TOKEN_2022_PROGRAM_ID,
      ),
    );

    // Get blockhash and send
    const { blockhash, lastValidBlockHeight } = await this.connection.getLatestBlockhash('confirmed');
    transaction.recentBlockhash = blockhash;
    transaction.lastValidBlockHeight = lastValidBlockHeight;
    transaction.feePayer = bridgeKeypair.publicKey;

    // Sign with bridge wallet
    transaction.sign(bridgeKeypair);

    // Send and confirm
    const signature = await this.connection.sendRawTransaction(transaction.serialize());
    await this.connection.confirmTransaction(
      { signature, blockhash, lastValidBlockHeight },
      'confirmed',
    );

    return signature;
  }
}
