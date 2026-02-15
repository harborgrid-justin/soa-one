import { config } from 'dotenv';
import { defineConfig } from 'prisma/config';

// Load environment variables
config();

export default defineConfig({
  schema: './prisma/schema.prisma',
  datasource: {
    url: process.env.DATABASE_URL || 'file:./prisma/dev.db',
  },
});
