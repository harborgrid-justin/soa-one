// ============================================================
// SOA One SOA — Business Activity Monitoring (BAM)
// ============================================================
//
// Comprehensive Business Activity Monitoring engine for
// tracking Key Performance Indicators (KPIs), dashboards,
// and alert management.
//
// Features:
// - KPI registration, recording, and trend analysis
// - Historical KPI value tracking with configurable retention
// - Dashboard creation with aggregated KPI data views
// - Alert rule evaluation with cooldown and auto-resolution
// - Event callbacks for alert lifecycle and KPI updates
//
// Zero external dependencies.
// ============================================================

import type {
  KPIDefinition,
  KPIValue,
  BAMDashboard,
  BAMAlertRule,
  BAMAlertInstance,
  BAMMetricType,
  BAMAlertSeverity,
} from './types';

import { generateId } from './registry';

// ── Constants ───────────────────────────────────────────────

/** Maximum number of historical values retained per KPI. */
const MAX_HISTORY_PER_KPI = 1000;

// ── BAM Engine ──────────────────────────────────────────────

/**
 * Business Activity Monitoring engine.
 *
 * Provides KPI tracking, dashboard management, alert rule
 * evaluation, and event-driven callbacks for real-time
 * business activity monitoring.
 *
 * Usage:
 * ```ts
 * const bam = new BAMEngine();
 *
 * // Register a KPI
 * bam.registerKPI({
 *   id: 'order-throughput',
 *   name: 'Order Throughput',
 *   metricType: 'gauge',
 *   unit: 'orders/min',
 *   windowMs: 60_000,
 *   tags: ['orders'],
 *   enabled: true,
 *   target: 100,
 *   warningThreshold: 80,
 *   criticalThreshold: 50,
 * });
 *
 * // Record a value
 * bam.recordKPIValue('order-throughput', 95);
 *
 * // Create a dashboard
 * const dash = bam.createDashboard('Ops', ['order-throughput'], 'admin');
 *
 * // Register an alert rule
 * bam.registerAlertRule({
 *   id: 'low-throughput',
 *   name: 'Low Order Throughput',
 *   kpiId: 'order-throughput',
 *   condition: 'below',
 *   threshold: 60,
 *   severity: 'critical',
 *   cooldownMs: 300_000,
 *   enabled: true,
 * });
 * ```
 */
export class BAMEngine {
  // ── Private State ────────────────────────────────────────

  /** Registered KPI definitions keyed by KPI ID. */
  private _kpis: Map<string, KPIDefinition> = new Map();

  /** Latest KPI value per KPI ID. */
  private _kpiValues: Map<string, KPIValue> = new Map();

  /** Historical KPI values per KPI ID (max {@link MAX_HISTORY_PER_KPI} per KPI). */
  private _kpiHistory: Map<string, KPIValue[]> = new Map();

  /** Registered dashboards keyed by dashboard ID. */
  private _dashboards: Map<string, BAMDashboard> = new Map();

  /** Registered alert rules keyed by rule ID. */
  private _alertRules: Map<string, BAMAlertRule> = new Map();

  /** All alert instances (active, acknowledged, and resolved). */
  private _alerts: BAMAlertInstance[] = [];

  /** Callbacks invoked when an alert is fired. */
  private _onAlertFired: Array<(alert: BAMAlertInstance) => void> = [];

  /** Callbacks invoked when an alert is resolved. */
  private _onAlertResolved: Array<(alert: BAMAlertInstance) => void> = [];

  /** Callbacks invoked when a KPI value is updated. */
  private _onKPIUpdated: Array<(kpiId: string, value: KPIValue) => void> = [];

  // ── KPI Registration ─────────────────────────────────────

  /**
   * Register a KPI definition.
   *
   * @param kpi - The KPI definition to register.
   */
  registerKPI(kpi: KPIDefinition): void {
    this._kpis.set(kpi.id, kpi);
  }

