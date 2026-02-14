// ============================================================
// SOA One SOA — Engine Plugin
// ============================================================
//
// Provides a plugin that integrates the SOA Suite module with
// the @soa-one/engine rule engine. This ensures 100%
// compatibility with the existing SDK.
//
// The plugin:
// - Registers SOA-specific operators for service/process rules
// - Registers SOA action handlers for orchestration operations
// - Provides execution hooks for SOA-aware rule processing
// - Exposes SOA functions callable from rules
//
// This follows the exact same pattern as the ESB, CMS, DI,
// and DQM plugins, making all modules aware of each other
// when activated.
// ============================================================

import type { SOASuite } from './soa';
import { generateId } from './registry';

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

// ── SOA Engine Plugin Factory ───────────────────────────────

/**
 * Create an @soa-one/engine plugin that integrates the SOA Suite.
 *
 * Usage with @soa-one/engine:
 * ```ts
 * import { RuleEngine } from '@soa-one/engine';
 * import { SOASuite, createSOAPlugin } from '@soa-one/soa';
 *
 * const soa = new SOASuite({ name: 'my-soa' });
 * await soa.init();
 *
 * const engine = new RuleEngine({
 *   plugins: [createSOAPlugin(soa)],
 * });
 *
 * // Rules can now use SOA operators and actions
 * const result = await engine.execute(ruleSet, input);
 * ```
 *
 * Combine with ESB, CMS, DI, and DQM plugins for full cross-module awareness:
 * ```ts
 * const engine = new RuleEngine({
 *   plugins: [
 *     createESBPlugin(bus),
 *     createCMSPlugin(cms),
 *     createDIPlugin(di),
 *     createDQMPlugin(dqm),
 *     createSOAPlugin(soa),
 *   ],
 * });
 * ```
 */
