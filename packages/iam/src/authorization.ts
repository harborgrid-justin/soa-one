// ============================================================
// SOA One IAM — Authorization Engine
// ============================================================
//
// Comprehensive authorization subsystem combining RBAC, ABAC,
// and PBAC into a unified decision engine.
//
// Surpasses Oracle Access Manager with:
// - Role-Based Access Control (RBAC) with deep hierarchy
// - Attribute-Based Access Control (ABAC) condition evaluation
// - Policy-Based Access Control (PBAC) with deny-overrides
// - Role hierarchy with transitive inheritance resolution
// - Role constraints (mutual exclusion, prerequisites, etc.)
// - Authorization obligations (post-decision actions)
// - Decision caching for high-throughput evaluation
// - Batch authorization for bulk permission checks
// - Event callbacks for audit integration
//
// Zero external dependencies. In-memory, class-based.
// ============================================================

import type {
  Role,
  Permission,
  PermissionEffect,
  PermissionCondition,
  RoleAssignment,
  AccessPolicy,
  AuthorizationRequest,
  AuthorizationDecision,
  AuthorizationObligation,
} from './types';

// ── Utilities ────────────────────────────────────────────────

/** Generate a unique identifier. */
function generateId(): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).substring(2, 10);
  return `${ts}-${rand}`;
}

// ── Callback Types ──────────────────────────────────────────

/** Callback fired when access is granted. */
export type AccessGrantedCallback = (
  request: AuthorizationRequest,
  decision: AuthorizationDecision,
) => void;

/** Callback fired when access is denied. */
export type AccessDeniedCallback = (
  request: AuthorizationRequest,
  decision: AuthorizationDecision,
) => void;

/** Callback fired when a role is assigned. */
export type RoleAssignedCallback = (assignment: RoleAssignment) => void;

/** Callback fired when a role is revoked. */
export type RoleRevokedCallback = (
  identityId: string,
  roleId: string,
  revokedBy: string,
) => void;

/** Callback fired when a policy is created. */
export type PolicyCreatedCallback = (policy: AccessPolicy) => void;

/** Callback fired when a policy is updated. */
export type PolicyUpdatedCallback = (policy: AccessPolicy) => void;

/** Callback fired when a policy is deleted. */
export type PolicyDeletedCallback = (policyId: string) => void;

// ── Role Assignment Options ─────────────────────────────────

/** Options for role assignment. */
export interface RoleAssignmentOptions {
  scope?: string;
  expiresAt?: string;
  justification?: string;
}

// ── Role Hierarchy Node ─────────────────────────────────────

/** Recursive node used by getRoleHierarchy. */
export interface RoleHierarchyNode {
  role: Role;
  children: RoleHierarchyNode[];
}

// ── Authorization Cache Entry ───────────────────────────────

/** Cached authorization decision with a TTL. */
interface AuthorizationCacheEntry {
  decision: AuthorizationDecision;
  expiresAt: number;
}

// ── Authorization Engine ────────────────────────────────────

/**
 * Unified RBAC + ABAC + PBAC authorization engine.
 *
 * Evaluates authorization requests by:
 * 1. Collecting the subject's roles (direct + inherited)
 * 2. Gathering all effective permissions from those roles
 * 3. Evaluating RBAC permissions against the requested action
 * 4. Evaluating ABAC conditions on matched permissions
 * 5. Evaluating PBAC policies applicable to the subject
 * 6. Applying deny-overrides combining algorithm
 * 7. Returning a comprehensive decision with matched artefacts
 *
 * Usage:
 * ```ts
 * const engine = new AuthorizationEngine();
 *
 * engine.createRole({
 *   id: 'admin',
 *   name: 'admin',
 *   displayName: 'Administrator',
 *   type: 'system',
 *   permissions: [{
 *     id: 'perm-1',
 *     name: 'manage-users',
 *     resource: 'users',
 *     actions: ['create', 'read', 'update', 'delete'],
 *     effect: 'allow',
 *   }],
 *   inheritsFrom: [],
 *   requiresApproval: false,
 *   tags: [],
 *   metadata: {},
 *   createdAt: new Date().toISOString(),
 *   updatedAt: new Date().toISOString(),
 * });
 *
 * engine.assignRole('user-1', 'admin', 'system');
 *
 * const decision = engine.authorize({
 *   subjectId: 'user-1',
 *   resource: 'users',
 *   action: 'create',
 * });
 * // decision.allowed === true
 * ```
 */
export class AuthorizationEngine {
  // ── Private State ────────────────────────────────────────

  /** All registered roles keyed by ID. */
  private readonly _roles: Map<string, Role> = new Map();

  /** All registered permissions keyed by ID (denormalized from roles). */
  private readonly _permissions: Map<string, Permission> = new Map();

  /** All registered access policies keyed by ID. */
  private readonly _policies: Map<string, AccessPolicy> = new Map();

  /** Role assignments keyed by `${identityId}:${roleId}`. */
  private readonly _roleAssignments: Map<string, RoleAssignment> = new Map();

