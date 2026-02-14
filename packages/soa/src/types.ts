// ============================================================
// SOA One SOA — Type Definitions
// ============================================================
//
// Comprehensive type system for the enhanced SOA Suite module.
// Covers service registry, BPEL process orchestration, human
// tasks, complex event processing, B2B gateway, policy
// management, service mesh, API gateway, compensation,
// business activity monitoring, metrics, and security.
//
// Surpasses Oracle SOA Suite with additional capabilities:
// - Full BPEL-like process orchestration with scopes & handlers
// - Service registry with versioning, contracts, and discovery
// - Human task engine with escalation, delegation, and SLA
// - Complex event processing with temporal patterns
// - B2B gateway with partner management and TPA
// - Policy manager with SLA enforcement and throttling
// - Service mesh with traffic management and observability
// - API gateway with lifecycle management and rate limiting
// - Advanced compensation with nested scopes
// - Business activity monitoring and SLA tracking
// ============================================================

// ── Service Registry Types ──────────────────────────────────

/** Service protocol types. */
export type ServiceProtocol =
  | 'rest'
  | 'soap'
  | 'grpc'
  | 'graphql'
  | 'websocket'
  | 'jms'
  | 'amqp'
  | 'kafka'
  | 'custom';

/** Service status. */
export type ServiceStatus =
  | 'active'
  | 'inactive'
  | 'deprecated'
  | 'retired'
  | 'draft'
  | 'maintenance';

/** Service visibility for registry. */
export type ServiceVisibility = 'public' | 'internal' | 'partner' | 'private';

/** A versioned service contract. */
export interface ServiceContract {
  /** Contract ID. */
  id: string;
  /** Human-readable contract name. */
  name: string;
  /** Contract version (semver). */
  version: string;
  /** Schema or WSDL definition (serialized). */
  schema: string;
  /** Contract format. */
  format: 'openapi' | 'wsdl' | 'protobuf' | 'graphql-sdl' | 'asyncapi' | 'json-schema' | 'custom';
  /** ISO-8601 creation timestamp. */
  createdAt: string;
  /** ISO-8601 last update timestamp. */
  updatedAt: string;
  /** Whether this is the active version. */
  active: boolean;
  /** Backwards-compatible with previous version. */
  backwardsCompatible: boolean;
  /** Custom metadata. */
  metadata: Record<string, any>;
}

/** A service endpoint registration. */
export interface ServiceEndpoint {
  /** Endpoint URI. */
  uri: string;
  /** Protocol. */
  protocol: ServiceProtocol;
  /** Weight for load balancing. */
  weight: number;
  /** Whether endpoint is healthy. */
  healthy: boolean;
  /** Last health check time. */
  lastHealthCheck?: string;
  /** Response time in ms from last check. */
  lastResponseTimeMs?: number;
  /** Custom metadata. */
  metadata: Record<string, any>;
}

/** A service registration in the registry. */
export interface ServiceRegistration {
  /** Unique service ID. */
  id: string;
  /** Service name. */
  name: string;
  /** Service namespace / domain. */
  namespace: string;
  /** Current version. */
  version: string;
  /** Service description. */
  description: string;
  /** Protocol used. */
  protocol: ServiceProtocol;
  /** Registered endpoints. */
  endpoints: ServiceEndpoint[];
  /** Service contracts. */
  contracts: ServiceContract[];
  /** Service status. */
  status: ServiceStatus;
  /** Visibility scope. */
  visibility: ServiceVisibility;
  /** Owner team or user. */
  owner: string;
  /** Tags for categorization. */
  tags: string[];
  /** Dependencies on other services. */
  dependencies: string[];
  /** SLA policy ID (if bound). */
  slaPolicyId?: string;
  /** ISO-8601 registration timestamp. */
  registeredAt: string;
  /** ISO-8601 last update timestamp. */
  updatedAt: string;
  /** Health check configuration. */
  healthCheck?: HealthCheckConfig;
  /** Custom metadata. */
  metadata: Record<string, any>;
}

/** Health check configuration. */
export interface HealthCheckConfig {
  /** Health check endpoint path. */
  path: string;
  /** Check interval in ms. */
  intervalMs: number;
  /** Check timeout in ms. */
  timeoutMs: number;
  /** Consecutive failures before marking unhealthy. */
  unhealthyThreshold: number;
  /** Consecutive successes before marking healthy. */
  healthyThreshold: number;
}

/** Service discovery query. */
export interface ServiceDiscoveryQuery {
  /** Filter by name (partial match). */
  name?: string;
  /** Filter by namespace. */
  namespace?: string;
  /** Filter by protocol. */
  protocol?: ServiceProtocol;
  /** Filter by status. */
  status?: ServiceStatus;
  /** Filter by visibility. */
  visibility?: ServiceVisibility;
  /** Filter by tags (any match). */
  tags?: string[];
  /** Filter by owner. */
  owner?: string;
  /** Full-text search. */
  text?: string;
}

// ── BPEL Process Types ──────────────────────────────────────

/** BPEL activity types. */
export type BPELActivityType =
  | 'invoke'
  | 'receive'
  | 'reply'
  | 'assign'
  | 'throw'
  | 'rethrow'
  | 'wait'
  | 'empty'
  | 'exit'
  | 'sequence'
  | 'flow'
  | 'if'
  | 'while'
  | 'repeatUntil'
  | 'forEach'
  | 'pick'
  | 'scope'
  | 'compensate'
  | 'compensateScope'
  | 'validate';

/** BPEL process status. */
export type BPELProcessStatus =
  | 'ready'
  | 'active'
  | 'completed'
  | 'faulted'
  | 'terminated'
  | 'suspended'
  | 'compensating'
  | 'compensated';

/** BPEL activity status. */
export type BPELActivityStatus =
  | 'pending'
  | 'executing'
  | 'completed'
  | 'faulted'
  | 'skipped'
  | 'compensating'
  | 'compensated';

/** Partner link definition. */
export interface PartnerLink {
  /** Partner link name. */
  name: string;
  /** Partner link type. */
  partnerLinkType: string;
  /** My role in the partner link. */
  myRole?: string;
  /** Partner role. */
  partnerRole?: string;
  /** Service ID in registry. */
  serviceId?: string;
}

/** BPEL variable definition. */
export interface BPELVariable {
  /** Variable name. */
  name: string;
  /** Variable type. */
  type: 'message' | 'element' | 'simple';
  /** Type definition or schema reference. */
  typeRef?: string;
  /** Initial value. */
  initialValue?: any;
}

