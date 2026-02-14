// ============================================================
// SOA One SOA — API Gateway
// ============================================================
//
// API Gateway subsystem for the SOA module.  Manages API
// lifecycle (draft → published → deprecated → retired), route
// management, API key creation / validation, usage recording,
// rate-limit checking, and metrics aggregation.
//
// Zero external dependencies.
// ============================================================

import type {
  APIDefinition,
  APIRoute,
  APIKey,
  APIRateLimitConfig,
  APIStatus,
  APIAuthType,
  VersionStrategy,
  CORSConfig,
  APICacheConfig,
  APITransformation,
  APIUsageRecord,
} from './types';

import { generateId } from './registry';

// ── Helpers ─────────────────────────────────────────────────

/**
 * Simple string-based hash function.
 *
 * Produces a deterministic hex-encoded digest for a given input
 * string using bitwise arithmetic.  This is **not** a
 * cryptographic hash — it is used only for API key storage
 * where no external dependency is available.
 */
function simpleHash(input: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;

  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }

  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);

  const combined = 4294967296 * (2097151 & h2) + (h1 >>> 0);
  return combined.toString(16).padStart(16, '0');
}

/**
 * Generate a raw API key string.
 *
 * The key is composed of a prefix, a timestamp-derived segment,
 * and a random segment to ensure uniqueness.
 */
function generateRawKey(): string {
  const seg1 = Date.now().toString(36);
  const seg2 = Math.random().toString(36).substring(2, 10);
  const seg3 = Math.random().toString(36).substring(2, 10);
  return `soa_${seg1}_${seg2}${seg3}`;
}

// ── API Gateway ─────────────────────────────────────────────

/**
 * API Gateway for the SOA module.
 *
 * Provides full API lifecycle management including registration,
 * publishing, deprecation, and retirement.  Manages routes,
 * API keys (with simple hashing), usage recording, rate-limit
 * checking, and aggregated metrics.
 *
 * Usage:
 * ```ts
 * const gw = new APIGateway();
 *
 * // Register and publish an API
 * const api = gw.registerAPI({
 *   name: 'OrderAPI',
 *   version: '1.0.0',
 *   basePath: '/api/v1/orders',
 *   status: 'draft',
 *   authType: 'api-key',
 *   routes: [],
 *   versionStrategy: 'url-path',
 *   tags: ['orders'],
 *   owner: 'order-team',
 *   metadata: {},
 * });
 *
 * gw.publishAPI(api.id);
 *
 * // Create an API key
 * const { key, rawKey } = gw.createAPIKey(
 *   'client-a-key', [api.id], 'client-a', ['read', 'write'],
 * );
 *
 * // Validate the key later
 * const validated = gw.validateAPIKey(rawKey);
 * ```
 */
export class APIGateway {
  /** Registered API definitions keyed by ID. */
  private readonly _apis: Map<string, APIDefinition> = new Map();

  /** Registered API keys keyed by key ID. */
  private readonly _keys: Map<string, APIKey> = new Map();

  /** Recorded usage data. */
  private readonly _usageRecords: APIUsageRecord[] = [];

  /** Total gateway-level request count. */
  private _totalRequests: number = 0;

  // ── Event callbacks ────────────────────────────────────────

  /** Callbacks fired when an API is published. */
  private readonly _onPublished: Array<(api: APIDefinition) => void> = [];

  /** Callbacks fired when an API is deprecated. */
  private readonly _onDeprecated: Array<(api: APIDefinition) => void> = [];

  /** Callbacks fired when a new API key is created. */
  private readonly _onKeyCreated: Array<(key: APIKey) => void> = [];

  /** Callbacks fired when a request is recorded. */
  private readonly _onRequestProcessed: Array<(record: APIUsageRecord) => void> = [];

  // ── API Lifecycle ──────────────────────────────────────────

