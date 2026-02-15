// ============================================================
// SOA One IAM — Identity Management
// ============================================================
//
// Comprehensive identity lifecycle management subsystem.
// Surpasses Oracle Identity Manager with:
//
// - Full identity lifecycle (staged -> active -> deprovisioned)
// - Status transitions with validation and event callbacks
// - Role and group assignment with audit trail
// - Organization hierarchy management
// - Static, dynamic, and organizational group evaluation
// - Provisioning workflow (request -> approve/reject -> complete)
// - Self-service profile management and bulk operations
// - Multi-criteria identity search with pagination and sorting
// - Event-driven architecture with callback arrays
// - Organizational hierarchy traversal
// - Identity delegation and impersonation tracking
// - Password-expired and locked state management
//
// Zero external dependencies. 100% in-memory Maps.
// ============================================================

import type {
  Identity,
  IdentityCreateRequest,
  IdentityUpdateRequest,
  IdentitySearchQuery,
  IdentityStatus,
  IdentityType,
  Organization,
  IdentityGroup,
  GroupDynamicRule,
  ProvisioningRecord,
  ProvisioningAction,
} from './types';

// ── Helpers ─────────────────────────────────────────────────

/**
 * Generate a unique ID prefixed with `iam_`, using the current
 * timestamp (hex) combined with a random hex suffix.
 *
 * Format: `iam_<timestampHex><randomHex>`
 *
 * These IDs are suitable for all IAM entities — identities,
 * organizations, groups, provisioning records, etc.
 */
export function generateId(): string {
  const ts = Date.now().toString(16);
  const rand = Math.random().toString(16).substring(2, 10);
  return `iam_${ts}${rand}`;
}

// ── Internal types ──────────────────────────────────────────

/** Callback signature for identity lifecycle events. */
type IdentityCallback = (identity: Identity) => void;

/** Callback signature for provisioning events. */
type ProvisioningCallback = (record: ProvisioningRecord) => void;

/** Callback signature for organization events. */
type OrganizationCallback = (org: Organization) => void;

/** Callback signature for group events. */
type GroupCallback = (group: IdentityGroup) => void;

/**
 * Allowed status transitions. Each key is the current status,
 * and the value array lists every status it may transition to.
 *
 * This enforces a strict lifecycle state machine:
 *
 * ```
 * staged -> provisioned -> active <-> suspended
 *                            |   <-> locked
 *                            |   -> password-expired -> active
 *                            +-> deprovisioned -> deleted
 * ```
 */
const ALLOWED_TRANSITIONS: Record<IdentityStatus, IdentityStatus[]> = {
  'staged':            ['provisioned', 'active', 'deleted'],
  'provisioned':       ['active', 'deprovisioned', 'deleted'],
  'active':            ['suspended', 'locked', 'password-expired', 'deprovisioned', 'deleted'],
  'suspended':         ['active', 'deprovisioned', 'deleted'],
  'locked':            ['active', 'deprovisioned', 'deleted'],
  'password-expired':  ['active', 'locked', 'deprovisioned', 'deleted'],
  'deprovisioned':     ['provisioned', 'active', 'deleted'],
  'deleted':           [],
};

// ── Identity Manager ────────────────────────────────────────

/**
 * Central identity management engine for the IAM module.
 *
 * Manages the full identity lifecycle — creation, activation,
 * suspension, locking, deprovisioning, and deletion — along
 * with role assignments, group memberships, organizational
 * hierarchy, provisioning workflows, self-service operations,
 * and bulk identity management.
 *
 * All data is stored in in-memory Maps; there are no external
 * dependencies.
 *
 * Usage:
 * ```ts
 * const mgr = new IdentityManager();
 *
 * // Create an identity
 * const id = mgr.createIdentity({
 *   username: 'jdoe',
 *   email: 'jdoe@example.com',
 *   displayName: 'Jane Doe',
 *   firstName: 'Jane',
 *   lastName: 'Doe',
 * });
 *
 * // Activate
 * mgr.activate(id.id, 'admin');
 *
 * // Assign a role
 * mgr.assignRole(id.id, 'editor', 'admin');
 *
 * // Search
 * const results = mgr.searchIdentities({ status: 'active' });
 * ```
 */
export class IdentityManager {
  // ── Storage ──────────────────────────────────────────────

  private readonly _identities = new Map<string, Identity>();
  private readonly _organizations = new Map<string, Organization>();
  private readonly _groups = new Map<string, IdentityGroup>();
  private readonly _provisioningRecords = new Map<string, ProvisioningRecord>();

  // ── Audit log ────────────────────────────────────────────

  private readonly _auditLog: Array<{
    timestamp: string;
    action: string;
    identityId?: string;
    actor: string;
    details: Record<string, any>;
  }> = [];

  // ── Event callbacks ──────────────────────────────────────

  private readonly _onCreated: IdentityCallback[] = [];
  private readonly _onUpdated: IdentityCallback[] = [];
  private readonly _onActivated: IdentityCallback[] = [];
  private readonly _onSuspended: IdentityCallback[] = [];
  private readonly _onLocked: IdentityCallback[] = [];
  private readonly _onUnlocked: IdentityCallback[] = [];
  private readonly _onDeprovisioned: IdentityCallback[] = [];
  private readonly _onDeleted: IdentityCallback[] = [];
  private readonly _onStatusChanged: Array<(identity: Identity, from: IdentityStatus, to: IdentityStatus) => void> = [];
  private readonly _onRoleAssigned: Array<(identity: Identity, role: string) => void> = [];
  private readonly _onRoleRevoked: Array<(identity: Identity, role: string) => void> = [];
  private readonly _onGroupAssigned: Array<(identity: Identity, groupId: string) => void> = [];
  private readonly _onGroupRemoved: Array<(identity: Identity, groupId: string) => void> = [];
  private readonly _onProvisioningCreated: ProvisioningCallback[] = [];
  private readonly _onProvisioningApproved: ProvisioningCallback[] = [];
  private readonly _onProvisioningRejected: ProvisioningCallback[] = [];
  private readonly _onProvisioningCompleted: ProvisioningCallback[] = [];
  private readonly _onOrganizationCreated: OrganizationCallback[] = [];
  private readonly _onOrganizationUpdated: OrganizationCallback[] = [];
  private readonly _onGroupCreated: GroupCallback[] = [];
  private readonly _onGroupUpdated: GroupCallback[] = [];
  private readonly _onBulkOperation: Array<(operation: string, count: number, results: BulkOperationResult) => void> = [];

  // ════════════════════════════════════════════════════════
  // Identity CRUD
  // ════════════════════════════════════════════════════════

  /**
   * Create a new identity.
   *
   * The identity starts in `staged` status. Optionally set
   * `type`, roles, groups, tags, and arbitrary attributes
   * through the request object.
   *
   * @param request - Identity creation parameters.
   * @param createdBy - The actor performing the creation (defaults to `'system'`).
   * @returns The fully populated `Identity` record.
   */
  createIdentity(request: IdentityCreateRequest, createdBy: string = 'system'): Identity {
    // Validate required fields
    if (!request.username || request.username.trim().length === 0) {
      throw new Error('Username is required');
    }
    if (!request.email || request.email.trim().length === 0) {
      throw new Error('Email is required');
    }
    if (!request.displayName || request.displayName.trim().length === 0) {
      throw new Error('Display name is required');
    }

    // Check for duplicate username
    for (const existing of this._identities.values()) {
      if (existing.username === request.username && existing.status !== 'deleted') {
        throw new Error(`Username '${request.username}' is already in use`);
      }
    }

    // Check for duplicate email
    for (const existing of this._identities.values()) {
      if (existing.email === request.email && existing.status !== 'deleted') {
        throw new Error(`Email '${request.email}' is already in use`);
      }
    }

    const now = new Date().toISOString();
    const id = generateId();

    const identity: Identity = {
      id,
      username: request.username.trim(),
      email: request.email.trim().toLowerCase(),
      emailVerified: false,
      phone: request.phone,
      phoneVerified: false,
      displayName: request.displayName.trim(),
      firstName: request.firstName?.trim(),
      lastName: request.lastName?.trim(),
      type: request.type ?? 'user',
      status: 'staged',
      verificationLevel: 'unverified',
      organizationId: request.organizationId,
      departmentId: request.departmentId,
      managerId: request.managerId,
      title: request.title,
      locale: request.locale,
      timezone: request.timezone,
      attributes: request.attributes ?? {},
      roles: request.roles ? [...request.roles] : [],
      groups: request.groups ? [...request.groups] : [],
      tags: request.tags ? [...request.tags] : [],
      metadata: request.metadata ?? {},
      createdAt: now,
      updatedAt: now,
      createdBy,
      updatedBy: createdBy,
    };

    this._identities.set(id, identity);

    this._audit('identity.create', id, createdBy, {
      username: identity.username,
      email: identity.email,
      type: identity.type,
    });

    this._emit(this._onCreated, identity);

    return identity;
  }

