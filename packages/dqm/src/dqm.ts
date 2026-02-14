// ============================================================
// SOA One DQM — DataQualityMessaging (Main Orchestrator)
// ============================================================
//
// The DataQualityMessaging class is the central orchestrator
// that ties together all Data Quality & Messaging subsystems:
// profiling, quality rules, cleansing, scoring, record matching,
// enterprise messaging, monitoring, and security.
//
// Provides a unified API for:
// - Statistical data profiling with column/dataset analysis
// - 20+ quality rule types with batch validation
// - Data cleansing and standardization (29 cleansing types)
// - Multi-dimensional quality scoring (8 dimensions)
// - Probabilistic record matching & deduplication (12 algorithms)
// - Enterprise messaging: topics, queues, pub/sub, DLQ
// - Monitoring, metrics, and alerting
// - Security: masking, access control, audit logging
//
// Surpasses Oracle Enterprise Data Quality and Oracle Enterprise
// Messaging Service. 100% compatible with @soa-one/engine SDK
// via the DQM plugin.
// ============================================================

import type {
  DQMConfig,
  DQMMetrics,
  DQMEvent,
  DQMEventType,
  DQMEventListener,
  QualityRuleDefinition,
  CleansingRuleDefinition,
  MatchRuleDefinition,
  TopicConfig,
  QueueConfig,
  DQMAlertRuleDefinition,
  DQMAccessPolicy,
  DQMMaskingRule,
  DimensionWeight,
} from './types';

import { DataProfiler } from './profiler';
import { QualityRuleEngine } from './rules';
import { DataCleansingEngine } from './cleansing';
import { QualityScoringEngine } from './scoring';
import { RecordMatchingEngine } from './matching';
import { MessagingService } from './messaging';
import { DQMMonitoringManager } from './monitoring';
import { DQMSecurityManager } from './security';

// ── DataQualityMessaging ────────────────────────────────────

/**
 * Central Data Quality & Messaging orchestrator.
 *
 * Usage:
 * ```ts
 * const dqm = new DataQualityMessaging({
 *   name: 'enterprise-dqm',
 *   auditEnabled: true,
 *   qualityRules: [...],
 *   topics: [{ name: 'quality.events', type: 'standard' }],
 * });
 *
 * await dqm.init();
 *
 * // Profile a dataset
 * const profile = dqm.profiler.profileDataset('customers', rows);
 *
 * // Validate data quality
 * const validation = dqm.rules.evaluateAll(rows);
 *
 * // Calculate quality score
 * const score = dqm.scoring.calculateScore(validation.results);
 *
 * // Cleanse data
 * const { rows: cleanRows } = dqm.cleansing.cleanseDataset(rows);
 *
 * // Find duplicates
 * const dedup = dqm.matching.deduplicate(rows, 'customer-match');
 *
 * // Publish quality event
 * dqm.messaging.publish('quality.events', { score: score.overall });
 *
 * // Integrate with rule engine
 * import { RuleEngine } from '@soa-one/engine';
 * import { createDQMPlugin } from '@soa-one/dqm';
 *
 * const engine = new RuleEngine({
 *   plugins: [createDQMPlugin(dqm)],
 * });
 *
 * await dqm.shutdown();
 * ```
 */
export class DataQualityMessaging {
  readonly name: string;
  private readonly _config: DQMConfig;

  // Subsystems
  private readonly _profiler: DataProfiler;
  private readonly _rules: QualityRuleEngine;
  private readonly _cleansing: DataCleansingEngine;
  private readonly _scoring: QualityScoringEngine;
  private readonly _matching: RecordMatchingEngine;
  private readonly _messaging: MessagingService;
  private readonly _monitoring: DQMMonitoringManager;
  private readonly _security: DQMSecurityManager;

  // Event listeners
  private _eventListeners: Map<string, DQMEventListener[]> = new Map();

  // State
  private _initialized = false;
  private _destroyed = false;
  private _startTime = Date.now();

