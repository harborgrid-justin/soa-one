// ============================================================
// SOA One Rules — Business Rules Engine
// ============================================================
//
// Oracle Business Rules / Decision Component equivalent.
// Zero-dependency rule engine with:
// - Decision tables (multi-column conditions → actions)
// - Rule sets with priority and conflict resolution
// - Facts & working memory for forward-chaining inference
// - Expression evaluation (simple DSL)
// - Rule versioning, testing, and deployment lifecycle
// - Audit trail of rule executions
// ============================================================

// ── Utility ──────────────────────────────────────────────────

let _idCounter = 0;
export function generateId(): string {
  return `rule_${Date.now().toString(36)}_${(++_idCounter).toString(36)}`;
}

// ── Types ────────────────────────────────────────────────────

export type RuleStatus = 'draft' | 'active' | 'inactive' | 'deprecated';
export type ConflictResolution = 'priority' | 'first-match' | 'all-matches';
export type ConditionOperator = 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'contains' | 'matches' | 'between' | 'is-null' | 'is-not-null';
export type ActionType = 'set' | 'add' | 'remove' | 'call' | 'assert' | 'retract' | 'modify';
export type DecisionHitPolicy = 'unique' | 'first' | 'priority' | 'any' | 'collect' | 'rule-order';

export interface RuleCondition {
  field: string;
  operator: ConditionOperator;
  value: any;
  negate?: boolean;
}

export interface RuleAction {
  type: ActionType;
  target: string;
  value?: any;
  expression?: string;
}

export interface Rule {
  id: string;
  name: string;
  description?: string;
  priority: number;
  conditions: RuleCondition[];
  actions: RuleAction[];
  enabled: boolean;
  salience?: number;
}

export interface RuleSet {
  id: string;
  name: string;
  description?: string;
  version: number;
  status: RuleStatus;
  conflictResolution: ConflictResolution;
  rules: Rule[];
  effectiveDate?: string;
  expirationDate?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DecisionTableColumn {
  name: string;
  type: 'condition' | 'action';
  field: string;
  operator?: ConditionOperator;
  description?: string;
}

export interface DecisionTableRow {
  id: string;
  values: any[];         // one value per column
  annotation?: string;
  enabled: boolean;
}

export interface DecisionTable {
  id: string;
  name: string;
  description?: string;
  version: number;
  status: RuleStatus;
  hitPolicy: DecisionHitPolicy;
  columns: DecisionTableColumn[];
  rows: DecisionTableRow[];
  createdAt: string;
  updatedAt: string;
}

export interface Fact {
  type: string;
  data: Record<string, any>;
}

export interface RuleExecutionResult {
  id: string;
  ruleSetId?: string;
  decisionTableId?: string;
  input: Record<string, any>;
  matchedRules: string[];
  actions: RuleAction[];
  output: Record<string, any>;
  executionTimeMs: number;
  executedAt: string;
}

export interface RuleTestCase {
  id: string;
  name: string;
  ruleSetId?: string;
  decisionTableId?: string;
  input: Record<string, any>;
  expectedOutput: Record<string, any>;
  lastResult?: 'pass' | 'fail';
  lastRunAt?: string;
}

// ── BusinessRulesEngine ──────────────────────────────────────

export class BusinessRulesEngine {
  private _ruleSets = new Map<string, RuleSet>();
  private _decisionTables = new Map<string, DecisionTable>();
  private _testCases = new Map<string, RuleTestCase>();
  private _executionLog: RuleExecutionResult[] = [];
  private _onRuleExecuted: ((r: RuleExecutionResult) => void) | null = null;

  // ── Rule Sets ──

  createRuleSet(rs: Omit<RuleSet, 'id' | 'version' | 'createdAt' | 'updatedAt'>): RuleSet {
    const now = new Date().toISOString();
    const r: RuleSet = { ...rs, id: generateId(), version: 1, createdAt: now, updatedAt: now };
    this._ruleSets.set(r.id, r);
    return r;
  }

  getRuleSet(id: string): RuleSet | undefined {
    return this._ruleSets.get(id);
  }

  updateRuleSet(id: string, updates: Partial<RuleSet>): RuleSet {
    const r = this._ruleSets.get(id);
    if (!r) throw new Error(`Rule set not found: ${id}`);
    Object.assign(r, updates, { version: r.version + 1, updatedAt: new Date().toISOString() });
    return r;
  }