  /**
   * Retrieve an identity by its ID.
   *
   * @returns The `Identity` record, or `undefined` if not found.
   */
  getIdentity(identityId: string): Identity | undefined {
    return this._identities.get(identityId);
  }

  /**
   * Retrieve an identity by username.
   *
   * Searches all non-deleted identities for an exact username match.
   *
   * @returns The matching `Identity`, or `undefined`.
   */
  getIdentityByUsername(username: string): Identity | undefined {
    for (const identity of this._identities.values()) {
      if (identity.username === username && identity.status !== 'deleted') {
        return identity;
      }
    }
    return undefined;
  }

  /**
   * Retrieve an identity by email.
   *
   * Searches all non-deleted identities for an exact email match
   * (case-insensitive).
   *
   * @returns The matching `Identity`, or `undefined`.
   */
  getIdentityByEmail(email: string): Identity | undefined {
    const lower = email.toLowerCase();
    for (const identity of this._identities.values()) {
      if (identity.email.toLowerCase() === lower && identity.status !== 'deleted') {
        return identity;
      }
    }
    return undefined;
  }

  /**
   * Update mutable fields on an existing identity.
   *
   * Only the fields present in `updates` are applied; all
   * others remain unchanged. The `updatedAt` timestamp is
   * refreshed automatically.
   *
   * @param identityId - The identity to update.
   * @param updates - The fields to change.
   * @param updatedBy - The actor performing the update (defaults to `'system'`).
   * @returns The updated `Identity`, or `undefined` if not found.
   */
  updateIdentity(
    identityId: string,
    updates: IdentityUpdateRequest,
    updatedBy: string = 'system',
  ): Identity | undefined {
    const identity = this._identities.get(identityId);
    if (!identity) return undefined;

    if (identity.status === 'deleted') {
      throw new Error('Cannot update a deleted identity');
    }

    // Check for email uniqueness if email is being changed
    if (updates.email !== undefined && updates.email !== identity.email) {
      const normalised = updates.email.trim().toLowerCase();
      for (const existing of this._identities.values()) {
        if (existing.id !== identityId && existing.email.toLowerCase() === normalised && existing.status !== 'deleted') {
          throw new Error(`Email '${updates.email}' is already in use`);
        }
      }
    }

    const before = { ...identity };

    if (updates.displayName !== undefined) identity.displayName = updates.displayName.trim();
    if (updates.firstName !== undefined) identity.firstName = updates.firstName.trim();
    if (updates.lastName !== undefined) identity.lastName = updates.lastName.trim();
    if (updates.email !== undefined) {
      identity.email = updates.email.trim().toLowerCase();
      identity.emailVerified = false;
    }
    if (updates.phone !== undefined) {
      identity.phone = updates.phone;
      identity.phoneVerified = false;
    }
    if (updates.organizationId !== undefined) identity.organizationId = updates.organizationId;
    if (updates.departmentId !== undefined) identity.departmentId = updates.departmentId;
    if (updates.managerId !== undefined) identity.managerId = updates.managerId;
    if (updates.title !== undefined) identity.title = updates.title;
    if (updates.locale !== undefined) identity.locale = updates.locale;
    if (updates.timezone !== undefined) identity.timezone = updates.timezone;
    if (updates.attributes !== undefined) {
      identity.attributes = { ...identity.attributes, ...updates.attributes };
    }
    if (updates.tags !== undefined) identity.tags = [...updates.tags];
    if (updates.metadata !== undefined) {
      identity.metadata = { ...identity.metadata, ...updates.metadata };
    }

    identity.updatedAt = new Date().toISOString();
    identity.updatedBy = updatedBy;

    this._audit('identity.update', identityId, updatedBy, {
      changes: this._diff(before, identity),
    });

    this._emit(this._onUpdated, identity);

    return identity;
  }

  /**
   * Permanently delete an identity.
   *
   * Sets the identity status to `deleted`. The record remains
   * in the map for audit purposes but is excluded from all
   * queries and lookups by default.
   *
   * @returns `true` if the identity was found and deleted.
   */
  deleteIdentity(identityId: string, deletedBy: string = 'system'): boolean {
    const identity = this._identities.get(identityId);
    if (!identity) return false;
    if (identity.status === 'deleted') return false;

    const previousStatus = identity.status;
    identity.status = 'deleted';
    identity.updatedAt = new Date().toISOString();
    identity.updatedBy = deletedBy;

    // Remove from all groups
    for (const group of this._groups.values()) {
      if (identity.groups.includes(group.id)) {
        group.memberCount = Math.max(0, group.memberCount - 1);
      }
    }

    this._audit('identity.delete', identityId, deletedBy, {
      previousStatus,
      username: identity.username,
    });

    this._emit(this._onDeleted, identity);

    return true;
  }

  /**
   * Hard-delete an identity, removing it entirely from the map.
   *
   * Use sparingly — prefer `deleteIdentity` (soft-delete) to
   * retain audit history.
   *
   * @returns `true` if the identity existed and was purged.
   */
  purgeIdentity(identityId: string, purgedBy: string = 'system'): boolean {
    const identity = this._identities.get(identityId);
    if (!identity) return false;

    // Clean up group member counts
    for (const group of this._groups.values()) {
      if (identity.groups.includes(group.id)) {
        group.memberCount = Math.max(0, group.memberCount - 1);
      }
    }

    this._audit('identity.purge', identityId, purgedBy, {
      username: identity.username,
    });

    return this._identities.delete(identityId);
  }

  // ════════════════════════════════════════════════════════
  // Identity Search
  // ════════════════════════════════════════════════════════

  /**
   * Search identities with multi-criteria filtering, pagination,
   * and sorting.
   *
   * Supports filtering by status, type, organization, department,
   * role, group, tag, and full-text search across username, email,
   * display name, first name, and last name.
   *
   * @param query - Search criteria.
   * @returns An array of matching identities (excludes deleted by default).
   */
  searchIdentities(query: IdentitySearchQuery = {}): Identity[] {
    let results = Array.from(this._identities.values());

    // Exclude deleted identities unless explicitly searching for them
    if (query.status !== 'deleted') {
      results = results.filter((i) => i.status !== 'deleted');
    }

    // Filter by status
    if (query.status) {
      results = results.filter((i) => i.status === query.status);
    }

    // Filter by type
    if (query.type) {
      results = results.filter((i) => i.type === query.type);
    }

    // Filter by organization
    if (query.organizationId) {
      results = results.filter((i) => i.organizationId === query.organizationId);
    }

    // Filter by department
    if (query.departmentId) {
      results = results.filter((i) => i.departmentId === query.departmentId);
    }

    // Filter by role (identity has this role)
    if (query.role) {
      results = results.filter((i) => i.roles.includes(query.role!));
    }

    // Filter by group (identity is a member of this group)
    if (query.group) {
      results = results.filter((i) => i.groups.includes(query.group!));
    }

    // Filter by tag (identity has this tag)
    if (query.tag) {
      results = results.filter((i) => i.tags.includes(query.tag!));
    }

    // Full-text search across key identity fields
    if (query.search) {
      const lower = query.search.toLowerCase();
      results = results.filter((i) => {
        const haystack = [
          i.username,
          i.email,
          i.displayName,
          i.firstName ?? '',
          i.lastName ?? '',
          i.title ?? '',
          ...i.tags,
        ]
          .join(' ')
          .toLowerCase();
        return haystack.includes(lower);
      });
    }

    // Sort
    if (query.sortBy) {
      const order = query.sortOrder === 'desc' ? -1 : 1;
      results.sort((a, b) => {
        const aVal = (a as any)[query.sortBy!] ?? '';
        const bVal = (b as any)[query.sortBy!] ?? '';
        if (aVal < bVal) return -1 * order;
        if (aVal > bVal) return 1 * order;
        return 0;
      });
    }

    // Pagination
    const offset = query.offset ?? 0;
    const limit = query.limit ?? results.length;
    results = results.slice(offset, offset + limit);

    return results;
  }

