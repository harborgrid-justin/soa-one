import { Router } from 'express';
import { prisma } from '../prisma';
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
// Condition evaluator — evaluates a single condition against an input value
// ---------------------------------------------------------------------------
interface ConditionEvalResult {
  field: string;
  operator: string;
  expectedValue: any;
  actualValue: any;
  matched: boolean;
}

function evaluateCondition(condition: any, facts: Record<string, any>): ConditionEvalResult {
  const field = condition.field || '';
  const operator = condition.operator || 'equals';
  const expectedValue = condition.value;

  // Support nested field access via dot notation
  const actualValue = getNestedValue(facts, field);

  let matched = false;

  switch (operator) {
    case 'equals':
    case 'equal':
      matched = actualValue == expectedValue; // eslint-disable-line eqeqeq
      break;
    case 'notEquals':
    case 'notEqual':
      matched = actualValue != expectedValue; // eslint-disable-line eqeqeq
      break;
    case 'greaterThan':
      matched = typeof actualValue === 'number' && actualValue > Number(expectedValue);
      break;
    case 'greaterThanOrEqual':
      matched = typeof actualValue === 'number' && actualValue >= Number(expectedValue);
      break;
    case 'lessThan':
      matched = typeof actualValue === 'number' && actualValue < Number(expectedValue);
      break;
    case 'lessThanOrEqual':
      matched = typeof actualValue === 'number' && actualValue <= Number(expectedValue);
      break;
    case 'contains':
      matched = typeof actualValue === 'string' && actualValue.includes(String(expectedValue));
      break;
    case 'startsWith':
      matched = typeof actualValue === 'string' && actualValue.startsWith(String(expectedValue));
      break;
    case 'endsWith':
      matched = typeof actualValue === 'string' && actualValue.endsWith(String(expectedValue));
      break;
    case 'in':
      matched = Array.isArray(expectedValue) && expectedValue.includes(actualValue);
      break;
    case 'notIn':
      matched = Array.isArray(expectedValue) && !expectedValue.includes(actualValue);
      break;
    case 'between':
      if (expectedValue && typeof expectedValue === 'object') {
        const low = Number(expectedValue.low ?? expectedValue.min ?? 0);
        const high = Number(expectedValue.high ?? expectedValue.max ?? 0);
        matched = typeof actualValue === 'number' && actualValue >= low && actualValue <= high;
      }
      break;
    case 'exists':
      matched = actualValue !== undefined && actualValue !== null;
      break;
    case 'notExists':
      matched = actualValue === undefined || actualValue === null;
      break;
    case 'regex':
      try {
        matched = typeof actualValue === 'string' && new RegExp(String(expectedValue)).test(actualValue);
      } catch {
        matched = false;
      }
      break;
    default:
      matched = actualValue == expectedValue; // eslint-disable-line eqeqeq
  }

  return {
    field,
    operator,
    expectedValue,
    actualValue,
    matched,
  };
}

/**
 * Get a nested value from an object using dot notation.
 */
function getNestedValue(obj: any, path: string): any {
  if (!path) return undefined;
  const parts = path.split('.');
  let current = obj;
  for (const part of parts) {
    if (current == null) return undefined;
    current = current[part];
  }
  return current;
}

/**
 * Evaluate a condition group (with logic: AND/OR and nested conditions).
 */
