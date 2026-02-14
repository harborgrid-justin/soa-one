// ============================================================
// SOA One SOA — Service Registry
// ============================================================
//
// Service registry / repository with versioned contracts,
// endpoint management, health tracking, discovery, and
// dependency graph resolution.
//
// Features beyond Oracle Service Registry:
// - Multi-criteria service discovery with full-text search
// - Versioned contracts with active-version tracking
// - Endpoint-level health recording and filtering
// - Transitive dependency graph resolution
// - Status lifecycle management
// - Tag-based categorization and namespace scoping
//
// Zero external dependencies.
// ============================================================

import type {
  ServiceRegistration,
  ServiceContract,
  ServiceEndpoint,
  ServiceDiscoveryQuery,
  ServiceStatus,
  HealthCheckConfig,
} from './types';

// ── Helpers ─────────────────────────────────────────────────

/**
 * Generate a unique ID using the current timestamp (hex) and
 * a random hex suffix. Suitable for registry-level identifiers.
 */
export function generateId(): string {
  const ts = Date.now().toString(16);
  const rand = Math.random().toString(16).substring(2, 10);
  return `${ts}-${rand}`;
}

// ── Service Registry ────────────────────────────────────────

/**
 * Central service registry for registering, discovering, and
 * managing SOA service definitions, contracts, endpoints, and
 * health state.
 *
 * Usage:
 * ```ts
 * const registry = new ServiceRegistry();
 *
 * // Register a service
 * const svc = registry.register({
 *   name: 'OrderService',
 *   namespace: 'commerce',
 *   version: '1.0.0',
 *   description: 'Manages customer orders',
 *   protocol: 'rest',
 *   owner: 'order-team',
 *   tags: ['orders', 'commerce'],
 * });
 *
 * // Discover services
 * const results = registry.discover({ namespace: 'commerce', status: 'active' });
 *
 * // Add an endpoint
 * registry.addEndpoint(svc.id, {
 *   uri: 'https://orders.example.com/api',
 *   protocol: 'rest',
 *   weight: 100,
 *   healthy: true,
 *   metadata: {},
 * });
 * ```
 */
export class ServiceRegistry {
  private readonly _services = new Map<string, ServiceRegistration>();

  // ── Registration ──────────────────────────────────────────

  /**
   * Register a new service in the registry.
   *
   * Automatically generates an `id` when not provided and sets
   * `registeredAt` / `updatedAt` timestamps.
   */
  register(
    config: Omit<ServiceRegistration, 'id' | 'registeredAt' | 'updatedAt'> & {
      id?: string;
      registeredAt?: string;
      updatedAt?: string;
    },
  ): ServiceRegistration {
    const now = new Date().toISOString();
    const id = config.id ?? generateId();

    const registration: ServiceRegistration = {
      ...config,
      id,
      endpoints: config.endpoints ?? [],
      contracts: config.contracts ?? [],
      tags: config.tags ?? [],
      dependencies: config.dependencies ?? [],
      metadata: config.metadata ?? {},
      registeredAt: config.registeredAt ?? now,
      updatedAt: config.updatedAt ?? now,
    };

    this._services.set(id, registration);
    return registration;
  }

  /**
   * Remove a service from the registry.
   *
   * @returns `true` if the service was found and removed; `false` otherwise.
   */
  deregister(serviceId: string): boolean {
    return this._services.delete(serviceId);
  }

  // ── Lookup ────────────────────────────────────────────────

  /** Retrieve a service registration by ID. */
  get(serviceId: string): ServiceRegistration | undefined {
    return this._services.get(serviceId);
  }

  /**
   * Find services by name, optionally scoped to a namespace.
   *
   * Name matching is exact (case-sensitive).
   */
  getByName(name: string, namespace?: string): ServiceRegistration[] {
    const results: ServiceRegistration[] = [];

    for (const svc of this._services.values()) {
      if (svc.name !== name) continue;
      if (namespace !== undefined && svc.namespace !== namespace) continue;
      results.push(svc);
    }

    return results;
  }