/** Correlation set for message correlation. */
export interface CorrelationSet {
  /** Set name. */
  name: string;
  /** Property names used for correlation. */
  properties: string[];
  /** Whether initiated on first message. */
  initiateMode: 'yes' | 'no' | 'join';
}

/** Fault handler definition. */
export interface FaultHandler {
  /** Fault name to catch (or '*' for catch-all). */
  faultName: string;
  /** Fault variable name. */
  faultVariable?: string;
  /** Activities to execute when fault is caught. */
  activityId: string;
}

/** Compensation handler definition. */
export interface CompensationHandler {
  /** Scope name this handler compensates. */
  scopeName: string;
  /** Activity to execute for compensation. */
  activityId: string;
}

/** Event handler for pick/onMessage/onAlarm. */
export interface EventHandler {
  /** Event type. */
  type: 'message' | 'alarm';
  /** Partner link (for message events). */
  partnerLink?: string;
  /** Operation name (for message events). */
  operation?: string;
  /** Duration expression (for alarm). */
  duration?: string;
  /** Deadline expression (for alarm). */
  deadline?: string;
  /** Activity to execute. */
  activityId: string;
}

/** A BPEL activity definition. */
export interface BPELActivity {
  /** Unique activity ID. */
  id: string;
  /** Activity name. */
  name: string;
  /** Activity type. */
  type: BPELActivityType;
  /** Partner link reference (for invoke/receive/reply). */
  partnerLink?: string;
  /** Operation name (for invoke/receive/reply). */
  operation?: string;
  /** Input variable (for invoke). */
  inputVariable?: string;
  /** Output variable (for invoke/receive). */
  outputVariable?: string;
  /** Condition expression (for if/while/repeatUntil). */
  condition?: string;
  /** Child activity IDs (for sequence/flow/scope). */
  children?: string[];
  /** Else activity ID (for if). */
  elseActivity?: string;
  /** Assignment copies (for assign). */
  copies?: AssignCopy[];
  /** Fault name (for throw). */
  faultName?: string;
  /** Fault variable (for throw). */
  faultVariable?: string;
  /** Wait duration in ms (for wait). */
  waitDurationMs?: number;
  /** Wait until ISO-8601 deadline (for wait). */
  waitDeadline?: string;
  /** Event handlers (for pick). */
  eventHandlers?: EventHandler[];
  /** Fault handlers (for scope). */
  faultHandlers?: FaultHandler[];
  /** Compensation handler (for scope). */
  compensationHandler?: CompensationHandler;
  /** Scope name to compensate (for compensateScope). */
  targetScope?: string;
  /** forEach counter variable. */
  counterVariable?: string;
  /** forEach start value. */
  startValue?: number;
  /** forEach end value. */
  endValue?: number;
  /** forEach parallel execution. */
  parallel?: boolean;
  /** Timeout in ms. */
  timeoutMs?: number;
  /** Retry policy. */
  retryPolicy?: RetryPolicyConfig;
  /** Custom metadata. */
  metadata: Record<string, any>;
}

/** Copy operation for assign activities. */
export interface AssignCopy {
  /** Source expression or variable path. */
  from: string;
  /** Source type. */
  fromType: 'variable' | 'expression' | 'literal';
  /** Destination variable path. */
  to: string;
}

/** A complete BPEL process definition. */
export interface BPELProcessDefinition {
  /** Unique process ID. */
  id: string;
  /** Process name. */
  name: string;
  /** Process version. */
  version: string;
  /** Description. */
  description?: string;
  /** Partner links. */
  partnerLinks: PartnerLink[];
  /** Variables. */
  variables: BPELVariable[];
  /** Correlation sets. */
  correlationSets: CorrelationSet[];
  /** Activities (keyed by ID). */
  activities: Record<string, BPELActivity>;
  /** Root activity ID. */
  rootActivityId: string;
  /** Process-level fault handlers. */
  faultHandlers: FaultHandler[];
  /** Process-level compensation handler. */
  compensationHandler?: CompensationHandler;
  /** Process-level event handlers. */
  eventHandlers: EventHandler[];
  /** Process timeout in ms. */
  timeoutMs?: number;
  /** Whether the process is enabled. */
  enabled: boolean;
  /** Custom metadata. */
  metadata: Record<string, any>;
}

/** A running BPEL process instance. */
export interface BPELProcessInstance {
  /** Unique instance ID. */
  instanceId: string;
  /** Process definition ID. */
  processId: string;
  /** Process name. */
  processName: string;
  /** Overall status. */
  status: BPELProcessStatus;
  /** Current activity ID. */
  currentActivityId?: string;
  /** Activity statuses. */
  activityStatuses: Record<string, BPELActivityStatus>;
  /** Variable values. */
  variables: Record<string, any>;
  /** Correlation values. */
  correlationValues: Record<string, Record<string, any>>;
  /** ISO-8601 start time. */
  startedAt: string;
  /** ISO-8601 completion time. */
  completedAt?: string;
  /** Initiator. */
  initiatedBy: string;
  /** Fault info if faulted. */
  fault?: { name: string; message: string; data?: any };
  /** Execution log. */
  log: BPELLogEntry[];
  /** Custom metadata. */
  metadata: Record<string, any>;
}

/** A log entry for BPEL process execution. */
export interface BPELLogEntry {
  timestamp: string;
  activityId: string;
  activityName: string;
  activityType: BPELActivityType;
  status: BPELActivityStatus;
  durationMs?: number;
  error?: string;
  details?: Record<string, any>;
}

// ── Human Task Types ────────────────────────────────────────

/** Human task priority levels. */
export type TaskPriority = 'lowest' | 'low' | 'normal' | 'high' | 'highest' | 'urgent';

/** Human task status. */
export type HumanTaskStatus =
  | 'created'
  | 'ready'
  | 'reserved'
  | 'in-progress'
  | 'completed'
  | 'failed'
  | 'suspended'
  | 'exited'
  | 'obsolete'
  | 'error';

/** Task assignment type. */
export type AssignmentType =
  | 'single-user'
  | 'group'
  | 'role'
  | 'rule-based'
  | 'round-robin'
  | 'least-busy';

/** Escalation action type. */
export type EscalationType = 'reassign' | 'notify' | 'escalate-priority' | 'delegate' | 'expire';

/** Task outcome options. */
export interface TaskOutcome {
  /** Outcome name. */
  name: string;
  /** Display label. */
  label: string;
  /** Whether this outcome is considered successful. */
  success: boolean;
  /** Whether outcome requires a comment. */
  requiresComment: boolean;
}