  /** Authorization decision cache keyed by a request fingerprint. */
  private readonly _cache: Map<string, AuthorizationCacheEntry> = new Map();

  /** Cache TTL in milliseconds. Defaults to 60 seconds. */
  private readonly _cacheTtlMs: number = 60_000;

  /** Running count of total authorization decisions made. */
  private _totalDecisions: number = 0;

  /** Running count of deny decisions. */
  private _denyCount: number = 0;

  // ── Callback Arrays ──────────────────────────────────────

  private readonly _onAccessGranted: AccessGrantedCallback[] = [];
  private readonly _onAccessDenied: AccessDeniedCallback[] = [];
  private readonly _onRoleAssigned: RoleAssignedCallback[] = [];
  private readonly _onRoleRevoked: RoleRevokedCallback[] = [];
  private readonly _onPolicyCreated: PolicyCreatedCallback[] = [];
  private readonly _onPolicyUpdated: PolicyUpdatedCallback[] = [];
  private readonly _onPolicyDeleted: PolicyDeletedCallback[] = [];

  // ── Role Management ──────────────────────────────────────

  /**
   * Create and register a role.
   *
   * All permissions carried by the role are indexed in the
   * internal permissions map for fast look-up.
   *
   * @param role - The full role definition.
   * @returns A defensive copy of the stored role.
   */
  createRole(role: Role): Role {
    this._roles.set(role.id, { ...role, permissions: role.permissions.map((p) => ({ ...p })) });

    // Index permissions
    for (const perm of role.permissions) {
      this._permissions.set(perm.id, { ...perm });
    }

    this._invalidateCache();
    return this._cloneRole(role);
  }

  /**
   * Retrieve a role by ID.
   *
   * @param id - Role identifier.
   * @returns The role, or `undefined` if not found.
   */
  getRole(id: string): Role | undefined {
    const role = this._roles.get(id);
    return role ? this._cloneRole(role) : undefined;
  }

  /**
   * Update a role with partial changes.
   *
   * @param id      - Role identifier.
   * @param updates - Partial role fields to merge.
   * @returns The updated role.
   * @throws If the role does not exist.
   */
  updateRole(id: string, updates: Partial<Role>): Role {
    const existing = this._roles.get(id);
    if (!existing) throw new Error(`Role not found: ${id}`);

    const merged: Role = {
      ...existing,
      ...updates,
      id, // prevent id mutation
      updatedAt: new Date().toISOString(),
    };

    // Ensure permissions array is a fresh copy
    merged.permissions = (merged.permissions ?? []).map((p) => ({ ...p }));

    this._roles.set(id, merged);

    // Re-index permissions
    for (const perm of merged.permissions) {
      this._permissions.set(perm.id, { ...perm });
    }

    this._invalidateCache();
    return this._cloneRole(merged);
  }

  /**
   * Delete a role and remove its permissions from the index.
   *
   * Active role assignments referencing this role are also
   * removed.
   *
   * @param id - Role identifier.
   * @throws If the role does not exist.
   */
  deleteRole(id: string): void {
    const role = this._roles.get(id);
    if (!role) throw new Error(`Role not found: ${id}`);

    // Remove permissions that belong solely to this role
    for (const perm of role.permissions) {
      this._permissions.delete(perm.id);
    }

    this._roles.delete(id);

    // Remove any assignments for this role
    for (const [key, assignment] of this._roleAssignments) {
      if (assignment.roleId === id) {
        this._roleAssignments.delete(key);
      }
    }

    this._invalidateCache();
  }

  /**
   * List all registered roles.
   *
   * @returns Defensive copies of all roles.
   */
  listRoles(): Role[] {
    return Array.from(this._roles.values()).map((r) => this._cloneRole(r));
  }

  /**
   * Get all roles assigned to an identity, including roles
   * inherited through the role hierarchy.
   *
   * @param identityId - The identity whose roles to retrieve.
   * @returns An array of roles (direct + inherited, deduplicated).
   */
  getRolesByIdentity(identityId: string): Role[] {
    const directRoleIds = this._getDirectRoleIds(identityId);
    const allRoleIds = new Set<string>();

    for (const roleId of directRoleIds) {
      this._collectInheritedRoleIds(roleId, allRoleIds);
    }

    const roles: Role[] = [];
    for (const roleId of allRoleIds) {
      const role = this._roles.get(roleId);
      if (role) {
        roles.push(this._cloneRole(role));
      }
    }

    return roles;
  }

  /**
   * Get the effective permissions for an identity by resolving
   * all assigned roles and their inherited roles, then
   * collecting every permission.
   *
   * Permissions are deduplicated by ID.
   *
   * @param identityId - The identity to evaluate.
   * @returns An array of deduplicated permissions.
   */
  getEffectivePermissions(identityId: string): Permission[] {
    const roles = this.getRolesByIdentity(identityId);
    const seen = new Set<string>();
    const permissions: Permission[] = [];

    for (const role of roles) {
      for (const perm of role.permissions) {
        if (!seen.has(perm.id)) {
          seen.add(perm.id);
          permissions.push({ ...perm });
        }
      }
    }

    return permissions;
  }

