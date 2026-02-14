// ============================================================
// SOA One SOA — Policy Manager
// ============================================================
//
// Policy management subsystem for the SOA module. Handles
// policy registration, evaluation, enforcement, SLA definition,
// compliance tracking, and breach detection.
//
// Features:
// - Policy CRUD with type and enforcement point filtering
// - Rule-based policy evaluation against runtime context
// - Service-to-policy binding and unbinding
// - SLA definition with multi-metric thresholds
// - SLA compliance recording with automatic breach detection
// - Event callbacks for enforcement, violation, and SLA state
//
// Zero external dependencies.
// ============================================================

import type {
  PolicyDefinition,
  PolicyRule,
  PolicyType,
  EnforcementPoint,
  SLADefinition,
  SLAMetric,
  SLAMetricType,
  SLABreachAction,
  SLAComplianceRecord,
  SLABreach,
} from './types';

import { generateId } from './registry';

// ── Result Types ────────────────────────────────────────────

/** Result of evaluating a single policy. */
export interface PolicyEvaluationResult {
  /** Whether the policy allows the request. */
  allowed: boolean;
  /** Human-readable descriptions of any violations. */
  violations: string[];
  /** IDs of rules that were applied during evaluation. */
  appliedRules: string[];
}

// ── Callback Types ──────────────────────────────────────────

/** Callback fired when a policy is successfully enforced. */
export type PolicyEnforcedCallback = (
  policyId: string,
  result: PolicyEvaluationResult,
) => void;

/** Callback fired when a policy is violated. */
export type PolicyViolatedCallback = (
  policyId: string,
  result: PolicyEvaluationResult,
) => void;

/** Callback fired when an SLA breach is detected. */
export type SLABreachedCallback = (
  slaId: string,
  serviceId: string,
  breaches: SLABreach[],
) => void;

/** Callback fired when SLA compliance is confirmed. */
export type SLACompliantCallback = (
  slaId: string,
  serviceId: string,
  record: SLAComplianceRecord,
) => void;

// ── Policy Manager ──────────────────────────────────────────

/**
 * Central policy management engine for registering, evaluating,
 * and enforcing policies and SLAs across SOA services.
 *
 * Usage:
 * ```ts
 * const pm = new PolicyManager();
 *
 * // Register a security policy
 * pm.registerPolicy({
 *   id: 'sec-1',
 *   name: 'Auth Required',
 *   type: 'security',
 *   enforcementPoint: 'inbound',
 *   priority: 100,
 *   rules: [{
 *     id: 'r1',
 *     condition: 'context.authenticated === true',
 *     action: 'allow',
 *     config: {},
 *   }],
 *   enabled: true,
 *   boundServices: ['svc-1'],
 *   createdAt: new Date().toISOString(),
 *   metadata: {},
 * });
 *
 * // Evaluate the policy
 * const result = pm.evaluatePolicy('sec-1', { authenticated: true });
 * ```
 */
export class PolicyManager {
  // ── Private State ────────────────────────────────────────

  /** All registered policies keyed by ID. */
  private readonly _policies: Map<string, PolicyDefinition> = new Map();

  /** All registered SLA definitions keyed by ID. */
  private readonly _slas: Map<string, SLADefinition> = new Map();

  /** Historical SLA compliance records. */
  private readonly _complianceRecords: SLAComplianceRecord[] = [];

  /** Running count of SLA breaches detected. */
  private _slaBreachCount: number = 0;

  // ── Callback Arrays ──────────────────────────────────────

  /** Callbacks fired when a policy is enforced (allowed). */
  private readonly _onPolicyEnforced: PolicyEnforcedCallback[] = [];

  /** Callbacks fired when a policy is violated (denied). */
  private readonly _onPolicyViolated: PolicyViolatedCallback[] = [];

  /** Callbacks fired when an SLA breach is detected. */
  private readonly _onSLABreached: SLABreachedCallback[] = [];

  /** Callbacks fired when SLA compliance is confirmed. */
  private readonly _onSLACompliant: SLACompliantCallback[] = [];

