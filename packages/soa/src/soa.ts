// ============================================================
// SOA One SOA — SOASuite (Main Orchestrator)
// ============================================================
//
// The SOASuite is the central orchestrator that ties together
// all SOA subsystems: service registry, BPEL process engine,
// human task management, complex event processing, B2B gateway,
// policy management, service mesh, API gateway, compensation,
// business activity monitoring, monitoring, and security.
//
// Provides a unified API for:
// - Service registration, discovery, and versioned contracts
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
//
// Surpasses Oracle SOA Suite. 100% compatible with
// @soa-one/engine SDK via the SOA plugin.
// ============================================================

import type {
  SOAConfig,
  SOAMetrics,
  SOAEvent,
  SOAEventType,
  SOAEventListener,
  ServiceRegistration,
  BPELProcessDefinition,
  HumanTaskDefinition,
  CEPRule,
  TradingPartner,
  TradingPartnerAgreement,
  PolicyDefinition,
  SLADefinition,
  APIDefinition,
  KPIDefinition,
  SOAAlertRuleDefinition,
  BAMAlertRule,
  SOAAccessPolicy,
  SOAMaskingRule,
} from './types';

import { ServiceRegistry } from './registry';
import { BPELEngine } from './bpel';
import { HumanTaskManager } from './humantask';
import { CEPEngine } from './cep';
import { B2BGateway } from './b2b';
import { PolicyManager } from './policy';
import { ServiceMesh } from './mesh';
import { APIGateway } from './api';
import { CompensationManager } from './compensation';
import { BAMEngine } from './analytics';
import { SOAMonitoringManager } from './monitoring';
import { SOASecurityManager } from './security';

// ── SOASuite ──────────────────────────────────────────────────

/**
 * Central SOA Suite orchestrator.
 *
 * Usage:
 * ```ts
 * const soa = new SOASuite({
 *   name: 'enterprise-soa',
 *   auditEnabled: true,
 *   services: [...],
 *   processes: [...],
 * });
 *
 * await soa.init();
 *
 * // Register a service
 * soa.registry.register({ ... });
 *
 * // Deploy a BPEL process
 * soa.bpel.deployProcess(myProcess);
 *
 * // Start a process instance
 * const instance = await soa.bpel.startProcess('order-process', { orderId: '123' }, 'user');
 *
 * // Create a human task
 * soa.tasks.createTask('approval-task', { documentId: 'doc-1' });
 *
 * // Process CEP events
 * soa.cep.processEvent({ type: 'order.created', ... });
 *
 * // Exchange B2B documents
 * soa.b2b.sendDocument('partner-1', 'agreement-1', 'PO', '<PO>...</PO>', 'xml');
 *
 * // Publish an API
 * soa.api.publishAPI('orders-api');
 *
 * // Integrate with rule engine
 * import { RuleEngine } from '@soa-one/engine';
 * import { createSOAPlugin } from '@soa-one/soa';
 *
 * const engine = new RuleEngine({
 *   plugins: [createSOAPlugin(soa)],
 * });
 *
 * await soa.shutdown();
 * ```
 */
export class SOASuite {
  readonly name: string;
  private readonly _config: SOAConfig;

  // Subsystems
  private readonly _registry: ServiceRegistry;
  private readonly _bpel: BPELEngine;
  private readonly _tasks: HumanTaskManager;
  private readonly _cep: CEPEngine;
  private readonly _b2b: B2BGateway;
  private readonly _policy: PolicyManager;
  private readonly _mesh: ServiceMesh;
  private readonly _api: APIGateway;
  private readonly _compensation: CompensationManager;
  private readonly _bam: BAMEngine;
  private readonly _monitoring: SOAMonitoringManager;
  private readonly _security: SOASecurityManager;

  // Event listeners
  private _eventListeners: Map<string, SOAEventListener[]> = new Map();

  // State
  private _initialized = false;
  private _destroyed = false;
  private _startTime = Date.now();