  /**
   * Remove a KPI definition and its associated values and history.
   *
   * @param kpiId - The ID of the KPI to remove.
   * @returns `true` if the KPI was found and removed; `false` otherwise.
   */
  removeKPI(kpiId: string): boolean {
    const existed = this._kpis.delete(kpiId);
    if (existed) {
      this._kpiValues.delete(kpiId);
      this._kpiHistory.delete(kpiId);
    }
    return existed;
  }

  /**
   * Retrieve a KPI definition by ID.
   *
   * @param kpiId - The KPI ID to look up.
   * @returns The KPI definition, or `undefined` if not found.
   */
  getKPI(kpiId: string): KPIDefinition | undefined {
    return this._kpis.get(kpiId);
  }

  // ── KPI Value Recording ──────────────────────────────────

  /**
   * Record a new value for a KPI.
   *
   * Computes the trend relative to the previous value, determines
   * whether the value is on target (within defined thresholds),
   * stores the value in history, evaluates alert rules, and
   * fires KPI-updated callbacks.
   *
   * @param kpiId - The KPI ID to record a value for.
   * @param value - The numeric value to record.
   * @throws Error if the KPI is not registered.
   */
  recordKPIValue(kpiId: string, value: number): void {
    const kpi = this._kpis.get(kpiId);
    if (!kpi) {
      throw new Error(`KPI not found: ${kpiId}`);
    }

    const previous = this._kpiValues.get(kpiId);
    const previousValue = previous?.value;

    // Compute trend
    const trend = this._computeTrend(value, previousValue);

    // Compute on-target status
    const onTarget = this._isOnTarget(kpi, value);

    const kpiValue: KPIValue = {
      kpiId,
      value,
      previousValue,
      trend,
      onTarget,
      timestamp: new Date().toISOString(),
    };

    // Store latest value
    this._kpiValues.set(kpiId, kpiValue);

    // Store in history (capped at MAX_HISTORY_PER_KPI)
    let history = this._kpiHistory.get(kpiId);
    if (!history) {
      history = [];
      this._kpiHistory.set(kpiId, history);
    }
    history.push(kpiValue);
    if (history.length > MAX_HISTORY_PER_KPI) {
      history.splice(0, history.length - MAX_HISTORY_PER_KPI);
    }

    // Evaluate alert rules
    this._evaluateAlerts(kpiId, value);

    // Fire KPI-updated callbacks
    for (const cb of this._onKPIUpdated) {
      cb(kpiId, kpiValue);
    }
  }

  /**
   * Retrieve the latest KPI value.
   *
   * @param kpiId - The KPI ID.
   * @returns The latest {@link KPIValue}, or `undefined` if no value has been recorded.
   */
  getKPIValue(kpiId: string): KPIValue | undefined {
    return this._kpiValues.get(kpiId);
  }

  /**
   * Retrieve historical KPI values.
   *
   * @param kpiId - The KPI ID.
   * @param limit - Optional maximum number of entries to return (most recent first).
   * @returns An array of historical KPI values, most recent last (chronological).
   */
  getKPIHistory(kpiId: string, limit?: number): KPIValue[] {
    const history = this._kpiHistory.get(kpiId);
    if (!history) {
      return [];
    }
    if (limit !== undefined && limit > 0 && limit < history.length) {
      return history.slice(history.length - limit);
    }
    return [...history];
  }

  /**
   * Get the current trend direction for a KPI.
   *
   * @param kpiId - The KPI ID.
   * @returns `'up'`, `'down'`, or `'stable'`. Defaults to `'stable'` if no value exists.
   */
  getKPITrend(kpiId: string): 'up' | 'down' | 'stable' {
    const current = this._kpiValues.get(kpiId);
    if (!current) {
      return 'stable';
    }
    return current.trend;
  }

  // ── Dashboard Management ─────────────────────────────────

  /**
   * Create a new BAM dashboard.
   *
   * @param name   - Dashboard display name.
   * @param kpiIds - Array of KPI IDs to include in the dashboard.
   * @param owner  - Owner of the dashboard.
   * @param shared - Whether the dashboard is shared (defaults to `false`).
   * @returns The created {@link BAMDashboard}.
   */
  createDashboard(
    name: string,
    kpiIds: string[],
    owner: string,
    shared: boolean = false,
  ): BAMDashboard {
    const dashboard: BAMDashboard = {
      id: generateId(),
      name,
      kpiIds: [...kpiIds],
      owner,
      shared,
      createdAt: new Date().toISOString(),
    };

    this._dashboards.set(dashboard.id, dashboard);
    return dashboard;
  }

