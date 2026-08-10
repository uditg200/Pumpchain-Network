import { Router } from 'express';
import type { ServiceRegistry } from '../modules/index.js';
import { FaucetError } from '../modules/faucet/faucet.service.js';
import { validateBody } from '../middleware/validate.js';
import { faucetClaimSchema } from '../middleware/schemas.js';
import { createRateLimiter } from '../middleware/rate-limit.js';

export const faucetRouter = Router();

// Faucet rate limit: 10 requests per minute per IP
faucetRouter.use(createRateLimiter({ windowMs: 60_000, maxRequests: 10, message: 'Faucet rate limited. Try again in a minute.' }));

/**
 * POST /api/faucet/claim
 *
 * Claims testnet nPUMP tokens for the given wallet address.
 * Creates a real Pumpchain transaction persisted to PostgreSQL.
 */
faucetRouter.post('/claim', validateBody(faucetClaimSchema), async (req, res) => {
  const registry = req.app.locals['registry'] as ServiceRegistry;

  const { walletAddress } = req.body;

  const ipAddress =
    (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
    req.socket.remoteAddress ||
    'unknown';

  try {
    const result = await registry.faucetService.claim(walletAddress, ipAddress);

    res.status(200).json({
      success: true,
      data: {
        success: result.success,
        amount: result.amount,
        asset: result.asset,
        walletAddress: result.walletAddress,
        nextClaimAt: result.nextClaimAt,
        transactionHash: result.transactionHash,
      },
    });
  } catch (err) {
    if (err instanceof FaucetError) {
      res.status(429).json({
        success: false,
        error: { code: 'FAUCET_COOLDOWN', message: err.message },
      });
      return;
    }

    const message = err instanceof Error ? err.message : 'Faucet claim failed';
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message },
    });
  }
});

/**
 * GET /api/faucet/status/:walletAddress
 *
 * Returns everything the faucet page needs in ONE call:
 * eligibility, balance, claim history, and claim amount.
 */
faucetRouter.get('/status/:walletAddress', async (req, res) => {
  const registry = req.app.locals['registry'] as ServiceRegistry;
  const walletAddress = req.params['walletAddress']!;

  try {
    const [status, history] = await Promise.all([
      registry.faucetService.getStatus(walletAddress),
      registry.faucetService.getClaimHistory(walletAddress, 10),
    ]);

    // Get Pumpchain balance from in-memory account state
    const account = registry.accountService.getAccount(walletAddress);
    const balance = account?.balance.toString() ?? '0';

    res.json({
      success: true,
      data: {
        eligible: status.eligible,
        nextClaimAt: status.nextClaimAt,
        claimAmount: status.claimAmount,
        totalClaims: status.totalClaims,
        balance,
        history,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to get status';
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message },
    });
  }
});