/** Escalation rule definition. */
export interface EscalationRule {
  /** Rule ID. */
  id: string;
  /** Rule name. */
  name: string;
  /** Trigger condition (time-based). */
  triggerAfterMs: number;
  /** Escalation action. */
  action: EscalationType;
  /** Target for reassign/delegate. */
  target?: string;
  /** New priority for escalate-priority. */
  newPriority?: TaskPriority;
  /** Notification template. */
  notificationTemplate?: string;
  /** Whether this rule is enabled. */
  enabled: boolean;
}

/** Human task definition. */
export interface HumanTaskDefinition {
  /** Unique task definition ID. */
  id: string;
  /** Task name. */
  name: string;
  /** Description. */
  description?: string;
  /** Task priority. */
  priority: TaskPriority;
  /** Assignment type. */
  assignmentType: AssignmentType;
  /** Potential owners (users, groups, or roles). */
  potentialOwners: string[];
  /** Business administrators. */
  businessAdministrators: string[];
  /** Possible outcomes. */
  outcomes: TaskOutcome[];
  /** Escalation rules. */
  escalationRules: EscalationRule[];
  /** Due date duration in ms from creation. */
  dueDateMs?: number;
  /** Expiration duration in ms from creation. */
  expirationMs?: number;
  /** Whether the task can be delegated. */
  delegatable: boolean;
  /** Whether the task can be skipped. */
  skippable: boolean;
  /** Form schema for task input. */
  formSchema?: Record<string, any>;
  /** Custom metadata. */
  metadata: Record<string, any>;
}

/** A human task instance. */
export interface HumanTaskInstance {
  /** Unique instance ID. */
  instanceId: string;
  /** Task definition ID. */
  taskDefinitionId: string;
  /** Task name. */
  name: string;
  /** Task status. */
  status: HumanTaskStatus;
  /** Priority. */
  priority: TaskPriority;
  /** Current owner (claimed by). */
  actualOwner?: string;
  /** Potential owners. */
  potentialOwners: string[];
  /** Task input data. */
  input: Record<string, any>;
  /** Task output data. */
  output: Record<string, any>;
  /** Selected outcome. */
  outcome?: string;
  /** Comments on this task. */
  comments: TaskComment[];
  /** Attachments. */
  attachments: TaskAttachment[];
  /** Delegation chain. */
  delegationChain: string[];
  /** ISO-8601 creation time. */
  createdAt: string;
  /** ISO-8601 claimed time. */
  claimedAt?: string;
  /** ISO-8601 completion time. */
  completedAt?: string;
  /** ISO-8601 due date. */
  dueDate?: string;
  /** ISO-8601 expiration date. */
  expirationDate?: string;
  /** Linked BPEL process instance. */
  processInstanceId?: string;
  /** Linked BPEL activity. */
  activityId?: string;
  /** Number of escalations triggered. */
  escalationCount: number;
  /** Custom metadata. */
  metadata: Record<string, any>;
}

/** Comment on a task. */
export interface TaskComment {
  id: string;
  author: string;
  text: string;
  createdAt: string;
}

/** Attachment on a task. */
export interface TaskAttachment {
  id: string;
  name: string;
  mimeType: string;
  content: string;
  addedBy: string;
  addedAt: string;
}

// ── Complex Event Processing Types ──────────────────────────

/** CEP event priority. */
export type CEPEventPriority = 'low' | 'normal' | 'high' | 'critical';

/** A CEP event. */
export interface CEPEvent {
  /** Event ID. */
  id: string;
  /** Event type (e.g. 'order.created'). */
  type: string;
  /** Event source. */
  source: string;
  /** ISO-8601 timestamp. */
  timestamp: string;
  /** Event payload. */
  data: Record<string, any>;
  /** Priority. */
  priority: CEPEventPriority;
  /** Correlation keys. */
  correlationKeys: Record<string, string>;
  /** Custom headers. */
  headers: Record<string, any>;
}

/** Pattern match types for CEP rules. */
export type CEPPatternType =
  | 'simple'
  | 'sequence'
  | 'conjunction'
  | 'disjunction'
  | 'negation'
  | 'repetition'
  | 'temporal'
  | 'threshold'
  | 'trend'
  | 'absence';

/** CEP window types. */
export type WindowType = 'tumbling' | 'sliding' | 'session' | 'count' | 'global';

/** Window configuration. */
export interface WindowConfig {
  /** Window type. */
  type: WindowType;
  /** Window size in ms (for time-based windows). */
  sizeMs?: number;
  /** Window count (for count-based windows). */
  count?: number;
  /** Slide interval in ms (for sliding windows). */
  slideMs?: number;
  /** Session gap in ms (for session windows). */
  sessionGapMs?: number;
}

/** CEP condition for pattern matching. */
export interface CEPCondition {
  /** Field path in event data. */
  field: string;
  /** Comparison operator. */
  operator: 'equals' | 'notEquals' | 'greaterThan' | 'lessThan' | 'contains' | 'matches' | 'in' | 'exists';
  /** Comparison value. */
  value: any;
}

/** Aggregation for CEP. */
export interface CEPAggregation {
  /** Aggregation type. */
  type: 'count' | 'sum' | 'avg' | 'min' | 'max' | 'stddev' | 'percentile';
  /** Field to aggregate. */
  field?: string;
  /** Alias for the result. */
  alias: string;
  /** Percentile value (for percentile type). */
  percentile?: number;
}

/** CEP pattern definition. */
export interface CEPPattern {
  /** Pattern ID. */
  id: string;
  /** Pattern name. */
  name: string;
  /** Pattern type. */
  type: CEPPatternType;
  /** Event types that participate in this pattern. */
  eventTypes: string[];
  /** Conditions to match. */
  conditions: CEPCondition[];
  /** Temporal ordering constraints. */
  ordering?: 'strict' | 'relaxed' | 'none';
  /** Window for pattern detection. */
  window: WindowConfig;
  /** Minimum occurrences (for repetition). */
  minOccurrences?: number;
  /** Maximum occurrences (for repetition). */
  maxOccurrences?: number;
  /** Threshold value (for threshold patterns). */
  threshold?: number;
  /** Trend direction (for trend patterns). */
  trendDirection?: 'increasing' | 'decreasing' | 'stable';
  /** Aggregations to compute. */
  aggregations?: CEPAggregation[];
  /** Group-by fields. */
  groupBy?: string[];
  /** Whether pattern is enabled. */
  enabled: boolean;
  /** Custom metadata. */
  metadata: Record<string, any>;
}