  // ── Discovery ─────────────────────────────────────────────

  /**
   * Discover services matching the given query.
   *
   * Supports filtering by name (substring match), namespace,
   * protocol, status, visibility, tags (any-match), owner, and
   * full-text search across name, description, and tags.
   */
  discover(query: ServiceDiscoveryQuery): ServiceRegistration[] {
    let results = Array.from(this._services.values());

    // Filter by name (case-insensitive substring match)
    if (query.name) {
      const lower = query.name.toLowerCase();
      results = results.filter((s) =>
        s.name.toLowerCase().includes(lower),
      );
    }

    // Filter by namespace (exact match)
    if (query.namespace) {
      results = results.filter((s) => s.namespace === query.namespace);
    }

    // Filter by protocol
    if (query.protocol) {
      results = results.filter((s) => s.protocol === query.protocol);
    }

    // Filter by status
    if (query.status) {
      results = results.filter((s) => s.status === query.status);
    }

    // Filter by visibility
    if (query.visibility) {
      results = results.filter((s) => s.visibility === query.visibility);
    }

    // Filter by tags (any-match)
    if (query.tags && query.tags.length > 0) {
      results = results.filter((s) =>
        query.tags!.some((tag) => s.tags.includes(tag)),
      );
    }

    // Filter by owner
    if (query.owner) {
      results = results.filter((s) => s.owner === query.owner);
    }

    // Full-text search across name + description + tags
    if (query.text) {
      const lower = query.text.toLowerCase();
      results = results.filter((s) => {
        const haystack = [
          s.name,
          s.description,
          ...s.tags,
        ]
          .join(' ')
          .toLowerCase();
        return haystack.includes(lower);
      });
    }

    return results;
  }

  // ── Status Management ─────────────────────────────────────

  /**
   * Update a service's status.
   *
   * @returns `true` if the service was found and updated; `false` otherwise.
   */
  updateStatus(serviceId: string, status: ServiceStatus): boolean {
    const svc = this._services.get(serviceId);
    if (!svc) return false;

    svc.status = status;
    svc.updatedAt = new Date().toISOString();
    return true;
  }

  // ── Endpoint Management ───────────────────────────────────

  /**
   * Add an endpoint to a registered service.
   *
   * @returns `true` if the service was found and the endpoint was added.
   */
  addEndpoint(serviceId: string, endpoint: ServiceEndpoint): boolean {
    const svc = this._services.get(serviceId);
    if (!svc) return false;

    svc.endpoints.push(endpoint);
    svc.updatedAt = new Date().toISOString();
    return true;
  }

  /**
   * Remove an endpoint from a service by URI.
   *
   * @returns `true` if the endpoint was found and removed.
   */
  removeEndpoint(serviceId: string, uri: string): boolean {
    const svc = this._services.get(serviceId);
    if (!svc) return false;

    const idx = svc.endpoints.findIndex((ep) => ep.uri === uri);
    if (idx < 0) return false;

    svc.endpoints.splice(idx, 1);
    svc.updatedAt = new Date().toISOString();
    return true;
  }

  // ── Contract Management ───────────────────────────────────

  /**
   * Add a versioned contract to a service.
   *
   * Auto-generates `id`, `createdAt`, and `updatedAt` fields.
   */
  addContract(
    serviceId: string,
    contract: Omit<ServiceContract, 'id' | 'createdAt' | 'updatedAt'>,
  ): ServiceContract | undefined {
    const svc = this._services.get(serviceId);
    if (!svc) return undefined;

    const now = new Date().toISOString();
    const full: ServiceContract = {
      ...contract,
      id: generateId(),
      createdAt: now,
      updatedAt: now,
    };

    // If the new contract is marked active, deactivate all others
    if (full.active) {
      for (const c of svc.contracts) {
        c.active = false;
      }
    }

    svc.contracts.push(full);
    svc.updatedAt = now;
    return full;
  }

