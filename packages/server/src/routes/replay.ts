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
// Helper: verify ruleSetId belongs to the tenant
// ---------------------------------------------------------------------------
async function verifyRuleSetTenant(ruleSetId: string, tenantId: string) {
  const ruleSet = await prisma.ruleSet.findUnique({
    where: { id: ruleSetId },
    include: { project: true },
  });

  if (!ruleSet) return null;
  if (!ruleSet.project.tenantId || ruleSet.project.tenantId !== tenantId) return null;
  return ruleSet;
}

// ---------------------------------------------------------------------------
// Helper: verify an execution log belongs to the tenant
// ---------------------------------------------------------------------------
async function verifyExecutionLogTenant(logId: string, tenantId: string) {
  const log = await prisma.executionLog.findUnique({
    where: { id: logId },
    include: {
      ruleSet: {
        include: { project: true },
      },
    },
  });

  if (!log) return null;
  if (!log.ruleSet.project.tenantId || log.ruleSet.project.tenantId !== tenantId) return null;
  return log;
}

// ---------------------------------------------------------------------------
// Helper: deep equality check
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

// ---------------------------------------------------------------------------
// Helper: compute field-level differences between two objects
// ---------------------------------------------------------------------------
function computeDifferences(
  original: Record<string, any>,
  replayed: Record<string, any>,
): { field: string; originalValue: any; replayedValue: any }[] {
  const diffs: { field: string; originalValue: any; replayedValue: any }[] = [];
  const allKeys = new Set([
    ...Object.keys(original || {}),
    ...Object.keys(replayed || {}),
  ]);

  for (const key of allKeys) {
    const origVal = original?.[key];
    const replayVal = replayed?.[key];
    if (!deepEqual(origVal, replayVal)) {
      diffs.push({
        field: key,
        originalValue: origVal !== undefined ? origVal : null,
        replayedValue: replayVal !== undefined ? replayVal : null,
      });
    }
  }

  return diffs;
}

// ---------------------------------------------------------------------------
// Helper: build an engine-compatible rule set from the current live rules
// ---------------------------------------------------------------------------
async function buildEngineRuleSet(ruleSetId: string) {
  const ruleSet = await prisma.ruleSet.findUnique({
    where: { id: ruleSetId },
    include: {
      rules: { where: { enabled: true }, orderBy: { priority: 'desc' } },
      decisionTables: true,
    },
  });

  if (!ruleSet) return null;

  return {
    engineRuleSet: {
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
    },
    version: ruleSet.version,
  };
}

// ---------------------------------------------------------------------------
// GET /executions — list execution logs with pagination
// ---------------------------------------------------------------------------
router.get(
  '/executions',
  asyncHandler(async (req: any, res) => {
    const tenantId = requireTenantId(req);

    const page = Math.max(1, parseInt(String(req.query.page || '1'), 10));
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || '20'), 10)));
    const skip = (page - 1) * limit;

    const ruleSetId = req.query.ruleSetId ? String(req.query.ruleSetId) : undefined;
    const status = req.query.status ? String(req.query.status) : undefined;

    // Only return logs for rule sets belonging to the tenant
    const where: any = {
      ruleSet: {
        project: {
          tenantId,
        },
      },
    };

    if (ruleSetId) {
      where.ruleSetId = ruleSetId;
    }
    if (status) {
      where.status = status;
    }

    const [logs, total] = await Promise.all([
      prisma.executionLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.executionLog.count({ where }),
    ]);

    const parsed = logs.map((log) => ({
      ...log,
      input: safeJsonParse(log.input, {}),
      output: safeJsonParse(log.output, {}),
      rulesFired: safeJsonParse(log.rulesFired, []),
    }));

    res.json({
      data: parsed,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  }),
);

// ---------------------------------------------------------------------------
// GET /executions/:id — get single execution log
// ---------------------------------------------------------------------------
router.get(
  '/executions/:id',
  asyncHandler(async (req: any, res) => {
    const tenantId = requireTenantId(req);

    const log = await verifyExecutionLogTenant(req.params.id, tenantId);
    if (!log) {
      return res.status(404).json({ error: 'Execution log not found' });
    }

    res.json({
      ...log,
      ruleSet: undefined, // strip included relation
      input: safeJsonParse(log.input, {}),
      output: safeJsonParse(log.output, {}),
      rulesFired: safeJsonParse(log.rulesFired, []),
    });
  }),
);

