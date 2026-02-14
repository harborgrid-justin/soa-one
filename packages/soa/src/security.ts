// ============================================================
// SOA One SOA — Security Manager
// ============================================================
//
// Unified security subsystem covering access control, data
// masking, and audit logging.
//
// - SOAAccessControl: role-based access control with regex
//   resource pattern matching and multi-policy evaluation.
// - SOADataMasker: configurable field-level data masking with
//   multiple strategies (full, partial, hash, redact,
//   substitute, tokenize).
// - SOAAuditLogger: append-only audit log with pagination and
//   multi-criteria filtering.
// - SOASecurityManager: facade that composes all three
//   sub-systems into a single entry point.
//
// Zero external dependencies.
// ============================================================

import type {
  SOAAccessPolicy,
  SOAAction,
  SOAMaskingRule,
  SOAMaskingStrategy,
  SOAAuditEntry,
} from './types';

import { generateId } from './registry';

// ── Access Control ──────────────────────────────────────────

/**
 * Role-based access control engine.
 *
 * Policies bind a set of roles to allowed actions and resource
 * patterns. When {@link checkAccess} is invoked the engine
 * evaluates every *enabled* policy and grants access if at
 * least one matching policy is found. If no policy matches the
 * request is denied by default.
 *
 * Resource patterns are treated as regular expressions and
 * tested against the full resource string.
 *
 * ```ts
 * const ac = new SOAAccessControl();
 * ac.registerPolicy({
 *   id: 'p1',
 *   name: 'Admin Policy',
 *   roles: ['admin'],
 *   allowedActions: ['admin:*'],
 *   resourcePatterns: ['.*'],
 *   enabled: true,
 * });
 *
 * const result = ac.checkAccess('alice', ['admin'], 'admin:*', '/services/order');
 * // result.allowed === true
 * ```
 */
export class SOAAccessControl {
  /** Registered access policies keyed by policy ID. */
  private readonly _policies = new Map<string, SOAAccessPolicy>();

  /**
   * Register an access policy.
   *
   * If a policy with the same ID already exists it will be
   * overwritten.
   *
   * @param policy - The access policy to register.
   */
  registerPolicy(policy: SOAAccessPolicy): void {
    this._policies.set(policy.id, policy);
  }

  /**
   * Remove an access policy by ID.
   *
   * @param policyId - The ID of the policy to remove.
   * @returns `true` if the policy existed and was removed.
   */
  removePolicy(policyId: string): boolean {
    return this._policies.delete(policyId);
  }

  /**
   * Check whether a given actor (with the supplied roles) is
   * allowed to perform an action on a resource.
   *
   * Evaluation rules:
   * 1. Only *enabled* policies are considered.
   * 2. A policy matches when:
   *    - The actor's roles intersect with the policy roles.
   *    - The requested action is listed in `allowedActions`.
   *    - The resource string matches at least one of the
   *      policy's `resourcePatterns` (evaluated as regex).
   * 3. If **any** matching policy is found, access is granted.
   * 4. If **no** policy matches, access is denied (default deny).
   *
   * @param actor    - Identifier of the requesting actor.
   * @param roles    - Roles held by the actor.
   * @param action   - The action being attempted.
   * @param resource - The target resource identifier.
   * @returns An object containing `allowed` and `matchedPolicies`.
   */
  checkAccess(
    actor: string,
    roles: string[],
    action: SOAAction,
    resource: string,
  ): { allowed: boolean; matchedPolicies: string[] } {
    const matchedPolicies: string[] = [];

    for (const policy of this._policies.values()) {
      // Skip disabled policies
      if (!policy.enabled) continue;

      // Check role intersection
      const hasRole = policy.roles.some((r) => roles.includes(r));
      if (!hasRole) continue;

      // Check action
      const hasAction = policy.allowedActions.includes(action);
      if (!hasAction) continue;

      // Check resource against patterns (regex)
      const matchesResource = policy.resourcePatterns.some((pattern) => {
        const re = new RegExp(pattern);
        return re.test(resource);
      });
      if (!matchesResource) continue;

      matchedPolicies.push(policy.id);
    }

    return {
      allowed: matchedPolicies.length > 0,
      matchedPolicies,
    };
  }

