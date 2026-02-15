// ============================================================
// SOA One SOA — Service Mesh
// ============================================================
//
// Service mesh subsystem providing sidecar proxy management,
// traffic routing, circuit breaking, rate limiting, and
// endpoint selection across a variety of strategies.
//
// Features beyond typical service mesh implementations:
// - Per-upstream circuit breaker state tracking with automatic
//   state transitions (closed -> open -> half-open -> closed)
// - Window-based rate limiting with configurable scope
// - Multiple traffic strategies: round-robin, weighted, random,
//   and failover endpoint selection
// - Real-time proxy metrics with error rate calculation
// - Health aggregation across the entire mesh
// - Event callbacks for circuit state changes and rate limiting
//
// Zero external dependencies.
// ============================================================

import type {
  SidecarConfig,
  MeshProxy,
  TrafficPolicy,
  TrafficStrategy,
  MeshCircuitBreakerConfig,
  MeshRateLimitConfig,
  MeshCircuitState,
  ProxyStatus,
  HeaderRoute,
} from './types';

import { generateId } from './registry';

// ── Internal Types ──────────────────────────────────────────

/** Internal counter state for window-based rate limiting. */
interface RateLimitCounter {
  /** Number of requests within the current window. */
  count: number;
  /** Timestamp (ms) when the current window started. */
  windowStart: number;
}

/** Result from a rate limit check. */
interface RateLimitResult {
  /** Whether the request is allowed. */
  allowed: boolean;
  /** Remaining requests in the current window. */
  remaining: number;
  /** Milliseconds until the current window resets. */
  resetMs: number;
}

/** Health summary across all proxies. */
interface MeshHealthSummary {
  /** Total number of proxies. */
  total: number;
  /** Number of healthy proxies. */
  healthy: number;
  /** Number of degraded proxies. */
  degraded: number;
  /** Number of unhealthy proxies. */
  unhealthy: number;
}

/** Metrics for a single proxy. */
interface ProxyMetrics {
  /** Total requests handled. */
  totalRequests: number;
  /** Total errors recorded. */
  totalErrors: number;
  /** Error rate as a ratio (0..1). */
  errorRate: number;
  /** Average latency in milliseconds. */
  avgLatencyMs: number;
  /** Circuit breaker states per upstream service. */
  circuitStates: Record<string, MeshCircuitState>;
  /** Number of active connections. */
  activeConnections: number;
}

/** Circuit-opened callback signature. */
type CircuitOpenedCallback = (proxyId: string, upstreamServiceId: string) => void;

/** Circuit-closed callback signature. */
type CircuitClosedCallback = (proxyId: string, upstreamServiceId: string) => void;

/** Rate-limited callback signature. */
type RateLimitedCallback = (proxyId: string) => void;

// ── Internal Helpers ────────────────────────────────────────

/**
 * Internal tracker for consecutive failures/successes per upstream.
 * Used to drive circuit breaker state transitions.
 */
interface CircuitBreakerTracker {
  /** Consecutive failure count (resets on success). */
  consecutiveFailures: number;
  /** Consecutive success count while in half-open (resets on failure). */
  consecutiveSuccesses: number;
  /** Timestamp (ms) when the circuit was last opened. */
  openedAt: number;
}

// ── Service Mesh ────────────────────────────────────────────

/**
 * Service mesh subsystem managing sidecar proxies, traffic
 * routing, circuit breaking, and rate limiting.
 *
 * Usage:
 * ```ts
 * const mesh = new ServiceMesh();
 *
 * // Deploy a sidecar proxy for a service
 * const proxy = mesh.deployProxy({
 *   serviceId: 'order-svc',
 *   inboundPort: 8080,
 *   outboundPort: 8081,
 *   trafficPolicy: {
 *     strategy: 'round-robin',
 *     circuitBreaker: {
 *       failureThreshold: 5,
 *       successThreshold: 3,
 *       resetTimeoutMs: 30000,
 *       maxConcurrent: 100,
 *     },
 *     rateLimit: {
 *       maxRequests: 1000,
 *       windowMs: 60000,
 *       scope: 'global',
 *     },
 *   },
 *   mtlsEnabled: true,
 *   accessLogEnabled: true,
 *   tracingEnabled: true,
 *   metadata: {},
 * });
 *
 * // Record a successful request
 * mesh.recordRequest(proxy.id, 'payment-svc', true, 42);
 *
 * // Select an endpoint using the proxy's traffic strategy
 * const endpoint = mesh.selectEndpoint(proxy.id, [
 *   'http://payment-1:8080',
 *   'http://payment-2:8080',
 * ]);
 * ```
 */
