// ============================================================
// SOA One DI — Type Definitions
// ============================================================
//
// Comprehensive type definitions for the Data Integration module.
// Covers connectors, pipelines, CDC, replication, transformations,
// data quality, lineage, scheduling, mapping, catalog, monitoring,
// and security.
//
// Zero external dependencies. 100% @soa-one/engine SDK compatible.
// ============================================================

// ── Connector Types ─────────────────────────────────────────

/** Supported connector categories. */
export type ConnectorType =
  | 'jdbc'
  | 'file'
  | 'api'
  | 'cloud-storage'
  | 'streaming'
  | 'nosql'
  | 'message-queue'
  | 'ftp'
  | 'ldap'
  | 'custom';

/** Supported database dialects for JDBC-style connectors. */
export type DatabaseDialect =
  | 'oracle'
  | 'postgresql'
  | 'mysql'
  | 'sqlserver'
  | 'db2'
  | 'sqlite'
  | 'mariadb'
  | 'snowflake'
  | 'bigquery'
  | 'redshift'
  | 'synapse'
  | 'teradata'
  | 'hana'
  | 'clickhouse'
  | 'cockroachdb'
  | 'custom';

/** File formats for file-based connectors. */
export type FileFormat =
  | 'csv'
  | 'json'
  | 'xml'
  | 'parquet'
  | 'avro'
  | 'orc'
  | 'excel'
  | 'fixed-width'
  | 'delimited'
  | 'yaml'
  | 'protobuf';

/** Cloud storage providers. */
export type CloudProvider =
  | 'aws-s3'
  | 'azure-blob'
  | 'gcp-gcs'
  | 'oracle-object-storage'
  | 'minio'
  | 'hdfs';

/** Streaming platforms. */
export type StreamingPlatform =
  | 'kafka'
  | 'kinesis'
  | 'pulsar'
  | 'rabbitmq'
  | 'eventbridge'
  | 'event-hubs'
  | 'nats'
  | 'redis-streams';

/** Authentication type for connectors. */
export type ConnectorAuthType =
  | 'none'
  | 'basic'
  | 'bearer'
  | 'api-key'
  | 'oauth2'
  | 'certificate'
  | 'kerberos'
  | 'iam'
  | 'vault'
  | 'custom';

/** Connection pool configuration. */
export interface ConnectionPoolConfig {
  minConnections: number;
  maxConnections: number;
  acquireTimeoutMs: number;
  idleTimeoutMs: number;
  maxLifetimeMs: number;
  validationQuery?: string;
  testOnBorrow: boolean;
  testOnReturn: boolean;
}

/** Connector authentication configuration. */
export interface ConnectorAuthConfig {
  type: ConnectorAuthType;
  username?: string;
  password?: string;
  token?: string;
  apiKey?: string;
  certificate?: string;
  privateKey?: string;
  clientId?: string;
  clientSecret?: string;
  tokenUrl?: string;
  scopes?: string[];
  vaultPath?: string;
  customAuth?: Record<string, any>;
}

/** Connector configuration. */
export interface ConnectorConfig {
  id: string;
  name: string;
  type: ConnectorType;
  description?: string;

  // Connection details
  host?: string;
  port?: number;
  database?: string;
  schema?: string;
  url?: string;
  path?: string;

  // Dialect / format
  dialect?: DatabaseDialect;
  fileFormat?: FileFormat;
  cloudProvider?: CloudProvider;
  streamingPlatform?: StreamingPlatform;

  // Authentication
  auth?: ConnectorAuthConfig;

  // Connection pool
  pool?: ConnectionPoolConfig;

  // Options
  options?: Record<string, any>;
  timeout?: number;
  retryAttempts?: number;
  retryDelayMs?: number;

  // SSL
  ssl?: boolean;
  sslCertificate?: string;
  sslKey?: string;
  sslCa?: string;

  // Tags / metadata
  tags?: string[];
  metadata?: Record<string, any>;
}

/** Connector status. */
export type ConnectorStatus =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'error'
  | 'closed';

/** Connector runtime state. */
export interface ConnectorState {
  connectorId: string;
  status: ConnectorStatus;
  lastConnectedAt?: string;
  lastErrorAt?: string;
  lastError?: string;
  activeConnections: number;
  totalConnectionsCreated: number;
  totalErrors: number;
  latencyMs: number;
  metadata: Record<string, any>;
}

/** Schema metadata discovered from a connector. */
export interface SchemaMetadata {
  catalog?: string;
  schema?: string;
  tables: TableMetadata[];
  views?: TableMetadata[];
  procedures?: ProcedureMetadata[];
}

