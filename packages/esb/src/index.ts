// ============================================================
// SOA One ESB — Public API
// ============================================================
//
// Enterprise Service Bus module for SOA One.
// Zero-dependency, 100% compatible with @soa-one/engine SDK.
// ============================================================

// ── Core Types ──────────────────────────────────────────────

export type {
  // Message types
  MessagePriority,
  MessageHeaders,
  ESBMessage,
  MessageEnvelope,
  MessageHandler,

  // Channel types
  ChannelType,
  ChannelConfig,
  Subscription,

  // Endpoint types
  EndpointProtocol,
  HttpMethod,
  AuthType,
  AuthConfig,
  ProtocolConfig,
  LoadBalancerStrategy,
  LoadBalancerConfig,
  LoadBalancerTarget,
  EndpointConfig,

  // Routing types
  RoutingStrategy,
  RoutingCondition,
  RoutingConditionGroup,
  RoutingOperator,
  Route,
  RoutingSlipEntry,
  RoutingTable,

  // Transformation types
  TransformationType,
  TransformerConfig,
  FieldMapping,
  TransformationPipeline,

  // Filter types
  MessageFilter,
  FilterResult,

  // EIP pattern types
  EIPPatternType,
  SplitterConfig,
  AggregatorConfig,
  AggregationStrategy,
  EnricherConfig,
  EnrichmentSource,
  ScatterGatherConfig,
  ResequencerConfig,
  ClaimCheckConfig,
  WireTapConfig,

  // Resilience types
  CircuitBreakerState,
  CircuitBreakerConfig,
  RetryPolicy,
  RateLimiterConfig,
  BulkheadConfig,
  TimeoutConfig,

  // Error handling types
  ErrorStrategy,
  ErrorHandlerConfig,
  ESBError,

  // Saga types
  SagaStatus,
  SagaStepStatus,
  SagaContext,
  SagaStepDefinition,
  SagaDefinition,
  SagaInstance,
  SagaLogEntry,

  // Metrics types
  ESBMetrics,
  EndpointHealthStatus,
  MetricDataPoint,
  MetricType,

  // Security types
  SecurityPolicy,
  SecurityContext,

  // Validation types
  ValidationConfig,
  MessageSchema,
  SchemaField,
  ValidationResult,
  ValidationError,

  // Scheduling types
  ScheduledDelivery,

  // Serialization types
  SerializationFormat,
  SerializerConfig,

  // Middleware types
  MiddlewareContext,
  MiddlewareFunction,
  MiddlewareDefinition,

  // Protocol mediation types
  MediationRule,

  // Event types
  ESBEventType,
  ESBEvent,
  ESBEventListener,

  // Bus configuration
  ESBConfig,
} from './types';

export { PRIORITY_WEIGHTS } from './types';

// ── ServiceBus (Main Entry Point) ────────────────────────────

export { ServiceBus } from './bus';

// ── Message Channels ─────────────────────────────────────────

export {
  MessageChannel,
  ChannelManager,
  createMessage,
  createEnvelope,
  generateId,
  resolvePath,
  evaluateRoutingOperator,
} from './channel';

// ── Message Router ───────────────────────────────────────────

export { MessageRouter, type RouteMatch } from './router';

// ── Message Transformer ──────────────────────────────────────

export {
  MessageTransformer,
  builtInTransformFunctions,
  setPath,
  deletePath,
} from './transformer';

// ── Enterprise Integration Patterns ──────────────────────────

export {
  Splitter,
  Aggregator,
  ContentFilter,
  ContentEnricher,
  ScatterGather,
  Resequencer,
  ClaimCheck,
  WireTap,
  IdempotentConsumer,
  Normalizer,
  type FormatDetector,
} from './patterns';

// ── Resilience Patterns ──────────────────────────────────────

export {
  CircuitBreaker,
  CircuitBreakerOpenError,
  RetryExecutor,
  Bulkhead,
  BulkheadFullError,
  BulkheadTimeoutError,
  TimeoutExecutor,
  TimeoutError,
  RateLimiter,
  RateLimitExceededError,
  ResilienceBuilder,
} from './resilience';

// ── Middleware Pipeline ──────────────────────────────────────

export {
  MiddlewarePipeline,
  createLoggingMiddleware,
  createCorrelationMiddleware,
  createBreadcrumbMiddleware,
  createSizeLimitMiddleware,
  createTimestampMiddleware,
  createSecurityMiddleware,
} from './middleware';

// ── Protocol Mediation ───────────────────────────────────────

export {
  ProtocolMediator,
  type ProtocolAdapter,
  RestProtocolAdapter,
  SoapProtocolAdapter,
  JmsProtocolAdapter,
} from './mediator';

// ── Message Correlation ──────────────────────────────────────

export {
  CorrelationEngine,
  type CorrelationStrategy,
  type CorrelationKeyConfig,
  type CorrelationGroup,
  type CompletionPredicate,
} from './correlation';

// ── Saga Coordinator ─────────────────────────────────────────

export {
  SagaCoordinator,
  type SagaStepExecutor,
  type SagaStepCompensator,
  type SagaStepRegistration,
} from './saga';

// ── Metrics & Observability ──────────────────────────────────

export { MetricCollector } from './metrics';

// ── Security ─────────────────────────────────────────────────

export {
  MessageSigner,
  SecurityGuard,
  SecurityViolationError,
} from './security';

// ── Schema Validation ────────────────────────────────────────

export { SchemaValidator } from './validator';

// ── Scheduled Delivery ───────────────────────────────────────

export {
  MessageScheduler,
  parseCronExpression,
  matchesCron,
  nextCronOccurrence,
  type CronSchedule,
} from './scheduler';

// ── Engine Plugin ────────────────────────────────────────────

export {
  createESBPlugin,
  type EnginePlugin,
} from './plugin';
