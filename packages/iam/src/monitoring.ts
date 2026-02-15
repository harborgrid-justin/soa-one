// ============================================================
// SOA One IAM — Monitoring & Metrics
// ============================================================
//
// Lightweight, zero-dependency monitoring subsystem for the
// Identity and Access Management module.
//
// - IAMMetricCollector: counters, gauges, and histograms with
//   optional label-based composite keys.
// - IAMAlertEngine: rule-based alerting with cooldown,
//   acknowledgement, resolution, and callback support.
// - IAMMonitoringManager: facade that composes both into a
//   single entry point.
//
// Zero external dependencies. 100% in-memory.
// ============================================================

import type {
  IAMAlertRuleDefinition,
  IAMAlertInstance,
  IAMAlertSeverity,
  IAMAlertStatus,
  IAMMetricType,
  IAMMetricDataPoint,
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
 * Compute a percentile from a **sorted** numeric array using
 * nearest-rank interpolation.
 *
 * @param sorted - A pre-sorted array of numbers.
 * @param p      - Percentile in the range 0-100.
 * @returns The value at the requested percentile.
 */
function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0];
  const idx = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(idx);
  const upper = Math.ceil(idx);
  if (lower === upper) return sorted[lower];
  const fraction = idx - lower;
  return sorted[lower] + fraction * (sorted[upper] - sorted[lower]);
}

/**
 * Build a composite key from a metric name and an optional label record.
 *
 * @param name   - Base metric name.
 * @param labels - Optional key/value label pairs.
 * @returns A deterministic composite string key.
 */
function compositeKey(name: string, labels?: Record<string, string>): string {
  if (!labels || Object.keys(labels).length === 0) return name;
  const parts = Object.keys(labels)
    .sort()
    .map((k) => `${k}=${labels[k]}`);
  return `${name}{${parts.join(',')}}`;
}

// ── Histogram Stats ────────────────────────────────────────

/** Shape returned by {@link IAMMetricCollector.getHistogramStats}. */
export interface IAMHistogramStats {
  /** Number of recorded values. */
  count: number;
  /** Minimum value. */
  min: number;
  /** Maximum value. */
  max: number;
  /** Arithmetic mean. */
  avg: number;
  /** 50th-percentile (median). */
  p50: number;
  /** 95th-percentile. */
  p95: number;
  /** 99th-percentile. */
  p99: number;
}

/** Callback signature for alert events. */
export type IAMAlertCallback = (alert: IAMAlertInstance) => void;

// ============================================================
// IAMMetricCollector
// ============================================================

/**
 * Lightweight, zero-dependency metric collector supporting
 * counters, gauges, and histograms with optional label-based
 * composite keys.
 */
export class IAMMetricCollector {
  /** Counter values keyed by composite name. */
  private _counters: Map<string, number> = new Map();

  /** Gauge values keyed by composite name. */
  private _gauges: Map<string, number> = new Map();

  /** Histogram value arrays keyed by composite name. */
  private _histograms: Map<string, number[]> = new Map();

  // ── Counters ─────────────────────────────────────────────

  /**
   * Increment a counter by a given amount.
   *
   * @param name   - Counter name.
   * @param amount - Increment amount (defaults to 1).
   * @param labels - Optional labels used to build a composite key.
   */
  incrementCounter(
    name: string,
    amount: number = 1,
    labels?: Record<string, string>,
  ): void {
    const key = compositeKey(name, labels);
    const current = this._counters.get(key) ?? 0;
    this._counters.set(key, current + amount);
  }

  /**
   * Decrement a counter by a given amount.
   *
   * @param name   - Counter name.
   * @param amount - Decrement amount (defaults to 1).
   * @param labels - Optional labels used to build a composite key.
   */
  decrementCounter(
    name: string,
    amount: number = 1,
    labels?: Record<string, string>,
  ): void {
    const key = compositeKey(name, labels);
    const current = this._counters.get(key) ?? 0;
    this._counters.set(key, current - amount);
  }