  /**
   * Retrieve a dashboard by ID.
   *
   * @param dashboardId - The dashboard ID.
   * @returns The {@link BAMDashboard}, or `undefined` if not found.
   */
  getDashboard(dashboardId: string): BAMDashboard | undefined {
    return this._dashboards.get(dashboardId);
  }

  /**
   * Retrieve the current KPI values for all KPIs in a dashboard.
   *
   * @param dashboardId - The dashboard ID.
   * @returns A map of KPI ID to the latest {@link KPIValue}, or `undefined`
   *          if the dashboard is not found.
   */
  getDashboardData(
    dashboardId: string,
  ): Map<string, KPIValue | undefined> | undefined {
    const dashboard = this._dashboards.get(dashboardId);
    if (!dashboard) {
      return undefined;
    }

    const data = new Map<string, KPIValue | undefined>();
    for (const kpiId of dashboard.kpiIds) {
      data.set(kpiId, this._kpiValues.get(kpiId));
    }
    return data;
  }

  // ── Alert Rule Management ────────────────────────────────

  /**
   * Register an alert rule.
   *
   * @param rule - The {@link BAMAlertRule} to register.
   */
  registerAlertRule(rule: BAMAlertRule): void {
    this._alertRules.set(rule.id, rule);
  }

  /**
   * Remove an alert rule by ID.
   *
   * @param ruleId - The alert rule ID to remove.
   * @returns `true` if the rule was found and removed; `false` otherwise.
   */
  removeAlertRule(ruleId: string): boolean {
    return this._alertRules.delete(ruleId);
  }

  // ── Alert Instance Management ────────────────────────────

  /**
   * Retrieve all currently active alerts.
   *
   * @returns An array of {@link BAMAlertInstance} with `status === 'active'`.
   */
  getActiveAlerts(): BAMAlertInstance[] {
    return this._alerts.filter((a) => a.status === 'active');
  }

  /**
   * Acknowledge an active alert.
   *
   * @param alertId - The alert instance ID.
   * @returns `true` if the alert was found and acknowledged; `false` otherwise.
   */
  acknowledgeAlert(alertId: string): boolean {
    const alert = this._alerts.find((a) => a.id === alertId);
    if (!alert || alert.status !== 'active') {
      return false;
    }
    alert.status = 'acknowledged';
    return true;
  }

  /**
   * Resolve an alert (active or acknowledged).
   *
   * @param alertId - The alert instance ID.
   * @returns `true` if the alert was found and resolved; `false` otherwise.
   */
  resolveAlert(alertId: string): boolean {
    const alert = this._alerts.find((a) => a.id === alertId);
    if (!alert || alert.status === 'resolved') {
      return false;
    }
    alert.status = 'resolved';
    alert.resolvedAt = new Date().toISOString();
    return true;
  }

  // ── Event Callbacks ──────────────────────────────────────

  /**
   * Register a callback to be invoked when an alert is fired.
   *
   * @param cb - Callback receiving the fired {@link BAMAlertInstance}.
   */
  onAlertFired(cb: (alert: BAMAlertInstance) => void): void {
    this._onAlertFired.push(cb);
  }

  /**
   * Register a callback to be invoked when an alert is resolved.
   *
   * @param cb - Callback receiving the resolved {@link BAMAlertInstance}.
   */
  onAlertResolved(cb: (alert: BAMAlertInstance) => void): void {
    this._onAlertResolved.push(cb);
  }

  /**
   * Register a callback to be invoked when a KPI value is updated.
   *
   * @param cb - Callback receiving the KPI ID and the new {@link KPIValue}.
   */
  onKPIUpdated(cb: (kpiId: string, value: KPIValue) => void): void {
    this._onKPIUpdated.push(cb);
  }

