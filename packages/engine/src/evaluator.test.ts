import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateRule, evaluateDecisionTable, executeRuleSet } from './evaluator';
import { resolvePath, setPath, evaluateOperator } from './operators';
import type { Rule, RuleSet, DecisionTable, ConditionGroup, Action } from './types';

// ============================================================
// Helper factories
// ============================================================

function makeRule(overrides: Partial<Rule> = {}): Rule {
  return {
    id: 'rule-1',
    name: 'Test Rule',
    priority: 0,
    enabled: true,
    conditions: {
      logic: 'AND',
      conditions: [{ field: 'age', operator: 'greaterThanOrEqual', value: 18 }],
    },
    actions: [{ type: 'SET', field: 'eligible', value: true }],
    ...overrides,
  };
}

function makeRuleSet(overrides: Partial<RuleSet> = {}): RuleSet {
  return {
    id: 'rs-1',
    name: 'Test Rule Set',
    rules: [],
    decisionTables: [],
    ...overrides,
  };
}

// ============================================================
// resolvePath
// ============================================================

describe('resolvePath', () => {
  it('resolves top-level keys', () => {
    assert.equal(resolvePath({ name: 'Alice' }, 'name'), 'Alice');
  });

  it('resolves nested dot-notation paths', () => {
    assert.equal(resolvePath({ user: { profile: { age: 30 } } }, 'user.profile.age'), 30);
  });

  it('returns undefined for missing paths', () => {
    assert.equal(resolvePath({ a: 1 }, 'b'), undefined);
  });

  it('returns undefined for deep missing paths', () => {
    assert.equal(resolvePath({ a: { b: 1 } }, 'a.c.d'), undefined);
  });

  it('handles null intermediates', () => {
    assert.equal(resolvePath({ a: null }, 'a.b'), undefined);
  });
});

// ============================================================
// setPath
// ============================================================

describe('setPath', () => {
  it('sets top-level keys', () => {
    const obj: Record<string, any> = {};
    setPath(obj, 'name', 'Bob');
    assert.equal(obj.name, 'Bob');
  });

  it('sets nested paths, creating intermediate objects', () => {
    const obj: Record<string, any> = {};
    setPath(obj, 'a.b.c', 42);
    assert.equal(obj.a.b.c, 42);
  });

  it('overwrites existing values', () => {
    const obj: Record<string, any> = { a: { b: 1 } };
    setPath(obj, 'a.b', 99);
    assert.equal(obj.a.b, 99);
  });
});

// ============================================================
// evaluateOperator
// ============================================================

