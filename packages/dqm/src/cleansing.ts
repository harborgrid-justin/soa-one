// ============================================================
// SOA One DQM — Data Cleansing Engine
// ============================================================
//
// Comprehensive data cleansing engine: 29 built-in cleansing
// operations covering string, numeric, date, domain-specific,
// and custom transformations.
//
// Features:
// - 29 built-in cleansing rule types
// - Conditional rule application via QualityCondition
// - Custom cleanser registration
// - Lookup table replacements
// - Batch cleansing with detailed result tracking
// - Priority-based rule ordering
// - Per-column or whole-row cleansing
//
// Zero external dependencies.
// ============================================================

import type {
  CleansingRuleDefinition,
  CleansingResult,
  CleansingBatchResult,
  QualityCondition,
} from './types';

import { generateId } from './profiler';

// ── Custom Cleanser ────────────────────────────────────────

/** Custom cleanser function. */
export type CustomCleanser = (
  value: any,
  parameters?: Record<string, any>,
) => any;

// ── Data Cleansing Engine ──────────────────────────────────

/**
 * Applies cleansing rules to improve data quality across 29
 * built-in cleansing operation types plus custom cleansers.
 *
 * Usage:
 * ```ts
 * const engine = new DataCleansingEngine();
 *
 * engine.registerRule({
 *   id: 'trim-names',
 *   name: 'Trim Name Fields',
 *   type: 'trim',
 *   column: 'name',
 *   enabled: true,
 *   priority: 1,
 * });
 *
 * const cleaned = engine.cleanseRow({ name: '  Alice  ' });
 * // { name: 'Alice' }
 * ```
 */
export class DataCleansingEngine {
  private readonly _rules = new Map<string, CleansingRuleDefinition>();
  private readonly _customCleansers = new Map<string, CustomCleanser>();
  private readonly _lookupTables = new Map<string, Map<string, any>>();

  // ── Rule Management ─────────────────────────────────────

  /** Register a cleansing rule. */
  registerRule(rule: CleansingRuleDefinition): void {
    this._rules.set(rule.id, rule);
  }

  /** Unregister a cleansing rule. */
  unregisterRule(ruleId: string): void {
    this._rules.delete(ruleId);
  }

  /** Get a cleansing rule by ID. */
  getRule(ruleId: string): CleansingRuleDefinition | undefined {
    return this._rules.get(ruleId);
  }

  /** Total number of registered rules. */
  get ruleCount(): number {
    return this._rules.size;
  }

  /** List all registered rules. */
  get rules(): CleansingRuleDefinition[] {
    return Array.from(this._rules.values());
  }

  // ── Custom Cleanser & Lookup Registration ───────────────

  /** Register a custom cleanser function. */
  registerCleanser(name: string, cleanser: CustomCleanser): void {
    this._customCleansers.set(name, cleanser);
  }

  /** Register a lookup table for lookup-replace rules. */
  registerLookupTable(name: string, table: Map<string, any>): void {
    this._lookupTables.set(name, table);
  }

  // ── Cleansing Operations ────────────────────────────────

  /** Apply registered rules to a single row. Returns a new object. */
  cleanseRow(
    row: Record<string, any>,
    ruleIds?: string[],
  ): Record<string, any> {
    const result = { ...row };

    const applicableRules = this._getApplicableRules(ruleIds);

    for (const rule of applicableRules) {
      if (rule.condition && !this._evaluateCondition(result, rule.condition)) {
        continue;
      }

      const column = rule.column;
      result[column] = this._applyRule(result[column], rule);
    }

    return result;
  }