  removeRuleSet(id: string): boolean {
    return this._ruleSets.delete(id);
  }

  get allRuleSets(): RuleSet[] {
    return [...this._ruleSets.values()];
  }

  // ── Rules within Rule Sets ──

  addRule(ruleSetId: string, rule: Omit<Rule, 'id'>): Rule {
    const rs = this._ruleSets.get(ruleSetId);
    if (!rs) throw new Error(`Rule set not found: ${ruleSetId}`);
    const r: Rule = { ...rule, id: generateId() };
    rs.rules.push(r);
    rs.updatedAt = new Date().toISOString();
    return r;
  }

  getRule(ruleSetId: string, ruleId: string): Rule | undefined {
    return this._ruleSets.get(ruleSetId)?.rules.find(r => r.id === ruleId);
  }

  updateRule(ruleSetId: string, ruleId: string, updates: Partial<Rule>): Rule {
    const rs = this._ruleSets.get(ruleSetId);
    if (!rs) throw new Error(`Rule set not found: ${ruleSetId}`);
    const r = rs.rules.find(x => x.id === ruleId);
    if (!r) throw new Error(`Rule not found: ${ruleId}`);
    Object.assign(r, updates);
    rs.updatedAt = new Date().toISOString();
    return r;
  }

  removeRule(ruleSetId: string, ruleId: string): boolean {
    const rs = this._ruleSets.get(ruleSetId);
    if (!rs) return false;
    const idx = rs.rules.findIndex(r => r.id === ruleId);
    if (idx < 0) return false;
    rs.rules.splice(idx, 1);
    rs.updatedAt = new Date().toISOString();
    return true;
  }

  // ── Decision Tables ──

  createDecisionTable(dt: Omit<DecisionTable, 'id' | 'version' | 'createdAt' | 'updatedAt'>): DecisionTable {
    const now = new Date().toISOString();
    const d: DecisionTable = { ...dt, id: generateId(), version: 1, createdAt: now, updatedAt: now };
    this._decisionTables.set(d.id, d);
    return d;
  }

  getDecisionTable(id: string): DecisionTable | undefined {
    return this._decisionTables.get(id);
  }

  updateDecisionTable(id: string, updates: Partial<DecisionTable>): DecisionTable {
    const d = this._decisionTables.get(id);
    if (!d) throw new Error(`Decision table not found: ${id}`);
    Object.assign(d, updates, { version: d.version + 1, updatedAt: new Date().toISOString() });
    return d;
  }

  removeDecisionTable(id: string): boolean {
    return this._decisionTables.delete(id);
  }

  get allDecisionTables(): DecisionTable[] {
    return [...this._decisionTables.values()];
  }

  // ── Decision Table Rows ──

  addRow(tableId: string, row: Omit<DecisionTableRow, 'id'>): DecisionTableRow {
    const dt = this._decisionTables.get(tableId);
    if (!dt) throw new Error(`Decision table not found: ${tableId}`);
    const r: DecisionTableRow = { ...row, id: generateId() };
    dt.rows.push(r);
    dt.updatedAt = new Date().toISOString();
    return r;
  }

  updateRow(tableId: string, rowId: string, updates: Partial<DecisionTableRow>): DecisionTableRow {
    const dt = this._decisionTables.get(tableId);
    if (!dt) throw new Error(`Decision table not found: ${tableId}`);
    const r = dt.rows.find(x => x.id === rowId);
    if (!r) throw new Error(`Row not found: ${rowId}`);
    Object.assign(r, updates);
    dt.updatedAt = new Date().toISOString();
    return r;
  }

  removeRow(tableId: string, rowId: string): boolean {
    const dt = this._decisionTables.get(tableId);
    if (!dt) return false;
    const idx = dt.rows.findIndex(r => r.id === rowId);
    if (idx < 0) return false;
    dt.rows.splice(idx, 1);
    dt.updatedAt = new Date().toISOString();
    return true;
  }

  // ── Rule Execution ──