  /**
   * Register a new API definition.
   *
   * Automatically generates `id` and `createdAt` when they are
   * not already present on the supplied object.
   *
   * @param api - The API definition to register.
   * @returns The fully-populated {@link APIDefinition}.
   */
  registerAPI(api: APIDefinition): APIDefinition {
    const now = new Date().toISOString();
    const definition: APIDefinition = {
      ...api,
      id: api.id || generateId(),
      createdAt: api.createdAt || now,
      routes: api.routes ?? [],
      tags: api.tags ?? [],
      metadata: api.metadata ?? {},
    };

    this._apis.set(definition.id, definition);
    return definition;
  }

  /**
   * Retrieve an API definition by its ID.
   *
   * @param apiId - The API identifier.
   * @returns The {@link APIDefinition} or `undefined` if not found.
   */
  getAPI(apiId: string): APIDefinition | undefined {
    return this._apis.get(apiId);
  }

  /**
   * Find an API definition by its human-readable name.
   *
   * Name matching is exact and case-sensitive.
   *
   * @param name - The API name to search for.
   * @returns The matching {@link APIDefinition} or `undefined`.
   */
  getAPIByName(name: string): APIDefinition | undefined {
    for (const api of this._apis.values()) {
      if (api.name === name) return api;
    }
    return undefined;
  }

  /**
   * Remove an API definition from the gateway.
   *
   * @param apiId - The API identifier.
   * @returns `true` if the API was found and removed.
   */
  removeAPI(apiId: string): boolean {
    return this._apis.delete(apiId);
  }

  /**
   * Publish an API, making it available for consumption.
   *
   * Sets `status` to `'published'` and records `publishedAt`.
   * Fires all registered `onPublished` callbacks.
   *
   * @param apiId - The API identifier.
   * @returns `true` if the API was found and published.
   */
  publishAPI(apiId: string): boolean {
    const api = this._apis.get(apiId);
    if (!api) return false;

    api.status = 'published';
    api.publishedAt = new Date().toISOString();

    for (const cb of this._onPublished) {
      cb(api);
    }

    return true;
  }

  /**
   * Deprecate an API.
   *
   * Sets `status` to `'deprecated'` and fires all registered
   * `onDeprecated` callbacks.
   *
   * @param apiId - The API identifier.
   * @returns `true` if the API was found and deprecated.
   */
  deprecateAPI(apiId: string): boolean {
    const api = this._apis.get(apiId);
    if (!api) return false;

    api.status = 'deprecated';

    for (const cb of this._onDeprecated) {
      cb(api);
    }

    return true;
  }

  /**
   * Retire an API, removing it from active service.
   *
   * Sets `status` to `'retired'`.
   *
   * @param apiId - The API identifier.
   * @returns `true` if the API was found and retired.
   */
  retireAPI(apiId: string): boolean {
    const api = this._apis.get(apiId);
    if (!api) return false;

    api.status = 'retired';
    return true;
  }

  /**
   * Return all APIs that are currently published.
   *
   * @returns An array of published {@link APIDefinition} objects.
   */
  getPublishedAPIs(): APIDefinition[] {
    const result: APIDefinition[] = [];
    for (const api of this._apis.values()) {
      if (api.status === 'published') result.push(api);
    }
    return result;
  }

  // ── Route Management ───────────────────────────────────────

  /**
   * Add a route to an existing API definition.
   *
   * @param apiId - The API identifier.
   * @param route - The route to add.
   * @returns `true` if the API was found and the route was added.
   */
  addRoute(apiId: string, route: APIRoute): boolean {
    const api = this._apis.get(apiId);
    if (!api) return false;

    api.routes.push(route);
    return true;
  }

  /**
   * Remove a route from an API definition by route ID.
   *
   * @param apiId  - The API identifier.
   * @param routeId - The route identifier.
   * @returns `true` if the route was found and removed.
   */
  removeRoute(apiId: string, routeId: string): boolean {
    const api = this._apis.get(apiId);
    if (!api) return false;

    const idx = api.routes.findIndex((r) => r.id === routeId);
    if (idx < 0) return false;

    api.routes.splice(idx, 1);
    return true;
  }

