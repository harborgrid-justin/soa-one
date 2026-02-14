// ============================================================
// SOA One ESB — Type Definitions
// ============================================================
//
// Comprehensive type system for the Enterprise Service Bus.
// Covers messages, channels, endpoints, routing, transformation,
// EIP patterns, resilience, sagas, metrics, and security.
// ============================================================

// ── Message Types ─────────────────────────────────────────────

/** Priority levels for message processing. */
export type MessagePriority = 'lowest' | 'low' | 'normal' | 'high' | 'highest';

/** Numeric weights for priorities (higher = more urgent). */
export const PRIORITY_WEIGHTS: Record<MessagePriority, number> = {
  lowest: 0,
  low: 1,
  normal: 2,
  high: 3,
  highest: 4,
};

/** Headers attached to every ESB message. */
export interface MessageHeaders {
  [key: string]: string | number | boolean | undefined;
  /** MIME content type (e.g. 'application/json'). */
  contentType?: string;
  /** Source endpoint/channel name. */
  source?: string;
  /** Destination endpoint/channel name. */
  destination?: string;
  /** Channel to send replies to. */
  replyTo?: string;
  /** Correlation ID for request-reply and saga tracking. */
  correlationId?: string;
  /** Logical message type (e.g. 'order.created'). */
  messageType?: string;
  /** Tenant ID for multi-tenant routing. */
  tenantId?: string;
  /** Retry attempt number. */
  retryCount?: number;
  /** Original message ID (if this is a retry or derived message). */
  originalMessageId?: string;
  /** Breadcrumb trail of services that have handled this message. */
  breadcrumb?: string;
}

/**
 * Core ESB message.
 * Generic over the body type for type-safe payloads.
 */
export interface ESBMessage<T = any> {
  /** Globally unique message ID. */
  id: string;
  /** Correlation ID linking related messages (e.g. request-reply). */
  correlationId?: string;
  /** ID of the message that caused this message to be created. */
  causationId?: string;
  /** ISO-8601 creation timestamp. */
  timestamp: string;
  /** Message headers for routing and metadata. */
  headers: MessageHeaders;
  /** Message payload. */
  body: T;
  /** Extensible metadata. */
  metadata: Record<string, any>;
  /** Channel to send replies to. */
  replyTo?: string;
  /** Processing priority. */
  priority: MessagePriority;
  /** TTL in milliseconds after which the message expires. */
  expiration?: number;
  /** Content type hint (e.g. 'application/json', 'text/xml'). */
  contentType?: string;
  /** Character encoding (e.g. 'utf-8'). */
  encoding?: string;
}

/** Envelope wrapping a message with delivery metadata. */
export interface MessageEnvelope<T = any> {
  message: ESBMessage<T>;
  /** Number of delivery attempts. */
  deliveryCount: number;
  /** ISO-8601 timestamp of first delivery attempt. */
  firstDeliveryTime: string;
  /** ISO-8601 timestamp of last delivery attempt. */
  lastDeliveryTime?: string;
  /** Error from last failed delivery attempt. */
  lastError?: string;
  /** Whether the message has been acknowledged. */
  acknowledged: boolean;
}

// ── Channel Types ─────────────────────────────────────────────

/** Channel delivery semantics. */
export type ChannelType =
  | 'point-to-point'
  | 'publish-subscribe'
  | 'dead-letter'
  | 'request-reply'
  | 'priority';

/** Configuration for a message channel. */
export interface ChannelConfig {
  /** Unique channel name. */
  name: string;
  /** Delivery type. */
  type: ChannelType;
  /** Maximum number of messages the channel can hold (0 = unbounded). */
  maxSize?: number;
  /** Default TTL for messages on this channel. */
  ttlMs?: number;
  /** Whether messages survive restarts (backed by persistent store). */
  persistent?: boolean;
  /** Name of the dead-letter channel for failed messages. */
  deadLetterChannel?: string;
  /** Max delivery attempts before routing to dead-letter. */
  maxRetries?: number;
  /** Base delay between retries. */
  retryDelayMs?: number;
  /** Filter predicates applied before delivery. */
  filters?: MessageFilter[];
  /** Transformer applied to messages entering the channel. */
  transformer?: TransformerConfig;
  /** Whether to deduplicate messages by ID. */
  deduplication?: boolean;
  /** Window in ms for deduplication lookups. */
  deduplicationWindowMs?: number;
}

