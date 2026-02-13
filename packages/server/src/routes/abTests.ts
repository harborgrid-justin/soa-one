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
// Helper: verify an A/B test belongs to the tenant via ruleSet -> project
// ---------------------------------------------------------------------------
async function verifyTestTenant(testId: string, tenantId: string) {
  const test = await prisma.aBTest.findUnique({
    where: { id: testId },
  });

  if (!test) return null;
  if (test.tenantId !== tenantId) return null;
  return test;
}

/**
 * Build an engine-compatible rule set from a RuleSetVersion snapshot.
 */
function buildEngineRuleSetFromSnapshot(snapshot: any): any {
  const rules = (snapshot.rules || []).map((r: any): Rule => ({
    id: r.id,
    name: r.name,
    priority: r.priority ?? 0,
    enabled: r.enabled !== false,
    conditions: typeof r.conditions === 'string' ? JSON.parse(r.conditions) : r.conditions,
    actions: typeof r.actions === 'string' ? JSON.parse(r.actions) : r.actions,
  }));

  const decisionTables = (snapshot.decisionTables || []).map((t: any): DecisionTable => ({
    id: t.id,
    name: t.name,
    columns: typeof t.columns === 'string' ? JSON.parse(t.columns) : (t.columns || []),
    rows: typeof t.rows === 'string' ? JSON.parse(t.rows) : (t.rows || []),
    hitPolicy: 'FIRST' as const,
  }));

  return {
    id: snapshot.id || 'snapshot',
    name: snapshot.name || 'Snapshot',
    rules,
    decisionTables,
  };
}

/**
 * Load a versioned rule set (either from a snapshot or the live rules).
 */
