// ============================================================
// SOA One ESB — Engine Plugin
// ============================================================
//
// Provides a plugin that integrates the ESB module with the
// @soa-one/engine rule engine. This ensures 100% compatibility
// with the existing SDK.
//
// The plugin:
// - Registers ESB-specific operators for message routing rules
// - Registers ESB action handlers for message operations
// - Provides execution hooks for ESB-aware rule processing
// - Exposes ESB functions callable from rules
// ============================================================

import type { ServiceBus } from './bus';
import { createMessage, generateId } from './channel';
import type { ESBMessage } from './types';

// ── SDK-Compatible Types ──────────────────────────────────────

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

// ── ESB Engine Plugin Factory ─────────────────────────────────

/**
 * Create an @soa-one/engine plugin that integrates the ESB.
 *
 * Usage with @soa-one/engine:
 * ```ts
 * import { RuleEngine } from '@soa-one/engine';
 * import { ServiceBus, createESBPlugin } from '@soa-one/esb';
 *
 * const bus = new ServiceBus({ name: 'my-bus' });
 * await bus.init();
 *
 * const engine = new RuleEngine({
 *   plugins: [createESBPlugin(bus)],
 * });
 *
 * // Rules can now use ESB operators and actions
 * const result = await engine.execute(ruleSet, input);
 * ```
 */
