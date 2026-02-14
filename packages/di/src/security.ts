// ============================================================
// SOA One DI — Security Manager
// ============================================================
//
// Data masking, encryption, access control, and audit logging.
//
// Features beyond Oracle Data Integrator:
// - 12+ masking strategies (full, partial, hash, tokenize,
//   encrypt, redact, substitute, shuffle, null, date-shift,
//   number-variance, format-preserving)
// - Column-level masking rules
// - Policy-based access control for all DI resources
// - Comprehensive audit logging
// - Data classification enforcement
// - Deterministic masking for referential integrity
// - Encryption at rest and in transit
// - Key management integration points
//
// Zero external dependencies.
// ============================================================

import type {
  MaskingRule,
  MaskingStrategy,
  EncryptionConfig,
  DIAccessPolicy,
  DIAction,
  DIAuditEntry,
} from './types';

import { generateId } from './connector';

// ── Data Masker ─────────────────────────────────────────────

/**
 * Applies data masking rules to protect sensitive data.
 */
export class DataMasker {
  private readonly _rules = new Map<string, MaskingRule>();

  /** Register a masking rule. */
  registerRule(rule: MaskingRule): void {
    this._rules.set(rule.id, { ...rule });
  }

  /** Unregister a masking rule. */
  unregisterRule(ruleId: string): void {
    this._rules.delete(ruleId);
  }

  /** Get a masking rule. */
  getRule(ruleId: string): MaskingRule | undefined {
    return this._rules.get(ruleId);
  }

  /** List all rules. */
  listRules(): MaskingRule[] {
    return Array.from(this._rules.values());
  }

  /** Apply masking rules to a single row. */
  maskRow(row: Record<string, any>, table?: string): Record<string, any> {
    const result = { ...row };

    for (const rule of this._rules.values()) {
      if (!rule.enabled) continue;
      if (rule.table && rule.table !== table) continue;
      if (!(rule.column in result)) continue;

      result[rule.column] = this._applyMask(result[rule.column], rule);
    }

    return result;
  }

  /** Apply masking rules to multiple rows. */
  maskRows(
    rows: Record<string, any>[],
    table?: string,
  ): Record<string, any>[] {
    return rows.map((row) => this.maskRow(row, table));
  }

  /** Apply a specific masking strategy to a value. */
  mask(value: any, strategy: MaskingStrategy, params?: Record<string, any>): any {
    const rule: MaskingRule = {
      id: 'inline',
      name: 'inline',
      column: '',
      strategy,
      parameters: params,
      enabled: true,
    };
    return this._applyMask(value, rule);
  }

  /** Total rules count. */
  get ruleCount(): number {
    return this._rules.size;
  }

  // ── Private ─────────────────────────────────────────────

  private _applyMask(value: any, rule: MaskingRule): any {
    if (value === null || value === undefined) return value;

    switch (rule.strategy) {
      case 'full':
        return this._maskFull(value, rule);
      case 'partial':
        return this._maskPartial(value, rule);
      case 'hash':
        return this._maskHash(value, rule);
      case 'tokenize':
        return this._maskTokenize(value, rule);
      case 'encrypt':
        return this._maskEncrypt(value, rule);
      case 'redact':
        return '[REDACTED]';
      case 'substitute':
        return this._maskSubstitute(value, rule);
      case 'shuffle':
        return this._maskShuffle(value, rule);
      case 'null':
        return null;
      case 'date-shift':
        return this._maskDateShift(value, rule);
      case 'number-variance':
        return this._maskNumberVariance(value, rule);
      case 'format-preserving':
        return this._maskFormatPreserving(value, rule);
      case 'custom':
        return value; // Custom handlers would be registered separately
      default:
        return value;
    }
  }

  private _maskFull(value: any, rule: MaskingRule): string {
    const str = String(value);
    const char = rule.maskCharacter ?? '*';
    return char.repeat(str.length);
  }

  private _maskPartial(value: any, rule: MaskingRule): string {
    const str = String(value);
    const char = rule.maskCharacter ?? '*';
    const visible = rule.visibleChars ?? 4;
    const position = rule.visiblePosition ?? 'end';

    if (visible >= str.length) return str;

    if (position === 'start') {
      return str.substring(0, visible) + char.repeat(str.length - visible);
    } else {
      return char.repeat(str.length - visible) + str.substring(str.length - visible);
    }
  }

