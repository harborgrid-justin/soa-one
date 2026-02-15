// ============================================================
// SOA One ESB — Adapter Framework (JCA-style)
// ============================================================
//
// Oracle SOA Suite JCA Adapter Framework equivalent. Provides
// a pluggable adapter architecture for connecting to external
// systems (Database, File, FTP, JMS, REST, SOAP, etc.) with
// connection pooling, error handling, and lifecycle management.
// ============================================================

import { generateId } from './channel';

// ── Types ────────────────────────────────────────────────────

export type AdapterType = 'database' | 'file' | 'ftp' | 'jms' | 'rest' | 'soap' | 'ldap' | 'email' | 'mq' | 'kafka' | 'custom';
export type AdapterDirection = 'inbound' | 'outbound' | 'bidirectional';
export type AdapterState = 'created' | 'configured' | 'connected' | 'active' | 'paused' | 'error' | 'disconnected';

export interface AdapterDefinition {
  id: string;
  name: string;
  type: AdapterType;
  direction: AdapterDirection;
  state: AdapterState;
  connectionProperties: Record<string, any>;
  operationProperties: Record<string, any>;
  endpointUri?: string;
  poolConfig?: ConnectionPoolConfig;
  retryConfig?: AdapterRetryConfig;
  errorHandler?: AdapterErrorHandler;
  createdAt: string;
  updatedAt: string;
}

export interface ConnectionPoolConfig {
  minConnections: number;
  maxConnections: number;
  idleTimeoutMs: number;
  acquireTimeoutMs: number;
  testOnBorrow: boolean;
}

export interface AdapterRetryConfig {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  retryableErrors: string[];
}

export interface AdapterErrorHandler {
  strategy: 'reject' | 'retry' | 'redirect' | 'ignore';
  deadLetterEndpoint?: string;
  notifyOnError: boolean;
}

export interface AdapterOperation {
  id: string;
  adapterId: string;
  name: string;
  type: 'read' | 'write' | 'poll' | 'subscribe' | 'invoke';
  config: Record<string, any>;
  enabled: boolean;
  createdAt: string;
}

export interface AdapterEndpoint {
  id: string;
  adapterId: string;
  uri: string;
  bindingType: string;
  properties: Record<string, any>;
  active: boolean;
}

export interface AdapterMetrics {
  adapterId: string;
  messagesIn: number;
  messagesOut: number;
  errors: number;
  avgResponseTimeMs: number;
  activeConnections: number;
  upSince?: string;
}

// ── AdapterFramework ─────────────────────────────────────────

export class AdapterFramework {
  private _adapters = new Map<string, AdapterDefinition>();
  private _operations = new Map<string, AdapterOperation>();
  private _endpoints = new Map<string, AdapterEndpoint>();
  private _metrics = new Map<string, AdapterMetrics>();
  private _onStateChange: ((a: AdapterDefinition, prev: AdapterState) => void) | null = null;
  private _onError: ((a: AdapterDefinition, err: string) => void) | null = null;

  // ── Adapters ──

  registerAdapter(adapter: Omit<AdapterDefinition, 'id' | 'state' | 'createdAt' | 'updatedAt'>): AdapterDefinition {
    const now = new Date().toISOString();
    const a: AdapterDefinition = { ...adapter, id: generateId(), state: 'created', createdAt: now, updatedAt: now };
    this._adapters.set(a.id, a);
    this._metrics.set(a.id, {
      adapterId: a.id,
      messagesIn: 0,
      messagesOut: 0,
      errors: 0,
      avgResponseTimeMs: 0,
      activeConnections: 0,
    });
    return a;
  }

  getAdapter(id: string): AdapterDefinition | undefined {
    return this._adapters.get(id);
  }

  getAdaptersByType(type: AdapterType): AdapterDefinition[] {
    return [...this._adapters.values()].filter(a => a.type === type);
  }

  updateAdapter(id: string, updates: Partial<AdapterDefinition>): AdapterDefinition {
    const a = this._adapters.get(id);
    if (!a) throw new Error(`Adapter not found: ${id}`);
    Object.assign(a, updates, { updatedAt: new Date().toISOString() });
    return a;
  }

  removeAdapter(id: string): boolean {
    this._metrics.delete(id);
    return this._adapters.delete(id);
  }

  get allAdapters(): AdapterDefinition[] {
    return [...this._adapters.values()];
  }

  // ── Lifecycle ──

  connect(id: string): void {
    const a = this._adapters.get(id);
    if (!a) throw new Error(`Adapter not found: ${id}`);
    const prev = a.state;
    a.state = 'connected';
    a.updatedAt = new Date().toISOString();
    const m = this._metrics.get(id);
    if (m) m.upSince = a.updatedAt;
    this._onStateChange?.(a, prev);
  }

  activate(id: string): void {
    const a = this._adapters.get(id);
    if (!a) throw new Error(`Adapter not found: ${id}`);
    if (a.state !== 'connected' && a.state !== 'paused') {
      throw new Error(`Cannot activate adapter in state: ${a.state}`);
    }
    const prev = a.state;
    a.state = 'active';
    a.updatedAt = new Date().toISOString();
    this._onStateChange?.(a, prev);
  }

