// ============================================================
// SOA One SOA — Public API
// ============================================================
//
// SOA Suite module for SOA One.
// Zero-dependency, 100% compatible with @soa-one/engine SDK.
//
// Surpasses Oracle SOA Suite with:
// - Service registry with versioned contracts and discovery
// - BPEL-like process orchestration with scopes & handlers
// - Human task engine with escalation, delegation, and SLA
// - Complex event processing with temporal patterns
// - B2B gateway with partner management and TPA
// - Policy manager with SLA enforcement and throttling
// - Service mesh with traffic management and observability
// - API gateway with lifecycle management and rate limiting
// - Advanced compensation with nested scopes
// - Business activity monitoring and SLA tracking
// - Monitoring, metrics, and alerting
// - Security: access control, masking, audit logging
// - Full @soa-one/engine integration via plugin
// ============================================================

// ── Core Types ──────────────────────────────────────────────

export type {
  // Service Registry types
  ServiceProtocol,
  ServiceStatus,
  ServiceVisibility,
  ServiceContract,
  ServiceEndpoint,
  ServiceRegistration,
  HealthCheckConfig,
  ServiceDiscoveryQuery,

  // BPEL Process types
  BPELActivityType,
  BPELProcessStatus,
  BPELActivityStatus,
  PartnerLink,
  BPELVariable,
  CorrelationSet,
  FaultHandler,
  CompensationHandler,
  EventHandler,
  BPELActivity,
  AssignCopy,
  BPELProcessDefinition,
  BPELProcessInstance,
  BPELLogEntry,

  // Human Task types
  TaskPriority,
  HumanTaskStatus,
  AssignmentType,
  EscalationType,
  TaskOutcome,
  EscalationRule,
  HumanTaskDefinition,
  HumanTaskInstance,
  TaskComment,
  TaskAttachment,

  // CEP types
  CEPEventPriority,
  CEPEvent,
  CEPPatternType,
  WindowType,
  WindowConfig,
  CEPCondition,
  CEPAggregation,
  CEPPattern,
  CEPPatternMatch,
  CEPAction,
  CEPRule,

  // B2B types
  B2BDocumentFormat,
  B2BTransport,
  PartnerStatus,
  ExchangeDirection,
  TradingPartner,
  PartnerContact,
  TransportConfig,
  PartnerSecurityConfig,
  TradingPartnerAgreement,
  B2BValidationRule,
  B2BDocumentExchange,

  // Policy types
  PolicyType,
  EnforcementPoint,
  SLAMetricType,
  PolicyDefinition,
  PolicyRule,
  SLADefinition,
  SLAMetric,
  SLABreachAction,
  SLAComplianceRecord,
  SLABreach,

  // Service Mesh types
  ProxyStatus,
  TrafficStrategy,
  MeshCircuitState,
  SidecarConfig,
  TrafficPolicy,
  MeshCircuitBreakerConfig,
  MeshRateLimitConfig,
  HeaderRoute,
  MeshProxy,

  // API Gateway types
  APIStatus,
  APIAuthType,
  VersionStrategy,
  APIDefinition,
  APIRoute,
  APIRateLimitConfig,
  CORSConfig,
  APICacheConfig,
  APITransformation,
  APIKey,
  APIUsageRecord,

  // Compensation types
  CompensationScopeStatus,
  CompensationAction,
  CompensationScope,
  CompensationTransaction,
  CompensationLogEntry,

  // BAM types
  BAMMetricType,
  BAMAlertSeverity,
  KPIDefinition,
  KPIValue,
  BAMDashboard,
  BAMAlertRule,
  BAMAlertInstance,

  // Monitoring types
  SOAMetricType,
  SOAAlertSeverity,
  SOAAlertStatus,
  SOAAlertRuleDefinition,
  SOAAlertInstance,

  // Security types
  SOAAction,
  SOAAccessPolicy,
  SOAMaskingStrategy,
  SOAMaskingRule,
  SOAAuditEntry,

  // Retry policy
  RetryPolicyConfig,

  // Metrics
  SOAMetrics,

  // Event types
  SOAEventType,
  SOAEvent,
  SOAEventListener,

  // Configuration
  SOAConfig,
} from './types';

// ── SOASuite (Main Entry Point) ──────────────────────────────

export { SOASuite } from './soa';

// ── Service Registry ─────────────────────────────────────────

export {
  ServiceRegistry,
  generateId,
} from './registry';

// ── BPEL Process Engine ──────────────────────────────────────

export { BPELEngine } from './bpel';

// ── Human Task Manager ───────────────────────────────────────

export { HumanTaskManager } from './humantask';

// ── Complex Event Processing ─────────────────────────────────

export { CEPEngine } from './cep';

// ── B2B Gateway ──────────────────────────────────────────────

export { B2BGateway } from './b2b';

// ── Policy Manager ───────────────────────────────────────────

export { PolicyManager } from './policy';

// ── Service Mesh ─────────────────────────────────────────────

export { ServiceMesh } from './mesh';

// ── API Gateway ──────────────────────────────────────────────

export { APIGateway } from './api';

// ── Compensation Manager ─────────────────────────────────────

export { CompensationManager } from './compensation';

// ── Business Activity Monitoring ─────────────────────────────

export { BAMEngine } from './analytics';

// ── Monitoring & Metrics ─────────────────────────────────────

export {
  SOAMonitoringManager,
  SOAMetricCollector,
  SOAAlertEngine,
} from './monitoring';

// ── Security ─────────────────────────────────────────────────

export {
  SOASecurityManager,
  SOAAccessControl,
  SOADataMasker,
  SOAAuditLogger,
} from './security';

// ── Engine Plugin ────────────────────────────────────────────

export {
  createSOAPlugin,
  type EnginePlugin,
} from './plugin';