  // ── Policy Management (PBAC) ─────────────────────────────

  /**
   * Create and register an access policy.
   *
   * @param policy - The full policy definition.
   * @returns A defensive copy of the stored policy.
   */
  createPolicy(policy: AccessPolicy): AccessPolicy {
    this._policies.set(policy.id, { ...policy });
    this._invalidateCache();

    for (const cb of this._onPolicyCreated) {
      cb(policy);
    }

    return { ...policy };
  }

  /**
   * Retrieve a policy by ID.
   *
   * @param id - Policy identifier.
   * @returns The policy, or `undefined` if not found.
   */
  getPolicy(id: string): AccessPolicy | undefined {
    const policy = this._policies.get(id);
    return policy ? { ...policy } : undefined;
  }

  /**
   * Update a policy with partial changes.
   *
   * @param id      - Policy identifier.
   * @param updates - Partial policy fields to merge.
   * @returns The updated policy.
   * @throws If the policy does not exist.
   */
  updatePolicy(id: string, updates: Partial<AccessPolicy>): AccessPolicy {
    const existing = this._policies.get(id);
    if (!existing) throw new Error(`Policy not found: ${id}`);

    const merged: AccessPolicy = {
      ...existing,
      ...updates,
      id, // prevent id mutation
      updatedAt: new Date().toISOString(),
    };

    this._policies.set(id, merged);
    this._invalidateCache();

    for (const cb of this._onPolicyUpdated) {
      cb(merged);
    }

    return { ...merged };
  }

  /**
   * Delete a policy.
   *
   * @param id - Policy identifier.
   * @throws If the policy does not exist.
   */
  deletePolicy(id: string): void {
    const exists = this._policies.has(id);
    if (!exists) throw new Error(`Policy not found: ${id}`);

    this._policies.delete(id);
    this._invalidateCache();

    for (const cb of this._onPolicyDeleted) {
      cb(id);
    }
  }

  /**
   * List all registered policies.
   *
   * @returns Defensive copies of all policies.
   */
  listPolicies(): AccessPolicy[] {
    return Array.from(this._policies.values()).map((p) => ({ ...p }));
  }

  // ── Role Assignment ──────────────────────────────────────

  /**
   * Assign a role to an identity.
   *
   * If the role defines constraints, they are validated before
   * the assignment is created:
   * - **mutual-exclusion**: prevents assignment if the identity
   *   already holds the conflicting role.
   * - **prerequisite**: prevents assignment if the identity does
   *   not hold the required prerequisite role.
   * - **cardinality**: prevents assignment if the maximum number
   *   of assignees has been reached.
   *
   * @param identityId - The identity to assign to.
   * @param roleId     - The role to assign.
   * @param grantedBy  - The actor granting the assignment.
   * @param options     - Optional scope, expiry, and justification.
   * @returns The created role assignment.
   * @throws If the role does not exist or a constraint is violated.
   */
  assignRole(
    identityId: string,
    roleId: string,
    grantedBy: string,
    options?: RoleAssignmentOptions,
  ): RoleAssignment {
    const role = this._roles.get(roleId);
    if (!role) throw new Error(`Role not found: ${roleId}`);

    // Check constraints
    this._validateRoleConstraints(identityId, role);

    // Check maxAssignees
    if (role.maxAssignees !== undefined) {
      const currentCount = this._countAssigneesForRole(roleId);
      if (currentCount >= role.maxAssignees) {
        throw new Error(
          `Role '${roleId}' has reached its maximum assignee count of ${role.maxAssignees}`,
        );
      }
    }

    const now = new Date().toISOString();
    const assignment: RoleAssignment = {
      id: generateId(),
      identityId,
      roleId,
      scope: options?.scope,
      grantedBy,
      grantedAt: now,
      expiresAt: options?.expiresAt,
      justification: options?.justification,
      status: 'active',
    };

    const key = `${identityId}:${roleId}`;
    this._roleAssignments.set(key, assignment);
    this._invalidateCache();

    for (const cb of this._onRoleAssigned) {
      cb(assignment);
    }

    return { ...assignment };
  }

  /**
   * Revoke a role from an identity.
   *
   * The assignment is marked as `'revoked'` and retained for
   * audit purposes.
   *
   * @param identityId - The identity to revoke from.
   * @param roleId     - The role to revoke.
   * @param revokedBy  - The actor revoking the assignment.
   * @throws If the assignment does not exist.
   */
  revokeRole(identityId: string, roleId: string, revokedBy: string): void {
    const key = `${identityId}:${roleId}`;
    const assignment = this._roleAssignments.get(key);
    if (!assignment) {
      throw new Error(`Role assignment not found: ${identityId} -> ${roleId}`);
    }

    assignment.status = 'revoked';
    this._invalidateCache();

    for (const cb of this._onRoleRevoked) {
      cb(identityId, roleId, revokedBy);
    }
  }

