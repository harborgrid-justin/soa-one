// ============================================================
// SOA One ESB — Metrics & Observability
// ============================================================
//
// Built-in metrics collection, aggregation, and reporting.
// Tracks counters, gauges, histograms, and summaries.
//
// Beyond Oracle ESB (which relies on JMX):
// - In-process metrics (no external dependency)
// - Histogram with percentile calculations
// - Metric labels for dimensional data
// - Time-series snapshot export
// - Health check aggregation
// - Throughput tracking with sliding window
// ============================================================

import type {
  ESBMetrics,
  MetricDataPoint,
  MetricType,
  EndpointHealthStatus,
  CircuitBreakerState,
} from './types';

// ── Metric Collector ──────────────────────────────────────────

/** Internal metric storage. */
interface MetricEntry {
  name: string;
  type: MetricType;
  labels: Record<string, string>;
  values: number[];
  lastValue: number;
  count: number;
  sum: number;
  min: number;
  max: number;
  createdAt: number;
  updatedAt: number;
}

/**
 * Collects and aggregates metrics for the ESB.
 * Zero-dependency implementation with histogram support.
 */
export class MetricCollector {
  private _metrics: Map<string, MetricEntry> = new Map();
  private _startTime = Date.now();

  // Sliding window for throughput
  private _throughputWindow: number[] = [];
  private _throughputWindowSize = 60_000; // 1 minute

  // ── Recording ─────────────────────────────────────────────

  /** Increment a counter by the given amount. */
  incrementCounter(
    name: string,
    amount: number = 1,
    labels: Record<string, string> = {},
  ): void {
    const key = this._makeKey(name, labels);
    const entry = this._getOrCreate(key, name, 'counter', labels);
    entry.lastValue += amount;
    entry.count++;
    entry.sum += amount;
    entry.updatedAt = Date.now();
  }

  /** Set a gauge to a specific value. */
  setGauge(
    name: string,
    value: number,
    labels: Record<string, string> = {},
  ): void {
    const key = this._makeKey(name, labels);
    const entry = this._getOrCreate(key, name, 'gauge', labels);
    entry.lastValue = value;
    entry.count++;
    entry.updatedAt = Date.now();
  }

  /** Record a value in a histogram. */
  recordHistogram(
    name: string,
    value: number,
    labels: Record<string, string> = {},
  ): void {
    const key = this._makeKey(name, labels);
    const entry = this._getOrCreate(key, name, 'histogram', labels);
    entry.values.push(value);
    entry.lastValue = value;
    entry.count++;
    entry.sum += value;
    entry.min = Math.min(entry.min, value);
    entry.max = Math.max(entry.max, value);
    entry.updatedAt = Date.now();

    // Keep last 1000 values for percentile calculations
    if (entry.values.length > 1000) {
      entry.values = entry.values.slice(-1000);
    }
  }

  /** Record a throughput event (message processed). */
  recordThroughput(): void {
    const now = Date.now();
    this._throughputWindow.push(now);

    // Clean old entries
    const cutoff = now - this._throughputWindowSize;
    while (this._throughputWindow.length > 0 && this._throughputWindow[0] < cutoff) {
      this._throughputWindow.shift();
    }
  }

  // ── Querying ──────────────────────────────────────────────

  /** Get the current value of a counter. */
  getCounter(name: string, labels: Record<string, string> = {}): number {
    const key = this._makeKey(name, labels);
    return this._metrics.get(key)?.lastValue ?? 0;
  }

  /** Get the current value of a gauge. */
  getGauge(name: string, labels: Record<string, string> = {}): number {
    const key = this._makeKey(name, labels);
    return this._metrics.get(key)?.lastValue ?? 0;
  }

