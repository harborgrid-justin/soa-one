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

// Get decision trace for an execution log
router.get('/executions/:executionLogId/trace', asyncHandler(async (req: any, res) => {
  requireTenantId(req);

  const { executionLogId } = req.params;

  const trace = await prisma.decisionTrace.findFirst({
    where: { executionLogId },
  });

  if (!trace) {
    return res.status(404).json({ error: 'Decision trace not found for this execution' });
  }

  res.json({
    ...trace,
    input: safeJsonParse(trace.input, {}),
    trace: safeJsonParse(trace.trace, []),
    summary: safeJsonParse(trace.summary, {}),
  });
}));

// Execute rule set WITH full trace
router.post('/execute-traced/:ruleSetId', asyncHandler(async (req: any, res) => {
  requireTenantId(req);
  requireUserId(req);

  const { ruleSetId } = req.params;
  const input = req.body;

  if (!input || typeof input !== 'object') {
    return res.status(400).json({ error: 'Request body must be a JSON object' });
  }

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

  // Build detailed trace for each rule
  const traceDetails: any[] = [];
  let rulesFiredCount = 0;
  let rulesSkippedCount = 0;
  const executionOrder: string[] = [];

  for (const rule of ruleSet.rules) {
    const conditions = safeJsonParse(rule.conditions, []);
    const actions = safeJsonParse(rule.actions, []);
    const conditionResults: any[] = [];

    // Evaluate each condition against the input
    let allConditionsMatch = true;

    const conditionList = Array.isArray(conditions) ? conditions : (conditions.all || conditions.any || []);

    for (const condition of conditionList) {
      const field = condition.field || condition.fact;
      const operator = condition.operator;
      const expectedValue = condition.value;
      const actualValue = field ? field.split('.').reduce((obj: any, key: string) => obj?.[key], input) : undefined;

      let matched = false;

      switch (operator) {
        case 'equal':
        case 'equals':
        case '==':
          matched = actualValue == expectedValue;
          break;
        case 'notEqual':
        case '!=':
          matched = actualValue != expectedValue;
          break;
        case 'greaterThan':
        case '>':
          matched = actualValue > expectedValue;
          break;
        case 'greaterThanOrEqual':
        case 'greaterThanInclusive':
        case '>=':
          matched = actualValue >= expectedValue;
          break;
        case 'lessThan':
        case '<':
          matched = actualValue < expectedValue;
          break;
        case 'lessThanOrEqual':
        case 'lessThanInclusive':
        case '<=':
          matched = actualValue <= expectedValue;
          break;
        case 'in':
          matched = Array.isArray(expectedValue) && expectedValue.includes(actualValue);
          break;
        case 'notIn':
          matched = Array.isArray(expectedValue) && !expectedValue.includes(actualValue);
          break;
        case 'contains':
          matched = typeof actualValue === 'string' && actualValue.includes(expectedValue);
          break;
        default:
          matched = false;
      }

      if (!matched) allConditionsMatch = false;

      conditionResults.push({
        field,
        operator,
        expectedValue,
        actualValue,
        matched,
      });
    }

    const fired = allConditionsMatch;
    const actionsTaken = fired ? actions : [];

    if (fired) {
      rulesFiredCount++;
      executionOrder.push(rule.id);
    } else {
      rulesSkippedCount++;
    }

    traceDetails.push({
      ruleId: rule.id,
      ruleName: rule.name,
      priority: rule.priority,
      evaluated: true,
      fired,
      conditionResults,
      actionsTaken,
    });
  }

  const summary = {
    totalRulesEvaluated: ruleSet.rules.length,
    rulesFired: rulesFiredCount,
    rulesSkipped: rulesSkippedCount,
    executionOrder,
  };

  // Run the actual engine for the real result
  const result = runEngine(engineRuleSet, input);

  // Log execution
  const executionLog = await prisma.executionLog.create({
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

  // Store decision trace
  const decisionTrace = await prisma.decisionTrace.create({
    data: {
      executionLogId: executionLog.id,
      ruleSetId,
      input: JSON.stringify(input),
      trace: JSON.stringify(traceDetails),
      summary: JSON.stringify(summary),
    },
  });

  res.json({
    execution: result,
    executionLogId: executionLog.id,
    trace: {
      id: decisionTrace.id,
      input,
      details: traceDetails,
      summary,
    },
  });
}));

export default router;