/** A subscription to a pub-sub channel. */
export interface Subscription {
  id: string;
  channelName: string;
  subscriberId: string;
  filter?: MessageFilter;
  handler: MessageHandler;
  active: boolean;
  createdAt: string;
}

/** Function that handles an incoming message. */
export type MessageHandler<T = any> = (
  message: ESBMessage<T>,
) => void | Promise<void>;

// ── Endpoint Types ────────────────────────────────────────────

/** Protocol types for service endpoints. */
export type EndpointProtocol =
  | 'rest'
  | 'soap'
  | 'jms'
  | 'ftp'
  | 'file'
  | 'database'
  | 'email'
  | 'websocket'
  | 'grpc'
  | 'kafka'
  | 'amqp'
  | 'mqtt'
  | 'tcp'
  | 'udp'
  | 'custom';

/** HTTP methods for REST endpoints. */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';

/** Authentication types for endpoints. */
export type AuthType = 'none' | 'basic' | 'bearer' | 'api-key' | 'oauth2' | 'mtls' | 'saml' | 'custom';

/** Authentication configuration. */
export interface AuthConfig {
  type: AuthType;
  credentials?: Record<string, string>;
  /** Header name for API key auth. */
  headerName?: string;
  /** OAuth2 token endpoint. */
  tokenEndpoint?: string;
  /** OAuth2 scopes. */
  scopes?: string[];
  /** Custom auth handler name. */
  customHandler?: string;
}

/** Protocol-specific configuration. */
export interface ProtocolConfig {
  /** HTTP method (REST). */
  method?: HttpMethod;
  /** Custom headers. */
  headers?: Record<string, string>;
  /** Query parameters. */
  queryParams?: Record<string, string>;
  /** SOAP action header. */
  soapAction?: string;
  /** WSDL URL for SOAP. */
  wsdlUrl?: string;
  /** FTP transfer mode. */
  ftpMode?: 'ascii' | 'binary';
  /** Database query/statement. */
  query?: string;
  /** Kafka topic/AMQP exchange. */
  topic?: string;
  /** Consumer group (Kafka). */
  consumerGroup?: string;
  /** QoS level (MQTT). */
  qos?: 0 | 1 | 2;
}

/** Load balancing strategies. */
export type LoadBalancerStrategy =
  | 'round-robin'
  | 'weighted-round-robin'
  | 'least-connections'
  | 'random'
  | 'sticky'
  | 'failover';

/** Load balancer configuration. */
export interface LoadBalancerConfig {
  strategy: LoadBalancerStrategy;
  /** Endpoints to balance across. */
  targets: LoadBalancerTarget[];
  /** Health check interval in ms. */
  healthCheckIntervalMs?: number;
  /** Health check timeout in ms. */
  healthCheckTimeoutMs?: number;
}

/** A target in the load balancer pool. */
export interface LoadBalancerTarget {
  endpointName: string;
  weight?: number;
  healthy?: boolean;
  activeConnections?: number;
}

/** Full endpoint configuration. */
export interface EndpointConfig {
  /** Unique endpoint name. */
  name: string;
  /** Protocol type. */
  protocol: EndpointProtocol;
  /** Connection URI. */
  uri: string;
  /** Protocol-specific settings. */
  protocolConfig?: ProtocolConfig;
  /** Authentication. */
  auth?: AuthConfig;
  /** Request timeout in ms. */
  timeoutMs?: number;
  /** Retry policy for failed requests. */
  retryPolicy?: RetryPolicy;
  /** Circuit breaker configuration. */
  circuitBreaker?: CircuitBreakerConfig;
  /** Rate limiter configuration. */
  rateLimiter?: RateLimiterConfig;
  /** Load balancer configuration. */
  loadBalancer?: LoadBalancerConfig;
  /** Custom metadata. */
  metadata?: Record<string, any>;
  /** Whether the endpoint is active. */
  enabled: boolean;
}

