// ============================================================
// SOA One DI — DataIntegrator (Main Orchestrator)
// ============================================================
//
// The DataIntegrator is the central orchestrator that ties
// together all Data Integration subsystems: connectors,
// pipelines, CDC, replication, transformations, data quality,
// lineage, scheduling, mapping, catalog, monitoring, and
// security.
//
// Provides a unified API for:
// - Connector management (JDBC, files, APIs, cloud, streaming)
// - ETL/ELT pipeline execution
// - Change Data Capture
// - Real-time data replication
// - Data transformation
// - Data quality profiling and validation
// - Data lineage tracking and impact analysis
// - Job scheduling and orchestration
// - Data mapping
// - Data catalog and governance
// - Monitoring, metrics, and alerting
// - Security: masking, access control, audit
//
// Surpasses Oracle Data Integrator and Oracle GoldenGate.
// 100% compatible with @soa-one/engine SDK via the DI plugin.
// ============================================================

import type {
  DIConfig,
  DIMetrics,
  DIEvent,
  DIEventType,
  DIEventListener,
  PipelineDefinition,
  CDCConfig,
  ReplicationConfig,
  ScheduleDefinition,
  QualityRuleDefinition,
  MaskingRule,
  AlertRuleDefinition,
  DIAccessPolicy,
  ConnectorConfig,
} from './types';

import { ConnectorManager } from './connector';
import { PipelineEngine } from './pipeline';
import { CDCEngine } from './cdc';
import { ReplicationManager } from './replication';
import { TransformationEngine } from './transform';
import { DataQualityManager } from './quality';
import { LineageTracker } from './lineage';
import { JobScheduler } from './scheduler';
import { MappingManager } from './mapping';
import { DataCatalog } from './catalog';
import { MonitoringManager } from './monitoring';
import { SecurityManager } from './security';

// ── DataIntegrator ──────────────────────────────────────────

/**
 * Central Data Integration orchestrator.
 *
 * Usage:
 * ```ts
 * const di = new DataIntegrator({
 *   name: 'enterprise-di',
 *   connectors: [
 *     { id: 'oracle-prod', name: 'Oracle Production', type: 'jdbc', dialect: 'oracle', host: 'db.example.com' },
 *     { id: 'postgres-dw', name: 'Postgres DW', type: 'jdbc', dialect: 'postgresql', host: 'dw.example.com' },
 *   ],
 *   auditEnabled: true,
 * });
 *
 * await di.init();
 *
 * // Register a pipeline
 * di.pipelines.registerPipeline(myPipeline);
 *
 * // Set up CDC
 * const cdcStream = di.cdc.createStream(mycdcConfig);
 * cdcStream.onChangeEvent(async (event) => {
 *   await di.replication.getStream('orders-repl')?.receiveEvent(event);
 * });
 *
 * // Execute pipeline
 * const result = await di.pipelines.execute('my-pipeline', { date: '2024-01-01' });
 *
 * // Integrate with rule engine
 * import { RuleEngine } from '@soa-one/engine';
 * import { createDIPlugin } from '@soa-one/di';
 *
 * const engine = new RuleEngine({
 *   plugins: [createDIPlugin(di)],
 * });
 *
 * await di.shutdown();
 * ```
 */
export class DataIntegrator {
  readonly name: string;
  private readonly _config: DIConfig;

  // Subsystems
  private readonly _connectors: ConnectorManager;
  private readonly _pipelines: PipelineEngine;
  private readonly _cdc: CDCEngine;
  private readonly _replication: ReplicationManager;
  private readonly _transform: TransformationEngine;
  private readonly _quality: DataQualityManager;
  private readonly _lineage: LineageTracker;
  private readonly _scheduler: JobScheduler;
  private readonly _mappings: MappingManager;
  private readonly _catalog: DataCatalog;
  private readonly _monitoring: MonitoringManager;
  private readonly _security: SecurityManager;

  // Event listeners
  private _eventListeners: Map<string, DIEventListener[]> = new Map();

  // State
  private _initialized = false;
  private _destroyed = false;
  private _startTime = Date.now();