  /**
   * Update an existing dashboard.
   */
  updateDashboard(dashboardId: string, updates: { name?: string; kpiIds?: string[]; shared?: boolean }): BAMDashboard {
    const d = this._dashboards.get(dashboardId);
    if (!d) throw new Error(`Dashboard not found: ${dashboardId}`);
    if (updates.name !== undefined) d.name = updates.name;
    if (updates.kpiIds !== undefined) d.kpiIds = [...updates.kpiIds];
    if (updates.shared !== undefined) d.shared = updates.shared;
    return d;
  }

  /**
   * Remove a dashboard.
   */
  removeDashboard(dashboardId: string): boolean {
    return this._dashboards.delete(dashboardId);
  }

  /** All registered alert rules. */
  get allAlertRules(): BAMAlertRule[] {
    return Array.from(this._alertRules.values());
  }

  // ── Aggregate Accessors ──────────────────────────────────

  /** All registered KPI definitions. */
  get allKPIs(): KPIDefinition[] {
    return Array.from(this._kpis.values());
  }

  /** All dashboards. */
  get allDashboards(): BAMDashboard[] {
    return Array.from(this._dashboards.values());
  }

  /** Total number of registered KPI definitions. */
  get kpiCount(): number {
    return this._kpis.size;
  }

  /** Total number of dashboards. */
  get dashboardCount(): number {
    return this._dashboards.size;
  }

  /** Total number of registered alert rules. */
  get alertRuleCount(): number {
    return this._alertRules.size;
  }

  /** Number of currently active alerts. */
  get activeAlertCount(): number {
    let count = 0;
    for (const alert of this._alerts) {
      if (alert.status === 'active') count++;
    }
    return count;
  }

  // ── Private Helpers ──────────────────────────────────────

  /**
   * Compute the trend direction by comparing the current value
   * to the previous value.
   *
   * @param current  - Current value.
   * @param previous - Previous value (may be undefined).
   * @returns `'up'` if current exceeds previous, `'down'` if below, `'stable'` if equal or no previous.
   */
  private _computeTrend(
    current: number,
    previous: number | undefined,
  ): 'up' | 'down' | 'stable' {
    if (previous === undefined) {
      return 'stable';
    }
    if (current > previous) {
      return 'up';
    }
    if (current < previous) {
      return 'down';
    }
    return 'stable';
  }

  /**
   * Determine whether a KPI value is on target based on the
   * KPI definition's thresholds.
   *
   * A value is considered on target when:
   * - If a `target` is defined and a `criticalThreshold` is defined,
   *   the value must be between the critical threshold and the target
   *   (inclusive), or above the target if the critical threshold is
   *   below the target, or below the target if the critical threshold
   *   is above the target.
   * - If only a `warningThreshold` is defined, the value must be on
   *   the target side of the warning threshold.
   * - If no thresholds are defined, the value is always on target.
   *
   * @param kpi   - The KPI definition.
   * @param value - The value to evaluate.
   * @returns `true` if the value is considered on target.
   */
  private _isOnTarget(kpi: KPIDefinition, value: number): boolean {
    // If no target is defined, always on target
    if (kpi.target === undefined) {
      return true;
    }

    // If critical threshold is defined, check against it
    if (kpi.criticalThreshold !== undefined) {
      // Determine direction: is the critical threshold below or above the target?
      if (kpi.criticalThreshold < kpi.target) {
        // Values at or above the critical threshold and approaching/above the target are acceptable
        return value >= kpi.criticalThreshold;
      } else {
        // Critical threshold is above the target (e.g. error rate: target=5, critical=20)
        return value <= kpi.criticalThreshold;
      }
    }

    // If warning threshold is defined, check against it
    if (kpi.warningThreshold !== undefined) {
      if (kpi.warningThreshold < kpi.target) {
        return value >= kpi.warningThreshold;
      } else {
        return value <= kpi.warningThreshold;
      }
    }

    // No thresholds defined; on target
    return true;
  }