function evaluateConditionGroup(
  group: any,
  facts: Record<string, any>,
  ruleId: string,
  ruleName: string,
  steps: any[],
  stepCounter: { value: number },
): boolean {
  const logic = group.logic || 'AND';
  const conditions = group.conditions || [];

  if (conditions.length === 0) return true;

  let groupResult = logic === 'AND';

  for (let i = 0; i < conditions.length; i++) {
    const cond = conditions[i];

    // Check if this is a nested group
    if (cond.conditions && Array.isArray(cond.conditions)) {
      const nestedResult = evaluateConditionGroup(
        cond,
        facts,
        ruleId,
        ruleName,
        steps,
        stepCounter,
      );

      if (logic === 'AND') {
        groupResult = groupResult && nestedResult;
      } else {
        groupResult = groupResult || nestedResult;
      }
      continue;
    }

    // Evaluate individual condition
    const evalResult = evaluateCondition(cond, facts);

    stepCounter.value++;
    steps.push({
      ruleId,
      ruleName,
      step: stepCounter.value,
      type: 'condition',
      conditionIndex: i,
      field: evalResult.field,
      operator: evalResult.operator,
      expectedValue: evalResult.expectedValue,
      actualValue: evalResult.actualValue,
      matched: evalResult.matched,
      factSnapshot: { ...facts },
    });

    if (logic === 'AND') {
      groupResult = groupResult && evalResult.matched;
      // Short-circuit: if AND and one fails, the group fails
      if (!groupResult) {
        // Still continue to record all conditions for debugging, but mark as short-circuited
        for (let j = i + 1; j < conditions.length; j++) {
          if (conditions[j].conditions) continue; // skip nested groups in short-circuit
          stepCounter.value++;
          steps.push({
            ruleId,
            ruleName,
            step: stepCounter.value,
            type: 'condition',
            conditionIndex: j,
            field: conditions[j].field || '',
            operator: conditions[j].operator || 'equals',
            expectedValue: conditions[j].value,
            actualValue: getNestedValue(facts, conditions[j].field || ''),
            matched: null, // null indicates short-circuited / not evaluated
            skipped: true,
            factSnapshot: { ...facts },
          });
        }
        return false;
      }
    } else {
      groupResult = groupResult || evalResult.matched;
      // Short-circuit: if OR and one matches, the group succeeds
      if (groupResult && i < conditions.length - 1) {
        for (let j = i + 1; j < conditions.length; j++) {
          if (conditions[j].conditions) continue;
          stepCounter.value++;
          steps.push({
            ruleId,
            ruleName,
            step: stepCounter.value,
            type: 'condition',
            conditionIndex: j,
            field: conditions[j].field || '',
            operator: conditions[j].operator || 'equals',
            expectedValue: conditions[j].value,
            actualValue: getNestedValue(facts, conditions[j].field || ''),
            matched: null,
            skipped: true,
            factSnapshot: { ...facts },
          });
        }
        return true;
      }
    }
  }

  return groupResult;
}

/**
 * Apply actions to the facts object and record the changes.
 */
function applyActions(
  actions: any[],
  facts: Record<string, any>,
  ruleId: string,
  ruleName: string,
  steps: any[],
  stepCounter: { value: number },
): void {
  if (!Array.isArray(actions)) return;

  for (const action of actions) {
    stepCounter.value++;
    const beforeFacts = { ...facts };

    switch (action.type) {
      case 'setValue': {
        const target = action.target || action.field || 'result';
        facts[target] = action.value;
        break;
      }
      case 'calculate': {
        const target = action.target || action.field || 'result';
        // Simple expression evaluation for basic math
        try {
          const expression = String(action.value || '0');
          // Replace field references with actual values
          const resolved = expression.replace(/\{(\w+)\}/g, (_m, f) => {
            const val = facts[f];
            return val !== undefined ? String(val) : '0';
          });
          // Only evaluate simple arithmetic
          if (/^[\d\s+\-*/().]+$/.test(resolved)) {
            facts[target] = Function(`"use strict"; return (${resolved})`)();
          } else {
            facts[target] = resolved;
          }
        } catch {
          facts[target] = action.value;
        }
        break;
      }
      case 'notify':
      case 'log':
        // These don't modify facts, just record them
        break;
      default: {
        if (action.target) {
          facts[action.target] = action.value;
        }
      }
    }

    steps.push({
      ruleId,
      ruleName,
      step: stepCounter.value,
      type: 'action',
      actionType: action.type,
      target: action.target || action.field || null,
      value: action.value,
      factsBefore: beforeFacts,
      factsAfter: { ...facts },
      factSnapshot: { ...facts },
    });
  }
}