  /**
   * Retrieve the current value of a counter.
   *
   * @param name - Counter name (exact key).
   * @returns The counter value, or `0` if it has not been set.
   */
  getCounter(name: string): number {
    return this._counters.get(name) ?? 0;
  }

  // ── Gauges ───────────────────────────────────────────────

  /**
   * Set a gauge to an absolute value.
   *
   * @param name   - Gauge name.
   * @param value  - Value to set.
   * @param labels - Optional labels used to build a composite key.
   */
  setGauge(
    name: string,
    value: number,
    labels?: Record<string, string>,
  ): void {
    const key = compositeKey(name, labels);
    this._gauges.set(key, value);
  }

  /**
   * Retrieve the current value of a gauge.
   *
   * @param name - Gauge name (exact key).
   * @returns The gauge value, or `0` if it has not been set.
   */
  getGauge(name: string): number {
    return this._gauges.get(name) ?? 0;
  }

  // ── Histograms ───────────────────────────────────────────

  /**
   * Record a single observation in a histogram.
   *
   * @param name   - Histogram name.
   * @param value  - Observed value.
   * @param labels - Optional labels used to build a composite key.
   */
  recordHistogram(
    name: string,
    value: number,
    labels?: Record<string, string>,
  ): void {
    const key = compositeKey(name, labels);
    let bucket = this._histograms.get(key);
    if (!bucket) {
      bucket = [];
      this._histograms.set(key, bucket);
    }
    bucket.push(value);
  }

  /**
   * Compute summary statistics for a histogram.
   *
   * @param name - Histogram name (exact key).
   * @returns An object containing count, min, max, avg, p50, p95 and
   *          p99 -- or an object with all zeros if the histogram does
   *          not exist or is empty.
   */
  getHistogramStats(name: string): IAMHistogramStats {
    const bucket = this._histograms.get(name);
    if (!bucket || bucket.length === 0) {
      return { count: 0, min: 0, max: 0, avg: 0, p50: 0, p95: 0, p99: 0 };
    }

    const sorted = [...bucket].sort((a, b) => a - b);
    const count = sorted.length;
    const sum = sorted.reduce((acc, v) => acc + v, 0);
    const avg = sum / count;
    const min = sorted[0];
    const max = sorted[count - 1];
    const p50 = percentile(sorted, 50);
    const p95 = percentile(sorted, 95);
    const p99 = percentile(sorted, 99);

    return { count, min, max, avg, p50, p95, p99 };
  }

  // ── Snapshot ─────────────────────────────────────────────

  /**
   * Return all currently tracked metrics as an array of
   * {@link IAMMetricDataPoint} objects.
   *
   * @returns An array of metric data points for counters, gauges,
   *          and histograms.
   */
  getAllMetrics(): IAMMetricDataPoint[] {
    const now = new Date().toISOString();
    const points: IAMMetricDataPoint[] = [];

    for (const [key, value] of this._counters.entries()) {
      const { name, labels } = parseCompositeKey(key);
      points.push({ name, type: 'counter', value, labels, timestamp: now });
    }

    for (const [key, value] of this._gauges.entries()) {
      const { name, labels } = parseCompositeKey(key);
      points.push({ name, type: 'gauge', value, labels, timestamp: now });
    }

    for (const [key, bucket] of this._histograms.entries()) {
      const { name, labels } = parseCompositeKey(key);
      const sum = bucket.reduce((acc, v) => acc + v, 0);
      points.push({ name, type: 'histogram', value: sum, labels, timestamp: now });
    }

    return points;
  }

  // ── Lifecycle ────────────────────────────────────────────

  /**
   * Reset **all** collected metrics (counters, gauges, and histograms).
   */
  reset(): void {
    this._counters.clear();
    this._gauges.clear();
    this._histograms.clear();
  }
}

// ── Key parsing helper ─────────────────────────────────────

/**
 * Parse a composite key back into a metric name and labels.
 *
 * @param key - A composite key produced by {@link compositeKey}.
 * @returns An object containing the base `name` and a `labels` record.
 */