  constructor(config: SOAConfig) {
    this.name = config.name;
    this._config = config;

    // Initialize subsystems
    this._registry = new ServiceRegistry();
    this._bpel = new BPELEngine();
    this._tasks = new HumanTaskManager();
    this._cep = new CEPEngine();
    this._b2b = new B2BGateway();
    this._policy = new PolicyManager();
    this._mesh = new ServiceMesh();
    this._api = new APIGateway();
    this._compensation = new CompensationManager();
    this._bam = new BAMEngine();
    this._monitoring = new SOAMonitoringManager();
    this._security = new SOASecurityManager();

    // Register configured services
    for (const service of config.services ?? []) {
      this._registry.register(service);
    }

    // Deploy configured processes
    for (const process of config.processes ?? []) {
      this._bpel.deployProcess(process);
    }

    // Register configured task definitions
    for (const taskDef of config.taskDefinitions ?? []) {
      this._tasks.registerDefinition(taskDef);
    }

    // Register configured CEP rules
    for (const rule of config.cepRules ?? []) {
      this._cep.registerRule(rule);
    }

    // Register configured trading partners
    for (const partner of config.partners ?? []) {
      this._b2b.registerPartner(partner);
    }

    // Register configured agreements
    for (const agreement of config.agreements ?? []) {
      this._b2b.registerAgreement(agreement);
    }

    // Register configured policies
    for (const policy of config.policies ?? []) {
      this._policy.registerPolicy(policy);
    }

    // Register configured SLA definitions
    for (const sla of config.slaDefinitions ?? []) {
      this._policy.registerSLA(sla);
    }

    // Register configured APIs
    for (const api of config.apis ?? []) {
      this._api.registerAPI(api);
    }

    // Register configured KPIs
    for (const kpi of config.kpis ?? []) {
      this._bam.registerKPI(kpi);
    }

    // Register configured alert rules
    for (const rule of config.alertRules ?? []) {
      this._monitoring.alerts.registerRule(rule);
    }

    // Register configured BAM alert rules
    for (const rule of config.bamAlertRules ?? []) {
      this._bam.registerAlertRule(rule);
    }

    // Register configured access policies
    for (const policy of config.accessPolicies ?? []) {
      this._security.accessControl.registerPolicy(policy);
    }

    // Register configured masking rules
    for (const rule of config.maskingRules ?? []) {
      this._security.masker.registerRule(rule);
    }

    // ── Wire up subsystem lifecycle events ──────────────────

    // BPEL process events
    this._bpel.onComplete((instance) => {
      this._monitoring.metrics.incrementCounter('process.completed');
      this._emitEvent('process:completed', 'BPELEngine', undefined, instance.instanceId);
    });

    this._bpel.onFaulted((instance) => {
      this._monitoring.metrics.incrementCounter('process.faulted');
      this._emitEvent('process:faulted', 'BPELEngine', undefined, instance.instanceId);
    });

    // Human task events
    this._tasks.onCreated((task) => {
      this._monitoring.metrics.incrementCounter('task.created');
      this._emitEvent('task:created', 'HumanTaskManager');
    });

    this._tasks.onClaimed((task) => {
      this._monitoring.metrics.incrementCounter('task.claimed');
      this._emitEvent('task:claimed', 'HumanTaskManager');
    });

    this._tasks.onCompleted((task) => {
      this._monitoring.metrics.incrementCounter('task.completed');
      this._emitEvent('task:completed', 'HumanTaskManager');
    });

    this._tasks.onDelegated((task) => {
      this._monitoring.metrics.incrementCounter('task.delegated');
      this._emitEvent('task:delegated', 'HumanTaskManager');
    });

    this._tasks.onEscalated((task) => {
      this._monitoring.metrics.incrementCounter('task.escalated');
      this._emitEvent('task:escalated', 'HumanTaskManager');
    });

    // CEP events
    this._cep.onPatternMatch((match) => {
      this._monitoring.metrics.incrementCounter('cep.pattern.matched');
      this._emitEvent('cep:pattern-matched', 'CEPEngine');
    });

    this._cep.onEventProcessed((_event) => {
      this._monitoring.metrics.incrementCounter('cep.event.processed');
    });

    // B2B events
    this._b2b.onDocumentSent((exchange) => {
      this._monitoring.metrics.incrementCounter('b2b.document.sent');
      this._emitEvent('b2b:document-sent', 'B2BGateway');
    });

    this._b2b.onDocumentReceived((exchange) => {
      this._monitoring.metrics.incrementCounter('b2b.document.received');
      this._emitEvent('b2b:document-received', 'B2BGateway');
    });

    this._b2b.onDocumentFailed((exchange) => {
      this._monitoring.metrics.incrementCounter('b2b.document.failed');
      this._emitEvent('b2b:document-failed', 'B2BGateway');
    });

    // Policy events
    this._policy.onPolicyViolated((result) => {
      this._monitoring.metrics.incrementCounter('policy.violated');
      this._emitEvent('policy:violated', 'PolicyManager');
    });

    this._policy.onSLABreached((record) => {
      this._monitoring.metrics.incrementCounter('sla.breached');
      this._emitEvent('sla:breached', 'PolicyManager');
    });

    // Mesh events
    this._mesh.onCircuitOpened((proxyId, upstream) => {
      this._monitoring.metrics.incrementCounter('mesh.circuit.opened');
      this._emitEvent('mesh:circuit-opened', 'ServiceMesh');
    });

    this._mesh.onCircuitClosed((proxyId, upstream) => {
      this._monitoring.metrics.incrementCounter('mesh.circuit.closed');
      this._emitEvent('mesh:circuit-closed', 'ServiceMesh');
    });

    this._mesh.onRateLimited((proxyId) => {
      this._monitoring.metrics.incrementCounter('mesh.rate.limited');
      this._emitEvent('mesh:rate-limited', 'ServiceMesh');
    });

    // API events
    this._api.onPublished((api) => {
      this._monitoring.metrics.incrementCounter('api.published');
      this._emitEvent('api:published', 'APIGateway');
    });

    this._api.onRequestProcessed((record) => {
      this._monitoring.metrics.incrementCounter('api.request.processed');
    });

    // Compensation events
    this._compensation.onCompensationStarted((tx) => {
      this._monitoring.metrics.incrementCounter('compensation.started');
      this._emitEvent('compensation:started', 'CompensationManager');
    });

    this._compensation.onCompensationCompleted((tx) => {
      this._monitoring.metrics.incrementCounter('compensation.completed');
      this._emitEvent('compensation:completed', 'CompensationManager');
    });

    this._compensation.onCompensationFailed((tx) => {
      this._monitoring.metrics.incrementCounter('compensation.failed');
      this._emitEvent('compensation:failed', 'CompensationManager');
    });

    // BAM events
    this._bam.onAlertFired((alert) => {
      this._emitEvent('bam:alert-fired', 'BAMEngine');
    });

    this._bam.onAlertResolved((alert) => {
      this._emitEvent('bam:alert-resolved', 'BAMEngine');
    });

    this._bam.onKPIUpdated((value) => {
      this._emitEvent('bam:kpi-updated', 'BAMEngine');
    });

    // SOA monitoring alerts
    this._monitoring.alerts.onAlert((alert) => {
      this._emitEvent('bam:alert-fired', 'SOAMonitoring', {
        alertId: alert.id,
        ruleName: alert.ruleName,
        severity: alert.severity,
      });
    });

    this._monitoring.alerts.onResolved((alert) => {
      this._emitEvent('bam:alert-resolved', 'SOAMonitoring', {
        alertId: alert.id,
        ruleName: alert.ruleName,
      });
    });
  }