export function createSOAPlugin(soa: SOASuite): EnginePlugin {
  return {
    name: 'soa-one-soa',
    version: '1.0.0',

    // ── Custom Operators ──────────────────────────────────
    operators: {
      /**
       * Check if a service exists in the registry.
       * Usage: field="serviceId", operator="serviceExists", value=true
       */
      serviceExists: (fieldValue: any, _compareValue: any): boolean => {
        return soa.registry.get(String(fieldValue)) !== undefined;
      },

      /**
       * Check if a service is active.
       * Usage: field="serviceId", operator="serviceIsActive", value=true
       */
      serviceIsActive: (fieldValue: any, _compareValue: any): boolean => {
        const service = soa.registry.get(String(fieldValue));
        return service?.status === 'active';
      },

      /**
       * Check if a service has healthy endpoints.
       * Usage: field="serviceId", operator="serviceHasHealthyEndpoints", value=true
       */
      serviceHasHealthyEndpoints: (fieldValue: any, _compareValue: any): boolean => {
        const endpoints = soa.registry.getHealthyEndpoints(String(fieldValue));
        return endpoints.length > 0;
      },

      /**
       * Check if a BPEL process definition exists.
       * Usage: field="processId", operator="processExists", value=true
       */
      processExists: (fieldValue: any, _compareValue: any): boolean => {
        return soa.bpel.getProcess(String(fieldValue)) !== undefined;
      },

      /**
       * Check if a BPEL process instance is active.
       * Usage: field="instanceId", operator="processIsActive", value=true
       */
      processIsActive: (fieldValue: any, _compareValue: any): boolean => {
        const instance = soa.bpel.getInstance(String(fieldValue));
        return instance?.status === 'active';
      },

      /**
       * Check if a human task exists.
       * Usage: field="taskId", operator="taskExists", value=true
       */
      taskExists: (fieldValue: any, _compareValue: any): boolean => {
        return soa.tasks.getTask(String(fieldValue)) !== undefined;
      },

      /**
       * Check if a task has a specific status.
       * Usage: field="taskId", operator="taskHasStatus", value="completed"
       */
      taskHasStatus: (fieldValue: any, compareValue: any): boolean => {
        const task = soa.tasks.getTask(String(fieldValue));
        return task?.status === String(compareValue);
      },

      /**
       * Check if a trading partner is active.
       * Usage: field="partnerId", operator="partnerIsActive", value=true
       */
      partnerIsActive: (fieldValue: any, _compareValue: any): boolean => {
        const partner = soa.b2b.getPartner(String(fieldValue));
        return partner?.status === 'active';
      },

      /**
       * Check if an API is published.
       * Usage: field="apiId", operator="apiIsPublished", value=true
       */
      apiIsPublished: (fieldValue: any, _compareValue: any): boolean => {
        const api = soa.api.getAPI(String(fieldValue));
        return api?.status === 'published';
      },

      /**
       * Check if there are active SLA breaches.
       * Usage: field="slaBreaches", operator="hasSLABreaches", value=true
       */
      hasSLABreaches: (_fieldValue: any, _compareValue: any): boolean => {
        return soa.policy.slaBreachCount > 0;
      },

      /**
       * Check if a CEP pattern has matched recently.
       * Usage: field="patternId", operator="patternHasMatched", value=true
       */
      patternHasMatched: (fieldValue: any, _compareValue: any): boolean => {
        const matches = soa.cep.getRecentMatches();
        return matches.some((m) => m.patternId === String(fieldValue));
      },

      /**
       * Check if there are overdue tasks.
       * Usage: field="overdueTasks", operator="hasOverdueTasks", value=true
       */
      hasOverdueTasks: (_fieldValue: any, _compareValue: any): boolean => {
        return soa.tasks.overdueCount > 0;
      },

      /**
       * Check if the mesh circuit for a service is open.
       * Usage: field="proxyId:serviceId", operator="circuitIsOpen", value=true
       */
      circuitIsOpen: (fieldValue: any, _compareValue: any): boolean => {
        const parts = String(fieldValue).split(':');
        if (parts.length !== 2) return false;
        return soa.mesh.getCircuitState(parts[0], parts[1]) === 'open';
      },
    },

    // ── Custom Action Handlers ────────────────────────────
    actionHandlers: {
      /**
       * Start a BPEL process from a rule.
       * Usage: type="SOA_START_PROCESS", field="processId", value={ input, initiatedBy }
       */
      SOA_START_PROCESS: (
        output: Record<string, any>,
        action: { type: string; field: string; value: any },
        input: Record<string, any>,
      ): void => {
        const processId = action.field;
        const config = typeof action.value === 'object' ? action.value : {};
        const processInput = config.input ?? input;
        const initiatedBy = config.initiatedBy ?? 'rule-engine';

        soa.bpel.startProcess(processId, processInput, initiatedBy).then((instance) => {
          if (!output._soaProcesses) output._soaProcesses = [];
          output._soaProcesses.push({
            instanceId: instance.instanceId,
            processId,
            status: instance.status,
            startedAt: instance.startedAt,
          });
        }).catch(() => {});
      },

      /**
       * Create a human task from a rule.
       * Usage: type="SOA_CREATE_TASK", field="definitionId", value={ input, processInstanceId }
       */
      SOA_CREATE_TASK: (
        output: Record<string, any>,
        action: { type: string; field: string; value: any },
        input: Record<string, any>,
      ): void => {
        const config = typeof action.value === 'object' ? action.value : {};
        try {
          const task = soa.tasks.createTask(
            action.field,
            config.input ?? input,
            config.processInstanceId,
            config.activityId,
          );

          if (!output._soaTasks) output._soaTasks = [];
          output._soaTasks.push({
            instanceId: task.instanceId,
            definitionId: action.field,
            status: task.status,
            createdAt: task.createdAt,
          });
        } catch {
          // Swallow errors in action handlers
        }
      },

      /**
       * Process a CEP event from a rule.
       * Usage: type="SOA_PROCESS_EVENT", field="eventType", value={ data, source }
       */
      SOA_PROCESS_EVENT: (
        output: Record<string, any>,
        action: { type: string; field: string; value: any },
        input: Record<string, any>,
      ): void => {
        const config = typeof action.value === 'object' ? action.value : {};
        try {
          const matches = soa.cep.processEvent({
            id: generateId(),
            type: action.field,
            source: config.source ?? 'rule-engine',
            timestamp: new Date().toISOString(),
            data: config.data ?? input,
            priority: config.priority ?? 'normal',
            correlationKeys: config.correlationKeys ?? {},
            headers: config.headers ?? {},
          });

          if (!output._soaCEPMatches) output._soaCEPMatches = [];
          if (matches.length > 0) {
            output._soaCEPMatches.push(...matches.map((m) => ({
              matchId: m.id,
              patternId: m.patternId,
              matchedAt: m.matchedAt,
            })));
          }
        } catch {
          // Swallow errors
        }
      },

      /**
       * Send a B2B document from a rule.
       * Usage: type="SOA_B2B_SEND", field="partnerId", value={ agreementId, documentType, content, format }
       */
      SOA_B2B_SEND: (
        output: Record<string, any>,
        action: { type: string; field: string; value: any },
        _input: Record<string, any>,
      ): void => {
        const config = action.value;
        try {
          const exchange = soa.b2b.sendDocument(
            action.field,
            config.agreementId,
            config.documentType,
            config.content ?? '',
            config.format ?? 'xml',
          );

          if (!output._soaB2BExchanges) output._soaB2BExchanges = [];
          output._soaB2BExchanges.push({
            exchangeId: exchange.id,
            partnerId: action.field,
            status: exchange.status,
            exchangedAt: exchange.exchangedAt,
          });
        } catch {
          // Swallow errors
        }
      },

      /**
       * Publish an API from a rule.
       * Usage: type="SOA_PUBLISH_API", field="apiId", value={}
       */
      SOA_PUBLISH_API: (
        output: Record<string, any>,
        action: { type: string; field: string; value: any },
        _input: Record<string, any>,
      ): void => {
        try {
          soa.api.publishAPI(action.field);

          if (!output._soaAPIs) output._soaAPIs = [];
          output._soaAPIs.push({
            apiId: action.field,
            action: 'published',
            timestamp: new Date().toISOString(),
          });
        } catch {
          // Swallow errors
        }
      },

      /**
       * Record a BAM KPI value from a rule.
       * Usage: type="SOA_RECORD_KPI", field="kpiId", value=42
       */
      SOA_RECORD_KPI: (
        output: Record<string, any>,
        action: { type: string; field: string; value: any },
        _input: Record<string, any>,
      ): void => {
        try {
          soa.bam.recordKPIValue(action.field, Number(action.value));

          if (!output._soaKPIs) output._soaKPIs = [];
          output._soaKPIs.push({
            kpiId: action.field,
            value: Number(action.value),
            recordedAt: new Date().toISOString(),
          });
        } catch {
          // Swallow errors
        }
      },

      /**
       * Evaluate a policy from a rule.
       * Usage: type="SOA_EVALUATE_POLICY", field="policyId", value={ context }
       */
      SOA_EVALUATE_POLICY: (
        output: Record<string, any>,
        action: { type: string; field: string; value: any },
        input: Record<string, any>,
      ): void => {
        const config = typeof action.value === 'object' ? action.value : {};
        try {
          const result = soa.policy.evaluatePolicy(
            action.field,
            config.context ?? input,
          );

          if (!output._soaPolicyResults) output._soaPolicyResults = [];
          output._soaPolicyResults.push({
            policyId: action.field,
            allowed: result.allowed,
            violations: result.violations,
            evaluatedAt: new Date().toISOString(),
          });
        } catch {
          // Swallow errors
        }
      },
    },

    // ── Execution Hooks ───────────────────────────────────
    hooks: {
      beforeExecute: [
        (context) => {
          // Add SOA metadata to execution context
          const metrics = soa.getMetrics();
          context.metadata.soa = {
            name: soa.name,
            totalServices: metrics.totalServices,
            activeServices: metrics.activeServices,
            totalProcessDefinitions: metrics.totalProcessDefinitions,
            activeProcessInstances: metrics.activeProcessInstances,
            pendingTasks: metrics.pendingTasks,
            inProgressTasks: metrics.inProgressTasks,
            overdueTasks: metrics.overdueTasks,
            totalCEPRules: metrics.totalCEPRules,
            eventsProcessed: metrics.eventsProcessed,
            patternsMatched: metrics.patternsMatched,
            totalPartners: metrics.totalPartners,
            totalPolicies: metrics.totalPolicies,
            slaBreaches: metrics.slaBreaches,
            totalProxies: metrics.totalProxies,
            totalAPIs: metrics.totalAPIs,
            publishedAPIs: metrics.publishedAPIs,
            totalKPIs: metrics.totalKPIs,
            activeAlerts: metrics.activeAlerts,
          };
          return context;
        },
      ],

      afterExecute: [
        (context) => {
          // Record rule execution in SOA audit
          if (context.result) {
            soa.security.recordAudit({
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
            soa.monitoring.metrics.incrementCounter('rules.executed', 1, {
              ruleSet: context.ruleSet.name ?? context.ruleSet.id,
            });

            if (context.result.executionTimeMs) {
              soa.monitoring.metrics.recordHistogram(
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
      // ── Registry Functions ────────────────────────
      /** Get a service by ID. */
      soa_getService: (serviceId: string): any => {
        return soa.registry.get(serviceId);
      },

      /** Get total registered services. */
      soa_serviceCount: (): number => {
        return soa.registry.count;
      },

      /** Get active service count. */
      soa_activeServiceCount: (): number => {
        return soa.registry.activeCount;
      },

      /** Check if a service exists. */
      soa_serviceExists: (serviceId: string): boolean => {
        return soa.registry.get(serviceId) !== undefined;
      },

      /** Get healthy endpoints for a service. */
      soa_healthyEndpoints: (serviceId: string): number => {
        return soa.registry.getHealthyEndpoints(serviceId).length;
      },

      // ── BPEL Functions ────────────────────────────
      /** Get process definition count. */
      soa_processCount: (): number => {
        return soa.bpel.processCount;
      },

      /** Get active process instance count. */
      soa_activeProcessCount: (): number => {
        return soa.bpel.activeCount;
      },

      /** Check if a process exists. */
      soa_processExists: (processId: string): boolean => {
        return soa.bpel.getProcess(processId) !== undefined;
      },

      /** Get process instance status. */
      soa_processInstanceStatus: (instanceId: string): string => {
        return soa.bpel.getInstance(instanceId)?.status ?? 'unknown';
      },

      // ── Human Task Functions ──────────────────────
      /** Get pending task count. */
      soa_pendingTaskCount: (): number => {
        return soa.tasks.pendingCount;
      },

      /** Get in-progress task count. */
      soa_inProgressTaskCount: (): number => {
        return soa.tasks.inProgressCount;
      },

      /** Get overdue task count. */
      soa_overdueTaskCount: (): number => {
        return soa.tasks.overdueCount;
      },

      /** Get task status. */
      soa_taskStatus: (taskId: string): string => {
        return soa.tasks.getTask(taskId)?.status ?? 'unknown';
      },

      /** Get tasks for a potential owner. */
      soa_tasksForUser: (userId: string): number => {
        return soa.tasks.getTasksByPotentialOwner(userId).length;
      },

      // ── CEP Functions ─────────────────────────────
      /** Get CEP rule count. */
      soa_cepRuleCount: (): number => {
        return soa.cep.ruleCount;
      },

      /** Get total events processed. */
      soa_eventsProcessed: (): number => {
        return soa.cep.eventsProcessed;
      },

      /** Get total patterns matched. */
      soa_patternsMatched: (): number => {
        return soa.cep.patternsMatched;
      },

      // ── B2B Functions ─────────────────────────────
      /** Get trading partner count. */
      soa_partnerCount: (): number => {
        return soa.b2b.partnerCount;
      },

      /** Get active partner count. */
      soa_activePartnerCount: (): number => {
        return soa.b2b.activePartnerCount;
      },

      /** Get total B2B document exchanges. */
      soa_exchangeCount: (): number => {
        return soa.b2b.exchangeCount;
      },

      // ── Policy Functions ──────────────────────────
      /** Get policy count. */
      soa_policyCount: (): number => {
        return soa.policy.policyCount;
      },

      /** Get SLA count. */
      soa_slaCount: (): number => {
        return soa.policy.slaCount;
      },

      /** Get SLA breach count. */
      soa_slaBreachCount: (): number => {
        return soa.policy.slaBreachCount;
      },

      // ── Mesh Functions ────────────────────────────
      /** Get mesh proxy count. */
      soa_proxyCount: (): number => {
        return soa.mesh.proxyCount;
      },

      /** Get healthy proxy count. */
      soa_healthyProxyCount: (): number => {
        return soa.mesh.healthyCount;
      },

      // ── API Functions ─────────────────────────────
      /** Get API count. */
      soa_apiCount: (): number => {
        return soa.api.apiCount;
      },

      /** Get published API count. */
      soa_publishedAPICount: (): number => {
        return soa.api.publishedCount;
      },

      /** Get total API requests. */
      soa_apiRequestsTotal: (): number => {
        return soa.api.totalRequests;
      },

      /** Get API key count. */
      soa_apiKeyCount: (): number => {
        return soa.api.keyCount;
      },

      // ── BAM Functions ─────────────────────────────
      /** Get KPI count. */
      soa_kpiCount: (): number => {
        return soa.bam.kpiCount;
      },

      /** Get KPI value. */
      soa_kpiValue: (kpiId: string): number => {
        return soa.bam.getKPIValue(kpiId)?.value ?? 0;
      },

      /** Get KPI trend. */
      soa_kpiTrend: (kpiId: string): string => {
        return soa.bam.getKPITrend(kpiId);
      },

      /** Get active alert count. */
      soa_activeAlertCount: (): number => {
        return soa.bam.activeAlertCount + soa.monitoring.alerts.activeCount;
      },

      // ── General Functions ─────────────────────────
      /** Get SOA metrics. */
      soa_getMetrics: (): any => {
        return soa.getMetrics();
      },

      /** Generate a unique ID. */
      soa_generateId: (): string => {
        return generateId();
      },
    },

    // ── Lifecycle ─────────────────────────────────────────
    onRegister: () => {
      soa.security.recordAudit({
        action: 'plugin.registered',
        actor: 'rule-engine',
        resource: 'soa-one-soa',
        resourceType: 'plugin',
        details: { plugin: 'soa-one-soa' },
        success: true,
      });
      soa.monitoring.metrics.incrementCounter('plugin.registered');
    },

    onDestroy: () => {
      soa.security.recordAudit({
        action: 'plugin.destroyed',
        actor: 'rule-engine',
        resource: 'soa-one-soa',
        resourceType: 'plugin',
        details: { plugin: 'soa-one-soa' },
        success: true,
      });
      soa.monitoring.metrics.incrementCounter('plugin.destroyed');
    },
  };
}