  // ── Policy Registration ──────────────────────────────────

  /**
   * Register a policy definition.
   *
   * If the policy's `id` already exists it will be overwritten.
   *
   * @param policy - The policy definition to register.
   */
  registerPolicy(policy: PolicyDefinition): void {
    this._policies.set(policy.id, policy);
  }

  /**
   * Retrieve a policy by its ID.
   *
   * @param policyId - The unique policy identifier.
   * @returns The policy definition, or `undefined` if not found.
   */
  getPolicy(policyId: string): PolicyDefinition | undefined {
    return this._policies.get(policyId);
  }

  /**
   * Remove a policy from the manager.
   *
   * @param policyId - The unique policy identifier.
   * @returns `true` if the policy was found and removed; `false` otherwise.
   */
  removePolicy(policyId: string): boolean {
    return this._policies.delete(policyId);
  }

  /**
   * Retrieve all policies of a given type.
   *
   * @param type - The policy type to filter by.
   * @returns An array of matching policy definitions.
   */
  getPoliciesByType(type: PolicyType): PolicyDefinition[] {
    const results: PolicyDefinition[] = [];
    for (const policy of this._policies.values()) {
      if (policy.type === type) {
        results.push(policy);
      }
    }
    return results;
  }

  /**
   * Retrieve all policies bound to a specific service.
   *
   * @param serviceId - The service identifier to match.
   * @returns An array of policy definitions whose `boundServices`
   *          array includes the given service ID.
   */
  getPoliciesForService(serviceId: string): PolicyDefinition[] {
    const results: PolicyDefinition[] = [];
    for (const policy of this._policies.values()) {
      if (policy.boundServices.includes(serviceId)) {
        results.push(policy);
      }
    }
    return results;
  }

  // ── Policy Evaluation ────────────────────────────────────

  /**
   * Evaluate a single policy against the given runtime context.
   *
   * Each enabled rule in the policy is checked. Rules with a
   * `condition` string are evaluated by looking up the condition
   * path in the context object. Rules whose `action` is `'deny'`
   * produce a violation when their condition matches. Rules whose
   * `action` is `'allow'` must have their condition satisfied to
   * permit the request.
   *
   * After evaluation, the appropriate `onPolicyEnforced` or
   * `onPolicyViolated` callbacks are fired.
   *
   * @param policyId - The policy to evaluate.
   * @param context  - Key/value runtime context for rule evaluation.
   * @returns The evaluation result with `allowed`, `violations`,
   *          and `appliedRules` fields.
   */
  evaluatePolicy(
    policyId: string,
    context: Record<string, any>,
  ): PolicyEvaluationResult {
    const policy = this._policies.get(policyId);

    if (!policy) {
      return { allowed: true, violations: [], appliedRules: [] };
    }

    const violations: string[] = [];
    const appliedRules: string[] = [];
    let allowed = true;

    if (policy.enabled) {
      for (const rule of policy.rules) {
        appliedRules.push(rule.id);

        const conditionMet = this._evaluateCondition(rule, context);

        if (rule.action === 'deny' && conditionMet) {
          allowed = false;
          violations.push(
            `Rule '${rule.id}' denied: condition '${rule.condition ?? '(always)'}' matched`,
          );
        } else if (rule.action === 'allow' && !conditionMet) {
          allowed = false;
          violations.push(
            `Rule '${rule.id}' not satisfied: condition '${rule.condition ?? '(always)'}' not met`,
          );
        } else if (rule.action === 'throttle' && conditionMet) {
          const limit = (rule.config as Record<string, any>).maxRequests;
          const current = (context as Record<string, any>).requestCount;
          if (
            typeof limit === 'number' &&
            typeof current === 'number' &&
            current > limit
          ) {
            allowed = false;
            violations.push(
              `Rule '${rule.id}' throttled: ${current} requests exceeds limit of ${limit}`,
            );
          }
        }
      }
    }

    const result: PolicyEvaluationResult = { allowed, violations, appliedRules };

    // Fire callbacks
    if (allowed) {
      for (const cb of this._onPolicyEnforced) {
        cb(policyId, result);
      }
    } else {
      for (const cb of this._onPolicyViolated) {
        cb(policyId, result);
      }
    }

    return result;
  }