/** Table metadata. */
export interface TableMetadata {
  name: string;
  schema?: string;
  catalog?: string;
  type: 'table' | 'view' | 'materialized-view' | 'synonym';
  columns: ColumnMetadata[];
  primaryKey?: string[];
  foreignKeys?: ForeignKeyMetadata[];
  indexes?: IndexMetadata[];
  rowCount?: number;
  sizeBytes?: number;
  comment?: string;
}

/** Column metadata. */
export interface ColumnMetadata {
  name: string;
  dataType: string;
  nativeType?: string;
  nullable: boolean;
  defaultValue?: any;
  length?: number;
  precision?: number;
  scale?: number;
  isPrimaryKey: boolean;
  isForeignKey: boolean;
  isUnique: boolean;
  isIndexed: boolean;
  comment?: string;
}

/** Foreign key metadata. */
export interface ForeignKeyMetadata {
  name: string;
  columns: string[];
  referencedTable: string;
  referencedColumns: string[];
  onDelete?: 'cascade' | 'set-null' | 'restrict' | 'no-action';
  onUpdate?: 'cascade' | 'set-null' | 'restrict' | 'no-action';
}

/** Index metadata. */
export interface IndexMetadata {
  name: string;
  columns: string[];
  unique: boolean;
  type: 'btree' | 'hash' | 'bitmap' | 'fulltext' | 'spatial' | 'other';
}

/** Stored procedure metadata. */
export interface ProcedureMetadata {
  name: string;
  schema?: string;
  parameters: ProcedureParameterMetadata[];
  returnType?: string;
}

/** Procedure parameter metadata. */
export interface ProcedureParameterMetadata {
  name: string;
  dataType: string;
  direction: 'in' | 'out' | 'inout';
  defaultValue?: any;
}

// ── Pipeline Types ──────────────────────────────────────────

/** Pipeline execution mode. */
export type PipelineMode = 'batch' | 'streaming' | 'micro-batch' | 'hybrid';

/** Pipeline status. */
export type PipelineStatus =
  | 'draft'
  | 'validated'
  | 'scheduled'
  | 'running'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'suspended';

/** Pipeline stage type. */
export type StageType =
  | 'extract'
  | 'transform'
  | 'load'
  | 'validate'
  | 'filter'
  | 'aggregate'
  | 'join'
  | 'split'
  | 'merge'
  | 'lookup'
  | 'deduplicate'
  | 'sort'
  | 'pivot'
  | 'unpivot'
  | 'custom';

/** Pipeline definition. */
export interface PipelineDefinition {
  id: string;
  name: string;
  description?: string;
  version: number;
  mode: PipelineMode;
  stages: StageDefinition[];
  parameters?: PipelineParameter[];
  errorHandling?: PipelineErrorHandling;
  parallelism?: number;
  batchSize?: number;
  checkpointIntervalMs?: number;
  /** Whether this pipeline is enabled for execution. */
  enabled?: boolean;
  tags?: string[];
  metadata?: Record<string, any>;
  createdBy?: string;
  createdAt?: string;
  modifiedBy?: string;
  modifiedAt?: string;
}

/** Pipeline parameter for runtime binding. */
export interface PipelineParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'date' | 'object';
  required: boolean;
  defaultValue?: any;
  description?: string;
}

/** Pipeline error handling. */
export interface PipelineErrorHandling {
  strategy: 'fail-fast' | 'skip-error' | 'retry' | 'dead-letter' | 'custom';
  maxErrors?: number;
  retryAttempts?: number;
  retryDelayMs?: number;
  deadLetterTarget?: string;
  errorLogLevel?: 'debug' | 'info' | 'warn' | 'error';
}

/** Stage definition within a pipeline. */
export interface StageDefinition {
  id: string;
  name: string;
  type: StageType;
  description?: string;
  connectorId?: string;
  config: StageConfig;
  dependencies?: string[];
  parallelism?: number;
  batchSize?: number;
  timeout?: number;
  retryPolicy?: RetryPolicyConfig;
  errorHandling?: PipelineErrorHandling;
  enabled: boolean;
}

/** Stage configuration (varies by type). */
export interface StageConfig {
  // Extract
  query?: string;
  table?: string;
  columns?: string[];
  filter?: string;
  fetchSize?: number;
  partitionColumn?: string;
  partitionCount?: number;

  // Transform
  transformations?: TransformationRule[];
  mappingId?: string;

  // Load
  targetTable?: string;
  writeMode?: WriteMode;
  commitInterval?: number;
  preLoadScript?: string;
  postLoadScript?: string;
  truncateBeforeLoad?: boolean;

  // Validate
  qualityRules?: QualityRuleRef[];

  // Filter
  filterExpression?: string;
  filterConditions?: FilterCondition[];

  // Aggregate
  groupByColumns?: string[];
  aggregations?: AggregationSpec[];

  // Join
  joinType?: JoinType;
  leftStageId?: string;
  rightStageId?: string;
  joinConditions?: JoinCondition[];

