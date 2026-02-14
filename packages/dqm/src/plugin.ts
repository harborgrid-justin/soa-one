// ============================================================
// SOA One DQM — Engine Plugin
// ============================================================
//
// Provides a plugin that integrates the Data Quality & Messaging
// module with the @soa-one/engine rule engine. This ensures 100%
// compatibility with the existing SDK.
//
// The plugin:
// - Registers DQM-specific operators for quality/messaging rules
// - Registers DQM action handlers for quality and messaging ops
// - Provides execution hooks for DQM-aware rule processing
// - Exposes DQM functions callable from rules
//
// This follows the exact same pattern as the ESB, CMS, and DI
// plugins, making all modules aware of each other when activated.
// ============================================================

import type { DataQualityMessaging } from './dqm';
import { generateId } from './profiler';

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

// ── DQM Engine Plugin Factory ───────────────────────────────

/**
 * Create an @soa-one/engine plugin that integrates the DQM module.
 *
 * Usage with @soa-one/engine:
 * ```ts
 * import { RuleEngine } from '@soa-one/engine';
 * import { DataQualityMessaging, createDQMPlugin } from '@soa-one/dqm';
 *
 * const dqm = new DataQualityMessaging({ name: 'my-dqm' });
 * await dqm.init();
 *
 * const engine = new RuleEngine({
 *   plugins: [createDQMPlugin(dqm)],
 * });
 *
 * // Rules can now use DQM operators and actions
 * const result = await engine.execute(ruleSet, input);
 * ```
 *
 * Combine with ESB, CMS, and DI plugins for full cross-module awareness:
 * ```ts
 * const engine = new RuleEngine({
 *   plugins: [
 *     createESBPlugin(bus),
 *     createCMSPlugin(cms),
 *     createDIPlugin(di),
 *     createDQMPlugin(dqm),
 *   ],
 * });
 * ```
 */
