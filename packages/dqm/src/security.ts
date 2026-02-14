// ============================================================
// SOA One DQM — Security Layer
// ============================================================

import type {
  DQMAccessPolicy,
  DQMAction,
  DQMAuditEntry,
  DQMMaskingRule,
  DQMMaskingStrategy,
} from './types';

import { generateId } from './profiler';

// ── Data Masker ─────────────────────────────────────────────

/**
 * Applies data masking strategies to protect sensitive data.
 */
export class DQMDataMasker {
  private readonly _rules = new Map<string, DQMMaskingRule>();

  /** Token cache for consistent tokenization. */
  private readonly _tokenCache = new Map<string, string>();

  /** Register a masking rule. */
  registerRule(rule: DQMMaskingRule): void {
    this._rules.set(rule.id, { ...rule });
  }

  /** Unregister a masking rule. */
  unregisterRule(ruleId: string): void {
    this._rules.delete(ruleId);
  }

  /** Get a masking rule. */
  getRule(ruleId: string): DQMMaskingRule | undefined {
    return this._rules.get(ruleId);
  }

  /** Total rule count. */
  get ruleCount(): number {
    return this._rules.size;
  }

  /** List all rules. */
  get rules(): DQMMaskingRule[] {
    return Array.from(this._rules.values());
  }

  /** Apply a masking strategy to a value. */
  mask(
    value: any,
    strategy: DQMMaskingStrategy,
    parameters?: Record<string, any>,
  ): any {
    if (value === null || value === undefined) return value;

    switch (strategy) {
      case 'full':
        return this._fullMask(value);
      case 'partial':
        return this._partialMask(value, parameters);
      case 'hash':
        return this._hashMask(value);
      case 'redact':
        return this._redactMask(value);
      case 'substitute':
        return this._substituteMask(value, parameters);
      case 'shuffle':
        return this._shuffleMask(value);
      case 'noise':
        return this._noiseMask(value, parameters);
      case 'tokenize':
        return this._tokenizeMask(value);
      case 'generalize':
        return this._generalizeMask(value, parameters);
      case 'custom':
        return this._customMask(value, parameters);
      default:
        return value;
    }
  }

  /** Apply all registered rules to a row. */
  maskRow(row: Record<string, any>): Record<string, any> {
    const result = { ...row };

    for (const rule of this._rules.values()) {
      if (!rule.enabled) continue;
      if (!(rule.column in result)) continue;

      result[rule.column] = this.mask(
        result[rule.column],
        rule.strategy,
        rule.parameters,
      );
    }

    return result;
  }

  /** Mask an entire dataset. */
  maskDataset(rows: Record<string, any>[]): Record<string, any>[] {
    return rows.map((row) => this.maskRow(row));
  }

  // ── Private masking implementations ───────────────────────

  /** Replace entire value with '***MASKED***'. */
  private _fullMask(_value: any): string {
    return '***MASKED***';
  }

  /** Show first/last N characters, mask the middle. */
  private _partialMask(value: any, params?: Record<string, any>): string {
    const str = String(value);
    const showFirst = params?.showFirst ?? 0;
    const showLast = params?.showLast ?? 0;
    const maskChar = params?.maskChar ?? '*';

    if (showFirst + showLast >= str.length) return str;

    const prefix = str.substring(0, showFirst);
    const suffix = str.substring(str.length - showLast);
    const middle = maskChar.repeat(str.length - showFirst - showLast);

    return prefix + middle + suffix;
  }