// ── Routing Types ─────────────────────────────────────────────

/** Routing strategies for the message router. */
export type RoutingStrategy =
  | 'content-based'
  | 'header-based'
  | 'priority-based'
  | 'round-robin'
  | 'weighted'
  | 'failover'
  | 'multicast'
  | 'dynamic'
  | 'itinerary'
  | 'recipient-list';

/** A condition for routing decisions. */
export interface RoutingCondition {
  /** Dot-notation field path to evaluate (in body or headers). */
  field: string;
  /** Whether the field is in headers or body. */
  source: 'body' | 'headers' | 'metadata';
  /** Comparison operator. */
  operator: RoutingOperator;
  /** Comparison value. */
  value: any;
}

/** Operators available for routing conditions. */
export type RoutingOperator =
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
  | 'matches'
  | 'exists'
  | 'notExists';

/** Group of routing conditions joined by AND/OR logic. */
export interface RoutingConditionGroup {
  logic: 'AND' | 'OR';
  conditions: (RoutingCondition | RoutingConditionGroup)[];
}

/** A routing rule that maps a message to one or more destinations. */
export interface Route {
  /** Unique route identifier. */
  id: string;
  /** Human-readable route name. */
  name: string;
  /** Source channel name. */
  source: string;
  /** Destination channel(s) or endpoint(s). */
  destinations: string[];
  /** Condition(s) that must be met for this route to activate. */
  condition?: RoutingCondition | RoutingConditionGroup;
  /** Priority for route evaluation ordering (higher = first). */
  priority: number;
  /** Whether this route is active. */
  enabled: boolean;
  /** Transformer steps to apply before delivery. */
  transformers?: TransformerConfig[];
  /** Filters to apply before delivery. */
  filters?: MessageFilter[];
  /** Error handler for failed deliveries. */
  errorHandler?: ErrorHandlerConfig;
  /** Routing strategy (overrides router-level default). */
  strategy?: RoutingStrategy;
}

/** Routing slip entry for itinerary-based routing. */
export interface RoutingSlipEntry {
  /** Destination channel or endpoint name. */
  destination: string;
  /** Transformer to apply at this step. */
  transformer?: TransformerConfig;
  /** Whether this step has been completed. */
  completed: boolean;
}

/** A routing table containing multiple routes. */
export interface RoutingTable {
  /** Default destination when no route matches. */
  defaultDestination?: string;
  /** Ordered list of routes. */
  routes: Route[];
  /** Strategy for route selection. */
  strategy: RoutingStrategy;
}

// ── Transformation Types ──────────────────────────────────────

/** Types of message transformations. */
export type TransformationType =
  | 'map'
  | 'template'
  | 'script'
  | 'xslt'
  | 'jsonata'
  | 'rename'
  | 'remove'
  | 'merge'
  | 'flatten'
  | 'unflatten'
  | 'custom';

/** Configuration for a single transformation step. */
export interface TransformerConfig {
  /** Transformer type. */
  type: TransformationType;
  /** Human-readable name. */
  name: string;
  /** Type-specific configuration. */
  config: Record<string, any>;
}

/** A field mapping for 'map' transformations. */
export interface FieldMapping {
  /** Source dot-notation path. */
  source: string;
  /** Destination dot-notation path. */
  target: string;
  /** Optional transformation function name. */
  transform?: string;
  /** Default value if source is missing. */
  defaultValue?: any;
}

/** A transformation pipeline definition. */
export interface TransformationPipeline {
  /** Pipeline name. */
  name: string;
  /** Ordered list of transformer steps. */
  steps: TransformerConfig[];
  /** Whether to stop on first error or continue. */
  stopOnError: boolean;
}

// ── Filter Types ──────────────────────────────────────────────

/** A predicate that accepts or rejects a message. */
export interface MessageFilter {
  /** Filter name. */
  name: string;
  /** Condition(s) that must be met for the message to pass. */
  condition: RoutingCondition | RoutingConditionGroup;
  /** Whether to negate the condition (reject matching messages). */
  negate?: boolean;
}