export function createESBPlugin(bus: ServiceBus): EnginePlugin {
  return {
    name: 'soa-one-esb',
    version: '1.0.0',

    // ── Custom Operators ────────────────────────────────
    operators: {
      /**
       * Check if a channel has messages.
       * Usage in rule condition: field="channelName", operator="channelHasMessages", value=true
       */
      channelHasMessages: (fieldValue: any, _compareValue: any): boolean => {
        const channel = bus.getChannel(String(fieldValue));
        return channel ? channel.depth > 0 : false;
      },

      /**
       * Check if a channel depth exceeds a threshold.
       * Usage: field="channelName", operator="channelDepthExceeds", value=100
       */
      channelDepthExceeds: (fieldValue: any, compareValue: any): boolean => {
        const channel = bus.getChannel(String(fieldValue));
        return channel ? channel.depth > Number(compareValue) : false;
      },

      /**
       * Check if an endpoint is registered.
       * Usage: field="endpointName", operator="endpointExists", value=true
       */
      endpointExists: (fieldValue: any, _compareValue: any): boolean => {
        return bus.getEndpoint(String(fieldValue)) !== undefined;
      },

      /**
       * Pattern match on message type header.
       * Usage: field="messageType", operator="messageTypeMatches", value="order.*"
       */
      messageTypeMatches: (fieldValue: any, compareValue: any): boolean => {
        try {
          const pattern = String(compareValue).replace(/\*/g, '.*');
          return new RegExp(`^${pattern}$`).test(String(fieldValue));
        } catch {
          return false;
        }
      },
    },

    // ── Custom Action Handlers ──────────────────────────
    actionHandlers: {
      /**
       * Send a message to an ESB channel.
       * Usage in rule action: type="ESB_SEND", field="channelName", value={ body }
       */
      ESB_SEND: (
        output: Record<string, any>,
        action: { type: string; field: string; value: any },
        input: Record<string, any>,
      ): void => {
        const channelName = action.field;
        const body = typeof action.value === 'object' ? action.value : { data: action.value };

        // Fire and forget (action handlers are synchronous)
        bus.send(channelName, body, {
          headers: { messageType: 'rule-engine-action' },
          metadata: { source: 'rule-engine', input },
        }).catch(() => {
          // Swallow errors in action handlers
        });

        // Record the send in the output
        if (!output._esbMessages) output._esbMessages = [];
        output._esbMessages.push({
          channel: channelName,
          body,
          sentAt: new Date().toISOString(),
        });
      },

      /**
       * Publish an event to a pub/sub channel.
       * Usage: type="ESB_PUBLISH", field="channelName", value={ eventData }
       */
      ESB_PUBLISH: (
        output: Record<string, any>,
        action: { type: string; field: string; value: any },
        input: Record<string, any>,
      ): void => {
        const channelName = action.field;
        const body = typeof action.value === 'object' ? action.value : { data: action.value };

        bus.send(channelName, body, {
          headers: { messageType: 'rule-engine-event' },
          metadata: { source: 'rule-engine', input },
        }).catch(() => {});

        if (!output._esbEvents) output._esbEvents = [];
        output._esbEvents.push({
          channel: channelName,
          body,
          publishedAt: new Date().toISOString(),
        });
      },

      /**
       * Schedule a delayed message.
       * Usage: type="ESB_SCHEDULE", field="channelName", value={ body, delayMs }
       */
      ESB_SCHEDULE: (
        output: Record<string, any>,
        action: { type: string; field: string; value: any },
        _input: Record<string, any>,
      ): void => {
        const channelName = action.field;
        const config = action.value;
        const body = config.body ?? config;
        const delayMs = config.delayMs ?? 60_000;

        const scheduleId = bus.scheduleMessage(channelName, body, delayMs);

        if (!output._esbSchedules) output._esbSchedules = [];
        output._esbSchedules.push({
          scheduleId,
          channel: channelName,
          delayMs,
        });
      },
    },

    // ── Execution Hooks ─────────────────────────────────
    hooks: {
      beforeExecute: [
        (context) => {
          // Add ESB metadata to execution context
          context.metadata.esb = {
            busName: bus.name,
            channelCount: bus.channelNames.length,
            endpointCount: bus.endpointNames.length,
          };
          return context;
        },
      ],

      afterExecute: [
        (context) => {
          // Record ESB metrics for rule execution
          if (context.result) {
            bus.metrics.incrementCounter('rules.executed', 1, {
              ruleSet: context.ruleSet.name ?? context.ruleSet.id,
            });

            if (context.result.rulesFired?.length > 0) {
              bus.metrics.incrementCounter(
                'rules.fired',
                context.result.rulesFired.length,
                { ruleSet: context.ruleSet.name ?? context.ruleSet.id },
              );
            }

            bus.metrics.recordHistogram(
              'rules.execution.latency',
              context.result.executionTimeMs ?? 0,
              { ruleSet: context.ruleSet.name ?? context.ruleSet.id },
            );
          }
          return context;
        },
      ],
    },

    // ── Custom Functions ────────────────────────────────
    functions: {
      /**
       * Create an ESB message from within a rule.
       * Usage: esb_createMessage(body, { headers, priority })
       */
      esb_createMessage: (body: any, options?: any): ESBMessage => {
        return createMessage(body, options);
      },

      /**
       * Get the depth of a channel.
       * Usage: esb_channelDepth("orders")
       */
      esb_channelDepth: (channelName: string): number => {
        const channel = bus.getChannel(channelName);
        return channel?.depth ?? 0;
      },

      /**
       * Generate a unique ID.
       * Usage: esb_generateId()
       */
      esb_generateId: (): string => {
        return generateId();
      },

      /**
       * Get ESB metrics.
       * Usage: esb_getMetrics()
       */
      esb_getMetrics: (): any => {
        return bus.getMetrics();
      },

      /**
       * Check if a channel exists.
       * Usage: esb_channelExists("orders")
       */
      esb_channelExists: (channelName: string): boolean => {
        return bus.getChannel(channelName) !== undefined;
      },

      /**
       * Get the number of active saga instances.
       * Usage: esb_activeSagas()
       */
      esb_activeSagas: (): number => {
        return bus.sagas.getInstancesByStatus('running').length;
      },
    },

    // ── Lifecycle ───────────────────────────────────────
    onRegister: () => {
      bus.metrics.incrementCounter('plugin.registered');
    },

    onDestroy: () => {
      bus.metrics.incrementCounter('plugin.destroyed');
    },
  };
}