  /** Get histogram statistics. */
  getHistogram(
    name: string,
    labels: Record<string, string> = {},
  ): {
    count: number;
    sum: number;
    min: number;
    max: number;
    average: number;
    p50: number;
    p95: number;
    p99: number;
  } | undefined {
    const key = this._makeKey(name, labels);
    const entry = this._metrics.get(key);
    if (!entry || entry.type !== 'histogram' || entry.count === 0) return undefined;

    const sorted = [...entry.values].sort((a, b) => a - b);
    return {
      count: entry.count,
      sum: entry.sum,
      min: entry.min,
      max: entry.max,
      average: entry.sum / entry.count,
      p50: this._percentile(sorted, 50),
      p95: this._percentile(sorted, 95),
      p99: this._percentile(sorted, 99),
    };
  }

  /** Get current throughput (messages per second). */
  getThroughput(): number {
    const now = Date.now();
    const cutoff = now - this._throughputWindowSize;

    // Clean old entries
    while (this._throughputWindow.length > 0 && this._throughputWindow[0] < cutoff) {
      this._throughputWindow.shift();
    }

    // Calculate per-second rate
    const windowSeconds = this._throughputWindowSize / 1000;
    return this._throughputWindow.length / windowSeconds;
  }

  /** Get uptime in ms. */
  get uptimeMs(): number {
    return Date.now() - this._startTime;
  }

  // ── Snapshots ─────────────────────────────────────────────

  /** Get all metrics as data points for export. */
  getAllMetrics(): MetricDataPoint[] {
    const points: MetricDataPoint[] = [];
    const now = new Date().toISOString();

    for (const entry of this._metrics.values()) {
      points.push({
        name: entry.name,
        value: entry.lastValue,
        timestamp: now,
        labels: entry.labels,
      });
    }

    return points;
  }

  /**
   * Build a full ESBMetrics snapshot.
   * Requires external data for channel depths, endpoint health, etc.
   */
  buildSnapshot(
    externalData: {
      channelDepths?: Record<string, number>;
      endpointHealth?: Record<string, EndpointHealthStatus>;
      circuitBreakerStates?: Record<string, CircuitBreakerState>;
      activeSagas?: number;
    } = {},
  ): ESBMetrics {
    const latencyHistogram = this.getHistogram('message.processing.latency');

    return {
      messagesProcessed: this.getCounter('messages.processed'),
      messagesFailed: this.getCounter('messages.failed'),
      messagesInFlight: this.getGauge('messages.in_flight'),
      averageLatencyMs: latencyHistogram?.average ?? 0,
      p95LatencyMs: latencyHistogram?.p95 ?? 0,
      p99LatencyMs: latencyHistogram?.p99 ?? 0,
      channelDepths: externalData.channelDepths ?? {},
      endpointHealth: externalData.endpointHealth ?? {},
      circuitBreakerStates: externalData.circuitBreakerStates ?? {},
      throughputPerSecond: this.getThroughput(),
      activeSagas: externalData.activeSagas ?? 0,
      uptimeMs: this.uptimeMs,
      timestamp: new Date().toISOString(),
    };
  }

  /** Reset all metrics. */
  reset(): void {
    this._metrics.clear();
    this._throughputWindow = [];
    this._startTime = Date.now();
  }

  // ── Private ───────────────────────────────────────────────

  private _makeKey(name: string, labels: Record<string, string>): string {
    const labelStr = Object.entries(labels)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join(',');
    return labelStr ? `${name}{${labelStr}}` : name;
  }

  private _getOrCreate(
    key: string,
    name: string,
    type: MetricType,
    labels: Record<string, string>,
  ): MetricEntry {
    let entry = this._metrics.get(key);
    if (!entry) {
      entry = {
        name,
        type,
        labels,
        values: [],
        lastValue: 0,
        count: 0,
        sum: 0,
        min: Infinity,
        max: -Infinity,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      this._metrics.set(key, entry);
    }
    return entry;
  }

  private _percentile(sortedValues: number[], percentile: number): number {
    if (sortedValues.length === 0) return 0;
    const idx = Math.ceil((percentile / 100) * sortedValues.length) - 1;
    return sortedValues[Math.max(0, idx)];
  }
}