  /** djb2 hash, returned as hex string. */
  private _hashMask(value: any): string {
    const str = String(value);
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) + hash + str.charCodeAt(i)) | 0;
    }
    return (hash >>> 0).toString(16).padStart(8, '0');
  }

  /** Replace with '[REDACTED]'. */
  private _redactMask(_value: any): string {
    return '[REDACTED]';
  }

  /** Replace with a substitute value or a random value of same type/length. */
  private _substituteMask(value: any, params?: Record<string, any>): any {
    if (params?.substituteValue !== undefined) {
      return params.substituteValue;
    }

    // Generate a random value of the same type and length
    if (typeof value === 'number') {
      const magnitude = Math.pow(10, Math.floor(Math.log10(Math.abs(value) || 1)));
      return Math.floor(Math.random() * 9 * magnitude) + magnitude;
    }

    if (typeof value === 'boolean') {
      return Math.random() > 0.5;
    }

    // Default: random string of same length
    const str = String(value);
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < str.length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  /** Shuffle characters randomly. */
  private _shuffleMask(value: any): string {
    const str = String(value);
    const chars = str.split('');
    for (let i = chars.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [chars[i], chars[j]] = [chars[j], chars[i]];
    }
    return chars.join('');
  }

  /** For numbers, add random noise within a percentage range. */
  private _noiseMask(value: any, params?: Record<string, any>): any {
    const num = Number(value);
    if (isNaN(num)) return value;

    const range = params?.range ?? 10;
    const factor = 1 + ((Math.random() * 2 - 1) * range) / 100;
    return Math.round(num * factor * 100) / 100;
  }

  /** Replace with a consistent token (same input produces same token). */
  private _tokenizeMask(value: any): string {
    const str = String(value);
    const cached = this._tokenCache.get(str);
    if (cached) return cached;

    // djb2 hash for deterministic token generation
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) + hash + str.charCodeAt(i)) | 0;
    }
    const token = `TOK-${(hash >>> 0).toString(36).toUpperCase().padStart(8, '0')}`;
    this._tokenCache.set(str, token);
    return token;
  }

  /** Generalize: round numbers or truncate dates. */
  private _generalizeMask(value: any, params?: Record<string, any>): any {
    // Number generalization: round to nearest granularity
    const num = Number(value);
    if (!isNaN(num) && typeof value !== 'boolean') {
      const granularity = params?.granularity ?? 10;
      return Math.round(num / granularity) * granularity;
    }

    // Date generalization: show only year/month
    const date = new Date(value);
    if (!isNaN(date.getTime()) && typeof value === 'string') {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      return `${year}-${month}`;
    }

    return value;
  }

  /** Use a named custom mask function. */
  private _customMask(value: any, params?: Record<string, any>): any {
    if (params?.maskFunction) {
      // Custom mask function name is recorded but value returned as-is
      // (actual function would be resolved by the caller)
      return value;
    }
    return value;
  }
}

// ── Access Control ──────────────────────────────────────────

/**
 * Policy-based access control for DQM resources.
 */
export class DQMAccessControl {
  private readonly _policies = new Map<string, DQMAccessPolicy>();

  /** Register an access policy. */
  registerPolicy(policy: DQMAccessPolicy): void {
    this._policies.set(policy.id, { ...policy });
  }

  /** Unregister a policy. */
  unregisterPolicy(policyId: string): void {
    this._policies.delete(policyId);
  }

  /** Get a policy by id. */
  getPolicy(policyId: string): DQMAccessPolicy | undefined {
    return this._policies.get(policyId);
  }

  /** Total policy count. */
  get policyCount(): number {
    return this._policies.size;
  }

  /** List all policies. */
  get policies(): DQMAccessPolicy[] {
    return Array.from(this._policies.values());
  }

  /** Check if an action is allowed for a principal. */
  checkAccess(
    principal: string,
    action: DQMAction,
    resource?: string,
  ): boolean {
    let allowed = false;

    for (const policy of this._policies.values()) {
      if (!policy.enabled) continue;
      if (!this._matchesPrincipal(principal, policy.principal)) continue;
      if (resource && policy.resources && !this._matchesResource(resource, policy.resources))
        continue;
      if (!policy.actions.includes(action) && !policy.actions.includes('admin:configure' as DQMAction))
        continue;

      if (policy.effect === 'deny') return false;
      if (policy.effect === 'allow') allowed = true;
    }

    return allowed;
  }

