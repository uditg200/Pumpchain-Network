/**
 * ANSEM Token Configuration
 *
 * The ANSEM (The Black Bull) SPL token lives on Solana.
 * Users buy ANSEM on DEXes, then bridge it to Ansem Network
 * to use as native gas token.
 */

// Official ANSEM token mint on Solana
export const PUMP_TOKEN_MINT = '9cRCn9rGT8V2imeM2BaKs13yhMEais3ruM3rPvTGpump';

// Token metadata
export const PUMP_TOKEN_DECIMALS = 6;
export const PUMP_TOKEN_SYMBOL = 'ANSEM';

// Bridge deposit address
export const BRIDGE_DEPOSIT_ADDRESS = 'BxQLsf52hzmSENtbnTWMoTbtNrDdcd5fewoj5Pmtyk3p';

// Conversion: Solana ANSEM (6 decimals) → Ansem Network (9 decimals)
export const SOLANA_TO_PUMPCHAIN_MULTIPLIER = 1000n;

// Links
export const PUMP_BUY_LINK = 'https://jup.ag/swap/?inputMint=So11111111111111111111111111111111111111112&outputMint=9cRCn9rGT8V2imeM2BaKs13yhMEais3ruM3rPvTGpump';
export const PUMP_LAUNCHPAD_LINK = 'https://ansemtoken.com';
