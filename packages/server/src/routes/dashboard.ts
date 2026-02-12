import { Router } from 'express';
import { prisma } from '../prisma';
import { safeJsonParse } from '../utils/validation';

export const dashboardRoutes = Router();

// Get dashboard overview stats (V4: includes V3+V4 metrics)
dashboardRoutes.get('/stats', async (_req, res) => {
  const [
    projectCount,
    ruleSetCount,
    ruleCount,
    tableCount,
    totalExecutions,
    recentExecutions,
    workflowCount,
    adapterCount,
    templateCount,
    pendingApprovals,
    scheduledJobCount,
    simulationCount,
    unreadNotifications,
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
    prisma.workflow.count(),
    prisma.adapter.count(),
    prisma.template.count(),
    prisma.approvalRequest.count({ where: { status: 'pending' } }),
    prisma.scheduledJob.count({ where: { enabled: true } }),
    prisma.simulationRun.count(),
    prisma.notification.count({ where: { read: false } }),
  ]);

  // Compute aggregate stats
  const successCount = recentExecutions.filter((e) => e.status === 'success').length;
  const errorCount = recentExecutions.filter((e) => e.status === 'error').length;
  const avgExecutionTime =
    recentExecutions.length > 0
      ? Math.round(recentExecutions.reduce((sum, e) => sum + e.executionTimeMs, 0) / recentExecutions.length)
      : 0;

  // Top rule sets by execution count
  const topRuleSetsRaw = await prisma.executionLog.groupBy({
    by: ['ruleSetId'],
    _count: { id: true },
    orderBy: { _count: { id: 'desc' } },
    take: 5,
  });
  const topRuleSetIds = topRuleSetsRaw.map((r) => r.ruleSetId);
  const topRuleSetNames = await prisma.ruleSet.findMany({
    where: { id: { in: topRuleSetIds } },
    select: { id: true, name: true },
  });
  const nameMap = Object.fromEntries(topRuleSetNames.map((r) => [r.id, r.name]));
  const topRuleSets = topRuleSetsRaw.map((r) => ({
    name: nameMap[r.ruleSetId] || r.ruleSetId,
    count: r._count.id,
  }));

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
    // V3+V4 additions
    workflows: workflowCount,
    adapters: adapterCount,
    templates: templateCount,
    pendingApprovals,
    activeScheduledJobs: scheduledJobCount,
    simulations: simulationCount,
    unreadNotifications,
    topRuleSets,
  });
});

// Get all execution logs (for analytics page)
dashboardRoutes.get('/executions', async (req, res) => {
  const { limit = '100', offset = '0', days = '30' } = req.query;
  const since = new Date();
  since.setDate(since.getDate() - Number(days));

  const executions = await prisma.executionLog.findMany({
    where: { createdAt: { gte: since } },
    take: Number(limit),
    skip: Number(offset),
    orderBy: { createdAt: 'desc' },
    include: { ruleSet: { select: { name: true } } },
  });

  const parsed = executions.map((e) => ({
    ...e,
    input: safeJsonParse(e.input, {}),
    output: safeJsonParse(e.output, {}),
    rulesFired: safeJsonParse(e.rulesFired, []),
  }));

  res.json(parsed);
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
    input: safeJsonParse(e.input, {}),
    output: safeJsonParse(e.output, {}),
    rulesFired: safeJsonParse(e.rulesFired, []),
  }));

  res.json(parsed);
});

// Analytics aggregation endpoint
dashboardRoutes.get('/analytics', async (req, res) => {
  const { days = '30' } = req.query;
  const since = new Date();
  since.setDate(since.getDate() - Number(days));

  const executions = await prisma.executionLog.findMany({
    where: { createdAt: { gte: since } },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      ruleSetId: true,
      executionTimeMs: true,
      status: true,
      createdAt: true,
      ruleSet: { select: { name: true } },
    },
  });

  // Daily aggregation
  const dailyMap = new Map<string, { date: string; executions: number; successes: number; errors: number; totalTimeMs: number }>();
  for (const exec of executions) {
    const day = exec.createdAt.toISOString().split('T')[0];
    const entry = dailyMap.get(day) || { date: day, executions: 0, successes: 0, errors: 0, totalTimeMs: 0 };
    entry.executions++;
    if (exec.status === 'success') entry.successes++;
    else entry.errors++;
    entry.totalTimeMs += exec.executionTimeMs;
    dailyMap.set(day, entry);
  }

  const daily = Array.from(dailyMap.values()).map((d) => ({
    ...d,
    avgTimeMs: d.executions > 0 ? Math.round(d.totalTimeMs / d.executions) : 0,
  }));

  // Top rule sets
  const ruleSetMap = new Map<string, { name: string; count: number }>();
  for (const exec of executions) {
    const name = exec.ruleSet?.name || exec.ruleSetId;
    const entry = ruleSetMap.get(exec.ruleSetId) || { name, count: 0 };
    entry.count++;
    ruleSetMap.set(exec.ruleSetId, entry);
  }
  const topRuleSets = Array.from(ruleSetMap.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Summary
  const totalExecutions = executions.length;
  const successCount = executions.filter((e) => e.status === 'success').length;
  const avgTimeMs = totalExecutions > 0
    ? Math.round(executions.reduce((s, e) => s + e.executionTimeMs, 0) / totalExecutions)
    : 0;
  const activeRules = await prisma.rule.count({ where: { enabled: true } });

  res.json({
    summary: {
      totalExecutions,
      successRate: totalExecutions > 0 ? Math.round((successCount / totalExecutions) * 100) : 100,
      avgTimeMs,
      activeRules,
    },
    daily,
    topRuleSets,
    successBreakdown: {
      success: successCount,
      error: totalExecutions - successCount,
    },
  });
});
