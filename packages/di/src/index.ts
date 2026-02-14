// ============================================================
// SOA One DI — Public API
// ============================================================
//
// Data Integration module for SOA One.
// Zero-dependency, 100% compatible with @soa-one/engine SDK.
//
// Surpasses Oracle Data Integrator and Oracle GoldenGate with:
// - Universal connector framework (JDBC, files, APIs, cloud, streaming)
// - ETL/ELT pipeline engine with DAG execution
// - Change Data Capture (log, trigger, timestamp, snapshot-diff)
// - Real-time data replication with conflict resolution
// - 40+ data transformation functions
// - Data quality profiling, validation, and cleansing
// - End-to-end data lineage and impact analysis
// - Job scheduling with cron, event, and dependency triggers
// - Declarative data mapping with lookups
// - Data catalog with business glossary and sensitivity classification
// - Pipeline monitoring, metrics, and alerting
// - Data masking, access control, and audit logging
// - Full @soa-one/engine integration via plugin
// ============================================================

// ── Core Types ──────────────────────────────────────────────

export type {
  // Connector types
  ConnectorType,
  DatabaseDialect,
  FileFormat,
  CloudProvider,
  StreamingPlatform,
  ConnectorAuthType,
  ConnectionPoolConfig,
  ConnectorAuthConfig,
  ConnectorConfig,
  ConnectorStatus,
  ConnectorState,
  SchemaMetadata,
  TableMetadata,
  ColumnMetadata,
  ForeignKeyMetadata,
  IndexMetadata,
  ProcedureMetadata,
  ProcedureParameterMetadata,

  // Pipeline types
  PipelineMode,
  PipelineStatus,
  StageType,
  PipelineDefinition,
  PipelineParameter,
  PipelineErrorHandling,
  StageDefinition,
  StageConfig,
  WriteMode,
  FilterCondition,
  AggregationSpec,
  JoinType,
  JoinCondition,
  SortSpec,
  QualityRuleRef,
  RetryPolicyConfig,
  PipelineInstance,
  StageStatus,
  PipelineMetrics,
  PipelineError,
  PipelineCheckpoint,

  // CDC types
  CDCMethod,
  ChangeOperation,
  CDCConfig,
  CDCTableConfig,
  CDCPosition,
  ChangeEvent,
  CDCStreamStatus,
  CDCStreamState,
  ChangeEventHandler,

  // Replication types
  ReplicationMode,
  ConflictResolution,
  ReplicationConfig,
  ReplicationTableConfig,
  ReplicationStreamStatus,
  ReplicationLag,
  ReplicationStreamState,
  ConflictEvent,

  // Transformation types
  TransformationRuleType,
  TransformationRule,
  DataType,

  // Quality types
  QualityRuleType,
  QualitySeverity,
  QualityRuleDefinition,
  QualityRuleResult,
  QualityViolation,
  ColumnProfile,
  DataProfile,
  QualityScore,
  CleansingRuleType,
  CleansingRule,
  CleansingResult,

  // Lineage types
  LineageNodeType,
  LineageEdgeType,
  LineageNode,
  LineageEdge,
  LineageGraph,
  ImpactAnalysis,

  // Scheduler types
  ScheduleTriggerType,
  JobStatus,
  ScheduleDefinition,
  ScheduleTrigger,
  ScheduleDependency,
  JobInstance,

  // Mapping types
  MappingDefinition,
  FieldMappingDef,
  LookupDefinition,
  MappingCondition,

  // Catalog types
  CatalogEntryType,
  CatalogEntry,
  DataSensitivity,
  GlossaryTerm,
  CatalogSearchQuery,

  // Monitoring types
  MonitorMetricType,
  AlertSeverity,
  AlertStatus,
  AlertRuleDefinition,
  AlertInstance,
  PipelineHealth,
  DIMetrics,

  // Security types
  MaskingStrategy,
  MaskingRule,
  EncryptionConfig,
  DIAccessPolicy,
  DIAction,
  DIAuditEntry,

  // Event types
  DIEventType,
  DIEvent,
  DIEventListener,

  // Configuration
  DIConfig,
} from './types';

// ── DataIntegrator (Main Entry Point) ────────────────────────

export { DataIntegrator } from './di';

// ── Connector Management ────────────────────────────────────

export {
  ConnectorManager,
  Connector,
  ConnectionPool,
  ConnectorError,
  generateId,
} from './connector';

// ── Pipeline Engine ─────────────────────────────────────────

export {
  PipelineEngine,
  PipelineValidator,
  PipelineValidationError,
  type StageHandler,
  type StageExecutionContext,
  type StageExecutionResult,
  type PipelineValidationResult,
} from './pipeline';

// ── Change Data Capture ─────────────────────────────────────

export {
  CDCEngine,
  CDCStream,
} from './cdc';

// ── Data Replication ────────────────────────────────────────

export {
  ReplicationManager,
  ReplicationStream,
  type ConflictHandler,
  type ConflictResolutionResult,
  type ApplyHandler,
  type ApplyContext,
  type ApplyResult,
} from './replication';

// ── Data Transformation ─────────────────────────────────────

export {
  TransformationEngine,
  builtInTransformations,
  castValue,
  evaluateExpression,
  resolvePath,
  flattenObject,
  type TransformFunction,
} from './transform';

// ── Data Quality ────────────────────────────────────────────

export {
  DataQualityManager,
  QualityRuleEvaluator,
  DataProfiler,
  DataCleanser,
  QualityScoreCalculator,
  type CustomValidator,
} from './quality';

// ── Data Lineage ────────────────────────────────────────────

export {
  LineageTracker,
} from './lineage';

// ── Job Scheduling ──────────────────────────────────────────

export {
  JobScheduler,
  parseCronExpression,
  matchesCron,
  nextCronOccurrence,
  type CronSchedule,
  type JobExecutor,
} from './scheduler';

// ── Data Mapping ────────────────────────────────────────────

export {
  MappingManager,
  MappingExecutor,
  type MappingExecutionResult,
  type MappingError,
  type MappingValidationResult,
} from './mapping';

// ── Data Catalog ────────────────────────────────────────────

export {
  DataCatalog,
} from './catalog';

// ── Monitoring & Alerting ───────────────────────────────────

export {
  MonitoringManager,
  MetricCollector,
  AlertEngine,
  PipelineHealthTracker,
  type HistogramStats,
} from './monitoring';

// ── Security ────────────────────────────────────────────────

export {
  SecurityManager,
  DataMasker,
  DIAccessControl,
  DIAuditLogger,
} from './security';

// ── Engine Plugin ───────────────────────────────────────────

export {
  createDIPlugin,
  type EnginePlugin,
} from './plugin';
