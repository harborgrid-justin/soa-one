import dotenv from 'dotenv';
dotenv.config();

import { createApp } from './app';
import { prisma } from './prisma';
import { startQueueConsumer } from './queue/consumer';

const PORT = process.env.PORT || 4000;

async function main() {
  const app = await createApp();

  // Start the message queue consumer
  startQueueConsumer();

  app.listen(PORT, () => {
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

main().catch((err) => {
  console.error('Failed to start server:', err);
  prisma.$disconnect();
  process.exit(1);
});
