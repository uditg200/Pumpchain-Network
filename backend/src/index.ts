import { createServer } from 'http';
import { app } from './app.js';
import { initWebSocket, closeWebSocket } from './ws/index.js';
import { env } from './config/env.js';
import { createServiceRegistry, startNetwork } from './modules/index.js';

// Create service registry
const registry = createServiceRegistry();

// Attach registry to app for route handlers
app.locals['registry'] = registry;

const server = createServer(app);

// Initialize WebSocket server
initWebSocket(server);

// Start the Pumpchain network (genesis + sequencer)
startNetwork(registry);

server.listen(env.PORT, () => {
  console.log(`[Pumpchain Backend] Server running on port ${env.PORT}`);
  console.log(`[Pumpchain Backend] Network: ${env.PUMPCHAIN_CHAIN_NAME} (${env.PUMPCHAIN_ENVIRONMENT})`);
  console.log(`[Pumpchain Backend] WebSocket ready`);
  console.log(`[Pumpchain Backend] Block interval: 2000ms`);
});

// ─────────────────────────────────────────────────────────────────────────────
// Graceful shutdown
// ─────────────────────────────────────────────────────────────────────────────

async function gracefulShutdown(signal: string): Promise<void> {
  console.log(`\n[Pumpchain Backend] ${signal} received. Shutting down gracefully...`);

  // 1. Stop the sequencer (no new blocks)
  registry.sequencerService.stop();
  console.log('[Shutdown] Sequencer stopped');

  // 2. Close WebSocket connections
  await closeWebSocket();
  console.log('[Shutdown] WebSocket closed');

  // 3. Close HTTP server (stop accepting new connections)
  await new Promise<void>((resolve) => {
    server.close(() => {
      console.log('[Shutdown] HTTP server closed');
      resolve();
    });
  });

  console.log('[Pumpchain Backend] Shutdown complete');
  process.exit(0);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Prevent unhandled rejection from crashing the process
process.on('unhandledRejection', (reason) => {
  console.error('[Pumpchain Backend] Unhandled rejection:', reason);
});