  /** Apply registered rules to an entire dataset. */
  cleanseDataset(
    rows: Record<string, any>[],
    ruleIds?: string[],
  ): { rows: Record<string, any>[]; result: CleansingBatchResult } {
    const startTime = Date.now();
    const applicableRules = this._getApplicableRules(ruleIds);

    const ruleResults: CleansingResult[] = [];
    let cleansedRows = rows.map((r) => ({ ...r }));

    for (const rule of applicableRules) {
      const ruleStartTime = Date.now();
      let modifiedRows = 0;
      let errors = 0;

      for (let i = 0; i < cleansedRows.length; i++) {
        const row = cleansedRows[i];

        if (rule.condition && !this._evaluateCondition(row, rule.condition)) {
          continue;
        }

        const column = rule.column;
        const before = row[column];

        try {
          const after = this._applyRule(before, rule);
          if (before !== after) {
            cleansedRows[i] = { ...row, [column]: after };
            modifiedRows++;
          }
        } catch {
          errors++;
        }
      }

      ruleResults.push({
        ruleId: rule.id,
        ruleName: rule.name,
        column: rule.column,
        totalRows: cleansedRows.length,
        modifiedRows,
        modifiedPercentage:
          cleansedRows.length > 0
            ? (modifiedRows / cleansedRows.length) * 100
            : 0,
        errors,
        executionTimeMs: Date.now() - ruleStartTime,
      });
    }

    const totalModifiedRows = ruleResults.reduce(
      (sum, r) => sum + r.modifiedRows,
      0,
    );
    const totalErrors = ruleResults.reduce(
      (sum, r) => sum + r.errors,
      0,
    );

    return {
      rows: cleansedRows,
      result: {
        totalRules: applicableRules.length,
        results: ruleResults,
        totalModifiedRows,
        totalErrors,
        executionTimeMs: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      },
    };
  }

  /** Apply a single cleansing operation to a value. */
  cleanseValue(
    value: any,
    ruleType: CleansingRuleDefinition['type'],
    parameters?: Record<string, any>,
  ): any {
    const syntheticRule: CleansingRuleDefinition = {
      id: generateId(),
      name: `inline-${ruleType}`,
      type: ruleType,
      column: '',
      enabled: true,
      priority: 0,
      parameters,
    };

    return this._applyRule(value, syntheticRule);
  }

  // ── Private: Rule Resolution ────────────────────────────

  private _getApplicableRules(
    ruleIds?: string[],
  ): CleansingRuleDefinition[] {
    let rules: CleansingRuleDefinition[];

    if (ruleIds) {
      rules = ruleIds
        .map((id) => this._rules.get(id))
        .filter(
          (r): r is CleansingRuleDefinition =>
            r !== undefined && r.enabled,
        );
    } else {
      rules = Array.from(this._rules.values()).filter((r) => r.enabled);
    }

    return [...rules].sort((a, b) => a.priority - b.priority);
  }

  // ── Private: Rule Dispatch ──────────────────────────────

  private _applyRule(
    value: any,
    rule: CleansingRuleDefinition,
  ): any {
    const params = rule.parameters;

    switch (rule.type) {
      case 'trim':
        return this._trim(value);
      case 'uppercase':
        return this._uppercase(value);
      case 'lowercase':
        return this._lowercase(value);
      case 'title-case':
        return this._titleCase(value);
      case 'remove-whitespace':
        return this._removeWhitespace(value);
      case 'normalize-whitespace':
        return this._normalizeWhitespace(value);
      case 'replace':
        return this._replace(value, params);
      case 'regex-replace':
        return this._regexReplace(value, params);
      case 'remove-special-chars':
        return this._removeSpecialChars(value);
      case 'remove-digits':
        return this._removeDigits(value);
      case 'remove-non-digits':
        return this._removeNonDigits(value);
      case 'null-fill':
        return this._nullFill(value, params);
      case 'default-value':
        return this._defaultValue(value, params);
      case 'truncate':
        return this._truncate(value, params);
      case 'pad-left':
        return this._padLeft(value, params);
      case 'pad-right':
        return this._padRight(value, params);
      case 'round':
        return this._round(value, params);
      case 'ceil':
        return this._ceil(value);
      case 'floor':
        return this._floor(value);
      case 'absolute':
        return this._absolute(value);
      case 'clamp':
        return this._clamp(value, params);
      case 'date-format':
        return this._dateFormat(value, params);
      case 'date-parse':
        return this._dateParse(value, params);
      case 'phone-normalize':
        return this._phoneNormalize(value);
      case 'email-normalize':
        return this._emailNormalize(value);
      case 'address-standardize':
        return this._addressStandardize(value);
      case 'name-standardize':
        return this._nameStandardize(value);
      case 'lookup-replace':
        return this._lookupReplace(value, params);
      case 'type-cast':
        return this._typeCast(value, params);
      case 'custom':
        return this._custom(value, params);
      default:
        return value;
    }
  }