  /**
   * Count identities matching the given query without returning
   * the full objects. More efficient for dashboard counters.
   */
  countIdentities(query: IdentitySearchQuery = {}): number {
    // Re-use search logic but only return the length
    return this.searchIdentities(query).length;
  }

  // ════════════════════════════════════════════════════════
  // Status Transitions
  // ════════════════════════════════════════════════════════

  /**
   * Activate an identity.
   *
   * Valid from: `staged`, `provisioned`, `suspended`, `locked`,
   * `password-expired`, `deprovisioned`.
   *
   * @returns The updated identity, or `undefined` if not found
   *          or the transition is invalid.
   */
  activate(identityId: string, activatedBy: string = 'system'): Identity | undefined {
    return this._transition(identityId, 'active', activatedBy, this._onActivated);
  }

  /**
   * Suspend an identity.
   *
   * Valid from: `active`.
   */
  suspend(identityId: string, suspendedBy: string = 'system', reason?: string): Identity | undefined {
    return this._transition(identityId, 'suspended', suspendedBy, this._onSuspended, reason);
  }

  /**
   * Unsuspend (reactivate) a suspended identity.
   *
   * This is a convenience alias for `activate` that is only
   * valid when the identity is currently `suspended`.
   */
  unsuspend(identityId: string, unsuspendedBy: string = 'system'): Identity | undefined {
    const identity = this._identities.get(identityId);
    if (!identity) return undefined;
    if (identity.status !== 'suspended') {
      throw new Error(
        `Cannot unsuspend identity '${identityId}': current status is '${identity.status}', expected 'suspended'`,
      );
    }
    return this._transition(identityId, 'active', unsuspendedBy, this._onActivated);
  }

  /**
   * Lock an identity (e.g. due to too many failed login attempts).
   *
   * Valid from: `active`, `password-expired`.
   */
  lock(identityId: string, lockedBy: string = 'system', reason?: string): Identity | undefined {
    return this._transition(identityId, 'locked', lockedBy, this._onLocked, reason);
  }

  /**
   * Unlock a locked identity.
   *
   * Valid from: `locked`.
   */
  unlock(identityId: string, unlockedBy: string = 'system'): Identity | undefined {
    const identity = this._identities.get(identityId);
    if (!identity) return undefined;
    if (identity.status !== 'locked') {
      throw new Error(
        `Cannot unlock identity '${identityId}': current status is '${identity.status}', expected 'locked'`,
      );
    }
    return this._transition(identityId, 'active', unlockedBy, this._onUnlocked);
  }

  /**
   * Deactivate (deprovision) an identity.
   *
   * Valid from: `active`, `suspended`, `locked`, `provisioned`,
   * `password-expired`.
   */
  deactivate(identityId: string, deactivatedBy: string = 'system', reason?: string): Identity | undefined {
    return this._transition(identityId, 'deprovisioned', deactivatedBy, this._onDeprovisioned, reason);
  }

  /**
   * Transition an identity to `provisioned` status.
   *
   * Valid from: `staged`, `deprovisioned`.
   */
  provision(identityId: string, provisionedBy: string = 'system'): Identity | undefined {
    return this._transition(identityId, 'provisioned', provisionedBy, []);
  }

  /**
   * Mark an identity's password as expired.
   *
   * Valid from: `active`.
   */
  expirePassword(identityId: string, expiredBy: string = 'system'): Identity | undefined {
    return this._transition(identityId, 'password-expired', expiredBy, []);
  }

  /**
   * Check whether a specific status transition is allowed.
   */
  canTransition(identityId: string, toStatus: IdentityStatus): boolean {
    const identity = this._identities.get(identityId);
    if (!identity) return false;
    return ALLOWED_TRANSITIONS[identity.status]?.includes(toStatus) ?? false;
  }

  // ════════════════════════════════════════════════════════
  // Role Management
  // ════════════════════════════════════════════════════════

  /**
   * Assign a role to an identity.
   *
   * No-op if the identity already has the role.
   *
   * @returns `true` if the role was newly assigned.
   */
  assignRole(identityId: string, role: string, assignedBy: string = 'system'): boolean {
    const identity = this._identities.get(identityId);
    if (!identity) return false;
    if (identity.status === 'deleted') return false;

    if (identity.roles.includes(role)) return false;

    identity.roles.push(role);
    identity.updatedAt = new Date().toISOString();
    identity.updatedBy = assignedBy;

    this._audit('role.assign', identityId, assignedBy, { role });

    for (const cb of this._onRoleAssigned) {
      cb(identity, role);
    }

    return true;
  }

  /**
   * Revoke a role from an identity.
   *
   * @returns `true` if the role was found and removed.
   */
  revokeRole(identityId: string, role: string, revokedBy: string = 'system'): boolean {
    const identity = this._identities.get(identityId);
    if (!identity) return false;

    const idx = identity.roles.indexOf(role);
    if (idx < 0) return false;

    identity.roles.splice(idx, 1);
    identity.updatedAt = new Date().toISOString();
    identity.updatedBy = revokedBy;

    this._audit('role.revoke', identityId, revokedBy, { role });

    for (const cb of this._onRoleRevoked) {
      cb(identity, role);
    }

    return true;
  }

  /**
   * Get all roles assigned to an identity.
   *
   * @returns An array of role identifiers, or an empty array
   *          if the identity is not found.
   */
  getRoles(identityId: string): string[] {
    const identity = this._identities.get(identityId);
    if (!identity) return [];
    return [...identity.roles];
  }

  /**
   * Check whether an identity has a specific role.
   */
  hasRole(identityId: string, role: string): boolean {
    const identity = this._identities.get(identityId);
    if (!identity) return false;
    return identity.roles.includes(role);
  }

  /**
   * Replace all roles on an identity with a new set.
   *
   * @returns The updated identity, or `undefined` if not found.
   */
  setRoles(identityId: string, roles: string[], setBy: string = 'system'): Identity | undefined {
    const identity = this._identities.get(identityId);
    if (!identity) return undefined;
    if (identity.status === 'deleted') return undefined;

    const previousRoles = [...identity.roles];
    identity.roles = [...roles];
    identity.updatedAt = new Date().toISOString();
    identity.updatedBy = setBy;

    this._audit('role.set', identityId, setBy, {
      previousRoles,
      newRoles: roles,
    });

    return identity;
  }

  // ════════════════════════════════════════════════════════
  // Group Membership (on Identity)
  // ════════════════════════════════════════════════════════

  /**
   * Assign an identity to a group.
   *
   * Updates both the identity's group list and the group's
   * `memberCount`. No-op if the identity is already a member.
   *
   * @returns `true` if the identity was newly added to the group.
   */
  assignGroup(identityId: string, groupId: string, assignedBy: string = 'system'): boolean {
    const identity = this._identities.get(identityId);
    if (!identity) return false;
    if (identity.status === 'deleted') return false;

    if (identity.groups.includes(groupId)) return false;

    identity.groups.push(groupId);
    identity.updatedAt = new Date().toISOString();
    identity.updatedBy = assignedBy;

    // Update group member count
    const group = this._groups.get(groupId);
    if (group) {
      group.memberCount += 1;
      group.updatedAt = new Date().toISOString();
    }

    this._audit('group.assign', identityId, assignedBy, { groupId });

    for (const cb of this._onGroupAssigned) {
      cb(identity, groupId);
    }

    return true;
  }

  /**
   * Remove an identity from a group.
   *
   * @returns `true` if the identity was a member and was removed.
   */
  removeGroup(identityId: string, groupId: string, removedBy: string = 'system'): boolean {
    const identity = this._identities.get(identityId);
    if (!identity) return false;

    const idx = identity.groups.indexOf(groupId);
    if (idx < 0) return false;

    identity.groups.splice(idx, 1);
    identity.updatedAt = new Date().toISOString();
    identity.updatedBy = removedBy;

    // Update group member count
    const group = this._groups.get(groupId);
    if (group) {
      group.memberCount = Math.max(0, group.memberCount - 1);
      group.updatedAt = new Date().toISOString();
    }

    this._audit('group.remove', identityId, removedBy, { groupId });

    for (const cb of this._onGroupRemoved) {
      cb(identity, groupId);
    }

    return true;
  }

  /**
   * Get all group IDs that an identity belongs to.
   *
   * @returns An array of group IDs, or an empty array if the
   *          identity is not found.
   */
  getGroups(identityId: string): string[] {
    const identity = this._identities.get(identityId);
    if (!identity) return [];
    return [...identity.groups];
  }

