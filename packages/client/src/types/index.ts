export interface Project {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  ruleSets?: RuleSet[];
  dataModels?: DataModel[];
  _count?: { ruleSets: number; dataModels: number };
}

export interface DataModel {
  id: string;
  projectId: string;
  name: string;
  schema: DataModelSchema;
  createdAt: string;
  updatedAt: string;
}

export interface DataModelSchema {
  fields: FieldDefinition[];
}

export interface FieldDefinition {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'date' | 'object' | 'array';
  required?: boolean;
  description?: string;
  children?: FieldDefinition[];
  enumValues?: string[];
}

export interface RuleSet {
  id: string;
  projectId: string;
  name: string;
  description: string;
  inputModelId?: string;
  status: 'draft' | 'published' | 'archived';
  version: number;
  createdAt: string;
  updatedAt: string;
  rules?: Rule[];
  decisionTables?: DecisionTableData[];
  inputModel?: DataModel;
  versions?: RuleSetVersion[];
  _count?: { rules: number; decisionTables: number };
}

export type ComparisonOperator =
  | 'equals' | 'notEquals'
  | 'greaterThan' | 'greaterThanOrEqual'
  | 'lessThan' | 'lessThanOrEqual'
  | 'contains' | 'notContains'
  | 'startsWith' | 'endsWith'
  | 'in' | 'notIn'
  | 'between'
  | 'isNull' | 'isNotNull'
  | 'matches';

export type LogicalOperator = 'AND' | 'OR';

export interface Condition {
  field: string;
  operator: ComparisonOperator;
  value: any;
}

export interface ConditionGroup {
  logic: LogicalOperator;
  conditions: (Condition | ConditionGroup)[];
}

export type ActionType = 'SET' | 'APPEND' | 'INCREMENT' | 'DECREMENT' | 'CUSTOM';

export interface Action {
  type: ActionType;
  field: string;
  value: any;
}

export interface Rule {
  id: string;
  ruleSetId: string;
  name: string;
  description: string;
  priority: number;
  conditions: ConditionGroup;
  actions: Action[];
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DecisionTableColumn {
  id: string;
  name: string;
  field: string;
  type: 'condition' | 'action';
  operator?: ComparisonOperator;
  actionType?: ActionType;
}

export interface DecisionTableRow {
  id: string;
  values: Record<string, any>;
  enabled: boolean;
}

export interface DecisionTableData {
  id: string;
  ruleSetId: string;
  name: string;
  description: string;
  columns: DecisionTableColumn[];
  rows: DecisionTableRow[];
  createdAt: string;
  updatedAt: string;
}

export interface RuleSetVersion {
  id: string;
  ruleSetId: string;
  version: number;
  snapshot: any;
  changelog: string;
  publishedAt: string;
  publishedBy: string;
}

export interface ExecutionResult {
  success: boolean;
  input: Record<string, any>;
  output: Record<string, any>;
  ruleResults: any[];
  tableResults: any[];
  rulesFired: string[];
  executionTimeMs: number;
  error?: string;
}

export interface ExecutionLog {
  id: string;
  ruleSetId: string;
  version: number;
  input: Record<string, any>;
  output: Record<string, any>;
  rulesFired: string[];
  executionTimeMs: number;
  status: string;
  error?: string;
  createdAt: string;
}

export interface DashboardStats {
  projects: number;
  ruleSets: number;
  rules: number;
  decisionTables: number;
  totalExecutions: number;
  recentExecutions: any[];
  successRate: number;
  errorCount: number;
  avgExecutionTimeMs: number;
}

export const OPERATOR_LABELS: Record<ComparisonOperator, string> = {
  equals: 'equals',
  notEquals: 'not equals',
  greaterThan: '>',
  greaterThanOrEqual: '>=',
  lessThan: '<',
  lessThanOrEqual: '<=',
  contains: 'contains',
  notContains: 'not contains',
  startsWith: 'starts with',
  endsWith: 'ends with',
  in: 'in',
  notIn: 'not in',
  between: 'between',
  isNull: 'is null',
  isNotNull: 'is not null',
  matches: 'matches regex',
};