  /**
   * Get all active role assignments for an identity.
   *
   * @param identityId - The identity to look up.
   * @returns An array of active role assignments.
   */
  getRoleAssignments(identityId: string): RoleAssignment[] {
    const results: RoleAssignment[] = [];

    for (const assignment of this._roleAssignments.values()) {
      if (assignment.identityId === identityId && assignment.status === 'active') {
        results.push({ ...assignment });
      }
    }

    return results;
  }

  /**
   * Check whether a role is actively assigned to an identity.
   *
   * Expired assignments are treated as inactive.
   *
   * @param identityId - The identity to check.
   * @param roleId     - The role to check.
   * @returns `true` if the role is actively assigned.
   */
  isRoleAssigned(identityId: string, roleId: string): boolean {
    const key = `${identityId}:${roleId}`;
    const assignment = this._roleAssignments.get(key);

    if (!assignment || assignment.status !== 'active') return false;

    // Check expiration
    if (assignment.expiresAt) {
      if (new Date(assignment.expiresAt).getTime() < Date.now()) {
        assignment.status = 'expired';
        return false;
      }
    }

    return true;
  }

  // ── Authorization Decision ───────────────────────────────

  /**
   * Evaluate an authorization request and return a decision.
   *
   * The evaluation proceeds through these stages:
   *
   * 1. **Cache check** -- if a cached decision exists and has
   *    not expired it is returned immediately.
   * 2. **Role resolution** -- the subject's direct and inherited
   *    roles are collected.
   * 3. **RBAC evaluation** -- permissions from resolved roles are
   *    tested against the requested resource and action. Both
   *    `allow` and `deny` effects are recorded.
   * 4. **ABAC evaluation** -- permissions with conditions are
   *    further evaluated against the request environment and
   *    context. Conditions that fail demote an `allow` match.
   * 5. **PBAC evaluation** -- enabled access policies matching
   *    the subject and resource are evaluated. Their conditions
   *    and effects feed into the overall decision.
   * 6. **Deny-overrides** -- if *any* evaluation produced an
   *    explicit `deny`, the final decision is `deny`.
   * 7. **Result** -- a comprehensive `AuthorizationDecision`
   *    is returned, cached, and relevant callbacks are fired.
   *
   * @param request - The authorization request to evaluate.
   * @returns The authorization decision.
   */
  authorize(request: AuthorizationRequest): AuthorizationDecision {
    const startTime = Date.now();

    // 0. Check cache
    const cacheKey = this._buildCacheKey(request);
    const cached = this._getCached(cacheKey);
    if (cached) {
      this._totalDecisions++;
      if (!cached.allowed) this._denyCount++;
      return cached;
    }

    // 1. Collect subject's roles (direct + inherited)
    const directRoleIds = this._getDirectRoleIds(request.subjectId);
    const allRoleIds = new Set<string>();
    for (const roleId of directRoleIds) {
      this._collectInheritedRoleIds(roleId, allRoleIds);
    }

    const matchedRoles: string[] = [];
    const matchedPermissions: string[] = [];
    const allObligations: AuthorizationObligation[] = [];
    const allAdvice: string[] = [];

    let hasAllow = false;
    let hasDeny = false;

    // 2. RBAC + ABAC evaluation
    for (const roleId of allRoleIds) {
      const role = this._roles.get(roleId);
      if (!role) continue;

      for (const perm of role.permissions) {
        // Check resource match
        if (!this._resourceMatches(perm.resource, request.resource)) continue;

        // Check action match
        if (!this._actionMatches(perm.actions, request.action)) continue;

        // ABAC: evaluate conditions if present
        if (perm.conditions && perm.conditions.length > 0) {
          const conditionContext = this._buildConditionContext(request);
          const conditionsMet = this.evaluateConditions(perm.conditions, conditionContext);

          if (!conditionsMet) {
            // Conditions not met -- this permission does not apply
            continue;
          }
        }

        // Permission matches
        matchedPermissions.push(perm.id);

        if (!matchedRoles.includes(roleId)) {
          matchedRoles.push(roleId);
        }

        if (perm.effect === 'deny') {
          hasDeny = true;
        } else {
          hasAllow = true;
        }
      }
    }

    // 3. PBAC evaluation
    const matchedPolicies: string[] = [];
    const sortedPolicies = Array.from(this._policies.values())
      .filter((p) => p.enabled)
      .sort((a, b) => b.priority - a.priority);

    for (const policy of sortedPolicies) {
      // Check if the policy applies to this subject
      if (!this._policyMatchesSubject(policy, request)) continue;

      // Check if the policy applies to this resource
      if (!this._policyMatchesResource(policy, request)) continue;

      // Check if the policy applies to this action
      if (!this._policyMatchesAction(policy, request.action)) continue;

      // Evaluate policy conditions (ABAC conditions within PBAC)
      if (policy.conditions && policy.conditions.length > 0) {
        const conditionContext = this._buildConditionContext(request);
        const conditionsMet = this.evaluateConditions(policy.conditions, conditionContext);
        if (!conditionsMet) continue;
      }

      // Policy matches
      matchedPolicies.push(policy.id);

      if (policy.effect === 'deny') {
        hasDeny = true;
      } else {
        hasAllow = true;
      }

      // Collect obligations
      if (policy.obligations) {
        allObligations.push(...policy.obligations);
      }
    }

    // 4. Apply deny-overrides combining algorithm
    //    Any deny = deny. Otherwise, at least one allow is needed.
    let allowed: boolean;
    let effect: PermissionEffect;

    if (hasDeny) {
      allowed = false;
      effect = 'deny';
    } else if (hasAllow) {
      allowed = true;
      effect = 'allow';
    } else {
      // No matching permission or policy -- default deny
      allowed = false;
      effect = 'deny';
    }

    const evaluationTimeMs = Date.now() - startTime;

    const decision: AuthorizationDecision = {
      allowed,
      effect,
      matchedPolicies,
      matchedRoles,
      matchedPermissions,
      obligations: allObligations.length > 0 ? allObligations : undefined,
      advice: allAdvice.length > 0 ? allAdvice : undefined,
      evaluatedAt: new Date().toISOString(),
      evaluationTimeMs,
      cached: false,
    };

    // 5. Cache the decision
    this._setCache(cacheKey, decision);

    // 6. Update counters and fire callbacks
    this._totalDecisions++;

    if (allowed) {
      for (const cb of this._onAccessGranted) {
        cb(request, decision);
      }
    } else {
      this._denyCount++;
      for (const cb of this._onAccessDenied) {
        cb(request, decision);
      }
    }

    return decision;
  }