describe('evaluateOperator', () => {
  it('equals — matches identical values', () => {
    assert.equal(evaluateOperator(5, 'equals', 5), true);
    assert.equal(evaluateOperator('hello', 'equals', 'hello'), true);
  });

  it('equals — rejects different values', () => {
    assert.equal(evaluateOperator(5, 'equals', 6), false);
  });

  it('notEquals', () => {
    assert.equal(evaluateOperator(5, 'notEquals', 6), true);
    assert.equal(evaluateOperator(5, 'notEquals', 5), false);
  });

  it('greaterThan', () => {
    assert.equal(evaluateOperator(10, 'greaterThan', 5), true);
    assert.equal(evaluateOperator(5, 'greaterThan', 10), false);
    assert.equal(evaluateOperator(5, 'greaterThan', 5), false);
  });

  it('greaterThanOrEqual', () => {
    assert.equal(evaluateOperator(10, 'greaterThanOrEqual', 10), true);
    assert.equal(evaluateOperator(10, 'greaterThanOrEqual', 11), false);
  });

  it('lessThan', () => {
    assert.equal(evaluateOperator(3, 'lessThan', 5), true);
    assert.equal(evaluateOperator(5, 'lessThan', 3), false);
  });

  it('lessThanOrEqual', () => {
    assert.equal(evaluateOperator(5, 'lessThanOrEqual', 5), true);
    assert.equal(evaluateOperator(6, 'lessThanOrEqual', 5), false);
  });

  it('contains — string', () => {
    assert.equal(evaluateOperator('hello world', 'contains', 'world'), true);
    assert.equal(evaluateOperator('hello world', 'contains', 'xyz'), false);
  });

  it('contains — array', () => {
    assert.equal(evaluateOperator([1, 2, 3], 'contains', 2), true);
    assert.equal(evaluateOperator([1, 2, 3], 'contains', 9), false);
  });

  it('notContains — string', () => {
    assert.equal(evaluateOperator('hello', 'notContains', 'xyz'), true);
    assert.equal(evaluateOperator('hello', 'notContains', 'ell'), false);
  });

  it('startsWith', () => {
    assert.equal(evaluateOperator('prefix-test', 'startsWith', 'prefix'), true);
    assert.equal(evaluateOperator('prefix-test', 'startsWith', 'test'), false);
  });

  it('endsWith', () => {
    assert.equal(evaluateOperator('test-suffix', 'endsWith', 'suffix'), true);
    assert.equal(evaluateOperator('test-suffix', 'endsWith', 'test'), false);
  });

  it('in', () => {
    assert.equal(evaluateOperator('a', 'in', ['a', 'b', 'c']), true);
    assert.equal(evaluateOperator('z', 'in', ['a', 'b', 'c']), false);
  });

  it('notIn', () => {
    assert.equal(evaluateOperator('z', 'notIn', ['a', 'b', 'c']), true);
    assert.equal(evaluateOperator('a', 'notIn', ['a', 'b', 'c']), false);
  });

  it('between', () => {
    assert.equal(evaluateOperator(5, 'between', [1, 10]), true);
    assert.equal(evaluateOperator(1, 'between', [1, 10]), true);   // inclusive
    assert.equal(evaluateOperator(10, 'between', [1, 10]), true);  // inclusive
    assert.equal(evaluateOperator(0, 'between', [1, 10]), false);
    assert.equal(evaluateOperator(11, 'between', [1, 10]), false);
  });

  it('isNull', () => {
    assert.equal(evaluateOperator(null, 'isNull', null), true);
    assert.equal(evaluateOperator(undefined, 'isNull', null), true);
    assert.equal(evaluateOperator(0, 'isNull', null), false);
  });

  it('isNotNull', () => {
    assert.equal(evaluateOperator(42, 'isNotNull', null), true);
    assert.equal(evaluateOperator(null, 'isNotNull', null), false);
  });

  it('matches (regex)', () => {
    assert.equal(evaluateOperator('abc123', 'matches', '^[a-z]+\\d+$'), true);
    assert.equal(evaluateOperator('abc', 'matches', '^\\d+$'), false);
  });

  it('returns false for unknown operator', () => {
    assert.equal(evaluateOperator(1, 'unknownOp' as any, 1), false);
  });
});

// ============================================================
// evaluateRule
// ============================================================