  /**
   * Enable a route within an API.
   *
   * @param apiId  - The API identifier.
   * @param routeId - The route identifier.
   * @returns `true` if the route was found and enabled.
   */
  enableRoute(apiId: string, routeId: string): boolean {
    const api = this._apis.get(apiId);
    if (!api) return false;

    const route = api.routes.find((r) => r.id === routeId);
    if (!route) return false;

    route.enabled = true;
    return true;
  }

  /**
   * Disable a route within an API.
   *
   * @param apiId  - The API identifier.
   * @param routeId - The route identifier.
   * @returns `true` if the route was found and disabled.
   */
  disableRoute(apiId: string, routeId: string): boolean {
    const api = this._apis.get(apiId);
    if (!api) return false;

    const route = api.routes.find((r) => r.id === routeId);
    if (!route) return false;

    route.enabled = false;
    return true;
  }

  // ── API Key Management ─────────────────────────────────────

  /**
   * Create a new API key.
   *
   * Generates a unique raw key string and stores only its hash.
   * The raw key is returned once and should be delivered to the
   * consumer — it cannot be retrieved later.
   *
   * Fires all registered `onKeyCreated` callbacks.
   *
   * @param name      - Human-readable key label.
   * @param apiIds    - API IDs this key grants access to.
   * @param owner     - Key owner / consumer identifier.
   * @param scopes    - Permission scopes granted by this key.
   * @param expiresAt - Optional ISO-8601 expiration timestamp.
   * @returns An object containing the persisted {@link APIKey} and the `rawKey`.
   */
  createAPIKey(
    name: string,
    apiIds: string[],
    owner: string,
    scopes: string[],
    expiresAt?: string,
  ): { key: APIKey; rawKey: string } {
    const rawKey = generateRawKey();
    const keyHash = simpleHash(rawKey);
    const now = new Date().toISOString();

    const apiKey: APIKey = {
      id: generateId(),
      keyHash,
      name,
      apiIds,
      owner,
      scopes,
      active: true,
      createdAt: now,
      expiresAt,
      usageCount: 0,
      lastUsedAt: undefined,
    };

    this._keys.set(apiKey.id, apiKey);

    for (const cb of this._onKeyCreated) {
      cb(apiKey);
    }

    return { key: apiKey, rawKey };
  }

  /**
   * Revoke an API key, making it inactive.
   *
   * @param keyId - The key identifier.
   * @returns `true` if the key was found and revoked.
   */
  revokeAPIKey(keyId: string): boolean {
    const key = this._keys.get(keyId);
    if (!key) return false;

    key.active = false;
    return true;
  }

  /**
   * Retrieve an API key by its ID.
   *
   * @param keyId - The key identifier.
   * @returns The {@link APIKey} or `undefined` if not found.
   */
  getAPIKey(keyId: string): APIKey | undefined {
    return this._keys.get(keyId);
  }

  /**
   * Validate a raw API key.
   *
   * Hashes the supplied raw key and searches for a matching
   * active, non-expired key entry.
   *
   * @param rawKey - The raw (unhashed) API key string.
   * @returns The matching {@link APIKey} or `null` if invalid.
   */
  validateAPIKey(rawKey: string): APIKey | null {
    const hash = simpleHash(rawKey);
    const now = new Date().toISOString();

    for (const key of this._keys.values()) {
      if (key.keyHash !== hash) continue;
      if (!key.active) continue;
      if (key.expiresAt && key.expiresAt <= now) continue;

      return key;
    }

    return null;
  }

  // ── Usage Recording ────────────────────────────────────────