async function loadVersionedRuleSet(ruleSetId: string, version: number) {
  // Try to find a version snapshot first
  const versionRecord = await prisma.ruleSetVersion.findFirst({
    where: { ruleSetId, version },
  });

  if (versionRecord) {
    const snapshot = safeJsonParse(versionRecord.snapshot, null);
    if (snapshot) {
      return buildEngineRuleSetFromSnapshot(snapshot);
    }
  }

  // Fallback: load the live rules (for version matching current)
  const ruleSet = await prisma.ruleSet.findUnique({
    where: { id: ruleSetId },
    include: {
      rules: { where: { enabled: true }, orderBy: { priority: 'desc' } },
      decisionTables: true,
    },
  });

  if (!ruleSet) return null;

  return {
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
}

// ---------------------------------------------------------------------------
// GET / — list A/B tests for tenant
// ---------------------------------------------------------------------------
router.get(
  '/',
  asyncHandler(async (req: any, res) => {
    const tenantId = requireTenantId(req);

    const where: any = { tenantId };

    if (req.query.ruleSetId) {
      where.ruleSetId = String(req.query.ruleSetId);
    }
    if (req.query.status) {
      where.status = String(req.query.status);
    }

    const tests = await prisma.aBTest.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    const parsed = tests.map((t) => ({
      ...t,
      metrics: safeJsonParse(t.metrics, {}),
    }));

    res.json(parsed);
  }),
);

// ---------------------------------------------------------------------------
// GET /:id — get single A/B test with metrics
// ---------------------------------------------------------------------------
router.get(
  '/:id',
  asyncHandler(async (req: any, res) => {
    const tenantId = requireTenantId(req);

    const test = await verifyTestTenant(req.params.id, tenantId);
    if (!test) {
      return res.status(404).json({ error: 'A/B test not found' });
    }

    res.json({
      ...test,
      metrics: safeJsonParse(test.metrics, {}),
    });
  }),
);

// ---------------------------------------------------------------------------
// POST / — create a new A/B test
// ---------------------------------------------------------------------------
router.post(
  '/',
  asyncHandler(async (req: any, res) => {
    const tenantId = requireTenantId(req);
    requireUserId(req);

    const error = validateRequired(req.body, ['ruleSetId', 'name', 'variantA', 'variantB']);
    if (error) {
      return res.status(400).json({ error });
    }

    const { ruleSetId, name, description, variantA, variantB, splitRatio } = req.body;

    // Verify the rule set exists and belongs to tenant
    const ruleSet = await prisma.ruleSet.findUnique({
      where: { id: ruleSetId },
      include: { project: true },
    });

    if (!ruleSet || !ruleSet.project.tenantId || ruleSet.project.tenantId !== tenantId) {
      return res.status(404).json({ error: 'Rule set not found' });
    }

    const test = await prisma.aBTest.create({
      data: {
        tenantId,
        ruleSetId,
        name,
        description: description || '',
        variantA: String(variantA),
        variantB: String(variantB),
        splitRatio: splitRatio != null ? Number(splitRatio) : 50,
        status: 'draft',
        metrics: JSON.stringify({
          variantA: { executions: 0, successes: 0, failures: 0, avgTimeMs: 0, totalTimeMs: 0 },
          variantB: { executions: 0, successes: 0, failures: 0, avgTimeMs: 0, totalTimeMs: 0 },
        }),
      },
    });

    res.status(201).json({
      ...test,
      metrics: safeJsonParse(test.metrics, {}),
    });
  }),
);

// ---------------------------------------------------------------------------
// PUT /:id/start — start the A/B test
// ---------------------------------------------------------------------------
router.put(
  '/:id/start',
  asyncHandler(async (req: any, res) => {
    const tenantId = requireTenantId(req);
    requireUserId(req);

    const test = await verifyTestTenant(req.params.id, tenantId);
    if (!test) {
      return res.status(404).json({ error: 'A/B test not found' });
    }

    if (test.status !== 'draft' && test.status !== 'paused') {
      return res.status(400).json({ error: `Cannot start a test with status "${test.status}"` });
    }

    const updated = await prisma.aBTest.update({
      where: { id: req.params.id },
      data: {
        status: 'running',
        startedAt: test.startedAt || new Date(),
      },
    });

    res.json({
      ...updated,
      metrics: safeJsonParse(updated.metrics, {}),
    });
  }),
);

// ---------------------------------------------------------------------------
// PUT /:id/pause — pause the A/B test
// ---------------------------------------------------------------------------
router.put(
  '/:id/pause',
  asyncHandler(async (req: any, res) => {
    const tenantId = requireTenantId(req);
    requireUserId(req);

    const test = await verifyTestTenant(req.params.id, tenantId);
    if (!test) {
      return res.status(404).json({ error: 'A/B test not found' });
    }

    if (test.status !== 'running') {
      return res.status(400).json({ error: 'Only running tests can be paused' });
    }

    const updated = await prisma.aBTest.update({
      where: { id: req.params.id },
      data: { status: 'paused' },
    });

    res.json({
      ...updated,
      metrics: safeJsonParse(updated.metrics, {}),
    });
  }),
);

// ---------------------------------------------------------------------------
// PUT /:id/complete — complete A/B test with final metrics
// ---------------------------------------------------------------------------
router.put(
  '/:id/complete',
  asyncHandler(async (req: any, res) => {
    const tenantId = requireTenantId(req);
    requireUserId(req);

    const test = await verifyTestTenant(req.params.id, tenantId);
    if (!test) {
      return res.status(404).json({ error: 'A/B test not found' });
    }

    if (test.status !== 'running' && test.status !== 'paused') {
      return res.status(400).json({ error: 'Only running or paused tests can be completed' });
    }

    const metrics = safeJsonParse(test.metrics, {
      variantA: { executions: 0, successes: 0, failures: 0, avgTimeMs: 0, totalTimeMs: 0 },
      variantB: { executions: 0, successes: 0, failures: 0, avgTimeMs: 0, totalTimeMs: 0 },
    });

    // Calculate final metrics: success rates, winner
    const aRate = metrics.variantA.executions > 0
      ? (metrics.variantA.successes / metrics.variantA.executions) * 100
      : 0;
    const bRate = metrics.variantB.executions > 0
      ? (metrics.variantB.successes / metrics.variantB.executions) * 100
      : 0;

    metrics.summary = {
      variantASuccessRate: Math.round(aRate * 100) / 100,
      variantBSuccessRate: Math.round(bRate * 100) / 100,
      winner: aRate > bRate ? 'A' : bRate > aRate ? 'B' : 'tie',
      totalExecutions: metrics.variantA.executions + metrics.variantB.executions,
      variantAAvgTimeMs: metrics.variantA.executions > 0
        ? Math.round(metrics.variantA.totalTimeMs / metrics.variantA.executions)
        : 0,
      variantBAvgTimeMs: metrics.variantB.executions > 0
        ? Math.round(metrics.variantB.totalTimeMs / metrics.variantB.executions)
        : 0,
    };

    const updated = await prisma.aBTest.update({
      where: { id: req.params.id },
      data: {
        status: 'completed',
        completedAt: new Date(),
        metrics: JSON.stringify(metrics),
      },
    });

    res.json({
      ...updated,
      metrics,
    });
  }),
);

// ---------------------------------------------------------------------------
// DELETE /:id — delete an A/B test (only if draft)
// ---------------------------------------------------------------------------
router.delete(
  '/:id',
  asyncHandler(async (req: any, res) => {
    const tenantId = requireTenantId(req);
    requireUserId(req);

    const test = await verifyTestTenant(req.params.id, tenantId);
    if (!test) {
      return res.status(404).json({ error: 'A/B test not found' });
    }

    if (test.status !== 'draft') {
      return res.status(400).json({ error: 'Only draft tests can be deleted' });
    }

    await prisma.aBTest.delete({ where: { id: req.params.id } });

    res.json({ success: true });
  }),
);

// ---------------------------------------------------------------------------
// POST /:id/execute — execute with A/B routing
// ---------------------------------------------------------------------------
router.post(
  '/:id/execute',
  asyncHandler(async (req: any, res) => {
    const tenantId = requireTenantId(req);

    const test = await verifyTestTenant(req.params.id, tenantId);
    if (!test) {
      return res.status(404).json({ error: 'A/B test not found' });
    }

    if (test.status !== 'running') {
      return res.status(400).json({ error: 'A/B test must be running to execute' });
    }

    const input = req.body;
    if (!input || typeof input !== 'object') {
      return res.status(400).json({ error: 'Request body must be a JSON object' });
    }

    // Randomly assign to variant A or B based on splitRatio
    const roll = Math.random() * 100;
    const assignedVariant = roll < (100 - test.splitRatio) ? 'A' : 'B';
    const versionNumber = assignedVariant === 'A'
      ? Number(test.variantA)
      : Number(test.variantB);

    // Load the appropriate version of the rule set
    const engineRuleSet = await loadVersionedRuleSet(test.ruleSetId, versionNumber);
    if (!engineRuleSet) {
      return res.status(404).json({ error: `Rule set version ${versionNumber} not found` });
    }

    // Execute
    const startTime = Date.now();
    let result: any;
    let success = true;
    let error: string | undefined;

    try {
      result = executeRuleSet(engineRuleSet, input);
    } catch (err: any) {
      success = false;
      error = err.message;
      result = { output: {}, rulesFired: [], executionTimeMs: Date.now() - startTime, success: false, error: err.message };
    }

    const executionTimeMs = result.executionTimeMs || (Date.now() - startTime);

    // Update metrics in real-time
    const metrics = safeJsonParse(test.metrics, {
      variantA: { executions: 0, successes: 0, failures: 0, avgTimeMs: 0, totalTimeMs: 0 },
      variantB: { executions: 0, successes: 0, failures: 0, avgTimeMs: 0, totalTimeMs: 0 },
    });

    const variantKey = assignedVariant === 'A' ? 'variantA' : 'variantB';
    if (!metrics[variantKey]) {
      metrics[variantKey] = { executions: 0, successes: 0, failures: 0, avgTimeMs: 0, totalTimeMs: 0 };
    }

    metrics[variantKey].executions += 1;
    if (success && result.success !== false) {
      metrics[variantKey].successes += 1;
    } else {
      metrics[variantKey].failures += 1;
    }
    metrics[variantKey].totalTimeMs += executionTimeMs;
    metrics[variantKey].avgTimeMs = Math.round(
      metrics[variantKey].totalTimeMs / metrics[variantKey].executions
    );

    await prisma.aBTest.update({
      where: { id: test.id },
      data: { metrics: JSON.stringify(metrics) },
    });

    // Log the execution
    await prisma.executionLog.create({
      data: {
        ruleSetId: test.ruleSetId,
        version: versionNumber,
        input: JSON.stringify(input),
        output: JSON.stringify(result.output || {}),
        rulesFired: JSON.stringify(result.rulesFired || []),
        executionTimeMs,
        status: success && result.success !== false ? 'success' : 'error',
        error: error || result.error || null,
      },
    });

    res.json({
      variant: assignedVariant,
      version: versionNumber,
      result,
      metrics: metrics[variantKey],
    });
  }),
);

export default router;
