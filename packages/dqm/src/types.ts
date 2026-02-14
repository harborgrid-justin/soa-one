// ============================================================
// SOA One DQM — Type Definitions
// ============================================================
//
// Comprehensive type definitions for the Data Quality &
// Messaging module. Covers profiling, quality rules, cleansing,
// scoring, record matching, enterprise messaging, monitoring,
// and security.
//
// Zero external dependencies. 100% @soa-one/engine SDK compatible.
// ============================================================

// ── Profiling Types ─────────────────────────────────────────

/** Supported data types for profiling. */
export type ProfileDataType =
  | 'string'
  | 'number'
  | 'integer'
  | 'float'
  | 'boolean'
  | 'date'
  | 'datetime'
  | 'timestamp'
  | 'binary'
  | 'array'
  | 'object'
  | 'null'
  | 'unknown';

/** Distribution bucket for frequency analysis. */
export interface DistributionBucket {
  value: string;
  count: number;
  percentage: number;
}

/** Pattern analysis result. */
export interface PatternResult {
  pattern: string;
  count: number;
  percentage: number;
  examples: string[];
}

/** Statistical summary for numeric columns. */
export interface NumericStats {
  min: number;
  max: number;
  mean: number;
  median: number;
  mode: number | null;
  standardDeviation: number;
  variance: number;
  skewness: number;
  kurtosis: number;
  percentile25: number;
  percentile75: number;
  percentile90: number;
  percentile95: number;
  percentile99: number;
  sum: number;
  interquartileRange: number;
  coefficientOfVariation: number;
  outlierCount: number;
}

/** String length statistics. */
export interface StringLengthStats {
  min: number;
  max: number;
  mean: number;
  median: number;
}

/** Column-level profile. */
export interface ColumnProfile {
  name: string;
  inferredType: ProfileDataType;
  totalValues: number;
  nullCount: number;
  nullPercentage: number;
  distinctCount: number;
  distinctPercentage: number;
  uniqueCount: number;
  uniquePercentage: number;
  duplicateCount: number;
  emptyStringCount: number;
  whiteSpaceOnlyCount: number;
  numericStats?: NumericStats;
  stringLengthStats?: StringLengthStats;
  topValues: DistributionBucket[];
  bottomValues: DistributionBucket[];
  patterns: PatternResult[];
  sampleValues: any[];
  minValue?: any;
  maxValue?: any;
  meanValue?: number;
  completeness: number;
  entropy: number;
}

/** Dataset-level profile. */
export interface DatasetProfile {
  id: string;
  name: string;
  totalRows: number;
  totalColumns: number;
  columns: ColumnProfile[];
  duplicateRowCount: number;
  duplicateRowPercentage: number;
  completeRowCount: number;
  completeRowPercentage: number;
  profiledAt: string;
  executionTimeMs: number;
  correlations: ColumnCorrelation[];
}

/** Correlation between two columns. */
export interface ColumnCorrelation {
  column1: string;
  column2: string;
  coefficient: number;
  type: 'pearson' | 'spearman';
}

// ── Quality Rule Types ──────────────────────────────────────

/** Quality rule categories. */
export type QualityRuleType =
  | 'not-null'
  | 'unique'
  | 'range'
  | 'pattern'
  | 'format'
  | 'domain'
  | 'referential'
  | 'consistency'
  | 'completeness'
  | 'accuracy'
  | 'timeliness'
  | 'statistical'
  | 'business'
  | 'custom'
  | 'cross-field'
  | 'conditional'
  | 'aggregate'
  | 'schema'
  | 'freshness'
  | 'volume'
  | 'distribution';

/** Rule severity. */
export type QualitySeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

/** Rule evaluation mode. */
export type RuleEvaluationMode = 'row' | 'dataset' | 'aggregate';