  constructor(config: DIConfig) {
    this.name = config.name;
    this._config = config;

    // Initialize subsystems
    this._connectors = new ConnectorManager();
    this._pipelines = new PipelineEngine();
    this._cdc = new CDCEngine();
    this._replication = new ReplicationManager();
    this._transform = new TransformationEngine();
    this._quality = new DataQualityManager();
    this._lineage = new LineageTracker();
    this._scheduler = new JobScheduler();
    this._mappings = new MappingManager();
    this._catalog = new DataCatalog();
    this._monitoring = new MonitoringManager();
    this._security = new SecurityManager();

    // Register configured connectors
    for (const connConfig of config.connectors ?? []) {
      this._connectors.register(connConfig);
    }

    // Register configured pipelines
    for (const pipeline of config.pipelines ?? []) {
      this._pipelines.registerPipeline(pipeline);
    }

    // Create configured CDC streams
    for (const cdcConfig of config.cdcConfigs ?? []) {
      this._cdc.createStream(cdcConfig);
    }

    // Create configured replication streams
    for (const replConfig of config.replicationConfigs ?? []) {
      this._replication.createStream(replConfig);
    }

    // Register configured schedules
    for (const schedule of config.schedules ?? []) {
      this._scheduler.registerSchedule(schedule);
    }

    // Register configured quality rules
    for (const rule of config.qualityRules ?? []) {
      this._quality.registerRule(rule);
    }

    // Register configured masking rules
    for (const rule of config.maskingRules ?? []) {
      this._security.masker.registerRule(rule);
    }

    // Register configured alert rules
    for (const rule of config.alertRules ?? []) {
      this._monitoring.alerts.registerRule(rule);
    }

    // Register configured access policies
    for (const policy of config.accessPolicies ?? []) {
      this._security.accessControl.registerPolicy(policy);
    }

    // Wire up pipeline lifecycle events
    this._pipelines.onComplete((instance) => {
      this._monitoring.metrics.incrementCounter('pipeline.completed');
      this._monitoring.health.recordExecution(
        instance.pipelineId,
        instance.pipelineId,
        instance.status,
        instance.metrics.durationMs,
      );
      this._emitEvent('pipeline:completed', 'PipelineEngine', instance.pipelineId);
    });

    this._pipelines.onFailed((instance) => {
      this._monitoring.metrics.incrementCounter('pipeline.failed');
      this._monitoring.health.recordExecution(
        instance.pipelineId,
        instance.pipelineId,
        instance.status,
        instance.metrics.durationMs,
      );
      this._emitEvent('pipeline:failed', 'PipelineEngine', instance.pipelineId);
    });

    // Wire up scheduler
    this._scheduler.onJobComplete((job) => {
      this._monitoring.metrics.incrementCounter('job.completed');
      this._emitEvent('schedule:completed', 'JobScheduler');
    });

    this._scheduler.onJobFailed((job) => {
      this._monitoring.metrics.incrementCounter('job.failed');
      this._emitEvent('schedule:failed', 'JobScheduler');
    });

    // Wire up alerting
    this._monitoring.alerts.onAlert((alert) => {
      this._emitEvent('alert:fired', 'AlertEngine', undefined, {
        alertId: alert.id,
        ruleName: alert.ruleName,
        severity: alert.severity,
      });
    });

    this._monitoring.alerts.onResolved((alert) => {
      this._emitEvent('alert:resolved', 'AlertEngine', undefined, {
        alertId: alert.id,
        ruleName: alert.ruleName,
      });
    });
  }

  // ── Lifecycle ───────────────────────────────────────────

  /** Initialize the DataIntegrator. */
  async init(): Promise<void> {
    if (this._initialized) return;
    if (this._destroyed) {
      throw new Error('Cannot init a destroyed DataIntegrator. Create a new instance.');
    }

    this._initialized = true;
    this._startTime = Date.now();

    // Audit
    if (this._config.auditEnabled !== false) {
      this._security.recordAudit({
        action: 'di.started',
        actor: 'system',
        resource: this.name,
        resourceType: 'DataIntegrator',
        details: {
          connectors: this._connectors.count,
          pipelines: this._pipelines.pipelineCount,
          cdcStreams: this._cdc.count,
          replicationStreams: this._replication.count,
          schedules: this._scheduler.scheduleCount,
        },
        success: true,
      });
    }

    this._emitEvent('di:started', 'DataIntegrator');
  }

