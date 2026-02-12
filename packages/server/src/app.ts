import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import { typeDefs } from './graphql/typeDefs';
import { resolvers } from './graphql/resolvers';
import { projectRoutes } from './routes/projects';
import { ruleSetRoutes } from './routes/ruleSets';
import { ruleRoutes } from './routes/rules';
import { decisionTableRoutes } from './routes/decisionTables';
import { dataModelRoutes } from './routes/dataModels';
import { executeRoutes } from './routes/execute';
import { dashboardRoutes } from './routes/dashboard';
import { queueRoutes } from './routes/queue';
import { versionRoutes } from './routes/versions';
import { prisma } from './prisma';

export async function createApp() {
  const app = express();

  // Middleware
  app.use(cors());
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(morgan('dev'));
  app.use(express.json({ limit: '10mb' }));

  // Health check
  app.get('/api/v1/health', (_req, res) => {
    res.json({ status: 'ok', service: 'soa-one', timestamp: new Date().toISOString() });
  });

  // REST API routes
  app.use('/api/v1/projects', projectRoutes);
  app.use('/api/v1/rule-sets', ruleSetRoutes);
  app.use('/api/v1/rules', ruleRoutes);
  app.use('/api/v1/decision-tables', decisionTableRoutes);
  app.use('/api/v1/data-models', dataModelRoutes);
  app.use('/api/v1/execute', executeRoutes);
  app.use('/api/v1/dashboard', dashboardRoutes);
  app.use('/api/v1/queue', queueRoutes);
  app.use('/api/v1/versions', versionRoutes);

  // GraphQL
  const apollo = new ApolloServer({ typeDefs, resolvers });
  await apollo.start();
  app.use(
    '/graphql',
    expressMiddleware(apollo, {
      context: async () => ({ prisma }),
    }),
  );

  // Error handler
  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'Internal server error' });
  });

  return app;
}