  /**
   * Retrieve all policies that include a specific role.
   *
   * @param role - The role to search for.
   * @returns An array of policies whose `roles` array contains the role.
   */
  getPoliciesForRole(role: string): SOAAccessPolicy[] {
    const results: SOAAccessPolicy[] = [];
    for (const policy of this._policies.values()) {
      if (policy.roles.includes(role)) {
        results.push(policy);
      }
    }
    return results;
  }

  /** All registered access policies. */
  get policies(): SOAAccessPolicy[] {
    return Array.from(this._policies.values());
  }

  /** The total number of registered policies. */
  get policyCount(): number {
    return this._policies.size;
  }
}

// ── Data Masker ─────────────────────────────────────────────

/**
 * Compute a simple non-cryptographic hash of a string value.
 *
 * This is used for illustration purposes only and must NOT be
 * relied upon for security. It produces a deterministic hex
 * string from the input.
 */
function simpleHash(value: string): string {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    const ch = value.charCodeAt(i);
    hash = ((hash << 5) - hash + ch) | 0;
  }
  // Convert to unsigned 32-bit and then to hex
  return (hash >>> 0).toString(16).padStart(8, '0');
}

/**
 * Field-level data masker with pluggable strategies.
 *
 * Register {@link SOAMaskingRule} instances that pair a field
 * pattern (regex) with a masking strategy. Then call
 * {@link maskObject} to apply all enabled rules to every
 * matching key in a flat object.
 *
 * Individual values can also be masked on-the-fly via the
 * {@link mask} method.
 *
 * ```ts
 * const masker = new SOADataMasker();
 * masker.registerRule({
 *   id: 'r1',
 *   fieldPattern: 'password|secret',
 *   strategy: 'full',
 *   parameters: {},
 *   enabled: true,
 * });
 *
 * const masked = masker.maskObject({ password: 'hunter2', name: 'Alice' });
 * // masked.password === '****'
 * // masked.name === 'Alice'
 * ```
 */
export class SOADataMasker {
  /** Registered masking rules keyed by rule ID. */
  private readonly _rules = new Map<string, SOAMaskingRule>();

  /**
   * Register a masking rule.
   *
   * If a rule with the same ID already exists it will be
   * overwritten.
   *
   * @param rule - The masking rule to register.
   */
  registerRule(rule: SOAMaskingRule): void {
    this._rules.set(rule.id, rule);
  }

  /**
   * Remove a masking rule by ID.
   *
   * @param ruleId - The ID of the rule to remove.
   * @returns `true` if the rule existed and was removed.
   */
  removeRule(ruleId: string): boolean {
    return this._rules.delete(ruleId);
  }

