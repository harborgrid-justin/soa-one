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

// ---------------------------------------------------------------------------
// Helper: verify a ruleSetId belongs to the user's tenant via
// ruleSet -> project -> tenant chain.  Returns the ruleSet or null.
// ---------------------------------------------------------------------------
async function verifyRuleSetTenant(ruleSetId: string, tenantId: string) {
  const ruleSet = await prisma.ruleSet.findUnique({
    where: { id: ruleSetId },
    include: {
      project: {
        include: { tenant: true },
      },
    },
  });

  if (!ruleSet) return null;

  // Project must belong to the user's tenant
  if (!ruleSet.project.tenantId || ruleSet.project.tenantId !== tenantId) {
    return null;
  }

  return ruleSet;
}

// ---------------------------------------------------------------------------
// GET / — list simulation runs, optionally filtered by ?ruleSetId
// ---------------------------------------------------------------------------
router.get(
  '/',
  asyncHandler(async (req: any, res) => {
    const tenantId = requireTenantId(req);
    const where: any = {};

    if (req.query.ruleSetId) {
      const ruleSetId = String(req.query.ruleSetId);
      // Verify tenant owns this ruleSet before filtering
      const ruleSet = await verifyRuleSetTenant(ruleSetId, tenantId);
      if (!ruleSet) {
        return res.status(404).json({ error: 'Rule set not found' });
      }
      where.ruleSetId = ruleSetId;
    } else {
      // Only return simulation runs for ruleSets that belong to the tenant
      where.ruleSet = {
        project: {
          tenantId,
        },
      };
    }

    const runs = await prisma.simulationRun.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    const parsed = runs.map((r) => ({
      ...r,
      dataset: safeJsonParse(r.dataset, []),
      results: r.results ? safeJsonParse(r.results, null) : null,
      stats: r.stats ? safeJsonParse(r.stats, null) : null,
    }));

    res.json(parsed);
  }),
);

// ---------------------------------------------------------------------------
// GET /:id — get a single simulation run with results
// ---------------------------------------------------------------------------
router.get(
  '/:id',
  asyncHandler(async (req: any, res) => {
    const tenantId = requireTenantId(req);

    const run = await prisma.simulationRun.findUnique({
      where: { id: req.params.id },
      include: {
        ruleSet: {
          include: {
            project: true,
          },
        },
      },
    });

    if (!run) return res.status(404).json({ error: 'Simulation run not found' });

    // Verify tenant isolation through ruleSet -> project -> tenant
    if (!run.ruleSet.project.tenantId || run.ruleSet.project.tenantId !== tenantId) {
      return res.status(404).json({ error: 'Simulation run not found' });
    }

    res.json({
      ...run,
      ruleSet: undefined, // strip the included relation from the response
      ruleSetId: run.ruleSetId,
      dataset: safeJsonParse(run.dataset, []),
      results: run.results ? safeJsonParse(run.results, null) : null,
      stats: run.stats ? safeJsonParse(run.stats, null) : null,
    });
  }),
);

// ---------------------------------------------------------------------------
// POST / — create and run a simulation
//   Body: { ruleSetId, name, description?, dataset: [{input, expectedOutput?}] }
// ---------------------------------------------------------------------------
router.post(
  '/',
  asyncHandler(async (req: any, res) => {
    const tenantId = requireTenantId(req);
    const { ruleSetId, name, description, dataset } = req.body;

    // Validate required fields
    const missing = validateRequired(req.body, ['ruleSetId', 'name', 'dataset']);
    if (missing) {
      return res.status(400).json({ error: missing });
    }

    if (!Array.isArray(dataset)) {
      return res.status(400).json({ error: 'dataset must be an array' });
    }

    if (dataset.length < 1) {
      return res.status(400).json({ error: 'dataset must contain at least 1 item' });
    }

    // Validate each dataset item has an `input` field
    for (let i = 0; i < dataset.length; i++) {
      if (!dataset[i].input || typeof dataset[i].input !== 'object') {
        return res.status(400).json({
          error: `dataset[${i}] must have an "input" field that is an object`,
        });
      }
    }

    // Verify tenant owns this ruleSet
    const ownerCheck = await verifyRuleSetTenant(ruleSetId, tenantId);
    if (!ownerCheck) {
      return res.status(404).json({ error: 'Rule set not found' });
    }

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

    // Build engine-compatible rule set (matches execute.ts pattern)
    const engineRuleSet = {
      id: ruleSet.id,
      name: ruleSet.name,
      rules: ruleSet.rules.map((r): Rule => ({
        id: r.id,
        name: r.name,
        priority: r.priority,
        enabled: r.enabled,
        conditions: safeJsonParse(r.conditions, {}),
        actions: safeJsonParse(r.actions, []),
      })),
      decisionTables: ruleSet.decisionTables.map((t): DecisionTable => ({
        id: t.id,
        name: t.name,
        columns: safeJsonParse(t.columns, []),
        rows: safeJsonParse(t.rows, []),
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
      try {
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
      } catch (execErr: any) {
        // Individual test case failure should not abort the entire simulation
        results.push({
          input: testCase.input,
          expectedOutput: testCase.expectedOutput ?? null,
          actualOutput: null,
          match: false,
          rulesFired: [],
          executionTimeMs: 0,
          success: false,
          error: execErr.message || 'Execution error',
        });
        failed++;
      }
    }

    // Compute stats
    const totalRules = engineRuleSet.rules.filter((r) => r.enabled).length;
    const coverage =
      totalRules > 0
        ? Math.round((firedRuleIds.size / totalRules) * 100)
        : 0;

    const stats = {
      total: dataset.length,
      passed,
      failed,
      avgExecutionMs:
        dataset.length > 0
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
      dataset: safeJsonParse(updated.dataset, []),
      results,
      stats,
    });
  }),
);

// ---------------------------------------------------------------------------
// DELETE /:id — delete a simulation run
// ---------------------------------------------------------------------------
router.delete(
  '/:id',
  asyncHandler(async (req: any, res) => {
    const tenantId = requireTenantId(req);

    const run = await prisma.simulationRun.findUnique({
      where: { id: req.params.id },
      include: {
        ruleSet: {
          include: {
            project: true,
          },
        },
      },
    });

    if (!run) return res.status(404).json({ error: 'Simulation run not found' });

    // Verify tenant isolation through ruleSet -> project -> tenant
    if (!run.ruleSet.project.tenantId || run.ruleSet.project.tenantId !== tenantId) {
      return res.status(404).json({ error: 'Simulation run not found' });
    }

    await prisma.simulationRun.delete({ where: { id: req.params.id } });

    res.json({ success: true });
  }),
);

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