/** Quality rule definition. */
export interface QualityRuleDefinition {
  id: string;
  name: string;
  description?: string;
  type: QualityRuleType;
  severity: QualitySeverity;
  evaluationMode: RuleEvaluationMode;
  column?: string;
  columns?: string[];
  parameters?: Record<string, any>;
  condition?: QualityCondition;
  enabled: boolean;
  tags?: string[];
  threshold?: number;
  failAction?: 'warn' | 'reject' | 'quarantine' | 'flag';
}

/** Quality rule condition for conditional rules. */
export interface QualityCondition {
  field: string;
  operator: string;
  value: any;
  logicalOperator?: 'AND' | 'OR';
  children?: QualityCondition[];
}

/** Quality rule evaluation result. */
export interface QualityRuleResult {
  ruleId: string;
  ruleName: string;
  ruleType: QualityRuleType;
  passed: boolean;
  severity: QualitySeverity;
  totalRows: number;
  passedRows: number;
  failedRows: number;
  passRate: number;
  violations: QualityViolation[];
  executionTimeMs: number;
  timestamp: string;
}

/** A single quality violation. */
export interface QualityViolation {
  ruleId: string;
  rowNumber: number;
  column?: string;
  actualValue?: any;
  expectedValue?: string;
  message: string;
  data?: Record<string, any>;
  severity: QualitySeverity;
}

/** Batch validation result. */
export interface ValidationResult {
  datasetName: string;
  totalRules: number;
  passedRules: number;
  failedRules: number;
  totalViolations: number;
  criticalViolations: number;
  results: QualityRuleResult[];
  overallPassRate: number;
  executionTimeMs: number;
  timestamp: string;
}

// ── Cleansing Types ─────────────────────────────────────────

/** Cleansing rule categories. */
export type CleansingRuleType =
  | 'trim'
  | 'uppercase'
  | 'lowercase'
  | 'title-case'
  | 'remove-whitespace'
  | 'normalize-whitespace'
  | 'replace'
  | 'regex-replace'
  | 'remove-special-chars'
  | 'remove-digits'
  | 'remove-non-digits'
  | 'null-fill'
  | 'default-value'
  | 'truncate'
  | 'pad-left'
  | 'pad-right'
  | 'round'
  | 'ceil'
  | 'floor'
  | 'absolute'
  | 'clamp'
  | 'date-format'
  | 'date-parse'
  | 'phone-normalize'
  | 'email-normalize'
  | 'address-standardize'
  | 'name-standardize'
  | 'lookup-replace'
  | 'type-cast'
  | 'custom';

/** Cleansing rule definition. */
export interface CleansingRuleDefinition {
  id: string;
  name: string;
  type: CleansingRuleType;
  column: string;
  parameters?: Record<string, any>;
  condition?: QualityCondition;
  enabled: boolean;
  priority: number;
}

/** Cleansing result for a single column. */
export interface CleansingResult {
  ruleId: string;
  ruleName: string;
  column: string;
  totalRows: number;
  modifiedRows: number;
  modifiedPercentage: number;
  errors: number;
  executionTimeMs: number;
}

/** Batch cleansing result. */
export interface CleansingBatchResult {
  totalRules: number;
  results: CleansingResult[];
  totalModifiedRows: number;
  totalErrors: number;
  executionTimeMs: number;
  timestamp: string;
}

// ── Scoring Types ───────────────────────────────────────────

/** Quality dimension for scoring. */
export type QualityDimension =
  | 'completeness'
  | 'accuracy'
  | 'consistency'
  | 'timeliness'
  | 'uniqueness'
  | 'validity'
  | 'integrity'
  | 'conformity';

/** Weight configuration for scoring. */
export interface DimensionWeight {
  dimension: QualityDimension;
  weight: number;
}

/** Score for a single dimension. */
export interface DimensionScore {
  dimension: QualityDimension;
  score: number;
  weight: number;
  weightedScore: number;
  ruleCount: number;
  passedCount: number;
  failedCount: number;
}

/** Overall quality score. */
export interface QualityScore {
  overall: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  dimensions: DimensionScore[];
  totalRules: number;
  passedRules: number;
  failedRules: number;
  trend: 'improving' | 'stable' | 'degrading';
  previousScore?: number;
  scoredAt: string;
}

