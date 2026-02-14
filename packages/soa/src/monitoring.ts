// ============================================================
// SOA One SOA — Monitoring & Metrics
// ============================================================

import type {
  SOAAlertRuleDefinition,
  SOAAlertInstance,
  SOAAlertSeverity,
  SOAAlertStatus,
  SOAMetricType,
} from './types';

import { generateId } from './registry';

// ── Histogram Stats ────────────────────────────────────────

/** Shape returned by {@link SOAMetricCollector.getHistogramStats}. */
export interface HistogramStats {
  /** Number of recorded values. */
  count: number;
  /** Sum of all recorded values. */
  sum: number;
  /** Arithmetic mean. */
  mean: number;
  /** Minimum value. */
  min: number;
  /** Maximum value. */
  max: number;
  /** 50th-percentile (median). */
  p50: number;
  /** 95th-percentile. */
  p95: number;
  /** 99th-percentile. */
  p99: number;
}

// ── Helpers ────────────────────────────────────────────────

/**
 * Compute a percentile from a **sorted** numeric array using
 * nearest-rank interpolation.
 *
 * @param sorted - A pre-sorted array of numbers.
 * @param p      - Percentile in the range 0–100.
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

// ============================================================
// SOAMetricCollector
// ============================================================

/**
 * Lightweight, zero-dependency metric collector supporting
 * counters, gauges, and histograms.
 */
export class SOAMetricCollector {
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
   * @param name  - Gauge name.
   * @param value - Value to set.
   */
  setGauge(name: string, value: number): void {
    this._gauges.set(name, value);
  }

  /**
   * Retrieve the current value of a gauge.
   *
   * @param name - Gauge name.
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
   * @returns An object containing count, sum, mean, min, max, p50, p95
   *          and p99 — or `null` if the histogram does not exist or is empty.
   */
  getHistogramStats(name: string): HistogramStats | null {
    const bucket = this._histograms.get(name);
    if (!bucket || bucket.length === 0) return null;

    const sorted = [...bucket].sort((a, b) => a - b);
    const count = sorted.length;
    const sum = sorted.reduce((acc, v) => acc + v, 0);
    const mean = sum / count;
    const min = sorted[0];
    const max = sorted[count - 1];
    const p50 = percentile(sorted, 50);
    const p95 = percentile(sorted, 95);
    const p99 = percentile(sorted, 99);

    return { count, sum, mean, min, max, p50, p95, p99 };
  }

