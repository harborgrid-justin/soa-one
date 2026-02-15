// ============================================================
// SOA One — Deployment Manager (Oracle SOA Composite Equivalent)
// ============================================================
//
// SOA composite packaging, deployment descriptors, composite
// versioning, deployment plans, environment-specific config,
// atomic deploy/undeploy/redeploy. Equivalent to Oracle SOA
// Suite composite deployment / SAR / MAR management.
// ============================================================

import { generateId } from './registry';

// ── Types ────────────────────────────────────────────────────

export type CompositeState = 'created' | 'packaged' | 'deploying' | 'deployed' | 'active' | 'suspended' | 'retiring' | 'retired' | 'failed' | 'undeployed';
export type EnvironmentType = 'development' | 'testing' | 'staging' | 'production';
export type ComponentType = 'bpel' | 'humantask' | 'mediator' | 'rule' | 'adapter' | 'service' | 'reference' | 'event';

export interface CompositeDefinition {
  id: string;
  name: string;
  version: string;
  revision: number;
  description?: string;
  state: CompositeState;
  components: CompositeComponent[];
  services: CompositeService[];
  references: CompositeReference[];
  wires: CompositeWire[];
  properties: Record<string, string>;
  deployedAt?: string;
  deployedBy?: string;
  environment?: EnvironmentType;
  checksum?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CompositeComponent {
  name: string;
  type: ComponentType;
  implementation: string;
  properties?: Record<string, string>;
}

export interface CompositeService {
  name: string;
  interface: string;
  binding: string;
  uri?: string;
}

export interface CompositeReference {
  name: string;
  interface: string;
  binding: string;
  uri?: string;
}

export interface CompositeWire {
  source: string;
  target: string;
}

export interface DeploymentPlan {
  id: string;
  name: string;
  compositeId: string;
  environment: EnvironmentType;
  configOverrides: Record<string, string>;
  resourceMappings: ResourceMapping[];
  preDeployActions: DeployAction[];
  postDeployActions: DeployAction[];
  rollbackOnFailure: boolean;
  healthCheckUrl?: string;
  healthCheckTimeoutMs?: number;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ResourceMapping {
  source: string;
  target: string;
  type: 'datasource' | 'jms' | 'credential' | 'endpoint' | 'custom';
}

export interface DeployAction {
  name: string;
  type: 'script' | 'http' | 'wait' | 'validate';
  config: Record<string, any>;
  continueOnFailure: boolean;
}

export interface DeploymentRecord {
  id: string;
  compositeId: string;
  planId?: string;
  environment: EnvironmentType;
  action: 'deploy' | 'undeploy' | 'redeploy' | 'suspend' | 'resume' | 'retire';
  status: 'pending' | 'in-progress' | 'completed' | 'failed' | 'rolled-back';
  performedBy: string;
  startedAt: string;
  completedAt?: string;
  duration?: number;
  logs: DeploymentLog[];
  errorMessage?: string;
}

export interface DeploymentLog {
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  message: string;
}

export interface EnvironmentConfig {
  id: string;
  name: string;
  type: EnvironmentType;
  variables: Record<string, string>;
  endpoints: Record<string, string>;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

// ── DeploymentManager ────────────────────────────────────────

export class DeploymentManager {
  private _composites = new Map<string, CompositeDefinition>();
  private _plans = new Map<string, DeploymentPlan>();
  private _records: DeploymentRecord[] = [];
  private _environments = new Map<string, EnvironmentConfig>();
  private _onDeployed: ((r: DeploymentRecord) => void) | null = null;
  private _onFailed: ((r: DeploymentRecord) => void) | null = null;

  // ── Composites ──

  createComposite(composite: Omit<CompositeDefinition, 'id' | 'state' | 'revision' | 'createdAt' | 'updatedAt'>): CompositeDefinition {
    const now = new Date().toISOString();
    const c: CompositeDefinition = {
      ...composite,
      id: generateId(),
      state: 'created',
      revision: 1,
      createdAt: now,
      updatedAt: now,
    };
    this._composites.set(c.id, c);
    return c;
  }

  getComposite(id: string): CompositeDefinition | undefined {
    return this._composites.get(id);
  }

  getCompositeByName(name: string, version?: string): CompositeDefinition | undefined {
    for (const c of this._composites.values()) {
      if (c.name === name && (!version || c.version === version)) return c;
    }
    return undefined;
  }