  /**
   * Evaluate all policies bound to a service at a given
   * enforcement point.
   *
   * Policies are sorted by priority (descending) before
   * evaluation. The aggregate result is `allowed` only when
   * every applicable policy allows the request.
   *
   * @param serviceId        - The service whose policies to evaluate.
   * @param context          - Key/value runtime context.
   * @param enforcementPoint - The enforcement point to filter by.
   * @returns An aggregate evaluation result.
   */
  evaluateAllPolicies(
    serviceId: string,
    context: Record<string, any>,
    enforcementPoint: EnforcementPoint,
  ): PolicyEvaluationResult {
    const policies = this.getPoliciesForService(serviceId)
      .filter(
        (p) =>
          p.enabled &&
          (p.enforcementPoint === enforcementPoint ||
            p.enforcementPoint === 'both'),
      )
      .sort((a, b) => b.priority - a.priority);

    const aggregateViolations: string[] = [];
    const aggregateAppliedRules: string[] = [];
    let aggregateAllowed = true;

    for (const policy of policies) {
      const result = this.evaluatePolicy(policy.id, context);

      if (!result.allowed) {
        aggregateAllowed = false;
      }

      aggregateViolations.push(...result.violations);
      aggregateAppliedRules.push(...result.appliedRules);
    }

    return {
      allowed: aggregateAllowed,
      violations: aggregateViolations,
      appliedRules: aggregateAppliedRules,
    };
  }

  // ── Policy Binding ───────────────────────────────────────

  /**
   * Bind a policy to a service.
   *
   * Adds the `serviceId` to the policy's `boundServices` array
   * if it is not already present.
   *
   * @param policyId  - The policy to bind.
   * @param serviceId - The service to bind to.
   * @returns `true` if the binding was added; `false` if the
   *          policy was not found or the service was already bound.
   */
  bindPolicyToService(policyId: string, serviceId: string): boolean {
    const policy = this._policies.get(policyId);
    if (!policy) return false;

    if (policy.boundServices.includes(serviceId)) {
      return false;
    }

    policy.boundServices.push(serviceId);
    return true;
  }

  /**
   * Unbind a policy from a service.
   *
   * Removes the `serviceId` from the policy's `boundServices`
   * array.
   *
   * @param policyId  - The policy to unbind.
   * @param serviceId - The service to unbind from.
   * @returns `true` if the binding was removed; `false` if the
   *          policy was not found or the service was not bound.
   */
  unbindPolicyFromService(policyId: string, serviceId: string): boolean {
    const policy = this._policies.get(policyId);
    if (!policy) return false;

    const idx = policy.boundServices.indexOf(serviceId);
    if (idx < 0) return false;

    policy.boundServices.splice(idx, 1);
    return true;
  }

  // ── SLA Registration ─────────────────────────────────────

  /**
   * Register an SLA definition.
   *
   * If the SLA's `id` already exists it will be overwritten.
   *
   * @param sla - The SLA definition to register.
   */
  registerSLA(sla: SLADefinition): void {
    this._slas.set(sla.id, sla);
  }

  /**
   * Retrieve an SLA definition by ID.
   *
   * @param slaId - The unique SLA identifier.
   * @returns The SLA definition, or `undefined` if not found.
   */
  getSLA(slaId: string): SLADefinition | undefined {
    return this._slas.get(slaId);
  }

  /**
   * Remove an SLA definition.
   *
   * @param slaId - The unique SLA identifier.
   * @returns `true` if the SLA was found and removed; `false` otherwise.
   */
  removeSLA(slaId: string): boolean {
    return this._slas.delete(slaId);
  }

  // ── SLA Compliance ───────────────────────────────────────