describe('evaluateRule', () => {
  it('fires when condition matches', () => {
    const rule = makeRule();
    const result = evaluateRule(rule, { age: 25 });
    assert.equal(result.fired, true);
    assert.equal(result.ruleId, 'rule-1');
    assert.equal(result.actions.length, 1);
  });

  it('does not fire when condition does not match', () => {
    const rule = makeRule();
    const result = evaluateRule(rule, { age: 15 });
    assert.equal(result.fired, false);
    assert.deepEqual(result.actions, []);
  });

  it('does not fire when disabled', () => {
    const rule = makeRule({ enabled: false });
    const result = evaluateRule(rule, { age: 25 });
    assert.equal(result.fired, false);
  });

  it('handles OR conditions', () => {
    const rule = makeRule({
      conditions: {
        logic: 'OR',
        conditions: [
          { field: 'status', operator: 'equals', value: 'gold' },
          { field: 'status', operator: 'equals', value: 'platinum' },
        ],
      },
    });
    assert.equal(evaluateRule(rule, { status: 'platinum' }).fired, true);
    assert.equal(evaluateRule(rule, { status: 'silver' }).fired, false);
  });

  it('handles nested condition groups', () => {
    const rule = makeRule({
      conditions: {
        logic: 'AND',
        conditions: [
          { field: 'age', operator: 'greaterThanOrEqual', value: 18 },
          {
            logic: 'OR',
            conditions: [
              { field: 'income', operator: 'greaterThan', value: 50000 },
              { field: 'creditScore', operator: 'greaterThan', value: 700 },
            ],
          },
        ],
      },
    });
    assert.equal(evaluateRule(rule, { age: 25, income: 60000, creditScore: 600 }).fired, true);
    assert.equal(evaluateRule(rule, { age: 25, income: 30000, creditScore: 750 }).fired, true);
    assert.equal(evaluateRule(rule, { age: 25, income: 30000, creditScore: 600 }).fired, false);
    assert.equal(evaluateRule(rule, { age: 16, income: 60000, creditScore: 800 }).fired, false);
  });

  it('empty conditions always fire', () => {
    const rule = makeRule({
      conditions: { logic: 'AND', conditions: [] },
    });
    assert.equal(evaluateRule(rule, {}).fired, true);
  });
});

// ============================================================
// evaluateDecisionTable
// ============================================================

describe('evaluateDecisionTable', () => {
  const table: DecisionTable = {
    id: 'dt-1',
    name: 'Risk Table',
    columns: [
      { id: 'c1', name: 'Age', field: 'age', type: 'condition', operator: 'greaterThanOrEqual' },
      { id: 'c2', name: 'Income', field: 'income', type: 'condition', operator: 'greaterThan' },
      { id: 'a1', name: 'Risk Level', field: 'riskLevel', type: 'action', actionType: 'SET' },
    ],
    rows: [
      { id: 'r1', values: { c1: 30, c2: 80000, a1: 'low' }, enabled: true },
      { id: 'r2', values: { c1: 18, c2: 40000, a1: 'medium' }, enabled: true },
      { id: 'r3', values: { c1: 18, c2: 0, a1: 'high' }, enabled: true },
    ],
    hitPolicy: 'FIRST',
  };

  it('FIRST hit policy — returns first matching row', () => {
    const result = evaluateDecisionTable(table, { age: 35, income: 100000 });
    assert.deepEqual(result.matchedRows, ['r1']);
    assert.equal(result.actions.length, 1);
    assert.equal(result.actions[0].value, 'low');
  });

  it('ALL hit policy — returns all matching rows', () => {
    const allTable = { ...table, hitPolicy: 'ALL' as const };
    const result = evaluateDecisionTable(allTable, { age: 35, income: 100000 });
    assert.deepEqual(result.matchedRows, ['r1', 'r2', 'r3']);
  });

  it('skips disabled rows', () => {
    const withDisabled: DecisionTable = {
      ...table,
      rows: [
        { id: 'r1', values: { c1: 30, c2: 80000, a1: 'low' }, enabled: false },
        { id: 'r2', values: { c1: 18, c2: 40000, a1: 'medium' }, enabled: true },
      ],
    };
    const result = evaluateDecisionTable(withDisabled, { age: 35, income: 100000 });
    assert.deepEqual(result.matchedRows, ['r2']);
  });

  it('wildcard (*) matches any value', () => {
    const wildcardTable: DecisionTable = {
      ...table,
      rows: [
        { id: 'r1', values: { c1: '*', c2: '*', a1: 'universal' }, enabled: true },
      ],
    };
    const result = evaluateDecisionTable(wildcardTable, { age: 1, income: 0 });
    assert.deepEqual(result.matchedRows, ['r1']);
    assert.equal(result.actions[0].value, 'universal');
  });

  it('returns no matches when no rows satisfy', () => {
    const result = evaluateDecisionTable(table, { age: 10, income: 0 });
    assert.deepEqual(result.matchedRows, []);
    assert.deepEqual(result.actions, []);
  });
});