  /**
   * Evaluate multiple authorization requests in a single call.
   *
   * Each request is evaluated independently via {@link authorize}.
   *
   * @param requests - An array of authorization requests.
   * @returns An array of decisions in the same order.
   */
  batchAuthorize(requests: AuthorizationRequest[]): AuthorizationDecision[] {
    return requests.map((req) => this.authorize(req));
  }

  // ── Condition Evaluation ─────────────────────────────────

  /**
   * Evaluate a single ABAC condition against a context object.
   *
   * The condition's `source` field determines the top-level
   * key in the context (e.g. `'subject'`, `'resource'`,
   * `'environment'`, `'context'`). The `field` is then
   * resolved as a dot-delimited path under that source.
   *
   * Supported operators:
   * - `equals`      -- strict equality
   * - `notEquals`   -- strict inequality
   * - `contains`    -- string includes / array includes
   * - `in`          -- value is in an array
   * - `greaterThan` -- numeric greater-than
   * - `lessThan`    -- numeric less-than
   * - `between`     -- value is between [min, max] inclusive
   * - `matches`     -- regex match against a string
   * - `exists`      -- field is not null/undefined
   *
   * @param condition - The condition to evaluate.
   * @param context   - The context object with source keys.
   * @returns `true` if the condition is satisfied.
   */
  evaluateCondition(condition: PermissionCondition, context: Record<string, any>): boolean {
    const sourceObj = context[condition.source];
    if (sourceObj === undefined || sourceObj === null) {
      return condition.operator === 'exists' ? false : false;
    }

    const actual = this._resolveFieldPath(sourceObj, condition.field);

    switch (condition.operator) {
      case 'equals':
        return actual === condition.value;

      case 'notEquals':
        return actual !== condition.value;

      case 'contains':
        if (typeof actual === 'string') {
          return actual.includes(String(condition.value));
        }
        if (Array.isArray(actual)) {
          return actual.includes(condition.value);
        }
        return false;

      case 'in':
        if (Array.isArray(condition.value)) {
          return condition.value.includes(actual);
        }
        return false;

      case 'greaterThan':
        return typeof actual === 'number' && typeof condition.value === 'number'
          ? actual > condition.value
          : false;

      case 'lessThan':
        return typeof actual === 'number' && typeof condition.value === 'number'
          ? actual < condition.value
          : false;

      case 'between':
        if (
          typeof actual === 'number' &&
          Array.isArray(condition.value) &&
          condition.value.length === 2
        ) {
          const [min, max] = condition.value as [number, number];
          return actual >= min && actual <= max;
        }
        return false;

      case 'matches':
        if (typeof actual === 'string' && typeof condition.value === 'string') {
          try {
            const regex = new RegExp(condition.value);
            return regex.test(actual);
          } catch {
            return false;
          }
        }
        return false;

      case 'exists':
        return actual !== undefined && actual !== null;

      default:
        return false;
    }
  }

  /**
   * Evaluate multiple conditions with AND semantics.
   *
   * All conditions must be satisfied for the result to be `true`.
   *
   * @param conditions - The conditions to evaluate.
   * @param context    - The context object with source keys.
   * @returns `true` if all conditions are satisfied.
   */
  evaluateConditions(conditions: PermissionCondition[], context: Record<string, any>): boolean {
    if (conditions.length === 0) return true;

    for (const condition of conditions) {
      if (!this.evaluateCondition(condition, context)) {
        return false;
      }
    }

    return true;
  }

  // ── Role Hierarchy ───────────────────────────────────────

