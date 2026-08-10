import { Router } from 'express';
import type { ServiceRegistry } from '../modules/index.js';

export const solanaRouter = Router();

/**
 * GET /api/solana/balance/:address
 * Returns the SOL balance for a Solana Devnet address.
 */
solanaRouter.get('/balance/:address', async (req, res) => {
  const registry = req.app.locals['registry'] as ServiceRegistry;
  const address = req.params['address']!;

  if (!registry.solanaService.isValidAddress(address)) {
    res.status(400).json({
      success: false,
      error: { code: 'INVALID_ADDRESS', message: 'Invalid Solana address' },
    });
    return;
  }

  try {
    const balance = await registry.solanaService.getSolanaBalance(address);
    res.json({
      success: true,
      data: {
        address,
        lamports: balance.lamports,
        sol: balance.sol,
        cluster: 'devnet',
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch balance';
    res.status(502).json({
      success: false,
      error: { code: 'RPC_ERROR', message },
    });
  }
});

/**
 * GET /api/solana/blockhash
 * Returns the latest Solana blockhash.
 */
solanaRouter.get('/blockhash', async (req, res) => {
  const registry = req.app.locals['registry'] as ServiceRegistry;

  try {
    const result = await registry.solanaService.getLatestBlockhash();
    res.json({ success: true, data: result });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch blockhash';
    res.status(502).json({
      success: false,
      error: { code: 'RPC_ERROR', message },
    });
  }
});

/**
 * GET /api/solana/transaction/:signature
 * Returns a Solana transaction by signature.
 */
solanaRouter.get('/transaction/:signature', async (req, res) => {
  const registry = req.app.locals['registry'] as ServiceRegistry;
  const signature = req.params['signature']!;

  try {
    const tx = await registry.solanaService.getTransaction(signature);
    if (!tx) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Transaction not found' },
      });
      return;
    }
    res.json({ success: true, data: tx });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch transaction';
    res.status(502).json({
      success: false,
      error: { code: 'RPC_ERROR', message },
    });
  }
});

/**
 * GET /api/solana/status
 * Returns Solana Devnet connectivity status.
 */
solanaRouter.get('/status', async (req, res) => {
  const registry = req.app.locals['registry'] as ServiceRegistry;

  const status = await registry.solanaService.getStatus();
  res.json({ success: true, data: status });
});

/**
 * GET /api/solana/pump-balance/:address
 * Returns the user's PUMP SPL token balance on Solana.
 */
solanaRouter.get('/pump-balance/:address', async (req, res) => {
  const registry = req.app.locals['registry'] as ServiceRegistry;
  const address = req.params['address']!;

  if (!registry.solanaService.isValidAddress(address)) {
    res.status(400).json({ success: false, error: { code: 'INVALID_ADDRESS', message: 'Invalid address' } });
    return;
  }

  try {
    const balance = await registry.solanaService.getPumpTokenBalance(address);
    res.json({
      success: true,
      data: { address, mint: registry.solanaService.getPumpMintAddress(), ...balance },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch PUMP balance';
    res.status(502).json({ success: false, error: { code: 'RPC_ERROR', message } });
  }
});

/**
 * GET /api/solana/bridge-info
 * Returns bridge deposit address and token config.
 */
solanaRouter.get('/bridge-info', (req, res) => {
  const registry = req.app.locals['registry'] as ServiceRegistry;
  res.json({
    success: true,
    data: {
      pumpMint: registry.solanaService.getPumpMintAddress(),
      bridgeDepositAddress: registry.solanaService.getBridgeDepositAddress(),
      solanaDecimals: 6,
      pumpchainDecimals: 9,
      buyLink: 'https://jup.ag/swap/SOL-PUMP',
    },
  });
});
