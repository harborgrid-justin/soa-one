// ============================================================
// SOA One DQM — Monitoring & Alerting
// ============================================================
//
// DQM monitoring, metrics collection, and alerting engine.
//
// Features beyond Oracle Data Quality:
// - Counter, gauge, histogram, and timer metric types
// - Historical metric retention with configurable limits
// - Alert rule engine with condition evaluation
// - Alert severity and cooldown management
// - Callback-based alert and resolution notifications
// - Real-time metric statistics (min, max, mean, p95, p99)
// - Standard deviation and median computation
// - Facade manager for unified access
//
// Zero external dependencies.
// ============================================================

import type {
  DQMAlertRuleDefinition,
  DQMAlertInstance,
  DQMAlertSeverity,
  DQMAlertStatus,
  DQMMetricType,
  DQMHealth,
} from './types';

import { generateId } from './profiler';

// ── Histogram Stats ─────────────────────────────────────────

/** Histogram/timer statistics. */
export interface HistogramStats {
  min: number;
  max: number;
  mean: number;
  median: number;
  p95: number;
  p99: number;
  count: number;
  sum: number;
  standardDeviation: number;
}

// ── Metric Data Point ───────────────────────────────────────

/** A metric data point with timestamp. */
interface MetricDataPoint {
  value: number;
  timestamp: number;
  labels?: Record<string, string>;
}

// ── Metric Collector ────────────────────────────────────────

/**
 * Collects and stores metrics for the DQM system.
 */
export class DQMMetricCollector {
  private readonly _counters = new Map<string, number>();
  private readonly _gauges = new Map<string, number>();
  private readonly _histograms = new Map<string, number[]>();
  private readonly _timers = new Map<string, number[]>();
  private readonly _history = new Map<string, MetricDataPoint[]>();
  private readonly _maxHistory: number;

  constructor(maxHistory = 1000) {
    this._maxHistory = maxHistory;
  }

  /** Increment a counter metric. */
  incrementCounter(name: string, amount = 1, labels?: Record<string, string>): void {
    const current = this._counters.get(name) ?? 0;
    this._counters.set(name, current + amount);
    this._recordHistory(name, current + amount, labels);
  }

  /** Decrement a counter metric. */
  decrementCounter(name: string, amount = 1, labels?: Record<string, string>): void {
    const current = this._counters.get(name) ?? 0;
    this._counters.set(name, current - amount);
    this._recordHistory(name, current - amount, labels);
  }

  /** Get a counter value. */
  getCounter(name: string): number {
    return this._counters.get(name) ?? 0;
  }

  /** Set a gauge metric. */
  setGauge(name: string, value: number, labels?: Record<string, string>): void {
    this._gauges.set(name, value);
    this._recordHistory(name, value, labels);
  }

  /** Get a gauge value. */
  getGauge(name: string): number {
    return this._gauges.get(name) ?? 0;
  }

  /** Record a histogram value. */
  recordHistogram(name: string, value: number, labels?: Record<string, string>): void {
    if (!this._histograms.has(name)) {
      this._histograms.set(name, []);
    }
    const values = this._histograms.get(name)!;
    values.push(value);

    // Keep last 10000 values
    if (values.length > 10000) {
      values.splice(0, values.length - 10000);
    }

    this._recordHistory(name, value, labels);
  }

  /** Get histogram statistics. */
  getHistogramStats(name: string): HistogramStats | null {
    const values = this._histograms.get(name);
    if (!values || values.length === 0) return null;
    return this._computeStats(values);
  }

  /** Record a timer value (duration in ms). */
  recordTimer(name: string, durationMs: number, labels?: Record<string, string>): void {
    if (!this._timers.has(name)) {
      this._timers.set(name, []);
    }
    const values = this._timers.get(name)!;
    values.push(durationMs);

    if (values.length > 10000) {
      values.splice(0, values.length - 10000);
    }

    this._recordHistory(name, durationMs, labels);
  }

  /** Get timer statistics. */
  getTimerStats(name: string): HistogramStats | null {
    const values = this._timers.get(name);
    if (!values || values.length === 0) return null;
    return this._computeStats(values);
  }