  /**
   * Get all roles inherited from the given role by following
   * the `inheritsFrom` chain transitively.
   *
   * The result does **not** include the starting role itself.
   *
   * @param roleId - The role from which to follow inheritance.
   * @returns An array of inherited roles (deduplicated).
   */
  getInheritedRoles(roleId: string): Role[] {
    const visited = new Set<string>();
    visited.add(roleId); // Exclude the starting role from results

    const inherited: Role[] = [];
    this._collectInheritedRolesRecursive(roleId, visited, inherited);

    return inherited;
  }

  /**
   * Build a tree representation of the role hierarchy starting
   * from the given role.
   *
   * "Children" are roles that list `roleId` in their
   * `inheritsFrom` array (i.e. roles that inherit **from**
   * this role, making this role their parent).
   *
   * @param roleId - The root role for the hierarchy tree.
   * @returns A hierarchy node with recursive children.
   * @throws If the role does not exist.
   */
  getRoleHierarchy(roleId: string): RoleHierarchyNode {
    const role = this._roles.get(roleId);
    if (!role) throw new Error(`Role not found: ${roleId}`);

    return this._buildHierarchyNode(roleId, new Set<string>());
  }

  // ── Event Callbacks ──────────────────────────────────────

  /**
   * Register a callback fired when access is granted.
   * @param cb - The callback function.
   */
  onAccessGranted(cb: AccessGrantedCallback): void {
    this._onAccessGranted.push(cb);
  }

  /**
   * Register a callback fired when access is denied.
   * @param cb - The callback function.
   */
  onAccessDenied(cb: AccessDeniedCallback): void {
    this._onAccessDenied.push(cb);
  }

  /**
   * Register a callback fired when a role is assigned.
   * @param cb - The callback function.
   */
  onRoleAssigned(cb: RoleAssignedCallback): void {
    this._onRoleAssigned.push(cb);
  }

  /**
   * Register a callback fired when a role is revoked.
   * @param cb - The callback function.
   */
  onRoleRevoked(cb: RoleRevokedCallback): void {
    this._onRoleRevoked.push(cb);
  }

  /**
   * Register a callback fired when a policy is created.
   * @param cb - The callback function.
   */
  onPolicyCreated(cb: PolicyCreatedCallback): void {
    this._onPolicyCreated.push(cb);
  }

  /**
   * Register a callback fired when a policy is updated.
   * @param cb - The callback function.
   */
  onPolicyUpdated(cb: PolicyUpdatedCallback): void {
    this._onPolicyUpdated.push(cb);
  }

  /**
   * Register a callback fired when a policy is deleted.
   * @param cb - The callback function.
   */
  onPolicyDeleted(cb: PolicyDeletedCallback): void {
    this._onPolicyDeleted.push(cb);
  }

  // ── Aggregate Getters ────────────────────────────────────

  /** Total number of registered roles. */
  get roleCount(): number {
    return this._roles.size;
  }

  /** Total number of indexed permissions. */
  get permissionCount(): number {
    return this._permissions.size;
  }

  /** Total number of registered policies. */
  get policyCount(): number {
    return this._policies.size;
  }

  /** Total number of active role assignments. */
  get assignmentCount(): number {
    let count = 0;
    for (const a of this._roleAssignments.values()) {
      if (a.status === 'active') count++;
    }
    return count;
  }

  /** Total number of authorization decisions made. */
  get totalDecisions(): number {
    return this._totalDecisions;
  }

  /** Total number of deny decisions. */
  get denyCount(): number {
    return this._denyCount;
  }

  // ── Private Helpers: Role Resolution ─────────────────────

  /**
   * Get the IDs of roles directly (actively) assigned to an
   * identity.
   */
  private _getDirectRoleIds(identityId: string): string[] {
    const roleIds: string[] = [];
    for (const assignment of this._roleAssignments.values()) {
      if (assignment.identityId !== identityId) continue;
      if (assignment.status !== 'active') continue;

      // Check expiration
      if (assignment.expiresAt) {
        if (new Date(assignment.expiresAt).getTime() < Date.now()) {
          assignment.status = 'expired';
          continue;
        }
      }

      roleIds.push(assignment.roleId);
    }
    return roleIds;
  }

  /**
   * Recursively collect all role IDs reachable through the
   * `inheritsFrom` chain starting from `roleId`, including
   * `roleId` itself.
   */
  private _collectInheritedRoleIds(roleId: string, visited: Set<string>): void {
    if (visited.has(roleId)) return;
    visited.add(roleId);

    const role = this._roles.get(roleId);
    if (!role) return;

    for (const parentId of role.inheritsFrom) {
      this._collectInheritedRoleIds(parentId, visited);
    }
  }

  /**
   * Recursively collect inherited Role objects (excludes the
   * starting role).
   */
  private _collectInheritedRolesRecursive(
    roleId: string,
    visited: Set<string>,
    results: Role[],
  ): void {
    const role = this._roles.get(roleId);
    if (!role) return;

    for (const parentId of role.inheritsFrom) {
      if (visited.has(parentId)) continue;
      visited.add(parentId);

      const parentRole = this._roles.get(parentId);
      if (parentRole) {
        results.push(this._cloneRole(parentRole));
        this._collectInheritedRolesRecursive(parentId, visited, results);
      }
    }
  }

