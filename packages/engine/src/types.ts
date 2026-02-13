// ============================================================
// SOA One Rule Engine — Type Definitions
// ============================================================

/** Supported comparison operators for conditions */
export type ComparisonOperator =
  | 'equals'
  | 'notEquals'
  | 'greaterThan'
  | 'greaterThanOrEqual'
  | 'lessThan'
  | 'lessThanOrEqual'
  | 'contains'
  | 'notContains'
  | 'startsWith'
  | 'endsWith'
  | 'in'
  | 'notIn'
  | 'between'
  | 'isNull'
  | 'isNotNull'
  | 'matches'; // regex

/** Logical operators for combining conditions */
export type LogicalOperator = 'AND' | 'OR';

/** A single condition comparing a field to a value */
export interface Condition {
  field: string;          // dot-notation path, e.g. "applicant.age"
  operator: ComparisonOperator;
  value: any;             // comparison value (or array for 'in'/'between')
}

/** A group of conditions joined by a logical operator */
export interface ConditionGroup {
  logic: LogicalOperator;
  conditions: (Condition | ConditionGroup)[];
}

/** Action types that fire when a rule matches */
export type ActionType = 'SET' | 'APPEND' | 'INCREMENT' | 'DECREMENT' | 'CUSTOM';

/** A single action to perform when a rule fires */
export interface Action {
  type: ActionType;
  field: string;          // dot-notation output path
  value: any;             // value to set/append/increment by
}

/** A complete business rule */
export interface Rule {
  id: string;
  name: string;
  description?: string;
  priority: number;       // higher = evaluated first
  enabled: boolean;
  conditions: ConditionGroup;
  actions: Action[];
}

/** A decision table column definition */
export interface DecisionTableColumn {
  id: string;
  name: string;
  field: string;          // dot-notation path
  type: 'condition' | 'action';
  operator?: ComparisonOperator;  // for condition columns
  actionType?: ActionType;        // for action columns
}

/** A decision table row */
export interface DecisionTableRow {
  id: string;
  values: Record<string, any>;  // column id -> value
  enabled: boolean;
}

/** A complete decision table */
export interface DecisionTable {
  id: string;
  name: string;
  description?: string;
  columns: DecisionTableColumn[];
  rows: DecisionTableRow[];
  hitPolicy: 'FIRST' | 'ALL' | 'COLLECT';  // FIRST = stop on first match, ALL = run all matching, COLLECT = aggregate
}

/** A rule set containing rules and/or decision tables */
export interface RuleSet {
  id: string;
  name: string;
  description?: string;
  rules: Rule[];
  decisionTables: DecisionTable[];
}

/** Result of evaluating a single rule */
export interface RuleResult {
  ruleId: string;
  ruleName: string;
  fired: boolean;
  actions: Action[];
}

/** Result of evaluating a decision table */
export interface DecisionTableResult {
  tableId: string;
  tableName: string;
  matchedRows: string[];   // row IDs
  actions: Action[];
}

/** Complete execution result */
export interface ExecutionResult {
  success: boolean;
  input: Record<string, any>;
  output: Record<string, any>;
  ruleResults: RuleResult[];
  tableResults: DecisionTableResult[];
  rulesFired: string[];    // IDs of rules that fired
  executionTimeMs: number;
  error?: string;
}

/** Data model field definition */
export interface FieldDefinition {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'date' | 'object' | 'array';
  required?: boolean;
  description?: string;
  children?: FieldDefinition[];  // for object/array types
  enumValues?: string[];         // for constrained string fields
}

/** A data model defining the shape of facts */
export interface DataModelDefinition {
  id: string;
  name: string;
  fields: FieldDefinition[];
}
