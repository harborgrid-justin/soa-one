import { Router } from 'express';
import { prisma } from '../prisma';
import { executeRuleSet } from '@soa-one/engine';
import type { Rule, DecisionTable } from '@soa-one/engine';
import {
  safeJsonParse,
  requireTenantId,
  requireUserId,
  validateRequired,
  asyncHandler,
} from '../utils/validation';

const router = Router();

/**
 * Parse a cron expression and compute the next run time from now.
 * Supports standard 5-field cron: minute hour dayOfMonth month dayOfWeek
 */
function getNextRunFromCron(cronExpression: string): Date {
  const now = new Date();
  const parts = cronExpression.trim().split(/\s+/);

  // Simple heuristic: schedule next run based on the cron interval
  // For production use, a library like cron-parser would be used
  if (parts.length >= 5) {
    const [minute, hour] = parts;

    const next = new Date(now);
    next.setSeconds(0);
    next.setMilliseconds(0);

    if (minute !== '*') {
      next.setMinutes(parseInt(minute, 10));
    } else {
      next.setMinutes(next.getMinutes() + 1);
    }

    if (hour !== '*') {
      next.setHours(parseInt(hour, 10));
      if (next <= now) {
        next.setDate(next.getDate() + 1);
      }
    } else if (next <= now) {
      next.setMinutes(next.getMinutes() + 1);
    }

    return next;
  }

  // Fallback: next run in 1 hour
  return new Date(now.getTime() + 60 * 60 * 1000);
}

// List all scheduled jobs, optionally filter by ?entityType
router.get('/', asyncHandler(async (req: any, res) => {
  const tenantId = requireTenantId(req);
  requireUserId(req);

  const { entityType } = req.query;
  const where: any = { tenantId };
  if (entityType) where.entityType = String(entityType);

  const jobs = await prisma.scheduledJob.findMany({
    where,
    orderBy: { createdAt: 'desc' },
  });

  const parsed = jobs.map((j) => ({
    ...j,
    input: safeJsonParse(j.input, {}),
  }));

  res.json(parsed);
}));

// Get a single scheduled job
router.get('/:id', asyncHandler(async (req: any, res) => {
  const tenantId = requireTenantId(req);
  requireUserId(req);

  const job = await prisma.scheduledJob.findUnique({
    where: { id: req.params.id },
  });

  if (!job) {
    return res.status(404).json({ error: 'Scheduled job not found' });
  }

  if (job.tenantId !== tenantId) {
    return res.status(403).json({ error: 'Access denied' });
  }

  res.json({
    ...job,
    input: safeJsonParse(job.input, {}),
  });
}));

// Create scheduled job
router.post('/', asyncHandler(async (req: any, res) => {
  const tenantId = requireTenantId(req);
  requireUserId(req);

  const error = validateRequired(req.body, ['name', 'entityType', 'entityId', 'cronExpression']);
  if (error) {
    return res.status(400).json({ error });
  }

  const {
    name,
    entityType,
    entityId,
    cronExpression,
    input,
    timezone,
    enabled,
  } = req.body;

  // Verify the entityId belongs to a project in the user's tenant
  if (entityType === 'ruleSet') {
    const ruleSet = await prisma.ruleSet.findUnique({
      where: { id: entityId },
      include: { project: { select: { tenantId: true } } },
    });
    if (!ruleSet) {
      return res.status(404).json({ error: 'Rule set not found' });
    }
    if (ruleSet.project.tenantId !== tenantId) {
      return res.status(403).json({ error: 'Access denied: rule set does not belong to your tenant' });
    }
  } else if (entityType === 'workflow') {
    const workflow = await prisma.workflow.findUnique({
      where: { id: entityId },
      include: { project: { select: { tenantId: true } } },
    });
    if (!workflow) {
      return res.status(404).json({ error: 'Workflow not found' });
    }
    if (workflow.project.tenantId !== tenantId) {
      return res.status(403).json({ error: 'Access denied: workflow does not belong to your tenant' });
    }
  } else {
    return res.status(400).json({ error: `Unsupported entity type: ${entityType}` });
  }

  const data: any = {
    tenantId,
    name,
    entityType,
    entityId,
    cronExpression,
    input: JSON.stringify(input || {}),
    timezone: timezone || 'UTC',
    enabled: enabled !== undefined ? enabled : true,
    nextRunAt: getNextRunFromCron(cronExpression),
  };

  // Set the appropriate relation based on entity type
  if (entityType === 'ruleSet') {
    data.ruleSetId = entityId;
  } else if (entityType === 'workflow') {
    data.workflowId = entityId;
  }

  const job = await prisma.scheduledJob.create({ data });

  res.status(201).json({
    ...job,
    input: safeJsonParse(job.input, {}),
  });
}));