export class ServiceMesh {
  /** All registered proxies keyed by proxy ID. */
  private readonly _proxies: Map<string, MeshProxy> = new Map();

  /** Round-robin counters keyed by proxy ID. */
  private readonly _roundRobinCounters: Map<string, number> = new Map();

  /** Rate limit window counters keyed by proxy ID. */
  private readonly _rateLimitCounters: Map<string, RateLimitCounter> = new Map();

  /**
   * Circuit breaker tracking state per proxy + upstream pair.
   * Key format: `${proxyId}::${upstreamServiceId}`.
   */
  private readonly _circuitTrackers: Map<string, CircuitBreakerTracker> = new Map();

  /** Callbacks invoked when a circuit is opened. */
  private readonly _onCircuitOpened: CircuitOpenedCallback[] = [];

  /** Callbacks invoked when a circuit is closed. */
  private readonly _onCircuitClosed: CircuitClosedCallback[] = [];

  /** Callbacks invoked when a request is rate-limited. */
  private readonly _onRateLimited: RateLimitedCallback[] = [];

  // ── Proxy Lifecycle ─────────────────────────────────────────

  /**
   * Deploy a new sidecar proxy for a service.
   *
   * Creates a `MeshProxy` with an initial status of `'healthy'`,
   * zeroed metrics, and empty circuit states. The proxy is
   * registered in the mesh and returned to the caller.
   *
   * @param config - Sidecar configuration for the proxy.
   * @returns The newly created `MeshProxy`.
   */
  deployProxy(config: SidecarConfig): MeshProxy {
    const proxy: MeshProxy = {
      id: generateId(),
      serviceId: config.serviceId,
      status: 'healthy',
      config,
      circuitStates: {},
      activeConnections: 0,
      totalRequests: 0,
      totalErrors: 0,
      avgLatencyMs: 0,
      startedAt: new Date().toISOString(),
    };

    this._proxies.set(proxy.id, proxy);
    return proxy;
  }

  /**
   * Remove a proxy from the mesh.
   *
   * Also cleans up associated round-robin counters, rate limit
   * counters, and circuit breaker trackers.
   *
   * @param proxyId - The ID of the proxy to remove.
   * @returns `true` if the proxy was found and removed; `false` otherwise.
   */
  removeProxy(proxyId: string): boolean {
    const existed = this._proxies.delete(proxyId);

    if (existed) {
      this._roundRobinCounters.delete(proxyId);
      this._rateLimitCounters.delete(proxyId);

      // Clean up circuit trackers for this proxy
      const keysToDelete: string[] = [];
      for (const key of this._circuitTrackers.keys()) {
        if (key.startsWith(`${proxyId}::`)) {
          keysToDelete.push(key);
        }
      }
      for (const key of keysToDelete) {
        this._circuitTrackers.delete(key);
      }
    }

    return existed;
  }

  /**
   * Retrieve a proxy by its ID.
   *
   * @param proxyId - The proxy ID.
   * @returns The `MeshProxy` or `undefined` if not found.
   */
  getProxy(proxyId: string): MeshProxy | undefined {
    return this._proxies.get(proxyId);
  }

  /**
   * Update a proxy's configuration.
   */
  updateProxy(proxyId: string, updates: Partial<SidecarConfig>): MeshProxy {
    const proxy = this._proxies.get(proxyId);
    if (!proxy) throw new Error(`Proxy not found: ${proxyId}`);
    Object.assign(proxy.config, updates, { serviceId: proxy.config.serviceId });
    return proxy;
  }

  /**
   * Find the proxy associated with a given service ID.
   *
   * If multiple proxies exist for the same service, the first
   * match is returned.
   *
   * @param serviceId - The service ID to look up.
   * @returns The matching `MeshProxy` or `undefined`.
   */
  getProxyByService(serviceId: string): MeshProxy | undefined {
    for (const proxy of this._proxies.values()) {
      if (proxy.serviceId === serviceId) {
        return proxy;
      }
    }
    return undefined;
  }

  // ── Traffic Policy ──────────────────────────────────────────

  /**
   * Update the traffic policy on an existing proxy.
   *
   * @param proxyId - The proxy ID.
   * @param policy  - The new traffic policy to apply.
   * @returns `true` if the proxy was found and updated; `false` otherwise.
   */
  updateTrafficPolicy(proxyId: string, policy: TrafficPolicy): boolean {
    const proxy = this._proxies.get(proxyId);
    if (!proxy) return false;

    proxy.config.trafficPolicy = policy;
    return true;
  }

