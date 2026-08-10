/**
 * PUMP Token Configuration
 *
 * The PUMP SPL token lives on Solana. Users buy PUMP on DEXes,
 * then bridge it to Pumpchain to use as native gas token.
 *
 * Update PUMP_TOKEN_MINT with the real mint address after launch.
 */

// ─── Official Pump.fun PUMP token on Solana ───
export const PUMP_TOKEN_MINT = 'pumpCmXqMfrsAkQ5r49WcJnRayYRqmXz6ae8H7H9Dfn';

// Token metadata
export const PUMP_TOKEN_DECIMALS = 6; // PUMP uses 6 decimals on Solana
export const PUMP_TOKEN_SYMBOL = 'PUMP';

// Bridge deposit address — tokens are sent here to be bridged to Pumpchain
// In production, this would be a PDA or multisig.
export const BRIDGE_DEPOSIT_ADDRESS = 'BxQLsf52hzmSENtbnTWMoTbtNrDdcd5fewoj5Pmtyk3p';

// Conversion: Solana PUMP (6 decimals) → Pumpchain PUMP (9 decimals)
// 1 PUMP on Solana = 1 PUMP on Pumpchain
// Solana: 1_000_000 base units = 1 PUMP
// Pumpchain: 1_000_000_000 base units = 1 PUMP
export const SOLANA_TO_PUMPCHAIN_MULTIPLIER = 1000n; // multiply by 1000 to convert 6→9 decimals

// Links
export const PUMP_BUY_LINK = 'https://jup.ag/swap/SOL-PUMP';
export const PUMP_LAUNCHPAD_LINK = 'https://pump.fun';