  /** Get all metric names. */
  getMetricNames(): string[] {
    const names = new Set<string>();
    for (const name of this._counters.keys()) names.add(name);
    for (const name of this._gauges.keys()) names.add(name);
    for (const name of this._histograms.keys()) names.add(name);
    for (const name of this._timers.keys()) names.add(name);
    return Array.from(names);
  }

  /** Reset all metrics. */
  reset(): void {
    this._counters.clear();
    this._gauges.clear();
    this._histograms.clear();
    this._timers.clear();
    this._history.clear();
  }

  // ── Private ─────────────────────────────────────────────

  private _recordHistory(
    name: string,
    value: number,
    labels?: Record<string, string>,
  ): void {
    if (!this._history.has(name)) {
      this._history.set(name, []);
    }
    const history = this._history.get(name)!;
    history.push({ value, timestamp: Date.now(), labels });

    if (history.length > this._maxHistory) {
      history.splice(0, history.length - this._maxHistory);
    }
  }

  private _computeStats(values: number[]): HistogramStats {
    const sorted = [...values].sort((a, b) => a - b);
    const n = sorted.length;
    const sum = sorted.reduce((a, b) => a + b, 0);
    const mean = sum / n;

    return {
      count: n,
      min: sorted[0],
      max: sorted[n - 1],
      mean,
      median: n % 2 === 0
        ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2
        : sorted[Math.floor(n / 2)],
      p95: sorted[Math.floor(n * 0.95)],
      p99: sorted[Math.floor(n * 0.99)],
      sum,
      standardDeviation: Math.sqrt(
        sorted.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / n,
      ),
    };
  }
}

// ── Alert Engine ────────────────────────────────────────────

/**
 * Alert engine for monitoring thresholds and firing alerts.
 */
export class DQMAlertEngine {
  private readonly _rules = new Map<string, DQMAlertRuleDefinition>();
  private readonly _activeAlerts = new Map<string, DQMAlertInstance>();
  private readonly _resolvedAlerts: DQMAlertInstance[] = [];
  private readonly _onAlertCallbacks: ((alert: DQMAlertInstance) => void)[] = [];
  private readonly _onResolvedCallbacks: ((alert: DQMAlertInstance) => void)[] = [];
  private readonly _lastEvaluation = new Map<string, number>();

  /** Register an alert rule. */
  registerRule(rule: DQMAlertRuleDefinition): void {
    this._rules.set(rule.id, { ...rule });
  }

  /** Unregister an alert rule. */
  unregisterRule(ruleId: string): void {
    this._rules.delete(ruleId);
    this._lastEvaluation.delete(ruleId);
  }

  /** Get a rule. */
  getRule(ruleId: string): DQMAlertRuleDefinition | undefined {
    return this._rules.get(ruleId);
  }

  /** Total rules count. */
  get ruleCount(): number {
    return this._rules.size;
  }

  /** Active alert count. */
  get activeCount(): number {
    return this._activeAlerts.size;
  }

  /** Get all active alerts. */
  get activeAlerts(): DQMAlertInstance[] {
    return Array.from(this._activeAlerts.values());
  }

  /** Evaluate all alert rules against current metrics. */
  evaluateRules(metrics: DQMMetricCollector): void {
    for (const rule of this._rules.values()) {
      if (!rule.enabled) continue;

      // Check cooldown
      const lastFired = this._lastEvaluation.get(rule.id);
      if (lastFired && rule.cooldownMs) {
        if (Date.now() - lastFired < rule.cooldownMs) continue;
      }

      this._evaluateRule(rule, metrics);
    }
  }

  /** Acknowledge an alert. */
  acknowledge(alertId: string): void {
    const alert = this._activeAlerts.get(alertId);
    if (alert && alert.status === 'active') {
      alert.status = 'acknowledged';
      alert.acknowledgedAt = new Date().toISOString();
    }
  }