  // ── Request Recording & Circuit Breaker ─────────────────────

  /**
   * Record an inbound/outbound request on a proxy.
   *
   * Updates `totalRequests`, `totalErrors`, and `avgLatencyMs`
   * on the proxy. Also evaluates the circuit breaker for the
   * given upstream service:
   *
   * - If the circuit is **closed** and consecutive failures
   *   exceed the configured threshold, the circuit transitions
   *   to **open** and the `onCircuitOpened` callbacks fire.
   *
   * - If the circuit is **open** and the reset timeout has
   *   elapsed, the circuit transitions to **half-open**.
   *
   * - If the circuit is **half-open** and the request succeeded,
   *   consecutive successes are counted. Once the success
   *   threshold is met the circuit transitions back to **closed**
   *   and the `onCircuitClosed` callbacks fire. A failure in
   *   half-open immediately re-opens the circuit.
   *
   * @param proxyId            - The proxy ID.
   * @param upstreamServiceId  - The upstream service that was called.
   * @param success            - Whether the request succeeded.
   * @param latencyMs          - The request latency in milliseconds.
   */
  recordRequest(
    proxyId: string,
    upstreamServiceId: string,
    success: boolean,
    latencyMs: number,
  ): void {
    const proxy = this._proxies.get(proxyId);
    if (!proxy) return;

    // Update aggregate metrics
    const prevTotal = proxy.totalRequests;
    proxy.totalRequests += 1;

    if (!success) {
      proxy.totalErrors += 1;
    }

    // Running average for latency
    proxy.avgLatencyMs =
      (proxy.avgLatencyMs * prevTotal + latencyMs) / proxy.totalRequests;

    // Circuit breaker evaluation
    this._evaluateCircuitBreaker(proxy, upstreamServiceId, success);
  }

  // ── Circuit Breaker Queries & Overrides ─────────────────────

  /**
   * Get the current circuit breaker state for a specific
   * upstream service on a proxy.
   *
   * If no state has been recorded yet the circuit is considered
   * **closed** (healthy).
   *
   * @param proxyId           - The proxy ID.
   * @param upstreamServiceId - The upstream service ID.
   * @returns The current `MeshCircuitState`.
   */
  getCircuitState(proxyId: string, upstreamServiceId: string): MeshCircuitState {
    const proxy = this._proxies.get(proxyId);
    if (!proxy) return 'closed';

    return proxy.circuitStates[upstreamServiceId] ?? 'closed';
  }

  /**
   * Force-open a circuit for a specific upstream on a proxy.
   *
   * This overrides the automatic circuit breaker logic and
   * immediately sets the circuit to **open**. The
   * `onCircuitOpened` callbacks are fired.
   *
   * @param proxyId           - The proxy ID.
   * @param upstreamServiceId - The upstream service ID.
   * @returns `true` if the proxy was found and the circuit was opened.
   */
  openCircuit(proxyId: string, upstreamServiceId: string): boolean {
    const proxy = this._proxies.get(proxyId);
    if (!proxy) return false;

    proxy.circuitStates[upstreamServiceId] = 'open';

    const trackerKey = `${proxyId}::${upstreamServiceId}`;
    this._circuitTrackers.set(trackerKey, {
      consecutiveFailures: 0,
      consecutiveSuccesses: 0,
      openedAt: Date.now(),
    });

    for (const cb of this._onCircuitOpened) {
      cb(proxyId, upstreamServiceId);
    }

    return true;
  }

  /**
   * Force-close a circuit for a specific upstream on a proxy.
   *
   * This overrides the automatic circuit breaker logic and
   * immediately sets the circuit to **closed**. The
   * `onCircuitClosed` callbacks are fired.
   *
   * @param proxyId           - The proxy ID.
   * @param upstreamServiceId - The upstream service ID.
   * @returns `true` if the proxy was found and the circuit was closed.
   */
  closeCircuit(proxyId: string, upstreamServiceId: string): boolean {
    const proxy = this._proxies.get(proxyId);
    if (!proxy) return false;

    proxy.circuitStates[upstreamServiceId] = 'closed';

    const trackerKey = `${proxyId}::${upstreamServiceId}`;
    this._circuitTrackers.set(trackerKey, {
      consecutiveFailures: 0,
      consecutiveSuccesses: 0,
      openedAt: 0,
    });

    for (const cb of this._onCircuitClosed) {
      cb(proxyId, upstreamServiceId);
    }

    return true;
  }

