import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from './config/env.js';
import { healthRouter } from './routes/health.js';
import { blocksRouter } from './routes/blocks.js';
import { transactionsRouter } from './routes/transactions.js';
import { accountsRouter } from './routes/accounts.js';
import { networkRouter } from './routes/network.js';
import { bridgeRouter } from './routes/bridge.js';
import { faucetRouter } from './routes/faucet.js';
import { solanaRouter } from './routes/solana.js';
import { explorerRouter } from './routes/explorer.js';
import { rpcRouter } from './routes/rpc.js';
import { errorHandler } from './middleware/error-handler.js';
import { sanitizeBody } from './middleware/sanitize.js';
import { createRateLimiter } from './middleware/rate-limit.js';

export const app = express();

// ─── Security Middleware ─────────────────────────────────────────────────────

// Helmet: security headers (CSP, HSTS, X-Frame, etc.)
app.use(helmet());

// CORS: restrict to configured origin
app.use(cors({
  origin: env.CORS_ORIGIN,
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400,
}));

// Request size limits (prevent payload DoS)
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: false, limit: '100kb' }));

// Sanitize all string inputs (strip HTML, trim, max length)
app.use(sanitizeBody);

// Global rate limiter: 200 requests per minute per IP
app.use(createRateLimiter({
  windowMs: 60_000,
  maxRequests: 200,
  message: 'Too many requests from this IP. Please slow down.',
}));

// Request logging (does NOT log request bodies which may contain signatures)
app.use(morgan(':method :url :status :response-time ms'));

// ─── Routes ──────────────────────────────────────────────────────────────────

app.use('/api/health', healthRouter);
app.use('/api/blocks', blocksRouter);
app.use('/api/transactions', transactionsRouter);
app.use('/api/accounts', accountsRouter);
app.use('/api/network', networkRouter);
app.use('/api/bridge', bridgeRouter);
app.use('/api/faucet', faucetRouter);
app.use('/api/solana', solanaRouter);
app.use('/api/explorer', explorerRouter);
app.use('/api/rpc', rpcRouter);

// ─── Error Handler ───────────────────────────────────────────────────────────

app.use(errorHandler);