/** Quality score history entry. */
export interface ScoreHistoryEntry {
  score: QualityScore;
  datasetName: string;
  timestamp: string;
}

// ── Record Matching Types ───────────────────────────────────

/** Matching algorithm. */
export type MatchAlgorithm =
  | 'exact'
  | 'levenshtein'
  | 'jaro-winkler'
  | 'soundex'
  | 'metaphone'
  | 'double-metaphone'
  | 'ngram'
  | 'cosine'
  | 'jaccard'
  | 'token-sort'
  | 'token-set'
  | 'fuzzy'
  | 'custom';

/** Match field configuration. */
export interface MatchFieldConfig {
  name: string;
  algorithm: MatchAlgorithm;
  weight: number;
  threshold: number;
  caseSensitive?: boolean;
  preProcess?: ('trim' | 'lowercase' | 'remove-punctuation' | 'phonetic')[];
  parameters?: Record<string, any>;
}

/** Match rule definition. */
export interface MatchRuleDefinition {
  id: string;
  name: string;
  fields: MatchFieldConfig[];
  overallThreshold: number;
  maxResults?: number;
  blockingFields?: string[];
  mergeStrategy?: MergeStrategy;
  enabled: boolean;
}

/** Strategy for merging duplicate records. */
export type MergeStrategy =
  | 'keep-first'
  | 'keep-last'
  | 'keep-most-complete'
  | 'keep-most-recent'
  | 'manual'
  | 'custom';

/** A match pair result. */
export interface MatchPair {
  record1Index: number;
  record2Index: number;
  overallScore: number;
  fieldScores: FieldMatchScore[];
  matchType: 'exact' | 'probable' | 'possible' | 'non-match';
}

/** Field-level match score. */
export interface FieldMatchScore {
  field: string;
  score: number;
  algorithm: MatchAlgorithm;
  value1: any;
  value2: any;
}

/** Match result for a batch. */
export interface MatchResult {
  ruleId: string;
  ruleName: string;
  totalRecords: number;
  matchPairs: MatchPair[];
  exactMatches: number;
  probableMatches: number;
  possibleMatches: number;
  clusters: MatchCluster[];
  executionTimeMs: number;
  timestamp: string;
}

/** Cluster of related records. */
export interface MatchCluster {
  id: string;
  recordIndices: number[];
  masterIndex: number;
  confidence: number;
}

/** Deduplication result. */
export interface DeduplicationResult {
  totalRecords: number;
  uniqueRecords: number;
  duplicateGroups: number;
  totalDuplicates: number;
  clusters: MatchCluster[];
  survivorRecords: Record<string, any>[];
  executionTimeMs: number;
  timestamp: string;
}

// ── Messaging Types ─────────────────────────────────────────

/** Message delivery mode. */
export type DeliveryMode = 'at-most-once' | 'at-least-once' | 'exactly-once';

/** Message priority. */
export type MessagePriority = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

/** Topic type. */
export type TopicType = 'standard' | 'partitioned' | 'compacted' | 'ordered';

/** Subscription type. */
export type SubscriptionType =
  | 'exclusive'
  | 'shared'
  | 'failover'
  | 'key-shared';

/** Queue type. */
export type QueueType = 'standard' | 'priority' | 'delay' | 'fifo';

/** Message state. */
export type MessageState =
  | 'pending'
  | 'delivered'
  | 'acknowledged'
  | 'rejected'
  | 'expired'
  | 'dead-lettered'
  | 'redelivered';

/** DQM message. */
export interface DQMMessage<T = any> {
  id: string;
  topic: string;
  partition?: number;
  key?: string;
  body: T;
  headers: Record<string, string>;
  priority: MessagePriority;
  deliveryMode: DeliveryMode;
  timestamp: string;
  publishedBy: string;
  correlationId?: string;
  replyTo?: string;
  ttlMs?: number;
  retryCount: number;
  maxRetries: number;
  state: MessageState;
  metadata?: Record<string, any>;
}