// ============================================================
// executeRuleSet
// ============================================================

describe('executeRuleSet', () => {
  it('executes rules sorted by priority (highest first)', () => {
    const ruleSet = makeRuleSet({
      rules: [
        makeRule({
          id: 'low-priority',
          priority: 1,
          conditions: { logic: 'AND', conditions: [] },
          actions: [{ type: 'SET', field: 'first', value: 'low' }],
        }),
        makeRule({
          id: 'high-priority',
          priority: 10,
          conditions: { logic: 'AND', conditions: [] },
          actions: [{ type: 'SET', field: 'first', value: 'high' }],
        }),
      ],
    });

    const result = executeRuleSet(ruleSet, {});
    assert.equal(result.success, true);
    // High-priority runs first, sets 'first' to 'high'; low-priority overwrites to 'low'
    assert.equal(result.output.first, 'low');
    assert.equal(result.rulesFired.length, 2);
  });

  it('collects rulesFired IDs', () => {
    const ruleSet = makeRuleSet({
      rules: [
        makeRule({ id: 'r1', conditions: { logic: 'AND', conditions: [] } }),
        makeRule({ id: 'r2', enabled: false }),
      ],
    });

    const result = executeRuleSet(ruleSet, {});
    assert.deepEqual(result.rulesFired, ['r1']);
  });

  it('applies SET actions correctly', () => {
    const ruleSet = makeRuleSet({
      rules: [
        makeRule({
          conditions: { logic: 'AND', conditions: [] },
          actions: [{ type: 'SET', field: 'result.approved', value: true }],
        }),
      ],
    });

    const result = executeRuleSet(ruleSet, {});
    assert.equal(result.output.result.approved, true);
  });

  it('applies APPEND actions correctly', () => {
    const ruleSet = makeRuleSet({
      rules: [
        makeRule({
          id: 'r1',
          priority: 2,
          conditions: { logic: 'AND', conditions: [] },
          actions: [{ type: 'APPEND', field: 'reasons', value: 'first' }],
        }),
        makeRule({
          id: 'r2',
          priority: 1,
          conditions: { logic: 'AND', conditions: [] },
          actions: [{ type: 'APPEND', field: 'reasons', value: 'second' }],
        }),
      ],
    });

    const result = executeRuleSet(ruleSet, {});
    assert.deepEqual(result.output.reasons, ['first', 'second']);
  });

  it('applies INCREMENT and DECREMENT actions', () => {
    const ruleSet = makeRuleSet({
      rules: [
        makeRule({
          id: 'r1',
          priority: 3,
          conditions: { logic: 'AND', conditions: [] },
          actions: [{ type: 'SET', field: 'score', value: 100 }],
        }),
        makeRule({
          id: 'r2',
          priority: 2,
          conditions: { logic: 'AND', conditions: [] },
          actions: [{ type: 'INCREMENT', field: 'score', value: 25 }],
        }),
        makeRule({
          id: 'r3',
          priority: 1,
          conditions: { logic: 'AND', conditions: [] },
          actions: [{ type: 'DECREMENT', field: 'score', value: 10 }],
        }),
      ],
    });

    const result = executeRuleSet(ruleSet, {});
    assert.equal(result.output.score, 115); // 100 + 25 - 10
  });

  it('also evaluates decision tables', () => {
    const ruleSet = makeRuleSet({
      rules: [],
      decisionTables: [{
        id: 'dt-1',
        name: 'Test Table',
        columns: [
          { id: 'c1', name: 'Status', field: 'status', type: 'condition', operator: 'equals' },
          { id: 'a1', name: 'Discount', field: 'discount', type: 'action', actionType: 'SET' },
        ],
        rows: [
          { id: 'r1', values: { c1: 'vip', a1: 0.2 }, enabled: true },
        ],
        hitPolicy: 'FIRST',
      }],
    });

    const result = executeRuleSet(ruleSet, { status: 'vip' });
    assert.equal(result.success, true);
    assert.equal(result.output.discount, 0.2);
    assert.equal(result.tableResults.length, 1);
  });

  it('includes executionTimeMs', () => {
    const ruleSet = makeRuleSet({ rules: [makeRule()] });
    const result = executeRuleSet(ruleSet, { age: 25 });
    assert.equal(typeof result.executionTimeMs, 'number');
    assert.ok(result.executionTimeMs >= 0);
  });

  it('returns success: false on internal engine error', () => {
    // Force an error by providing a rule with malformed conditions
    const ruleSet = makeRuleSet({
      rules: [{
        id: 'bad-rule',
        name: 'Bad',
        priority: 0,
        enabled: true,
        conditions: null as any, // this will cause evaluateConditionGroup to throw
        actions: [],
      }],
    });

    const result = executeRuleSet(ruleSet, {});
    assert.equal(result.success, false);
    assert.ok(result.error);
  });

  it('handles empty rule set', () => {
    const ruleSet = makeRuleSet();
    const result = executeRuleSet(ruleSet, { any: 'data' });
    assert.equal(result.success, true);
    assert.deepEqual(result.output, {});
    assert.deepEqual(result.rulesFired, []);
  });
});

