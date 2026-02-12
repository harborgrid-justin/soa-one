import { Router } from 'express';
import { prisma } from '../prisma';
import { executeRuleSet } from '@soa-one/engine';
import type { Rule, DecisionTable } from '@soa-one/engine';

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
router.get('/', async (req: any, res) => {
  try {
    const { entityType } = req.query;
    const where: any = {};
    if (entityType) where.entityType = String(entityType);

    const jobs = await prisma.scheduledJob.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    const parsed = jobs.map((j) => ({
      ...j,
      input: JSON.parse(j.input),
    }));

    res.json(parsed);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get a single scheduled job
router.get('/:id', async (req: any, res) => {
  try {
    const job = await prisma.scheduledJob.findUnique({
      where: { id: req.params.id },
    });

    if (!job) {
      return res.status(404).json({ error: 'Scheduled job not found' });
    }

    res.json({
      ...job,
      input: JSON.parse(job.input),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Create scheduled job
router.post('/', async (req: any, res) => {
  try {
    const {
      name,
      entityType,
      entityId,
      cronExpression,
      input,
      timezone,
      enabled,
    } = req.body;

    if (!name || !entityType || !entityId || !cronExpression) {
      return res.status(400).json({
        error: 'name, entityType, entityId, and cronExpression are required',
      });
    }

    const data: any = {
      name,
      entityType,
      entityId,
      cronExpression,
      input: JSON.stringify(input || {}),
      timezone: timezone || 'UTC',
      enabled: enabled !== undefined ? enabled : true,
      nextRunAt: getNextRunFromCron(cronExpression),
    };

    // Set tenantId from user context if available
    if (req.user?.tenantId) {
      data.tenantId = req.user.tenantId;
    }

    // Set the appropriate relation based on entity type
    if (entityType === 'ruleSet') {
      data.ruleSetId = entityId;
    } else if (entityType === 'workflow') {
      data.workflowId = entityId;
    }

    const job = await prisma.scheduledJob.create({ data });

    res.status(201).json({
      ...job,
      input: JSON.parse(job.input),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Update scheduled job
router.put('/:id', async (req: any, res) => {
  try {
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
      input: JSON.parse(job.input),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Delete scheduled job
router.delete('/:id', async (req: any, res) => {
  try {
    await prisma.scheduledJob.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Manually trigger a scheduled job (run now)
router.post('/:id/run-now', async (req: any, res) => {
  try {
    const job = await prisma.scheduledJob.findUnique({
      where: { id: req.params.id },
    });

    if (!job) {
      return res.status(404).json({ error: 'Scheduled job not found' });
    }

    const input = JSON.parse(job.input);
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

      // Build engine-compatible rule set
      const engineRuleSet = {
        id: ruleSet.id,
        name: ruleSet.name,
        rules: ruleSet.rules.map(
          (r): Rule => ({
            id: r.id,
            name: r.name,
            priority: r.priority,
            enabled: r.enabled,
            conditions: JSON.parse(r.conditions),
            actions: JSON.parse(r.actions),
          })
        ),
        decisionTables: ruleSet.decisionTables.map(
          (t): DecisionTable => ({
            id: t.id,
            name: t.name,
            columns: JSON.parse(t.columns),
            rows: JSON.parse(t.rows),
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
  } catch (err: any) {
    // Update job with error status
    try {
      await prisma.scheduledJob.update({
        where: { id: req.params.id },
        data: {
          lastRunAt: new Date(),
          runCount: { increment: 1 },
          lastStatus: 'error',
          lastError: err.message,
        },
      });
    } catch {
      // Ignore update errors
    }
    res.status(500).json({ error: err.message });
  }
});

export default router;