  /** Resolve an alert. */
  resolve(alertId: string): void {
    const alert = this._activeAlerts.get(alertId);
    if (alert && alert.status !== 'resolved') {
      alert.status = 'resolved';
      alert.resolvedAt = new Date().toISOString();
      this._activeAlerts.delete(alertId);
      this._resolvedAlerts.push(alert);

      for (const cb of this._onResolvedCallbacks) {
        cb(alert);
      }
    }
  }

  /** Register an alert callback. */
  onAlert(callback: (alert: DQMAlertInstance) => void): void {
    this._onAlertCallbacks.push(callback);
  }

  /** Register a resolved callback. */
  onResolved(callback: (alert: DQMAlertInstance) => void): void {
    this._onResolvedCallbacks.push(callback);
  }

  // ── Private ─────────────────────────────────────────────

  private _evaluateRule(rule: DQMAlertRuleDefinition, metrics: DQMMetricCollector): void {
    // Resolve metric value: try counter first, then gauge
    const counter = metrics.getCounter(rule.metric);
    const gauge = metrics.getGauge(rule.metric);
    const metricValue = counter !== 0 ? counter : gauge;

    const shouldFire = this._checkCondition(metricValue, rule.condition, rule.threshold);

    if (shouldFire) {
      // Only fire if no active alert exists for this rule
      const existingAlert = this._getActiveAlertForRule(rule.id);
      if (!existingAlert) {
        this._fireAlert(rule, metricValue);
      }
    } else {
      // Auto-resolve if condition no longer met
      this._resolveAlert(rule.id);
    }
  }

  private _fireAlert(rule: DQMAlertRuleDefinition, metricValue: number): void {
    const alert: DQMAlertInstance = {
      id: generateId(),
      ruleId: rule.id,
      ruleName: rule.name,
      severity: rule.severity,
      status: 'active',
      message: `Alert: ${rule.name} — ${rule.metric} ${rule.condition} ${rule.threshold} (current: ${metricValue})`,
      metricValue,
      threshold: rule.threshold,
      firedAt: new Date().toISOString(),
    };

    this._activeAlerts.set(alert.id, alert);
    this._lastEvaluation.set(rule.id, Date.now());

    for (const cb of this._onAlertCallbacks) {
      cb(alert);
    }
  }

  private _resolveAlert(ruleId: string): void {
    const existing = this._getActiveAlertForRule(ruleId);
    if (existing) {
      existing.status = 'resolved';
      existing.resolvedAt = new Date().toISOString();
      this._activeAlerts.delete(existing.id);
      this._resolvedAlerts.push(existing);

      for (const cb of this._onResolvedCallbacks) {
        cb(existing);
      }
    }
  }

  private _getActiveAlertForRule(ruleId: string): DQMAlertInstance | undefined {
    for (const alert of this._activeAlerts.values()) {
      if (
        alert.ruleId === ruleId &&
        (alert.status === 'active' || alert.status === 'acknowledged')
      ) {
        return alert;
      }
    }
    return undefined;
  }

  private _checkCondition(
    value: number,
    condition: DQMAlertRuleDefinition['condition'],
    threshold: number,
  ): boolean {
    switch (condition) {
      case 'above':
        return value > threshold;
      case 'below':
        return value < threshold;
      case 'equals':
        return value === threshold;
      case 'not-equals':
        return value !== threshold;
      case 'rate-of-change':
        // For rate-of-change, treat threshold as the maximum allowed delta.
        // Without a previous sample stored per-metric the best we can do is
        // compare against absolute threshold.
        return Math.abs(value) > threshold;
      default:
        return false;
    }
  }
}

// ── Monitoring Manager ──────────────────────────────────────

/**
 * Central monitoring manager integrating metrics and alerts.
 */
export class DQMMonitoringManager {
  readonly metrics: DQMMetricCollector;
  readonly alerts: DQMAlertEngine;

  constructor() {
    this.metrics = new DQMMetricCollector();
    this.alerts = new DQMAlertEngine();
  }

  /** Shut down monitoring and reset state. */
  shutdown(): void {
    this.metrics.reset();
  }
}