  // ── Rate Limiting ───────────────────────────────────────────

  /**
   * Check whether a request is allowed under the proxy's
   * configured rate limit.
   *
   * Uses a simple window-based counter. If the proxy has no
   * rate limit configured, every request is allowed and the
   * remaining count is reported as `Infinity`.
   *
   * When a request is denied the `onRateLimited` callbacks
   * are fired.
   *
   * @param proxyId - The proxy ID.
   * @returns A `RateLimitResult` indicating whether the request
   *          is allowed, the number of remaining requests, and
   *          the time until the window resets.
   */
  checkRateLimit(proxyId: string): RateLimitResult {
    const proxy = this._proxies.get(proxyId);
    if (!proxy) {
      return { allowed: false, remaining: 0, resetMs: 0 };
    }

    const rlConfig = proxy.config.trafficPolicy.rateLimit;
    if (!rlConfig) {
      return { allowed: true, remaining: Infinity, resetMs: 0 };
    }

    const now = Date.now();
    let counter = this._rateLimitCounters.get(proxyId);

    // Initialise or reset if the window has elapsed
    if (!counter || now - counter.windowStart >= rlConfig.windowMs) {
      counter = { count: 0, windowStart: now };
      this._rateLimitCounters.set(proxyId, counter);
    }

    const resetMs = rlConfig.windowMs - (now - counter.windowStart);
    const remaining = Math.max(0, rlConfig.maxRequests - counter.count);

    if (counter.count >= rlConfig.maxRequests) {
      // Rate limit exceeded
      for (const cb of this._onRateLimited) {
        cb(proxyId);
      }
      return { allowed: false, remaining: 0, resetMs };
    }

    // Allow the request and increment the counter
    counter.count += 1;
    return {
      allowed: true,
      remaining: Math.max(0, rlConfig.maxRequests - counter.count),
      resetMs,
    };
  }

  // ── Endpoint Selection ──────────────────────────────────────

  /**
   * Select an endpoint from the given list based on the proxy's
   * configured traffic strategy.
   *
   * Supported strategies:
   * - **round-robin**: Cycles through endpoints sequentially.
   * - **weighted**: Selects proportionally using the weights
   *   defined in `trafficPolicy.weights`. Falls back to
   *   round-robin if no weights are configured.
   * - **random**: Selects a random endpoint.
   * - **failover**: Always selects the first endpoint in the
   *   list (primary), falling through to subsequent endpoints
   *   only when explicitly removed by the caller.
   *
   * For unrecognized strategies the first endpoint is returned.
   *
   * @param proxyId   - The proxy ID.
   * @param endpoints - Available endpoint URIs.
   * @returns The selected endpoint string, or an empty string
   *          if no endpoints are provided or the proxy is not found.
   */
  selectEndpoint(proxyId: string, endpoints: string[]): string {
    if (endpoints.length === 0) return '';

    const proxy = this._proxies.get(proxyId);
    if (!proxy) return endpoints[0];

    const strategy = proxy.config.trafficPolicy.strategy;

    switch (strategy) {
      case 'round-robin':
        return this._selectRoundRobin(proxyId, endpoints);

      case 'weighted':
        return this._selectWeighted(proxyId, endpoints, proxy.config.trafficPolicy.weights);

      case 'random':
        return this._selectRandom(endpoints);

      case 'failover':
        return this._selectFailover(endpoints);

      default:
        // For strategies not yet implemented (least-connections,
        // consistent-hash, canary, blue-green, a-b-testing) fall
        // back to the first endpoint.
        return endpoints[0];
    }
  }

  // ── Health & Metrics ────────────────────────────────────────

  /**
   * Get an aggregate health summary of all proxies in the mesh.
   *
   * @returns A `MeshHealthSummary` with counts of total,
   *          healthy, degraded, and unhealthy proxies.
   */
  getHealthStatus(): MeshHealthSummary {
    let healthy = 0;
    let degraded = 0;
    let unhealthy = 0;

    for (const proxy of this._proxies.values()) {
      switch (proxy.status) {
        case 'healthy':
          healthy++;
          break;
        case 'degraded':
          degraded++;
          break;
        case 'unhealthy':
          unhealthy++;
          break;
        // 'unknown' does not increment any bucket
        default:
          break;
      }
    }

    return {
      total: this._proxies.size,
      healthy,
      degraded,
      unhealthy,
    };
  }