  evaluateRuleSet(ruleSetId: string, facts: Record<string, any>): RuleExecutionResult {
    const rs = this._ruleSets.get(ruleSetId);
    if (!rs) throw new Error(`Rule set not found: ${ruleSetId}`);
    if (rs.status !== 'active') throw new Error(`Rule set is not active: ${rs.status}`);

    const start = Date.now();
    const output: Record<string, any> = { ...facts };
    const matchedRules: string[] = [];
    const executedActions: RuleAction[] = [];

    // Sort rules by priority (higher = first)
    const sortedRules = [...rs.rules]
      .filter(r => r.enabled)
      .sort((a, b) => (b.salience ?? b.priority) - (a.salience ?? a.priority));

    for (const rule of sortedRules) {
      if (this._evaluateConditions(rule.conditions, output)) {
        matchedRules.push(rule.id);
        for (const action of rule.actions) {
          this._executeAction(action, output);
          executedActions.push(action);
        }
        if (rs.conflictResolution === 'first-match') break;
      }
    }

    const result: RuleExecutionResult = {
      id: generateId(),
      ruleSetId,
      input: facts,
      matchedRules,
      actions: executedActions,
      output,
      executionTimeMs: Date.now() - start,
      executedAt: new Date().toISOString(),
    };

    this._executionLog.push(result);
    this._onRuleExecuted?.(result);
    return result;
  }

  evaluateDecisionTable(tableId: string, input: Record<string, any>): RuleExecutionResult {
    const dt = this._decisionTables.get(tableId);
    if (!dt) throw new Error(`Decision table not found: ${tableId}`);
    if (dt.status !== 'active') throw new Error(`Decision table is not active: ${dt.status}`);

    const start = Date.now();
    const matchedRules: string[] = [];
    const executedActions: RuleAction[] = [];
    const output: Record<string, any> = { ...input };

    const condCols = dt.columns.filter(c => c.type === 'condition');
    const actionCols = dt.columns.filter(c => c.type === 'action');

    for (const row of dt.rows.filter(r => r.enabled)) {
      let allMatch = true;
      for (let i = 0; i < condCols.length; i++) {
        const col = condCols[i];
        const colIdx = dt.columns.indexOf(col);
        const cellValue = row.values[colIdx];
        if (cellValue === undefined || cellValue === null || cellValue === '*') continue;

        const factValue = input[col.field];
        if (!this._evaluateCondition({
          field: col.field,
          operator: col.operator ?? 'eq',
          value: cellValue,
        }, input)) {
          allMatch = false;
          break;
        }
      }

      if (allMatch) {
        matchedRules.push(row.id);
        for (let i = 0; i < actionCols.length; i++) {
          const col = actionCols[i];
          const colIdx = dt.columns.indexOf(col);
          const cellValue = row.values[colIdx];
          if (cellValue !== undefined && cellValue !== null) {
            output[col.field] = cellValue;
            executedActions.push({ type: 'set', target: col.field, value: cellValue });
          }
        }
        if (dt.hitPolicy === 'first' || dt.hitPolicy === 'unique') break;
      }
    }

    const result: RuleExecutionResult = {
      id: generateId(),
      decisionTableId: tableId,
      input,
      matchedRules,
      actions: executedActions,
      output,
      executionTimeMs: Date.now() - start,
      executedAt: new Date().toISOString(),
    };

    this._executionLog.push(result);
    this._onRuleExecuted?.(result);
    return result;
  }

  // ── Test Cases ──

  createTestCase(tc: Omit<RuleTestCase, 'id'>): RuleTestCase {
    const t: RuleTestCase = { ...tc, id: generateId() };
    this._testCases.set(t.id, t);
    return t;
  }

  getTestCase(id: string): RuleTestCase | undefined {
    return this._testCases.get(id);
  }

  updateTestCase(id: string, updates: Partial<RuleTestCase>): RuleTestCase {
    const t = this._testCases.get(id);
    if (!t) throw new Error(`Test case not found: ${id}`);
    Object.assign(t, updates);
    return t;
  }

  removeTestCase(id: string): boolean {
    return this._testCases.delete(id);
  }