  // ── Private: String Operations ──────────────────────────

  /** Trim leading and trailing whitespace. */
  private _trim(value: any): any {
    if (typeof value !== 'string') return value;
    return value.trim();
  }

  /** Convert to uppercase. */
  private _uppercase(value: any): any {
    if (typeof value !== 'string') return value;
    return value.toUpperCase();
  }

  /** Convert to lowercase. */
  private _lowercase(value: any): any {
    if (typeof value !== 'string') return value;
    return value.toLowerCase();
  }

  /** Convert to title case (capitalize first letter of each word). */
  private _titleCase(value: any): any {
    if (typeof value !== 'string') return value;
    return value
      .toLowerCase()
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }

  /** Remove all whitespace characters. */
  private _removeWhitespace(value: any): any {
    if (typeof value !== 'string') return value;
    return value.replace(/\s/g, '');
  }

  /** Collapse multiple consecutive whitespace to a single space. */
  private _normalizeWhitespace(value: any): any {
    if (typeof value !== 'string') return value;
    return value.replace(/\s+/g, ' ').trim();
  }

  /** Replace occurrences of a substring. */
  private _replace(
    value: any,
    params?: Record<string, any>,
  ): any {
    if (typeof value !== 'string' || !params) return value;
    const from = params.from as string;
    const to = (params.to ?? '') as string;
    if (from === undefined) return value;
    return value.split(from).join(to);
  }

  /** Replace using a regular expression. */
  private _regexReplace(
    value: any,
    params?: Record<string, any>,
  ): any {
    if (typeof value !== 'string' || !params) return value;
    const pattern = params.pattern as string;
    const replacement = (params.replacement ?? '') as string;
    const flags = (params.flags ?? 'g') as string;
    if (!pattern) return value;
    try {
      return value.replace(new RegExp(pattern, flags), replacement);
    } catch {
      return value;
    }
  }

  /** Remove all non-alphanumeric characters except spaces. */
  private _removeSpecialChars(value: any): any {
    if (typeof value !== 'string') return value;
    return value.replace(/[^a-zA-Z0-9 ]/g, '');
  }

  /** Remove all digit characters. */
  private _removeDigits(value: any): any {
    if (typeof value !== 'string') return value;
    return value.replace(/[0-9]/g, '');
  }

  /** Remove all non-digit characters. */
  private _removeNonDigits(value: any): any {
    if (typeof value !== 'string') return value;
    return value.replace(/[^0-9]/g, '');
  }

  // ── Private: Null / Default Operations ──────────────────

  /** Replace null/undefined with a fill value. */
  private _nullFill(
    value: any,
    params?: Record<string, any>,
  ): any {
    if (value === null || value === undefined) {
      return params?.fillValue ?? null;
    }
    return value;
  }

  /** Replace null/undefined/empty with a default value. */
  private _defaultValue(
    value: any,
    params?: Record<string, any>,
  ): any {
    if (value === null || value === undefined || value === '') {
      return params?.defaultValue ?? null;
    }
    return value;
  }

  // ── Private: Truncation & Padding ───────────────────────

  /** Truncate string to a maximum length. */
  private _truncate(
    value: any,
    params?: Record<string, any>,
  ): any {
    if (typeof value !== 'string' || !params) return value;
    const maxLength = params.maxLength as number;
    if (maxLength === undefined || maxLength < 0) return value;
    return value.substring(0, maxLength);
  }

  /** Pad string on the left to a target length. */
  private _padLeft(
    value: any,
    params?: Record<string, any>,
  ): any {
    if (!params) return value;
    const str = String(value ?? '');
    const length = params.length as number;
    const char = (params.char ?? ' ') as string;
    if (length === undefined) return value;
    return str.padStart(length, char);
  }