  // Split / Merge
  splitExpression?: string;
  mergeStrategy?: 'union' | 'union-all' | 'intersect' | 'except';

  // Lookup
  lookupConnectorId?: string;
  lookupTable?: string;
  lookupKeyColumns?: string[];
  lookupValueColumns?: string[];
  lookupCacheSize?: number;

  // Dedup
  deduplicateColumns?: string[];
  deduplicateStrategy?: 'first' | 'last' | 'min' | 'max';

  // Sort
  sortColumns?: SortSpec[];

  // Pivot / Unpivot
  pivotColumn?: string;
  pivotValues?: string[];
  valueColumn?: string;
  unpivotColumns?: string[];

  // Custom
  customHandler?: string;
  customConfig?: Record<string, any>;
}

/** Write mode for load operations. */
export type WriteMode =
  | 'insert'
  | 'update'
  | 'upsert'
  | 'merge'
  | 'delete'
  | 'truncate-insert'
  | 'append'
  | 'replace';

/** Filter condition. */
export interface FilterCondition {
  field: string;
  operator: 'equals' | 'notEquals' | 'greaterThan' | 'lessThan' | 'in' | 'notIn' | 'isNull' | 'isNotNull' | 'between' | 'like' | 'regex';
  value?: any;
  values?: any[];
}

/** Aggregation specification. */
export interface AggregationSpec {
  column: string;
  function: 'count' | 'sum' | 'avg' | 'min' | 'max' | 'first' | 'last' | 'collect' | 'distinct-count';
  alias: string;
}

/** Join type. */
export type JoinType = 'inner' | 'left' | 'right' | 'full' | 'cross' | 'semi' | 'anti';

/** Join condition. */
export interface JoinCondition {
  leftColumn: string;
  rightColumn: string;
  operator?: 'equals' | 'notEquals' | 'greaterThan' | 'lessThan';
}

/** Sort specification. */
export interface SortSpec {
  column: string;
  direction: 'asc' | 'desc';
  nullsPosition?: 'first' | 'last';
}

/** Quality rule reference. */
export interface QualityRuleRef {
  ruleId: string;
  failOnViolation: boolean;
}

/** Retry policy. */
export interface RetryPolicyConfig {
  maxAttempts: number;
  delayMs: number;
  backoffMultiplier?: number;
  maxDelayMs?: number;
}

/** Pipeline execution instance. */
export interface PipelineInstance {
  instanceId: string;
  pipelineId: string;
  status: PipelineStatus;
  startedAt: string;
  completedAt?: string;
  parameters?: Record<string, any>;
  stageStatuses: Record<string, StageStatus>;
  metrics: PipelineMetrics;
  errors: PipelineError[];
  checkpoint?: PipelineCheckpoint;
  triggeredBy: string;
}

/** Stage execution status. */
export interface StageStatus {
  stageId: string;
  status: PipelineStatus;
  startedAt?: string;
  completedAt?: string;
  rowsRead: number;
  rowsWritten: number;
  rowsRejected: number;
  rowsFiltered: number;
  errors: PipelineError[];
  throughputRowsPerSec: number;
  latencyMs: number;
}

/** Pipeline metrics. */
export interface PipelineMetrics {
  totalRowsRead: number;
  totalRowsWritten: number;
  totalRowsRejected: number;
  totalRowsFiltered: number;
  totalStages: number;
  completedStages: number;
  failedStages: number;
  throughputRowsPerSec: number;
  durationMs: number;
  peakMemoryBytes: number;
  bytesRead: number;
  bytesWritten: number;
}

/** Pipeline error. */
export interface PipelineError {
  stageId?: string;
  rowNumber?: number;
  column?: string;
  errorCode: string;
  message: string;
  severity: 'warning' | 'error' | 'fatal';
  timestamp: string;
  data?: Record<string, any>;
}

/** Pipeline checkpoint for recovery. */
export interface PipelineCheckpoint {
  instanceId: string;
  stageId: string;
  offset: number;
  timestamp: string;
  metadata: Record<string, any>;
}

// ── CDC Types ───────────────────────────────────────────────

/** Change Data Capture method. */
export type CDCMethod =
  | 'log-based'
  | 'trigger-based'
  | 'timestamp-based'
  | 'snapshot-diff'
  | 'query-based'
  | 'hybrid';

/** Change operation type. */
export type ChangeOperation = 'INSERT' | 'UPDATE' | 'DELETE' | 'TRUNCATE' | 'DDL';

