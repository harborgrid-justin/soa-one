import { Router } from 'express';
import { prisma } from '../prisma';

export const dashboardRoutes = Router();

// Get dashboard overview stats
dashboardRoutes.get('/stats', async (_req, res) => {
  const [
    projectCount,
    ruleSetCount,
    ruleCount,
    tableCount,
    totalExecutions,
    recentExecutions,
  ] = await Promise.all([
    prisma.project.count(),
    prisma.ruleSet.count(),
    prisma.rule.count(),
    prisma.decisionTable.count(),
    prisma.executionLog.count(),
    prisma.executionLog.findMany({
      take: 50,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        ruleSetId: true,
        version: true,
        executionTimeMs: true,
        status: true,
        createdAt: true,
        ruleSet: { select: { name: true } },
      },
    }),
  ]);

  // Compute aggregate stats
  const successCount = recentExecutions.filter((e) => e.status === 'success').length;
  const errorCount = recentExecutions.filter((e) => e.status === 'error').length;
  const avgExecutionTime =
    recentExecutions.length > 0
      ? Math.round(recentExecutions.reduce((sum, e) => sum + e.executionTimeMs, 0) / recentExecutions.length)
      : 0;

  res.json({
    projects: projectCount,
    ruleSets: ruleSetCount,
    rules: ruleCount,
    decisionTables: tableCount,
    totalExecutions,
    recentExecutions,
    successRate: recentExecutions.length > 0 ? Math.round((successCount / recentExecutions.length) * 100) : 100,
    errorCount,
    avgExecutionTimeMs: avgExecutionTime,
  });
});

// Get execution logs for a specific rule set
dashboardRoutes.get('/executions/:ruleSetId', async (req, res) => {
  const { ruleSetId } = req.params;
  const { limit = '50', offset = '0' } = req.query;

  const executions = await prisma.executionLog.findMany({
    where: { ruleSetId },
    take: Number(limit),
    skip: Number(offset),
    orderBy: { createdAt: 'desc' },
  });

  const parsed = executions.map((e) => ({
    ...e,
    input: JSON.parse(e.input),
    output: JSON.parse(e.output),
    rulesFired: JSON.parse(e.rulesFired),
  }));

  res.json(parsed);
});