  /**
   * Check whether an identity is a member of a specific group.
   */
  isMemberOfGroup(identityId: string, groupId: string): boolean {
    const identity = this._identities.get(identityId);
    if (!identity) return false;
    return identity.groups.includes(groupId);
  }

  // ════════════════════════════════════════════════════════
  // Organization Management
  // ════════════════════════════════════════════════════════

  /**
   * Create a new organization.
   *
   * @param config - Organization details. `id` is auto-generated
   *                 if omitted.
   * @returns The created `Organization`.
   */
  createOrganization(
    config: Omit<Organization, 'id' | 'createdAt' | 'updatedAt'> & {
      id?: string;
      createdAt?: string;
      updatedAt?: string;
    },
  ): Organization {
    if (!config.name || config.name.trim().length === 0) {
      throw new Error('Organization name is required');
    }

    // Check for duplicate organization name
    for (const existing of this._organizations.values()) {
      if (existing.name === config.name && existing.status !== 'inactive') {
        throw new Error(`Organization name '${config.name}' is already in use`);
      }
    }

    const now = new Date().toISOString();
    const id = config.id ?? generateId();

    // Validate parent exists if specified
    if (config.parentId && !this._organizations.has(config.parentId)) {
      throw new Error(`Parent organization '${config.parentId}' does not exist`);
    }

    const org: Organization = {
      id,
      name: config.name.trim(),
      displayName: config.displayName.trim(),
      description: config.description,
      parentId: config.parentId,
      status: config.status ?? 'active',
      domains: config.domains ? [...config.domains] : [],
      attributes: config.attributes ?? {},
      metadata: config.metadata ?? {},
      createdAt: config.createdAt ?? now,
      updatedAt: config.updatedAt ?? now,
    };

    this._organizations.set(id, org);

    this._audit('organization.create', undefined, 'system', {
      organizationId: id,
      name: org.name,
    });

    this._emit(this._onOrganizationCreated, org);

    return org;
  }

  /**
   * Retrieve an organization by ID.
   */
  getOrganization(organizationId: string): Organization | undefined {
    return this._organizations.get(organizationId);
  }

  /**
   * Update an existing organization.
   *
   * @returns The updated organization, or `undefined` if not found.
   */
  updateOrganization(
    organizationId: string,
    updates: Partial<Omit<Organization, 'id' | 'createdAt'>>,
  ): Organization | undefined {
    const org = this._organizations.get(organizationId);
    if (!org) return undefined;

    if (updates.name !== undefined) org.name = updates.name.trim();
    if (updates.displayName !== undefined) org.displayName = updates.displayName.trim();
    if (updates.description !== undefined) org.description = updates.description;
    if (updates.parentId !== undefined) {
      if (updates.parentId && !this._organizations.has(updates.parentId)) {
        throw new Error(`Parent organization '${updates.parentId}' does not exist`);
      }
      if (updates.parentId === organizationId) {
        throw new Error('An organization cannot be its own parent');
      }
      org.parentId = updates.parentId;
    }
    if (updates.status !== undefined) org.status = updates.status;
    if (updates.domains !== undefined) org.domains = [...updates.domains];
    if (updates.attributes !== undefined) org.attributes = { ...org.attributes, ...updates.attributes };
    if (updates.metadata !== undefined) org.metadata = { ...org.metadata, ...updates.metadata };

    org.updatedAt = new Date().toISOString();

    this._audit('organization.update', undefined, 'system', {
      organizationId,
    });

    this._emit(this._onOrganizationUpdated, org);

    return org;
  }

  /**
   * List all organizations, optionally filtered by status.
   */
  listOrganizations(status?: Organization['status']): Organization[] {
    const results = Array.from(this._organizations.values());
    if (status) {
      return results.filter((o) => o.status === status);
    }
    return results;
  }

  /**
   * Get child organizations of a given parent.
   */
  getChildOrganizations(parentId: string): Organization[] {
    return Array.from(this._organizations.values()).filter(
      (o) => o.parentId === parentId,
    );
  }

  /**
   * Build the full hierarchy path from a given organization up
   * to the root. Returns an array of organizations starting
   * from the root down to the specified org.
   */
  getOrganizationHierarchy(organizationId: string): Organization[] {
    const path: Organization[] = [];
    const visited = new Set<string>();
    let current = this._organizations.get(organizationId);

    while (current && !visited.has(current.id)) {
      visited.add(current.id);
      path.unshift(current);
      if (current.parentId) {
        current = this._organizations.get(current.parentId);
      } else {
        break;
      }
    }

    return path;
  }

  /**
   * Get all identities belonging to an organization.
   */
  getOrganizationMembers(organizationId: string): Identity[] {
    return Array.from(this._identities.values()).filter(
      (i) => i.organizationId === organizationId && i.status !== 'deleted',
    );
  }

  // ════════════════════════════════════════════════════════
  // Group Management
  // ════════════════════════════════════════════════════════

  /**
   * Create a new group.
   *
   * @param config - Group details. `id` is auto-generated if omitted.
   * @returns The created `IdentityGroup`.
   */
  createGroup(
    config: Omit<IdentityGroup, 'id' | 'memberCount' | 'createdAt' | 'updatedAt'> & {
      id?: string;
      memberCount?: number;
      createdAt?: string;
      updatedAt?: string;
    },
  ): IdentityGroup {
    if (!config.name || config.name.trim().length === 0) {
      throw new Error('Group name is required');
    }

    // Check for duplicate group name within the same organization scope
    for (const existing of this._groups.values()) {
      if (existing.name === config.name && existing.organizationId === config.organizationId) {
        throw new Error(`Group name '${config.name}' is already in use within this scope`);
      }
    }

    const now = new Date().toISOString();
    const id = config.id ?? generateId();

    // Validate parent group exists if specified
    if (config.parentGroupId && !this._groups.has(config.parentGroupId)) {
      throw new Error(`Parent group '${config.parentGroupId}' does not exist`);
    }

    const group: IdentityGroup = {
      id,
      name: config.name.trim(),
      displayName: config.displayName.trim(),
      description: config.description,
      type: config.type ?? 'static',
      organizationId: config.organizationId,
      parentGroupId: config.parentGroupId,
      memberCount: config.memberCount ?? 0,
      dynamicRule: config.dynamicRule,
      attributes: config.attributes ?? {},
      metadata: config.metadata ?? {},
      createdAt: config.createdAt ?? now,
      updatedAt: config.updatedAt ?? now,
    };

    this._groups.set(id, group);

    this._audit('group.create', undefined, 'system', {
      groupId: id,
      name: group.name,
      type: group.type,
    });

    this._emit(this._onGroupCreated, group);

    return group;
  }

  /**
   * Retrieve a group by ID.
   */
  getGroup(groupId: string): IdentityGroup | undefined {
    return this._groups.get(groupId);
  }

  /**
   * Update an existing group.
   *
   * @returns The updated group, or `undefined` if not found.
   */
  updateGroup(
    groupId: string,
    updates: Partial<Omit<IdentityGroup, 'id' | 'createdAt'>>,
  ): IdentityGroup | undefined {
    const group = this._groups.get(groupId);
    if (!group) return undefined;

    if (updates.name !== undefined) group.name = updates.name.trim();
    if (updates.displayName !== undefined) group.displayName = updates.displayName.trim();
    if (updates.description !== undefined) group.description = updates.description;
    if (updates.type !== undefined) group.type = updates.type;
    if (updates.organizationId !== undefined) group.organizationId = updates.organizationId;
    if (updates.parentGroupId !== undefined) {
      if (updates.parentGroupId === groupId) {
        throw new Error('A group cannot be its own parent');
      }
      group.parentGroupId = updates.parentGroupId;
    }
    if (updates.dynamicRule !== undefined) group.dynamicRule = updates.dynamicRule;
    if (updates.attributes !== undefined) group.attributes = { ...group.attributes, ...updates.attributes };
    if (updates.metadata !== undefined) group.metadata = { ...group.metadata, ...updates.metadata };

    group.updatedAt = new Date().toISOString();

    this._audit('group.update', undefined, 'system', { groupId });

    this._emit(this._onGroupUpdated, group);

    return group;
  }

  /**
   * Delete a group by ID.
   *
   * Removes all identities from the group before deletion.
   *
   * @returns `true` if the group was found and deleted.
   */
  deleteGroup(groupId: string, deletedBy: string = 'system'): boolean {
    const group = this._groups.get(groupId);
    if (!group) return false;

    // Remove all identities from this group
    for (const identity of this._identities.values()) {
      const idx = identity.groups.indexOf(groupId);
      if (idx >= 0) {
        identity.groups.splice(idx, 1);
        identity.updatedAt = new Date().toISOString();
        identity.updatedBy = deletedBy;
      }
    }

    this._audit('group.delete', undefined, deletedBy, {
      groupId,
      name: group.name,
    });

    return this._groups.delete(groupId);
  }

