import type { GasEstimate, GasConfig } from './gas.types.js';
import { PUMPCHAIN_GAS_LIMIT_PER_BLOCK } from '@pumpchain/shared';

/**
 * GasService manages gas pricing and estimation for the Pumpchain network.
 *
 * In this prototype, gas prices are static but the architecture
 * supports future dynamic pricing based on demand.
 */
export class GasService {
  private config: GasConfig;

  constructor(config?: Partial<GasConfig>) {
    this.config = {
      baseGasPrice: config?.baseGasPrice ?? 1,
      blockGasLimit: config?.blockGasLimit ?? PUMPCHAIN_GAS_LIMIT_PER_BLOCK,
      transferGasBase: config?.transferGasBase ?? 5000,
      gasPerByte: config?.gasPerByte ?? 10,
    };
  }

  /**
   * Returns the current gas price in nPUMP lamports.
   */
  getCurrentGasPrice(): number {
    return this.config.baseGasPrice;
  }

  /**
   * Returns the block gas limit.
   */
  getBlockGasLimit(): number {
    return this.config.blockGasLimit;
  }

  /**
   * Estimates gas for a transfer transaction.
   */
  estimateTransferGas(dataBytes?: number): GasEstimate {
    const dataGas = (dataBytes ?? 0) * this.config.gasPerByte;
    const gasLimit = this.config.transferGasBase + dataGas;
    return {
      gasLimit,
      gasPrice: this.config.baseGasPrice,
      estimatedCost: BigInt(gasLimit) * BigInt(this.config.baseGasPrice),
    };
  }

  /**
   * Computes the actual gas used for a transaction.
   * In production this would depend on execution; here it's simplified.
   */
  computeGasUsed(txDataLength: number): number {
    return this.config.transferGasBase + txDataLength * this.config.gasPerByte;
  }

  /**
   * Checks if a block has enough remaining gas capacity.
   */
  hasCapacity(currentBlockGas: number, txGas: number): boolean {
    return currentBlockGas + txGas <= this.config.blockGasLimit;
  }
}