  /** Pad string on the right to a target length. */
  private _padRight(
    value: any,
    params?: Record<string, any>,
  ): any {
    if (!params) return value;
    const str = String(value ?? '');
    const length = params.length as number;
    const char = (params.char ?? ' ') as string;
    if (length === undefined) return value;
    return str.padEnd(length, char);
  }

  // ── Private: Numeric Operations ─────────────────────────

  /** Round a number to a specified number of decimal places. */
  private _round(
    value: any,
    params?: Record<string, any>,
  ): any {
    const num = Number(value);
    if (isNaN(num)) return value;
    const decimals = params?.decimals ?? 0;
    const factor = Math.pow(10, decimals);
    return Math.round(num * factor) / factor;
  }

  /** Ceiling of a number. */
  private _ceil(value: any): any {
    const num = Number(value);
    if (isNaN(num)) return value;
    return Math.ceil(num);
  }

  /** Floor of a number. */
  private _floor(value: any): any {
    const num = Number(value);
    if (isNaN(num)) return value;
    return Math.floor(num);
  }

  /** Absolute value of a number. */
  private _absolute(value: any): any {
    const num = Number(value);
    if (isNaN(num)) return value;
    return Math.abs(num);
  }

  /** Clamp a number between a minimum and maximum. */
  private _clamp(
    value: any,
    params?: Record<string, any>,
  ): any {
    const num = Number(value);
    if (isNaN(num) || !params) return value;
    const min = params.min as number;
    const max = params.max as number;
    if (min === undefined || max === undefined) return value;
    return Math.min(Math.max(num, min), max);
  }

  // ── Private: Date Operations ────────────────────────────

  /** Format a date value according to a format pattern. */
  private _dateFormat(
    value: any,
    params?: Record<string, any>,
  ): any {
    if (value === null || value === undefined) return value;
    const format = (params?.format ?? 'ISO') as string;

    try {
      const date = value instanceof Date ? value : new Date(value);
      if (isNaN(date.getTime())) return value;

      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');

      switch (format) {
        case 'ISO':
          return date.toISOString();
        case 'US':
          return `${month}/${day}/${year}`;
        case 'EU':
          return `${day}/${month}/${year}`;
        case 'YYYY-MM-DD':
          return `${year}-${month}-${day}`;
        case 'MM/DD/YYYY':
          return `${month}/${day}/${year}`;
        case 'DD/MM/YYYY':
          return `${day}/${month}/${year}`;
        case 'YYYY/MM/DD':
          return `${year}/${month}/${day}`;
        default:
          return date.toISOString();
      }
    } catch {
      return value;
    }
  }

  /** Parse a date string to ISO format. */
  private _dateParse(
    value: any,
    params?: Record<string, any>,
  ): any {
    if (value === null || value === undefined) return value;
    if (typeof value !== 'string') return value;

    const inputFormat = params?.format as string | undefined;

    try {
      let date: Date;

      if (inputFormat === 'US' || inputFormat === 'MM/DD/YYYY') {
        // MM/DD/YYYY
        const parts = value.split(/[\/\-]/);
        if (parts.length === 3) {
          date = new Date(
            Number(parts[2]),
            Number(parts[0]) - 1,
            Number(parts[1]),
          );
        } else {
          date = new Date(value);
        }
      } else if (inputFormat === 'EU' || inputFormat === 'DD/MM/YYYY') {
        // DD/MM/YYYY
        const parts = value.split(/[\/\-]/);
        if (parts.length === 3) {
          date = new Date(
            Number(parts[2]),
            Number(parts[1]) - 1,
            Number(parts[0]),
          );
        } else {
          date = new Date(value);
        }
      } else {
        date = new Date(value);
      }

      if (isNaN(date.getTime())) return value;
      return date.toISOString();
    } catch {
      return value;
    }
  }

  // ── Private: Domain-Specific Operations ─────────────────

