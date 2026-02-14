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

// ============================================================
// V9: Enterprise Service Bus (ESB)
// ============================================================

export interface ESBChannel {
  id: string;
  name: string;
  type: 'point-to-point' | 'pub-sub' | 'dead-letter' | 'request-reply' | 'priority';
  config: Record<string, any>;
  status: 'active' | 'paused' | 'draining' | 'closed';
  messageCount: number;
  errorCount: number;
  lastActivity: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ESBEndpoint {
  id: string;
  name: string;
  channelId: string | null;
  protocol: 'rest' | 'soap' | 'jms';
  config: Record<string, any>;
  status: 'active' | 'inactive' | 'error';
  createdAt: string;
  updatedAt: string;
}

export type ESBRoutingStrategy =
  | 'content-based' | 'header-based' | 'round-robin' | 'weighted'
  | 'failover' | 'multicast' | 'priority-based' | 'dynamic'
  | 'itinerary' | 'recipient-list';

export interface ESBRoute {
  id: string;
  name: string;
  source: string;
  strategy: ESBRoutingStrategy;
  conditions: any[];
  targets: string[];
  priority: number;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ESBTransformer {
  id: string;
  name: string;
  channel: string | null;
  pipeline: any[];
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ESBSagaDefinition {
  id: string;
  name: string;
  description: string;
  steps: any[];
  timeout: number | null;
  retryPolicy: any | null;
  createdAt: string;
  updatedAt: string;
  instances?: ESBSagaInstance[];
}

export interface ESBSagaInstance {
  id: string;
  definitionId: string;
  status: 'running' | 'completed' | 'compensating' | 'compensated' | 'failed';
  context: Record<string, any>;
  currentStep: number;
  logs: any[];
  error: string | null;
  startedAt: string;
  completedAt: string | null;
}

export interface ESBMessageRecord {
  id: string;
  channelName: string;
  type: 'command' | 'event' | 'document' | 'query' | 'reply';
  headers: Record<string, any>;
  body: Record<string, any>;
  status: 'pending' | 'delivered' | 'failed' | 'dead-letter';
  correlationId: string | null;
  error: string | null;
  createdAt: string;
  deliveredAt: string | null;
}

export interface ESBMetricsSummary {
  totalChannels: number;
  totalEndpoints: number;
  totalRoutes: number;
  totalTransformers: number;
  activeSagas: number;
  totalMessages: number;
  deadLetterCount: number;
}

export interface ESBDashboardData {
  summary: ESBMetricsSummary;
  channels: Pick<ESBChannel, 'id' | 'name' | 'type' | 'status' | 'messageCount' | 'errorCount' | 'lastActivity'>[];
  recentMessages: ESBMessageRecord[];
}

// ============================================================
// V10: Content Management System (CMS)
// ============================================================

export type CMSDocumentStatus =
  | 'draft' | 'pending-review' | 'in-review' | 'approved' | 'published'
  | 'archived' | 'suspended' | 'expired' | 'deleted' | 'superseded';

export type CMSDocumentCategory =
  | 'document' | 'spreadsheet' | 'presentation' | 'image' | 'video'
  | 'audio' | 'email' | 'form' | 'report' | 'contract' | 'invoice'
  | 'policy' | 'template';

export type CMSSecurityLevel = 'public' | 'internal' | 'confidential' | 'restricted' | 'top-secret';

export interface CMSDocument {
  id: string;
  name: string;
  description: string;
  mimeType: string;
  content: string;
  contentHash: string | null;
  sizeBytes: number;
  category: CMSDocumentCategory;
  status: CMSDocumentStatus;
  version: number;
  majorVersion: number;
  minorVersion: number;
  folderId: string | null;
  lockedBy: string | null;
  lockedAt: string | null;
  checkedOutBy: string | null;
  checkedOutAt: string | null;
  tags: string[];
  metadata: Record<string, any>;
  retentionDate: string | null;
  legalHold: boolean;
  securityLevel: CMSSecurityLevel;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
  versions?: CMSDocumentVersion[];
  renditions?: CMSRendition[];
  comments?: CMSCommentRecord[];
}

export interface CMSDocumentVersion {
  id: string;
  documentId: string;
  version: number;
  content: string;
  contentHash: string | null;
  sizeBytes: number;
  changelog: string;
  createdBy: string;
  createdAt: string;
}

export interface CMSFolder {
  id: string;
  name: string;
  parentId: string | null;
  path: string;
  description: string;
  metadata: Record<string, any>;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  documents?: CMSDocument[];
  children?: CMSFolder[];
  _count?: { documents: number; children: number };
}

export interface CMSWorkflow {
  id: string;
  name: string;
  description: string;
  steps: any[];
  triggers: any[];
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
  instances?: CMSWorkflowInstance[];
}

export interface CMSWorkflowInstance {
  id: string;
  workflowId: string;
  documentId: string | null;
  status: 'running' | 'completed' | 'failed' | 'cancelled' | 'paused';
  currentStep: number;
  context: Record<string, any>;
  logs: any[];
  error: string | null;
  startedBy: string;
  startedAt: string;
  completedAt: string | null;
}

export interface CMSTaxonomy {
  id: string;
  name: string;
  description: string;
  type: 'hierarchical' | 'flat' | 'network' | 'faceted';
  nodes: any[];
  rules: any[];
  createdAt: string;
  updatedAt: string;
}

export interface CMSRetentionPolicy {
  id: string;
  name: string;
  description: string;
  trigger: string;
  retentionPeriod: number;
  disposition: string;
  categories: string[];
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CMSLegalHold {
  id: string;
  name: string;
  description: string;
  reason: string;
  documentIds: string[];
  createdBy: string;
  active: boolean;
  createdAt: string;
  releasedAt: string | null;
}

export interface CMSRendition {
  id: string;
  documentId: string;
  type: 'thumbnail' | 'pdf' | 'text-extract' | 'preview' | 'web-optimized' | 'compressed';
  mimeType: string;
  content: string;
  sizeBytes: number;
  metadata: Record<string, any>;
  createdAt: string;
}

export interface CMSCommentRecord {
  id: string;
  documentId: string;
  parentId: string | null;
  content: string;
  authorId: string;
  authorName: string;
  resolved: boolean;
  reactions: Record<string, number>;
  createdAt: string;
  updatedAt: string;
}

export interface CMSMetadataSchema {
  id: string;
  name: string;
  description: string;
  fields: any[];
  categories: string[];
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface CMSMetricsSummary {
  totalDocuments: number;
  totalFolders: number;
  totalWorkflows: number;
  activeWorkflows: number;
  totalTaxonomies: number;
  retentionPolicies: number;
  activeLegalHolds: number;
  totalComments: number;
  totalRenditions: number;
  metadataSchemas: number;
}

export interface CMSDashboardData {
  summary: CMSMetricsSummary;
  recentDocuments: Pick<CMSDocument, 'id' | 'name' | 'category' | 'status' | 'mimeType' | 'sizeBytes' | 'updatedAt' | 'createdBy'>[];
  statusBreakdown: { status: string; count: number }[];
  categoryBreakdown: { category: string; count: number }[];
}

export interface CMSSearchResult {
  query: string;
  total: number;
  results: Pick<CMSDocument, 'id' | 'name' | 'description' | 'category' | 'status' | 'mimeType' | 'sizeBytes' | 'securityLevel' | 'tags' | 'createdBy' | 'updatedAt'>[];
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