  /**
   * Mask a single value using the specified strategy.
   *
   * Supported strategies:
   * - `'full'`       – Replaces the entire value with `'****'`.
   * - `'partial'`    – Preserves the first N and last N
   *                    characters, masking the middle with `'*'`.
   *                    Configurable via `parameters.preserveStart`
   *                    (default 2) and `parameters.preserveEnd`
   *                    (default 2).
   * - `'hash'`       – Returns a simple non-cryptographic hash
   *                    string of the stringified value.
   * - `'redact'`     – Returns `'[REDACTED]'`.
   * - `'substitute'` – Returns `parameters.substitute` if
   *                    provided, otherwise `'XXXXX'`.
   * - `'tokenize'`   – Returns `'TOK-'` followed by a hash
   *                    prefix (first 8 hex chars).
   *
   * @param value      - The value to mask.
   * @param strategy   - The masking strategy to apply.
   * @param parameters - Optional strategy-specific parameters.
   * @returns The masked value as a string.
   */
  mask(
    value: any,
    strategy: SOAMaskingStrategy,
    parameters?: Record<string, any>,
  ): string {
    const str = String(value);
    const params = parameters ?? {};

    switch (strategy) {
      case 'full':
        return '****';

      case 'partial': {
        const preserveStart: number =
          typeof params.preserveStart === 'number' ? params.preserveStart : 2;
        const preserveEnd: number =
          typeof params.preserveEnd === 'number' ? params.preserveEnd : 2;

        if (str.length <= preserveStart + preserveEnd) {
          // String too short to meaningfully mask the middle
          return '****';
        }

        const start = str.substring(0, preserveStart);
        const end = str.substring(str.length - preserveEnd);
        const middleLength = str.length - preserveStart - preserveEnd;
        const masked = '*'.repeat(middleLength);
        return `${start}${masked}${end}`;
      }

      case 'hash':
        return simpleHash(str);

      case 'redact':
        return '[REDACTED]';

      case 'substitute':
        return params.substitute != null ? String(params.substitute) : 'XXXXX';

      case 'tokenize': {
        const hashValue = simpleHash(str);
        return `TOK-${hashValue.substring(0, 8)}`;
      }

      default:
        return '****';
    }
  }

  /**
   * Apply all enabled masking rules to matching fields in an
   * object.
   *
   * Each key in the input object is tested against every
   * enabled rule's `fieldPattern` (as a regex). If a match is
   * found the corresponding value is masked using the rule's
   * strategy and parameters.
   *
   * Keys that do not match any rule are passed through
   * unchanged. A shallow copy of the object is returned so the
   * original is not mutated.
   *
   * @param obj - The flat object whose fields should be masked.
   * @returns A new object with masked values where rules apply.
   */
  maskObject(obj: Record<string, any>): Record<string, any> {
    const result: Record<string, any> = { ...obj };

    for (const key of Object.keys(result)) {
      for (const rule of this._rules.values()) {
        if (!rule.enabled) continue;

        const re = new RegExp(rule.fieldPattern);
        if (re.test(key)) {
          result[key] = this.mask(result[key], rule.strategy, rule.parameters);
          break; // first matching rule wins for this key
        }
      }
    }

    return result;
  }

  /** All registered masking rules. */
  get rules(): SOAMaskingRule[] {
    return Array.from(this._rules.values());
  }

  /** The total number of registered masking rules. */
  get ruleCount(): number {
    return this._rules.size;
  }
}

// ── Audit Logger ────────────────────────────────────────────

/**
 * Append-only audit log with automatic ID / timestamp
 * generation, configurable maximum capacity, and multi-criteria
 * query methods.
 *
 * When the number of entries exceeds `maxEntries` the oldest
 * entries are trimmed automatically.
 *
 * ```ts
 * const audit = new SOAAuditLogger();
 * audit.log({
 *   action: 'service:invoke',
 *   actor: 'alice',
 *   resource: '/services/order',
 *   resourceType: 'service',
 *   details: { method: 'POST' },
 *   success: true,
 * });
 *
 * const recent = audit.getEntries(10);
 * ```
 */
export class SOAAuditLogger {
  /** Internal ordered list of audit entries (newest last). */
  private _entries: SOAAuditEntry[] = [];

  /** Maximum number of entries to retain. */
  private readonly _maxEntries: number;

  /**
   * Create a new audit logger.
   *
   * @param maxEntries - Maximum entries to retain (default 10 000).
   */
  constructor(maxEntries: number = 10000) {
    this._maxEntries = maxEntries;
  }

  /**
   * Append an audit entry.
   *
   * The `id` and `timestamp` fields are generated automatically
   * and should not be included in the input. If the log exceeds
   * `maxEntries` the oldest entries are removed.
   *
   * @param entry - The audit entry (without `id` and `timestamp`).
   * @returns The complete audit entry as stored.
   */
  log(entry: Omit<SOAAuditEntry, 'id' | 'timestamp'>): SOAAuditEntry {
    const full: SOAAuditEntry = {
      ...entry,
      id: generateId(),
      timestamp: new Date().toISOString(),
    };

    this._entries.push(full);

    // Trim to maxEntries if necessary
    if (this._entries.length > this._maxEntries) {
      this._entries = this._entries.slice(this._entries.length - this._maxEntries);
    }

    return full;
  }

