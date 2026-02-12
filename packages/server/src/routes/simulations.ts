import { Router } from 'express';
import { prisma } from '../prisma';
import { executeRuleSet } from '@soa-one/engine';
import type { Rule, DecisionTable } from '@soa-one/engine';

const router = Router();

// ---------------------------------------------------------------------------
// GET / — list simulation runs, optionally filtered by ?ruleSetId
// ---------------------------------------------------------------------------
router.get('/', async (req, res) => {
  try {
    const where: any = {};

    if (req.query.ruleSetId) {
      where.ruleSetId = String(req.query.ruleSetId);
    }

    const runs = await prisma.simulationRun.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    const parsed = runs.map((r) => ({
      ...r,
      dataset: JSON.parse(r.dataset),
      results: r.results ? JSON.parse(r.results) : null,
      stats: r.stats ? JSON.parse(r.stats) : null,
    }));

    res.json(parsed);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// GET /:id — get a single simulation run with results
// ---------------------------------------------------------------------------
router.get('/:id', async (req, res) => {
  try {
    const run = await prisma.simulationRun.findUnique({
      where: { id: req.params.id },
    });

    if (!run) return res.status(404).json({ error: 'Simulation run not found' });

    res.json({
      ...run,
      dataset: JSON.parse(run.dataset),
      results: run.results ? JSON.parse(run.results) : null,
      stats: run.stats ? JSON.parse(run.stats) : null,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// POST / — create and run a simulation
//   Body: { ruleSetId, name, description?, dataset: [{input, expectedOutput?}] }
// ---------------------------------------------------------------------------
router.post('/', async (req, res) => {
  const { ruleSetId, name, description, dataset } = req.body;

  if (!ruleSetId || !name || !dataset || !Array.isArray(dataset)) {
    return res.status(400).json({
      error: 'ruleSetId, name, and dataset (array) are required',
    });
  }

  try {
    // Load the rule set with its rules and decision tables
    const ruleSet = await prisma.ruleSet.findUnique({
      where: { id: ruleSetId },
      include: {
        rules: { orderBy: { priority: 'desc' } },
        decisionTables: true,
      },
    });

    if (!ruleSet) return res.status(404).json({ error: 'Rule set not found' });

    // Create the simulation run in "running" state
    const run = await prisma.simulationRun.create({
      data: {
        ruleSetId,
        name,
        description: description || '',
        dataset: JSON.stringify(dataset),
        status: 'running',
      },
    });

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

    // Execute each test case
    const results: any[] = [];
    let passed = 0;
    let failed = 0;
    let totalExecutionMs = 0;
    const firedRuleIds = new Set<string>();

    for (const testCase of dataset) {
      const execution = executeRuleSet(engineRuleSet, testCase.input);
      totalExecutionMs += execution.executionTimeMs;

      // Track which rules fired for coverage
      for (const ruleId of execution.rulesFired) {
        firedRuleIds.add(ruleId);
      }

      // Determine pass/fail by comparing output to expectedOutput (if provided)
      let match: boolean | null = null;
      if (testCase.expectedOutput !== undefined && testCase.expectedOutput !== null) {
        match = deepEqual(execution.output, testCase.expectedOutput);
        if (match) {
          passed++;
        } else {
          failed++;
        }
      }

      results.push({
        input: testCase.input,
        expectedOutput: testCase.expectedOutput ?? null,
        actualOutput: execution.output,
        match,
        rulesFired: execution.rulesFired,
        executionTimeMs: execution.executionTimeMs,
        success: execution.success,
        error: execution.error,
      });
    }

    // Compute stats
    const totalRules = engineRuleSet.rules.filter((r) => r.enabled).length;
    const coverage = totalRules > 0
      ? Math.round((firedRuleIds.size / totalRules) * 100)
      : 0;

    const stats = {
      total: dataset.length,
      passed,
      failed,
      avgExecutionMs: dataset.length > 0
        ? Math.round(totalExecutionMs / dataset.length)
        : 0,
      coverage,
    };

    // Update the simulation run with results
    const updated = await prisma.simulationRun.update({
      where: { id: run.id },
      data: {
        results: JSON.stringify(results),
        stats: JSON.stringify(stats),
        status: 'completed',
        completedAt: new Date(),
      },
    });

    res.status(201).json({
      ...updated,
      dataset: JSON.parse(updated.dataset),
      results,
      stats,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// DELETE /:id — delete a simulation run
// ---------------------------------------------------------------------------
router.delete('/:id', async (req, res) => {
  try {
    const run = await prisma.simulationRun.findUnique({
      where: { id: req.params.id },
    });

    if (!run) return res.status(404).json({ error: 'Simulation run not found' });

    await prisma.simulationRun.delete({ where: { id: req.params.id } });

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// Utility: deep equality check for comparing expected vs actual output
// ---------------------------------------------------------------------------
function deepEqual(a: any, b: any): boolean {
  if (a === b) return true;
  if (a == null || b == null) return a === b;
  if (typeof a !== typeof b) return false;

  if (Array.isArray(a)) {
    if (!Array.isArray(b) || a.length !== b.length) return false;
    return a.every((val, i) => deepEqual(val, b[i]));
  }

  if (typeof a === 'object') {
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    if (keysA.length !== keysB.length) return false;
    return keysA.every((key) => deepEqual(a[key], b[key]));
  }

  return false;
}

export default router;