  private _maskHash(value: any, rule: MaskingRule): string {
    const str = String(value);
    // Deterministic hash for referential integrity
    let hash = 0;
    const key = rule.deterministicKey ?? 'default';
    const combined = str + key;
    for (let i = 0; i < combined.length; i++) {
      hash = ((hash << 5) - hash + combined.charCodeAt(i)) | 0;
    }
    return Math.abs(hash).toString(16).padStart(8, '0');
  }

  private _maskTokenize(value: any, rule: MaskingRule): string {
    const str = String(value);
    const prefix = rule.parameters?.prefix ?? 'TOK';
    // Deterministic token
    let hash = 0;
    const key = rule.deterministicKey ?? 'default';
    const combined = str + key;
    for (let i = 0; i < combined.length; i++) {
      hash = ((hash << 5) - hash + combined.charCodeAt(i)) | 0;
    }
    return `${prefix}-${Math.abs(hash).toString(36).toUpperCase().padStart(8, '0')}`;
  }

  private _maskEncrypt(value: any, rule: MaskingRule): string {
    const str = String(value);
    const key = rule.deterministicKey ?? rule.parameters?.key ?? 'encrypt-key';
    // Simple XOR cipher (zero-dependency)
    let result = '';
    for (let i = 0; i < str.length; i++) {
      result += String.fromCharCode(
        str.charCodeAt(i) ^ key.charCodeAt(i % key.length),
      );
    }
    // Base64-encode for safety
    try {
      return Buffer.from(result).toString('base64');
    } catch {
      return result;
    }
  }

  private _maskSubstitute(value: any, rule: MaskingRule): any {
    const substitutions = rule.parameters?.substitutions as
      | Record<string, any>
      | undefined;
    if (substitutions && String(value) in substitutions) {
      return substitutions[String(value)];
    }
    return rule.parameters?.defaultSubstitution ?? value;
  }

  private _maskShuffle(value: any, _rule: MaskingRule): string {
    const str = String(value);
    const chars = str.split('');
    // Deterministic shuffle using value as seed
    let seed = 0;
    for (let i = 0; i < str.length; i++) {
      seed = ((seed << 5) - seed + str.charCodeAt(i)) | 0;
    }
    for (let i = chars.length - 1; i > 0; i--) {
      seed = ((seed * 1103515245 + 12345) & 0x7fffffff);
      const j = seed % (i + 1);
      [chars[i], chars[j]] = [chars[j], chars[i]];
    }
    return chars.join('');
  }

  private _maskDateShift(value: any, rule: MaskingRule): string {
    try {
      const date = new Date(value);
      if (isNaN(date.getTime())) return String(value);

      const maxShiftDays = rule.parameters?.maxShiftDays ?? 30;
      // Deterministic shift based on value
      let seed = 0;
      const str = String(value);
      for (let i = 0; i < str.length; i++) {
        seed = ((seed << 5) - seed + str.charCodeAt(i)) | 0;
      }
      const shiftDays = (Math.abs(seed) % (maxShiftDays * 2)) - maxShiftDays;
      date.setDate(date.getDate() + shiftDays);
      return date.toISOString();
    } catch {
      return String(value);
    }
  }

  private _maskNumberVariance(value: any, rule: MaskingRule): number {
    const num = Number(value);
    if (isNaN(num)) return 0;

    const variancePercent = rule.parameters?.variancePercent ?? 10;
    // Deterministic variance
    let seed = 0;
    const str = String(value);
    for (let i = 0; i < str.length; i++) {
      seed = ((seed << 5) - seed + str.charCodeAt(i)) | 0;
    }
    const factor = 1 + ((Math.abs(seed) % (variancePercent * 2)) - variancePercent) / 100;
    return Math.round(num * factor * 100) / 100;
  }

  private _maskFormatPreserving(value: any, rule: MaskingRule): string {
    const str = String(value);
    const char = rule.maskCharacter ?? '*';
    let result = '';
    let seed = 0;
    const key = rule.deterministicKey ?? 'fp';
    const combined = str + key;
    for (let i = 0; i < combined.length; i++) {
      seed = ((seed << 5) - seed + combined.charCodeAt(i)) | 0;
    }

    for (let i = 0; i < str.length; i++) {
      const c = str[i];
      if (/[A-Z]/.test(c)) {
        result += String.fromCharCode(65 + (Math.abs(seed + i) % 26));
      } else if (/[a-z]/.test(c)) {
        result += String.fromCharCode(97 + (Math.abs(seed + i) % 26));
      } else if (/[0-9]/.test(c)) {
        result += String(Math.abs(seed + i) % 10);
      } else {
        result += c; // Preserve format characters
      }
    }
    return result;
  }
}