  /**
   * List all groups, optionally filtered by type and/or organization.
   */
  listGroups(
    type?: IdentityGroup['type'],
    organizationId?: string,
  ): IdentityGroup[] {
    let results = Array.from(this._groups.values());

    if (type) {
      results = results.filter((g) => g.type === type);
    }
    if (organizationId) {
      results = results.filter((g) => g.organizationId === organizationId);
    }

    return results;
  }

  /**
   * Get all identity IDs that are members of a specific group.
   */
  getGroupMembers(groupId: string): Identity[] {
    return Array.from(this._identities.values()).filter(
      (i) => i.groups.includes(groupId) && i.status !== 'deleted',
    );
  }

  /**
   * Get child groups of a given parent group.
   */
  getChildGroups(parentGroupId: string): IdentityGroup[] {
    return Array.from(this._groups.values()).filter(
      (g) => g.parentGroupId === parentGroupId,
    );
  }

  /**
   * Evaluate all dynamic groups and update identity memberships
   * accordingly.
   *
   * Dynamic groups define membership through rules (e.g.
   * "all users in department X" or "all users with tag Y").
   * This method re-evaluates every dynamic group's rule against
   * every non-deleted identity, adding or removing memberships
   * as needed.
   *
   * @returns The number of membership changes made.
   */
  evaluateDynamicGroups(): number {
    let changes = 0;

    for (const group of this._groups.values()) {
      if (group.type !== 'dynamic') continue;
      if (!group.dynamicRule) continue;

      for (const identity of this._identities.values()) {
        if (identity.status === 'deleted') continue;

        const matches = this._evaluateRule(group.dynamicRule, identity);
        const isMember = identity.groups.includes(group.id);

        if (matches && !isMember) {
          identity.groups.push(group.id);
          group.memberCount += 1;
          identity.updatedAt = new Date().toISOString();
          changes++;
        } else if (!matches && isMember) {
          const idx = identity.groups.indexOf(group.id);
          if (idx >= 0) {
            identity.groups.splice(idx, 1);
            group.memberCount = Math.max(0, group.memberCount - 1);
            identity.updatedAt = new Date().toISOString();
            changes++;
          }
        }
      }
    }

    if (changes > 0) {
      this._audit('group.dynamic-evaluation', undefined, 'system', {
        changes,
      });
    }

    return changes;
  }

  // ════════════════════════════════════════════════════════
  // Provisioning Workflow
  // ════════════════════════════════════════════════════════

  /**
   * Create a new provisioning record (workflow request).
   *
   * Provisioning records track approval workflows for identity
   * lifecycle actions — e.g. "activate user X", "assign role Y
   * to user Z".
   *
   * @returns The created `ProvisioningRecord`.
   */
  createProvisioningRecord(
    identityId: string,
    action: ProvisioningAction,
    requestedBy: string,
    details: Record<string, any> = {},
    reason?: string,
  ): ProvisioningRecord {
    // Validate the identity exists
    const identity = this._identities.get(identityId);
    if (!identity) {
      throw new Error(`Identity '${identityId}' does not exist`);
    }

    const now = new Date().toISOString();
    const id = generateId();

    const record: ProvisioningRecord = {
      id,
      identityId,
      action,
      status: 'pending',
      requestedBy,
      reason,
      details,
      createdAt: now,
    };

    this._provisioningRecords.set(id, record);

    this._audit('provisioning.create', identityId, requestedBy, {
      provisioningId: id,
      action,
    });

    this._emit(this._onProvisioningCreated, record);

    return record;
  }

  /**
   * Approve a pending provisioning record.
   *
   * @returns The updated record, or `undefined` if not found or
   *          not in `pending` status.
   */
  approveProvisioning(
    recordId: string,
    approvedBy: string,
    reason?: string,
  ): ProvisioningRecord | undefined {
    const record = this._provisioningRecords.get(recordId);
    if (!record) return undefined;
    if (record.status !== 'pending') {
      throw new Error(
        `Cannot approve provisioning record '${recordId}': status is '${record.status}', expected 'pending'`,
      );
    }

    record.status = 'approved';
    record.approvedBy = approvedBy;
    if (reason) record.reason = reason;

    this._audit('provisioning.approve', record.identityId, approvedBy, {
      provisioningId: recordId,
      action: record.action,
    });

    this._emit(this._onProvisioningApproved, record);

    // Auto-execute the provisioned action
    this._executeProvisioningAction(record);

    return record;
  }

  /**
   * Reject a pending provisioning record.
   *
   * @returns The updated record, or `undefined` if not found or
   *          not in `pending` status.
   */
  rejectProvisioning(
    recordId: string,
    rejectedBy: string,
    reason?: string,
  ): ProvisioningRecord | undefined {
    const record = this._provisioningRecords.get(recordId);
    if (!record) return undefined;
    if (record.status !== 'pending') {
      throw new Error(
        `Cannot reject provisioning record '${recordId}': status is '${record.status}', expected 'pending'`,
      );
    }

    record.status = 'rejected';
    record.approvedBy = rejectedBy;
    record.completedAt = new Date().toISOString();
    if (reason) record.reason = reason;

    this._audit('provisioning.reject', record.identityId, rejectedBy, {
      provisioningId: recordId,
      action: record.action,
      reason,
    });

    this._emit(this._onProvisioningRejected, record);

    return record;
  }

  /**
   * Retrieve a provisioning record by ID.
   */
  getProvisioningRecord(recordId: string): ProvisioningRecord | undefined {
    return this._provisioningRecords.get(recordId);
  }

  /**
   * List all provisioning records, optionally filtered by
   * identity, status, or action.
   */
  listProvisioningRecords(filters?: {
    identityId?: string;
    status?: ProvisioningRecord['status'];
    action?: ProvisioningAction;
  }): ProvisioningRecord[] {
    let results = Array.from(this._provisioningRecords.values());

    if (filters?.identityId) {
      results = results.filter((r) => r.identityId === filters.identityId);
    }
    if (filters?.status) {
      results = results.filter((r) => r.status === filters.status);
    }
    if (filters?.action) {
      results = results.filter((r) => r.action === filters.action);
    }

    return results;
  }

  // ════════════════════════════════════════════════════════
  // Self-Service Operations
  // ════════════════════════════════════════════════════════

  /**
   * Self-service profile update — an identity updating its own
   * profile. Only allows safe, user-editable fields.
   *
   * @returns The updated identity, or `undefined` if not found.
   */
  updateOwnProfile(
    identityId: string,
    updates: Pick<IdentityUpdateRequest, 'displayName' | 'firstName' | 'lastName' | 'phone' | 'locale' | 'timezone'>,
  ): Identity | undefined {
    const identity = this._identities.get(identityId);
    if (!identity) return undefined;
    if (identity.status !== 'active') {
      throw new Error('Only active identities can update their profile');
    }

    return this.updateIdentity(identityId, updates, identityId);
  }

  /**
   * Record a login event for an identity.
   */
  recordLogin(identityId: string): Identity | undefined {
    const identity = this._identities.get(identityId);
    if (!identity) return undefined;

    const now = new Date().toISOString();
    identity.lastLoginAt = now;
    identity.lastActivityAt = now;
    identity.updatedAt = now;

    return identity;
  }

  /**
   * Record an activity event for an identity.
   */
  recordActivity(identityId: string): Identity | undefined {
    const identity = this._identities.get(identityId);
    if (!identity) return undefined;

    const now = new Date().toISOString();
    identity.lastActivityAt = now;

    return identity;
  }

  /**
   * Verify an identity's email.
   */
  verifyEmail(identityId: string, verifiedBy: string = 'system'): Identity | undefined {
    const identity = this._identities.get(identityId);
    if (!identity) return undefined;

    identity.emailVerified = true;
    identity.updatedAt = new Date().toISOString();
    identity.updatedBy = verifiedBy;

    this._updateVerificationLevel(identity);

    this._audit('identity.email-verified', identityId, verifiedBy, {});

    return identity;
  }

