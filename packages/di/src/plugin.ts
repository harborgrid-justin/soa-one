// ============================================================
// SOA One DI — Engine Plugin
// ============================================================
//
// Provides a plugin that integrates the Data Integration module
// with the @soa-one/engine rule engine. This ensures 100%
// compatibility with the existing SDK.
//
// The plugin:
// - Registers DI-specific operators for pipeline/connector rules
// - Registers DI action handlers for pipeline operations
// - Provides execution hooks for DI-aware rule processing
// - Exposes DI functions callable from rules
//
// This follows the exact same pattern as the ESB and CMS plugins,
// making all modules aware of each other when activated.
// ============================================================

import type { DataIntegrator } from './di';
import { generateId } from './connector';

// ── SDK-Compatible Types ────────────────────────────────────

// These types mirror the @soa-one/engine plugin interfaces
// to maintain 100% compatibility without a direct dependency.

/** Operator handler compatible with @soa-one/engine. */
type OperatorHandler = (fieldValue: any, compareValue: any) => boolean;

/** Action handler compatible with @soa-one/engine. */
type ActionHandler = (
  output: Record<string, any>,
  action: { type: string; field: string; value: any },
  input: Record<string, any>,
) => void;

/** Execution hook compatible with @soa-one/engine. */
type ExecutionHook = (context: {
  ruleSet: any;
  input: Record<string, any>;
  output: Record<string, any>;
  result?: any;
  metadata: Record<string, any>;
}) => any;

/** Rule hook compatible with @soa-one/engine. */
type RuleHook = (context: {
  rule: any;
  input: Record<string, any>;
  output: Record<string, any>;
  result?: any;
  skip?: boolean;
  metadata: Record<string, any>;
}) => any;

/** Custom function compatible with @soa-one/engine. */
type CustomFunction = (...args: any[]) => any;

/**
 * EnginePlugin interface compatible with @soa-one/engine.
 * Defined here to avoid a circular dependency.
 */
export interface EnginePlugin {
  name: string;
  version?: string;
  operators?: Record<string, OperatorHandler>;
  actionHandlers?: Record<string, ActionHandler>;
  hooks?: {
    beforeExecute?: ExecutionHook[];
    afterExecute?: ExecutionHook[];
    beforeRule?: RuleHook[];
    afterRule?: RuleHook[];
  };
  functions?: Record<string, CustomFunction>;
  onRegister?: () => void;
  onDestroy?: () => void;
}

// ── DI Engine Plugin Factory ────────────────────────────────

/**
 * Create an @soa-one/engine plugin that integrates the Data Integrator.
 *
 * Usage with @soa-one/engine:
 * ```ts
 * import { RuleEngine } from '@soa-one/engine';
 * import { DataIntegrator, createDIPlugin } from '@soa-one/di';
 *
 * const di = new DataIntegrator({ name: 'my-di' });
 * await di.init();
 *
 * const engine = new RuleEngine({
 *   plugins: [createDIPlugin(di)],
 * });
 *
 * // Rules can now use DI operators and actions
 * const result = await engine.execute(ruleSet, input);
 * ```
 *
 * Combine with ESB and CMS plugins for full cross-module awareness:
 * ```ts
 * const engine = new RuleEngine({
 *   plugins: [
 *     createESBPlugin(bus),
 *     createCMSPlugin(cms),
 *     createDIPlugin(di),
 *   ],
 * });
 * ```
 */