// ---------------------------------------------------------------------------
// POST /replay — replay an execution
//   Body: { executionLogId } or { ruleSetId, input }
//   Re-runs the rule set, compares with original.
//   Response: { original, replayed, differences, match }
// ---------------------------------------------------------------------------
router.post(
  '/replay',
  asyncHandler(async (req: any, res) => {
    const tenantId = requireTenantId(req);
    requireUserId(req);

    const { executionLogId, ruleSetId, input } = req.body;

    if (!executionLogId && (!ruleSetId || !input)) {
      return res.status(400).json({
        error: 'Provide either executionLogId or both ruleSetId and input',
      });
    }

    let originalInput: Record<string, any>;
    let originalOutput: Record<string, any>;
    let originalRulesFired: string[];
    let originalExecutionTimeMs: number;
    let originalStatus: string;
    let originalVersion: number;
    let originalLogId: string | null = null;
    let targetRuleSetId: string;

    if (executionLogId) {
      // Replay from an existing execution log
      const log = await verifyExecutionLogTenant(executionLogId, tenantId);
      if (!log) {
        return res.status(404).json({ error: 'Execution log not found' });
      }

      originalLogId = log.id;
      originalInput = safeJsonParse(log.input, {});
      originalOutput = safeJsonParse(log.output, {});
      originalRulesFired = safeJsonParse(log.rulesFired, []);
      originalExecutionTimeMs = log.executionTimeMs;
      originalStatus = log.status;
      originalVersion = log.version;
      targetRuleSetId = log.ruleSetId;
    } else {
      // Replay from provided ruleSetId + input
      const ruleSet = await verifyRuleSetTenant(ruleSetId, tenantId);
      if (!ruleSet) {
        return res.status(404).json({ error: 'Rule set not found' });
      }

      if (typeof input !== 'object' || input === null) {
        return res.status(400).json({ error: 'input must be a JSON object' });
      }

      originalInput = input;
      originalOutput = {};
      originalRulesFired = [];
      originalExecutionTimeMs = 0;
      originalStatus = 'none';
      originalVersion = ruleSet.version;
      targetRuleSetId = ruleSetId;
    }

    // Build and execute the rule set with current rules
    const loaded = await buildEngineRuleSet(targetRuleSetId);
    if (!loaded) {
      return res.status(404).json({ error: 'Rule set not found for replay' });
    }

    const { engineRuleSet, version: replayVersion } = loaded;

    let replayResult: any;
    try {
      replayResult = executeRuleSet(engineRuleSet, originalInput);
    } catch (err: any) {
      replayResult = {
        output: {},
        rulesFired: [],
        executionTimeMs: 0,
        success: false,
        error: err.message,
      };
    }

    const replayOutput = replayResult.output || {};
    const replayRulesFired = replayResult.rulesFired || [];

    // Compute differences
    const differences = computeDifferences(originalOutput, replayOutput);
    const match = differences.length === 0;

    // Persist the replay record
    const replay = await prisma.executionReplay.create({
      data: {
        originalLogId: originalLogId || '',
        ruleSetId: targetRuleSetId,
        ruleSetVersion: replayVersion,
        originalVersion,
        input: JSON.stringify(originalInput),
        originalOutput: JSON.stringify(originalOutput),
        replayOutput: JSON.stringify(replayOutput),
        diff: JSON.stringify({
          changed: !match,
          fieldChanges: differences.map((d) => ({
            field: d.field,
            before: d.originalValue,
            after: d.replayedValue,
          })),
        }),
      },
    });

    res.status(201).json({
      replayId: replay.id,
      original: {
        logId: originalLogId,
        input: originalInput,
        output: originalOutput,
        rulesFired: originalRulesFired,
        executionTimeMs: originalExecutionTimeMs,
        status: originalStatus,
        version: originalVersion,
      },
      replayed: {
        output: replayOutput,
        rulesFired: replayRulesFired,
        executionTimeMs: replayResult.executionTimeMs,
        success: replayResult.success,
        error: replayResult.error || null,
        version: replayVersion,
      },
      differences,
      match,
    });
  }),
);

export default router;