  // ── Private Helpers: Constraint Validation ───────────────

  /**
   * Validate role constraints before assignment.
   *
   * @throws If any constraint is violated.
   */
  private _validateRoleConstraints(identityId: string, role: Role): void {
    if (!role.constraints || role.constraints.length === 0) return;

    const currentRoleIds = this._getDirectRoleIds(identityId);

    for (const constraint of role.constraints) {
      switch (constraint.type) {
        case 'mutual-exclusion':
          if (constraint.targetRoleId && currentRoleIds.includes(constraint.targetRoleId)) {
            throw new Error(
              `Mutual exclusion constraint violated: identity '${identityId}' already holds ` +
                `role '${constraint.targetRoleId}' which conflicts with '${role.id}'` +
                (constraint.reason ? ` (${constraint.reason})` : ''),
            );
          }
          break;

        case 'prerequisite':
          if (constraint.targetRoleId && !currentRoleIds.includes(constraint.targetRoleId)) {
            throw new Error(
              `Prerequisite constraint violated: identity '${identityId}' must hold ` +
                `role '${constraint.targetRoleId}' before being assigned '${role.id}'` +
                (constraint.reason ? ` (${constraint.reason})` : ''),
            );
          }
          break;

        case 'temporal':
          if (constraint.startDate) {
            const start = new Date(constraint.startDate).getTime();
            if (Date.now() < start) {
              throw new Error(
                `Temporal constraint violated: role '${role.id}' cannot be assigned before ${constraint.startDate}` +
                  (constraint.reason ? ` (${constraint.reason})` : ''),
              );
            }
          }
          if (constraint.endDate) {
            const end = new Date(constraint.endDate).getTime();
            if (Date.now() > end) {
              throw new Error(
                `Temporal constraint violated: role '${role.id}' assignment period has ended (${constraint.endDate})` +
                  (constraint.reason ? ` (${constraint.reason})` : ''),
              );
            }
          }
          break;

        // cardinality is handled by maxAssignees on the Role itself
        case 'cardinality':
          if (constraint.maxCount !== undefined) {
            const identityRoleCount = currentRoleIds.length;
            if (identityRoleCount >= constraint.maxCount) {
              throw new Error(
                `Cardinality constraint violated: identity '${identityId}' already holds ` +
                  `${identityRoleCount} roles (max ${constraint.maxCount})` +
                  (constraint.reason ? ` (${constraint.reason})` : ''),
              );
            }
          }
          break;
      }
    }
  }

  /**
   * Count how many active assignments exist for a given role.
   */
  private _countAssigneesForRole(roleId: string): number {
    let count = 0;
    for (const assignment of this._roleAssignments.values()) {
      if (assignment.roleId === roleId && assignment.status === 'active') {
        count++;
      }
    }
    return count;
  }

  // ── Private Helpers: Matching ────────────────────────────

  /**
   * Check whether a permission's resource pattern matches
   * the requested resource.
   *
   * Supports:
   * - Exact match: `'users'` matches `'users'`.
   * - Wildcard: `'*'` matches anything.
   * - Prefix wildcard: `'users:*'` matches `'users:123'`.
   */
  private _resourceMatches(pattern: string, resource: string): boolean {
    if (pattern === '*') return true;
    if (pattern === resource) return true;

    // Prefix wildcard (e.g. "users:*" matches "users:123")
    if (pattern.endsWith(':*')) {
      const prefix = pattern.slice(0, -1); // "users:"
      return resource.startsWith(prefix);
    }

    // Glob-style wildcard (e.g. "documents/*" matches "documents/folder/file")
    if (pattern.endsWith('/*')) {
      const prefix = pattern.slice(0, -1); // "documents/"
      return resource.startsWith(prefix);
    }

    return false;
  }

  /**
   * Check whether the requested action is in the permission's
   * action list. Supports `'*'` as a wildcard for all actions.
   */
  private _actionMatches(permissionActions: string[], requestedAction: string): boolean {
    if (permissionActions.includes('*')) return true;
    return permissionActions.includes(requestedAction);
  }

  /**
   * Check whether a PBAC policy's subject specifications
   * match the authorization request's subject.
   */
  private _policyMatchesSubject(policy: AccessPolicy, request: AuthorizationRequest): boolean {
    if (!policy.subjects || policy.subjects.length === 0) return true;

    for (const subject of policy.subjects) {
      if (subject.type === 'any') return true;

      if (subject.type === 'user' && subject.identifier === request.subjectId) {
        return true;
      }

      if (subject.type === 'role') {
        // Check if the subject holds this role (direct or inherited)
        const directRoleIds = this._getDirectRoleIds(request.subjectId);
        const allRoleIds = new Set<string>();
        for (const roleId of directRoleIds) {
          this._collectInheritedRoleIds(roleId, allRoleIds);
        }
        if (allRoleIds.has(subject.identifier)) return true;
      }

      if (subject.type === 'service' && request.subjectType === 'service') {
        if (subject.identifier === request.subjectId) return true;
      }

      if (subject.type === 'group' && request.subjectType === 'group') {
        if (subject.identifier === request.subjectId) return true;
      }
    }

    return false;
  }

