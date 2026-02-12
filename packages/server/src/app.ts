import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import { typeDefs } from './graphql/typeDefs';
import { resolvers } from './graphql/resolvers';
import { authMiddleware, type AuthRequest } from './auth/middleware';
import { authRoutes } from './routes/auth';
import { projectRoutes } from './routes/projects';
import { ruleSetRoutes } from './routes/ruleSets';
import { ruleRoutes } from './routes/rules';
import { decisionTableRoutes } from './routes/decisionTables';
import { dataModelRoutes } from './routes/dataModels';
import { executeRoutes } from './routes/execute';
import { dashboardRoutes } from './routes/dashboard';
import { queueRoutes } from './routes/queue';
import { versionRoutes } from './routes/versions';
import { workflowRoutes } from './routes/workflows';
import { adapterRoutes } from './routes/adapters';
import { auditRoutes } from './routes/audit';
import { tenantRoutes } from './routes/tenants';
import { prisma } from './prisma';

export async function createApp() {
  const app = express();

  // Middleware
  app.use(cors());
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(morgan('dev'));
  app.use(express.json({ limit: '10mb' }));

  // Auth middleware (extracts user from JWT, dev fallback)
  app.use(authMiddleware as any);

  // Health check
  app.get('/api/v1/health', (_req, res) => {
    res.json({ status: 'ok', service: 'soa-one', version: '2.0.0', timestamp: new Date().toISOString() });
  });

  // Auth routes (login/register)
  app.use('/api/v1/auth', authRoutes);

  // Core API routes (v1)
  app.use('/api/v1/projects', projectRoutes);
  app.use('/api/v1/rule-sets', ruleSetRoutes);
  app.use('/api/v1/rules', ruleRoutes);
  app.use('/api/v1/decision-tables', decisionTableRoutes);
  app.use('/api/v1/data-models', dataModelRoutes);
  app.use('/api/v1/execute', executeRoutes);
  app.use('/api/v1/dashboard', dashboardRoutes);
  app.use('/api/v1/queue', queueRoutes);
  app.use('/api/v1/versions', versionRoutes);

  // V2 routes
  app.use('/api/v1/workflows', workflowRoutes);
  app.use('/api/v1/adapters', adapterRoutes);
  app.use('/api/v1/audit', auditRoutes);
  app.use('/api/v1/tenants', tenantRoutes);

  // GraphQL
  const apollo = new ApolloServer({ typeDefs, resolvers });
  await apollo.start();
  app.use(
    '/graphql',
    expressMiddleware(apollo, {
      context: async ({ req }) => ({
        prisma,
        user: (req as AuthRequest).user,
      }),
    }),
  );

  // Error handler
  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'Internal server error' });
  });

  return app;
}