/** Result when a CEP pattern matches. */
export interface CEPPatternMatch {
  /** Match ID. */
  id: string;
  /** Pattern that matched. */
  patternId: string;
  /** Pattern name. */
  patternName: string;
  /** Events that matched. */
  matchedEvents: CEPEvent[];
  /** Computed aggregation values. */
  aggregationValues: Record<string, number>;
  /** ISO-8601 match timestamp. */
  matchedAt: string;
  /** Group key (if groupBy is set). */
  groupKey?: string;
  /** Custom metadata. */
  metadata: Record<string, any>;
}

/** CEP action to take when a pattern matches. */
export interface CEPAction {
  /** Action type. */
  type: 'emit-event' | 'invoke-service' | 'start-process' | 'create-task' | 'notify' | 'log' | 'custom';
  /** Configuration for the action. */
  config: Record<string, any>;
}

/** CEP rule: pattern + actions. */
export interface CEPRule {
  /** Rule ID. */
  id: string;
  /** Rule name. */
  name: string;
  /** Pattern to detect. */
  pattern: CEPPattern;
  /** Actions to execute on match. */
  actions: CEPAction[];
  /** Priority (higher = evaluated first). */
  priority: number;
  /** Whether rule is enabled. */
  enabled: boolean;
}

// ── B2B Gateway Types ───────────────────────────────────────

/** B2B document format. */
export type B2BDocumentFormat =
  | 'edi-x12'
  | 'edifact'
  | 'xml'
  | 'json'
  | 'csv'
  | 'fixed-width'
  | 'hl7'
  | 'swift'
  | 'custom';

/** B2B transport protocol. */
export type B2BTransport =
  | 'as2'
  | 'sftp'
  | 'ftps'
  | 'https'
  | 'email'
  | 'mq'
  | 'api'
  | 'custom';

/** B2B partner status. */
export type PartnerStatus = 'active' | 'inactive' | 'suspended' | 'pending-approval';

/** B2B document exchange direction. */
export type ExchangeDirection = 'inbound' | 'outbound' | 'bidirectional';

/** Trading partner profile. */
export interface TradingPartner {
  /** Partner ID. */
  id: string;
  /** Partner name. */
  name: string;
  /** Partner code (e.g. DUNS, GLN). */
  code: string;
  /** Partner status. */
  status: PartnerStatus;
  /** Contact information. */
  contact: PartnerContact;
  /** Supported document formats. */
  supportedFormats: B2BDocumentFormat[];
  /** Supported transports. */
  supportedTransports: B2BTransport[];
  /** Transport configurations. */
  transportConfigs: TransportConfig[];
  /** Security configuration. */
  securityConfig: PartnerSecurityConfig;
  /** Trading partner agreements. */
  agreements: string[];
  /** ISO-8601 onboarding date. */
  onboardedAt: string;
  /** Custom metadata. */
  metadata: Record<string, any>;
}

/** Partner contact information. */
export interface PartnerContact {
  name: string;
  email: string;
  phone?: string;
  department?: string;
}

/** Transport configuration for a partner. */
export interface TransportConfig {
  /** Transport protocol. */
  transport: B2BTransport;
  /** Connection endpoint. */
  endpoint: string;
  /** Authentication credentials (encrypted reference). */
  credentials?: Record<string, string>;
  /** Transport-specific settings. */
  settings: Record<string, any>;
}

/** Security configuration for a partner. */
export interface PartnerSecurityConfig {
  /** Encryption enabled. */
  encryptionEnabled: boolean;
  /** Signing enabled. */
  signingEnabled: boolean;
  /** Certificate reference. */
  certificateRef?: string;
  /** Encryption algorithm. */
  encryptionAlgorithm?: string;
  /** Signing algorithm. */
  signingAlgorithm?: string;
}

/** Trading partner agreement. */
export interface TradingPartnerAgreement {
  /** Agreement ID. */
  id: string;
  /** Agreement name. */
  name: string;
  /** Partner IDs. */
  partnerIds: string[];
  /** Document type codes covered. */
  documentTypes: string[];
  /** Exchange direction. */
  direction: ExchangeDirection;
  /** Document format for exchange. */
  format: B2BDocumentFormat;
  /** Transport for exchange. */
  transport: B2BTransport;
  /** Validation rules for documents. */
  validationRules: B2BValidationRule[];
  /** Transformation mapping ID (if applicable). */
  transformationId?: string;
  /** Response required within (ms). */
  responseTimeoutMs?: number;
  /** ISO-8601 effective date. */
  effectiveDate: string;
  /** ISO-8601 expiration date. */
  expirationDate?: string;
  /** Whether agreement is active. */
  active: boolean;
  /** Custom metadata. */
  metadata: Record<string, any>;
}

/** B2B document validation rule. */
export interface B2BValidationRule {
  /** Rule ID. */
  id: string;
  /** Rule name. */
  name: string;
  /** Rule type. */
  type: 'schema' | 'field-required' | 'field-format' | 'field-value' | 'custom';
  /** Rule configuration. */
  config: Record<string, any>;
  /** Severity on failure. */
  severity: 'error' | 'warning' | 'info';
}

/** A B2B document exchange record. */
export interface B2BDocumentExchange {
  /** Exchange ID. */
  id: string;
  /** Partner ID. */
  partnerId: string;
  /** Agreement ID. */
  agreementId: string;
  /** Direction. */
  direction: ExchangeDirection;
  /** Document type code. */
  documentType: string;
  /** Document format. */
  format: B2BDocumentFormat;
  /** Document content. */
  content: string;
  /** Exchange status. */
  status: 'received' | 'validated' | 'transformed' | 'delivered' | 'acknowledged' | 'failed' | 'rejected';
  /** Validation errors, if any. */
  validationErrors: string[];
  /** ISO-8601 received/sent time. */
  exchangedAt: string;
  /** ISO-8601 acknowledged time. */
  acknowledgedAt?: string;
  /** Error message if failed. */
  error?: string;
  /** Custom metadata. */
  metadata: Record<string, any>;
}

// ── Policy Manager Types ────────────────────────────────────

/** Policy types. */
export type PolicyType =
  | 'security'
  | 'throttling'
  | 'sla'
  | 'transformation'
  | 'logging'
  | 'caching'
  | 'validation'
  | 'routing'
  | 'custom';

/** Policy enforcement point. */
export type EnforcementPoint = 'inbound' | 'outbound' | 'both';