/** Result of applying a filter. */
export interface FilterResult {
  passed: boolean;
  filterName: string;
  reason?: string;
}

// ── EIP Pattern Types ─────────────────────────────────────────

/** Enterprise Integration Pattern types. */
export type EIPPatternType =
  | 'splitter'
  | 'aggregator'
  | 'filter'
  | 'enricher'
  | 'scatter-gather'
  | 'resequencer'
  | 'content-enricher'
  | 'claim-check'
  | 'wire-tap'
  | 'idempotent-consumer'
  | 'competing-consumer'
  | 'normalizer'
  | 'routing-slip'
  | 'process-manager'
  | 'message-broker';

/** Splitter configuration: splits one message into many. */
export interface SplitterConfig {
  /** Dot-notation path to the array field to split on. */
  splitField: string;
  /** Whether to preserve the original message body as context. */
  preserveOriginal: boolean;
  /** Whether to add split metadata (index, total) to each part. */
  addSplitMetadata: boolean;
}

/** Aggregator configuration: combines many messages into one. */
export interface AggregatorConfig {
  /** Correlation field to group messages. */
  correlationField: string;
  /** Whether the correlation field is in headers, body, or metadata. */
  correlationSource: 'body' | 'headers' | 'metadata';
  /** Number of messages to wait for before aggregating. */
  completionSize?: number;
  /** Timeout in ms to wait for messages before aggregating what we have. */
  completionTimeoutMs?: number;
  /** Aggregation strategy. */
  strategy: AggregationStrategy;
  /** Dot-notation field to collect values from. */
  aggregateField?: string;
}

/** How to combine aggregated messages. */
export type AggregationStrategy = 'list' | 'merge' | 'first' | 'last' | 'custom';

/** Enricher configuration: enriches a message with external data. */
export interface EnricherConfig {
  /** Source from which to fetch enrichment data. */
  source: EnrichmentSource;
  /** Field in the enrichment response to extract. */
  responseField?: string;
  /** Dot-notation path to place the enrichment data in the message. */
  targetField: string;
  /** Dot-notation path for the lookup key from the message. */
  lookupField: string;
  /** Whether to merge or replace the target field. */
  mergeStrategy: 'replace' | 'merge' | 'append';
  /** Cache TTL for enrichment responses. */
  cacheTtlMs?: number;
}

/** Source for enrichment data. */
export interface EnrichmentSource {
  type: 'endpoint' | 'channel' | 'function' | 'cache';
  name: string;
  config?: Record<string, any>;
}

/** Scatter-gather configuration. */
export interface ScatterGatherConfig {
  /** Channels/endpoints to scatter the message to. */
  targets: string[];
  /** Timeout in ms to wait for all responses. */
  timeoutMs: number;
  /** Minimum number of responses required. */
  requiredResponses?: number;
  /** How to combine gathered responses. */
  aggregationStrategy: AggregationStrategy;
}

/** Resequencer configuration: reorders messages by a sequence field. */
export interface ResequencerConfig {
  /** Dot-notation path to the sequence number field. */
  sequenceField: string;
  /** Whether the sequence field is in headers, body, or metadata. */
  sequenceSource: 'body' | 'headers' | 'metadata';
  /** Correlation field for grouping. */
  correlationField: string;
  correlationSource: 'body' | 'headers' | 'metadata';
  /** Timeout before releasing out-of-order messages. */
  timeoutMs: number;
  /** Whether to release in batches or one at a time. */
  releaseStrategy: 'individual' | 'batch';
}

/** Claim check configuration: store payload, pass reference. */
export interface ClaimCheckConfig {
  /** Where to store claimed data. */
  storeName: string;
  /** TTL for stored data in ms. */
  ttlMs?: number;
  /** Fields to extract from the message into the store. */
  claimFields?: string[];
}

/** Wire tap configuration: tap a copy of messages for monitoring. */
export interface WireTapConfig {
  /** Channel to copy messages to. */
  tapChannel: string;
  /** Filter to selectively tap messages. */
  filter?: MessageFilter;
  /** Whether to include full body or just headers. */
  headersOnly: boolean;
}