// ── Access Control ──────────────────────────────────────────

/**
 * Policy-based access control for data integration resources.
 */
export class DIAccessControl {
  private readonly _policies = new Map<string, DIAccessPolicy>();

  /** Register an access policy. */
  registerPolicy(policy: DIAccessPolicy): void {
    this._policies.set(policy.id, { ...policy });
  }

  /** Unregister a policy. */
  unregisterPolicy(policyId: string): void {
    this._policies.delete(policyId);
  }

  /** Check if an action is allowed. */
  checkAccess(
    principal: string,
    resource: string,
    action: DIAction,
  ): boolean {
    let allowed = false;

    for (const policy of this._policies.values()) {
      if (!this._matchesPrincipal(principal, policy.principals)) continue;
      if (!this._matchesResource(resource, policy.resources)) continue;
      if (!policy.actions.includes(action) && !policy.actions.includes('admin' as DIAction))
        continue;

      if (policy.effect === 'deny') return false;
      if (policy.effect === 'allow') allowed = true;
    }

    return allowed;
  }

  /** Get policies for a principal. */
  getPoliciesForPrincipal(principal: string): DIAccessPolicy[] {
    return Array.from(this._policies.values()).filter((p) =>
      this._matchesPrincipal(principal, p.principals),
    );
  }

  /** List all policies. */
  listPolicies(): DIAccessPolicy[] {
    return Array.from(this._policies.values());
  }

  /** Total policy count. */
  get policyCount(): number {
    return this._policies.size;
  }

  // ── Private ─────────────────────────────────────────────

  private _matchesPrincipal(principal: string, patterns: string[]): boolean {
    return patterns.some((p) => {
      if (p === '*') return true;
      if (p === principal) return true;
      if (p.endsWith('*') && principal.startsWith(p.slice(0, -1))) return true;
      return false;
    });
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
 * Audit logging for all data integration operations.
 */
export class DIAuditLogger {
  private readonly _entries: DIAuditEntry[] = [];
  private readonly _maxEntries: number;

  constructor(maxEntries = 100_000) {
    this._maxEntries = maxEntries;
  }

  /** Record an audit entry. */
  recordAudit(entry: Omit<DIAuditEntry, 'id' | 'timestamp'>): DIAuditEntry {
    const auditEntry: DIAuditEntry = {
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

  /** Get the audit log. */
  getAuditLog(limit?: number): DIAuditEntry[] {
    if (limit) {
      return this._entries.slice(-limit);
    }
    return [...this._entries];
  }

  /** Search audit log. */
  searchAuditLog(filters: {
    action?: string;
    actor?: string;
    resource?: string;
    success?: boolean;
    from?: string;
    to?: string;
  }): DIAuditEntry[] {
    return this._entries.filter((entry) => {
      if (filters.action && !entry.action.includes(filters.action)) return false;
      if (filters.actor && entry.actor !== filters.actor) return false;
      if (filters.resource && entry.resource !== filters.resource) return false;
      if (filters.success !== undefined && entry.success !== filters.success) return false;
      if (filters.from && entry.timestamp < filters.from) return false;
      if (filters.to && entry.timestamp > filters.to) return false;
      return true;
    });
  }

  /** Total audit entries. */
  get count(): number {
    return this._entries.length;
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
export class SecurityManager {
  readonly masker: DataMasker;
  readonly accessControl: DIAccessControl;
  readonly audit: DIAuditLogger;

  constructor() {
    this.masker = new DataMasker();
    this.accessControl = new DIAccessControl();
    this.audit = new DIAuditLogger();
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
    this.audit.recordAudit(entry);
  }

  /** Check access and record audit. */
  checkAndAudit(
    principal: string,
    resource: string,
    action: DIAction,
  ): boolean {
    const allowed = this.accessControl.checkAccess(principal, resource, action);
    this.audit.recordAudit({
      action: action,
      actor: principal,
      resource,
      resourceType: action.split(':')[0],
      details: { allowed },
      success: allowed,
    });
    return allowed;
  }
}