/** CDC configuration. */
export interface CDCConfig {
  id: string;
  name: string;
  sourceConnectorId: string;
  targetConnectorId?: string;
  method: CDCMethod;
  tables: CDCTableConfig[];
  pollIntervalMs?: number;
  batchSize?: number;
  startPosition?: CDCPosition;
  includeSchema?: boolean;
  includeBefore?: boolean;
  filterOperations?: ChangeOperation[];
  heartbeatIntervalMs?: number;
  snapshotMode?: 'initial' | 'schema-only' | 'never' | 'always';
  errorHandling?: PipelineErrorHandling;
  tags?: string[];
  metadata?: Record<string, any>;
}

/** CDC table configuration. */
export interface CDCTableConfig {
  schema?: string;
  table: string;
  columns?: string[];
  excludeColumns?: string[];
  timestampColumn?: string;
  sequenceColumn?: string;
  keyColumns?: string[];
  filterExpression?: string;
  operations?: ChangeOperation[];
}

/** CDC position (for log-based). */
export interface CDCPosition {
  type: 'lsn' | 'scn' | 'timestamp' | 'offset' | 'gtid' | 'custom';
  value: string;
  metadata?: Record<string, any>;
}

/** Change event. */
export interface ChangeEvent {
  id: string;
  source: string;
  table: string;
  schema?: string;
  operation: ChangeOperation;
  timestamp: string;
  position: CDCPosition;
  before?: Record<string, any>;
  after?: Record<string, any>;
  key: Record<string, any>;
  headers?: Record<string, any>;
  metadata?: Record<string, any>;
}

/** CDC stream status. */
export type CDCStreamStatus =
  | 'initializing'
  | 'snapshotting'
  | 'streaming'
  | 'paused'
  | 'error'
  | 'stopped';

/** CDC stream state. */
export interface CDCStreamState {
  configId: string;
  status: CDCStreamStatus;
  currentPosition?: CDCPosition;
  tablesCapturing: string[];
  eventsProcessed: number;
  eventsPerSecond: number;
  lastEventTimestamp?: string;
  lag?: number;
  errors: PipelineError[];
  startedAt: string;
  metadata: Record<string, any>;
}

/** CDC handler invoked for each change event. */
export type ChangeEventHandler = (event: ChangeEvent) => void | Promise<void>;

// ── Replication Types ───────────────────────────────────────

/** Replication mode. */
export type ReplicationMode =
  | 'unidirectional'
  | 'bidirectional'
  | 'broadcast'
  | 'consolidation'
  | 'peer-to-peer';

/** Conflict resolution strategy. */
export type ConflictResolution =
  | 'source-wins'
  | 'target-wins'
  | 'timestamp-wins'
  | 'priority-wins'
  | 'merge'
  | 'custom';

/** Replication configuration. */
export interface ReplicationConfig {
  id: string;
  name: string;
  description?: string;
  mode: ReplicationMode;
  sourceConnectorId: string;
  targetConnectorId: string;
  tables: ReplicationTableConfig[];
  conflictResolution: ConflictResolution;
  conflictHandler?: string;
  initialLoad: boolean;
  parallelism?: number;
  batchSize?: number;
  applyDelayMs?: number;
  heartbeatIntervalMs?: number;
  ddlReplication?: boolean;
  sequenceReplication?: boolean;
  lobHandling?: 'inline' | 'reference' | 'skip';
  errorHandling?: PipelineErrorHandling;
  filterOperations?: ChangeOperation[];
  transformations?: TransformationRule[];
  tags?: string[];
  metadata?: Record<string, any>;
}

/** Per-table replication configuration. */
export interface ReplicationTableConfig {
  sourceSchema?: string;
  sourceTable: string;
  targetSchema?: string;
  targetTable?: string;
  columns?: string[];
  excludeColumns?: string[];
  keyColumns?: string[];
  filterExpression?: string;
  columnMappings?: Record<string, string>;
  transformations?: TransformationRule[];
}

/** Replication stream status. */
export type ReplicationStreamStatus =
  | 'initializing'
  | 'initial-load'
  | 'streaming'
  | 'applying'
  | 'paused'
  | 'error'
  | 'stopped'
  | 'switchover';

/** Replication lag measurement. */
export interface ReplicationLag {
  captureLatencyMs: number;
  applyLatencyMs: number;
  totalLatencyMs: number;
  pendingEvents: number;
  lastAppliedPosition?: CDCPosition;
  lastCapturedPosition?: CDCPosition;
  timestamp: string;
}

/** Replication stream state. */
export interface ReplicationStreamState {
  configId: string;
  status: ReplicationStreamStatus;
  lag: ReplicationLag;
  tablesReplicating: string[];
  eventsApplied: number;
  conflictsDetected: number;
  conflictsResolved: number;
  errorsCount: number;
  throughputEventsPerSec: number;
  bytesTransferred: number;
  startedAt: string;
  lastAppliedAt?: string;
  metadata: Record<string, any>;
}