  /** Shut down the DataIntegrator. */
  async shutdown(): Promise<void> {
    if (this._destroyed) return;

    // Stop scheduler
    this._scheduler.shutdown();

    // Stop monitoring
    this._monitoring.shutdown();

    // Stop CDC streams
    await this._cdc.shutdown();

    // Stop replication streams
    await this._replication.shutdown();

    // Disconnect connectors
    await this._connectors.shutdown();

    // Audit
    if (this._config.auditEnabled !== false) {
      this._security.recordAudit({
        action: 'di.stopped',
        actor: 'system',
        resource: this.name,
        resourceType: 'DataIntegrator',
        success: true,
      });
    }

    this._emitEvent('di:stopped', 'DataIntegrator');

    this._initialized = false;
    this._destroyed = true;
  }

  /** Whether the DataIntegrator is initialized. */
  get isInitialized(): boolean {
    return this._initialized;
  }

  /** Whether the DataIntegrator has been shut down. */
  get isDestroyed(): boolean {
    return this._destroyed;
  }

  // ── Subsystem Access ────────────────────────────────────

  /** Access the connector manager. */
  get connectors(): ConnectorManager {
    return this._connectors;
  }

  /** Access the pipeline engine. */
  get pipelines(): PipelineEngine {
    return this._pipelines;
  }

  /** Access the CDC engine. */
  get cdc(): CDCEngine {
    return this._cdc;
  }

  /** Access the replication manager. */
  get replication(): ReplicationManager {
    return this._replication;
  }

  /** Access the transformation engine. */
  get transform(): TransformationEngine {
    return this._transform;
  }

  /** Access the data quality manager. */
  get quality(): DataQualityManager {
    return this._quality;
  }

  /** Access the lineage tracker. */
  get lineage(): LineageTracker {
    return this._lineage;
  }

  /** Access the job scheduler. */
  get scheduler(): JobScheduler {
    return this._scheduler;
  }

  /** Access the mapping manager. */
  get mappings(): MappingManager {
    return this._mappings;
  }

  /** Access the data catalog. */
  get catalog(): DataCatalog {
    return this._catalog;
  }

  /** Access the monitoring manager. */
  get monitoring(): MonitoringManager {
    return this._monitoring;
  }

  /** Access the security manager. */
  get security(): SecurityManager {
    return this._security;
  }

  // ── Metrics ─────────────────────────────────────────────

  /** Get a snapshot of DI metrics. */
  getMetrics(): DIMetrics {
    return {
      totalPipelines: this._pipelines.pipelineCount,
      activePipelines: this._pipelines.activeCount,
      totalConnectors: this._connectors.count,
      activeConnectors: this._connectors.connectedCount,
      totalCDCStreams: this._cdc.count,
      activeCDCStreams: this._cdc.activeCount,
      totalReplicationStreams: this._replication.count,
      activeReplicationStreams: this._replication.activeCount,
      totalSchedules: this._scheduler.scheduleCount,
      activeSchedules: this._scheduler.activeScheduleCount,
      totalJobsToday: this._scheduler.jobsToday,
      successfulJobsToday: this._scheduler.successfulJobsToday,
      failedJobsToday: this._scheduler.failedJobsToday,
      totalRowsProcessedToday: this._monitoring.metrics.getCounter('rows.processed'),
      totalBytesProcessedToday: this._monitoring.metrics.getCounter('bytes.processed'),
      averagePipelineLatencyMs:
        this._monitoring.metrics.getTimerStats('pipeline.latency')?.mean ?? 0,
      activeAlerts: this._monitoring.alerts.activeCount,
      catalogEntries: this._catalog.entryCount,
      lineageNodes: this._lineage.nodeCount,
      qualityScore: this._quality.lastScore?.overall ?? 0,
      uptimeMs: Date.now() - this._startTime,
      timestamp: new Date().toISOString(),
    };
  }

  // ── Events ──────────────────────────────────────────────

  /** Subscribe to DI events. */
  on(eventType: DIEventType, listener: DIEventListener): void {
    if (!this._eventListeners.has(eventType)) {
      this._eventListeners.set(eventType, []);
    }
    this._eventListeners.get(eventType)!.push(listener);
  }

  /** Unsubscribe from DI events. */
  off(eventType: DIEventType, listener: DIEventListener): void {
    const listeners = this._eventListeners.get(eventType);
    if (listeners) {
      const idx = listeners.indexOf(listener);
      if (idx >= 0) listeners.splice(idx, 1);
    }
  }

  // ── Private ─────────────────────────────────────────────

  private _emitEvent(
    type: DIEventType,
    source: string,
    pipelineId?: string,
    data?: Record<string, any>,
  ): void {
    const event: DIEvent = {
      type,
      timestamp: new Date().toISOString(),
      source,
      pipelineId,
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