  constructor(config: DQMConfig) {
    this.name = config.name;
    this._config = config;

    // Initialize subsystems
    this._profiler = new DataProfiler();
    this._rules = new QualityRuleEngine();
    this._cleansing = new DataCleansingEngine();
    this._scoring = new QualityScoringEngine(
      config.dimensionWeights,
      config.scoreHistoryMax,
    );
    this._matching = new RecordMatchingEngine();
    this._messaging = new MessagingService();
    this._monitoring = new DQMMonitoringManager();
    this._security = new DQMSecurityManager();

    // Register configured quality rules
    for (const rule of config.qualityRules ?? []) {
      this._rules.registerRule(rule);
    }

    // Register configured cleansing rules
    for (const rule of config.cleansingRules ?? []) {
      this._cleansing.registerRule(rule);
    }

    // Register configured match rules
    for (const rule of config.matchRules ?? []) {
      this._matching.registerRule(rule);
    }

    // Create configured topics
    for (const topicConfig of config.topics ?? []) {
      this._messaging.createTopic(topicConfig);
    }

    // Create configured queues
    for (const queueConfig of config.queues ?? []) {
      this._messaging.createQueue(queueConfig);
    }

    // Register configured alert rules
    for (const rule of config.alertRules ?? []) {
      this._monitoring.alerts.registerRule(rule);
    }

    // Register configured access policies
    for (const policy of config.accessPolicies ?? []) {
      this._security.accessControl.registerPolicy(policy);
    }

    // Register configured masking rules
    for (const rule of config.maskingRules ?? []) {
      this._security.masker.registerRule(rule);
    }

    // Wire up alerting callbacks
    this._monitoring.alerts.onAlert((alert) => {
      this._emitEvent('alert:fired', 'AlertEngine', {
        alertId: alert.id,
        ruleName: alert.ruleName,
        severity: alert.severity,
      });
    });

    this._monitoring.alerts.onResolved((alert) => {
      this._emitEvent('alert:resolved', 'AlertEngine', {
        alertId: alert.id,
        ruleName: alert.ruleName,
      });
    });
  }

  // ── Lifecycle ───────────────────────────────────────────

  /** Initialize the DataQualityMessaging module. */
  async init(): Promise<void> {
    if (this._initialized) return;
    if (this._destroyed) {
      throw new Error('Cannot init a destroyed DataQualityMessaging. Create a new instance.');
    }

    this._initialized = true;
    this._startTime = Date.now();

    // Audit
    if (this._config.auditEnabled !== false) {
      this._security.recordAudit({
        action: 'dqm.started',
        actor: 'system',
        resource: this.name,
        resourceType: 'DataQualityMessaging',
        details: {
          qualityRules: this._rules.ruleCount,
          cleansingRules: this._cleansing.ruleCount,
          matchRules: this._matching.ruleCount,
          topics: this._messaging.topicCount,
          queues: this._messaging.queueCount,
        },
        success: true,
      });
    }

    this._emitEvent('dqm:started', 'DataQualityMessaging');
  }

  /** Shut down the DataQualityMessaging module. */
  async shutdown(): Promise<void> {
    if (this._destroyed) return;

    // Shut down messaging
    this._messaging.shutdown();

    // Shut down monitoring
    this._monitoring.shutdown();

    // Audit
    if (this._config.auditEnabled !== false) {
      this._security.recordAudit({
        action: 'dqm.stopped',
        actor: 'system',
        resource: this.name,
        resourceType: 'DataQualityMessaging',
        success: true,
      });
    }

    this._emitEvent('dqm:stopped', 'DataQualityMessaging');

    this._initialized = false;
    this._destroyed = true;
  }

  /** Whether the module is initialized. */
  get isInitialized(): boolean {
    return this._initialized;
  }

  /** Whether the module has been shut down. */
  get isDestroyed(): boolean {
    return this._destroyed;
  }

  // ── Subsystem Access ──────────────────────────────────────

  /** Access the data profiler. */
  get profiler(): DataProfiler {
    return this._profiler;
  }

