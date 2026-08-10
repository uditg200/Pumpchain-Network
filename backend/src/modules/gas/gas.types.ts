export interface GasEstimate {
  gasLimit: number;
  gasPrice: number;
  estimatedCost: bigint;
}

export interface GasConfig {
  /** Base gas price in nPUMP lamports */
  baseGasPrice: number;
  /** Maximum gas per block */
  blockGasLimit: number;
  /** Minimum gas for a simple transfer */
  transferGasBase: number;
  /** Gas per byte of transaction data */
  gasPerByte: number;
}

