import { Router } from 'express';
import { prisma } from '../prisma';
import { executeRuleSet as runEngine } from '@soa-one/engine';
import type { Rule, DecisionTable } from '@soa-one/engine';
import {
  safeJsonParse,
  requireTenantId,
  requireUserId,
  validateRequired,
  asyncHandler,
} from '../utils/validation';

const router = Router();

// Batch execute a rule set against multiple inputs
router.post('/rule-sets/:ruleSetId', asyncHandler(async (req: any, res) => {
  requireTenantId(req);
  requireUserId(req);

  const { ruleSetId } = req.params;
  const { inputs, options } = req.body;

  if (!Array.isArray(inputs) || inputs.length === 0) {
    return res.status(400).json({ error: 'inputs must be a non-empty array' });
  }

  const parallel = options?.parallel ?? false;
  const traceEnabled = options?.traceEnabled ?? false;

  // Fetch the rule set once
  const ruleSet = await prisma.ruleSet.findUnique({
    where: { id: ruleSetId },
    include: {
      rules: { where: { enabled: true }, orderBy: { priority: 'desc' } },
      decisionTables: true,
    },
  });

  if (!ruleSet) {
    return res.status(404).json({ error: 'Rule set not found' });
  }

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

  const batchStartTime = Date.now();

  // Execute a single input and return the result
  const executeSingle = async (input: any, index: number) => {
    const startTime = Date.now();
    try {
      const result = runEngine(engineRuleSet, input);
      const executionTimeMs = Date.now() - startTime;

      // Build trace if enabled
      let trace = null;
      if (traceEnabled) {
        const traceDetails: any[] = [];
        for (const rule of ruleSet.rules) {
          const conditions = safeJsonParse(rule.conditions, []);
          const actions = safeJsonParse(rule.actions, []);
          const conditionList = Array.isArray(conditions) ? conditions : (conditions.all || conditions.any || []);
          const conditionResults: any[] = [];
          let allMatch = true;

          for (const condition of conditionList) {
            const field = condition.field || condition.fact;
            const operator = condition.operator;
            const expectedValue = condition.value;
            const actualValue = field ? field.split('.').reduce((obj: any, key: string) => obj?.[key], input) : undefined;

            let matched = false;
            switch (operator) {
              case 'equal': case 'equals': case '==': matched = actualValue == expectedValue; break;
              case 'notEqual': case '!=': matched = actualValue != expectedValue; break;
              case 'greaterThan': case '>': matched = actualValue > expectedValue; break;
              case 'greaterThanOrEqual': case 'greaterThanInclusive': case '>=': matched = actualValue >= expectedValue; break;
              case 'lessThan': case '<': matched = actualValue < expectedValue; break;
              case 'lessThanOrEqual': case 'lessThanInclusive': case '<=': matched = actualValue <= expectedValue; break;
              case 'in': matched = Array.isArray(expectedValue) && expectedValue.includes(actualValue); break;
              case 'notIn': matched = Array.isArray(expectedValue) && !expectedValue.includes(actualValue); break;
              case 'contains': matched = typeof actualValue === 'string' && actualValue.includes(expectedValue); break;
              default: matched = false;
            }

            if (!matched) allMatch = false;
            conditionResults.push({ field, operator, expectedValue, actualValue, matched });
          }

          traceDetails.push({
            ruleId: rule.id,
            ruleName: rule.name,
            fired: allMatch,
            conditionResults,
            actionsTaken: allMatch ? actions : [],
          });
        }
        trace = traceDetails;
      }

      return {
        index,
        input,
        output: result.output,
        status: result.success ? 'success' as const : 'error' as const,
        executionTimeMs,
        rulesFired: result.rulesFired || [],
        error: result.error || null,
        trace,
      };
    } catch (err: any) {
      return {
        index,
        input,
        output: null,
        status: 'error' as const,
        executionTimeMs: Date.now() - startTime,
        rulesFired: [],
        error: err.message,
        trace: null,
      };
    }
  };

  // Execute all inputs (parallel or sequential)
  let results: Awaited<ReturnType<typeof executeSingle>>[];

  if (parallel) {
    results = await Promise.all(inputs.map((input: any, index: number) => executeSingle(input, index)));
  } else {
    results = [];
    for (let i = 0; i < inputs.length; i++) {
      results.push(await executeSingle(inputs[i], i));
    }
  }

  const totalTimeMs = Date.now() - batchStartTime;
  const successes = results.filter((r) => r.status === 'success').length;
  const failures = results.filter((r) => r.status === 'error').length;
  const avgTimeMs = results.length > 0
    ? Math.round(results.reduce((sum, r) => sum + r.executionTimeMs, 0) / results.length)
    : 0;

  // Log each execution
  const logPromises = results.map((r) =>
    prisma.executionLog.create({
      data: {
        ruleSetId,
        version: ruleSet.version,
        input: JSON.stringify(r.input),
        output: JSON.stringify(r.output),
        rulesFired: JSON.stringify(r.rulesFired),
        executionTimeMs: r.executionTimeMs,
        status: r.status,
        error: r.error,
      },
    })
  );

  await Promise.all(logPromises);

  res.json({
    results: results.map((r) => ({
      input: r.input,
      output: r.output,
      status: r.status,
      executionTimeMs: r.executionTimeMs,
      rulesFired: r.rulesFired,
      error: r.error,
      ...(traceEnabled ? { trace: r.trace } : {}),
    })),
    stats: {
      total: results.length,
      successes,
      failures,
      avgTimeMs,
      totalTimeMs,
    },
  });
}));

export default router;