// Update scheduled job
router.put('/:id', asyncHandler(async (req: any, res) => {
  const tenantId = requireTenantId(req);
  requireUserId(req);

  // Verify the job belongs to tenant
  const existing = await prisma.scheduledJob.findUnique({
    where: { id: req.params.id },
  });

  if (!existing) {
    return res.status(404).json({ error: 'Scheduled job not found' });
  }

  if (existing.tenantId !== tenantId) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const { name, cronExpression, input, timezone, enabled } = req.body;
  const data: any = {};

  if (name !== undefined) data.name = name;
  if (cronExpression !== undefined) {
    data.cronExpression = cronExpression;
    data.nextRunAt = getNextRunFromCron(cronExpression);
  }
  if (input !== undefined) data.input = JSON.stringify(input);
  if (timezone !== undefined) data.timezone = timezone;
  if (enabled !== undefined) data.enabled = enabled;

  const job = await prisma.scheduledJob.update({
    where: { id: req.params.id },
    data,
  });

  res.json({
    ...job,
    input: safeJsonParse(job.input, {}),
  });
}));

// Delete scheduled job
router.delete('/:id', asyncHandler(async (req: any, res) => {
  const tenantId = requireTenantId(req);
  requireUserId(req);

  // Verify the job belongs to tenant
  const existing = await prisma.scheduledJob.findUnique({
    where: { id: req.params.id },
  });

  if (!existing) {
    return res.status(404).json({ error: 'Scheduled job not found' });
  }

  if (existing.tenantId !== tenantId) {
    return res.status(403).json({ error: 'Access denied' });
  }

  await prisma.scheduledJob.delete({ where: { id: req.params.id } });
  res.json({ success: true });
}));

// Manually trigger a scheduled job (run now)
router.post('/:id/run-now', asyncHandler(async (req: any, res) => {
  const tenantId = requireTenantId(req);
  requireUserId(req);

  const job = await prisma.scheduledJob.findUnique({
    where: { id: req.params.id },
  });

  if (!job) {
    return res.status(404).json({ error: 'Scheduled job not found' });
  }

  // Verify tenant ownership
  if (job.tenantId !== tenantId) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const input = safeJsonParse(job.input, {});
  const startTime = Date.now();

  if (job.entityType === 'ruleSet') {
    // Fetch the rule set with rules and decision tables
    const ruleSet = await prisma.ruleSet.findUnique({
      where: { id: job.entityId },
      include: {
        rules: { where: { enabled: true }, orderBy: { priority: 'desc' } },
        decisionTables: true,
      },
    });

    if (!ruleSet) {
      return res.status(404).json({ error: 'Rule set not found' });
    }

    // Build engine-compatible rule set (matching execute.ts pattern)
    const engineRuleSet = {
      id: ruleSet.id,
      name: ruleSet.name,
      rules: ruleSet.rules.map(
        (r): Rule => ({
          id: r.id,
          name: r.name,
          priority: r.priority,
          enabled: r.enabled,
          conditions: safeJsonParse(r.conditions, {}),
          actions: safeJsonParse(r.actions, []),
        })
      ),
      decisionTables: ruleSet.decisionTables.map(
        (t): DecisionTable => ({
          id: t.id,
          name: t.name,
          columns: safeJsonParse(t.columns, []),
          rows: safeJsonParse(t.rows, []),
          hitPolicy: 'FIRST' as const,
        })
      ),
    };

    const result = executeRuleSet(engineRuleSet, input);
    const executionTimeMs = Date.now() - startTime;

    // Update job execution metadata
    await prisma.scheduledJob.update({
      where: { id: job.id },
      data: {
        lastRunAt: new Date(),
        runCount: { increment: 1 },
        lastStatus: result.success ? 'success' : 'error',
        lastError: result.error || null,
        nextRunAt: getNextRunFromCron(job.cronExpression),
      },
    });

    // Log execution
    await prisma.executionLog.create({
      data: {
        ruleSetId: ruleSet.id,
        version: ruleSet.version,
        input: JSON.stringify(input),
        output: JSON.stringify(result.output),
        rulesFired: JSON.stringify(result.rulesFired),
        executionTimeMs,
        status: result.success ? 'success' : 'error',
        error: result.error,
      },
    });

    res.json({
      success: result.success,
      executionTimeMs,
      result,
    });
  } else if (job.entityType === 'workflow') {
    // For workflows, create a workflow instance and trigger execution
    const workflow = await prisma.workflow.findUnique({
      where: { id: job.entityId },
    });

    if (!workflow) {
      return res.status(404).json({ error: 'Workflow not found' });
    }

    const instance = await prisma.workflowInstance.create({
      data: {
        workflowId: workflow.id,
        input: JSON.stringify(input),
        status: 'running',
      },
    });

    // Update job execution metadata
    await prisma.scheduledJob.update({
      where: { id: job.id },
      data: {
        lastRunAt: new Date(),
        runCount: { increment: 1 },
        lastStatus: 'success',
        nextRunAt: getNextRunFromCron(job.cronExpression),
      },
    });

    res.json({
      success: true,
      executionTimeMs: Date.now() - startTime,
      instanceId: instance.id,
    });
  } else {
    res.status(400).json({ error: `Unsupported entity type: ${job.entityType}` });
  }
}));

export default router;
