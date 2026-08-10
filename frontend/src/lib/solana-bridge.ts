import {
  Connection,
  PublicKey,
  Transaction,
} from '@solana/web3.js';
import {
  getAssociatedTokenAddress,
  createTransferCheckedInstruction,
  createAssociatedTokenAccountInstruction,
  TOKEN_2022_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from '@solana/spl-token';

/**
 * PUMP token mint address on Solana mainnet (official Pump.fun token)
 * This token uses the Token-2022 program (Token Extensions).
 */
const PUMP_MINT = new PublicKey('pumpCmXqMfrsAkQ5r49WcJnRayYRqmXz6ae8H7H9Dfn');

/**
 * Bridge deposit address — all users send PUMP here.
 */
const BRIDGE_DEPOSIT_ADDRESS = new PublicKey('BxQLsf52hzmSENtbnTWMoTbtNrDdcd5fewoj5Pmtyk3p');

/**
 * PUMP token decimals on Solana
 */
const PUMP_DECIMALS = 6;

/**
 * Creates a real SPL token transfer transaction for bridging PUMP from Solana to Pumpchain.
 *
 * Uses Token-2022 program (PUMP is a Token Extensions token).
 * Creates the recipient ATA if needed.
 */
export async function createBridgeDepositTransaction(
  connection: Connection,
  senderPublicKey: PublicKey,
  amount: string,
): Promise<Transaction> {
  // Convert human amount to base units (6 decimals)
  const baseUnits = BigInt(Math.floor(parseFloat(amount) * 10 ** PUMP_DECIMALS));

  // Get sender's PUMP token account (ATA for Token-2022)
  const senderTokenAccount = await getAssociatedTokenAddress(
    PUMP_MINT,
    senderPublicKey,
    false,
    TOKEN_2022_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID,
  );

  // Get bridge deposit PUMP token account (ATA for Token-2022)
  const bridgeTokenAccount = await getAssociatedTokenAddress(
    PUMP_MINT,
    BRIDGE_DEPOSIT_ADDRESS,
    false,
    TOKEN_2022_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID,
  );

  const transaction = new Transaction();

  // Check if the bridge deposit address has a token account — create if not
  const bridgeAccountInfo = await connection.getAccountInfo(bridgeTokenAccount);
  if (!bridgeAccountInfo) {
    // Create the ATA using Token-2022 program
    transaction.add(
      createAssociatedTokenAccountInstruction(
        senderPublicKey,          // payer
        bridgeTokenAccount,       // ATA to create
        BRIDGE_DEPOSIT_ADDRESS,   // owner of the ATA
        PUMP_MINT,                // token mint
        TOKEN_2022_PROGRAM_ID,    // Token-2022 program
        ASSOCIATED_TOKEN_PROGRAM_ID,
      ),
    );
  }

  // Transfer using Token-2022 transfer_checked (required for PUMP token)
  transaction.add(
    createTransferCheckedInstruction(
      senderTokenAccount,       // source
      PUMP_MINT,                // mint (required for checked transfer)
      bridgeTokenAccount,       // destination
      senderPublicKey,          // owner of source
      baseUnits,                // amount in base units
      PUMP_DECIMALS,            // decimals (required for checked transfer)
      [],                       // no multisig signers
      TOKEN_2022_PROGRAM_ID,    // Token-2022 program
    ),
  );

  // Get recent blockhash
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
  transaction.recentBlockhash = blockhash;
  transaction.lastValidBlockHeight = lastValidBlockHeight;
  transaction.feePayer = senderPublicKey;

  return transaction;
}

/**
 * Returns the PUMP token base units for a given human-readable amount.
 */
export function pumpToBaseUnits(amount: string): string {
  return BigInt(Math.floor(parseFloat(amount) * 10 ** PUMP_DECIMALS)).toString();
}

/**
 * Returns the bridge deposit address.
 */
export function getBridgeDepositAddress(): string {
  return BRIDGE_DEPOSIT_ADDRESS.toBase58();
}

/**
 * Returns the PUMP mint address.
 */
export function getPumpMint(): string {
  return PUMP_MINT.toBase58();
}