  /**
   * Record SLA metric values for a service and check thresholds.
   *
   * Creates an `SLAComplianceRecord` for the measurement period.
   * Each metric value is compared against the SLA's defined
   * thresholds. Breaches are recorded when values fall outside
   * acceptable ranges:
   * - For `availability` and `uptime`: actual < target triggers a breach.
   * - For `response-time` and `error-rate`: actual > target triggers a breach.
   * - For `throughput`: actual < target triggers a breach.
   *
   * The `onSLABreached` callbacks are fired when breaches occur;
   * the `onSLACompliant` callbacks are fired when no breaches
   * are detected.
   *
   * @param slaId        - The SLA to check against.
   * @param serviceId    - The service being measured.
   * @param metricValues - Actual metric values keyed by metric type.
   * @returns The compliance record, or `undefined` if the SLA
   *          is not found or not enabled.
   */
  recordSLAMetrics(
    slaId: string,
    serviceId: string,
    metricValues: Record<SLAMetricType, number>,
  ): SLAComplianceRecord | undefined {
    const sla = this._slas.get(slaId);
    if (!sla || !sla.enabled) return undefined;

    const now = new Date().toISOString();
    const breaches: SLABreach[] = [];

    for (const metric of sla.metrics) {
      const actualValue = metricValues[metric.type];
      if (actualValue === undefined) continue;

      const breached = this._isMetricBreached(metric, actualValue);

      if (breached) {
        const severity = this._getBreachSeverity(metric, actualValue);
        breaches.push({
          metricType: metric.type,
          actualValue,
          targetValue: metric.target,
          detectedAt: now,
          severity,
        });
      }
    }

    const compliant = breaches.length === 0;

    const record: SLAComplianceRecord = {
      id: generateId(),
      slaId,
      serviceId,
      periodStart: now,
      periodEnd: now,
      metricValues,
      compliant,
      breaches,
    };

    this._complianceRecords.push(record);

    if (!compliant) {
      this._slaBreachCount += breaches.length;

      for (const cb of this._onSLABreached) {
        cb(slaId, serviceId, breaches);
      }
    } else {
      for (const cb of this._onSLACompliant) {
        cb(slaId, serviceId, record);
      }
    }

    return record;
  }

  /**
   * Retrieve SLA compliance records, optionally filtered by
   * SLA ID and service ID.
   *
   * @param slaId     - The SLA identifier to filter by.
   * @param serviceId - Optional service identifier to further narrow results.
   * @returns An array of matching compliance records.
   */
  getSLACompliance(
    slaId: string,
    serviceId?: string,
  ): SLAComplianceRecord[] {
    return this._complianceRecords.filter((r) => {
      if (r.slaId !== slaId) return false;
      if (serviceId !== undefined && r.serviceId !== serviceId) return false;
      return true;
    });
  }

  /**
   * Retrieve the most recent SLA breach records across all SLAs.
   *
   * @param limit - Maximum number of breach records to return.
   *                Defaults to 10.
   * @returns An array of `SLABreach` objects with their parent
   *          record's `slaId` and `serviceId` attached.
   */
  getRecentBreaches(
    limit: number = 10,
  ): Array<SLABreach & { slaId: string; serviceId: string }> {
    const allBreaches: Array<SLABreach & { slaId: string; serviceId: string }> = [];

    for (const record of this._complianceRecords) {
      for (const breach of record.breaches) {
        allBreaches.push({
          ...breach,
          slaId: record.slaId,
          serviceId: record.serviceId,
        });
      }
    }

    // Sort by detection time descending (most recent first)
    allBreaches.sort(
      (a, b) =>
        new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime(),
    );

    return allBreaches.slice(0, limit);
  }

  // ── Event Callbacks ──────────────────────────────────────

  /**
   * Register a callback to be fired when a policy is
   * successfully enforced (all rules pass).
   *
   * @param cb - The callback function.
   */
  onPolicyEnforced(cb: PolicyEnforcedCallback): void {
    this._onPolicyEnforced.push(cb);
  }

  /**
   * Register a callback to be fired when a policy is violated
   * (one or more rules fail).
   *
   * @param cb - The callback function.
   */
  onPolicyViolated(cb: PolicyViolatedCallback): void {
    this._onPolicyViolated.push(cb);
  }