  /** Get all allowed actions for a principal. */
  getPermissions(principal: string): DQMAction[] {
    const allowed = new Set<DQMAction>();
    const denied = new Set<DQMAction>();

    for (const policy of this._policies.values()) {
      if (!policy.enabled) continue;
      if (!this._matchesPrincipal(principal, policy.principal)) continue;

      for (const action of policy.actions) {
        if (policy.effect === 'deny') {
          denied.add(action);
        } else {
          allowed.add(action);
        }
      }
    }

    // Remove denied actions from allowed
    for (const action of denied) {
      allowed.delete(action);
    }

    return Array.from(allowed);
  }

  // ── Private ─────────────────────────────────────────────

  private _matchesPrincipal(principal: string, pattern: string): boolean {
    if (pattern === '*') return true;
    if (pattern === principal) return true;
    if (pattern.endsWith('*') && principal.startsWith(pattern.slice(0, -1)))
      return true;
    return false;
  }

  private _matchesResource(resource: string, patterns: string[]): boolean {
    return patterns.some((p) => {
      if (p === '*') return true;
      if (p === resource) return true;
      if (p.endsWith('*') && resource.startsWith(p.slice(0, -1))) return true;
      return false;
    });
  }
}

// ── Audit Logger ────────────────────────────────────────────

/**
 * Audit logging for DQM operations.
 */
export class DQMAuditLogger {
  private readonly _entries: DQMAuditEntry[] = [];
  private readonly _maxEntries: number;

  constructor(maxEntries = 10_000) {
    this._maxEntries = maxEntries;
  }

  /** Log an audit entry. */
  log(entry: Omit<DQMAuditEntry, 'id' | 'timestamp'>): DQMAuditEntry {
    const auditEntry: DQMAuditEntry = {
      ...entry,
      id: generateId(),
      timestamp: new Date().toISOString(),
    };

    this._entries.push(auditEntry);

    // Trim if needed
    if (this._entries.length > this._maxEntries) {
      this._entries.splice(0, this._entries.length - this._maxEntries);
    }

    return auditEntry;
  }

  /** Get all audit entries. */
  get entries(): DQMAuditEntry[] {
    return [...this._entries];
  }

  /** Total audit entry count. */
  get entryCount(): number {
    return this._entries.length;
  }

  /** Query audit entries with filters. */
  query(filter: {
    action?: string;
    actor?: string;
    resource?: string;
    success?: boolean;
    startDate?: string;
    endDate?: string;
  }): DQMAuditEntry[] {
    return this._entries.filter((entry) => {
      if (filter.action && !entry.action.includes(filter.action)) return false;
      if (filter.actor && entry.actor !== filter.actor) return false;
      if (filter.resource && entry.resource !== filter.resource) return false;
      if (filter.success !== undefined && entry.success !== filter.success) return false;
      if (filter.startDate && entry.timestamp < filter.startDate) return false;
      if (filter.endDate && entry.timestamp > filter.endDate) return false;
      return true;
    });
  }

  /** Clear the audit log. */
  clear(): void {
    this._entries.length = 0;
  }
}

// ── Security Manager ────────────────────────────────────────

/**
 * Central security manager integrating masking, access control, and audit.
 */
export class DQMSecurityManager {
  readonly masker: DQMDataMasker;
  readonly accessControl: DQMAccessControl;
  readonly audit: DQMAuditLogger;

  constructor() {
    this.masker = new DQMDataMasker();
    this.accessControl = new DQMAccessControl();
    this.audit = new DQMAuditLogger();
  }

  /** Record an audit entry (convenience). */
  recordAudit(entry: {
    action: string;
    actor: string;
    resource?: string;
    resourceType?: string;
    details?: Record<string, any>;
    success: boolean;
  }): void {
    this.audit.log(entry);
  }
}
