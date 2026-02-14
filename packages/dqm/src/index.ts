// ============================================================
// SOA One DQM — Public API
// ============================================================
//
// Data Quality & Messaging module for SOA One.
// Zero-dependency, 100% compatible with @soa-one/engine SDK.
//
// Surpasses Oracle Enterprise Data Quality and Oracle Enterprise
// Messaging Service with:
// - Statistical data profiling with column-level analysis
// - 20+ quality rule types with batch validation
// - 29 data cleansing and standardization operations
// - Multi-dimensional quality scoring (8 dimensions)
// - Probabilistic record matching with 12 algorithms
// - Record deduplication with configurable merge strategies
// - Enterprise messaging: topics, queues, pub/sub, dead-letter
// - Topic partitioning, compaction, and schema validation
// - Queue priority, FIFO, delay, and visibility timeout
// - Subscription types: exclusive, shared, failover, key-shared
// - Monitoring, metrics, and alerting
// - Data masking, access control, and audit logging
// - Full @soa-one/engine integration via plugin
// ============================================================

// ── Core Types ──────────────────────────────────────────────

export type {
  // Profiling types
  ProfileDataType,
  DistributionBucket,
  PatternResult,
  NumericStats,
  StringLengthStats,
  ColumnProfile,
  DatasetProfile,
  ColumnCorrelation,

  // Quality rule types
  QualityRuleType,
  QualitySeverity,
  RuleEvaluationMode,
  QualityRuleDefinition,
  QualityCondition,
  QualityRuleResult,
  QualityViolation,
  ValidationResult,

  // Cleansing types
  CleansingRuleType,
  CleansingRuleDefinition,
  CleansingResult,
  CleansingBatchResult,

  // Scoring types
  QualityDimension,
  DimensionWeight,
  DimensionScore,
  QualityScore,
  ScoreHistoryEntry,

  // Record matching types
  MatchAlgorithm,
  MatchFieldConfig,
  MatchRuleDefinition,
  MergeStrategy,
  MatchPair,
  FieldMatchScore,
  MatchResult,
  MatchCluster,
  DeduplicationResult,

  // Messaging types
  DeliveryMode,
  MessagePriority,
  TopicType,
  SubscriptionType,
  QueueType,
  MessageState,
  DQMMessage,
  TopicConfig,
  MessageSchemaConfig,
  SubscriptionConfig,
  QueueConfig,
  MessageHandler,
  MessageFilter,
  TopicStats,
  QueueStats,

  // Monitoring types
  DQMMetricType,
  DQMAlertSeverity,
  DQMAlertStatus,
  DQMAlertRuleDefinition,
  DQMAlertInstance,
  DQMHealth,

  // Security types
  DQMAction,
  DQMAccessPolicy,
  DQMAuditEntry,
  DQMMaskingStrategy,
  DQMMaskingRule,

  // Event types
  DQMEventType,
  DQMEvent,
  DQMEventListener,

  // Configuration
  DQMConfig,

  // Metrics
  DQMMetrics,
} from './types';

// ── DataQualityMessaging (Main Entry Point) ─────────────────

export { DataQualityMessaging } from './dqm';

// ── Data Profiling ──────────────────────────────────────────

export {
  DataProfiler,
  generateId,
  type ProfileOptions,
} from './profiler';

// ── Quality Rules ───────────────────────────────────────────

export {
  QualityRuleEngine,
  type CustomRuleValidator,
} from './rules';

// ── Data Cleansing ──────────────────────────────────────────

export {
  DataCleansingEngine,
  type CustomCleanser,
} from './cleansing';

// ── Quality Scoring ─────────────────────────────────────────

export {
  QualityScoringEngine,
} from './scoring';

// ── Record Matching ─────────────────────────────────────────

export {
  RecordMatchingEngine,
  type CustomMatcher,
} from './matching';

// ── Enterprise Messaging ────────────────────────────────────

export {
  MessagingService,
  Topic,
  Subscription,
  MessageQueue,
} from './messaging';

// ── Monitoring & Alerting ───────────────────────────────────

export {
  DQMMonitoringManager,
  DQMMetricCollector,
  DQMAlertEngine,
  type HistogramStats,
} from './monitoring';

// ── Security ────────────────────────────────────────────────

export {
  DQMSecurityManager,
  DQMDataMasker,
  DQMAccessControl,
  DQMAuditLogger,
} from './security';

// ── Engine Plugin ───────────────────────────────────────────

export {
  createDQMPlugin,
  type EnginePlugin,
} from './plugin';
