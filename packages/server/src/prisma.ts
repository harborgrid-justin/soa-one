import { PrismaClient } from '@prisma/client';
import { PrismaLibSql } from '@prisma/adapter-libsql';
import path from 'path';

// Resolve database path relative to the server package directory
const serverRoot = path.resolve(__dirname, '..');
let dbPath: string;

if (process.env.DATABASE_URL) {
  // Handle the DATABASE_URL from .env
  const envPath = process.env.DATABASE_URL.replace('file:', '');
  dbPath = path.isAbsolute(envPath) ? envPath : path.join(serverRoot, envPath);
} else {
  dbPath = path.join(serverRoot, 'prisma', 'dev.db');
}

// Ensure file:// protocol with proper path handling for Windows
const url = `file:${path.resolve(dbPath).replace(/\\/g, '/')}`;

console.log('[Prisma] Database URL:', url);

const adapter = new PrismaLibSql({
  url,
});

export const prisma = new PrismaClient({
  adapter,
  log: ['error', 'warn'],
});