  /**
   * Verify an identity's phone number.
   */
  verifyPhone(identityId: string, verifiedBy: string = 'system'): Identity | undefined {
    const identity = this._identities.get(identityId);
    if (!identity) return undefined;

    identity.phoneVerified = true;
    identity.updatedAt = new Date().toISOString();
    identity.updatedBy = verifiedBy;

    this._updateVerificationLevel(identity);

    this._audit('identity.phone-verified', identityId, verifiedBy, {});

    return identity;
  }

  // ════════════════════════════════════════════════════════
  // Bulk Operations
  // ════════════════════════════════════════════════════════

  /**
   * Bulk-create multiple identities.
   *
   * @returns A `BulkOperationResult` summarizing successes and
   *          failures.
   */
  bulkCreateIdentities(
    requests: IdentityCreateRequest[],
    createdBy: string = 'system',
  ): BulkOperationResult {
    const result: BulkOperationResult = {
      total: requests.length,
      succeeded: 0,
      failed: 0,
      errors: [],
      identityIds: [],
    };

    for (let i = 0; i < requests.length; i++) {
      try {
        const identity = this.createIdentity(requests[i], createdBy);
        result.succeeded++;
        result.identityIds!.push(identity.id);
      } catch (err: any) {
        result.failed++;
        result.errors.push({
          index: i,
          message: err.message ?? String(err),
          data: requests[i],
        });
      }
    }

    for (const cb of this._onBulkOperation) {
      cb('bulkCreate', requests.length, result);
    }

    return result;
  }

  /**
   * Bulk-update multiple identities.
   *
   * @param updates - Array of `{ identityId, updates }` pairs.
   * @returns A `BulkOperationResult`.
   */
  bulkUpdateIdentities(
    updates: Array<{ identityId: string; updates: IdentityUpdateRequest }>,
    updatedBy: string = 'system',
  ): BulkOperationResult {
    const result: BulkOperationResult = {
      total: updates.length,
      succeeded: 0,
      failed: 0,
      errors: [],
      identityIds: [],
    };

    for (let i = 0; i < updates.length; i++) {
      try {
        const identity = this.updateIdentity(
          updates[i].identityId,
          updates[i].updates,
          updatedBy,
        );
        if (identity) {
          result.succeeded++;
          result.identityIds!.push(identity.id);
        } else {
          result.failed++;
          result.errors.push({
            index: i,
            message: `Identity '${updates[i].identityId}' not found`,
            data: updates[i],
          });
        }
      } catch (err: any) {
        result.failed++;
        result.errors.push({
          index: i,
          message: err.message ?? String(err),
          data: updates[i],
        });
      }
    }

    for (const cb of this._onBulkOperation) {
      cb('bulkUpdate', updates.length, result);
    }

    return result;
  }

  /**
   * Bulk-activate multiple identities.
   */
  bulkActivate(identityIds: string[], activatedBy: string = 'system'): BulkOperationResult {
    return this._bulkStatusChange(identityIds, 'activate', activatedBy);
  }

  /**
   * Bulk-suspend multiple identities.
   */
  bulkSuspend(identityIds: string[], suspendedBy: string = 'system', reason?: string): BulkOperationResult {
    return this._bulkStatusChange(identityIds, 'suspend', suspendedBy, reason);
  }

  /**
   * Bulk-deactivate (deprovision) multiple identities.
   */
  bulkDeactivate(identityIds: string[], deactivatedBy: string = 'system', reason?: string): BulkOperationResult {
    return this._bulkStatusChange(identityIds, 'deactivate', deactivatedBy, reason);
  }

  /**
   * Bulk-delete multiple identities.
   */
  bulkDelete(identityIds: string[], deletedBy: string = 'system'): BulkOperationResult {
    const result: BulkOperationResult = {
      total: identityIds.length,
      succeeded: 0,
      failed: 0,
      errors: [],
      identityIds: [],
    };

    for (let i = 0; i < identityIds.length; i++) {
      try {
        const deleted = this.deleteIdentity(identityIds[i], deletedBy);
        if (deleted) {
          result.succeeded++;
          result.identityIds!.push(identityIds[i]);
        } else {
          result.failed++;
          result.errors.push({
            index: i,
            message: `Identity '${identityIds[i]}' not found or already deleted`,
          });
        }
      } catch (err: any) {
        result.failed++;
        result.errors.push({
          index: i,
          message: err.message ?? String(err),
        });
      }
    }

    for (const cb of this._onBulkOperation) {
      cb('bulkDelete', identityIds.length, result);
    }

    return result;
  }

  /**
   * Bulk-assign a role to multiple identities.
   */
  bulkAssignRole(
    identityIds: string[],
    role: string,
    assignedBy: string = 'system',
  ): BulkOperationResult {
    const result: BulkOperationResult = {
      total: identityIds.length,
      succeeded: 0,
      failed: 0,
      errors: [],
      identityIds: [],
    };

    for (let i = 0; i < identityIds.length; i++) {
      try {
        const assigned = this.assignRole(identityIds[i], role, assignedBy);
        if (assigned) {
          result.succeeded++;
          result.identityIds!.push(identityIds[i]);
        } else {
          result.failed++;
          result.errors.push({
            index: i,
            message: `Could not assign role to '${identityIds[i]}' (not found, deleted, or already assigned)`,
          });
        }
      } catch (err: any) {
        result.failed++;
        result.errors.push({
          index: i,
          message: err.message ?? String(err),
        });
      }
    }

    for (const cb of this._onBulkOperation) {
      cb('bulkAssignRole', identityIds.length, result);
    }

    return result;
  }

  /**
   * Bulk-revoke a role from multiple identities.
   */
  bulkRevokeRole(
    identityIds: string[],
    role: string,
    revokedBy: string = 'system',
  ): BulkOperationResult {
    const result: BulkOperationResult = {
      total: identityIds.length,
      succeeded: 0,
      failed: 0,
      errors: [],
      identityIds: [],
    };

    for (let i = 0; i < identityIds.length; i++) {
      try {
        const revoked = this.revokeRole(identityIds[i], role, revokedBy);
        if (revoked) {
          result.succeeded++;
          result.identityIds!.push(identityIds[i]);
        } else {
          result.failed++;
          result.errors.push({
            index: i,
            message: `Could not revoke role from '${identityIds[i]}' (not found or role not assigned)`,
          });
        }
      } catch (err: any) {
        result.failed++;
        result.errors.push({
          index: i,
          message: err.message ?? String(err),
        });
      }
    }

    for (const cb of this._onBulkOperation) {
      cb('bulkRevokeRole', identityIds.length, result);
    }

    return result;
  }

  /**
   * Bulk-assign a group to multiple identities.
   */
  bulkAssignGroup(
    identityIds: string[],
    groupId: string,
    assignedBy: string = 'system',
  ): BulkOperationResult {
    const result: BulkOperationResult = {
      total: identityIds.length,
      succeeded: 0,
      failed: 0,
      errors: [],
      identityIds: [],
    };

    for (let i = 0; i < identityIds.length; i++) {
      try {
        const assigned = this.assignGroup(identityIds[i], groupId, assignedBy);
        if (assigned) {
          result.succeeded++;
          result.identityIds!.push(identityIds[i]);
        } else {
          result.failed++;
          result.errors.push({
            index: i,
            message: `Could not assign group to '${identityIds[i]}' (not found, deleted, or already a member)`,
          });
        }
      } catch (err: any) {
        result.failed++;
        result.errors.push({
          index: i,
          message: err.message ?? String(err),
        });
      }
    }

    for (const cb of this._onBulkOperation) {
      cb('bulkAssignGroup', identityIds.length, result);
    }

    return result;
  }

  // ════════════════════════════════════════════════════════
  // Delegation & Manager Hierarchy
  // ════════════════════════════════════════════════════════

  /**
   * Get the manager of an identity.
   */
  getManager(identityId: string): Identity | undefined {
    const identity = this._identities.get(identityId);
    if (!identity || !identity.managerId) return undefined;
    return this._identities.get(identity.managerId);
  }

  /**
   * Get direct reports of a manager.
   */
  getDirectReports(managerId: string): Identity[] {
    return Array.from(this._identities.values()).filter(
      (i) => i.managerId === managerId && i.status !== 'deleted',
    );
  }

  /**
   * Build the full management chain from an identity up to the
   * top-level manager.
   *
   * @returns Array of identities from the root manager down to
   *          the specified identity's direct manager (excludes the
   *          identity itself).
   */
  getManagementChain(identityId: string): Identity[] {
    const chain: Identity[] = [];
    const visited = new Set<string>();
    let current = this._identities.get(identityId);

    while (current?.managerId && !visited.has(current.managerId)) {
      visited.add(current.managerId);
      const manager = this._identities.get(current.managerId);
      if (manager) {
        chain.unshift(manager);
        current = manager;
      } else {
        break;
      }
    }

    return chain;
  }