/** Topic configuration. */
export interface TopicConfig {
  name: string;
  type: TopicType;
  partitions?: number;
  retentionMs?: number;
  maxMessageSize?: number;
  deliveryMode?: DeliveryMode;
  deadLetterTopic?: string;
  maxRetries?: number;
  redeliveryDelayMs?: number;
  compactionEnabled?: boolean;
  schemaValidation?: boolean;
  messageSchema?: MessageSchemaConfig;
  tags?: string[];
}

/** Message schema for validation. */
export interface MessageSchemaConfig {
  type: 'json-schema' | 'avro' | 'protobuf' | 'custom';
  schema: any;
  strict?: boolean;
}

/** Subscription configuration. */
export interface SubscriptionConfig {
  id: string;
  topic: string;
  name: string;
  type: SubscriptionType;
  filter?: string;
  maxConcurrency?: number;
  ackTimeoutMs?: number;
  maxRedeliveries?: number;
  deadLetterTopic?: string;
  initialPosition?: 'earliest' | 'latest';
  backlogQuota?: number;
}

/** Queue configuration. */
export interface QueueConfig {
  name: string;
  type: QueueType;
  maxSize?: number;
  maxMessageSize?: number;
  deliveryMode?: DeliveryMode;
  visibilityTimeoutMs?: number;
  deadLetterQueue?: string;
  maxRetries?: number;
  retryDelayMs?: number;
  delayMs?: number;
  tags?: string[];
}

/** Message handler function. */
export type MessageHandler<T = any> = (
  message: DQMMessage<T>,
) => void | Promise<void>;

/** Message filter function. */
export type MessageFilter<T = any> = (
  message: DQMMessage<T>,
) => boolean;

/** Topic statistics. */
export interface TopicStats {
  name: string;
  type: TopicType;
  totalPublished: number;
  totalDelivered: number;
  totalAcknowledged: number;
  totalDeadLettered: number;
  activeSubscriptions: number;
  messageBacklog: number;
  publishRate: number;
  deliveryRate: number;
  averageLatencyMs: number;
}

/** Queue statistics. */
export interface QueueStats {
  name: string;
  type: QueueType;
  depth: number;
  totalEnqueued: number;
  totalDequeued: number;
  totalDeadLettered: number;
  oldestMessageAge: number;
  averageProcessingTimeMs: number;
}

// ── Monitoring Types ────────────────────────────────────────

/** Metric types for DQM monitoring. */
export type DQMMetricType = 'counter' | 'gauge' | 'histogram' | 'timer';

/** Alert severity levels. */
export type DQMAlertSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

/** Alert status. */
export type DQMAlertStatus = 'active' | 'acknowledged' | 'resolved' | 'suppressed';

/** Alert rule definition. */
export interface DQMAlertRuleDefinition {
  id: string;
  name: string;
  description?: string;
  metric: string;
  condition: 'above' | 'below' | 'equals' | 'not-equals' | 'rate-of-change';
  threshold: number;
  windowMs: number;
  severity: DQMAlertSeverity;
  cooldownMs?: number;
  enabled: boolean;
  notificationChannels?: string[];
  tags?: string[];
}

/** Alert instance. */
export interface DQMAlertInstance {
  id: string;
  ruleId: string;
  ruleName: string;
  severity: DQMAlertSeverity;
  status: DQMAlertStatus;
  message: string;
  metricValue: number;
  threshold: number;
  firedAt: string;
  acknowledgedAt?: string;
  resolvedAt?: string;
  metadata?: Record<string, any>;
}

/** DQM health status. */
export interface DQMHealth {
  qualityScore: number;
  qualityGrade: string;
  totalRules: number;
  passingRules: number;
  failingRules: number;
  activeAlerts: number;
  messagesProcessed: number;
  topicsActive: number;
  queuesActive: number;
  matchesProcessed: number;
  cleansingOperations: number;
  uptimeMs: number;
  timestamp: string;
}

// ── Security Types ──────────────────────────────────────────