  /**
   * Retrieve audit entries with optional pagination.
   *
   * Entries are returned in insertion order (oldest first).
   *
   * @param limit  - Maximum number of entries to return.
   * @param offset - Number of entries to skip from the start.
   * @returns An array of audit entries.
   */
  getEntries(limit?: number, offset?: number): SOAAuditEntry[] {
    const start = offset ?? 0;
    const end = limit !== undefined ? start + limit : undefined;
    return this._entries.slice(start, end);
  }

  /**
   * Retrieve audit entries filtered by action.
   *
   * @param action - The action string to filter on.
   * @param limit  - Optional maximum number of entries to return.
   * @returns Matching audit entries.
   */
  getEntriesByAction(action: string, limit?: number): SOAAuditEntry[] {
    const filtered = this._entries.filter((e) => e.action === action);
    return limit !== undefined ? filtered.slice(0, limit) : filtered;
  }

  /**
   * Retrieve audit entries filtered by actor.
   *
   * @param actor - The actor string to filter on.
   * @param limit - Optional maximum number of entries to return.
   * @returns Matching audit entries.
   */
  getEntriesByActor(actor: string, limit?: number): SOAAuditEntry[] {
    const filtered = this._entries.filter((e) => e.actor === actor);
    return limit !== undefined ? filtered.slice(0, limit) : filtered;
  }

  /**
   * Retrieve audit entries filtered by resource.
   *
   * @param resource - The resource string to filter on.
   * @param limit    - Optional maximum number of entries to return.
   * @returns Matching audit entries.
   */
  getEntriesByResource(resource: string, limit?: number): SOAAuditEntry[] {
    const filtered = this._entries.filter((e) => e.resource === resource);
    return limit !== undefined ? filtered.slice(0, limit) : filtered;
  }

  /**
   * Clear all audit entries.
   */
  clear(): void {
    this._entries = [];
  }

  /** The total number of audit entries currently stored. */
  get count(): number {
    return this._entries.length;
  }
}

// ── Security Manager (Facade) ───────────────────────────────

/**
 * Unified security manager that composes access control, data
 * masking, and audit logging into a single entry point.
 *
 * ```ts
 * const security = new SOASecurityManager();
 *
 * // Access control
 * security.accessControl.registerPolicy({ ... });
 * const result = security.accessControl.checkAccess('alice', ['admin'], 'admin:*', '/svc');
 *
 * // Data masking
 * security.masker.registerRule({ ... });
 * const safe = security.masker.maskObject({ password: 'secret' });
 *
 * // Audit logging
 * security.recordAudit({
 *   action: 'service:invoke',
 *   actor: 'alice',
 *   details: {},
 *   success: true,
 * });
 * ```
 */
export class SOASecurityManager {
  /** Access control engine. */
  readonly accessControl: SOAAccessControl;

  /** Data masking engine. */
  readonly masker: SOADataMasker;

  /** Audit logging engine. */
  readonly audit: SOAAuditLogger;

  /**
   * Create a new security manager.
   *
   * Instantiates the access control, data masker, and audit
   * logger sub-systems.
   */
  constructor() {
    this.accessControl = new SOAAccessControl();
    this.masker = new SOADataMasker();
    this.audit = new SOAAuditLogger();
  }

  /**
   * Convenience method to record an audit entry.
   *
   * Delegates directly to {@link SOAAuditLogger.log}.
   *
   * @param entry - The audit entry (without `id` and `timestamp`).
   * @returns The complete audit entry as stored.
   */
  recordAudit(entry: Omit<SOAAuditEntry, 'id' | 'timestamp'>): SOAAuditEntry {
    return this.audit.log(entry);
  }
}
