import { Router } from 'express';
import { prisma } from '../prisma';
import { executeRuleSet as runEngine } from '@soa-one/engine';
import type { Rule, DecisionTable } from '@soa-one/engine';

export const executeRoutes = Router();

// Execute a rule set synchronously via REST
executeRoutes.post('/:ruleSetId', async (req, res) => {
  const { ruleSetId } = req.params;
  const input = req.body;

  if (!input || typeof input !== 'object') {
    return res.status(400).json({ error: 'Request body must be a JSON object' });
  }

  try {
    const ruleSet = await prisma.ruleSet.findUnique({
      where: { id: ruleSetId },
      include: {
        rules: { where: { enabled: true }, orderBy: { priority: 'desc' } },
        decisionTables: true,
      },
    });

    if (!ruleSet) return res.status(404).json({ error: 'Rule set not found' });
    if (ruleSet.status !== 'published') {
      return res.status(400).json({ error: 'Rule set must be published before execution' });
    }

    // Build engine-compatible rule set
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

    const result = runEngine(engineRuleSet, input);

    // Log execution
    await prisma.executionLog.create({
      data: {
        ruleSetId,
        version: ruleSet.version,
        input: JSON.stringify(input),
        output: JSON.stringify(result.output),
        rulesFired: JSON.stringify(result.rulesFired),
        executionTimeMs: result.executionTimeMs,
        status: result.success ? 'success' : 'error',
        error: result.error,
      },
    });

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Test execution (doesn't log, doesn't require published status)
executeRoutes.post('/:ruleSetId/test', async (req, res) => {
  const { ruleSetId } = req.params;
  const input = req.body;

  try {
    const ruleSet = await prisma.ruleSet.findUnique({
      where: { id: ruleSetId },
      include: {
        rules: { orderBy: { priority: 'desc' } },
        decisionTables: true,
      },
    });

    if (!ruleSet) return res.status(404).json({ error: 'Rule set not found' });

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

    const result = runEngine(engineRuleSet, input);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