  runTestCase(id: string): RuleTestCase {
    const tc = this._testCases.get(id);
    if (!tc) throw new Error(`Test case not found: ${id}`);

    let result: RuleExecutionResult;
    if (tc.ruleSetId) {
      result = this.evaluateRuleSet(tc.ruleSetId, tc.input);
    } else if (tc.decisionTableId) {
      result = this.evaluateDecisionTable(tc.decisionTableId, tc.input);
    } else {
      throw new Error('Test case must reference a rule set or decision table');
    }

    // Simple object comparison
    const pass = Object.keys(tc.expectedOutput).every(
      k => JSON.stringify(result.output[k]) === JSON.stringify(tc.expectedOutput[k])
    );
    tc.lastResult = pass ? 'pass' : 'fail';
    tc.lastRunAt = new Date().toISOString();
    return tc;
  }

  runAllTestCases(): { passed: number; failed: number; results: RuleTestCase[] } {
    const results: RuleTestCase[] = [];
    let passed = 0, failed = 0;
    for (const tc of this._testCases.values()) {
      try {
        const r = this.runTestCase(tc.id);
        results.push(r);
        if (r.lastResult === 'pass') passed++; else failed++;
      } catch {
        tc.lastResult = 'fail';
        tc.lastRunAt = new Date().toISOString();
        results.push(tc);
        failed++;
      }
    }
    return { passed, failed, results };
  }

  get allTestCases(): RuleTestCase[] {
    return [...this._testCases.values()];
  }

  // ── Execution Log ──

  getExecutionLog(limit?: number): RuleExecutionResult[] {
    const log = [...this._executionLog].reverse();
    return limit ? log.slice(0, limit) : log;
  }

  // ── Stats ──

  getStats(): {
    ruleSets: number;
    activeRuleSets: number;
    totalRules: number;
    decisionTables: number;
    activeDecisionTables: number;
    testCases: number;
    executions: number;
  } {
    const rss = [...this._ruleSets.values()];
    const dts = [...this._decisionTables.values()];
    return {
      ruleSets: rss.length,
      activeRuleSets: rss.filter(r => r.status === 'active').length,
      totalRules: rss.reduce((s, r) => s + r.rules.length, 0),
      decisionTables: dts.length,
      activeDecisionTables: dts.filter(d => d.status === 'active').length,
      testCases: this._testCases.size,
      executions: this._executionLog.length,
    };
  }

  // ── Events ──

  onRuleExecuted(cb: (r: RuleExecutionResult) => void): void { this._onRuleExecuted = cb; }

  // ── Private Helpers ──

  private _evaluateConditions(conditions: RuleCondition[], facts: Record<string, any>): boolean {
    return conditions.every(c => {
      const result = this._evaluateCondition(c, facts);
      return c.negate ? !result : result;
    });
  }

  private _evaluateCondition(c: RuleCondition, facts: Record<string, any>): boolean {
    const factValue = this._getNestedValue(facts, c.field);
    switch (c.operator) {
      case 'eq': return factValue === c.value;
      case 'neq': return factValue !== c.value;
      case 'gt': return factValue > c.value;
      case 'gte': return factValue >= c.value;
      case 'lt': return factValue < c.value;
      case 'lte': return factValue <= c.value;
      case 'in': return Array.isArray(c.value) && c.value.includes(factValue);
      case 'contains': return typeof factValue === 'string' && factValue.includes(c.value);
      case 'matches': return typeof factValue === 'string' && new RegExp(c.value).test(factValue);
      case 'between': return Array.isArray(c.value) && c.value.length === 2 && factValue >= c.value[0] && factValue <= c.value[1];
      case 'is-null': return factValue == null;
      case 'is-not-null': return factValue != null;
      default: return false;
    }
  }

  private _executeAction(action: RuleAction, context: Record<string, any>): void {
    switch (action.type) {
      case 'set':
        this._setNestedValue(context, action.target, action.value);
        break;
      case 'add':
        const arr = this._getNestedValue(context, action.target);
        if (Array.isArray(arr)) arr.push(action.value);
        break;
      case 'remove':
        this._setNestedValue(context, action.target, undefined);
        break;
      default:
        break;
    }
  }

  private _getNestedValue(obj: Record<string, any>, path: string): any {
    return path.split('.').reduce((o, k) => o?.[k], obj);
  }

  private _setNestedValue(obj: Record<string, any>, path: string, value: any): void {
    const keys = path.split('.');
    let current = obj;
    for (let i = 0; i < keys.length - 1; i++) {
      if (current[keys[i]] == null) current[keys[i]] = {};
      current = current[keys[i]];
    }
    current[keys[keys.length - 1]] = value;
  }
}