  /**
   * Check whether a PBAC policy's resource specifications
   * match the authorization request's resource.
   */
  private _policyMatchesResource(policy: AccessPolicy, request: AuthorizationRequest): boolean {
    if (!policy.resources || policy.resources.length === 0) return true;

    for (const res of policy.resources) {
      // Match by identifier pattern
      if (this._resourceMatches(res.identifier, request.resource)) {
        // If resource type is specified, it must also match
        if (res.type && request.resourceType) {
          if (res.type === request.resourceType || res.type === '*') return true;
        } else {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Check whether a PBAC policy's action list matches the
   * requested action.
   */
  private _policyMatchesAction(policy: AccessPolicy, action: string): boolean {
    if (!policy.actions || policy.actions.length === 0) return true;
    if (policy.actions.includes('*')) return true;
    return policy.actions.includes(action);
  }

  // ── Private Helpers: Condition Context ───────────────────

  /**
   * Build a context object for ABAC condition evaluation from
   * an authorization request.
   *
   * The context has four top-level keys matching the
   * `PermissionCondition.source` values:
   * - `subject` -- contains `{ id, type }` plus any request context
   * - `resource` -- contains `{ name, type }` from the request
   * - `environment` -- contains the request's environment map
   * - `context` -- contains the request's context map
   */
  private _buildConditionContext(request: AuthorizationRequest): Record<string, any> {
    return {
      subject: {
        id: request.subjectId,
        type: request.subjectType ?? 'user',
        ...(request.context ?? {}),
      },
      resource: {
        name: request.resource,
        type: request.resourceType,
      },
      environment: request.environment ?? {},
      context: request.context ?? {},
    };
  }

  /**
   * Resolve a dot-delimited field path against an object.
   *
   * For example, `"department.name"` resolves
   * `obj.department.name`.
   */
  private _resolveFieldPath(obj: any, path: string): any {
    const parts = path.split('.');
    let current: any = obj;

    for (const part of parts) {
      if (current === null || current === undefined) return undefined;
      if (typeof current !== 'object') return undefined;
      current = current[part];
    }

    return current;
  }

  // ── Private Helpers: Cache ───────────────────────────────

  /**
   * Build a deterministic cache key from an authorization
   * request.
   */
  private _buildCacheKey(request: AuthorizationRequest): string {
    const parts = [
      request.subjectId,
      request.subjectType ?? '',
      request.resource,
      request.resourceType ?? '',
      request.action,
    ];

    // Include environment and context in the key when present,
    // since they affect condition evaluation.
    if (request.environment) {
      parts.push(JSON.stringify(request.environment));
    }
    if (request.context) {
      parts.push(JSON.stringify(request.context));
    }

    return parts.join('|');
  }

  /**
   * Retrieve a cached decision if it exists and has not expired.
   */
  private _getCached(key: string): AuthorizationDecision | undefined {
    const entry = this._cache.get(key);
    if (!entry) return undefined;

    if (Date.now() > entry.expiresAt) {
      this._cache.delete(key);
      return undefined;
    }

    return { ...entry.decision, cached: true };
  }

  /**
   * Store a decision in the cache.
   */
  private _setCache(key: string, decision: AuthorizationDecision): void {
    this._cache.set(key, {
      decision: { ...decision },
      expiresAt: Date.now() + this._cacheTtlMs,
    });
  }

  /**
   * Invalidate the entire authorization cache.
   *
   * Called whenever roles, policies, or assignments change.
   */
  private _invalidateCache(): void {
    this._cache.clear();
  }

  // ── Private Helpers: Role Hierarchy Tree ─────────────────

  /**
   * Recursively build a hierarchy node for the given role.
   *
   * Children are roles whose `inheritsFrom` array contains
   * this role's ID.
   */
  private _buildHierarchyNode(roleId: string, visited: Set<string>): RoleHierarchyNode {
    const role = this._roles.get(roleId);
    if (!role) throw new Error(`Role not found: ${roleId}`);

    visited.add(roleId);

    // Find child roles (roles that inherit from this role)
    const children: RoleHierarchyNode[] = [];
    for (const [candidateId, candidateRole] of this._roles) {
      if (visited.has(candidateId)) continue;
      if (candidateRole.inheritsFrom.includes(roleId)) {
        children.push(this._buildHierarchyNode(candidateId, visited));
      }
    }

    return {
      role: this._cloneRole(role),
      children,
    };
  }

  // ── Private Helpers: Cloning ─────────────────────────────

  /**
   * Create a shallow defensive copy of a role.
   */
  private _cloneRole(role: Role): Role {
    return {
      ...role,
      permissions: role.permissions.map((p) => ({ ...p })),
      inheritsFrom: [...role.inheritsFrom],
      constraints: role.constraints ? [...role.constraints] : undefined,
      tags: [...role.tags],
      metadata: { ...role.metadata },
    };
  }
}