function parseCompositeKey(key: string): { name: string; labels: Record<string, string> } {
  const braceIdx = key.indexOf('{');
  if (braceIdx === -1) {
    return { name: key, labels: {} };
  }

  const name = key.substring(0, braceIdx);
  const inner = key.substring(braceIdx + 1, key.length - 1);
  const labels: Record<string, string> = {};

  if (inner.length > 0) {
    const pairs = inner.split(',');
    for (const pair of pairs) {
      const eqIdx = pair.indexOf('=');
      if (eqIdx !== -1) {
        labels[pair.substring(0, eqIdx)] = pair.substring(eqIdx + 1);
      }
    }
  }

  return { name, labels };
}

// ============================================================
// IAMAlertEngine
// ============================================================

/**
 * Rule-based alert engine that evaluates metric values against
 * registered {@link IAMAlertRuleDefinition} rules and manages
 * the resulting {@link IAMAlertInstance} lifecycle.
 */
export class IAMAlertEngine {
  /** Registered alert rules keyed by rule ID. */
  private _rules: Map<string, IAMAlertRuleDefinition> = new Map();

  /** All alert instances (active, acknowledged, or resolved). */
  private _alerts: IAMAlertInstance[] = [];

  /** Tracks the last time each rule fired (epoch ms) for cooldown. */
  private _lastFired: Map<string, number> = new Map();

  /** Callbacks invoked when a new alert fires. */
  private _onAlertCallbacks: IAMAlertCallback[] = [];

  /** Callbacks invoked when an alert is resolved. */
  private _onResolvedCallbacks: IAMAlertCallback[] = [];

  // ── Rule management ──────────────────────────────────────

  /**
   * Register a new alert rule.
   *
   * If a rule with the same ID already exists it will be
   * overwritten.
   *
   * @param rule - The alert rule definition to register.
   */
  registerRule(rule: IAMAlertRuleDefinition): void {
    this._rules.set(rule.id, rule);
  }

  /**
   * Remove an alert rule by ID.
   *
   * @param ruleId - The ID of the rule to remove.
   */
  removeRule(ruleId: string): void {
    this._rules.delete(ruleId);
  }

  /**
   * Retrieve an alert rule by ID.
   *
   * @param ruleId - The ID of the rule to retrieve.
   * @returns The rule definition, or `undefined` if not found.
   */
  getRule(ruleId: string): IAMAlertRuleDefinition | undefined {
    return this._rules.get(ruleId);
  }

  /**
   * List all registered alert rules.
   *
   * @returns An array of all registered rule definitions.
   */
  listRules(): IAMAlertRuleDefinition[] {
    return Array.from(this._rules.values());
  }

  // ── Evaluation ───────────────────────────────────────────

  /**
   * Evaluate all registered rules for a given metric name and value.
   *
   * For each enabled rule whose `metric` matches, the engine checks
   * whether the condition is met. If the condition is satisfied and
   * the rule's cooldown period has elapsed since the last firing, a
   * new {@link IAMAlertInstance} is created and all `onAlert`
   * callbacks are invoked.
   *
   * @param metricName - The metric name to evaluate.
   * @param value      - The current metric value.
   * @returns A newly fired {@link IAMAlertInstance}, or `null` if no
   *          rule was triggered.
   */
  evaluate(metricName: string, value: number): IAMAlertInstance | null {
    const now = Date.now();

    for (const rule of this._rules.values()) {
      if (!rule.enabled) continue;
      if (rule.metric !== metricName) continue;

      // Check condition
      let conditionMet = false;
      switch (rule.condition) {
        case 'above':
          conditionMet = value > rule.threshold;
          break;
        case 'below':
          conditionMet = value < rule.threshold;
          break;
        case 'equals':
          conditionMet = value === rule.threshold;
          break;
        case 'change':
          // For "change" we treat any non-zero value as a trigger
          conditionMet = value !== 0;
          break;
        case 'absence':
          // For "absence" we treat a zero/missing value as a trigger
          conditionMet = value === 0;
          break;
      }

      if (!conditionMet) continue;

      // Cooldown check (cooldownMinutes converted to ms)
      const cooldownMs = rule.cooldownMinutes * 60 * 1000;
      const lastTime = this._lastFired.get(rule.id);
      if (lastTime !== undefined && now - lastTime < cooldownMs) {
        continue;
      }

      // Fire alert
      const alert: IAMAlertInstance = {
        id: generateId(),
        ruleId: rule.id,
        ruleName: rule.name,
        severity: rule.severity,
        status: 'active',
        message: `Rule "${rule.name}": metric "${metricName}" is ${rule.condition} threshold ${rule.threshold} (actual: ${value})`,
        value,
        threshold: rule.threshold,
        firedAt: new Date(now).toISOString(),
        metadata: { ...rule.metadata },
      };

      this._alerts.push(alert);
      this._lastFired.set(rule.id, now);

      for (const cb of this._onAlertCallbacks) {
        cb(alert);
      }

      return alert;
    }

    return null;
  }

