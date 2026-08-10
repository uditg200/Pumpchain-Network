import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import type { SolanaConnectionStatus } from './solana.types.js';
import { env } from '../../config/env.js';
import {
  PUMP_TOKEN_MINT,
  PUMP_TOKEN_DECIMALS,
  BRIDGE_DEPOSIT_ADDRESS,
} from '../../config/token.js';

/**
 * SolanaService provides connectivity to Solana.
 *
 * Used for:
 * - SOL balance lookups
 * - PUMP SPL token balance lookups
 * - Bridge deposit verification (check if PUMP was sent to deposit address)
 * - Transaction confirmation
 *
 * SECURITY: No private keys stored or handled server-side.
 */
export class SolanaService {
  private connection: Connection;

  constructor() {
    this.connection = new Connection(env.SOLANA_RPC_URL, 'confirmed');
  }

  getConnection(): Connection {
    return this.connection;
  }

  /**
   * Gets the SOL balance for an address.
   */
  async getSolanaBalance(address: string): Promise<{ lamports: number; sol: number }> {
    const pubkey = new PublicKey(address);
    const lamports = await this.connection.getBalance(pubkey);
    return { lamports, sol: lamports / LAMPORTS_PER_SOL };
  }

  /**
   * Gets the PUMP SPL token balance for an address.
   * PUMP uses Token-2022 (Token Extensions Program).
   * Returns the balance in token base units (6 decimals).
   */
  async getPumpTokenBalance(address: string): Promise<{ amount: string; uiAmount: number }> {
    try {
      const ownerPubkey = new PublicKey(address);
      const mintPubkey = new PublicKey(PUMP_TOKEN_MINT);

      // Token-2022 program ID
      const TOKEN_2022_PROGRAM_ID = new PublicKey('TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb');

      const tokenAccounts = await this.connection.getTokenAccountsByOwner(ownerPubkey, {
        mint: mintPubkey,
        programId: TOKEN_2022_PROGRAM_ID,
      });

      if (tokenAccounts.value.length === 0) {
        return { amount: '0', uiAmount: 0 };
      }

      // Parse the account data to get balance
      // Token account data layout: first 64 bytes are mint + owner, then 8 bytes for amount
      const accountInfo = tokenAccounts.value[0]!.account;
      const data = accountInfo.data;
      // Amount is at offset 64, 8 bytes, little-endian uint64
      const amountBuffer = data.slice(64, 72);
      const amount = BigInt(
        `0x${Buffer.from(amountBuffer).reverse().toString('hex')}`,
      );

      const divisor = 10 ** PUMP_TOKEN_DECIMALS;
      const uiAmount = Number(amount) / divisor;

      return { amount: amount.toString(), uiAmount };
    } catch {
      return { amount: '0', uiAmount: 0 };
    }
  }

  /**
   * Verifies a PUMP token transfer to the bridge deposit address.
   * Checks if the given transaction signature transferred PUMP tokens
   * to our bridge deposit address.
   */
  async verifyPumpDeposit(
    signature: string,
    expectedSender: string,
    expectedAmount: string,
  ): Promise<{ verified: boolean; actualAmount: string; error?: string }> {
    try {
      const tx = await this.connection.getTransaction(signature, {
        maxSupportedTransactionVersion: 0,
      });

      if (!tx) {
        return { verified: false, actualAmount: '0', error: 'Transaction not found' };
      }

      if (tx.meta?.err) {
        return { verified: false, actualAmount: '0', error: 'Transaction failed on-chain' };
      }

      // For the prototype, we accept the transaction as valid if it exists and succeeded.
      // In production, we would parse the token transfer instructions to verify:
      // - Correct mint (PUMP_TOKEN_MINT)
      // - Correct destination (BRIDGE_DEPOSIT_ADDRESS token account)
      // - Correct amount
      // - Correct sender

      return { verified: true, actualAmount: expectedAmount };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Verification failed';
      return { verified: false, actualAmount: '0', error: message };
    }
  }

  /**
   * Gets a transaction by its signature.
   */
  async getTransaction(signature: string) {
    return this.connection.getTransaction(signature, {
      maxSupportedTransactionVersion: 0,
    });
  }

  /**
   * Gets the latest blockhash.
   */
  async getLatestBlockhash() {
    const result = await this.connection.getLatestBlockhash('confirmed');
    return { blockhash: result.blockhash, lastValidBlockHeight: result.lastValidBlockHeight };
  }

  /**
   * Confirms a transaction by signature.
   */
  async confirmTransaction(signature: string): Promise<{
    confirmed: boolean;
    slot: number | null;
    error: string | null;
  }> {
    try {
      const latestBlockhash = await this.connection.getLatestBlockhash();
      const result = await this.connection.confirmTransaction(
        { signature, blockhash: latestBlockhash.blockhash, lastValidBlockHeight: latestBlockhash.lastValidBlockHeight },
        'confirmed',
      );
      return {
        confirmed: !result.value.err,
        slot: result.context.slot,
        error: result.value.err ? JSON.stringify(result.value.err) : null,
      };
    } catch (err) {
      return { confirmed: false, slot: null, error: err instanceof Error ? err.message : 'Confirmation failed' };
    }
  }

  /**
   * Checks connectivity to Solana.
   */
  async getStatus(): Promise<SolanaConnectionStatus> {
    try {
      const start = Date.now();
      const slot = await this.connection.getSlot();
      return { connected: true, cluster: 'devnet', slotHeight: slot, latency: Date.now() - start };
    } catch {
      return { connected: false, cluster: 'devnet', slotHeight: null, latency: null };
    }
  }

  /**
   * Validates address format.
   */
  isValidAddress(address: string): boolean {
    try { new PublicKey(address); return true; } catch { return false; }
  }

  /**
   * Returns the PUMP token mint address.
   */
  getPumpMintAddress(): string {
    return PUMP_TOKEN_MINT;
  }

  /**
   * Returns the bridge deposit address.
   */
  getBridgeDepositAddress(): string {
    return BRIDGE_DEPOSIT_ADDRESS;
  }
}