// ── Resilience Types ──────────────────────────────────────────

/** Circuit breaker states. */
export type CircuitBreakerState = 'closed' | 'open' | 'half-open';

/** Circuit breaker configuration. */
export interface CircuitBreakerConfig {
  /** Number of failures before opening the circuit. */
  failureThreshold: number;
  /** Number of successes in half-open to close the circuit. */
  successThreshold: number;
  /** Time in ms to wait before transitioning from open to half-open. */
  resetTimeoutMs: number;
  /** Max calls allowed in half-open state. */
  halfOpenMaxCalls: number;
  /** Optional list of error types/codes that count as failures. */
  failureOn?: string[];
  /** Optional list of error types/codes to ignore. */
  ignoreOn?: string[];
}

/** Retry policy configuration. */
export interface RetryPolicy {
  /** Maximum number of retry attempts. */
  maxAttempts: number;
  /** Initial delay before first retry in ms. */
  initialDelayMs: number;
  /** Maximum delay between retries in ms. */
  maxDelayMs: number;
  /** Multiplier for exponential backoff. */
  backoffMultiplier: number;
  /** Whether to add jitter to retry delays. */
  jitter?: boolean;
  /** Error types/codes that are retryable. */
  retryableErrors?: string[];
  /** Error types/codes that should NOT be retried. */
  nonRetryableErrors?: string[];
}

/** Rate limiter configuration. */
export interface RateLimiterConfig {
  /** Maximum number of operations allowed in the window. */
  maxOperations: number;
  /** Time window in ms. */
  windowMs: number;
  /** Strategy for rate limiting. */
  strategy: 'fixed-window' | 'sliding-window' | 'token-bucket';
  /** Whether to queue excess requests or reject them. */
  overflowStrategy: 'reject' | 'queue';
  /** Maximum queue depth when using 'queue' overflow strategy. */
  maxQueueSize?: number;
}

/** Bulkhead configuration for concurrency isolation. */
export interface BulkheadConfig {
  /** Maximum concurrent executions. */
  maxConcurrent: number;
  /** Maximum waiting queue depth. */
  maxQueue: number;
  /** Timeout for queued items in ms. */
  queueTimeoutMs?: number;
}

/** Timeout configuration. */
export interface TimeoutConfig {
  /** Timeout duration in ms. */
  timeoutMs: number;
  /** Whether to cancel the underlying operation on timeout. */
  cancelOnTimeout?: boolean;
  /** Fallback value or handler on timeout. */
  fallback?: any;
}

// ── Error Handling Types ──────────────────────────────────────

/** Error handling strategies. */
export type ErrorStrategy =
  | 'retry'
  | 'dead-letter'
  | 'discard'
  | 'fallback'
  | 'compensate'
  | 'escalate';

/** Error handler configuration. */
export interface ErrorHandlerConfig {
  /** Strategy to use. */
  strategy: ErrorStrategy;
  /** Retry policy (if strategy is 'retry'). */
  retryPolicy?: RetryPolicy;
  /** Dead letter channel (if strategy is 'dead-letter'). */
  deadLetterChannel?: string;
  /** Fallback value or handler (if strategy is 'fallback'). */
  fallback?: any;
  /** Maximum errors before escalation. */
  escalationThreshold?: number;
  /** Channel/endpoint for escalation notifications. */
  escalationTarget?: string;
}

/** Structured ESB error. */
export interface ESBError {
  /** Error code for programmatic handling. */
  code: string;
  /** Human-readable error message. */
  message: string;
  /** ISO-8601 timestamp. */
  timestamp: string;
  /** Source component (channel, router, endpoint, etc.). */
  source: string;
  /** The message that caused the error, if available. */
  messageId?: string;
  /** Stack trace (debug mode only). */
  stack?: string;
  /** Whether this error is retryable. */
  retryable: boolean;
  /** Nested cause, if any. */
  cause?: ESBError;
}

// ── Saga / Transaction Types ──────────────────────────────────