  /**
   * Record an API usage event.
   *
   * Appends a new {@link APIUsageRecord}, increments the
   * gateway-level `totalRequests` counter, updates the
   * associated API key's `usageCount` and `lastUsedAt` (when
   * provided), and fires all `onRequestProcessed` callbacks.
   *
   * @param apiId             - The API identifier.
   * @param routeId           - The route identifier.
   * @param method            - The HTTP method used.
   * @param path              - The request path.
   * @param statusCode        - The HTTP response status code.
   * @param responseTimeMs    - Response time in milliseconds.
   * @param requestSizeBytes  - Request body size in bytes.
   * @param responseSizeBytes - Response body size in bytes.
   * @param apiKeyId          - Optional API key identifier.
   */
  recordUsage(
    apiId: string,
    routeId: string,
    method: string,
    path: string,
    statusCode: number,
    responseTimeMs: number,
    requestSizeBytes: number,
    responseSizeBytes: number,
    apiKeyId?: string,
  ): void {
    const record: APIUsageRecord = {
      apiId,
      routeId,
      apiKeyId,
      method,
      path,
      statusCode,
      responseTimeMs,
      requestSizeBytes,
      responseSizeBytes,
      timestamp: new Date().toISOString(),
    };

    this._usageRecords.push(record);
    this._totalRequests++;

    // Update key statistics
    if (apiKeyId) {
      const key = this._keys.get(apiKeyId);
      if (key) {
        key.usageCount++;
        key.lastUsedAt = record.timestamp;
      }
    }

    for (const cb of this._onRequestProcessed) {
      cb(record);
    }
  }

  /**
   * Retrieve usage records for a specific API.
   *
   * Records are returned in reverse-chronological order (newest
   * first).  An optional `limit` restricts the number of
   * returned records.
   *
   * @param apiId - The API identifier.
   * @param limit - Maximum number of records to return.
   * @returns An array of {@link APIUsageRecord} objects.
   */
  getUsageStats(apiId: string, limit?: number): APIUsageRecord[] {
    const records = this._usageRecords
      .filter((r) => r.apiId === apiId)
      .reverse();

    if (limit !== undefined && limit > 0) {
      return records.slice(0, limit);
    }

    return records;
  }

  /**
   * Compute aggregated metrics for a specific API.
   *
   * @param apiId - The API identifier.
   * @returns An object with `totalRequests`, `avgResponseTimeMs`,
   *          `errorRate`, and `topRoutes`.
   */
  getAPIMetrics(apiId: string): {
    totalRequests: number;
    avgResponseTimeMs: number;
    errorRate: number;
    topRoutes: Array<{ routeId: string; count: number }>;
  } {
    const records = this._usageRecords.filter((r) => r.apiId === apiId);

    const total = records.length;
    if (total === 0) {
      return {
        totalRequests: 0,
        avgResponseTimeMs: 0,
        errorRate: 0,
        topRoutes: [],
      };
    }

    // Average response time
    let sumResponseTime = 0;
    let errorCount = 0;
    const routeCounts = new Map<string, number>();

    for (const r of records) {
      sumResponseTime += r.responseTimeMs;

      if (r.statusCode >= 400) {
        errorCount++;
      }

      routeCounts.set(r.routeId, (routeCounts.get(r.routeId) ?? 0) + 1);
    }

    const avgResponseTimeMs = sumResponseTime / total;
    const errorRate = errorCount / total;

    // Top routes sorted by count descending
    const topRoutes = Array.from(routeCounts.entries())
      .map(([routeId, count]) => ({ routeId, count }))
      .sort((a, b) => b.count - a.count);

    return {
      totalRequests: total,
      avgResponseTimeMs,
      errorRate,
      topRoutes,
    };
  }

  // ── Rate Limiting ──────────────────────────────────────────