/** Conflict event. */
export interface ConflictEvent {
  id: string;
  replicationId: string;
  table: string;
  operation: ChangeOperation;
  sourceRow: Record<string, any>;
  targetRow?: Record<string, any>;
  conflictType: 'uniqueness' | 'update-update' | 'update-delete' | 'delete-update' | 'foreign-key' | 'custom';
  resolution: ConflictResolution;
  resolvedRow?: Record<string, any>;
  timestamp: string;
  metadata?: Record<string, any>;
}

// ── Transformation Types ────────────────────────────────────

/** Transformation rule type. */
export type TransformationRuleType =
  | 'rename'
  | 'cast'
  | 'derive'
  | 'expression'
  | 'lookup'
  | 'default'
  | 'trim'
  | 'pad'
  | 'substring'
  | 'replace'
  | 'regex-replace'
  | 'upper'
  | 'lower'
  | 'concat'
  | 'split'
  | 'hash'
  | 'encrypt'
  | 'decrypt'
  | 'mask'
  | 'round'
  | 'abs'
  | 'ceil'
  | 'floor'
  | 'date-format'
  | 'date-parse'
  | 'date-add'
  | 'date-diff'
  | 'null-replace'
  | 'conditional'
  | 'tokenize'
  | 'detokenize'
  | 'json-extract'
  | 'json-flatten'
  | 'xml-extract'
  | 'base64-encode'
  | 'base64-decode'
  | 'url-encode'
  | 'url-decode'
  | 'custom';

/** Transformation rule. */
export interface TransformationRule {
  id: string;
  name?: string;
  type: TransformationRuleType;
  sourceColumn?: string;
  targetColumn?: string;
  expression?: string;
  parameters?: Record<string, any>;
  condition?: string;
  order: number;
  enabled: boolean;
}

/** Data type for casting. */
export type DataType =
  | 'string'
  | 'integer'
  | 'long'
  | 'float'
  | 'double'
  | 'decimal'
  | 'boolean'
  | 'date'
  | 'datetime'
  | 'timestamp'
  | 'time'
  | 'binary'
  | 'json'
  | 'xml'
  | 'uuid'
  | 'array'
  | 'map';

// ── Data Quality Types ──────────────────────────────────────

/** Quality rule type. */
export type QualityRuleType =
  | 'not-null'
  | 'unique'
  | 'range'
  | 'pattern'
  | 'referential'
  | 'consistency'
  | 'completeness'
  | 'accuracy'
  | 'timeliness'
  | 'format'
  | 'domain'
  | 'business'
  | 'statistical'
  | 'custom';

/** Quality rule severity. */
export type QualitySeverity = 'info' | 'warning' | 'error' | 'critical';

/** Quality rule definition. */
export interface QualityRuleDefinition {
  id: string;
  name: string;
  description?: string;
  type: QualityRuleType;
  severity: QualitySeverity;
  column?: string;
  columns?: string[];
  expression?: string;
  pattern?: string;
  minValue?: any;
  maxValue?: any;
  allowedValues?: any[];
  referenceTable?: string;
  referenceColumn?: string;
  threshold?: number;
  customValidator?: string;
  tags?: string[];
  metadata?: Record<string, any>;
}

