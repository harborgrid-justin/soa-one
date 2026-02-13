// ============================================================
// SOA One Rule Engine — Adapter Interfaces
// ============================================================
//
// Adapters allow the engine to integrate with external systems
// without introducing any runtime dependencies. Consumers
// provide concrete implementations for their infrastructure.
// ============================================================

import type { RuleSet, ExecutionResult } from './types';

// ── Data Source Adapter ────────────────────────────────────

/**
 * Fetch facts / input data from an external source such as a
 * database, REST API, message queue, or file system.
 *
 * Example implementations:
 *   - PostgresDataSource that runs a query for a given context
 *   - RestDataSource that calls an upstream microservice
 */
export interface DataSourceAdapter {
  /** Human-readable name for diagnostics. */
  readonly name: string;

  /**
   * Fetch input data for rule evaluation.
   * @param context - An opaque key/identifier that the adapter can use
   *   to determine which data to fetch (e.g., an order ID, a customer ID).
   * @param options - Optional adapter-specific options.
   * @returns The fetched data as a flat or nested record.
   */
  fetchData(
    context: Record<string, any>,
    options?: Record<string, any>,
  ): Promise<Record<string, any>>;

  /**
   * Optional initialization (open connections, warm up, etc.).
   */
  init?(): Promise<void>;

  /**
   * Optional teardown (close connections, flush buffers, etc.).
   */
  destroy?(): Promise<void>;
}

// ── Audit Adapter ──────────────────────────────────────────

/** The shape of an audit entry written after execution. */
export interface AuditEntry {
  /** ISO-8601 timestamp. */
  timestamp: string;
  /** The rule set that was executed. */
  ruleSetId: string;
  ruleSetName: string;
  /** The full execution result. */
  result: ExecutionResult;
  /** Any additional metadata (user, correlation ID, etc.). */
  metadata?: Record<string, any>;
}

/**
 * Send execution results to an external audit / compliance system.
 *
 * Example implementations:
 *   - ElasticsearchAudit that indexes execution results
 *   - FileAudit that appends to a local JSONL file
 */
export interface AuditAdapter {
  /** Human-readable name for diagnostics. */
  readonly name: string;

  /**
   * Record an audit entry after rule execution.
   */
  record(entry: AuditEntry): Promise<void>;

  /**
   * Optionally query past audit entries (for replay/debugging).
   * Implementations that do not support querying may omit this.
   */
  query?(filter: AuditQueryFilter): Promise<AuditEntry[]>;

  init?(): Promise<void>;
  destroy?(): Promise<void>;
}

/** Filter criteria for querying audit entries. */
export interface AuditQueryFilter {
  ruleSetId?: string;
  from?: string;   // ISO-8601
  to?: string;     // ISO-8601
  limit?: number;
  metadata?: Record<string, any>;
}

// ── Cache Adapter ──────────────────────────────────────────

/**
 * Cache rule set definitions and/or execution results to avoid
 * redundant computation or external lookups.
 *
 * Example implementations:
 *   - InMemoryCache using a Map with TTL
 *   - RedisCache that serialises to a Redis cluster
 */
export interface CacheAdapter {
  /** Human-readable name for diagnostics. */
  readonly name: string;

  /**
   * Retrieve a cached value by key.
   * Returns `undefined` on cache miss.
   */
  get<T = any>(key: string): Promise<T | undefined>;

  /**
   * Store a value under the given key.
   * @param ttlMs - Optional time-to-live in milliseconds.
   */
  set<T = any>(key: string, value: T, ttlMs?: number): Promise<void>;

  /**
   * Remove a cached value by key.
   */
  delete(key: string): Promise<void>;

  /**
   * Remove all cached values.
   */
  clear(): Promise<void>;

  /**
   * Check whether a key exists in the cache.
   */
  has(key: string): Promise<boolean>;

  init?(): Promise<void>;
  destroy?(): Promise<void>;
}

// ── Notification Adapter ───────────────────────────────────

/** Severity level for notifications. */
export type NotificationSeverity = 'info' | 'warning' | 'error' | 'critical';

/** A notification event emitted by the engine. */
export interface NotificationEvent {
  /** ISO-8601 timestamp. */
  timestamp: string;
  severity: NotificationSeverity;
  /** Short human-readable message. */
  message: string;
  /** The rule set ID, if applicable. */
  ruleSetId?: string;
  /** The specific rule ID, if applicable. */
  ruleId?: string;
  /** Additional structured data. */
  details?: Record<string, any>;
}

/**
 * Send alerts / notifications on rule execution events.
 *
 * Example implementations:
 *   - SlackNotification that posts to a channel
 *   - PagerDutyNotification that triggers incidents
 *   - SnsNotification that publishes to an AWS topic
 */
export interface NotificationAdapter {
  /** Human-readable name for diagnostics. */
  readonly name: string;

  /**
   * Send a notification event.
   */
  notify(event: NotificationEvent): Promise<void>;

  init?(): Promise<void>;
  destroy?(): Promise<void>;
}

// ── Adapter Collection ─────────────────────────────────────

/**
 * Convenience type grouping all adapter slots that the `RuleEngine`
 * accepts in its configuration.
 */
export interface EngineAdapters {
  dataSources?: DataSourceAdapter[];
  audit?: AuditAdapter;
  cache?: CacheAdapter;
  notification?: NotificationAdapter;
}