/** DQM actions for access control. */
export type DQMAction =
  | 'profile:execute'
  | 'profile:read'
  | 'rule:create'
  | 'rule:update'
  | 'rule:delete'
  | 'rule:execute'
  | 'cleanse:execute'
  | 'match:execute'
  | 'match:merge'
  | 'score:read'
  | 'topic:create'
  | 'topic:delete'
  | 'topic:publish'
  | 'topic:subscribe'
  | 'queue:create'
  | 'queue:delete'
  | 'queue:enqueue'
  | 'queue:dequeue'
  | 'admin:configure'
  | 'admin:monitor';

/** Access policy. */
export interface DQMAccessPolicy {
  id: string;
  name: string;
  principal: string;
  actions: DQMAction[];
  resources?: string[];
  effect: 'allow' | 'deny';
  enabled: boolean;
}

/** Audit log entry. */
export interface DQMAuditEntry {
  id: string;
  action: string;
  actor: string;
  resource?: string;
  resourceType?: string;
  details?: Record<string, any>;
  success: boolean;
  timestamp: string;
  ipAddress?: string;
  sessionId?: string;
}

/** Data masking strategy. */
export type DQMMaskingStrategy =
  | 'full'
  | 'partial'
  | 'hash'
  | 'redact'
  | 'substitute'
  | 'shuffle'
  | 'noise'
  | 'tokenize'
  | 'generalize'
  | 'custom';

/** Data masking rule. */
export interface DQMMaskingRule {
  id: string;
  name: string;
  column: string;
  strategy: DQMMaskingStrategy;
  parameters?: Record<string, any>;
  enabled: boolean;
}

// ── Event Types ─────────────────────────────────────────────

/** DQM event types. */
export type DQMEventType =
  | 'dqm:started'
  | 'dqm:stopped'
  | 'profile:completed'
  | 'profile:failed'
  | 'validation:completed'
  | 'validation:failed'
  | 'cleansing:completed'
  | 'cleansing:failed'
  | 'matching:completed'
  | 'matching:failed'
  | 'score:calculated'
  | 'score:degraded'
  | 'message:published'
  | 'message:delivered'
  | 'message:dead-lettered'
  | 'message:expired'
  | 'topic:created'
  | 'topic:deleted'
  | 'queue:created'
  | 'queue:deleted'
  | 'alert:fired'
  | 'alert:resolved';

/** DQM event. */
export interface DQMEvent {
  type: DQMEventType;
  timestamp: string;
  source: string;
  data?: Record<string, any>;
}

/** DQM event listener. */
export type DQMEventListener = (event: DQMEvent) => void;

// ── Configuration ───────────────────────────────────────────

/** DQM module configuration. */
export interface DQMConfig {
  name: string;
  auditEnabled?: boolean;
  qualityRules?: QualityRuleDefinition[];
  cleansingRules?: CleansingRuleDefinition[];
  matchRules?: MatchRuleDefinition[];
  topics?: TopicConfig[];
  queues?: QueueConfig[];
  alertRules?: DQMAlertRuleDefinition[];
  accessPolicies?: DQMAccessPolicy[];
  maskingRules?: DQMMaskingRule[];
  dimensionWeights?: DimensionWeight[];
  scoreHistoryMax?: number;
  metadata?: Record<string, any>;
}

// ── Metrics ─────────────────────────────────────────────────

/** DQM metrics snapshot. */
export interface DQMMetrics {
  totalQualityRules: number;
  activeQualityRules: number;
  totalCleansingRules: number;
  totalMatchRules: number;
  totalTopics: number;
  activeTopics: number;
  totalQueues: number;
  activeQueues: number;
  totalSubscriptions: number;
  messagesPublished: number;
  messagesDelivered: number;
  messagesDeadLettered: number;
  profilesExecuted: number;
  validationsExecuted: number;
  cleansingOperationsExecuted: number;
  matchOperationsExecuted: number;
  currentQualityScore: number;
  currentQualityGrade: string;
  activeAlerts: number;
  uptimeMs: number;
  timestamp: string;
}