  /** Access the quality rule engine. */
  get rules(): QualityRuleEngine {
    return this._rules;
  }

  /** Access the data cleansing engine. */
  get cleansing(): DataCleansingEngine {
    return this._cleansing;
  }

  /** Access the quality scoring engine. */
  get scoring(): QualityScoringEngine {
    return this._scoring;
  }

  /** Access the record matching engine. */
  get matching(): RecordMatchingEngine {
    return this._matching;
  }

  /** Access the messaging service. */
  get messaging(): MessagingService {
    return this._messaging;
  }

  /** Access the monitoring manager. */
  get monitoring(): DQMMonitoringManager {
    return this._monitoring;
  }

  /** Access the security manager. */
  get security(): DQMSecurityManager {
    return this._security;
  }

  // ── Metrics ─────────────────────────────────────────────

  /** Get a snapshot of DQM metrics. */
  getMetrics(): DQMMetrics {
    const messagingStats = this._messaging.getStats();
    const totalPublished = messagingStats.topics.reduce((s, t) => s + t.totalPublished, 0);
    const totalDelivered = messagingStats.topics.reduce((s, t) => s + t.totalDelivered, 0);
    const totalDeadLettered = messagingStats.topics.reduce(
      (s, t) => s + t.totalDeadLettered,
      0,
    ) + messagingStats.queues.reduce((s, q) => s + q.totalDeadLettered, 0);

    return {
      totalQualityRules: this._rules.ruleCount,
      activeQualityRules: this._rules.enabledRuleCount,
      totalCleansingRules: this._cleansing.ruleCount,
      totalMatchRules: this._matching.ruleCount,
      totalTopics: this._messaging.topicCount,
      activeTopics: this._messaging.topicCount,
      totalQueues: this._messaging.queueCount,
      activeQueues: this._messaging.queueCount,
      totalSubscriptions: messagingStats.topics.reduce(
        (s, t) => s + t.activeSubscriptions,
        0,
      ),
      messagesPublished: totalPublished,
      messagesDelivered: totalDelivered,
      messagesDeadLettered: totalDeadLettered,
      profilesExecuted: this._monitoring.metrics.getCounter('profiles.executed'),
      validationsExecuted: this._monitoring.metrics.getCounter('validations.executed'),
      cleansingOperationsExecuted: this._monitoring.metrics.getCounter(
        'cleansing.executed',
      ),
      matchOperationsExecuted: this._monitoring.metrics.getCounter('matching.executed'),
      currentQualityScore: this._scoring.lastScore?.overall ?? 0,
      currentQualityGrade: this._scoring.lastScore?.grade ?? 'N/A',
      activeAlerts: this._monitoring.alerts.activeCount,
      uptimeMs: Date.now() - this._startTime,
      timestamp: new Date().toISOString(),
    };
  }

  // ── Events ──────────────────────────────────────────────

  /** Subscribe to DQM events. */
  on(eventType: DQMEventType, listener: DQMEventListener): void {
    if (!this._eventListeners.has(eventType)) {
      this._eventListeners.set(eventType, []);
    }
    this._eventListeners.get(eventType)!.push(listener);
  }

  /** Unsubscribe from DQM events. */
  off(eventType: DQMEventType, listener: DQMEventListener): void {
    const listeners = this._eventListeners.get(eventType);
    if (listeners) {
      const idx = listeners.indexOf(listener);
      if (idx >= 0) listeners.splice(idx, 1);
    }
  }

  // ── Private ─────────────────────────────────────────────

  private _emitEvent(
    type: DQMEventType,
    source: string,
    data?: Record<string, any>,
  ): void {
    const event: DQMEvent = {
      type,
      timestamp: new Date().toISOString(),
      source,
      data,
    };

    const listeners = this._eventListeners.get(type);
    if (listeners) {
      for (const listener of listeners) {
        try {
          listener(event);
        } catch {
          // Swallow listener errors
        }
      }
    }
  }
}