/** SLA metric types. */
export type SLAMetricType =
  | 'availability'
  | 'response-time'
  | 'throughput'
  | 'error-rate'
  | 'uptime';

/** Policy definition. */
export interface PolicyDefinition {
  /** Policy ID. */
  id: string;
  /** Policy name. */
  name: string;
  /** Policy type. */
  type: PolicyType;
  /** Description. */
  description?: string;
  /** Enforcement point. */
  enforcementPoint: EnforcementPoint;
  /** Priority (higher = evaluated first). */
  priority: number;
  /** Policy rules/conditions. */
  rules: PolicyRule[];
  /** Whether policy is enabled. */
  enabled: boolean;
  /** Bound service IDs. */
  boundServices: string[];
  /** ISO-8601 creation timestamp. */
  createdAt: string;
  /** Custom metadata. */
  metadata: Record<string, any>;
}

/** A single policy rule. */
export interface PolicyRule {
  /** Rule ID. */
  id: string;
  /** Condition expression. */
  condition?: string;
  /** Action to take. */
  action: 'allow' | 'deny' | 'throttle' | 'transform' | 'log' | 'cache' | 'custom';
  /** Action configuration. */
  config: Record<string, any>;
}

/** SLA definition. */
export interface SLADefinition {
  /** SLA ID. */
  id: string;
  /** SLA name. */
  name: string;
  /** Description. */
  description?: string;
  /** SLA metrics and thresholds. */
  metrics: SLAMetric[];
  /** Bound service IDs. */
  boundServices: string[];
  /** Penalty actions when SLA is breached. */
  breachActions: SLABreachAction[];
  /** Whether SLA is enabled. */
  enabled: boolean;
  /** ISO-8601 creation timestamp. */
  createdAt: string;
  /** Custom metadata. */
  metadata: Record<string, any>;
}

/** SLA metric with thresholds. */
export interface SLAMetric {
  /** Metric type. */
  type: SLAMetricType;
  /** Target value (e.g. 99.9 for availability %). */
  target: number;
  /** Warning threshold. */
  warningThreshold: number;
  /** Critical threshold. */
  criticalThreshold: number;
  /** Measurement window in ms. */
  windowMs: number;
}

/** Action to take when SLA is breached. */
export interface SLABreachAction {
  /** Action type. */
  type: 'notify' | 'throttle' | 'degrade' | 'failover' | 'log' | 'custom';
  /** Action configuration. */
  config: Record<string, any>;
}

/** SLA compliance record. */
export interface SLAComplianceRecord {
  /** Record ID. */
  id: string;
  /** SLA ID. */
  slaId: string;
  /** Service ID. */
  serviceId: string;
  /** Measurement period start. */
  periodStart: string;
  /** Measurement period end. */
  periodEnd: string;
  /** Metric values for the period. */
  metricValues: Record<SLAMetricType, number>;
  /** Whether SLA was met. */
  compliant: boolean;
  /** Breaches during the period. */
  breaches: SLABreach[];
}

/** SLA breach record. */
export interface SLABreach {
  /** Metric that was breached. */
  metricType: SLAMetricType;
  /** Actual value. */
  actualValue: number;
  /** Target value. */
  targetValue: number;
  /** Breach timestamp. */
  detectedAt: string;
  /** Breach severity. */
  severity: 'warning' | 'critical';
}

// ── Service Mesh Types ──────────────────────────────────────

/** Service mesh proxy status. */
export type ProxyStatus = 'healthy' | 'degraded' | 'unhealthy' | 'unknown';

/** Traffic routing strategy. */
export type TrafficStrategy =
  | 'round-robin'
  | 'weighted'
  | 'least-connections'
  | 'random'
  | 'consistent-hash'
  | 'failover'
  | 'canary'
  | 'blue-green'
  | 'a-b-testing';

/** Circuit breaker state. */
export type MeshCircuitState = 'closed' | 'open' | 'half-open';

/** Service mesh sidecar configuration. */
export interface SidecarConfig {
  /** Service ID. */
  serviceId: string;
  /** Inbound port. */
  inboundPort: number;
  /** Outbound port. */
  outboundPort: number;
  /** Traffic policy. */
  trafficPolicy: TrafficPolicy;
  /** mTLS enabled. */
  mtlsEnabled: boolean;
  /** Access log enabled. */
  accessLogEnabled: boolean;
  /** Tracing enabled. */
  tracingEnabled: boolean;
  /** Custom metadata. */
  metadata: Record<string, any>;
}

/** Traffic management policy. */
export interface TrafficPolicy {
  /** Routing strategy. */
  strategy: TrafficStrategy;
  /** Retry policy. */
  retryPolicy?: RetryPolicyConfig;
  /** Circuit breaker config. */
  circuitBreaker?: MeshCircuitBreakerConfig;
  /** Rate limit. */
  rateLimit?: MeshRateLimitConfig;
  /** Timeout in ms. */
  timeoutMs?: number;
  /** Load balancer weights. */
  weights?: Record<string, number>;
  /** Canary percentage (0-100). */
  canaryPercentage?: number;
  /** Header-based routing rules. */
  headerRoutes?: HeaderRoute[];
}

/** Circuit breaker configuration for mesh. */
export interface MeshCircuitBreakerConfig {
  /** Failure threshold to open circuit. */
  failureThreshold: number;
  /** Success threshold to close circuit. */
  successThreshold: number;
  /** Reset timeout in ms. */
  resetTimeoutMs: number;
  /** Max concurrent requests. */
  maxConcurrent: number;
}

/** Rate limit configuration for mesh. */
export interface MeshRateLimitConfig {
  /** Max requests per window. */
  maxRequests: number;
  /** Window size in ms. */
  windowMs: number;
  /** Per-client or global. */
  scope: 'global' | 'per-client';
}

/** Header-based routing rule. */
export interface HeaderRoute {
  /** Header name. */
  header: string;
  /** Header value match. */
  value: string;
  /** Match type. */
  matchType: 'exact' | 'prefix' | 'regex';
  /** Target service version. */
  targetVersion: string;
}

/** Service mesh proxy instance. */
export interface MeshProxy {
  /** Proxy ID. */
  id: string;
  /** Service ID. */
  serviceId: string;
  /** Proxy status. */
  status: ProxyStatus;
  /** Configuration. */
  config: SidecarConfig;
  /** Circuit breaker states per upstream. */
  circuitStates: Record<string, MeshCircuitState>;
  /** Active connections count. */
  activeConnections: number;
  /** Total requests handled. */
  totalRequests: number;
  /** Total errors. */
  totalErrors: number;
  /** Average latency in ms. */
  avgLatencyMs: number;
  /** ISO-8601 start time. */
  startedAt: string;
}