/** Saga execution status. */
export type SagaStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'compensating'
  | 'compensated'
  | 'failed';

/** Saga step status. */
export type SagaStepStatus =
  | 'pending'
  | 'executing'
  | 'completed'
  | 'compensating'
  | 'compensated'
  | 'failed';

/** Context passed to saga step handlers. */
export interface SagaContext {
  /** Saga instance ID. */
  sagaId: string;
  /** Correlation ID linking all saga messages. */
  correlationId: string;
  /** Accumulated data from previous steps. */
  data: Record<string, any>;
  /** Extensible metadata. */
  metadata: Record<string, any>;
  /** Step results keyed by step name. */
  stepResults: Record<string, any>;
}

/** A single step in a saga. */
export interface SagaStepDefinition {
  /** Step name. */
  name: string;
  /** Description. */
  description?: string;
  /** Timeout for this step in ms. */
  timeoutMs?: number;
  /** Retry policy for this step. */
  retryPolicy?: RetryPolicy;
  /** Dependencies: step names that must complete first. */
  dependsOn?: string[];
}

/** A complete saga definition. */
export interface SagaDefinition {
  /** Unique saga ID. */
  id: string;
  /** Human-readable saga name. */
  name: string;
  /** Description. */
  description?: string;
  /** Ordered steps. */
  steps: SagaStepDefinition[];
  /** Timeout for the entire saga in ms. */
  timeoutMs?: number;
}

/** A saga execution instance with runtime state. */
export interface SagaInstance {
  /** Unique execution instance ID. */
  instanceId: string;
  /** Saga definition ID. */
  sagaId: string;
  /** Saga definition name. */
  sagaName: string;
  /** Overall status. */
  status: SagaStatus;
  /** Current step index. */
  currentStep: number;
  /** Per-step status tracking. */
  stepStatuses: Record<string, SagaStepStatus>;
  /** Context data. */
  context: SagaContext;
  /** Start time. */
  startedAt: string;
  /** Completion time. */
  completedAt?: string;
  /** Error details if failed. */
  error?: string;
  /** Execution log. */
  log: SagaLogEntry[];
}

/** A log entry for saga execution. */
export interface SagaLogEntry {
  timestamp: string;
  stepName: string;
  action: 'execute' | 'compensate' | 'skip';
  status: 'started' | 'completed' | 'failed';
  error?: string;
  durationMs?: number;
}

// ── Metrics Types ─────────────────────────────────────────────

/** Metrics snapshot for the ESB. */
export interface ESBMetrics {
  /** Total messages processed since startup. */
  messagesProcessed: number;
  /** Total messages that failed processing. */
  messagesFailed: number;
  /** Total messages currently in-flight. */
  messagesInFlight: number;
  /** Average processing latency in ms. */
  averageLatencyMs: number;
  /** P95 processing latency in ms. */
  p95LatencyMs: number;
  /** P99 processing latency in ms. */
  p99LatencyMs: number;
  /** Current depth per channel. */
  channelDepths: Record<string, number>;
  /** Endpoint health status. */
  endpointHealth: Record<string, EndpointHealthStatus>;
  /** Circuit breaker states per endpoint. */
  circuitBreakerStates: Record<string, CircuitBreakerState>;
  /** Messages processed per second (recent window). */
  throughputPerSecond: number;
  /** Active saga instances. */
  activeSagas: number;
  /** Uptime in ms. */
  uptimeMs: number;
  /** Timestamp of this snapshot. */
  timestamp: string;
}

/** Health status for an endpoint. */
export interface EndpointHealthStatus {
  endpointName: string;
  healthy: boolean;
  lastCheckTime?: string;
  lastResponseTimeMs?: number;
  consecutiveFailures: number;
  totalRequests: number;
  totalFailures: number;
  errorRate: number;
}

/** A single metric data point for time-series tracking. */
export interface MetricDataPoint {
  name: string;
  value: number;
  timestamp: string;
  labels?: Record<string, string>;
}

/** Metric types for the collector. */
export type MetricType = 'counter' | 'gauge' | 'histogram' | 'summary';

// ── Security Types ────────────────────────────────────────────