// ---------------------------------------------------------------------------
// POST /rule-sets/:ruleSetId/debug — debug a full rule set step by step
// ---------------------------------------------------------------------------
router.post(
  '/rule-sets/:ruleSetId/debug',
  asyncHandler(async (req: any, res) => {
    const tenantId = requireTenantId(req);

    const ruleSet = await verifyRuleSetTenant(req.params.ruleSetId, tenantId);
    if (!ruleSet) {
      return res.status(404).json({ error: 'Rule set not found' });
    }

    const { input, breakpoints } = req.body;
    if (!input || typeof input !== 'object') {
      return res.status(400).json({ error: 'input must be a JSON object' });
    }

    const breakpointSet = new Set<string>(breakpoints || []);

    // Load all enabled rules, ordered by priority descending
    const rules = await prisma.rule.findMany({
      where: { ruleSetId: req.params.ruleSetId, enabled: true },
      orderBy: { priority: 'desc' },
    });

    // Initialize facts from input
    const facts: Record<string, any> = { ...input };
    const steps: any[] = [];
    const stepCounter = { value: 0 };
    const rulesFired: string[] = [];
    let totalRulesEvaluated = 0;
    let pausedAtRule: string | null = null;

    for (const rule of rules) {
      totalRulesEvaluated++;

      // Check for breakpoint
      if (breakpointSet.has(rule.id)) {
        stepCounter.value++;
        steps.push({
          ruleId: rule.id,
          ruleName: rule.name,
          step: stepCounter.value,
          type: 'breakpoint',
          message: `Breakpoint hit at rule "${rule.name}"`,
          factSnapshot: { ...facts },
        });
        pausedAtRule = rule.id;
      }

      const conditions = safeJsonParse(rule.conditions, {});
      const actions = safeJsonParse(rule.actions, []);

      // Record rule evaluation start
      stepCounter.value++;
      steps.push({
        ruleId: rule.id,
        ruleName: rule.name,
        step: stepCounter.value,
        type: 'ruleStart',
        priority: rule.priority,
        factSnapshot: { ...facts },
      });

      // Evaluate conditions
      const conditionsMatched = evaluateConditionGroup(
        conditions,
        facts,
        rule.id,
        rule.name,
        steps,
        stepCounter,
      );

      // Record rule evaluation result
      stepCounter.value++;
      steps.push({
        ruleId: rule.id,
        ruleName: rule.name,
        step: stepCounter.value,
        type: 'ruleResult',
        matched: conditionsMatched,
        factSnapshot: { ...facts },
      });

      // If conditions matched, apply actions
      if (conditionsMatched) {
        rulesFired.push(rule.id);
        applyActions(actions, facts, rule.id, rule.name, steps, stepCounter);
      }
    }

    res.json({
      steps,
      finalOutput: facts,
      totalRulesEvaluated,
      rulesFired,
      rulesFiredCount: rulesFired.length,
      pausedAtRule,
      totalSteps: steps.length,
    });
  }),
);

// ---------------------------------------------------------------------------
// POST /rules/:ruleId/evaluate — evaluate a single rule against input
// ---------------------------------------------------------------------------
router.post(
  '/rules/:ruleId/evaluate',
  asyncHandler(async (req: any, res) => {
    const tenantId = requireTenantId(req);

    const { input } = req.body;
    if (!input || typeof input !== 'object') {
      return res.status(400).json({ error: 'input must be a JSON object' });
    }

    // Fetch the rule and verify tenant ownership
    const rule = await prisma.rule.findUnique({
      where: { id: req.params.ruleId },
      include: {
        ruleSet: {
          include: { project: true },
        },
      },
    });

    if (!rule) {
      return res.status(404).json({ error: 'Rule not found' });
    }

    if (!rule.ruleSet.project.tenantId || rule.ruleSet.project.tenantId !== tenantId) {
      return res.status(404).json({ error: 'Rule not found' });
    }

    const conditions = safeJsonParse(rule.conditions, {});
    const actions = safeJsonParse(rule.actions, []);

    // Evaluate the rule
    const facts: Record<string, any> = { ...input };
    const steps: any[] = [];
    const stepCounter = { value: 0 };

    const conditionsMatched = evaluateConditionGroup(
      conditions,
      facts,
      rule.id,
      rule.name,
      steps,
      stepCounter,
    );

    // If matched, apply actions to show what would happen
    const actionResults: any[] = [];
    if (conditionsMatched) {
      const beforeFacts = { ...facts };
      applyActions(actions, facts, rule.id, rule.name, steps, stepCounter);
      actionResults.push({
        factsBefore: beforeFacts,
        factsAfter: { ...facts },
      });
    }

    // Build individual condition results for easy inspection
    const conditionResults = (conditions.conditions || []).map((cond: any, index: number) => {
      if (cond.conditions) {
        return {
          index,
          type: 'group',
          logic: cond.logic || 'AND',
          description: `Nested ${cond.logic || 'AND'} group with ${(cond.conditions || []).length} conditions`,
        };
      }
      const evalResult = evaluateCondition(cond, input);
      return {
        index,
        ...evalResult,
      };
    });

    res.json({
      ruleId: rule.id,
      ruleName: rule.name,
      ruleDescription: rule.description,
      enabled: rule.enabled,
      priority: rule.priority,
      conditionsMatched,
      conditionsLogic: conditions.logic || 'AND',
      conditionResults,
      actionsWouldFire: conditionsMatched,
      actions: conditionsMatched ? actions : [],
      outputAfterActions: conditionsMatched ? facts : input,
      steps,
    });
  }),
);