export function createDIPlugin(di: DataIntegrator): EnginePlugin {
  return {
    name: 'soa-one-di',
    version: '1.0.0',

    // ── Custom Operators ──────────────────────────────────
    operators: {
      /**
       * Check if a connector is connected.
       * Usage: field="connectorId", operator="connectorIsConnected", value=true
       */
      connectorIsConnected: (fieldValue: any, _compareValue: any): boolean => {
        const connector = di.connectors.get(String(fieldValue));
        return connector?.isConnected ?? false;
      },

      /**
       * Check if a pipeline exists.
       * Usage: field="pipelineId", operator="pipelineExists", value=true
       */
      pipelineExists: (fieldValue: any, _compareValue: any): boolean => {
        return di.pipelines.getPipeline(String(fieldValue)) !== undefined;
      },

      /**
       * Check if a pipeline is currently running.
       * Usage: field="pipelineId", operator="pipelineIsRunning", value=true
       */
      pipelineIsRunning: (fieldValue: any, _compareValue: any): boolean => {
        const instances = di.pipelines.getInstancesByPipeline(String(fieldValue));
        return instances.some((i) => i.status === 'running');
      },

      /**
       * Check if a CDC stream is active.
       * Usage: field="cdcStreamId", operator="cdcStreamIsActive", value=true
       */
      cdcStreamIsActive: (fieldValue: any, _compareValue: any): boolean => {
        const stream = di.cdc.getStream(String(fieldValue));
        return stream?.status === 'streaming';
      },

      /**
       * Check if a replication stream is active.
       * Usage: field="replicationId", operator="replicationIsActive", value=true
       */
      replicationIsActive: (fieldValue: any, _compareValue: any): boolean => {
        const stream = di.replication.getStream(String(fieldValue));
        return stream?.status === 'streaming' || stream?.status === 'applying';
      },

      /**
       * Check if the quality score exceeds a threshold.
       * Usage: field="qualityScore", operator="qualityScoreExceeds", value=0.95
       */
      qualityScoreExceeds: (fieldValue: any, compareValue: any): boolean => {
        const score = di.quality.lastScore;
        if (!score) return false;
        return score.overall > Number(compareValue);
      },

      /**
       * Check if a catalog entry exists.
       * Usage: field="entryId", operator="catalogEntryExists", value=true
       */
      catalogEntryExists: (fieldValue: any, _compareValue: any): boolean => {
        return di.catalog.getEntry(String(fieldValue)) !== undefined;
      },

      /**
       * Check if a connector type matches.
       * Usage: field="connectorId", operator="connectorTypeIs", value="jdbc"
       */
      connectorTypeIs: (fieldValue: any, compareValue: any): boolean => {
        const connector = di.connectors.get(String(fieldValue));
        return connector?.config.type === String(compareValue);
      },
    },

    // ── Custom Action Handlers ────────────────────────────
    actionHandlers: {
      /**
       * Execute a pipeline from a rule.
       * Usage: type="DI_EXECUTE_PIPELINE", field="pipelineId", value={ parameters }
       */
      DI_EXECUTE_PIPELINE: (
        output: Record<string, any>,
        action: { type: string; field: string; value: any },
        input: Record<string, any>,
      ): void => {
        const pipelineId = action.field;
        const params = typeof action.value === 'object' ? action.value : {};

        di.pipelines.execute(pipelineId, params, 'rule-engine').then((instance) => {
          if (!output._diPipelines) output._diPipelines = [];
          output._diPipelines.push({
            instanceId: instance.instanceId,
            pipelineId,
            status: instance.status,
            triggeredAt: new Date().toISOString(),
          });
        }).catch(() => {});
      },

      /**
       * Start a CDC stream from a rule.
       * Usage: type="DI_START_CDC", field="cdcStreamId", value={}
       */
      DI_START_CDC: (
        output: Record<string, any>,
        action: { type: string; field: string; value: any },
        _input: Record<string, any>,
      ): void => {
        const streamId = action.field;
        const stream = di.cdc.getStream(streamId);
        if (stream) {
          stream.start().catch(() => {});

          if (!output._diCDCStreams) output._diCDCStreams = [];
          output._diCDCStreams.push({
            streamId,
            action: 'started',
            timestamp: new Date().toISOString(),
          });
        }
      },

      /**
       * Stop a CDC stream from a rule.
       * Usage: type="DI_STOP_CDC", field="cdcStreamId", value={}
       */
      DI_STOP_CDC: (
        output: Record<string, any>,
        action: { type: string; field: string; value: any },
        _input: Record<string, any>,
      ): void => {
        const streamId = action.field;
        const stream = di.cdc.getStream(streamId);
        if (stream) {
          stream.stop().catch(() => {});

          if (!output._diCDCStreams) output._diCDCStreams = [];
          output._diCDCStreams.push({
            streamId,
            action: 'stopped',
            timestamp: new Date().toISOString(),
          });
        }
      },

      /**
       * Trigger a scheduled job from a rule.
       * Usage: type="DI_TRIGGER_SCHEDULE", field="scheduleId", value={ parameters }
       */
      DI_TRIGGER_SCHEDULE: (
        output: Record<string, any>,
        action: { type: string; field: string; value: any },
        _input: Record<string, any>,
      ): void => {
        const scheduleId = action.field;
        const params = typeof action.value === 'object' ? action.value : {};

        di.scheduler.trigger(scheduleId, params, 'rule-engine').then((job) => {
          if (!output._diJobs) output._diJobs = [];
          output._diJobs.push({
            jobId: job.instanceId,
            scheduleId,
            status: job.status,
            triggeredAt: new Date().toISOString(),
          });
        }).catch(() => {});
      },

      /**
       * Mask data using DI security.
       * Usage: type="DI_MASK_DATA", field="columnName", value={ strategy, parameters }
       */
      DI_MASK_DATA: (
        output: Record<string, any>,
        action: { type: string; field: string; value: any },
        input: Record<string, any>,
      ): void => {
        const column = action.field;
        const config = action.value;
        const strategy = config.strategy ?? 'full';

        if (input[column] !== undefined) {
          output[column] = di.security.masker.mask(
            input[column],
            strategy,
            config.parameters,
          );
        }
      },
    },

    // ── Execution Hooks ───────────────────────────────────
    hooks: {
      beforeExecute: [
        (context) => {
          // Add DI metadata to execution context
          const metrics = di.getMetrics();
          context.metadata.di = {
            name: di.name,
            totalPipelines: metrics.totalPipelines,
            activePipelines: metrics.activePipelines,
            totalConnectors: metrics.totalConnectors,
            activeConnectors: metrics.activeConnectors,
            totalCDCStreams: metrics.totalCDCStreams,
            activeCDCStreams: metrics.activeCDCStreams,
            totalReplicationStreams: metrics.totalReplicationStreams,
            activeReplicationStreams: metrics.activeReplicationStreams,
            activeAlerts: metrics.activeAlerts,
            qualityScore: metrics.qualityScore,
          };
          return context;
        },
      ],

      afterExecute: [
        (context) => {
          // Record rule execution in DI audit
          if (context.result) {
            di.security.recordAudit({
              action: 'rule-engine.execute',
              actor: 'rule-engine',
              resource: context.ruleSet.name ?? context.ruleSet.id,
              resourceType: 'ruleSet',
              details: {
                rulesFired: context.result.rulesFired?.length ?? 0,
                executionTimeMs: context.result.executionTimeMs ?? 0,
              },
              success: true,
            });

            // Record metrics
            di.monitoring.metrics.incrementCounter('rules.executed', 1, {
              ruleSet: context.ruleSet.name ?? context.ruleSet.id,
            });

            if (context.result.executionTimeMs) {
              di.monitoring.metrics.recordHistogram(
                'rules.execution.latency',
                context.result.executionTimeMs,
                { ruleSet: context.ruleSet.name ?? context.ruleSet.id },
              );
            }
          }
          return context;
        },
      ],
    },

    // ── Custom Functions ──────────────────────────────────
    functions: {
      /**
       * Get connector status.
       * Usage: di_connectorStatus(connectorId)
       */
      di_connectorStatus: (connectorId: string): string => {
        const connector = di.connectors.get(connectorId);
        return connector?.status ?? 'unknown';
      },

      /**
       * Get total registered connectors.
       * Usage: di_connectorCount()
       */
      di_connectorCount: (): number => {
        return di.connectors.count;
      },

      /**
       * Check if a connector exists.
       * Usage: di_connectorExists(connectorId)
       */
      di_connectorExists: (connectorId: string): boolean => {
        return di.connectors.get(connectorId) !== undefined;
      },

      /**
       * Get pipeline count.
       * Usage: di_pipelineCount()
       */
      di_pipelineCount: (): number => {
        return di.pipelines.pipelineCount;
      },

      /**
       * Get active pipeline count.
       * Usage: di_activePipelineCount()
       */
      di_activePipelineCount: (): number => {
        return di.pipelines.activeCount;
      },

      /**
       * Get CDC stream status.
       * Usage: di_cdcStreamStatus(streamId)
       */
      di_cdcStreamStatus: (streamId: string): string => {
        const stream = di.cdc.getStream(streamId);
        return stream?.status ?? 'unknown';
      },

      /**
       * Get total CDC events processed.
       * Usage: di_cdcEventsProcessed()
       */
      di_cdcEventsProcessed: (): number => {
        return di.cdc.totalEventsProcessed;
      },

      /**
       * Get replication stream status.
       * Usage: di_replicationStatus(streamId)
       */
      di_replicationStatus: (streamId: string): string => {
        const stream = di.replication.getStream(streamId);
        return stream?.status ?? 'unknown';
      },

      /**
       * Get the latest quality score.
       * Usage: di_qualityScore()
       */
      di_qualityScore: (): number => {
        return di.quality.lastScore?.overall ?? 0;
      },

      /**
       * Get DI metrics.
       * Usage: di_getMetrics()
       */
      di_getMetrics: (): any => {
        return di.getMetrics();
      },

      /**
       * Generate a unique ID.
       * Usage: di_generateId()
       */
      di_generateId: (): string => {
        return generateId();
      },

      /**
       * Search the data catalog.
       * Usage: di_searchCatalog(text)
       */
      di_searchCatalog: (text: string): any => {
        return di.catalog.search({ text });
      },

      /**
       * Get catalog entry count.
       * Usage: di_catalogEntryCount()
       */
      di_catalogEntryCount: (): number => {
        return di.catalog.entryCount;
      },

      /**
       * Get lineage node count.
       * Usage: di_lineageNodeCount()
       */
      di_lineageNodeCount: (): number => {
        return di.lineage.nodeCount;
      },

      /**
       * Get active alerts.
       * Usage: di_activeAlertCount()
       */
      di_activeAlertCount: (): number => {
        return di.monitoring.alerts.activeCount;
      },

      /**
       * Get jobs run today count.
       * Usage: di_jobsToday()
       */
      di_jobsToday: (): number => {
        return di.scheduler.jobsToday;
      },

      /**
       * Get successful jobs today.
       * Usage: di_successfulJobsToday()
       */
      di_successfulJobsToday: (): number => {
        return di.scheduler.successfulJobsToday;
      },

      /**
       * Analyze downstream impact for a lineage node.
       * Usage: di_analyzeImpact(nodeId)
       */
      di_analyzeImpact: (nodeId: string): any => {
        return di.lineage.analyzeImpact(nodeId, 'downstream');
      },
    },

    // ── Lifecycle ─────────────────────────────────────────
    onRegister: () => {
      di.security.recordAudit({
        action: 'plugin.registered',
        actor: 'rule-engine',
        resource: 'soa-one-di',
        resourceType: 'plugin',
        details: { plugin: 'soa-one-di' },
        success: true,
      });
      di.monitoring.metrics.incrementCounter('plugin.registered');
    },

    onDestroy: () => {
      di.security.recordAudit({
        action: 'plugin.destroyed',
        actor: 'rule-engine',
        resource: 'soa-one-di',
        resourceType: 'plugin',
        details: { plugin: 'soa-one-di' },
        success: true,
      });
      di.monitoring.metrics.incrementCounter('plugin.destroyed');
    },
  };
}