  // ── Alert lifecycle ──────────────────────────────────────

  /**
   * Acknowledge an alert by ID, setting its status to `acknowledged`.
   *
   * @param alertId - The alert instance ID.
   */
  acknowledgeAlert(alertId: string): void {
    const alert = this._alerts.find((a) => a.id === alertId);
    if (alert && alert.status === 'active') {
      alert.status = 'acknowledged';
      alert.acknowledgedAt = new Date().toISOString();
    }
  }

  /**
   * Resolve an alert by ID, setting its status to `resolved`.
   *
   * @param alertId - The alert instance ID.
   */
  resolveAlert(alertId: string): void {
    const alert = this._alerts.find((a) => a.id === alertId);
    if (alert && alert.status !== 'resolved') {
      alert.status = 'resolved';
      alert.resolvedAt = new Date().toISOString();
      for (const cb of this._onResolvedCallbacks) {
        cb(alert);
      }
    }
  }

  /**
   * Get all alerts that are currently active.
   *
   * @returns An array of active {@link IAMAlertInstance} objects.
   */
  getActiveAlerts(): IAMAlertInstance[] {
    return this._alerts.filter((a) => a.status === 'active');
  }

  /**
   * Get the full alert history (active, acknowledged, and resolved).
   *
   * @returns An array of all {@link IAMAlertInstance} objects.
   */
  getAlertHistory(): IAMAlertInstance[] {
    return [...this._alerts];
  }

  // ── Accessors ────────────────────────────────────────────

  /** Number of currently active alerts. */
  get activeCount(): number {
    return this._alerts.filter((a) => a.status === 'active').length;
  }

  // ── Subscriptions ────────────────────────────────────────

  /**
   * Register a callback to be invoked whenever a new alert fires.
   *
   * @param cb - Callback receiving the fired {@link IAMAlertInstance}.
   */
  onAlert(cb: IAMAlertCallback): void {
    this._onAlertCallbacks.push(cb);
  }

  /**
   * Register a callback to be invoked whenever an alert is resolved.
   *
   * @param cb - Callback receiving the resolved {@link IAMAlertInstance}.
   */
  onResolved(cb: IAMAlertCallback): void {
    this._onResolvedCallbacks.push(cb);
  }
}

// ============================================================
// IAMMonitoringManager
// ============================================================

/**
 * Top-level monitoring manager that composes an
 * {@link IAMMetricCollector} and an {@link IAMAlertEngine} into
 * a single cohesive subsystem.
 */
export class IAMMonitoringManager {
  /** The metric collector instance. */
  readonly metrics: IAMMetricCollector;

  /** The alert engine instance. */
  readonly alerts: IAMAlertEngine;

  /**
   * Create a new monitoring manager, instantiating both
   * the metric collector and the alert engine.
   */
  constructor() {
    this.metrics = new IAMMetricCollector();
    this.alerts = new IAMAlertEngine();
  }

  /**
   * Shut down the monitoring subsystem, resetting all collected
   * metrics and releasing resources.
   */
  shutdown(): void {
    this.metrics.reset();
  }
}