  // ════════════════════════════════════════════════════════
  // Event Callbacks
  // ════════════════════════════════════════════════════════

  /** Register a callback for identity creation events. */
  onCreated(callback: IdentityCallback): void {
    this._onCreated.push(callback);
  }

  /** Register a callback for identity update events. */
  onUpdated(callback: IdentityCallback): void {
    this._onUpdated.push(callback);
  }

  /** Register a callback for identity activation events. */
  onActivated(callback: IdentityCallback): void {
    this._onActivated.push(callback);
  }

  /** Register a callback for identity suspension events. */
  onSuspended(callback: IdentityCallback): void {
    this._onSuspended.push(callback);
  }

  /** Register a callback for identity lock events. */
  onLocked(callback: IdentityCallback): void {
    this._onLocked.push(callback);
  }

  /** Register a callback for identity unlock events. */
  onUnlocked(callback: IdentityCallback): void {
    this._onUnlocked.push(callback);
  }

  /** Register a callback for identity deprovisioning events. */
  onDeprovisioned(callback: IdentityCallback): void {
    this._onDeprovisioned.push(callback);
  }

  /** Register a callback for identity deletion events. */
  onDeleted(callback: IdentityCallback): void {
    this._onDeleted.push(callback);
  }

  /** Register a callback for any status change event. */
  onStatusChanged(callback: (identity: Identity, from: IdentityStatus, to: IdentityStatus) => void): void {
    this._onStatusChanged.push(callback);
  }

  /** Register a callback for role assignment events. */
  onRoleAssigned(callback: (identity: Identity, role: string) => void): void {
    this._onRoleAssigned.push(callback);
  }

  /** Register a callback for role revocation events. */
  onRoleRevoked(callback: (identity: Identity, role: string) => void): void {
    this._onRoleRevoked.push(callback);
  }

  /** Register a callback for group assignment events. */
  onGroupAssigned(callback: (identity: Identity, groupId: string) => void): void {
    this._onGroupAssigned.push(callback);
  }

  /** Register a callback for group removal events. */
  onGroupRemoved(callback: (identity: Identity, groupId: string) => void): void {
    this._onGroupRemoved.push(callback);
  }

  /** Register a callback for provisioning record creation. */
  onProvisioningCreated(callback: ProvisioningCallback): void {
    this._onProvisioningCreated.push(callback);
  }

  /** Register a callback for provisioning approval. */
  onProvisioningApproved(callback: ProvisioningCallback): void {
    this._onProvisioningApproved.push(callback);
  }

  /** Register a callback for provisioning rejection. */
  onProvisioningRejected(callback: ProvisioningCallback): void {
    this._onProvisioningRejected.push(callback);
  }

  /** Register a callback for provisioning completion. */
  onProvisioningCompleted(callback: ProvisioningCallback): void {
    this._onProvisioningCompleted.push(callback);
  }

  /** Register a callback for organization creation. */
  onOrganizationCreated(callback: OrganizationCallback): void {
    this._onOrganizationCreated.push(callback);
  }

  /** Register a callback for organization update. */
  onOrganizationUpdated(callback: OrganizationCallback): void {
    this._onOrganizationUpdated.push(callback);
  }

  /** Register a callback for group creation. */
  onGroupCreated(callback: GroupCallback): void {
    this._onGroupCreated.push(callback);
  }

  /** Register a callback for group update. */
  onGroupUpdated(callback: GroupCallback): void {
    this._onGroupUpdated.push(callback);
  }

  /** Register a callback for bulk operations. */
  onBulkOperation(callback: (operation: string, count: number, results: BulkOperationResult) => void): void {
    this._onBulkOperation.push(callback);
  }

  // ════════════════════════════════════════════════════════
  // Aggregate Getters
  // ════════════════════════════════════════════════════════

  /** Total number of identities (excludes deleted). */
  get count(): number {
    let n = 0;
    for (const i of this._identities.values()) {
      if (i.status !== 'deleted') n++;
    }
    return n;
  }

  /** Number of identities with `status === 'active'`. */
  get activeCount(): number {
    let n = 0;
    for (const i of this._identities.values()) {
      if (i.status === 'active') n++;
    }
    return n;
  }

  /** Number of identities with `status === 'suspended'`. */
  get suspendedCount(): number {
    let n = 0;
    for (const i of this._identities.values()) {
      if (i.status === 'suspended') n++;
    }
    return n;
  }

  /** Number of identities with `status === 'locked'`. */
  get lockedCount(): number {
    let n = 0;
    for (const i of this._identities.values()) {
      if (i.status === 'locked') n++;
    }
    return n;
  }

  /** Number of identities with `status === 'staged'`. */
  get stagedCount(): number {
    let n = 0;
    for (const i of this._identities.values()) {
      if (i.status === 'staged') n++;
    }
    return n;
  }

  /** Number of identities with `status === 'deprovisioned'`. */
  get deprovisionedCount(): number {
    let n = 0;
    for (const i of this._identities.values()) {
      if (i.status === 'deprovisioned') n++;
    }
    return n;
  }

  /** Total number of organizations. */
  get organizationCount(): number {
    return this._organizations.size;
  }

  /** Total number of groups. */
  get groupCount(): number {
    return this._groups.size;
  }

  /** Total number of provisioning records. */
  get provisioningRecordCount(): number {
    return this._provisioningRecords.size;
  }

  /** Number of pending provisioning records. */
  get pendingProvisioningCount(): number {
    let n = 0;
    for (const r of this._provisioningRecords.values()) {
      if (r.status === 'pending') n++;
    }
    return n;
  }

  /** Return an array of all identities (excludes deleted). */
  get allIdentities(): Identity[] {
    return Array.from(this._identities.values()).filter(
      (i) => i.status !== 'deleted',
    );
  }

  /** Return an array of all organizations. */
  get allOrganizations(): Organization[] {
    return Array.from(this._organizations.values());
  }

  /** Return an array of all groups. */
  get allGroups(): IdentityGroup[] {
    return Array.from(this._groups.values());
  }

  /** Return an array of all provisioning records. */
  get allProvisioningRecords(): ProvisioningRecord[] {
    return Array.from(this._provisioningRecords.values());
  }

  /** Get the full audit log. */
  get auditLog(): ReadonlyArray<{
    timestamp: string;
    action: string;
    identityId?: string;
    actor: string;
    details: Record<string, any>;
  }> {
    return this._auditLog;
  }

  // ════════════════════════════════════════════════════════
  // Utility
  // ════════════════════════════════════════════════════════

  /**
   * Clear all data from the identity manager.
   *
   * Primarily intended for testing.
   */
  clear(): void {
    this._identities.clear();
    this._organizations.clear();
    this._groups.clear();
    this._provisioningRecords.clear();
    this._auditLog.length = 0;
  }

  /**
   * Export a snapshot of all identity manager state.
   *
   * Useful for backup, migration, or debugging.
   */
  exportSnapshot(): IdentityManagerSnapshot {
    return {
      identities: Array.from(this._identities.values()),
      organizations: Array.from(this._organizations.values()),
      groups: Array.from(this._groups.values()),
      provisioningRecords: Array.from(this._provisioningRecords.values()),
      exportedAt: new Date().toISOString(),
    };
  }

  /**
   * Import a previously exported snapshot, merging into current
   * state. Existing entries with the same ID are overwritten.
   */
  importSnapshot(snapshot: IdentityManagerSnapshot): void {
    for (const identity of snapshot.identities) {
      this._identities.set(identity.id, identity);
    }
    for (const org of snapshot.organizations) {
      this._organizations.set(org.id, org);
    }
    for (const group of snapshot.groups) {
      this._groups.set(group.id, group);
    }
    for (const record of snapshot.provisioningRecords) {
      this._provisioningRecords.set(record.id, record);
    }
  }

  // ════════════════════════════════════════════════════════
  // Private Helpers
  // ════════════════════════════════════════════════════════