/** Security policy for message processing. */
export interface SecurityPolicy {
  /** Whether message bodies should be encrypted in transit. */
  encryptionEnabled: boolean;
  /** Encryption algorithm. */
  encryptionAlgorithm?: 'aes-256-gcm' | 'aes-128-gcm' | 'chacha20-poly1305';
  /** Whether message integrity should be verified. */
  integrityCheckEnabled: boolean;
  /** Hashing algorithm for integrity checks. */
  integrityAlgorithm?: 'sha256' | 'sha384' | 'sha512';
  /** Whether to propagate auth context between services. */
  authPropagation: boolean;
  /** Allowed message types (whitelist). */
  allowedMessageTypes?: string[];
  /** Blocked message types (blacklist). */
  blockedMessageTypes?: string[];
  /** Maximum message body size in bytes. */
  maxMessageSizeBytes?: number;
  /** Whether to sanitize message bodies. */
  sanitizePayloads: boolean;
}

/** Security context propagated with messages. */
export interface SecurityContext {
  /** Authenticated principal (user, service, etc.). */
  principal?: string;
  /** Roles/permissions. */
  roles?: string[];
  /** Auth token (opaque). */
  token?: string;
  /** Token expiration. */
  tokenExpiry?: string;
  /** Tenant ID. */
  tenantId?: string;
  /** Additional claims. */
  claims?: Record<string, any>;
}

// ── Validation Types ──────────────────────────────────────────

/** Schema validation configuration. */
export interface ValidationConfig {
  /** Whether to validate inbound messages. */
  validateInbound: boolean;
  /** Whether to validate outbound messages. */
  validateOutbound: boolean;
  /** What to do on validation failure. */
  onFailure: 'reject' | 'dead-letter' | 'log-and-continue';
  /** Schemas keyed by message type. */
  schemas: Record<string, MessageSchema>;
}

/** JSON-Schema-like message schema definition. */
export interface MessageSchema {
  /** Schema ID. */
  id: string;
  /** Schema name. */
  name: string;
  /** Schema version. */
  version: string;
  /** Field definitions. */
  fields: SchemaField[];
}

/** A field definition within a message schema. */
export interface SchemaField {
  /** Field name (dot-notation path). */
  name: string;
  /** Field data type. */
  type: 'string' | 'number' | 'boolean' | 'object' | 'array' | 'date' | 'any';
  /** Whether the field is required. */
  required: boolean;
  /** Minimum value (number) or minimum length (string/array). */
  min?: number;
  /** Maximum value (number) or maximum length (string/array). */
  max?: number;
  /** Regex pattern (string). */
  pattern?: string;
  /** Allowed values (enum). */
  enumValues?: any[];
  /** Nested fields (object/array). */
  children?: SchemaField[];
  /** Description for documentation. */
  description?: string;
}

/** Result of validating a message against a schema. */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

/** A single validation error. */
export interface ValidationError {
  field: string;
  message: string;
  expectedType?: string;
  actualValue?: any;
}

// ── Scheduling Types ──────────────────────────────────────────

/** Scheduled message delivery configuration. */
export interface ScheduledDelivery {
  /** Unique schedule ID. */
  id: string;
  /** Message to deliver. */
  message: ESBMessage;
  /** Target channel or endpoint. */
  destination: string;
  /** ISO-8601 delivery time (one-time). */
  deliverAt?: string;
  /** Delay in ms from now (one-time). */
  delayMs?: number;
  /** Cron expression (recurring). */
  cronExpression?: string;
  /** Whether the schedule is active. */
  active: boolean;
  /** Maximum deliveries for recurring schedules (0 = unlimited). */
  maxDeliveries?: number;
  /** Number of deliveries made so far. */
  deliveryCount: number;
  /** ISO-8601 timestamp of last delivery. */
  lastDeliveredAt?: string;
  /** ISO-8601 timestamp of next scheduled delivery. */
  nextDeliveryAt?: string;
}

// ── Serialization Types ───────────────────────────────────────

/** Supported serialization formats. */
export type SerializationFormat = 'json' | 'xml' | 'csv' | 'yaml' | 'msgpack' | 'protobuf' | 'avro' | 'custom';

