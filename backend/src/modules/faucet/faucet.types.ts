export interface FaucetConfig {
  /** Amount to drip per claim in base units (9 decimals) */
  claimAmount: bigint;
  /** Cooldown between claims per wallet in ms (default: 24h) */
  cooldownMs: number;
  /** Native token symbol */
  asset: string;
}

export interface FaucetClaimResult {
  success: boolean;
  amount: string;
  asset: string;
  walletAddress: string;
  nextClaimAt: string;
  transactionHash: string;
}

export interface FaucetStatusResult {
  eligible: boolean;
  nextClaimAt: string | null;
  claimAmount: string;
  totalClaims: number;
}

export interface FaucetClaimRecord {
  id: number;
  walletAddress: string;
  amount: string;
  asset: string;
  txHash: string;
  ipHash: string;
  claimTimestamp: Date;
  cooldownUntil: Date;
}