  /**
   * Alias for {@link getHistogramStats}. Useful when histograms
   * are used to track timing data.
   *
   * @param name - Timer / histogram name.
   * @returns Histogram statistics or `null`.
   */
  getTimerStats(name: string): HistogramStats | null {
    return this.getHistogramStats(name);
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

// ============================================================
// SOAAlertEngine
// ============================================================

/** Callback signature for alert events. */
export type AlertCallback = (alert: SOAAlertInstance) => void;

/**
 * Rule-based alert engine that evaluates metric values against
 * registered {@link SOAAlertRuleDefinition} rules and manages
 * the resulting {@link SOAAlertInstance} lifecycle.
 */
export class SOAAlertEngine {
  /** Registered alert rules keyed by rule ID. */
  private _rules: Map<string, SOAAlertRuleDefinition> = new Map();

  /** All alert instances (active, acknowledged, or resolved). */
  private _alerts: SOAAlertInstance[] = [];

  /** Tracks the last time each rule fired (epoch ms) for cooldown. */
  private _lastFired: Map<string, number> = new Map();

  /** Callbacks invoked when a new alert fires. */
  private _onAlert: AlertCallback[] = [];

  /** Callbacks invoked when an alert is resolved. */
  private _onResolved: AlertCallback[] = [];

  // ── Rule management ──────────────────────────────────────

  /**
   * Register a new alert rule.
   *
   * @param rule - The alert rule definition to register.
   */
  registerRule(rule: SOAAlertRuleDefinition): void {
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

  // ── Evaluation ───────────────────────────────────────────

  /**
   * Evaluate all registered rules for a given metric name and value.
   *
   * For each enabled rule whose `metricName` matches, the engine checks
   * whether the condition is met. If the condition is satisfied and the
   * rule's cooldown period has elapsed since the last firing, a new
   * {@link SOAAlertInstance} is created and all `onAlert` callbacks are
   * invoked.
   *
   * @param metricName - The metric name to evaluate.
   * @param value      - The current metric value.
   * @returns An array of newly fired {@link SOAAlertInstance} objects.
   */
  evaluate(metricName: string, value: number): SOAAlertInstance[] {
    const fired: SOAAlertInstance[] = [];
    const now = Date.now();

    for (const rule of this._rules.values()) {
      if (!rule.enabled) continue;
      if (rule.metricName !== metricName) continue;

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
      }

      if (!conditionMet) continue;

      // Cooldown check
      const lastTime = this._lastFired.get(rule.id);
      if (lastTime !== undefined && now - lastTime < rule.cooldownMs) {
        continue;
      }

      // Fire alert
      const alert: SOAAlertInstance = {
        id: generateId(),
        ruleId: rule.id,
        ruleName: rule.name,
        severity: rule.severity,
        status: 'active',
        actualValue: value,
        threshold: rule.threshold,
        firedAt: new Date(now).toISOString(),
        message: `Rule "${rule.name}": metric "${metricName}" is ${rule.condition} threshold ${rule.threshold} (actual: ${value})`,
      };

      this._alerts.push(alert);
      this._lastFired.set(rule.id, now);
      fired.push(alert);

      for (const cb of this._onAlert) {
        cb(alert);
      }
    }

    return fired;
  }

  // ── Resolution ───────────────────────────────────────────

  /**
   * Resolve all active alerts that were triggered by a specific rule.
   *
   * @param ruleId - The rule ID whose active alerts should be resolved.
   */
  resolveByRule(ruleId: string): void {
    const now = new Date().toISOString();
    for (const alert of this._alerts) {
      if (alert.ruleId === ruleId && alert.status === 'active') {
        alert.status = 'resolved';
        alert.resolvedAt = now;
        for (const cb of this._onResolved) {
          cb(alert);
        }
      }
    }
  }

  /**
   * Get all alerts that are currently active.
   *
   * @returns An array of active {@link SOAAlertInstance} objects.
   */
  getActiveAlerts(): SOAAlertInstance[] {
    return this._alerts.filter((a) => a.status === 'active');
  }

  /**
   * Acknowledge an alert by ID, setting its status to `acknowledged`.
   *
   * @param alertId - The alert instance ID.
   */
  acknowledgeAlert(alertId: string): void {
    const alert = this._alerts.find((a) => a.id === alertId);
    if (alert && alert.status === 'active') {
      alert.status = 'acknowledged';
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
      for (const cb of this._onResolved) {
        cb(alert);
      }
    }
  }

  // ── Subscriptions ────────────────────────────────────────

  /**
   * Register a callback to be invoked whenever a new alert fires.
   *
   * @param cb - Callback receiving the fired {@link SOAAlertInstance}.
   */
  onAlert(cb: AlertCallback): void {
    this._onAlert.push(cb);
  }

  /**
   * Register a callback to be invoked whenever an alert is resolved.
   *
   * @param cb - Callback receiving the resolved {@link SOAAlertInstance}.
   */
  onResolved(cb: AlertCallback): void {
    this._onResolved.push(cb);
  }

  // ── Accessors ────────────────────────────────────────────

  /** Number of registered rules. */
  get ruleCount(): number {
    return this._rules.size;
  }

  /** Number of currently active alerts. */
  get activeCount(): number {
    return this._alerts.filter((a) => a.status === 'active').length;
  }
}

// ============================================================
// SOAMonitoringManager
// ============================================================

/**
 * Top-level monitoring manager that composes a
 * {@link SOAMetricCollector} and a {@link SOAAlertEngine} into
 * a single cohesive subsystem.
 */
export class SOAMonitoringManager {
  /** The metric collector instance. */
  readonly metrics: SOAMetricCollector;

  /** The alert engine instance. */
  readonly alerts: SOAAlertEngine;

  /**
   * Create a new monitoring manager, instantiating both
   * the metric collector and the alert engine.
   */
  constructor() {
    this.metrics = new SOAMetricCollector();
    this.alerts = new SOAAlertEngine();
  }

  /**
   * Shut down the monitoring subsystem, resetting all collected
   * metrics and releasing resources.
   */
  shutdown(): void {
    this.metrics.reset();
  }
}