  /**
   * Get detailed metrics for a specific proxy.
   *
   * @param proxyId - The proxy ID.
   * @returns A `ProxyMetrics` object, or `undefined` if the
   *          proxy is not found.
   */
  getProxyMetrics(proxyId: string): ProxyMetrics | undefined {
    const proxy = this._proxies.get(proxyId);
    if (!proxy) return undefined;

    const errorRate =
      proxy.totalRequests > 0
        ? proxy.totalErrors / proxy.totalRequests
        : 0;

    return {
      totalRequests: proxy.totalRequests,
      totalErrors: proxy.totalErrors,
      errorRate,
      avgLatencyMs: proxy.avgLatencyMs,
      circuitStates: { ...proxy.circuitStates },
      activeConnections: proxy.activeConnections,
    };
  }

  // ── Event Callbacks ─────────────────────────────────────────

  /**
   * Register a callback that fires when a circuit is opened.
   *
   * @param cb - Callback receiving `(proxyId, upstreamServiceId)`.
   */
  onCircuitOpened(cb: CircuitOpenedCallback): void {
    this._onCircuitOpened.push(cb);
  }

  /**
   * Register a callback that fires when a circuit is closed.
   *
   * @param cb - Callback receiving `(proxyId, upstreamServiceId)`.
   */
  onCircuitClosed(cb: CircuitClosedCallback): void {
    this._onCircuitClosed.push(cb);
  }

  /**
   * Register a callback that fires when a request is rate-limited.
   *
   * @param cb - Callback receiving `(proxyId)`.
   */
  onRateLimited(cb: RateLimitedCallback): void {
    this._onRateLimited.push(cb);
  }

  // ── Accessors ───────────────────────────────────────────────

  /** Total number of proxies in the mesh. */
  get proxyCount(): number {
    return this._proxies.size;
  }

  /** Number of proxies with status `'healthy'`. */
  get healthyCount(): number {
    let count = 0;
    for (const proxy of this._proxies.values()) {
      if (proxy.status === 'healthy') count++;
    }
    return count;
  }

  /** Array of all registered proxies. */
  get allProxies(): MeshProxy[] {
    return Array.from(this._proxies.values());
  }

  // ── Private: Circuit Breaker Logic ──────────────────────────

  /**
   * Evaluate and potentially transition the circuit breaker
   * state for a proxy's upstream service.
   *
   * State machine:
   * ```
   *   closed  --[failures >= threshold]--> open
   *   open    --[resetTimeout elapsed]---> half-open
   *   half-open --[success >= threshold]-> closed
   *   half-open --[failure]--------------> open
   * ```
   */
  private _evaluateCircuitBreaker(
    proxy: MeshProxy,
    upstreamServiceId: string,
    success: boolean,
  ): void {
    const cbConfig = proxy.config.trafficPolicy.circuitBreaker;
    if (!cbConfig) return;

    const trackerKey = `${proxy.id}::${upstreamServiceId}`;
    let tracker = this._circuitTrackers.get(trackerKey);

    if (!tracker) {
      tracker = {
        consecutiveFailures: 0,
        consecutiveSuccesses: 0,
        openedAt: 0,
      };
      this._circuitTrackers.set(trackerKey, tracker);
    }

    const currentState: MeshCircuitState =
      proxy.circuitStates[upstreamServiceId] ?? 'closed';

    switch (currentState) {
      case 'closed':
        this._handleClosedState(proxy, upstreamServiceId, success, tracker, cbConfig);
        break;

      case 'open':
        this._handleOpenState(proxy, upstreamServiceId, tracker, cbConfig);
        break;

      case 'half-open':
        this._handleHalfOpenState(proxy, upstreamServiceId, success, tracker, cbConfig);
        break;
    }
  }

  /**
   * Handle a request in the **closed** circuit state.
   *
   * Successes reset the consecutive failure counter. Failures
   * increment it, and when the threshold is reached the circuit
   * opens.
   */
  private _handleClosedState(
    proxy: MeshProxy,
    upstreamServiceId: string,
    success: boolean,
    tracker: CircuitBreakerTracker,
    cbConfig: MeshCircuitBreakerConfig,
  ): void {
    if (success) {
      tracker.consecutiveFailures = 0;
    } else {
      tracker.consecutiveFailures += 1;

      if (tracker.consecutiveFailures >= cbConfig.failureThreshold) {
        // Transition: closed -> open
        proxy.circuitStates[upstreamServiceId] = 'open';
        tracker.openedAt = Date.now();
        tracker.consecutiveSuccesses = 0;

        for (const cb of this._onCircuitOpened) {
          cb(proxy.id, upstreamServiceId);
        }
      }
    }
  }