  /**
   * Evaluate all alert rules associated with a given KPI.
   *
   * For each enabled rule targeting this KPI:
   * - If the condition is met and there is no active/acknowledged alert
   *   for this rule (or the cooldown has elapsed since the last resolved
   *   alert), a new alert instance is created and `_onAlertFired`
   *   callbacks are invoked.
   * - If the condition is no longer met and there is an active or
   *   acknowledged alert for this rule, the alert is resolved and
   *   `_onAlertResolved` callbacks are invoked.
   *
   * @param kpiId - The KPI ID whose value was just recorded.
   * @param value - The numeric value that was recorded.
   */
  private _evaluateAlerts(kpiId: string, value: number): void {
    for (const rule of this._alertRules.values()) {
      if (!rule.enabled || rule.kpiId !== kpiId) {
        continue;
      }

      const conditionMet = this._checkCondition(rule, value);
      const existingAlert = this._findActiveAlertForRule(rule.id);

      if (conditionMet && !existingAlert) {
        // Check cooldown: find the most recently resolved alert for this rule
        if (this._isInCooldown(rule)) {
          continue;
        }

        // Fire new alert
        const alert: BAMAlertInstance = {
          id: generateId(),
          ruleId: rule.id,
          ruleName: rule.name,
          kpiId,
          severity: rule.severity,
          actualValue: value,
          thresholdValue: rule.threshold,
          status: 'active',
          firedAt: new Date().toISOString(),
          message: `Alert "${rule.name}": KPI "${kpiId}" value ${value} is ${rule.condition} threshold ${rule.threshold}`,
        };

        this._alerts.push(alert);

        for (const cb of this._onAlertFired) {
          cb(alert);
        }
      } else if (!conditionMet && existingAlert) {
        // Auto-resolve the alert
        existingAlert.status = 'resolved';
        existingAlert.resolvedAt = new Date().toISOString();

        for (const cb of this._onAlertResolved) {
          cb(existingAlert);
        }
      }
    }
  }

  /**
   * Check whether an alert rule's condition is met for a given value.
   *
   * @param rule  - The alert rule.
   * @param value - The KPI value to test.
   * @returns `true` if the condition is satisfied.
   */
  private _checkCondition(rule: BAMAlertRule, value: number): boolean {
    switch (rule.condition) {
      case 'above':
        return value > rule.threshold;
      case 'below':
        return value < rule.threshold;
      case 'equals':
        return value === rule.threshold;
      case 'deviation': {
        // For deviation, threshold represents the max allowed deviation
        // from the KPI's target value
        const kpi = this._kpis.get(rule.kpiId);
        if (!kpi || kpi.target === undefined) {
          return false;
        }
        const deviation = Math.abs(value - kpi.target);
        return deviation > rule.threshold;
      }
      default:
        return false;
    }
  }

  /**
   * Find an active or acknowledged alert for a given rule.
   *
   * @param ruleId - The alert rule ID.
   * @returns The active/acknowledged alert instance, or `undefined`.
   */
  private _findActiveAlertForRule(ruleId: string): BAMAlertInstance | undefined {
    return this._alerts.find(
      (a) => a.ruleId === ruleId && (a.status === 'active' || a.status === 'acknowledged'),
    );
  }

  /**
   * Determine whether a rule is within its cooldown period.
   *
   * Checks the most recently resolved alert for this rule
   * and returns `true` if the cooldown has not yet elapsed.
   *
   * @param rule - The alert rule.
   * @returns `true` if still in cooldown.
   */
  private _isInCooldown(rule: BAMAlertRule): boolean {
    if (rule.cooldownMs <= 0) {
      return false;
    }

    // Find the most recently resolved alert for this rule
    let latestResolved: BAMAlertInstance | undefined;
    for (const alert of this._alerts) {
      if (alert.ruleId !== rule.id || alert.status !== 'resolved') {
        continue;
      }
      if (
        !latestResolved ||
        (alert.resolvedAt && (!latestResolved.resolvedAt || alert.resolvedAt > latestResolved.resolvedAt))
      ) {
        latestResolved = alert;
      }
    }

    if (!latestResolved || !latestResolved.resolvedAt) {
      return false;
    }

    const resolvedTime = new Date(latestResolved.resolvedAt).getTime();
    const now = Date.now();
    return now - resolvedTime < rule.cooldownMs;
  }
}
