// ============================================================
// SOA One IAM — Security Manager
// ============================================================
//
// Unified security subsystem for the Identity and Access
// Management module covering access control, data masking, and
// audit logging.
//
// - IAMAccessControl: subject/action/resource access control
//   with regex resource pattern matching and multi-policy
//   evaluation.
// - IAMDataMasker: configurable field-level data masking with
//   multiple strategies (full, partial, hash, redact, tokenize,
//   encrypt).
// - IAMAuditLogger: append-only audit log with multi-criteria
//   filtering and capped retention.
// - IAMSecurityManager: facade that composes all three
//   sub-systems into a single entry point.
//
// Zero external dependencies. 100% in-memory.
// ============================================================

import type {
  IAMAccessPolicy,
  IAMMaskingRule,
  IAMMaskingStrategy,
  IAMAuditEntry,
  IAMSecurityAction,
  PermissionEffect,
} from './types';

// ── Helpers ────────────────────────────────────────────────

/**
 * Generate a unique identifier from a timestamp and random hex.
 *
 * @returns A string ID in the form `<hex-timestamp>-<hex-random>`.
 */
export function generateId(): string {
  const ts = Date.now().toString(16);
  const rand = Math.random().toString(16).substring(2, 10);
  return `${ts}-${rand}`;
}

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

// ============================================================
// IAMAccessControl
// ============================================================

/**
 * Subject/action/resource access control engine.
 *
 * Policies bind subjects to allowed (or denied) actions and
 * resource patterns. When {@link evaluate} is invoked the engine
 * evaluates every policy and collects all matches. If at least
 * one `allow` policy matches and no `deny` policy matches,
 * access is granted. Deny policies always take precedence.
 *
 * Resource patterns are treated as regular expressions and
 * tested against the full resource string.
 *
 * ```ts
 * const ac = new IAMAccessControl();
 * ac.registerPolicy({
 *   id: 'p1',
 *   name: 'Admin Allow',
 *   effect: 'allow',
 *   subjects: ['admin'],
 *   actions: ['identity.create'],
 *   resources: ['.*'],
 * });
 *
 * const result = ac.evaluate('admin', 'identity.create', '/identities/123');
 * // result.allowed === true
 * ```
 */
export class IAMAccessControl {
  /** Registered access policies keyed by policy ID. */
  private readonly _policies = new Map<string, IAMAccessPolicy>();

  /**
   * Register an access policy.
   *
   * If a policy with the same ID already exists it will be
   * overwritten.
   *
   * @param policy - The access policy to register.
   */
  registerPolicy(policy: IAMAccessPolicy): void {
    this._policies.set(policy.id, policy);
  }

  /**
   * Remove an access policy by ID.
   *
   * @param policyId - The ID of the policy to remove.
   */
  removePolicy(policyId: string): void {
    this._policies.delete(policyId);
  }

  /**
   * Retrieve an access policy by ID.
   *
   * @param policyId - The ID of the policy to retrieve.
   * @returns The policy, or `undefined` if not found.
   */
  getPolicy(policyId: string): IAMAccessPolicy | undefined {
    return this._policies.get(policyId);
  }

  /**
   * List all registered access policies.
   *
   * @returns An array of all registered policies.
   */
  listPolicies(): IAMAccessPolicy[] {
    return Array.from(this._policies.values());
  }

  /**
   * Evaluate whether a subject is allowed to perform an action
   * on a resource.
   *
   * Evaluation rules:
   * 1. Every policy is checked for a match.
   * 2. A policy matches when:
   *    - The subject is listed in the policy's `subjects`.
   *    - The requested action is listed in the policy's `actions`.
   *    - The resource string matches at least one of the
   *      policy's `resources` (evaluated as regex).
   * 3. If any `deny` policy matches, access is denied.
   * 4. If at least one `allow` policy matches (and no deny),
   *    access is granted.
   * 5. If no policy matches, access is denied (default deny).
   *
   * @param subject  - The subject (e.g. user ID, role name).
   * @param action   - The action being attempted.
   * @param resource - The target resource identifier.
   * @returns An object containing `allowed` and `matchedPolicies`.
   */
  evaluate(
    subject: string,
    action: string,
    resource: string,
  ): { allowed: boolean; matchedPolicies: string[] } {
    const matchedPolicies: string[] = [];
    let hasDeny = false;
    let hasAllow = false;

    for (const policy of this._policies.values()) {
      // Check subject
      const hasSubject = policy.subjects.includes(subject) || policy.subjects.includes('*');
      if (!hasSubject) continue;

      // Check action
      const hasAction = (policy.actions as string[]).includes(action) ||
        (policy.actions as string[]).some((a) => a === '*');
      if (!hasAction) continue;

      // Check resource against patterns (regex)
      const matchesResource = policy.resources.some((pattern) => {
        const re = new RegExp(pattern);
        return re.test(resource);
      });
      if (!matchesResource) continue;

      matchedPolicies.push(policy.id);

      if (policy.effect === 'deny') {
        hasDeny = true;
      } else if (policy.effect === 'allow') {
        hasAllow = true;
      }
    }

    return {
      allowed: hasAllow && !hasDeny,
      matchedPolicies,
    };
  }
}

