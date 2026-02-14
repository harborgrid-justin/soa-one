// ============================================================
// SOA One DQM — Quality Rule Engine
// ============================================================

import type {
  QualityRuleDefinition,
  QualityRuleResult,
  QualityViolation,
  QualitySeverity,
  QualityCondition,
  ValidationResult,
  RuleEvaluationMode,
} from './types';

import { generateId } from './profiler';

// ── Format Patterns ─────────────────────────────────────────

const FORMAT_PATTERNS: Record<string, RegExp> = {
  email: /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/,
  phone: /^[+]?[(]?[0-9]{1,4}[)]?[-\s./0-9]{6,15}$/,
  url: /^https?:\/\/(?:www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b(?:[-a-zA-Z0-9()@:%_+.~#?&/=]*)$/,
  uuid: /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  date: /^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])$/,
  ip: /^(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)$/,
  ssn: /^\d{3}-\d{2}-\d{4}$/,
  zip: /^\d{5}(?:-\d{4})?$/,
  'credit-card': /^(?:4\d{12}(?:\d{3})?|5[1-5]\d{14}|3[47]\d{13}|3(?:0[0-5]|[68]\d)\d{11}|6(?:011|5\d{2})\d{12}|(?:2131|1800|35\d{3})\d{11})$/,
};

// ── Custom Validator ────────────────────────────────────────

/** Custom rule validator function. */
export type CustomRuleValidator = (
  value: any,
  row: Record<string, any>,
  parameters?: Record<string, any>,
) => boolean;

// ── Quality Rule Engine ─────────────────────────────────────

/**
 * Evaluates quality rules against data rows.
 *
 * Supports 21 rule types covering completeness, validity, consistency,
 * accuracy, timeliness, uniqueness, statistical, aggregate, schema,
 * volume, distribution, and custom business rules.
 *
 * Usage:
 * ```ts
 * const engine = new QualityRuleEngine();
 *
 * engine.registerRule({
 *   id: 'email-format',
 *   name: 'Email Format',
 *   type: 'format',
 *   severity: 'high',
 *   evaluationMode: 'row',
 *   column: 'email',
 *   parameters: { format: 'email' },
 *   enabled: true,
 * });
 *
 * const result = engine.evaluateAll(rows);
 * ```
 */
export class QualityRuleEngine {
  private readonly _rules = new Map<string, QualityRuleDefinition>();
  private readonly _customValidators = new Map<string, CustomRuleValidator>();

  // ── Rule Management ─────────────────────────────────────

  /** Register a quality rule. */
  registerRule(rule: QualityRuleDefinition): void {
    this._rules.set(rule.id, rule);
  }

  /** Unregister a quality rule. */
  unregisterRule(ruleId: string): void {
    this._rules.delete(ruleId);
  }

  /** Get a quality rule by ID. */
  getRule(ruleId: string): QualityRuleDefinition | undefined {
    return this._rules.get(ruleId);
  }

  /** Total registered rules. */
  get ruleCount(): number {
    return this._rules.size;
  }

  /** Total enabled rules. */
  get enabledRuleCount(): number {
    let count = 0;
    for (const rule of this._rules.values()) {
      if (rule.enabled) count++;
    }
    return count;
  }

  /** All registered rules. */
  get rules(): QualityRuleDefinition[] {
    return Array.from(this._rules.values());
  }

  /** Register a custom validator by name. */
  registerValidator(name: string, validator: CustomRuleValidator): void {
    this._customValidators.set(name, validator);
  }

  // ── Evaluation ──────────────────────────────────────────

  /** Evaluate a single rule against a dataset. */
  evaluateRule(
    rule: QualityRuleDefinition,
    rows: Record<string, any>[],
  ): QualityRuleResult {
    const startTime = Date.now();
    const violations: QualityViolation[] = [];

    // Dataset-level rules operate on the full set
    if (rule.evaluationMode === 'dataset' || rule.evaluationMode === 'aggregate') {
      const datasetViolations = this._evaluateDatasetRule(rule, rows);
      violations.push(...datasetViolations);
    } else {
      // Row-level evaluation
      for (let i = 0; i < rows.length; i++) {
        const violation = this._evaluateRowRule(rule, rows[i], i);
        if (violation) {
          violations.push(violation);
        }
      }
    }

    const passedRows = rows.length - violations.length;
    return {
      ruleId: rule.id,
      ruleName: rule.name,
      ruleType: rule.type,
      passed: violations.length === 0,
      severity: rule.severity,
      totalRows: rows.length,
      passedRows,
      failedRows: violations.length,
      passRate: rows.length > 0 ? passedRows / rows.length : 1,
      violations,
      executionTimeMs: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    };
  }

  /** Evaluate all registered (or specified) rules against a dataset. */
  evaluateAll(
    rows: Record<string, any>[],
    ruleIds?: string[],
  ): ValidationResult {
    const startTime = Date.now();
    const rulesToEval = ruleIds
      ? ruleIds
          .map((id) => this._rules.get(id))
          .filter((r): r is QualityRuleDefinition => r !== undefined && r.enabled)
      : Array.from(this._rules.values()).filter((r) => r.enabled);

    const results: QualityRuleResult[] = [];
    let totalViolations = 0;
    let criticalViolations = 0;
    let passedRules = 0;

    for (const rule of rulesToEval) {
      const result = this.evaluateRule(rule, rows);
      results.push(result);
      totalViolations += result.violations.length;
      criticalViolations += result.violations.filter(
        (v) => v.severity === 'critical',
      ).length;
      if (result.passed) passedRules++;
    }

    const failedRules = results.length - passedRules;
    const overallPassRate =
      results.length > 0 ? passedRules / results.length : 1;

    return {
      datasetName: '',
      totalRules: results.length,
      passedRules,
      failedRules,
      totalViolations,
      criticalViolations,
      results,
      overallPassRate,
      executionTimeMs: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    };
  }

  /** Validate a single row against registered (or specified) rules. */
  validateRow(
    row: Record<string, any>,
    ruleIds?: string[],
  ): QualityViolation[] {
    const violations: QualityViolation[] = [];
    const rulesToEval = ruleIds
      ? ruleIds
          .map((id) => this._rules.get(id))
          .filter((r): r is QualityRuleDefinition => r !== undefined && r.enabled)
      : Array.from(this._rules.values()).filter((r) => r.enabled);

    for (const rule of rulesToEval) {
      // Only row-level rules can be evaluated on a single row
      if (rule.evaluationMode !== 'dataset' && rule.evaluationMode !== 'aggregate') {
        const violation = this._evaluateRowRule(rule, row, 0);
        if (violation) {
          violations.push(violation);
        }
      }
    }

    return violations;
  }

  // ── Private: Row Evaluation ─────────────────────────────

  private _evaluateRowRule(
    rule: QualityRuleDefinition,
    row: Record<string, any>,
    rowNumber: number,
  ): QualityViolation | null {
    let passed: boolean;

    switch (rule.type) {
      case 'not-null':
        passed = this._checkNotNull(row, rule);
        break;
      case 'unique':
        // Uniqueness is a dataset-level check; always passes at row level.
        passed = true;
        break;
      case 'range':
        passed = this._checkRange(row, rule);
        break;
      case 'pattern':
        passed = this._checkPattern(row, rule);
        break;
      case 'format':
        passed = this._checkFormat(row, rule);
        break;
      case 'domain':
        passed = this._checkDomain(row, rule);
        break;
      case 'referential':
        passed = this._checkReferential(row, rule);
        break;
      case 'consistency':
        passed = this._checkConsistency(row, rule);
        break;
      case 'completeness':
        passed = this._checkCompleteness(row, rule);
        break;
      case 'accuracy':
        passed = this._checkAccuracy(row, rule);
        break;
      case 'timeliness':
        passed = this._checkTimeliness(row, rule);
        break;
      case 'statistical':
        // Dataset-level; passes at row level.
        passed = true;
        break;
      case 'business':
        passed = this._checkBusiness(row, rule);
        break;
      case 'custom':
        passed = this._checkCustom(row, rule);
        break;
      case 'cross-field':
        passed = this._checkCrossField(row, rule);
        break;
      case 'conditional':
        passed = this._checkConditional(row, rule);
        break;
      case 'aggregate':
        // Dataset-level; passes at row level.
        passed = true;
        break;
      case 'schema':
        passed = this._checkSchema(row, rule);
        break;
      case 'freshness':
        passed = this._checkFreshness(row, rule);
        break;
      case 'volume':
        // Dataset-level; passes at row level.
        passed = true;
        break;
      case 'distribution':
        // Dataset-level; passes at row level.
        passed = true;
        break;
      default:
        passed = true;
    }

    if (passed) return null;

    return {
      ruleId: rule.id,
      rowNumber,
      column: rule.column,
      actualValue: rule.column ? row[rule.column] : undefined,
      expectedValue: this._getExpectedDescription(rule),
      message: `Quality rule '${rule.name}' violated`,
      data: rule.columns
        ? Object.fromEntries(rule.columns.map((c) => [c, row[c]]))
        : undefined,
      severity: rule.severity,
    };
  }

  // ── Private: Dataset-Level Evaluation ───────────────────

  private _evaluateDatasetRule(
    rule: QualityRuleDefinition,
    rows: Record<string, any>[],
  ): QualityViolation[] {
    switch (rule.type) {
      case 'unique':
        return this._checkUnique(rows, rule);
      case 'statistical':
        return this._checkStatistical(rows, rule);
      case 'aggregate':
        return this._checkAggregate(rows, rule);
      case 'volume':
        return this._checkVolume(rows, rule);
      case 'distribution':
        return this._checkDistribution(rows, rule);
      default:
        return [];
    }
  }

  // ── Private: Rule Type Implementations ──────────────────

  /** Check that the target column(s) are not null, undefined, or empty. */
  private _checkNotNull(
    row: Record<string, any>,
    rule: QualityRuleDefinition,
  ): boolean {
    const cols = rule.columns ?? (rule.column ? [rule.column] : []);
    return cols.every(
      (c) => row[c] !== null && row[c] !== undefined && row[c] !== '',
    );
  }

  /** Dataset-level: check that values in a column are unique. */
  private _checkUnique(
    rows: Record<string, any>[],
    rule: QualityRuleDefinition,
  ): QualityViolation[] {
    const violations: QualityViolation[] = [];
    if (!rule.column) return violations;

    const seen = new Map<string, number>();
    for (let i = 0; i < rows.length; i++) {
      const value = String(rows[i][rule.column] ?? '');
      const prevIndex = seen.get(value);
      if (prevIndex !== undefined) {
        violations.push({
          ruleId: rule.id,
          rowNumber: i,
          column: rule.column,
          actualValue: rows[i][rule.column],
          expectedValue: 'unique value',
          message: `Quality rule '${rule.name}' violated: duplicate value '${value}' (first seen at row ${prevIndex})`,
          severity: rule.severity,
        });
      } else {
        seen.set(value, i);
      }
    }

    return violations;
  }

  /** Check that a numeric value falls within min/max bounds (inclusive). */
  private _checkRange(
    row: Record<string, any>,
    rule: QualityRuleDefinition,
  ): boolean {
    if (!rule.column) return true;
    const value = Number(row[rule.column]);
    if (isNaN(value)) return false;

    const min = rule.parameters?.min;
    const max = rule.parameters?.max;
    if (min !== undefined && value < Number(min)) return false;
    if (max !== undefined && value > Number(max)) return false;
    return true;
  }

  /** Check that a string value matches a regex pattern. */
  private _checkPattern(
    row: Record<string, any>,
    rule: QualityRuleDefinition,
  ): boolean {
    if (!rule.column) return true;
    const pattern = rule.parameters?.pattern;
    if (!pattern) return true;

    const value = String(row[rule.column] ?? '');
    try {
      return new RegExp(pattern).test(value);
    } catch {
      return true;
    }
  }

  /** Check named formats: email, phone, url, uuid, date, ip, ssn, zip, credit-card. */
  private _checkFormat(
    row: Record<string, any>,
    rule: QualityRuleDefinition,
  ): boolean {
    if (!rule.column) return true;
    const formatName = rule.parameters?.format as string | undefined;
    if (!formatName) return true;

    const value = row[rule.column];
    if (value === null || value === undefined || value === '') return false;

    const regex = FORMAT_PATTERNS[formatName];
    if (!regex) return true;

    const strValue = String(value);

    // For credit-card, strip spaces and dashes before testing
    if (formatName === 'credit-card') {
      return regex.test(strValue.replace(/[\s-]/g, ''));
    }

    return regex.test(strValue);
  }

  /** Check that a value is within an allowed set. */
  private _checkDomain(
    row: Record<string, any>,
    rule: QualityRuleDefinition,
  ): boolean {
    if (!rule.column) return true;
    const allowed = rule.parameters?.allowedValues as any[] | undefined;
    if (!allowed || !Array.isArray(allowed)) return true;
    return allowed.includes(row[rule.column]);
  }

  /** Check value against a reference set (referential integrity). */
  private _checkReferential(
    row: Record<string, any>,
    rule: QualityRuleDefinition,
  ): boolean {
    if (!rule.column) return true;
    const refSet = rule.parameters?.referenceSet as any[] | undefined;
    if (!refSet || !Array.isArray(refSet)) return true;
    return refSet.includes(row[rule.column]);
  }

  /** Cross-field consistency: evaluate a JS-like expression referencing row fields. */
  private _checkConsistency(
    row: Record<string, any>,
    rule: QualityRuleDefinition,
  ): boolean {
    const expression = rule.parameters?.expression as string | undefined;
    if (!expression) return true;

    try {
      const resolved = expression.replace(
        /\$\{(\w+)\}/g,
        (_match: string, field: string) => {
          const val = row[field];
          return val === undefined ? 'null' : JSON.stringify(val);
        },
      );
      return Boolean(Function(`"use strict"; return (${resolved})`)());
    } catch {
      return true;
    }
  }

  /** Check that all target columns are non-null (completeness). */
  private _checkCompleteness(
    row: Record<string, any>,
    rule: QualityRuleDefinition,
  ): boolean {
    const cols =
      rule.columns ?? (rule.column ? [rule.column] : Object.keys(row));
    const threshold = rule.threshold ?? 1.0;
    const nonNullCount = cols.filter(
      (c) => row[c] !== null && row[c] !== undefined && row[c] !== '',
    ).length;
    return cols.length > 0 ? nonNullCount / cols.length >= threshold : true;
  }

  /** Accuracy: placeholder, always passes. Requires external reference data. */
  private _checkAccuracy(
    _row: Record<string, any>,
    _rule: QualityRuleDefinition,
  ): boolean {
    return true;
  }

  /** Check that a date field is within maxAgeMs of now. */
  private _checkTimeliness(
    row: Record<string, any>,
    rule: QualityRuleDefinition,
  ): boolean {
    if (!rule.column) return true;
    const maxAgeMs = rule.parameters?.maxAgeMs as number | undefined;
    if (maxAgeMs === undefined) return true;

    try {
      const date = new Date(row[rule.column]);
      if (isNaN(date.getTime())) return false;
      const ageMs = Date.now() - date.getTime();
      return ageMs <= maxAgeMs;
    } catch {
      return true;
    }
  }

  /** Dataset-level: detect outliers via z-score. */
  private _checkStatistical(
    rows: Record<string, any>[],
    rule: QualityRuleDefinition,
  ): QualityViolation[] {
    const violations: QualityViolation[] = [];
    if (!rule.column) return violations;

    const zThreshold = (rule.parameters?.zScoreThreshold as number) ?? 3;
    const values: number[] = [];
    const indices: number[] = [];

    for (let i = 0; i < rows.length; i++) {
      const v = Number(rows[i][rule.column]);
      if (!isNaN(v)) {
        values.push(v);
        indices.push(i);
      }
    }

    if (values.length < 2) return violations;

    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance =
      values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) /
      values.length;
    const stdDev = Math.sqrt(variance);

    if (stdDev === 0) return violations;

    for (let j = 0; j < values.length; j++) {
      const zScore = Math.abs((values[j] - mean) / stdDev);
      if (zScore > zThreshold) {
        violations.push({
          ruleId: rule.id,
          rowNumber: indices[j],
          column: rule.column,
          actualValue: values[j],
          expectedValue: `z-score <= ${zThreshold} (actual z-score: ${zScore.toFixed(2)})`,
          message: `Quality rule '${rule.name}' violated: statistical outlier detected`,
          severity: rule.severity,
        });
      }
    }

    return violations;
  }

  /** Evaluate a JS-like business expression against a row. */
  private _checkBusiness(
    row: Record<string, any>,
    rule: QualityRuleDefinition,
  ): boolean {
    const expression = rule.parameters?.expression as string | undefined;
    if (!expression) return true;

    try {
      const resolved = expression.replace(
        /\$\{(\w+)\}/g,
        (_match: string, field: string) => {
          const val = row[field];
          return val === undefined ? 'null' : JSON.stringify(val);
        },
      );
      return Boolean(Function(`"use strict"; return (${resolved})`)());
    } catch {
      return true;
    }
  }

  /** Use a registered custom validator. */
  private _checkCustom(
    row: Record<string, any>,
    rule: QualityRuleDefinition,
  ): boolean {
    const validatorName = rule.parameters?.validator as string | undefined;
    if (!validatorName) return true;

    const validator = this._customValidators.get(validatorName);
    if (!validator) return true;

    return validator(
      rule.column ? row[rule.column] : row,
      row,
      rule.parameters,
    );
  }

  /** Compare two fields using a comparison operator. */
  private _checkCrossField(
    row: Record<string, any>,
    rule: QualityRuleDefinition,
  ): boolean {
    const field1 = rule.parameters?.field1 as string | undefined;
    const field2 = rule.parameters?.field2 as string | undefined;
    const comparison = rule.parameters?.comparison as string | undefined;
    if (!field1 || !field2 || !comparison) return true;

    const val1 = row[field1];
    const val2 = row[field2];

    switch (comparison) {
      case 'eq':
      case '==':
      case '===':
        return val1 === val2;
      case 'neq':
      case '!=':
      case '!==':
        return val1 !== val2;
      case 'gt':
      case '>':
        return Number(val1) > Number(val2);
      case 'gte':
      case '>=':
        return Number(val1) >= Number(val2);
      case 'lt':
      case '<':
        return Number(val1) < Number(val2);
      case 'lte':
      case '<=':
        return Number(val1) <= Number(val2);
      case 'contains':
        return String(val1).includes(String(val2));
      case 'starts-with':
        return String(val1).startsWith(String(val2));
      case 'ends-with':
        return String(val1).endsWith(String(val2));
      default:
        return true;
    }
  }

  /** If a condition is met, then evaluate an inner rule check. */
  private _checkConditional(
    row: Record<string, any>,
    rule: QualityRuleDefinition,
  ): boolean {
    if (!rule.condition) return true;

    const conditionMet = this._evaluateCondition(row, rule.condition);
    if (!conditionMet) return true; // Condition not met, rule does not apply

    // When condition is met, evaluate the inner check defined by parameters
    const innerType = rule.parameters?.thenType as string | undefined;
    if (!innerType) return true;

    const innerRule: QualityRuleDefinition = {
      ...rule,
      type: innerType as QualityRuleDefinition['type'],
      condition: undefined,
    };

    // Re-dispatch through row evaluation
    switch (innerType) {
      case 'not-null':
        return this._checkNotNull(row, innerRule);
      case 'range':
        return this._checkRange(row, innerRule);
      case 'pattern':
        return this._checkPattern(row, innerRule);
      case 'format':
        return this._checkFormat(row, innerRule);
      case 'domain':
        return this._checkDomain(row, innerRule);
      case 'completeness':
        return this._checkCompleteness(row, innerRule);
      case 'cross-field':
        return this._checkCrossField(row, innerRule);
      case 'consistency':
        return this._checkConsistency(row, innerRule);
      case 'business':
        return this._checkBusiness(row, innerRule);
      case 'custom':
        return this._checkCustom(row, innerRule);
      default:
        return true;
    }
  }

  /** Dataset-level: check aggregates (sum, avg, count, min, max) against a threshold. */
  private _checkAggregate(
    rows: Record<string, any>[],
    rule: QualityRuleDefinition,
  ): QualityViolation[] {
    const violations: QualityViolation[] = [];
    if (!rule.column) return violations;

    const aggregation = (rule.parameters?.aggregation as string) ?? 'count';
    const operator = (rule.parameters?.operator as string) ?? '>=';
    const threshold = rule.parameters?.threshold as number | undefined;
    if (threshold === undefined) return violations;

    const values = rows
      .map((r) => Number(r[rule.column!]))
      .filter((v) => !isNaN(v));

    let aggregateValue: number;

    switch (aggregation) {
      case 'sum':
        aggregateValue = values.reduce((a, b) => a + b, 0);
        break;
      case 'avg':
      case 'average':
        aggregateValue =
          values.length > 0
            ? values.reduce((a, b) => a + b, 0) / values.length
            : 0;
        break;
      case 'count':
        aggregateValue = values.length;
        break;
      case 'min':
        aggregateValue = values.length > 0 ? Math.min(...values) : 0;
        break;
      case 'max':
        aggregateValue = values.length > 0 ? Math.max(...values) : 0;
        break;
      default:
        return violations;
    }

    const passed = this._compareValues(aggregateValue, operator, threshold);

    if (!passed) {
      violations.push({
        ruleId: rule.id,
        rowNumber: -1,
        column: rule.column,
        actualValue: aggregateValue,
        expectedValue: `${aggregation} ${operator} ${threshold}`,
        message: `Quality rule '${rule.name}' violated: ${aggregation}(${rule.column}) = ${aggregateValue}, expected ${operator} ${threshold}`,
        severity: rule.severity,
      });
    }

    return violations;
  }

  /** Validate row structure: required fields and field types. */
  private _checkSchema(
    row: Record<string, any>,
    rule: QualityRuleDefinition,
  ): boolean {
    const requiredFields = rule.parameters?.requiredFields as
      | string[]
      | undefined;
    const fieldTypes = rule.parameters?.fieldTypes as
      | Record<string, string>
      | undefined;

    if (requiredFields) {
      for (const field of requiredFields) {
        if (!(field in row) || row[field] === null || row[field] === undefined) {
          return false;
        }
      }
    }

    if (fieldTypes) {
      for (const [field, expectedType] of Object.entries(fieldTypes)) {
        if (!(field in row) || row[field] === null || row[field] === undefined) {
          continue; // Missing fields are handled by requiredFields
        }

        const actual = typeof row[field];
        switch (expectedType) {
          case 'string':
            if (actual !== 'string') return false;
            break;
          case 'number':
          case 'integer':
          case 'float':
            if (actual !== 'number' && isNaN(Number(row[field]))) return false;
            break;
          case 'boolean':
            if (actual !== 'boolean') return false;
            break;
          case 'object':
            if (actual !== 'object' || Array.isArray(row[field])) return false;
            break;
          case 'array':
            if (!Array.isArray(row[field])) return false;
            break;
          case 'date':
            if (isNaN(new Date(row[field]).getTime())) return false;
            break;
          default:
            break;
        }
      }
    }

    return true;
  }

  /** Check data ingestion freshness: timestamp field within maxAgeMs of now. */
  private _checkFreshness(
    row: Record<string, any>,
    rule: QualityRuleDefinition,
  ): boolean {
    const column = rule.parameters?.timestampField as string | undefined ?? rule.column;
    if (!column) return true;

    const maxAgeMs = rule.parameters?.maxAgeMs as number | undefined;
    if (maxAgeMs === undefined) return true;

    try {
      const date = new Date(row[column]);
      if (isNaN(date.getTime())) return false;
      const ageMs = Date.now() - date.getTime();
      return ageMs <= maxAgeMs;
    } catch {
      return true;
    }
  }

  /** Dataset-level: check that row count falls within expected min/max range. */
  private _checkVolume(
    rows: Record<string, any>[],
    rule: QualityRuleDefinition,
  ): QualityViolation[] {
    const violations: QualityViolation[] = [];
    const minRows = rule.parameters?.minRows as number | undefined;
    const maxRows = rule.parameters?.maxRows as number | undefined;
    const count = rows.length;

    if (minRows !== undefined && count < minRows) {
      violations.push({
        ruleId: rule.id,
        rowNumber: -1,
        column: undefined,
        actualValue: count,
        expectedValue: `row count >= ${minRows}`,
        message: `Quality rule '${rule.name}' violated: dataset has ${count} rows, expected at least ${minRows}`,
        severity: rule.severity,
      });
    }

    if (maxRows !== undefined && count > maxRows) {
      violations.push({
        ruleId: rule.id,
        rowNumber: -1,
        column: undefined,
        actualValue: count,
        expectedValue: `row count <= ${maxRows}`,
        message: `Quality rule '${rule.name}' violated: dataset has ${count} rows, expected at most ${maxRows}`,
        severity: rule.severity,
      });
    }

    return violations;
  }

  /** Dataset-level: check if distribution of values matches expected distribution. */
  private _checkDistribution(
    rows: Record<string, any>[],
    rule: QualityRuleDefinition,
  ): QualityViolation[] {
    const violations: QualityViolation[] = [];
    if (!rule.column) return violations;

    const expectedDist = rule.parameters?.expectedDistribution as
      | Record<string, number>
      | undefined;
    if (!expectedDist) return violations;

    const tolerance = (rule.parameters?.tolerance as number) ?? 0.1;

    // Build actual distribution
    const counts = new Map<string, number>();
    let total = 0;
    for (const row of rows) {
      const val = String(row[rule.column] ?? '');
      counts.set(val, (counts.get(val) ?? 0) + 1);
      total++;
    }

    if (total === 0) return violations;

    // Compare expected vs actual proportions
    for (const [value, expectedProportion] of Object.entries(expectedDist)) {
      const actualCount = counts.get(value) ?? 0;
      const actualProportion = actualCount / total;
      const diff = Math.abs(actualProportion - expectedProportion);

      if (diff > tolerance) {
        violations.push({
          ruleId: rule.id,
          rowNumber: -1,
          column: rule.column,
          actualValue: actualProportion,
          expectedValue: `proportion of '${value}' ~= ${expectedProportion} (+/- ${tolerance})`,
          message: `Quality rule '${rule.name}' violated: distribution mismatch for '${value}' (actual: ${(actualProportion * 100).toFixed(1)}%, expected: ${(expectedProportion * 100).toFixed(1)}%)`,
          severity: rule.severity,
        });
      }
    }

    return violations;
  }

  // ── Private: Helpers ────────────────────────────────────

  /** Evaluate a quality condition against a row. */
  private _evaluateCondition(
    row: Record<string, any>,
    condition: QualityCondition,
  ): boolean {
    const { field, operator, value, logicalOperator, children } = condition;

    const fieldValue = row[field];
    let result: boolean;

    switch (operator) {
      case '==':
      case 'eq':
      case 'equals':
        result = fieldValue == value; // eslint-disable-line eqeqeq
        break;
      case '===':
      case 'strict-equals':
        result = fieldValue === value;
        break;
      case '!=':
      case 'neq':
      case 'not-equals':
        result = fieldValue != value; // eslint-disable-line eqeqeq
        break;
      case '>':
      case 'gt':
        result = Number(fieldValue) > Number(value);
        break;
      case '>=':
      case 'gte':
        result = Number(fieldValue) >= Number(value);
        break;
      case '<':
      case 'lt':
        result = Number(fieldValue) < Number(value);
        break;
      case '<=':
      case 'lte':
        result = Number(fieldValue) <= Number(value);
        break;
      case 'in':
        result = Array.isArray(value) && value.includes(fieldValue);
        break;
      case 'not-in':
        result = Array.isArray(value) && !value.includes(fieldValue);
        break;
      case 'contains':
        result = String(fieldValue).includes(String(value));
        break;
      case 'starts-with':
        result = String(fieldValue).startsWith(String(value));
        break;
      case 'ends-with':
        result = String(fieldValue).endsWith(String(value));
        break;
      case 'is-null':
        result = fieldValue === null || fieldValue === undefined;
        break;
      case 'is-not-null':
        result = fieldValue !== null && fieldValue !== undefined;
        break;
      case 'matches':
        try {
          result = new RegExp(String(value)).test(String(fieldValue ?? ''));
        } catch {
          result = false;
        }
        break;
      default:
        result = true;
    }

    // Evaluate children with logical operators
    if (children && children.length > 0) {
      const childResults = children.map((child) =>
        this._evaluateCondition(row, child),
      );

      if (logicalOperator === 'OR') {
        return result || childResults.some((r) => r);
      }
      // Default to AND
      return result && childResults.every((r) => r);
    }

    return result;
  }

  /** Compare two values using an operator string. */
  private _compareValues(
    actual: number,
    operator: string,
    expected: number,
  ): boolean {
    switch (operator) {
      case '==':
      case '===':
      case 'eq':
        return actual === expected;
      case '!=':
      case '!==':
      case 'neq':
        return actual !== expected;
      case '>':
      case 'gt':
        return actual > expected;
      case '>=':
      case 'gte':
        return actual >= expected;
      case '<':
      case 'lt':
        return actual < expected;
      case '<=':
      case 'lte':
        return actual <= expected;
      default:
        return actual >= expected;
    }
  }

  /** Build a human-readable description of what a rule expects. */
  private _getExpectedDescription(rule: QualityRuleDefinition): string {
    switch (rule.type) {
      case 'not-null':
        return 'NOT NULL';
      case 'range':
        return `${rule.parameters?.min ?? '*'} - ${rule.parameters?.max ?? '*'}`;
      case 'pattern':
        return String(rule.parameters?.pattern ?? rule.type);
      case 'format':
        return String(rule.parameters?.format ?? rule.type);
      case 'domain':
        return `one of [${(rule.parameters?.allowedValues ?? []).join(', ')}]`;
      case 'referential':
        return 'value in reference set';
      case 'completeness':
        return `completeness >= ${rule.threshold ?? 1.0}`;
      case 'consistency':
      case 'business':
        return String(rule.parameters?.expression ?? rule.type);
      case 'timeliness':
      case 'freshness':
        return `age <= ${rule.parameters?.maxAgeMs ?? '?'}ms`;
      case 'cross-field':
        return `${rule.parameters?.field1 ?? '?'} ${rule.parameters?.comparison ?? '?'} ${rule.parameters?.field2 ?? '?'}`;
      case 'schema':
        return 'valid schema';
      case 'custom':
        return `custom validator '${rule.parameters?.validator ?? '?'}'`;
      default:
        return rule.type;
    }
  }
}
