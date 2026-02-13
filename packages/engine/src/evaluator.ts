import {
  Rule,
  RuleSet,
  DecisionTable,
  Condition,
  ConditionGroup,
  Action,
  RuleResult,
  DecisionTableResult,
  ExecutionResult,
} from './types';
import { resolvePath, setPath, evaluateOperator } from './operators';

/** Evaluate a single condition against input data */
function evaluateCondition(
  condition: Condition,
  data: Record<string, any>,
): boolean {
  const fieldValue = resolvePath(data, condition.field);
  return evaluateOperator(fieldValue, condition.operator, condition.value);
}

/** Evaluate a condition group (recursive AND/OR logic) */
function evaluateConditionGroup(
  group: ConditionGroup,
  data: Record<string, any>,
): boolean {
  if (!group.conditions || group.conditions.length === 0) {
    return true; // empty conditions = always true
  }

  if (group.logic === 'AND') {
    return group.conditions.every((c) =>
      'logic' in c
        ? evaluateConditionGroup(c as ConditionGroup, data)
        : evaluateCondition(c as Condition, data),
    );
  } else {
    return group.conditions.some((c) =>
      'logic' in c
        ? evaluateConditionGroup(c as ConditionGroup, data)
        : evaluateCondition(c as Condition, data),
    );
  }
}

/** Apply an action to the output object */
function applyAction(output: Record<string, any>, action: Action): void {
  switch (action.type) {
    case 'SET':
      setPath(output, action.field, action.value);
      break;
    case 'APPEND': {
      const current = resolvePath(output, action.field);
      if (Array.isArray(current)) {
        current.push(action.value);
      } else {
        setPath(output, action.field, [action.value]);
      }
      break;
    }
    case 'INCREMENT': {
      const current = resolvePath(output, action.field) || 0;
      setPath(output, action.field, Number(current) + Number(action.value));
      break;
    }
    case 'DECREMENT': {
      const current = resolvePath(output, action.field) || 0;
      setPath(output, action.field, Number(current) - Number(action.value));
      break;
    }
    case 'CUSTOM':
      setPath(output, action.field, action.value);
      break;
  }
}

/** Evaluate a single rule */
export function evaluateRule(
  rule: Rule,
  data: Record<string, any>,
): RuleResult {
  if (!rule.enabled) {
    return { ruleId: rule.id, ruleName: rule.name, fired: false, actions: [] };
  }

  const fired = evaluateConditionGroup(rule.conditions, data);

  return {
    ruleId: rule.id,
    ruleName: rule.name,
    fired,
    actions: fired ? rule.actions : [],
  };
}

/** Evaluate a decision table against input data */
export function evaluateDecisionTable(
  table: DecisionTable,
  data: Record<string, any>,
): DecisionTableResult {
  const conditionColumns = table.columns.filter((c) => c.type === 'condition');
  const actionColumns = table.columns.filter((c) => c.type === 'action');
  const matchedRows: string[] = [];
  const actions: Action[] = [];

  for (const row of table.rows) {
    if (!row.enabled) continue;

    // Check if all condition columns match
    const matches = conditionColumns.every((col) => {
      const cellValue = row.values[col.id];
      if (cellValue === '' || cellValue === null || cellValue === undefined || cellValue === '*') {
        return true; // wildcard / any
      }
      const fieldValue = resolvePath(data, col.field);
      return evaluateOperator(fieldValue, col.operator || 'equals', cellValue);
    });

    if (matches) {
      matchedRows.push(row.id);

      // Collect actions from action columns
      for (const col of actionColumns) {
        const cellValue = row.values[col.id];
        if (cellValue !== undefined && cellValue !== null && cellValue !== '') {
          actions.push({
            type: col.actionType || 'SET',
            field: col.field,
            value: cellValue,
          });
        }
      }

      if (table.hitPolicy === 'FIRST') break;
    }
  }

  return {
    tableId: table.id,
    tableName: table.name,
    matchedRows,
    actions,
  };
}

/** Execute a complete rule set against input data */
export function executeRuleSet(
  ruleSet: RuleSet,
  input: Record<string, any>,
): ExecutionResult {
  const startTime = performance.now();

  try {
    const output: Record<string, any> = {};
    const ruleResults: RuleResult[] = [];
    const tableResults: DecisionTableResult[] = [];
    const rulesFired: string[] = [];

    // Sort rules by priority (higher first)
    const sortedRules = [...ruleSet.rules].sort((a, b) => b.priority - a.priority);

    // Evaluate all rules
    for (const rule of sortedRules) {
      const result = evaluateRule(rule, input);
      ruleResults.push(result);

      if (result.fired) {
        rulesFired.push(rule.id);
        for (const action of result.actions) {
          applyAction(output, action);
        }
      }
    }

    // Evaluate all decision tables
    for (const table of ruleSet.decisionTables) {
      const result = evaluateDecisionTable(table, input);
      tableResults.push(result);

      for (const action of result.actions) {
        applyAction(output, action);
      }
    }

    const executionTimeMs = Math.round(performance.now() - startTime);

    return {
      success: true,
      input,
      output,
      ruleResults,
      tableResults,
      rulesFired,
      executionTimeMs,
    };
  } catch (err: any) {
    const executionTimeMs = Math.round(performance.now() - startTime);
    return {
      success: false,
      input,
      output: {},
      ruleResults: [],
      tableResults: [],
      rulesFired: [],
      executionTimeMs,
      error: err.message || 'Unknown execution error',
    };
  }
}