  /**
   * Check whether a request is allowed under the configured
   * rate limit for an API (and optionally a specific route or
   * API key).
   *
   * The check inspects recorded usage within the current rate
   * limit window.  If no rate limit is configured the request
   * is always allowed.
   *
   * @param apiId    - The API identifier.
   * @param routeId  - Optional route identifier for route-level limits.
   * @param apiKeyId - Optional API key identifier for per-key limits.
   * @returns An object with `allowed` and `remaining` count.
   */
  checkRateLimit(
    apiId: string,
    routeId?: string,
    apiKeyId?: string,
  ): { allowed: boolean; remaining: number } {
    const api = this._apis.get(apiId);
    if (!api) {
      return { allowed: false, remaining: 0 };
    }

    // Determine the applicable rate limit config.
    // Route-level limits take precedence over API-level limits.
    // API key overrides take highest precedence.
    let rateLimitConfig: APIRateLimitConfig | undefined;

    if (apiKeyId) {
      const key = this._keys.get(apiKeyId);
      if (key?.rateLimitOverride) {
        rateLimitConfig = key.rateLimitOverride;
      }
    }

    if (!rateLimitConfig && routeId) {
      const route = api.routes.find((r) => r.id === routeId);
      if (route?.rateLimit) {
        rateLimitConfig = route.rateLimit;
      }
    }

    if (!rateLimitConfig) {
      rateLimitConfig = api.rateLimit;
    }

    // No rate limit configured — always allow
    if (!rateLimitConfig) {
      return { allowed: true, remaining: Infinity };
    }

    const now = Date.now();
    const windowStart = now - rateLimitConfig.windowMs;
    const windowStartISO = new Date(windowStart).toISOString();

    // Count requests within the window
    let count = 0;
    for (const r of this._usageRecords) {
      if (r.apiId !== apiId) continue;
      if (r.timestamp < windowStartISO) continue;

      // Scope filtering
      if (routeId && r.routeId !== routeId) continue;
      if (apiKeyId && r.apiKeyId !== apiKeyId) continue;

      count++;
    }

    const maxRequests = rateLimitConfig.maxRequests + (rateLimitConfig.burstSize ?? 0);
    const remaining = Math.max(0, maxRequests - count);
    const allowed = count < maxRequests;

    return { allowed, remaining };
  }

  // ── Event Subscriptions ────────────────────────────────────

  /**
   * Register a callback to be invoked when an API is published.
   *
   * @param cb - Callback receiving the published {@link APIDefinition}.
   */
  onPublished(cb: (api: APIDefinition) => void): void {
    this._onPublished.push(cb);
  }

  /**
   * Register a callback to be invoked when an API is deprecated.
   *
   * @param cb - Callback receiving the deprecated {@link APIDefinition}.
   */
  onDeprecated(cb: (api: APIDefinition) => void): void {
    this._onDeprecated.push(cb);
  }

  /**
   * Register a callback to be invoked when a new API key is created.
   *
   * @param cb - Callback receiving the newly created {@link APIKey}.
   */
  onKeyCreated(cb: (key: APIKey) => void): void {
    this._onKeyCreated.push(cb);
  }

  /**
   * Register a callback to be invoked when a request is recorded.
   *
   * @param cb - Callback receiving the {@link APIUsageRecord}.
   */
  onRequestProcessed(cb: (record: APIUsageRecord) => void): void {
    this._onRequestProcessed.push(cb);
  }

  // ── Aggregate Getters ──────────────────────────────────────

  /** All registered API definitions. */
  get allAPIs(): APIDefinition[] {
    return Array.from(this._apis.values());
  }

  /** Total number of registered API definitions. */
  get apiCount(): number {
    return this._apis.size;
  }

  /** Number of APIs currently in `'published'` status. */
  get publishedCount(): number {
    let n = 0;
    for (const api of this._apis.values()) {
      if (api.status === 'published') n++;
    }
    return n;
  }

  /** Total number of registered API keys. */
  get keyCount(): number {
    return this._keys.size;
  }

  /** Number of API keys that are currently active. */
  get activeKeyCount(): number {
    let n = 0;
    for (const key of this._keys.values()) {
      if (key.active) n++;
    }
    return n;
  }

  /** Total number of requests recorded across all APIs. */
  get totalRequests(): number {
    return this._totalRequests;
  }
}