export function createDQMPlugin(dqm: DataQualityMessaging): EnginePlugin {
  return {
    name: 'soa-one-dqm',
    version: '1.0.0',

    // ── Custom Operators ──────────────────────────────────
    operators: {
      /**
       * Check if quality score exceeds a threshold.
       * Usage: field="score", operator="qualityScoreExceeds", value=0.9
       */
      qualityScoreExceeds: (fieldValue: any, compareValue: any): boolean => {
        const score = dqm.scoring.lastScore;
        return score ? score.overall > Number(compareValue) : false;
      },

      /**
       * Check if quality grade matches.
       * Usage: field="grade", operator="qualityGradeIs", value="A"
       */
      qualityGradeIs: (fieldValue: any, compareValue: any): boolean => {
        const score = dqm.scoring.lastScore;
        return score ? score.grade === String(compareValue) : false;
      },

      /**
       * Check if a quality rule exists.
       * Usage: field="ruleId", operator="qualityRuleExists", value=true
       */
      qualityRuleExists: (fieldValue: any, _compareValue: any): boolean => {
        return dqm.rules.getRule(String(fieldValue)) !== undefined;
      },

      /**
       * Check if a topic exists.
       * Usage: field="topicName", operator="topicExists", value=true
       */
      topicExists: (fieldValue: any, _compareValue: any): boolean => {
        return dqm.messaging.getTopic(String(fieldValue)) !== undefined;
      },

      /**
       * Check if a topic has backlog messages.
       * Usage: field="topicName", operator="topicHasBacklog", value=true
       */
      topicHasBacklog: (fieldValue: any, _compareValue: any): boolean => {
        const topic = dqm.messaging.getTopic(String(fieldValue));
        return topic ? topic.messageBacklog > 0 : false;
      },

      /**
       * Check if a queue exists.
       * Usage: field="queueName", operator="queueExists", value=true
       */
      queueExists: (fieldValue: any, _compareValue: any): boolean => {
        return dqm.messaging.getQueue(String(fieldValue)) !== undefined;
      },

      /**
       * Check if queue depth exceeds threshold.
       * Usage: field="queueName", operator="queueDepthExceeds", value=100
       */
      queueDepthExceeds: (fieldValue: any, compareValue: any): boolean => {
        const queue = dqm.messaging.getQueue(String(fieldValue));
        return queue ? queue.depth > Number(compareValue) : false;
      },

      /**
       * Check if a match rule exists.
       * Usage: field="ruleId", operator="matchRuleExists", value=true
       */
      matchRuleExists: (fieldValue: any, _compareValue: any): boolean => {
        return dqm.matching.getRule(String(fieldValue)) !== undefined;
      },

      /**
       * Check if quality trend is a specific value.
       * Usage: field="trend", operator="qualityTrendIs", value="improving"
       */
      qualityTrendIs: (_fieldValue: any, compareValue: any): boolean => {
        return dqm.scoring.trend === String(compareValue);
      },

      /**
       * Check if there are active alerts.
       * Usage: field="alerts", operator="hasActiveAlerts", value=true
       */
      hasActiveAlerts: (_fieldValue: any, _compareValue: any): boolean => {
        return dqm.monitoring.alerts.activeCount > 0;
      },
    },

    // ── Custom Action Handlers ────────────────────────────
    actionHandlers: {
      /**
       * Publish a message to a DQM topic.
       * Usage: type="DQM_PUBLISH", field="topicName", value={ body, headers }
       */
      DQM_PUBLISH: (
        output: Record<string, any>,
        action: { type: string; field: string; value: any },
        input: Record<string, any>,
      ): void => {
        const topicName = action.field;
        const config = typeof action.value === 'object' ? action.value : { body: action.value };

        try {
          const msg = dqm.messaging.publish(topicName, config.body ?? config, {
            headers: config.headers ?? { source: 'rule-engine' },
            publishedBy: 'rule-engine',
          });

          if (!output._dqmMessages) output._dqmMessages = [];
          output._dqmMessages.push({
            messageId: msg.id,
            topic: topicName,
            publishedAt: msg.timestamp,
          });
        } catch {
          // Swallow errors in action handlers
        }
      },

      /**
       * Enqueue a message to a DQM queue.
       * Usage: type="DQM_ENQUEUE", field="queueName", value={ body }
       */
      DQM_ENQUEUE: (
        output: Record<string, any>,
        action: { type: string; field: string; value: any },
        _input: Record<string, any>,
      ): void => {
        const queueName = action.field;
        const config = typeof action.value === 'object' ? action.value : { body: action.value };

        try {
          const msg = dqm.messaging.enqueue(queueName, config.body ?? config, {
            publishedBy: 'rule-engine',
          });

          if (!output._dqmQueued) output._dqmQueued = [];
          output._dqmQueued.push({
            messageId: msg.id,
            queue: queueName,
            enqueuedAt: msg.timestamp,
          });
        } catch {
          // Swallow errors
        }
      },

      /**
       * Validate data against quality rules from a rule action.
       * Usage: type="DQM_VALIDATE", field="datasetName", value={ data, ruleIds }
       */
      DQM_VALIDATE: (
        output: Record<string, any>,
        action: { type: string; field: string; value: any },
        input: Record<string, any>,
      ): void => {
        const config = action.value;
        const data = config?.data ?? (Array.isArray(input.data) ? input.data : [input]);

        try {
          const result = dqm.rules.evaluateAll(data, config?.ruleIds);

          if (!output._dqmValidations) output._dqmValidations = [];
          output._dqmValidations.push({
            datasetName: action.field,
            passRate: result.overallPassRate,
            totalViolations: result.totalViolations,
            timestamp: result.timestamp,
          });

          dqm.monitoring.metrics.incrementCounter('validations.executed');
        } catch {
          // Swallow errors
        }
      },

      /**
       * Cleanse data from a rule action.
       * Usage: type="DQM_CLEANSE", field="columnName", value={ ruleIds }
       */
      DQM_CLEANSE: (
        output: Record<string, any>,
        action: { type: string; field: string; value: any },
        input: Record<string, any>,
      ): void => {
        const config = action.value;

        try {
          const cleansed = dqm.cleansing.cleanseRow(input, config?.ruleIds);

          if (!output._dqmCleansed) output._dqmCleansed = [];
          output._dqmCleansed.push({
            field: action.field,
            cleansedAt: new Date().toISOString(),
          });

          // Apply cleansed values to output
          for (const [key, value] of Object.entries(cleansed)) {
            if (value !== input[key]) {
              output[key] = value;
            }
          }

          dqm.monitoring.metrics.incrementCounter('cleansing.executed');
        } catch {
          // Swallow errors
        }
      },

      /**
       * Profile a dataset from a rule action.
       * Usage: type="DQM_PROFILE", field="datasetName", value={ data }
       */
      DQM_PROFILE: (
        output: Record<string, any>,
        action: { type: string; field: string; value: any },
        input: Record<string, any>,
      ): void => {
        const config = action.value;
        const data = config?.data ?? (Array.isArray(input.data) ? input.data : [input]);

        try {
          const profile = dqm.profiler.profileDataset(action.field, data);

          if (!output._dqmProfiles) output._dqmProfiles = [];
          output._dqmProfiles.push({
            datasetName: action.field,
            totalRows: profile.totalRows,
            totalColumns: profile.totalColumns,
            profiledAt: profile.profiledAt,
          });

          dqm.monitoring.metrics.incrementCounter('profiles.executed');
        } catch {
          // Swallow errors
        }
      },
    },

    // ── Execution Hooks ───────────────────────────────────
    hooks: {
      beforeExecute: [
        (context) => {
          // Add DQM metadata to execution context
          const metrics = dqm.getMetrics();
          context.metadata.dqm = {
            name: dqm.name,
            totalQualityRules: metrics.totalQualityRules,
            activeQualityRules: metrics.activeQualityRules,
            totalTopics: metrics.totalTopics,
            totalQueues: metrics.totalQueues,
            currentQualityScore: metrics.currentQualityScore,
            currentQualityGrade: metrics.currentQualityGrade,
            activeAlerts: metrics.activeAlerts,
            messagesPublished: metrics.messagesPublished,
          };
          return context;
        },
      ],

      afterExecute: [
        (context) => {
          // Record rule execution in DQM audit
          if (context.result) {
            dqm.security.recordAudit({
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
            dqm.monitoring.metrics.incrementCounter('rules.executed', 1, {
              ruleSet: context.ruleSet.name ?? context.ruleSet.id,
            });

            if (context.result.executionTimeMs) {
              dqm.monitoring.metrics.recordHistogram(
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
       * Get the current quality score.
       * Usage: dqm_qualityScore()
       */
      dqm_qualityScore: (): number => {
        return dqm.scoring.lastScore?.overall ?? 0;
      },

      /**
       * Get the current quality grade.
       * Usage: dqm_qualityGrade()
       */
      dqm_qualityGrade: (): string => {
        return dqm.scoring.lastScore?.grade ?? 'N/A';
      },

      /**
       * Get the quality trend.
       * Usage: dqm_qualityTrend()
       */
      dqm_qualityTrend: (): string => {
        return dqm.scoring.trend;
      },

      /**
       * Get the quality rule count.
       * Usage: dqm_ruleCount()
       */
      dqm_ruleCount: (): number => {
        return dqm.rules.ruleCount;
      },

      /**
       * Get enabled quality rule count.
       * Usage: dqm_enabledRuleCount()
       */
      dqm_enabledRuleCount: (): number => {
        return dqm.rules.enabledRuleCount;
      },

      /**
       * Check if a quality rule exists.
       * Usage: dqm_ruleExists(ruleId)
       */
      dqm_ruleExists: (ruleId: string): boolean => {
        return dqm.rules.getRule(ruleId) !== undefined;
      },

      /**
       * Get topic count.
       * Usage: dqm_topicCount()
       */
      dqm_topicCount: (): number => {
        return dqm.messaging.topicCount;
      },

      /**
       * Get queue count.
       * Usage: dqm_queueCount()
       */
      dqm_queueCount: (): number => {
        return dqm.messaging.queueCount;
      },

      /**
       * Check if a topic exists.
       * Usage: dqm_topicExists(topicName)
       */
      dqm_topicExists: (topicName: string): boolean => {
        return dqm.messaging.getTopic(topicName) !== undefined;
      },

      /**
       * Check if a queue exists.
       * Usage: dqm_queueExists(queueName)
       */
      dqm_queueExists: (queueName: string): boolean => {
        return dqm.messaging.getQueue(queueName) !== undefined;
      },

      /**
       * Get total messages published.
       * Usage: dqm_messagesPublished()
       */
      dqm_messagesPublished: (): number => {
        return dqm.messaging.totalMessagesPublished;
      },

      /**
       * Get total messages delivered.
       * Usage: dqm_messagesDelivered()
       */
      dqm_messagesDelivered: (): number => {
        return dqm.messaging.totalMessagesDelivered;
      },

      /**
       * Get total dead-lettered messages.
       * Usage: dqm_messagesDeadLettered()
       */
      dqm_messagesDeadLettered: (): number => {
        return dqm.messaging.totalMessagesDeadLettered;
      },

      /**
       * Get active alert count.
       * Usage: dqm_activeAlertCount()
       */
      dqm_activeAlertCount: (): number => {
        return dqm.monitoring.alerts.activeCount;
      },

      /**
       * Get DQM metrics.
       * Usage: dqm_getMetrics()
       */
      dqm_getMetrics: (): any => {
        return dqm.getMetrics();
      },

      /**
       * Generate a unique ID.
       * Usage: dqm_generateId()
       */
      dqm_generateId: (): string => {
        return generateId();
      },

      /**
       * Get match rule count.
       * Usage: dqm_matchRuleCount()
       */
      dqm_matchRuleCount: (): number => {
        return dqm.matching.ruleCount;
      },

      /**
       * Get cleansing rule count.
       * Usage: dqm_cleansingRuleCount()
       */
      dqm_cleansingRuleCount: (): number => {
        return dqm.cleansing.ruleCount;
      },

      /**
       * Get score history length.
       * Usage: dqm_scoreHistoryLength()
       */
      dqm_scoreHistoryLength: (): number => {
        return dqm.scoring.history.length;
      },

      /**
       * Publish a message to a topic.
       * Usage: dqm_publish(topicName, body, publishedBy)
       */
      dqm_publish: (topicName: string, body: any, publishedBy?: string): string | null => {
        try {
          const msg = dqm.messaging.publish(topicName, body, {
            publishedBy: publishedBy ?? 'rule-engine',
          });
          return msg.id;
        } catch {
          return null;
        }
      },

      /**
       * Enqueue a message.
       * Usage: dqm_enqueue(queueName, body, publishedBy)
       */
      dqm_enqueue: (queueName: string, body: any, publishedBy?: string): string | null => {
        try {
          const msg = dqm.messaging.enqueue(queueName, body, {
            publishedBy: publishedBy ?? 'rule-engine',
          });
          return msg.id;
        } catch {
          return null;
        }
      },
    },

    // ── Lifecycle ─────────────────────────────────────────
    onRegister: () => {
      dqm.security.recordAudit({
        action: 'plugin.registered',
        actor: 'rule-engine',
        resource: 'soa-one-dqm',
        resourceType: 'plugin',
        details: { plugin: 'soa-one-dqm' },
        success: true,
      });
      dqm.monitoring.metrics.incrementCounter('plugin.registered');
    },

    onDestroy: () => {
      dqm.security.recordAudit({
        action: 'plugin.destroyed',
        actor: 'rule-engine',
        resource: 'soa-one-dqm',
        resourceType: 'plugin',
        details: { plugin: 'soa-one-dqm' },
        success: true,
      });
      dqm.monitoring.metrics.incrementCounter('plugin.destroyed');
    },
  };
}