  /**
   * Handle the **open** circuit state.
   *
   * If the configured reset timeout has elapsed the circuit
   * transitions to **half-open** to allow a probe request.
   */
  private _handleOpenState(
    proxy: MeshProxy,
    upstreamServiceId: string,
    tracker: CircuitBreakerTracker,
    cbConfig: MeshCircuitBreakerConfig,
  ): void {
    const elapsed = Date.now() - tracker.openedAt;

    if (elapsed >= cbConfig.resetTimeoutMs) {
      // Transition: open -> half-open
      proxy.circuitStates[upstreamServiceId] = 'half-open';
      tracker.consecutiveFailures = 0;
      tracker.consecutiveSuccesses = 0;
    }
  }

  /**
   * Handle a request in the **half-open** circuit state.
   *
   * Successes count toward the success threshold; once met the
   * circuit closes. Any failure immediately re-opens the circuit.
   */
  private _handleHalfOpenState(
    proxy: MeshProxy,
    upstreamServiceId: string,
    success: boolean,
    tracker: CircuitBreakerTracker,
    cbConfig: MeshCircuitBreakerConfig,
  ): void {
    if (success) {
      tracker.consecutiveSuccesses += 1;

      if (tracker.consecutiveSuccesses >= cbConfig.successThreshold) {
        // Transition: half-open -> closed
        proxy.circuitStates[upstreamServiceId] = 'closed';
        tracker.consecutiveFailures = 0;

        for (const cb of this._onCircuitClosed) {
          cb(proxy.id, upstreamServiceId);
        }
      }
    } else {
      // Transition: half-open -> open
      proxy.circuitStates[upstreamServiceId] = 'open';
      tracker.openedAt = Date.now();
      tracker.consecutiveSuccesses = 0;

      for (const cb of this._onCircuitOpened) {
        cb(proxy.id, upstreamServiceId);
      }
    }
  }

  // ── Private: Endpoint Selection Strategies ──────────────────

  /**
   * Round-robin endpoint selection.
   *
   * Maintains a per-proxy counter that wraps around the
   * endpoint list length.
   */
  private _selectRoundRobin(proxyId: string, endpoints: string[]): string {
    const current = this._roundRobinCounters.get(proxyId) ?? 0;
    const index = current % endpoints.length;
    this._roundRobinCounters.set(proxyId, current + 1);
    return endpoints[index];
  }

  /**
   * Weighted endpoint selection.
   *
   * Builds a cumulative weight array from the configured
   * `weights` map (keyed by endpoint URI). A random value
   * is drawn within the total weight range to select the
   * endpoint. Endpoints with no configured weight default
   * to a weight of 1.
   *
   * Falls back to round-robin when no weights are provided.
   */
  private _selectWeighted(
    proxyId: string,
    endpoints: string[],
    weights?: Record<string, number>,
  ): string {
    if (!weights || Object.keys(weights).length === 0) {
      return this._selectRoundRobin(proxyId, endpoints);
    }

    // Build cumulative weight array
    const cumulativeWeights: number[] = [];
    let totalWeight = 0;

    for (const ep of endpoints) {
      const w = weights[ep] ?? 1;
      totalWeight += w;
      cumulativeWeights.push(totalWeight);
    }

    // Pick a random value in [0, totalWeight)
    const rand = Math.random() * totalWeight;

    for (let i = 0; i < cumulativeWeights.length; i++) {
      if (rand < cumulativeWeights[i]) {
        return endpoints[i];
      }
    }

    // Fallback (should not reach here)
    return endpoints[endpoints.length - 1];
  }

  /**
   * Random endpoint selection.
   *
   * Selects a uniformly random endpoint from the list.
   */
  private _selectRandom(endpoints: string[]): string {
    const index = Math.floor(Math.random() * endpoints.length);
    return endpoints[index];
  }

  /**
   * Failover endpoint selection.
   *
   * Always returns the first endpoint in the list, treating it
   * as the primary. Callers are expected to remove failed
   * endpoints from the list before calling this method to
   * achieve failover behavior.
   */
  private _selectFailover(endpoints: string[]): string {
    return endpoints[0];
  }
}