  /**
   * Perform a validated status transition.
   *
   * Checks the transition against `ALLOWED_TRANSITIONS`, updates
   * the identity, records an audit entry, and fires the
   * appropriate event callbacks.
   */
  private _transition(
    identityId: string,
    toStatus: IdentityStatus,
    actor: string,
    callbacks: IdentityCallback[] | readonly IdentityCallback[],
    reason?: string,
  ): Identity | undefined {
    const identity = this._identities.get(identityId);
    if (!identity) return undefined;

    const fromStatus = identity.status;

    // Validate the transition
    const allowed = ALLOWED_TRANSITIONS[fromStatus];
    if (!allowed || !allowed.includes(toStatus)) {
      throw new Error(
        `Invalid status transition for identity '${identityId}': '${fromStatus}' -> '${toStatus}'`,
      );
    }

    identity.status = toStatus;
    identity.updatedAt = new Date().toISOString();
    identity.updatedBy = actor;

    this._audit(`identity.${toStatus}`, identityId, actor, {
      fromStatus,
      toStatus,
      reason,
    });

    // Fire specific lifecycle callbacks
    this._emit(callbacks, identity);

    // Fire generic status-change callbacks
    for (const cb of this._onStatusChanged) {
      cb(identity, fromStatus, toStatus);
    }

    return identity;
  }

  /**
   * Execute a provisioning action after approval.
   */
  private _executeProvisioningAction(record: ProvisioningRecord): void {
    try {
      const actor = record.approvedBy ?? 'system';

      switch (record.action) {
        case 'create':
          // Identity was already created when the provisioning was requested
          break;
        case 'activate':
          this.activate(record.identityId, actor);
          break;
        case 'suspend':
          this.suspend(record.identityId, actor, record.reason);
          break;
        case 'unsuspend':
          this.unsuspend(record.identityId, actor);
          break;
        case 'lock':
          this.lock(record.identityId, actor, record.reason);
          break;
        case 'unlock':
          this.unlock(record.identityId, actor);
          break;
        case 'deactivate':
          this.deactivate(record.identityId, actor, record.reason);
          break;
        case 'delete':
          this.deleteIdentity(record.identityId, actor);
          break;
        case 'reset-password':
          // Password reset is handled by the credential subsystem
          break;
        case 'assign-role':
          if (record.details.role) {
            this.assignRole(record.identityId, record.details.role, actor);
          }
          break;
        case 'revoke-role':
          if (record.details.role) {
            this.revokeRole(record.identityId, record.details.role, actor);
          }
          break;
        case 'assign-group':
          if (record.details.groupId) {
            this.assignGroup(record.identityId, record.details.groupId, actor);
          }
          break;
        case 'remove-group':
          if (record.details.groupId) {
            this.removeGroup(record.identityId, record.details.groupId, actor);
          }
          break;
      }

      record.status = 'completed';
      record.completedAt = new Date().toISOString();

      this._emit(this._onProvisioningCompleted, record);
    } catch (err: any) {
      record.status = 'failed';
      record.completedAt = new Date().toISOString();
      record.details._error = err.message ?? String(err);
    }
  }

  /**
   * Evaluate a dynamic group rule against an identity.
   *
   * Supports nested rules with AND/OR logic and a variety of
   * operators (equals, contains, startsWith, endsWith, matches, in).
   */
  private _evaluateRule(rule: GroupDynamicRule, identity: Identity): boolean {
    const fieldValue = this._resolveField(rule.field, identity);

    let result: boolean;

    switch (rule.operator) {
      case 'equals':
        result = fieldValue === rule.value;
        break;
      case 'contains':
        if (Array.isArray(fieldValue)) {
          result = fieldValue.includes(rule.value);
        } else {
          result = String(fieldValue ?? '').includes(String(rule.value));
        }
        break;
      case 'startsWith':
        result = String(fieldValue ?? '').startsWith(String(rule.value));
        break;
      case 'endsWith':
        result = String(fieldValue ?? '').endsWith(String(rule.value));
        break;
      case 'matches':
        try {
          result = new RegExp(String(rule.value)).test(String(fieldValue ?? ''));
        } catch {
          result = false;
        }
        break;
      case 'in':
        if (Array.isArray(rule.value)) {
          result = rule.value.includes(fieldValue);
        } else {
          result = false;
        }
        break;
      default:
        result = false;
    }

    // Evaluate children with logic
    if (rule.children && rule.children.length > 0) {
      const childResults = rule.children.map((child) =>
        this._evaluateRule(child, identity),
      );

      if (rule.logic === 'OR') {
        result = result || childResults.some(Boolean);
      } else {
        // Default to AND
        result = result && childResults.every(Boolean);
      }
    }

    return result;
  }

  /**
   * Resolve a dot-notation field path on an identity object.
   *
   * Supports top-level fields like `status`, `type`, `organizationId`,
   * and nested attribute access like `attributes.department`.
   */
  private _resolveField(field: string, identity: Identity): any {
    const parts = field.split('.');
    let current: any = identity;

    for (const part of parts) {
      if (current == null) return undefined;
      current = current[part];
    }

    return current;
  }

  /**
   * Update the verification level of an identity based on its
   * current email/phone verification state.
   */
  private _updateVerificationLevel(identity: Identity): void {
    if (identity.emailVerified && identity.phoneVerified) {
      identity.verificationLevel = 'phone-verified';
    } else if (identity.emailVerified) {
      identity.verificationLevel = 'email-verified';
    } else {
      identity.verificationLevel = 'unverified';
    }
  }

  /**
   * Emit an event to an array of callbacks.
   */
  private _emit<T>(callbacks: readonly ((arg: T) => void)[], arg: T): void {
    for (const cb of callbacks) {
      cb(arg);
    }
  }

  /**
   * Record an audit log entry.
   */
  private _audit(
    action: string,
    identityId: string | undefined,
    actor: string,
    details: Record<string, any>,
  ): void {
    this._auditLog.push({
      timestamp: new Date().toISOString(),
      action,
      identityId,
      actor,
      details,
    });
  }

  /**
   * Compute a shallow diff between two identity snapshots.
   *
   * Returns an object with keys that changed and their before/after
   * values. Used for audit entries.
   */
  private _diff(
    before: Record<string, any>,
    after: Record<string, any>,
  ): Record<string, { from: any; to: any }> {
    const changes: Record<string, { from: any; to: any }> = {};
    const keys = new Set([...Object.keys(before), ...Object.keys(after)]);

    for (const key of keys) {
      const bVal = before[key];
      const aVal = after[key];

      // Skip timestamp fields that always change
      if (key === 'updatedAt' || key === 'updatedBy') continue;

      if (JSON.stringify(bVal) !== JSON.stringify(aVal)) {
        changes[key] = { from: bVal, to: aVal };
      }
    }

    return changes;
  }

  /**
   * Internal helper for bulk status-change operations.
   */
  private _bulkStatusChange(
    identityIds: string[],
    operation: 'activate' | 'suspend' | 'deactivate',
    actor: string,
    reason?: string,
  ): BulkOperationResult {
    const result: BulkOperationResult = {
      total: identityIds.length,
      succeeded: 0,
      failed: 0,
      errors: [],
      identityIds: [],
    };

    for (let i = 0; i < identityIds.length; i++) {
      try {
        let identity: Identity | undefined;

        switch (operation) {
          case 'activate':
            identity = this.activate(identityIds[i], actor);
            break;
          case 'suspend':
            identity = this.suspend(identityIds[i], actor, reason);
            break;
          case 'deactivate':
            identity = this.deactivate(identityIds[i], actor, reason);
            break;
        }

        if (identity) {
          result.succeeded++;
          result.identityIds!.push(identityIds[i]);
        } else {
          result.failed++;
          result.errors.push({
            index: i,
            message: `Identity '${identityIds[i]}' not found`,
          });
        }
      } catch (err: any) {
        result.failed++;
        result.errors.push({
          index: i,
          message: err.message ?? String(err),
        });
      }
    }

    for (const cb of this._onBulkOperation) {
      cb(`bulk${operation.charAt(0).toUpperCase()}${operation.slice(1)}`, identityIds.length, result);
    }

    return result;
  }
}

// ── Exported Supporting Types ───────────────────────────────

/**
 * Result of a bulk operation.
 */
export interface BulkOperationResult {
  /** Total number of items in the operation. */
  total: number;
  /** Number of items that succeeded. */
  succeeded: number;
  /** Number of items that failed. */
  failed: number;
  /** Error details for each failed item. */
  errors: Array<{
    index: number;
    message: string;
    data?: any;
  }>;
  /** IDs of successfully processed identities. */
  identityIds?: string[];
}

/**
 * Snapshot of the full identity manager state, suitable for
 * export/import.
 */
export interface IdentityManagerSnapshot {
  identities: Identity[];
  organizations: Organization[];
  groups: IdentityGroup[];
  provisioningRecords: ProvisioningRecord[];
  exportedAt: string;
}