// ── API Gateway Types ───────────────────────────────────────

/** API lifecycle status. */
export type APIStatus = 'draft' | 'published' | 'deprecated' | 'retired';

/** API authentication type. */
export type APIAuthType = 'none' | 'api-key' | 'oauth2' | 'jwt' | 'basic' | 'mtls' | 'custom';

/** API version strategy. */
export type VersionStrategy = 'url-path' | 'header' | 'query-param' | 'content-type';

/** API definition. */
export interface APIDefinition {
  /** API ID. */
  id: string;
  /** API name. */
  name: string;
  /** API version. */
  version: string;
  /** Description. */
  description?: string;
  /** Base path. */
  basePath: string;
  /** API status. */
  status: APIStatus;
  /** Authentication type. */
  authType: APIAuthType;
  /** Routes/endpoints. */
  routes: APIRoute[];
  /** Rate limiting configuration. */
  rateLimit?: APIRateLimitConfig;
  /** CORS configuration. */
  cors?: CORSConfig;
  /** Caching configuration. */
  caching?: APICacheConfig;
  /** Transformation configuration. */
  transformations?: APITransformation[];
  /** Backend service ID in registry. */
  backendServiceId?: string;
  /** Version strategy. */
  versionStrategy: VersionStrategy;
  /** Tags. */
  tags: string[];
  /** Owner. */
  owner: string;
  /** ISO-8601 creation timestamp. */
  createdAt: string;
  /** ISO-8601 publish timestamp. */
  publishedAt?: string;
  /** Custom metadata. */
  metadata: Record<string, any>;
}

/** API route definition. */
export interface APIRoute {
  /** Route ID. */
  id: string;
  /** HTTP method. */
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';
  /** Path pattern. */
  path: string;
  /** Description. */
  description?: string;
  /** Backend target path. */
  backendPath?: string;
  /** Request validation schema. */
  requestSchema?: Record<string, any>;
  /** Response validation schema. */
  responseSchema?: Record<string, any>;
  /** Route-specific rate limit. */
  rateLimit?: APIRateLimitConfig;
  /** Route-specific auth override. */
  authType?: APIAuthType;
  /** Whether route requires auth. */
  requiresAuth: boolean;
  /** Required scopes/permissions. */
  requiredScopes?: string[];
  /** Timeout in ms. */
  timeoutMs?: number;
  /** Whether route is enabled. */
  enabled: boolean;
}

/** API rate limit configuration. */
export interface APIRateLimitConfig {
  /** Max requests per window. */
  maxRequests: number;
  /** Window size in ms. */
  windowMs: number;
  /** Rate limit scope. */
  scope: 'global' | 'per-api-key' | 'per-ip' | 'per-user';
  /** Burst allowance. */
  burstSize?: number;
  /** Strategy when limit exceeded. */
  onExceeded: 'reject' | 'queue' | 'throttle';
}

/** CORS configuration. */
export interface CORSConfig {
  /** Allowed origins. */
  allowedOrigins: string[];
  /** Allowed methods. */
  allowedMethods: string[];
  /** Allowed headers. */
  allowedHeaders: string[];
  /** Exposed headers. */
  exposedHeaders: string[];
  /** Allow credentials. */
  allowCredentials: boolean;
  /** Max age in seconds. */
  maxAgeSec: number;
}

/** API cache configuration. */
export interface APICacheConfig {
  /** Whether caching is enabled. */
  enabled: boolean;
  /** Default TTL in ms. */
  defaultTtlMs: number;
  /** Cache key strategy. */
  keyStrategy: 'path' | 'path-and-query' | 'path-and-headers' | 'custom';
  /** Custom cache key headers. */
  varyHeaders?: string[];
  /** Max cached entries. */
  maxEntries: number;
}

/** API transformation configuration. */
export interface APITransformation {
  /** Transformation direction. */
  direction: 'request' | 'response';
  /** Transformation type. */
  type: 'header-add' | 'header-remove' | 'header-rename' | 'body-transform' | 'url-rewrite';
  /** Transformation configuration. */
  config: Record<string, any>;
}

/** API key registration. */
export interface APIKey {
  /** Key ID. */
  id: string;
  /** Key value (hashed). */
  keyHash: string;
  /** Key name/label. */
  name: string;
  /** Associated API IDs. */
  apiIds: string[];
  /** Owner. */
  owner: string;
  /** Custom rate limit override. */
  rateLimitOverride?: APIRateLimitConfig;
  /** Scopes/permissions. */
  scopes: string[];
  /** Whether key is active. */
  active: boolean;
  /** ISO-8601 creation timestamp. */
  createdAt: string;
  /** ISO-8601 expiration timestamp. */
  expiresAt?: string;
  /** Usage statistics. */
  usageCount: number;
  /** Last used timestamp. */
  lastUsedAt?: string;
}

/** API usage analytics. */
export interface APIUsageRecord {
  /** API ID. */
  apiId: string;
  /** Route ID. */
  routeId: string;
  /** API key ID (if authenticated). */
  apiKeyId?: string;
  /** HTTP method. */
  method: string;
  /** Path. */
  path: string;
  /** Response status code. */
  statusCode: number;
  /** Response time in ms. */
  responseTimeMs: number;
  /** Request size in bytes. */
  requestSizeBytes: number;
  /** Response size in bytes. */
  responseSizeBytes: number;
  /** ISO-8601 timestamp. */
  timestamp: string;
}

// ── Compensation Types ──────────────────────────────────────

/** Compensation scope status. */
export type CompensationScopeStatus =
  | 'active'
  | 'completed'
  | 'compensating'
  | 'compensated'
  | 'failed';

/** A compensation action. */
export interface CompensationAction {
  /** Action ID. */
  id: string;
  /** Action name. */
  name: string;
  /** Scope name this action belongs to. */
  scopeName: string;
  /** Original action that this compensates. */
  originalActionId: string;
  /** Compensation handler function name. */
  handlerName: string;
  /** Data needed for compensation. */
  compensationData: Record<string, any>;
  /** Status. */
  status: 'pending' | 'executing' | 'completed' | 'failed';
  /** Retry count. */
  retryCount: number;
  /** Max retries. */
  maxRetries: number;
  /** Registered at. */
  registeredAt: string;
  /** Executed at. */
  executedAt?: string;
}

