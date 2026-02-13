import dotenv from 'dotenv';
dotenv.config();

import { createApp } from './app';
import { prisma } from './prisma';
import { startQueueConsumer } from './queue/consumer';
import type { Server } from 'http';

const PORT = process.env.PORT || 4000;

let server: Server;

async function main() {
  const app = await createApp();

  // Start the message queue consumer
  startQueueConsumer();

  // Enhanced health check is mounted in app.ts — start listening
  server = app.listen(PORT, () => {
    console.log(`
  ╔══════════════════════════════════════════╗
  ║         SOA One — Rules Platform         ║
  ╠══════════════════════════════════════════╣
  ║  REST API:   http://localhost:${PORT}/api/v1  ║
  ║  GraphQL:    http://localhost:${PORT}/graphql  ║
  ║  Health:     http://localhost:${PORT}/api/v1/health ║
  ╚══════════════════════════════════════════╝
    `);
  });
}

// ────────────────────────────────────────────
// Graceful Shutdown
// ────────────────────────────────────────────

let isShuttingDown = false;

/**
 * Graceful shutdown handler for SIGTERM/SIGINT signals.
 * 1. Stops accepting new connections
 * 2. Waits for in-flight requests to complete (up to 30s)
 * 3. Closes database connection pool
 * 4. Exits cleanly
 */
async function gracefulShutdown(signal: string) {
  if (isShuttingDown) return;
  isShuttingDown = true;

  console.log(`\n[shutdown] Received ${signal}. Starting graceful shutdown...`);

  // Stop accepting new connections
  if (server) {
    server.close((err) => {
      if (err) {
        console.error('[shutdown] Error closing HTTP server:', err);
      } else {
        console.log('[shutdown] HTTP server closed — no longer accepting connections');
      }
    });
  }

  // Allow in-flight requests up to 30 seconds to complete
  const forceShutdownTimeout = setTimeout(() => {
    console.error('[shutdown] Forced shutdown after 30s timeout');
    process.exit(1);
  }, 30_000);

  try {
    // Disconnect Prisma database connection pool
    await prisma.$disconnect();
    console.log('[shutdown] Database connections closed');
  } catch (err) {
    console.error('[shutdown] Error disconnecting database:', err);
  }

  clearTimeout(forceShutdownTimeout);
  console.log('[shutdown] Graceful shutdown complete');
  process.exit(0);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Catch unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error(JSON.stringify({
    level: 'error',
    event: 'unhandledRejection',
    reason: reason instanceof Error ? reason.message : String(reason),
    stack: reason instanceof Error ? reason.stack : undefined,
    timestamp: new Date().toISOString(),
  }));
});

// Catch uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error(JSON.stringify({
    level: 'fatal',
    event: 'uncaughtException',
    message: err.message,
    stack: err.stack,
    timestamp: new Date().toISOString(),
  }));
  // Exit after logging — let the process manager restart
  process.exit(1);
});

main().catch((err) => {
  console.error('Failed to start server:', err);
  prisma.$disconnect();
  process.exit(1);
});