// ---------------------------------------------------------------------------
// In-memory breakpoint store: tenantId -> ruleSetId -> Set<ruleId>
// ---------------------------------------------------------------------------
const breakpointStore = new Map<string, Map<string, Set<string>>>();

function getBreakpoints(tenantId: string, ruleSetId: string): Set<string> {
  const tenantMap = breakpointStore.get(tenantId);
  if (!tenantMap) return new Set();
  return tenantMap.get(ruleSetId) || new Set();
}

function setBreakpoints(tenantId: string, ruleSetId: string, ruleIds: string[]): void {
  let tenantMap = breakpointStore.get(tenantId);
  if (!tenantMap) {
    tenantMap = new Map();
    breakpointStore.set(tenantId, tenantMap);
  }
  tenantMap.set(ruleSetId, new Set(ruleIds));
}

// ---------------------------------------------------------------------------
// POST /rule-sets/:ruleSetId/breakpoints — set breakpoints on specific rules
// ---------------------------------------------------------------------------
router.post(
  '/rule-sets/:ruleSetId/breakpoints',
  asyncHandler(async (req: any, res) => {
    const tenantId = requireTenantId(req);

    const ruleSet = await verifyRuleSetTenant(req.params.ruleSetId, tenantId);
    if (!ruleSet) {
      return res.status(404).json({ error: 'Rule set not found' });
    }

    const { breakpoints } = req.body;
    if (!Array.isArray(breakpoints)) {
      return res.status(400).json({ error: 'breakpoints must be an array of rule IDs' });
    }

    // Verify that all referenced rule IDs belong to this rule set
    const rules = await prisma.rule.findMany({
      where: { ruleSetId: req.params.ruleSetId },
      select: { id: true, name: true },
    });

    const validRuleIds = new Set(rules.map((r) => r.id));
    const invalidIds = breakpoints.filter((id: string) => !validRuleIds.has(id));

    if (invalidIds.length > 0) {
      return res.status(400).json({
        error: `Invalid rule IDs: ${invalidIds.join(', ')}`,
      });
    }

    setBreakpoints(tenantId, req.params.ruleSetId, breakpoints);

    const activeBreakpoints = rules
      .filter((r) => breakpoints.includes(r.id))
      .map((r) => ({ ruleId: r.id, ruleName: r.name }));

    res.json({
      ruleSetId: req.params.ruleSetId,
      breakpoints: activeBreakpoints,
      totalBreakpoints: activeBreakpoints.length,
    });
  }),
);

// ---------------------------------------------------------------------------
// GET /rule-sets/:ruleSetId/breakpoints — get current breakpoints
// ---------------------------------------------------------------------------
router.get(
  '/rule-sets/:ruleSetId/breakpoints',
  asyncHandler(async (req: any, res) => {
    const tenantId = requireTenantId(req);

    const ruleSet = await verifyRuleSetTenant(req.params.ruleSetId, tenantId);
    if (!ruleSet) {
      return res.status(404).json({ error: 'Rule set not found' });
    }

    const bps = getBreakpoints(tenantId, req.params.ruleSetId);

    const rules = await prisma.rule.findMany({
      where: { ruleSetId: req.params.ruleSetId },
      select: { id: true, name: true },
    });

    const activeBreakpoints = rules
      .filter((r) => bps.has(r.id))
      .map((r) => ({ ruleId: r.id, ruleName: r.name }));

    res.json({
      ruleSetId: req.params.ruleSetId,
      breakpoints: activeBreakpoints,
      totalBreakpoints: activeBreakpoints.length,
    });
  }),
);

export default router;