  updateComposite(id: string, updates: Partial<CompositeDefinition>): CompositeDefinition {
    const c = this._composites.get(id);
    if (!c) throw new Error(`Composite not found: ${id}`);
    Object.assign(c, updates, { updatedAt: new Date().toISOString() });
    return c;
  }

  removeComposite(id: string): boolean {
    return this._composites.delete(id);
  }

  get allComposites(): CompositeDefinition[] {
    return [...this._composites.values()];
  }

  getCompositesByState(state: CompositeState): CompositeDefinition[] {
    return [...this._composites.values()].filter(c => c.state === state);
  }

  getCompositesByEnvironment(env: EnvironmentType): CompositeDefinition[] {
    return [...this._composites.values()].filter(c => c.environment === env);
  }

  // ── Deploy/Undeploy Operations ──

  deploy(compositeId: string, environment: EnvironmentType, performedBy: string, planId?: string): DeploymentRecord {
    const composite = this._composites.get(compositeId);
    if (!composite) throw new Error(`Composite not found: ${compositeId}`);

    const now = new Date().toISOString();
    const record: DeploymentRecord = {
      id: generateId(),
      compositeId,
      planId,
      environment,
      action: 'deploy',
      status: 'completed',
      performedBy,
      startedAt: now,
      completedAt: now,
      duration: 0,
      logs: [
        { timestamp: now, level: 'info', message: `Deploying composite '${composite.name}' v${composite.version} to ${environment}` },
        { timestamp: now, level: 'info', message: 'Deployment completed successfully' },
      ],
    };

    composite.state = 'active';
    composite.environment = environment;
    composite.deployedAt = now;
    composite.deployedBy = performedBy;
    composite.updatedAt = now;

    this._records.push(record);
    this._onDeployed?.(record);
    return record;
  }

  undeploy(compositeId: string, performedBy: string): DeploymentRecord {
    const composite = this._composites.get(compositeId);
    if (!composite) throw new Error(`Composite not found: ${compositeId}`);

    const now = new Date().toISOString();
    const record: DeploymentRecord = {
      id: generateId(),
      compositeId,
      environment: composite.environment ?? 'development',
      action: 'undeploy',
      status: 'completed',
      performedBy,
      startedAt: now,
      completedAt: now,
      duration: 0,
      logs: [
        { timestamp: now, level: 'info', message: `Undeploying composite '${composite.name}'` },
        { timestamp: now, level: 'info', message: 'Undeployment completed' },
      ],
    };

    composite.state = 'undeployed';
    composite.updatedAt = now;

    this._records.push(record);
    return record;
  }

  redeploy(compositeId: string, performedBy: string): DeploymentRecord {
    const composite = this._composites.get(compositeId);
    if (!composite) throw new Error(`Composite not found: ${compositeId}`);

    const now = new Date().toISOString();
    composite.revision++;
    composite.state = 'active';
    composite.deployedAt = now;
    composite.deployedBy = performedBy;
    composite.updatedAt = now;

    const record: DeploymentRecord = {
      id: generateId(),
      compositeId,
      environment: composite.environment ?? 'development',
      action: 'redeploy',
      status: 'completed',
      performedBy,
      startedAt: now,
      completedAt: now,
      duration: 0,
      logs: [
        { timestamp: now, level: 'info', message: `Redeploying composite '${composite.name}' rev ${composite.revision}` },
        { timestamp: now, level: 'info', message: 'Redeployment completed' },
      ],
    };

    this._records.push(record);
    this._onDeployed?.(record);
    return record;
  }

  suspend(compositeId: string, performedBy: string): DeploymentRecord {
    const composite = this._composites.get(compositeId);
    if (!composite) throw new Error(`Composite not found: ${compositeId}`);

    const now = new Date().toISOString();
    composite.state = 'suspended';
    composite.updatedAt = now;

    const record: DeploymentRecord = {
      id: generateId(),
      compositeId,
      environment: composite.environment ?? 'development',
      action: 'suspend',
      status: 'completed',
      performedBy,
      startedAt: now,
      completedAt: now,
      duration: 0,
      logs: [{ timestamp: now, level: 'info', message: `Suspended composite '${composite.name}'` }],
    };

    this._records.push(record);
    return record;
  }

  resume(compositeId: string, performedBy: string): DeploymentRecord {
    const composite = this._composites.get(compositeId);
    if (!composite) throw new Error(`Composite not found: ${compositeId}`);

    const now = new Date().toISOString();
    composite.state = 'active';
    composite.updatedAt = now;

    const record: DeploymentRecord = {
      id: generateId(),
      compositeId,
      environment: composite.environment ?? 'development',
      action: 'resume',
      status: 'completed',
      performedBy,
      startedAt: now,
      completedAt: now,
      duration: 0,
      logs: [{ timestamp: now, level: 'info', message: `Resumed composite '${composite.name}'` }],
    };

    this._records.push(record);
    return record;
  }