/** A compensation scope (nested scopes supported). */
export interface CompensationScope {
  /** Scope name. */
  name: string;
  /** Parent scope name (null for root). */
  parentScope?: string;
  /** Scope status. */
  status: CompensationScopeStatus;
  /** Registered compensation actions (LIFO order). */
  actions: CompensationAction[];
  /** Child scope names. */
  childScopes: string[];
}

/** Compensation transaction. */
export interface CompensationTransaction {
  /** Transaction ID. */
  id: string;
  /** Process instance ID. */
  processInstanceId: string;
  /** Root scope. */
  rootScope: string;
  /** All scopes. */
  scopes: Record<string, CompensationScope>;
  /** Status. */
  status: 'active' | 'compensating' | 'compensated' | 'failed';
  /** ISO-8601 start time. */
  startedAt: string;
  /** ISO-8601 completion time. */
  completedAt?: string;
  /** Compensation log. */
  log: CompensationLogEntry[];
}

/** Compensation log entry. */
export interface CompensationLogEntry {
  timestamp: string;
  scopeName: string;
  actionId: string;
  actionName: string;
  type: 'register' | 'execute' | 'complete' | 'fail' | 'retry';
  error?: string;
  durationMs?: number;
}

// ── Business Activity Monitoring Types ──────────────────────

/** BAM dashboard metric type. */
export type BAMMetricType = 'counter' | 'gauge' | 'histogram' | 'timer' | 'rate';

/** BAM alert severity. */
export type BAMAlertSeverity = 'info' | 'warning' | 'critical';

/** BAM KPI definition. */
export interface KPIDefinition {
  /** KPI ID. */
  id: string;
  /** KPI name. */
  name: string;
  /** Description. */
  description?: string;
  /** Metric type. */
  metricType: BAMMetricType;
  /** Target value. */
  target?: number;
  /** Warning threshold. */
  warningThreshold?: number;
  /** Critical threshold. */
  criticalThreshold?: number;
  /** Measurement unit. */
  unit: string;
  /** Aggregation window in ms. */
  windowMs: number;
  /** Tags. */
  tags: string[];
  /** Whether KPI is enabled. */
  enabled: boolean;
}

/** BAM KPI value. */
export interface KPIValue {
  /** KPI ID. */
  kpiId: string;
  /** Current value. */
  value: number;
  /** Previous value. */
  previousValue?: number;
  /** Trend direction. */
  trend: 'up' | 'down' | 'stable';
  /** Whether within target. */
  onTarget: boolean;
  /** ISO-8601 timestamp. */
  timestamp: string;
}

/** BAM dashboard definition. */
export interface BAMDashboard {
  /** Dashboard ID. */
  id: string;
  /** Dashboard name. */
  name: string;
  /** KPI IDs to display. */
  kpiIds: string[];
  /** Owner. */
  owner: string;
  /** Whether dashboard is shared. */
  shared: boolean;
  /** ISO-8601 creation timestamp. */
  createdAt: string;
}

/** BAM alert rule. */
export interface BAMAlertRule {
  /** Alert rule ID. */
  id: string;
  /** Rule name. */
  name: string;
  /** KPI ID to monitor. */
  kpiId: string;
  /** Condition. */
  condition: 'above' | 'below' | 'equals' | 'deviation';
  /** Threshold value. */
  threshold: number;
  /** Severity. */
  severity: BAMAlertSeverity;
  /** Cool-down period in ms before re-firing. */
  cooldownMs: number;
  /** Whether rule is enabled. */
  enabled: boolean;
}

/** BAM alert instance. */
export interface BAMAlertInstance {
  /** Alert ID. */
  id: string;
  /** Rule ID. */
  ruleId: string;
  /** Rule name. */
  ruleName: string;
  /** KPI ID. */
  kpiId: string;
  /** Severity. */
  severity: BAMAlertSeverity;
  /** Actual value. */
  actualValue: number;
  /** Threshold value. */
  thresholdValue: number;
  /** Status. */
  status: 'active' | 'acknowledged' | 'resolved';
  /** ISO-8601 fired timestamp. */
  firedAt: string;
  /** ISO-8601 resolved timestamp. */
  resolvedAt?: string;
  /** Message. */
  message: string;
}

// ── Monitoring Types ────────────────────────────────────────

/** Metric collector type. */
export type SOAMetricType = 'counter' | 'gauge' | 'histogram' | 'summary';

/** Alert severity for SOA monitoring. */
export type SOAAlertSeverity = 'info' | 'warning' | 'critical';

/** Alert status. */
export type SOAAlertStatus = 'active' | 'acknowledged' | 'resolved';

/** SOA alert rule. */
export interface SOAAlertRuleDefinition {
  /** Rule ID. */
  id: string;
  /** Rule name. */
  name: string;
  /** Metric name to monitor. */
  metricName: string;
  /** Condition. */
  condition: 'above' | 'below' | 'equals';
  /** Threshold. */
  threshold: number;
  /** Severity. */
  severity: SOAAlertSeverity;
  /** Cool-down period in ms. */
  cooldownMs: number;
  /** Whether rule is enabled. */
  enabled: boolean;
}

/** SOA alert instance. */
export interface SOAAlertInstance {
  /** Alert ID. */
  id: string;
  /** Rule ID. */
  ruleId: string;
  /** Rule name. */
  ruleName: string;
  /** Severity. */
  severity: SOAAlertSeverity;
  /** Status. */
  status: SOAAlertStatus;
  /** Actual value. */
  actualValue: number;
  /** Threshold. */
  threshold: number;
  /** ISO-8601 fired timestamp. */
  firedAt: string;
  /** ISO-8601 resolved timestamp. */
  resolvedAt?: string;
  /** Message. */
  message: string;
}

// ── Security Types ──────────────────────────────────────────

/** SOA access action. */
export type SOAAction =
  | 'service:register'
  | 'service:invoke'
  | 'service:manage'
  | 'process:deploy'
  | 'process:start'
  | 'process:manage'
  | 'task:create'
  | 'task:claim'
  | 'task:complete'
  | 'task:delegate'
  | 'b2b:send'
  | 'b2b:receive'
  | 'api:publish'
  | 'api:invoke'
  | 'policy:manage'
  | 'admin:*';

/** SOA access policy. */
export interface SOAAccessPolicy {
  /** Policy ID. */
  id: string;
  /** Policy name. */
  name: string;
  /** Roles that this policy applies to. */
  roles: string[];
  /** Actions allowed. */
  allowedActions: SOAAction[];
  /** Resource patterns (regex). */
  resourcePatterns: string[];
  /** Whether policy is enabled. */
  enabled: boolean;
}