  /**
   * Register a callback to be fired when an SLA breach is
   * detected during metric recording.
   *
   * @param cb - The callback function.
   */
  onSLABreached(cb: SLABreachedCallback): void {
    this._onSLABreached.push(cb);
  }

  /**
   * Register a callback to be fired when SLA compliance is
   * confirmed during metric recording.
   *
   * @param cb - The callback function.
   */
  onSLACompliant(cb: SLACompliantCallback): void {
    this._onSLACompliant.push(cb);
  }

  // ── Aggregate Getters ────────────────────────────────────

  /** Total number of registered policies. */
  get policyCount(): number {
    return this._policies.size;
  }

  /** Number of policies that are currently enabled. */
  get activePolicyCount(): number {
    let n = 0;
    for (const policy of this._policies.values()) {
      if (policy.enabled) n++;
    }
    return n;
  }

  /** Total number of registered SLA definitions. */
  get slaCount(): number {
    return this._slas.size;
  }

  /** Total number of SLA breaches detected since creation. */
  get slaBreachCount(): number {
    return this._slaBreachCount;
  }

  // ── Private Helpers ──────────────────────────────────────

  /**
   * Evaluate a single rule's condition against the context.
   *
   * If the rule has no condition, it is treated as always
   * matching. Otherwise the condition string is resolved as a
   * dot-delimited path into the context object. Truthy values
   * are treated as a match.
   *
   * @param rule    - The policy rule to evaluate.
   * @param context - The runtime context object.
   * @returns `true` if the condition is satisfied.
   */
  private _evaluateCondition(
    rule: PolicyRule,
    context: Record<string, any>,
  ): boolean {
    if (!rule.condition) {
      return true;
    }

    // Resolve dot-path condition (e.g. "authenticated" or "user.role")
    // against the context object
    const value = this._resolveContextPath(rule.condition, context);
    return !!value;
  }

  /**
   * Resolve a dot-delimited path against a context object.
   *
   * For example, `"user.role"` resolves `context.user.role`.
   *
   * @param path    - Dot-delimited property path.
   * @param context - The object to resolve against.
   * @returns The resolved value, or `undefined` if not found.
   */
  private _resolveContextPath(
    path: string,
    context: Record<string, any>,
  ): any {
    const parts = path.split('.');
    let current: any = context;

    for (const part of parts) {
      if (current === null || current === undefined) return undefined;
      if (typeof current !== 'object') return undefined;
      current = current[part];
    }

    return current;
  }

  /**
   * Determine whether a metric value constitutes a breach of
   * the SLA target.
   *
   * - `availability`, `uptime`, `throughput`: breach when
   *   actual < target.
   * - `response-time`, `error-rate`: breach when actual > target.
   *
   * @param metric      - The SLA metric definition.
   * @param actualValue - The observed metric value.
   * @returns `true` if the metric is breached.
   */
  private _isMetricBreached(metric: SLAMetric, actualValue: number): boolean {
    switch (metric.type) {
      case 'availability':
      case 'uptime':
      case 'throughput':
        return actualValue < metric.target;

      case 'response-time':
      case 'error-rate':
        return actualValue > metric.target;

      default:
        return false;
    }
  }

  /**
   * Determine the severity of an SLA breach based on whether
   * the value crosses the warning or critical threshold.
   *
   * - `availability`, `uptime`, `throughput`: critical when
   *   actual <= criticalThreshold.
   * - `response-time`, `error-rate`: critical when actual >=
   *   criticalThreshold.
   *
   * @param metric      - The SLA metric definition.
   * @param actualValue - The observed metric value.
   * @returns `'warning'` or `'critical'`.
   */
  private _getBreachSeverity(
    metric: SLAMetric,
    actualValue: number,
  ): 'warning' | 'critical' {
    switch (metric.type) {
      case 'availability':
      case 'uptime':
      case 'throughput':
        return actualValue <= metric.criticalThreshold ? 'critical' : 'warning';

      case 'response-time':
      case 'error-rate':
        return actualValue >= metric.criticalThreshold ? 'critical' : 'warning';

      default:
        return 'warning';
    }
  }
}