/** Serializer/deserializer interface. */
export interface SerializerConfig {
  /** Format to serialize to. */
  format: SerializationFormat;
  /** Format-specific options. */
  options?: Record<string, any>;
}

// ── Bus Configuration ─────────────────────────────────────────

/** Full ESB configuration. */
export interface ESBConfig {
  /** Bus instance name. */
  name: string;
  /** Channels to create on startup. */
  channels?: ChannelConfig[];
  /** Endpoints to register on startup. */
  endpoints?: EndpointConfig[];
  /** Routing table. */
  routing?: RoutingTable;
  /** Security policy. */
  security?: SecurityPolicy;
  /** Validation configuration. */
  validation?: ValidationConfig;
  /** Default error handler. */
  errorHandler?: ErrorHandlerConfig;
  /** Global metrics enabled. */
  metricsEnabled?: boolean;
  /** Metrics collection interval in ms. */
  metricsIntervalMs?: number;
  /** Global metadata. */
  metadata?: Record<string, any>;
  /** Maximum concurrent message processing. */
  maxConcurrency?: number;
  /** Graceful shutdown timeout in ms. */
  shutdownTimeoutMs?: number;
}

// ── Middleware Types ──────────────────────────────────────────

/** Context passed through the middleware pipeline. */
export interface MiddlewareContext<T = any> {
  message: ESBMessage<T>;
  metadata: Record<string, any>;
  /** The current route being processed. */
  route?: Route;
  /** The source channel name. */
  sourceChannel?: string;
  /** The destination channel/endpoint name. */
  destinationChannel?: string;
  /** Timestamp of middleware entry. */
  startTime: number;
  /** Whether to abort processing. */
  abort: boolean;
  /** Abort reason if abort is true. */
  abortReason?: string;
  /** Security context. */
  security?: SecurityContext;
}

/** Middleware function signature (Express-style next pattern). */
export type MiddlewareFunction<T = any> = (
  ctx: MiddlewareContext<T>,
  next: () => Promise<void>,
) => Promise<void>;

/** Middleware definition. */
export interface MiddlewareDefinition {
  /** Middleware name. */
  name: string;
  /** Execution priority (lower = earlier). */
  order: number;
  /** The middleware function. */
  handler: MiddlewareFunction;
  /** Whether this middleware is enabled. */
  enabled: boolean;
}

// ── Protocol Mediation Types ─────────────────────────────────

/** Protocol mediation rule: convert between protocols. */
export interface MediationRule {
  /** Rule name. */
  name: string;
  /** Source protocol. */
  sourceProtocol: EndpointProtocol;
  /** Target protocol. */
  targetProtocol: EndpointProtocol;
  /** Request transformation. */
  requestTransformer?: TransformerConfig;
  /** Response transformation. */
  responseTransformer?: TransformerConfig;
  /** Header mappings. */
  headerMappings?: Record<string, string>;
}

// ── Event Types ───────────────────────────────────────────────

/** ESB lifecycle and operational events. */
export type ESBEventType =
  | 'bus:started'
  | 'bus:stopped'
  | 'bus:error'
  | 'channel:created'
  | 'channel:destroyed'
  | 'message:sent'
  | 'message:received'
  | 'message:transformed'
  | 'message:routed'
  | 'message:filtered'
  | 'message:failed'
  | 'message:deadLettered'
  | 'message:expired'
  | 'endpoint:connected'
  | 'endpoint:disconnected'
  | 'endpoint:error'
  | 'circuit:opened'
  | 'circuit:closed'
  | 'circuit:halfOpen'
  | 'saga:started'
  | 'saga:completed'
  | 'saga:compensating'
  | 'saga:failed'
  | 'route:matched'
  | 'route:noMatch';

/** An event emitted by the ESB. */
export interface ESBEvent {
  type: ESBEventType;
  timestamp: string;
  source: string;
  data?: Record<string, any>;
  messageId?: string;
  error?: string;
}

/** Event listener function. */
export type ESBEventListener = (event: ESBEvent) => void;