/** Quality rule evaluation result. */
export interface QualityRuleResult {
  ruleId: string;
  ruleName: string;
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

/** Quality violation. */
export interface QualityViolation {
  ruleId: string;
  rowNumber: number;
  column?: string;
  actualValue?: any;
  expectedValue?: any;
  message: string;
  data?: Record<string, any>;
}

/** Data profile for a column. */
export interface ColumnProfile {
  column: string;
  dataType: string;
  totalCount: number;
  nullCount: number;
  nullPercentage: number;
  distinctCount: number;
  distinctPercentage: number;
  minValue?: any;
  maxValue?: any;
  meanValue?: number;
  medianValue?: number;
  standardDeviation?: number;
  minLength?: number;
  maxLength?: number;
  avgLength?: number;
  topValues?: Array<{ value: any; count: number; percentage: number }>;
  patterns?: Array<{ pattern: string; count: number; percentage: number }>;
  outlierCount?: number;
  histogram?: Array<{ bucket: string; count: number }>;
}

/** Data profile for a dataset. */
export interface DataProfile {
  datasetName: string;
  totalRows: number;
  totalColumns: number;
  columns: ColumnProfile[];
  correlations?: Array<{ column1: string; column2: string; coefficient: number }>;
  duplicateRows?: number;
  profilingTimeMs: number;
  timestamp: string;
}

/** Quality score summary. */
export interface QualityScore {
  overall: number;
  completeness: number;
  accuracy: number;
  consistency: number;
  timeliness: number;
  uniqueness: number;
  validity: number;
  dimensions: Record<string, number>;
  timestamp: string;
}

/** Cleansing rule type. */
export type CleansingRuleType =
  | 'trim-whitespace'
  | 'remove-duplicates'
  | 'standardize-case'
  | 'standardize-format'
  | 'fill-missing'
  | 'correct-typos'
  | 'normalize'
  | 'remove-outliers'
  | 'merge-duplicates'
  | 'address-standardize'
  | 'phone-standardize'
  | 'email-validate'
  | 'date-standardize'
  | 'custom';

/** Cleansing rule definition. */
export interface CleansingRule {
  id: string;
  name: string;
  type: CleansingRuleType;
  column?: string;
  columns?: string[];
  parameters?: Record<string, any>;
  order: number;
  enabled: boolean;
}

/** Cleansing result. */
export interface CleansingResult {
  totalRows: number;
  cleanedRows: number;
  unchangedRows: number;
  rules: Array<{
    ruleId: string;
    ruleName: string;
    rowsAffected: number;
    changes: number;
  }>;
  executionTimeMs: number;
  timestamp: string;
}

// ── Data Lineage Types ──────────────────────────────────────

/** Lineage node type. */
export type LineageNodeType =
  | 'source'
  | 'target'
  | 'transformation'
  | 'pipeline'
  | 'stage'
  | 'column'
  | 'table'
  | 'dataset'
  | 'connector'
  | 'external';

/** Lineage edge type. */
export type LineageEdgeType =
  | 'data-flow'
  | 'transformation'
  | 'derivation'
  | 'reference'
  | 'copy'
  | 'aggregation'
  | 'filter'
  | 'join';

/** Lineage node. */
export interface LineageNode {
  id: string;
  name: string;
  type: LineageNodeType;
  description?: string;
  properties?: Record<string, any>;
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt?: string;
}

/** Lineage edge. */
export interface LineageEdge {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  type: LineageEdgeType;
  transformationDescription?: string;
  expression?: string;
  pipelineId?: string;
  stageId?: string;
  metadata?: Record<string, any>;
  createdAt: string;
}

/** Lineage graph. */
export interface LineageGraph {
  nodes: LineageNode[];
  edges: LineageEdge[];
  rootNodeIds: string[];
  leafNodeIds: string[];
  depth: number;
  timestamp: string;
}

/** Impact analysis result. */
export interface ImpactAnalysis {
  sourceNodeId: string;
  direction: 'upstream' | 'downstream' | 'both';
  impactedNodes: LineageNode[];
  impactedEdges: LineageEdge[];
  impactedPipelines: string[];
  depth: number;
  timestamp: string;
}

// ── Scheduler Types ─────────────────────────────────────────

/** Schedule trigger type. */
export type ScheduleTriggerType =
  | 'cron'
  | 'interval'
  | 'event'
  | 'file-arrival'
  | 'data-change'
  | 'api'
  | 'dependency'
  | 'manual';

/** Job status. */
export type JobStatus =
  | 'pending'
  | 'queued'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'skipped'
  | 'waiting'
  | 'timeout';

/** Schedule definition. */
export interface ScheduleDefinition {
  id: string;
  name: string;
  description?: string;
  pipelineId: string;
  trigger: ScheduleTrigger;
  parameters?: Record<string, any>;
  dependencies?: ScheduleDependency[];
  timeout?: number;
  maxRetries?: number;
  retryDelayMs?: number;
  priority: number;
  concurrent: boolean;
  maxConcurrentRuns?: number;
  enabled: boolean;
  startDate?: string;
  endDate?: string;
  timezone?: string;
  tags?: string[];
  metadata?: Record<string, any>;
}

/** Schedule trigger. */
export interface ScheduleTrigger {
  type: ScheduleTriggerType;
  cronExpression?: string;
  intervalMs?: number;
  eventType?: string;
  eventFilter?: Record<string, any>;
  filePath?: string;
  filePattern?: string;
}

/** Schedule dependency. */
export interface ScheduleDependency {
  scheduleId: string;
  condition: 'completed' | 'succeeded' | 'failed' | 'any';
  timeoutMs?: number;
}

/** Job instance. */
export interface JobInstance {
  instanceId: string;
  scheduleId: string;
  pipelineInstanceId?: string;
  status: JobStatus;
  scheduledAt: string;
  startedAt?: string;
  completedAt?: string;
  triggeredBy: string;
  attempt: number;
  parameters?: Record<string, any>;
  result?: Record<string, any>;
  error?: string;
  metadata?: Record<string, any>;
}

// ── Mapping Types ───────────────────────────────────────────

/** Mapping definition (declarative field-to-field mappings). */
export interface MappingDefinition {
  id: string;
  name: string;
  description?: string;
  version: number;
  sourceConnectorId?: string;
  targetConnectorId?: string;
  sourceTable?: string;
  targetTable?: string;
  fieldMappings: FieldMappingDef[];
  lookups?: LookupDefinition[];
  conditions?: MappingCondition[];
  defaultValues?: Record<string, any>;
  createdBy?: string;
  createdAt?: string;
  modifiedBy?: string;
  modifiedAt?: string;
  tags?: string[];
  metadata?: Record<string, any>;
}

/** Field-level mapping. */
export interface FieldMappingDef {
  sourceField?: string;
  sourceFields?: string[];
  targetField: string;
  transformation?: TransformationRule;
  expression?: string;
  defaultValue?: any;
  nullable: boolean;
  dataType?: DataType;
  description?: string;
}

/** Lookup definition for mapping enrichment. */
export interface LookupDefinition {
  id: string;
  name: string;
  connectorId?: string;
  table?: string;
  keyColumns: string[];
  valueColumns: string[];
  cacheEnabled: boolean;
  cacheSize?: number;
  cacheTtlMs?: number;
  defaultValue?: any;
  data?: Map<string, any>;
}

/** Mapping condition. */
export interface MappingCondition {
  field: string;
  operator: 'equals' | 'notEquals' | 'greaterThan' | 'lessThan' | 'in' | 'isNull' | 'isNotNull' | 'regex';
  value?: any;
  action: 'include' | 'exclude' | 'transform' | 'default';
  transformationId?: string;
}

// ── Data Catalog Types ──────────────────────────────────────

/** Catalog entry type. */
export type CatalogEntryType =
  | 'table'
  | 'view'
  | 'dataset'
  | 'file'
  | 'api'
  | 'stream'
  | 'pipeline'
  | 'report'
  | 'model';

/** Catalog entry. */
export interface CatalogEntry {
  id: string;
  name: string;
  type: CatalogEntryType;
  description?: string;
  connectorId?: string;
  schema?: string;
  path?: string;
  columns?: ColumnMetadata[];
  owner?: string;
  steward?: string;
  classification?: string;
  sensitivity?: DataSensitivity;
  tags?: string[];
  glossaryTerms?: string[];
  qualityScore?: number;
  lastProfiledAt?: string;
  lastAccessedAt?: string;
  popularity?: number;
  lineageNodeId?: string;
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt?: string;
}

/** Data sensitivity level. */
export type DataSensitivity =
  | 'public'
  | 'internal'
  | 'confidential'
  | 'restricted'
  | 'pii'
  | 'phi'
  | 'pci';

/** Glossary term. */
export interface GlossaryTerm {
  id: string;
  name: string;
  definition: string;
  abbreviation?: string;
  synonyms?: string[];
  domain?: string;
  owner?: string;
  status: 'draft' | 'approved' | 'deprecated';
  relatedTerms?: string[];
  tags?: string[];
  createdAt: string;
  updatedAt?: string;
}

/** Catalog search query. */
export interface CatalogSearchQuery {
  text?: string;
  type?: CatalogEntryType;
  tags?: string[];
  owner?: string;
  classification?: string;
  sensitivity?: DataSensitivity;
  connectorId?: string;
  limit?: number;
  offset?: number;
}

// ── Monitoring Types ────────────────────────────────────────

/** Monitor metric type. */
export type MonitorMetricType = 'counter' | 'gauge' | 'histogram' | 'timer';

/** Alert severity. */
export type AlertSeverity = 'info' | 'warning' | 'error' | 'critical';

/** Alert status. */
export type AlertStatus = 'active' | 'acknowledged' | 'resolved' | 'suppressed';

/** Alert rule definition. */
export interface AlertRuleDefinition {
  id: string;
  name: string;
  description?: string;
  metric: string;
  condition: 'greaterThan' | 'lessThan' | 'equals' | 'notEquals' | 'absent';
  threshold: number;
  windowMs: number;
  severity: AlertSeverity;
  cooldownMs?: number;
  notificationChannels?: string[];
  enabled: boolean;
  tags?: string[];
}

/** Alert instance. */
export interface AlertInstance {
  id: string;
  ruleId: string;
  ruleName: string;
  severity: AlertSeverity;
  status: AlertStatus;
  message: string;
  metricValue: number;
  threshold: number;
  firedAt: string;
  acknowledgedAt?: string;
  resolvedAt?: string;
  acknowledgedBy?: string;
  metadata?: Record<string, any>;
}

/** Pipeline health. */
export interface PipelineHealth {
  pipelineId: string;
  pipelineName: string;
  status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
  lastRunStatus?: PipelineStatus;
  lastRunAt?: string;
  successRate: number;
  averageDurationMs: number;
  activeAlerts: number;
  uptimePercentage: number;
}

/** System-wide DI metrics. */
export interface DIMetrics {
  totalPipelines: number;
  activePipelines: number;
  totalConnectors: number;
  activeConnectors: number;
  totalCDCStreams: number;
  activeCDCStreams: number;
  totalReplicationStreams: number;
  activeReplicationStreams: number;
  totalSchedules: number;
  activeSchedules: number;
  totalJobsToday: number;
  successfulJobsToday: number;
  failedJobsToday: number;
  totalRowsProcessedToday: number;
  totalBytesProcessedToday: number;
  averagePipelineLatencyMs: number;
  activeAlerts: number;
  catalogEntries: number;
  lineageNodes: number;
  qualityScore: number;
  uptimeMs: number;
  timestamp: string;
}

// ── Security Types ──────────────────────────────────────────

/** Data masking strategy. */
export type MaskingStrategy =
  | 'full'
  | 'partial'
  | 'hash'
  | 'tokenize'
  | 'encrypt'
  | 'redact'
  | 'substitute'
  | 'shuffle'
  | 'null'
  | 'date-shift'
  | 'number-variance'
  | 'format-preserving'
  | 'custom';

/** Masking rule. */
export interface MaskingRule {
  id: string;
  name: string;
  column: string;
  table?: string;
  strategy: MaskingStrategy;
  parameters?: Record<string, any>;
  preserveFormat?: boolean;
  preserveLength?: boolean;
  maskCharacter?: string;
  visibleChars?: number;
  visiblePosition?: 'start' | 'end';
  deterministicKey?: string;
  enabled: boolean;
}

/** Encryption configuration for data at rest/in transit. */
export interface EncryptionConfig {
  algorithm: 'aes-256-gcm' | 'aes-256-cbc' | 'chacha20-poly1305' | 'rsa-oaep' | 'custom';
  keyManagement: 'local' | 'kms' | 'vault' | 'hsm';
  keyId?: string;
  rotationIntervalDays?: number;
  encryptInTransit: boolean;
  encryptAtRest: boolean;
}

/** Access policy for data integration resources. */
export interface DIAccessPolicy {
  id: string;
  name: string;
  description?: string;
  principals: string[];
  resources: string[];
  actions: DIAction[];
  effect: 'allow' | 'deny';
  conditions?: Record<string, any>;
}

/** Data integration actions. */
export type DIAction =
  | 'pipeline:create'
  | 'pipeline:read'
  | 'pipeline:execute'
  | 'pipeline:delete'
  | 'connector:create'
  | 'connector:read'
  | 'connector:connect'
  | 'connector:delete'
  | 'cdc:create'
  | 'cdc:start'
  | 'cdc:stop'
  | 'replication:create'
  | 'replication:start'
  | 'replication:stop'
  | 'data:read'
  | 'data:write'
  | 'data:mask'
  | 'catalog:read'
  | 'catalog:write'
  | 'admin';

/** Audit log entry. */
export interface DIAuditEntry {
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

// ── Event Types ─────────────────────────────────────────────

/** DI event types. */
export type DIEventType =
  | 'pipeline:started'
  | 'pipeline:completed'
  | 'pipeline:failed'
  | 'pipeline:paused'
  | 'pipeline:resumed'
  | 'stage:started'
  | 'stage:completed'
  | 'stage:failed'
  | 'connector:connected'
  | 'connector:disconnected'
  | 'connector:error'
  | 'cdc:started'
  | 'cdc:stopped'
  | 'cdc:error'
  | 'cdc:lag-warning'
  | 'replication:started'
  | 'replication:stopped'
  | 'replication:conflict'
  | 'replication:error'
  | 'replication:switchover'
  | 'schedule:triggered'
  | 'schedule:completed'
  | 'schedule:failed'
  | 'quality:violation'
  | 'quality:score-change'
  | 'alert:fired'
  | 'alert:resolved'
  | 'catalog:updated'
  | 'lineage:updated'
  | 'security:violation'
  | 'di:started'
  | 'di:stopped';

/** DI event. */
export interface DIEvent {
  type: DIEventType;
  timestamp: string;
  source: string;
  pipelineId?: string;
  connectorId?: string;
  data?: Record<string, any>;
}

/** DI event listener. */
export type DIEventListener = (event: DIEvent) => void;

// ── Configuration ───────────────────────────────────────────

/** Main DataIntegrator configuration. */
export interface DIConfig {
  name: string;
  connectors?: ConnectorConfig[];
  pipelines?: PipelineDefinition[];
  cdcConfigs?: CDCConfig[];
  replicationConfigs?: ReplicationConfig[];
  schedules?: ScheduleDefinition[];
  qualityRules?: QualityRuleDefinition[];
  maskingRules?: MaskingRule[];
  alertRules?: AlertRuleDefinition[];
  accessPolicies?: DIAccessPolicy[];
  encryption?: EncryptionConfig;
  auditEnabled?: boolean;
  defaultErrorHandling?: PipelineErrorHandling;
  metadata?: Record<string, any>;
}