  /**
   * Retrieve the currently active contract for a service.
   *
   * @returns The active `ServiceContract`, or `undefined` if none is active.
   */
  getActiveContract(serviceId: string): ServiceContract | undefined {
    const svc = this._services.get(serviceId);
    if (!svc) return undefined;

    return svc.contracts.find((c) => c.active);
  }

  // ── Health Tracking ───────────────────────────────────────

  /**
   * Record a health check result for a specific endpoint.
   *
   * Updates the endpoint's `healthy`, `lastHealthCheck`, and
   * `lastResponseTimeMs` fields.
   *
   * @returns `true` if the endpoint was found and updated.
   */
  recordHealthCheck(
    serviceId: string,
    uri: string,
    healthy: boolean,
    responseTimeMs: number,
  ): boolean {
    const svc = this._services.get(serviceId);
    if (!svc) return false;

    const ep = svc.endpoints.find((e) => e.uri === uri);
    if (!ep) return false;

    ep.healthy = healthy;
    ep.lastHealthCheck = new Date().toISOString();
    ep.lastResponseTimeMs = responseTimeMs;
    svc.updatedAt = new Date().toISOString();

    return true;
  }

  /**
   * Get all healthy endpoints for a service.
   *
   * @returns An array of endpoints where `healthy === true`, or
   *          an empty array if the service is not found.
   */
  getHealthyEndpoints(serviceId: string): ServiceEndpoint[] {
    const svc = this._services.get(serviceId);
    if (!svc) return [];

    return svc.endpoints.filter((ep) => ep.healthy);
  }

  // ── Dependency Graph ──────────────────────────────────────

  /**
   * Build a transitive dependency tree for a service.
   *
   * Walks the `dependencies` arrays recursively, producing a
   * nested structure of `{ serviceId, dependencies: [...] }`.
   * Circular dependencies are detected and short-circuited to
   * prevent infinite recursion.
   */
  getDependencyGraph(
    serviceId: string,
  ): { serviceId: string; dependencies: any[] } | undefined {
    const svc = this._services.get(serviceId);
    if (!svc) return undefined;

    const visited = new Set<string>();
    return this._buildDependencyNode(serviceId, visited);
  }

  // ── Aggregate Queries ─────────────────────────────────────

  /** Total number of registered services. */
  get count(): number {
    return this._services.size;
  }

  /** Number of services with `status === 'active'`. */
  get activeCount(): number {
    let n = 0;
    for (const svc of this._services.values()) {
      if (svc.status === 'active') n++;
    }
    return n;
  }

  /** Return an array of all registered services. */
  get allServices(): ServiceRegistration[] {
    return Array.from(this._services.values());
  }

  /** Return all services that match the given status. */
  getServicesByStatus(status: ServiceStatus): ServiceRegistration[] {
    return Array.from(this._services.values()).filter(
      (s) => s.status === status,
    );
  }

  // ── Private ───────────────────────────────────────────────

  /**
   * Recursively build a dependency node, tracking visited IDs
   * to break cycles.
   */
  private _buildDependencyNode(
    serviceId: string,
    visited: Set<string>,
  ): { serviceId: string; dependencies: any[] } {
    // Mark visited to prevent cycles
    visited.add(serviceId);

    const svc = this._services.get(serviceId);
    const children: { serviceId: string; dependencies: any[] }[] = [];

    if (svc) {
      for (const depId of svc.dependencies) {
        if (visited.has(depId)) {
          // Circular reference — include as a leaf to indicate the link
          children.push({ serviceId: depId, dependencies: [] });
        } else {
          children.push(this._buildDependencyNode(depId, visited));
        }
      }
    }

    return { serviceId, dependencies: children };
  }
}