// ============================================================
// Insurance Underwriting Scenario (integration test)
// ============================================================

describe('Insurance Underwriting Scenario', () => {
  const underwritingRules = makeRuleSet({
    rules: [
      makeRule({
        id: 'age-check',
        name: 'Age Eligibility',
        priority: 100,
        conditions: {
          logic: 'AND',
          conditions: [
            { field: 'applicant.age', operator: 'greaterThanOrEqual', value: 18 },
            { field: 'applicant.age', operator: 'lessThanOrEqual', value: 65 },
          ],
        },
        actions: [{ type: 'SET', field: 'eligible', value: true }],
      }),
      makeRule({
        id: 'high-risk',
        name: 'High Risk Flag',
        priority: 50,
        conditions: {
          logic: 'OR',
          conditions: [
            { field: 'applicant.smoker', operator: 'equals', value: true },
            { field: 'applicant.bmi', operator: 'greaterThan', value: 35 },
          ],
        },
        actions: [
          { type: 'SET', field: 'riskCategory', value: 'high' },
          { type: 'INCREMENT', field: 'premiumMultiplier', value: 0.5 },
        ],
      }),
      makeRule({
        id: 'premium-base',
        name: 'Base Premium',
        priority: 90,
        conditions: { logic: 'AND', conditions: [] },
        actions: [
          { type: 'SET', field: 'premiumMultiplier', value: 1.0 },
          { type: 'SET', field: 'riskCategory', value: 'standard' },
        ],
      }),
    ],
  });

  it('standard applicant gets base premium', () => {
    const result = executeRuleSet(underwritingRules, {
      applicant: { age: 30, smoker: false, bmi: 24 },
    });
    assert.equal(result.success, true);
    assert.equal(result.output.eligible, true);
    assert.equal(result.output.riskCategory, 'standard');
    assert.equal(result.output.premiumMultiplier, 1.0);
  });

  it('smoker gets high risk premium increase', () => {
    const result = executeRuleSet(underwritingRules, {
      applicant: { age: 40, smoker: true, bmi: 24 },
    });
    assert.equal(result.success, true);
    assert.equal(result.output.eligible, true);
    assert.equal(result.output.riskCategory, 'high');
    assert.equal(result.output.premiumMultiplier, 1.5);
  });

  it('underage applicant is not eligible', () => {
    const result = executeRuleSet(underwritingRules, {
      applicant: { age: 16, smoker: false, bmi: 22 },
    });
    assert.equal(result.success, true);
    assert.equal(result.output.eligible, undefined); // age-check rule didn't fire
  });
});
