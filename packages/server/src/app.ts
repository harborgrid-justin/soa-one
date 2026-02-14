import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import { typeDefs } from './graphql/typeDefs';
import { resolvers } from './graphql/resolvers';
import { authMiddleware, type AuthRequest } from './auth/middleware';
import { apiRateLimiter, authRateLimiter, executionRateLimiter } from './middleware/rateLimiter';
import { requestIdMiddleware } from './middleware/requestId';
import { globalErrorHandler } from './middleware/errorHandler';
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
// V3 routes
import notificationRoutes from './routes/notifications';
import simulationRoutes from './routes/simulations';
import versionDiffRoutes from './routes/versionDiff';
import conflictRoutes from './routes/conflicts';
// V4 routes
import approvalRoutes from './routes/approvals';
import apiKeyRoutes from './routes/apiKeys';
import scheduledJobRoutes from './routes/scheduledJobs';
import templateRoutes from './routes/templates';
import complianceRoutes from './routes/compliance';
import importExportRoutes from './routes/importExport';
// V7 routes
import environmentRoutes from './routes/environments';
import functionRoutes from './routes/functions';
import decisionTraceRoutes from './routes/decisionTrace';
import permissionRoutes from './routes/permissions';
import reportRoutes from './routes/reports';
import batchExecuteRoutes from './routes/batchExecute';
// V8 routes
import copilotRoutes from './routes/copilot';
import abTestRoutes from './routes/abTests';
import impactAnalysisRoutes from './routes/impactAnalysis';
import debuggerRoutes from './routes/debugger';
import replayRoutes from './routes/replay';
import compliancePackRoutes from './routes/compliancePacks';
// V9: ESB routes
import esbRoutes from './routes/esb';
// V10: CMS routes
import cmsRoutes from './routes/cms';
// V11: Integration status route
import integrationRoutes from './routes/integration';
import { prisma } from './prisma';
import { openApiSpec } from './openapi';

export async function createApp() {
  const app = express();

  // Request ID — must be first to enable correlation across all middleware
  app.use(requestIdMiddleware);

  // Middleware — production-hardened
  const isProduction = process.env.NODE_ENV === 'production';

  app.use(cors({
    origin: isProduction
      ? (process.env.CORS_ORIGIN || 'https://app.soaone.com').split(',')
      : true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'X-Request-ID'],
    maxAge: 86400,
  }));

  app.use(helmet({
    contentSecurityPolicy: isProduction ? undefined : false,
    hsts: isProduction ? { maxAge: 31536000, includeSubDomains: true, preload: true } : false,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  }));

  app.use(morgan(isProduction ? 'combined' : 'dev'));
  app.use(express.json({ limit: '10mb' }));

  // Disable technology fingerprinting
  app.disable('x-powered-by');

  // Rate limiting (applied before auth to protect against brute force)
  if (isProduction) {
    app.use('/api/v1/', apiRateLimiter);
  }

  // Auth middleware (extracts user from JWT, dev fallback)
  app.use(authMiddleware as any);

  // Liveness probe — lightweight, always responds if process is running
  app.get('/api/v1/health', (_req, res) => {
    res.json({ status: 'ok', service: 'soa-one', version: '8.0.0', timestamp: new Date().toISOString() });
  });

  // Readiness probe — verifies database connectivity and module integration
  app.get('/api/v1/health/ready', async (_req, res) => {
    const { isIntegrationReady } = await import('./services/integration');
    try {
      await prisma.$queryRaw`SELECT 1`;
      res.json({
        status: 'ready',
        service: 'soa-one',
        version: '8.0.0',
        checks: {
          database: { status: 'up' },
          integration: { status: isIntegrationReady() ? 'up' : 'down' },
        },
        timestamp: new Date().toISOString(),
      });
    } catch (err: any) {
      res.status(503).json({
        status: 'not_ready',
        service: 'soa-one',
        version: '8.0.0',
        checks: {
          database: { status: 'down', error: err.message },
          integration: { status: isIntegrationReady() ? 'up' : 'down' },
        },
        timestamp: new Date().toISOString(),
      });
    }
  });

  // OpenAPI specification endpoint — machine-readable API documentation
  app.get('/api/v1/openapi.json', (_req, res) => {
    res.json(openApiSpec);
  });

  // Auth routes (login/register) — with stricter rate limit
  app.use('/api/v1/auth', authRateLimiter, authRoutes);

  // Core API routes (v1)
  app.use('/api/v1/projects', projectRoutes);
  app.use('/api/v1/rule-sets', ruleSetRoutes);
  app.use('/api/v1/rules', ruleRoutes);
  app.use('/api/v1/decision-tables', decisionTableRoutes);
  app.use('/api/v1/data-models', dataModelRoutes);
  app.use('/api/v1/execute', executionRateLimiter, executeRoutes);
  app.use('/api/v1/dashboard', dashboardRoutes);
  app.use('/api/v1/queue', queueRoutes);
  app.use('/api/v1/versions', versionRoutes);

  // V2 routes
  app.use('/api/v1/workflows', workflowRoutes);
  app.use('/api/v1/adapters', adapterRoutes);
  app.use('/api/v1/audit', auditRoutes);
  app.use('/api/v1/tenants', tenantRoutes);

  // V3 routes
  app.use('/api/v1/notifications', notificationRoutes);
  app.use('/api/v1/simulations', simulationRoutes);
  app.use('/api/v1/version-diff', versionDiffRoutes);
  app.use('/api/v1/conflicts', conflictRoutes);

  // V4 routes
  app.use('/api/v1/approvals', approvalRoutes);
  app.use('/api/v1/api-keys', apiKeyRoutes);
  app.use('/api/v1/scheduled-jobs', scheduledJobRoutes);
  app.use('/api/v1/templates', templateRoutes);
  app.use('/api/v1/compliance', complianceRoutes);
  app.use('/api/v1/import-export', importExportRoutes);

  // V7 routes
  app.use('/api/v1/environments', environmentRoutes);
  app.use('/api/v1/functions', functionRoutes);
  app.use('/api/v1/decision-trace', decisionTraceRoutes);
  app.use('/api/v1/permissions', permissionRoutes);
  app.use('/api/v1/reports', reportRoutes);
  app.use('/api/v1/batch', batchExecuteRoutes);

  // V8 routes
  app.use('/api/v1/copilot', copilotRoutes);
  app.use('/api/v1/ab-tests', abTestRoutes);
  app.use('/api/v1/impact-analysis', impactAnalysisRoutes);
  app.use('/api/v1/debugger', debuggerRoutes);
  app.use('/api/v1/replay', replayRoutes);
  app.use('/api/v1/compliance-packs', compliancePackRoutes);

  // V9: ESB routes
  app.use('/api/v1/esb', esbRoutes);

  // V10: CMS routes
  app.use('/api/v1/cms', cmsRoutes);

  // V11: Integration status (Engine ⇄ ESB ⇄ CMS)
  app.use('/api/v1/integration', integrationRoutes);

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

  // Global error handler — structured errors with request ID correlation
  app.use(globalErrorHandler);

  return app;
}