/** SOA masking strategy. */
export type SOAMaskingStrategy =
  | 'full'
  | 'partial'
  | 'hash'
  | 'redact'
  | 'substitute'
  | 'tokenize';

/** SOA masking rule. */
export interface SOAMaskingRule {
  /** Rule ID. */
  id: string;
  /** Field pattern to mask. */
  fieldPattern: string;
  /** Masking strategy. */
  strategy: SOAMaskingStrategy;
  /** Strategy parameters. */
  parameters: Record<string, any>;
  /** Whether rule is enabled. */
  enabled: boolean;
}

/** SOA audit entry. */
export interface SOAAuditEntry {
  /** Entry ID. */
  id: string;
  /** Action performed. */
  action: string;
  /** Actor who performed the action. */
  actor: string;
  /** Resource affected. */
  resource?: string;
  /** Resource type. */
  resourceType?: string;
  /** Additional details. */
  details: Record<string, any>;
  /** Whether the action succeeded. */
  success: boolean;
  /** ISO-8601 timestamp. */
  timestamp: string;
}

// ── Retry Policy ────────────────────────────────────────────

/** Retry policy configuration (shared across subsystems). */
export interface RetryPolicyConfig {
  /** Max retry attempts. */
  maxAttempts: number;
  /** Initial delay in ms. */
  initialDelayMs: number;
  /** Max delay in ms. */
  maxDelayMs: number;
  /** Backoff multiplier. */
  backoffMultiplier: number;
  /** Whether to add jitter. */
  jitter?: boolean;
}

// ── SOA Metrics ─────────────────────────────────────────────

/** Aggregated SOA metrics. */
export interface SOAMetrics {
  // Registry
  totalServices: number;
  activeServices: number;
  totalContracts: number;
  totalEndpoints: number;

  // BPEL
  totalProcessDefinitions: number;
  activeProcessInstances: number;
  completedProcessInstances: number;
  faultedProcessInstances: number;

  // Human tasks
  totalTaskDefinitions: number;
  pendingTasks: number;
  inProgressTasks: number;
  completedTasks: number;
  overdueTasks: number;

  // CEP
  totalCEPRules: number;
  activeCEPRules: number;
  eventsProcessed: number;
  patternsMatched: number;

  // B2B
  totalPartners: number;
  activePartners: number;
  totalAgreements: number;
  documentsExchanged: number;

  // Policy
  totalPolicies: number;
  activePolicies: number;
  totalSLAs: number;
  slaBreaches: number;

  // Mesh
  totalProxies: number;
  healthyProxies: number;

  // API Gateway
  totalAPIs: number;
  publishedAPIs: number;
  totalAPIKeys: number;
  apiRequestsTotal: number;

  // Compensation
  activeCompensations: number;
  completedCompensations: number;
  failedCompensations: number;

  // BAM
  totalKPIs: number;
  activeAlerts: number;

  // General
  uptimeMs: number;
  timestamp: string;
}

// ── Event Types ─────────────────────────────────────────────

/** SOA module event types. */
export type SOAEventType =
  // Lifecycle
  | 'soa:started'
  | 'soa:stopped'
  // Registry
  | 'service:registered'
  | 'service:deregistered'
  | 'service:updated'
  | 'service:health-changed'
  // BPEL
  | 'process:deployed'
  | 'process:started'
  | 'process:completed'
  | 'process:faulted'
  | 'process:terminated'
  | 'process:suspended'
  | 'process:compensating'
  | 'process:compensated'
  | 'activity:started'
  | 'activity:completed'
  | 'activity:faulted'
  // Human tasks
  | 'task:created'
  | 'task:claimed'
  | 'task:completed'
  | 'task:delegated'
  | 'task:escalated'
  | 'task:expired'
  // CEP
  | 'cep:pattern-matched'
  | 'cep:event-processed'
  // B2B
  | 'b2b:document-sent'
  | 'b2b:document-received'
  | 'b2b:document-validated'
  | 'b2b:document-failed'
  // Policy
  | 'policy:enforced'
  | 'policy:violated'
  | 'sla:breached'
  | 'sla:compliant'
  // Mesh
  | 'mesh:circuit-opened'
  | 'mesh:circuit-closed'
  | 'mesh:rate-limited'
  // API
  | 'api:published'
  | 'api:deprecated'
  | 'api:key-created'
  | 'api:request-processed'
  // Compensation
  | 'compensation:started'
  | 'compensation:completed'
  | 'compensation:failed'
  // BAM
  | 'bam:alert-fired'
  | 'bam:alert-resolved'
  | 'bam:kpi-updated';

/** An event emitted by the SOA module. */
export interface SOAEvent {
  type: SOAEventType;
  timestamp: string;
  source: string;
  data?: Record<string, any>;
  serviceId?: string;
  processInstanceId?: string;
  error?: string;
}

/** Event listener function. */
export type SOAEventListener = (event: SOAEvent) => void;

// ── Configuration ───────────────────────────────────────────

/** Full SOA Suite configuration. */
export interface SOAConfig {
  /** Module instance name. */
  name: string;
  /** Enable audit logging. */
  auditEnabled?: boolean;
  /** Initial service registrations. */
  services?: ServiceRegistration[];
  /** Initial BPEL process definitions. */
  processes?: BPELProcessDefinition[];
  /** Initial human task definitions. */
  taskDefinitions?: HumanTaskDefinition[];
  /** Initial CEP rules. */
  cepRules?: CEPRule[];
  /** Initial trading partners. */
  partners?: TradingPartner[];
  /** Initial trading partner agreements. */
  agreements?: TradingPartnerAgreement[];
  /** Initial policies. */
  policies?: PolicyDefinition[];
  /** Initial SLA definitions. */
  slaDefinitions?: SLADefinition[];
  /** Initial API definitions. */
  apis?: APIDefinition[];
  /** Initial BAM KPIs. */
  kpis?: KPIDefinition[];
  /** Alert rules. */
  alertRules?: SOAAlertRuleDefinition[];
  /** BAM alert rules. */
  bamAlertRules?: BAMAlertRule[];
  /** Access policies. */
  accessPolicies?: SOAAccessPolicy[];
  /** Masking rules. */
  maskingRules?: SOAMaskingRule[];
  /** Custom metadata. */
  metadata?: Record<string, any>;
}