// ============================================================
// IAMDataMasker
// ============================================================

/**
 * Field-level data masker with pluggable strategies.
 *
 * Register {@link IAMMaskingRule} instances that pair a field
 * pattern (regex) with a masking strategy. Then call
 * {@link maskData} to apply all matching rules to every
 * matching key in a flat object.
 *
 * Individual values can also be masked on-the-fly via the
 * {@link maskValue} method.
 *
 * ```ts
 * const masker = new IAMDataMasker();
 * masker.registerRule({
 *   id: 'r1',
 *   name: 'Mask passwords',
 *   fieldPattern: 'password|secret',
 *   strategy: 'full',
 * });
 *
 * const masked = masker.maskData({ password: 'hunter2', name: 'Alice' });
 * // masked.password === '****'
 * // masked.name === 'Alice'
 * ```
 */
export class IAMDataMasker {
  /** Registered masking rules keyed by rule ID. */
  private readonly _rules = new Map<string, IAMMaskingRule>();

  /**
   * Register a masking rule.
   *
   * If a rule with the same ID already exists it will be
   * overwritten.
   *
   * @param rule - The masking rule to register.
   */
  registerRule(rule: IAMMaskingRule): void {
    this._rules.set(rule.id, rule);
  }

  /**
   * Remove a masking rule by ID.
   *
   * @param ruleId - The ID of the rule to remove.
   */
  removeRule(ruleId: string): void {
    this._rules.delete(ruleId);
  }

  /**
   * Retrieve all registered masking rules.
   *
   * @returns An array of all registered masking rules.
   */
  getRules(): IAMMaskingRule[] {
    return Array.from(this._rules.values());
  }

  /**
   * Apply all registered masking rules to matching fields in a
   * data object.
   *
   * Each key in the input object is tested against every rule's
   * `fieldPattern` (as a regex). If a match is found the
   * corresponding value is masked using the rule's strategy and
   * parameters.
   *
   * Keys that do not match any rule are passed through
   * unchanged. A shallow copy of the object is returned so the
   * original is not mutated.
   *
   * @param data - The flat object whose fields should be masked.
   * @returns A new object with masked values where rules apply.
   */
  maskData(data: Record<string, any>): Record<string, any> {
    const result: Record<string, any> = { ...data };

    for (const key of Object.keys(result)) {
      for (const rule of this._rules.values()) {
        const re = new RegExp(rule.fieldPattern);
        if (re.test(key)) {
          result[key] = this.maskValue(String(result[key]), rule.strategy);
          break; // first matching rule wins for this key
        }
      }
    }

    return result;
  }

  /**
   * Mask a single value using the specified strategy.
   *
   * Supported strategies:
   * - `'full'`     - Replaces the entire value with `'****'`.
   * - `'partial'`  - Preserves the first 2 and last 2
   *                  characters, masking the middle with `'*'`.
   * - `'hash'`     - Returns a simple non-cryptographic hash
   *                  string of the value.
   * - `'redact'`   - Returns `'[REDACTED]'`.
   * - `'tokenize'` - Returns `'TOK-'` followed by a hash
   *                  prefix (first 8 hex chars).
   * - `'encrypt'`  - Returns `'ENC-'` followed by a hash
   *                  (simulated encryption for in-memory use).
   *
   * @param value    - The string value to mask.
   * @param strategy - The masking strategy to apply.
   * @returns The masked value as a string.
   */
  maskValue(value: string, strategy: IAMMaskingStrategy): string {
    switch (strategy) {
      case 'full':
        return '****';

      case 'partial': {
        const preserveStart = 2;
        const preserveEnd = 2;

        if (value.length <= preserveStart + preserveEnd) {
          // String too short to meaningfully mask the middle
          return '****';
        }

        const start = value.substring(0, preserveStart);
        const end = value.substring(value.length - preserveEnd);
        const middleLength = value.length - preserveStart - preserveEnd;
        const masked = '*'.repeat(middleLength);
        return `${start}${masked}${end}`;
      }

      case 'hash':
        return simpleHash(value);

      case 'redact':
        return '[REDACTED]';

      case 'tokenize': {
        const hashValue = simpleHash(value);
        return `TOK-${hashValue.substring(0, 8)}`;
      }

      case 'encrypt': {
        const hashValue = simpleHash(value);
        return `ENC-${hashValue}`;
      }

      default:
        return '****';
    }
  }
}