  /** Normalize a phone number: strip non-digits, format as +1XXXXXXXXXX. */
  private _phoneNormalize(value: any): any {
    if (typeof value !== 'string') return value;

    const digits = value.replace(/[^0-9]/g, '');

    if (digits.length === 10) {
      return `+1${digits}`;
    }
    if (digits.length === 11 && digits.startsWith('1')) {
      return `+${digits}`;
    }
    // Return cleaned digits with + prefix for international numbers
    if (digits.length > 10) {
      return `+${digits}`;
    }

    return digits;
  }

  /** Normalize an email address: lowercase and trim. */
  private _emailNormalize(value: any): any {
    if (typeof value !== 'string') return value;
    return value.trim().toLowerCase();
  }

  /** Standardize common address abbreviations. */
  private _addressStandardize(value: any): any {
    if (typeof value !== 'string') return value;

    const abbreviations: Array<[RegExp, string]> = [
      [/\bSt\b\.?/gi, 'Street'],
      [/\bAve\b\.?/gi, 'Avenue'],
      [/\bBlvd\b\.?/gi, 'Boulevard'],
      [/\bDr\b\.?/gi, 'Drive'],
      [/\bLn\b\.?/gi, 'Lane'],
      [/\bRd\b\.?/gi, 'Road'],
      [/\bCt\b\.?/gi, 'Court'],
      [/\bPl\b\.?/gi, 'Place'],
      [/\bCir\b\.?/gi, 'Circle'],
      [/\bPkwy\b\.?/gi, 'Parkway'],
      [/\bHwy\b\.?/gi, 'Highway'],
      [/\bTer\b\.?/gi, 'Terrace'],
      [/\bTrl\b\.?/gi, 'Trail'],
      [/\bWay\b\.?/gi, 'Way'],
      [/\bApt\b\.?/gi, 'Apartment'],
      [/\bSte\b\.?/gi, 'Suite'],
      [/\bFl\b\.?/gi, 'Floor'],
      [/\bBldg\b\.?/gi, 'Building'],
      [/\bN\b\.?(?=\s)/gi, 'North'],
      [/\bS\b\.?(?=\s)/gi, 'South'],
      [/\bE\b\.?(?=\s)/gi, 'East'],
      [/\bW\b\.?(?=\s)/gi, 'West'],
      [/\bNE\b\.?/gi, 'Northeast'],
      [/\bNW\b\.?/gi, 'Northwest'],
      [/\bSE\b\.?/gi, 'Southeast'],
      [/\bSW\b\.?/gi, 'Southwest'],
    ];

    let result = value;
    for (const [pattern, replacement] of abbreviations) {
      result = result.replace(pattern, replacement);
    }

    // Normalize whitespace
    return result.replace(/\s+/g, ' ').trim();
  }

  /** Standardize a name: title case, normalize hyphens, remove extra spaces. */
  private _nameStandardize(value: any): any {
    if (typeof value !== 'string') return value;

    let result = value.trim();

    // Normalize multiple spaces
    result = result.replace(/\s+/g, ' ');

    // Normalize hyphens: remove spaces around hyphens
    result = result.replace(/\s*-\s*/g, '-');

    // Title case each segment separated by spaces or hyphens
    result = result.replace(/(?:^|[\s-])(\w)/g, (_match, letter) => {
      const prefix = _match.slice(0, -1);
      return prefix + letter.toUpperCase();
    });

    // Ensure first character is uppercase
    if (result.length > 0) {
      result = result.charAt(0).toUpperCase() + result.slice(1);
    }

    return result;
  }

  // ── Private: Lookup & Cast Operations ───────────────────

  /** Replace a value using a registered lookup table. */
  private _lookupReplace(
    value: any,
    params?: Record<string, any>,
  ): any {
    if (!params) return value;
    const tableName = params.tableName as string;
    if (!tableName) return value;

    const table = this._lookupTables.get(tableName);
    if (!table) return value;

    const key = String(value ?? '');
    return table.has(key) ? table.get(key) : value;
  }