  pause(id: string): void {
    const a = this._adapters.get(id);
    if (!a) throw new Error(`Adapter not found: ${id}`);
    const prev = a.state;
    a.state = 'paused';
    a.updatedAt = new Date().toISOString();
    this._onStateChange?.(a, prev);
  }

  disconnect(id: string): void {
    const a = this._adapters.get(id);
    if (!a) throw new Error(`Adapter not found: ${id}`);
    const prev = a.state;
    a.state = 'disconnected';
    a.updatedAt = new Date().toISOString();
    this._onStateChange?.(a, prev);
  }

  setError(id: string, message: string): void {
    const a = this._adapters.get(id);
    if (!a) throw new Error(`Adapter not found: ${id}`);
    const prev = a.state;
    a.state = 'error';
    a.updatedAt = new Date().toISOString();
    const m = this._metrics.get(id);
    if (m) m.errors++;
    this._onStateChange?.(a, prev);
    this._onError?.(a, message);
  }

  testConnection(id: string): { success: boolean; latencyMs: number; message?: string } {
    const a = this._adapters.get(id);
    if (!a) throw new Error(`Adapter not found: ${id}`);
    // In-memory simulation: always succeeds
    return { success: true, latencyMs: Math.random() * 50 };
  }

  // ── Operations ──

  addOperation(op: Omit<AdapterOperation, 'id' | 'createdAt'>): AdapterOperation {
    if (!this._adapters.has(op.adapterId)) throw new Error(`Adapter not found: ${op.adapterId}`);
    const o: AdapterOperation = { ...op, id: generateId(), createdAt: new Date().toISOString() };
    this._operations.set(o.id, o);
    return o;
  }

  getOperation(id: string): AdapterOperation | undefined {
    return this._operations.get(id);
  }

  getOperationsByAdapter(adapterId: string): AdapterOperation[] {
    return [...this._operations.values()].filter(o => o.adapterId === adapterId);
  }

  updateOperation(id: string, updates: Partial<AdapterOperation>): AdapterOperation {
    const o = this._operations.get(id);
    if (!o) throw new Error(`Operation not found: ${id}`);
    Object.assign(o, updates);
    return o;
  }

  removeOperation(id: string): boolean {
    return this._operations.delete(id);
  }

  // ── Endpoints ──

  addEndpoint(ep: Omit<AdapterEndpoint, 'id'>): AdapterEndpoint {
    if (!this._adapters.has(ep.adapterId)) throw new Error(`Adapter not found: ${ep.adapterId}`);
    const e: AdapterEndpoint = { ...ep, id: generateId() };
    this._endpoints.set(e.id, e);
    return e;
  }

  getEndpoint(id: string): AdapterEndpoint | undefined {
    return this._endpoints.get(id);
  }

  getEndpointsByAdapter(adapterId: string): AdapterEndpoint[] {
    return [...this._endpoints.values()].filter(e => e.adapterId === adapterId);
  }

  updateEndpoint(id: string, updates: Partial<AdapterEndpoint>): AdapterEndpoint {
    const e = this._endpoints.get(id);
    if (!e) throw new Error(`Endpoint not found: ${id}`);
    Object.assign(e, updates);
    return e;
  }

  removeEndpoint(id: string): boolean {
    return this._endpoints.delete(id);
  }

  // ── Metrics ──

  getMetrics(adapterId: string): AdapterMetrics | undefined {
    return this._metrics.get(adapterId);
  }

  get allMetrics(): AdapterMetrics[] {
    return [...this._metrics.values()];
  }

  recordMessage(adapterId: string, direction: 'in' | 'out', responseTimeMs: number): void {
    const m = this._metrics.get(adapterId);
    if (!m) return;
    if (direction === 'in') {
      m.messagesIn++;
    } else {
      m.messagesOut++;
    }
    // Running average
    const total = m.messagesIn + m.messagesOut;
    m.avgResponseTimeMs = ((m.avgResponseTimeMs * (total - 1)) + responseTimeMs) / total;
  }

  // ── Stats ──

  getStats(): {
    adapters: number;
    active: number;
    operations: number;
    endpoints: number;
    totalMessages: number;
    totalErrors: number;
  } {
    const adapters = [...this._adapters.values()];
    const metrics = [...this._metrics.values()];
    return {
      adapters: adapters.length,
      active: adapters.filter(a => a.state === 'active').length,
      operations: this._operations.size,
      endpoints: this._endpoints.size,
      totalMessages: metrics.reduce((s, m) => s + m.messagesIn + m.messagesOut, 0),
      totalErrors: metrics.reduce((s, m) => s + m.errors, 0),
    };
  }

  // ── Events ──

  onStateChange(cb: (a: AdapterDefinition, prev: AdapterState) => void): void { this._onStateChange = cb; }
  onError(cb: (a: AdapterDefinition, err: string) => void): void { this._onError = cb; }
}