// ============================================================
// IAMAuditLogger
// ============================================================

/**
 * Append-only audit log with automatic ID / timestamp
 * generation, configurable maximum capacity, and multi-criteria
 * query support.
 *
 * When the number of entries exceeds `maxEntries` (default
 * 10 000) the oldest entries are trimmed automatically.
 *
 * ```ts
 * const audit = new IAMAuditLogger();
 * audit.recordAudit({
 *   action: 'auth.login',
 *   actor: 'alice',
 *   details: { method: 'password' },
 *   success: true,
 * });
 *
 * const recent = audit.getAuditLog({ limit: 10 });
 * ```
 */
export class IAMAuditLogger {
  /** Internal ordered list of audit entries (newest last). */
  private _entries: IAMAuditEntry[] = [];

  /** Maximum number of entries to retain. */
  private readonly _maxEntries: number = 10000;

  /**
   * Append an audit entry.
   *
   * The `id` and `timestamp` fields are generated automatically
   * and should not be included in the input. If the log exceeds
   * the maximum capacity the oldest entries are removed.
   *
   * @param entry - The audit entry (without `id` and `timestamp`).
   * @returns The complete audit entry as stored.
   */
  recordAudit(entry: Omit<IAMAuditEntry, 'id' | 'timestamp'>): IAMAuditEntry {
    const full: IAMAuditEntry = {
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
   * Retrieve audit entries with optional filtering.
   *
   * All filter criteria are combined with AND logic. Entries are
   * returned in insertion order (oldest first).
   *
   * @param options - Optional filter and pagination parameters.
   * @returns An array of matching audit entries.
   */
  getAuditLog(options?: {
    action?: string;
    actor?: string;
    success?: boolean;
    startTime?: string;
    endTime?: string;
    limit?: number;
  }): IAMAuditEntry[] {
    let results = this._entries;

    if (options) {
      if (options.action !== undefined) {
        results = results.filter((e) => e.action === options.action);
      }

      if (options.actor !== undefined) {
        results = results.filter((e) => e.actor === options.actor);
      }

      if (options.success !== undefined) {
        results = results.filter((e) => e.success === options.success);
      }

      if (options.startTime !== undefined) {
        results = results.filter((e) => e.timestamp >= options.startTime!);
      }

      if (options.endTime !== undefined) {
        results = results.filter((e) => e.timestamp <= options.endTime!);
      }

      if (options.limit !== undefined) {
        results = results.slice(0, options.limit);
      }
    }

    return results;
  }

  /**
   * Retrieve a single audit entry by ID.
   *
   * @param id - The audit entry ID.
   * @returns The matching audit entry, or `undefined` if not found.
   */
  getAuditEntry(id: string): IAMAuditEntry | undefined {
    return this._entries.find((e) => e.id === id);
  }

  /** The total number of audit entries currently stored. */
  get auditCount(): number {
    return this._entries.length;
  }

  /**
   * Clear all audit entries.
   */
  clear(): void {
    this._entries = [];
  }
}

// ============================================================
// IAMSecurityManager
// ============================================================

/**
 * Unified security manager that composes access control, data
 * masking, and audit logging into a single entry point.
 *
 * ```ts
 * const security = new IAMSecurityManager();
 *
 * // Access control
 * security.accessControl.registerPolicy({ ... });
 * const result = security.accessControl.evaluate('admin', 'identity.create', '/identities');
 *
 * // Data masking
 * security.masker.registerRule({ ... });
 * const safe = security.masker.maskData({ password: 'secret' });
 *
 * // Audit logging
 * security.recordAudit({
 *   action: 'auth.login',
 *   actor: 'alice',
 *   details: {},
 *   success: true,
 * });
 * ```
 */
export class IAMSecurityManager {
  /** Access control engine. */
  readonly accessControl: IAMAccessControl;

  /** Data masking engine. */
  readonly masker: IAMDataMasker;

  /** Audit logging engine. */
  readonly auditLogger: IAMAuditLogger;

  /**
   * Create a new security manager.
   *
   * Instantiates the access control, data masker, and audit
   * logger sub-systems.
   */
  constructor() {
    this.accessControl = new IAMAccessControl();
    this.masker = new IAMDataMasker();
    this.auditLogger = new IAMAuditLogger();
  }

  /**
   * Convenience method to record an audit entry.
   *
   * Delegates directly to {@link IAMAuditLogger.recordAudit}.
   *
   * @param entry - The audit entry (without `id` and `timestamp`).
   * @returns The complete audit entry as stored.
   */
  recordAudit(entry: Omit<IAMAuditEntry, 'id' | 'timestamp'>): IAMAuditEntry {
    return this.auditLogger.recordAudit(entry);
  }
}