  retire(compositeId: string, performedBy: string): DeploymentRecord {
    const composite = this._composites.get(compositeId);
    if (!composite) throw new Error(`Composite not found: ${compositeId}`);

    const now = new Date().toISOString();
    composite.state = 'retired';
    composite.updatedAt = now;

    const record: DeploymentRecord = {
      id: generateId(),
      compositeId,
      environment: composite.environment ?? 'development',
      action: 'retire',
      status: 'completed',
      performedBy,
      startedAt: now,
      completedAt: now,
      duration: 0,
      logs: [{ timestamp: now, level: 'info', message: `Retired composite '${composite.name}'` }],
    };

    this._records.push(record);
    return record;
  }

  // ── Deployment Plans ──

  createPlan(plan: Omit<DeploymentPlan, 'id' | 'createdAt' | 'updatedAt'>): DeploymentPlan {
    const now = new Date().toISOString();
    const p: DeploymentPlan = { ...plan, id: generateId(), createdAt: now, updatedAt: now };
    this._plans.set(p.id, p);
    return p;
  }

  getPlan(id: string): DeploymentPlan | undefined {
    return this._plans.get(id);
  }

  updatePlan(id: string, updates: Partial<DeploymentPlan>): DeploymentPlan {
    const p = this._plans.get(id);
    if (!p) throw new Error(`Plan not found: ${id}`);
    Object.assign(p, updates, { updatedAt: new Date().toISOString() });
    return p;
  }

  removePlan(id: string): boolean {
    return this._plans.delete(id);
  }

  getPlansByComposite(compositeId: string): DeploymentPlan[] {
    return [...this._plans.values()].filter(p => p.compositeId === compositeId);
  }

  get allPlans(): DeploymentPlan[] {
    return [...this._plans.values()];
  }

  // ── Deployment Records ──

  getRecord(id: string): DeploymentRecord | undefined {
    return this._records.find(r => r.id === id);
  }

  getRecordsByComposite(compositeId: string): DeploymentRecord[] {
    return this._records.filter(r => r.compositeId === compositeId);
  }

  getRecordsByEnvironment(env: EnvironmentType): DeploymentRecord[] {
    return this._records.filter(r => r.environment === env);
  }

  get allRecords(): DeploymentRecord[] {
    return [...this._records];
  }

  // ── Environments ──

  createEnvironment(env: Omit<EnvironmentConfig, 'id' | 'createdAt' | 'updatedAt'>): EnvironmentConfig {
    const now = new Date().toISOString();
    const e: EnvironmentConfig = { ...env, id: generateId(), createdAt: now, updatedAt: now };
    this._environments.set(e.id, e);
    return e;
  }

  getEnvironment(id: string): EnvironmentConfig | undefined {
    return this._environments.get(id);
  }

  getEnvironmentByName(name: string): EnvironmentConfig | undefined {
    for (const e of this._environments.values()) {
      if (e.name === name) return e;
    }
    return undefined;
  }

  updateEnvironment(id: string, updates: Partial<EnvironmentConfig>): EnvironmentConfig {
    const e = this._environments.get(id);
    if (!e) throw new Error(`Environment not found: ${id}`);
    Object.assign(e, updates, { updatedAt: new Date().toISOString() });
    return e;
  }

  removeEnvironment(id: string): boolean {
    return this._environments.delete(id);
  }

  get allEnvironments(): EnvironmentConfig[] {
    return [...this._environments.values()];
  }

  // ── Stats ──

  getStats(): {
    composites: number;
    activeComposites: number;
    plans: number;
    deployments: number;
    environments: number;
    byState: Record<string, number>;
  } {
    const composites = [...this._composites.values()];
    const byState: Record<string, number> = {};
    for (const c of composites) {
      byState[c.state] = (byState[c.state] ?? 0) + 1;
    }
    return {
      composites: composites.length,
      activeComposites: composites.filter(c => c.state === 'active').length,
      plans: this._plans.size,
      deployments: this._records.length,
      environments: this._environments.size,
      byState,
    };
  }

  // ── Events ──

  onDeployed(cb: (r: DeploymentRecord) => void): void { this._onDeployed = cb; }
  onFailed(cb: (r: DeploymentRecord) => void): void { this._onFailed = cb; }
}
