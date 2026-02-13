import { prisma } from '../prisma';
import { executeRuleSet } from '@soa-one/engine';
import type { Rule, DecisionTable } from '@soa-one/engine';

const POLL_INTERVAL = 2000; // 2 seconds

/**
 * Database-backed message queue consumer.
 * Polls for pending jobs and processes them.
 * For production scale, replace with BullMQ + Redis.
 */
export function startQueueConsumer() {
  console.log('  Queue consumer started (poll interval: 2s)');

  setInterval(async () => {
    try {
      // Find next pending job
      const job = await prisma.queueJob.findFirst({
        where: { status: 'pending', queue: 'rule-execution' },
        orderBy: { createdAt: 'asc' },
      });

      if (!job) return;

      // Mark as processing
      await prisma.queueJob.update({
        where: { id: job.id },
        data: { status: 'processing', attempts: job.attempts + 1 },
      });

      const payload = JSON.parse(job.payload);

      try {
        // Load rule set
        const ruleSet = await prisma.ruleSet.findUnique({
          where: { id: payload.ruleSetId },
          include: {
            rules: { where: { enabled: true }, orderBy: { priority: 'desc' } },
            decisionTables: true,
          },
        });

        if (!ruleSet) throw new Error('Rule set not found');

        const engineRuleSet = {
          id: ruleSet.id,
          name: ruleSet.name,
          rules: ruleSet.rules.map((r): Rule => ({
            id: r.id,
            name: r.name,
            priority: r.priority,
            enabled: r.enabled,
            conditions: JSON.parse(r.conditions),
            actions: JSON.parse(r.actions),
          })),
          decisionTables: ruleSet.decisionTables.map((t): DecisionTable => ({
            id: t.id,
            name: t.name,
            columns: JSON.parse(t.columns),
            rows: JSON.parse(t.rows),
            hitPolicy: 'FIRST' as const,
          })),
        };

        const result = executeRuleSet(engineRuleSet, payload.input);

        // Log execution
        await prisma.executionLog.create({
          data: {
            ruleSetId: payload.ruleSetId,
            version: ruleSet.version,
            input: JSON.stringify(payload.input),
            output: JSON.stringify(result.output),
            rulesFired: JSON.stringify(result.rulesFired),
            executionTimeMs: result.executionTimeMs,
            status: result.success ? 'success' : 'error',
            error: result.error,
          },
        });

        // Mark job completed
        await prisma.queueJob.update({
          where: { id: job.id },
          data: {
            status: 'completed',
            result: JSON.stringify(result),
            completedAt: new Date(),
          },
        });

        // Call webhook if provided
        if (payload.callbackUrl) {
          fetch(payload.callbackUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ jobId: job.id, result }),
          }).catch(() => {});
        }
      } catch (err: any) {
        const shouldRetry = job.attempts + 1 < job.maxAttempts;
        await prisma.queueJob.update({
          where: { id: job.id },
          data: {
            status: shouldRetry ? 'pending' : 'failed',
            error: err.message,
          },
        });
      }
    } catch (err) {
      // Silent fail on poll errors
    }
  }, POLL_INTERVAL);
}