  /** Cast a value to a target type. */
  private _typeCast(
    value: any,
    params?: Record<string, any>,
  ): any {
    if (value === null || value === undefined) return value;
    if (!params) return value;

    const targetType = params.targetType as string;

    switch (targetType) {
      case 'string':
        return String(value);

      case 'number': {
        const num = Number(value);
        return isNaN(num) ? value : num;
      }

      case 'boolean': {
        if (typeof value === 'boolean') return value;
        const str = String(value).toLowerCase().trim();
        if (str === 'true' || str === '1' || str === 'yes') return true;
        if (str === 'false' || str === '0' || str === 'no') return false;
        return value;
      }

      case 'date': {
        try {
          const date = new Date(value);
          if (isNaN(date.getTime())) return value;
          return date.toISOString();
        } catch {
          return value;
        }
      }

      default:
        return value;
    }
  }

  // ── Private: Custom Cleanser ────────────────────────────

  /** Apply a registered custom cleanser. */
  private _custom(
    value: any,
    params?: Record<string, any>,
  ): any {
    if (!params) return value;
    const cleanserName = params.cleanser as string;
    if (!cleanserName) return value;

    const cleanser = this._customCleansers.get(cleanserName);
    if (!cleanser) return value;

    return cleanser(value, params);
  }

  // ── Private: Condition Evaluation ───────────────────────

  /** Evaluate whether a cleansing condition is met before applying a rule. */
  private _evaluateCondition(
    row: Record<string, any>,
    condition: QualityCondition,
  ): boolean {
    const fieldValue = row[condition.field];
    const conditionValue = condition.value;

    let result: boolean;

    switch (condition.operator) {
      case '==':
      case 'equals':
        result = fieldValue == conditionValue;
        break;
      case '===':
      case 'strict-equals':
        result = fieldValue === conditionValue;
        break;
      case '!=':
      case 'not-equals':
        result = fieldValue != conditionValue;
        break;
      case '!==':
      case 'strict-not-equals':
        result = fieldValue !== conditionValue;
        break;
      case '>':
      case 'greater-than':
        result = fieldValue > conditionValue;
        break;
      case '>=':
      case 'greater-than-or-equals':
        result = fieldValue >= conditionValue;
        break;
      case '<':
      case 'less-than':
        result = fieldValue < conditionValue;
        break;
      case '<=':
      case 'less-than-or-equals':
        result = fieldValue <= conditionValue;
        break;
      case 'contains':
        result =
          typeof fieldValue === 'string' &&
          typeof conditionValue === 'string' &&
          fieldValue.includes(conditionValue);
        break;
      case 'starts-with':
        result =
          typeof fieldValue === 'string' &&
          typeof conditionValue === 'string' &&
          fieldValue.startsWith(conditionValue);
        break;
      case 'ends-with':
        result =
          typeof fieldValue === 'string' &&
          typeof conditionValue === 'string' &&
          fieldValue.endsWith(conditionValue);
        break;
      case 'matches':
        try {
          result =
            typeof fieldValue === 'string' &&
            new RegExp(String(conditionValue)).test(fieldValue);
        } catch {
          result = false;
        }
        break;
      case 'in':
        result =
          Array.isArray(conditionValue) &&
          conditionValue.includes(fieldValue);
        break;
      case 'not-in':
        result =
          Array.isArray(conditionValue) &&
          !conditionValue.includes(fieldValue);
        break;
      case 'is-null':
        result = fieldValue === null || fieldValue === undefined;
        break;
      case 'is-not-null':
        result = fieldValue !== null && fieldValue !== undefined;
        break;
      case 'is-empty':
        result =
          fieldValue === null ||
          fieldValue === undefined ||
          fieldValue === '';
        break;
      case 'is-not-empty':
        result =
          fieldValue !== null &&
          fieldValue !== undefined &&
          fieldValue !== '';
        break;
      default:
        result = true;
        break;
    }

    // Handle child conditions with logical operators
    if (condition.children && condition.children.length > 0) {
      const logicalOp = condition.logicalOperator ?? 'AND';

      if (logicalOp === 'AND') {
        return (
          result &&
          condition.children.every((child) =>
            this._evaluateCondition(row, child),
          )
        );
      }

      return (
        result ||
        condition.children.some((child) =>
          this._evaluateCondition(row, child),
        )
      );
    }

    return result;
  }
}