  // ── Lifecycle ───────────────────────────────────────────

  /** Initialize the SOASuite. */
  async init(): Promise<void> {
    if (this._initialized) return;
    if (this._destroyed) {
      throw new Error('Cannot init a destroyed SOASuite. Create a new instance.');
    }

    this._initialized = true;
    this._startTime = Date.now();

    // Audit
    if (this._config.auditEnabled !== false) {
      this._security.recordAudit({
        action: 'soa.started',
        actor: 'system',
        resource: this.name,
        resourceType: 'SOASuite',
        details: {
          services: this._registry.count,
          processes: this._bpel.processCount,
          taskDefinitions: this._tasks.definitionCount,
          cepRules: this._cep.ruleCount,
          partners: this._b2b.partnerCount,
          policies: this._policy.policyCount,
          apis: this._api.apiCount,
          kpis: this._bam.kpiCount,
        },
        success: true,
      });
    }

    this._emitEvent('soa:started', 'SOASuite');
  }

  /** Shut down the SOASuite. */
  async shutdown(): Promise<void> {
    if (this._destroyed) return;

    // Shut down monitoring
    this._monitoring.shutdown();

    // Audit
    if (this._config.auditEnabled !== false) {
      this._security.recordAudit({
        action: 'soa.stopped',
        actor: 'system',
        resource: this.name,
        resourceType: 'SOASuite',
        details: {},
        success: true,
      });
    }

    this._emitEvent('soa:stopped', 'SOASuite');

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

  // ── Subsystem Access ────────────────────────────────────

  /** Access the service registry. */
  get registry(): ServiceRegistry {
    return this._registry;
  }

  /** Access the BPEL process engine. */
  get bpel(): BPELEngine {
    return this._bpel;
  }

  /** Access the human task manager. */
  get tasks(): HumanTaskManager {
    return this._tasks;
  }

  /** Access the complex event processing engine. */
  get cep(): CEPEngine {
    return this._cep;
  }

  /** Access the B2B gateway. */
  get b2b(): B2BGateway {
    return this._b2b;
  }

  /** Access the policy manager. */
  get policy(): PolicyManager {
    return this._policy;
  }

  /** Access the service mesh. */
  get mesh(): ServiceMesh {
    return this._mesh;
  }

  /** Access the API gateway. */
  get api(): APIGateway {
    return this._api;
  }

  /** Access the compensation manager. */
  get compensation(): CompensationManager {
    return this._compensation;
  }

  /** Access the business activity monitoring engine. */
  get bam(): BAMEngine {
    return this._bam;
  }

  /** Access the monitoring manager. */
  get monitoring(): SOAMonitoringManager {
    return this._monitoring;
  }

  /** Access the security manager. */
  get security(): SOASecurityManager {
    return this._security;
  }

  // ── Metrics ─────────────────────────────────────────────

  /** Get a snapshot of SOA metrics. */
  getMetrics(): SOAMetrics {
    return {
      // Registry
      totalServices: this._registry.count,
      activeServices: this._registry.activeCount,
      totalContracts: this._registry.allServices.reduce(
        (sum, s) => sum + s.contracts.length,
        0,
      ),
      totalEndpoints: this._registry.allServices.reduce(
        (sum, s) => sum + s.endpoints.length,
        0,
      ),

      // BPEL
      totalProcessDefinitions: this._bpel.processCount,
      activeProcessInstances: this._bpel.activeCount,
      completedProcessInstances: this._monitoring.metrics.getCounter('process.completed'),
      faultedProcessInstances: this._monitoring.metrics.getCounter('process.faulted'),

      // Human tasks
      totalTaskDefinitions: this._tasks.definitionCount,
      pendingTasks: this._tasks.pendingCount,
      inProgressTasks: this._tasks.inProgressCount,
      completedTasks: this._tasks.completedCount,
      overdueTasks: this._tasks.overdueCount,

      // CEP
      totalCEPRules: this._cep.ruleCount,
      activeCEPRules: this._cep.enabledRuleCount,
      eventsProcessed: this._cep.eventsProcessed,
      patternsMatched: this._cep.patternsMatched,

      // B2B
      totalPartners: this._b2b.partnerCount,
      activePartners: this._b2b.activePartnerCount,
      totalAgreements: this._b2b.agreementCount,
      documentsExchanged: this._b2b.exchangeCount,

      // Policy
      totalPolicies: this._policy.policyCount,
      activePolicies: this._policy.activePolicyCount,
      totalSLAs: this._policy.slaCount,
      slaBreaches: this._policy.slaBreachCount,

      // Mesh
      totalProxies: this._mesh.proxyCount,
      healthyProxies: this._mesh.healthyCount,

      // API Gateway
      totalAPIs: this._api.apiCount,
      publishedAPIs: this._api.publishedCount,
      totalAPIKeys: this._api.keyCount,
      apiRequestsTotal: this._api.totalRequests,

      // Compensation
      activeCompensations: this._compensation.activeCount,
      completedCompensations: this._compensation.compensatedCount,
      failedCompensations: this._compensation.failedCount,

      // BAM
      totalKPIs: this._bam.kpiCount,
      activeAlerts: this._bam.activeAlertCount + this._monitoring.alerts.activeCount,

      // General
      uptimeMs: Date.now() - this._startTime,
      timestamp: new Date().toISOString(),
    };
  }

  // ── Events ──────────────────────────────────────────────

  /** Subscribe to SOA events. */
  on(eventType: SOAEventType, listener: SOAEventListener): void {
    if (!this._eventListeners.has(eventType)) {
      this._eventListeners.set(eventType, []);
    }
    this._eventListeners.get(eventType)!.push(listener);
  }

  /** Unsubscribe from SOA events. */
  off(eventType: SOAEventType, listener: SOAEventListener): void {
    const listeners = this._eventListeners.get(eventType);
    if (listeners) {
      const idx = listeners.indexOf(listener);
      if (idx >= 0) listeners.splice(idx, 1);
    }
  }

  // ── Private ─────────────────────────────────────────────

  private _emitEvent(
    type: SOAEventType,
    source: string,
    data?: Record<string, any>,
    processInstanceId?: string,
  ): void {
    const event: SOAEvent = {
      type,
      timestamp: new Date().toISOString(),
      source,
      data,
      processInstanceId,
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
