// ============================================================
// SOA One SOA — Complex Event Processing Engine
// ============================================================
//
// Temporal pattern detection engine for real-time event
// streams. Supports sliding/tumbling/count/session/global
// windows, pattern types including simple, sequence,
// threshold, absence, repetition, conjunction, disjunction,
// and trend detection. Computes aggregations (count, sum,
// avg, min, max, stddev, percentile) over matched event sets.
//
// Features beyond Oracle CEP / Event Processing:
// - Eight distinct pattern types with temporal ordering
// - Configurable window strategies (tumbling, sliding,
//   session, count, global)
// - Rich condition operators (equals, notEquals, greaterThan,
//   lessThan, contains, matches, in, exists)
// - Inline aggregation computation over matched events
// - Callback-driven architecture for pattern matches and
//   event processing notifications
// - Priority-ordered rule evaluation
//
// Zero external dependencies.
// ============================================================

import type {
  CEPEvent,
  CEPPattern,
  CEPPatternMatch,
  CEPRule,
  CEPAction,
  CEPCondition,
  CEPAggregation,
  WindowConfig,
  WindowType,
  CEPPatternType,
  CEPEventPriority,
} from './types';

import { generateId } from './registry';

// ── Callback Types ──────────────────────────────────────────

/** Callback invoked when a CEP pattern matches. */
export type PatternMatchCallback = (match: CEPPatternMatch) => void;

/** Callback invoked when a CEP event is processed. */
export type EventProcessedCallback = (event: CEPEvent) => void;

// ── CEP Engine ──────────────────────────────────────────────

/**
 * Complex Event Processing engine.
 *
 * Maintains a sliding buffer of recent events and evaluates
 * registered CEP rules against the buffer each time a new
 * event is ingested. When a rule's pattern is detected, a
 * {@link CEPPatternMatch} is produced and all registered
 * pattern-match callbacks are invoked.
 *
 * Usage:
 * ```ts
 * const cep = new CEPEngine();
 *
 * // Register a rule
 * cep.registerRule({
 *   id: 'high-error-rate',
 *   name: 'High Error Rate',
 *   pattern: {
 *     id: 'p1',
 *     name: 'Error Burst',
 *     type: 'threshold',
 *     eventTypes: ['error'],
 *     conditions: [],
 *     window: { type: 'sliding', sizeMs: 60000 },
 *     threshold: 10,
 *     enabled: true,
 *     metadata: {},
 *   },
 *   actions: [{ type: 'notify', config: { channel: 'ops' } }],
 *   priority: 10,
 *   enabled: true,
 * });
 *
 * // Subscribe to matches
 * cep.onPatternMatch((match) => {
 *   console.log('Pattern matched:', match.patternName);
 * });
 *
 * // Process events
 * const matches = cep.processEvent({
 *   id: 'e1',
 *   type: 'error',
 *   source: 'api-gateway',
 *   timestamp: new Date().toISOString(),
 *   data: { code: 500 },
 *   priority: 'high',
 *   correlationKeys: {},
 *   headers: {},
 * });
 * ```
 */
export class CEPEngine {
  /** Registered rules keyed by rule ID. */
  private _rules: Map<string, CEPRule> = new Map();

  /** Sliding window buffer of recent events. */
  private _eventBuffer: CEPEvent[] = [];

  /** Recent pattern matches. */
  private _matches: CEPPatternMatch[] = [];

  /** Maximum event buffer size. */
  private _maxBufferSize: number;

  /** Callbacks invoked on pattern match. */
  private _onPatternMatch: PatternMatchCallback[] = [];

  /** Callbacks invoked after an event is processed. */
  private _onEventProcessed: EventProcessedCallback[] = [];

  /** Total events processed since engine creation. */
  private _eventsProcessed: number = 0;

  /** Total patterns matched since engine creation. */
  private _patternsMatched: number = 0;

  /**
   * Create a new CEP engine.
   *
   * @param maxBufferSize - Maximum number of events retained
   *   in the sliding buffer. Defaults to `10000`.
   */
  constructor(maxBufferSize: number = 10000) {
    this._maxBufferSize = maxBufferSize;
  }

  // ── Rule Management ─────────────────────────────────────────

  /**
   * Register a CEP rule.
   *
   * If a rule with the same ID already exists it will be
   * overwritten.
   */
  registerRule(rule: CEPRule): void {
    this._rules.set(rule.id, rule);
  }

  /**
   * Remove a CEP rule by ID.
   *
   * @returns `true` if the rule was found and removed;
   *          `false` otherwise.
   */
  removeRule(ruleId: string): boolean {
    return this._rules.delete(ruleId);
  }

  /**
   * Retrieve a registered rule by ID.
   *
   * @returns The {@link CEPRule}, or `undefined` if not found.
   */
  getRule(ruleId: string): CEPRule | undefined {
    return this._rules.get(ruleId);
  }

  // ── Event Processing ────────────────────────────────────────

  /**
   * Process a single incoming event.
   *
   * 1. Appends the event to the internal buffer (trimming to
   *    `maxBufferSize` if necessary).
   * 2. Increments the events-processed counter.
   * 3. Fires all registered event-processed callbacks.
   * 4. Evaluates every enabled rule (sorted by descending
   *    priority) against the current buffer.
   * 5. For each matching pattern, creates a
   *    {@link CEPPatternMatch}, stores it, and fires all
   *    pattern-match callbacks.
   *
   * @returns An array of pattern matches produced by this event.
   */
  processEvent(event: CEPEvent): CEPPatternMatch[] {
    // 1. Add event to buffer
    this._eventBuffer.push(event);
    if (this._eventBuffer.length > this._maxBufferSize) {
      this._eventBuffer = this._eventBuffer.slice(
        this._eventBuffer.length - this._maxBufferSize,
      );
    }

    // 2. Increment counter
    this._eventsProcessed++;

    // 3. Fire event-processed callbacks
    for (const cb of this._onEventProcessed) {
      cb(event);
    }

    // 4. Evaluate all enabled rules (sorted by priority descending)
    const sortedRules = Array.from(this._rules.values())
      .filter((r) => r.enabled)
      .sort((a, b) => b.priority - a.priority);

    const matches: CEPPatternMatch[] = [];

    for (const rule of sortedRules) {
      if (!rule.pattern.enabled) continue;

      const match = this._evaluateRule(rule);
      if (match) {
        matches.push(match);
        this._matches.push(match);
        this._patternsMatched++;

        // 5. Fire pattern-match callbacks
        for (const cb of this._onPatternMatch) {
          cb(match);
        }
      }
    }

    return matches;
  }

  /**
   * Process multiple events in order.
   *
   * Each event is processed sequentially via
   * {@link processEvent}. The aggregated set of all pattern
   * matches across the batch is returned.
   *
   * @returns All pattern matches produced across the batch.
   */
  processBatch(events: CEPEvent[]): CEPPatternMatch[] {
    const allMatches: CEPPatternMatch[] = [];

    for (const event of events) {
      const matches = this.processEvent(event);
      allMatches.push(...matches);
    }

    return allMatches;
  }

  // ── Rule Evaluation (Private) ───────────────────────────────

  /**
   * Evaluate a single rule against the current event buffer.
   *
   * Dispatches to the appropriate pattern-type handler. If the
   * pattern matches, a {@link CEPPatternMatch} is returned;
   * otherwise `null`.
   */
  private _evaluateRule(rule: CEPRule): CEPPatternMatch | null {
    const pattern = rule.pattern;
    const windowEvents = this._getEventsInWindow(pattern.window);

    switch (pattern.type) {
      case 'simple':
        return this._evaluateSimple(rule, pattern, windowEvents);
      case 'sequence':
        return this._evaluateSequence(rule, pattern, windowEvents);
      case 'threshold':
        return this._evaluateThreshold(rule, pattern, windowEvents);
      case 'absence':
        return this._evaluateAbsence(rule, pattern, windowEvents);
      case 'repetition':
        return this._evaluateRepetition(rule, pattern, windowEvents);
      case 'conjunction':
        return this._evaluateConjunction(rule, pattern, windowEvents);
      case 'disjunction':
        return this._evaluateDisjunction(rule, pattern, windowEvents);
      case 'trend':
        return this._evaluateTrend(rule, pattern, windowEvents);
      default:
        return null;
    }
  }

  /**
   * Evaluate a **simple** pattern.
   *
   * Finds all events whose type is in `eventTypes` and that
   * satisfy every condition. Returns a match if at least one
   * qualifying event is found.
   */
  private _evaluateSimple(
    rule: CEPRule,
    pattern: CEPPattern,
    windowEvents: CEPEvent[],
  ): CEPPatternMatch | null {
    const matching = windowEvents.filter(
      (e) =>
        pattern.eventTypes.includes(e.type) &&
        this._matchesConditions(e, pattern.conditions),
    );

    if (matching.length === 0) return null;

    return this._buildMatch(rule, pattern, matching);
  }

  /**
   * Evaluate a **sequence** pattern.
   *
   * Searches for events that appear in the same order as
   * `eventTypes`, each satisfying the pattern conditions. The
   * ordering may be strict (consecutive timestamps) or relaxed
   * (other events may interleave).
   */
  private _evaluateSequence(
    rule: CEPRule,
    pattern: CEPPattern,
    windowEvents: CEPEvent[],
  ): CEPPatternMatch | null {
    if (pattern.eventTypes.length === 0) return null;

    // Sort window events by timestamp ascending for ordering
    const sorted = [...windowEvents].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
    );

    // Attempt to find events in order matching each eventType
    const matchedSequence: CEPEvent[] = [];
    let typeIdx = 0;

    for (const event of sorted) {
      if (typeIdx >= pattern.eventTypes.length) break;

      if (
        event.type === pattern.eventTypes[typeIdx] &&
        this._matchesConditions(event, pattern.conditions)
      ) {
        matchedSequence.push(event);
        typeIdx++;
      }
    }

    // All event types in the sequence must be found
    if (matchedSequence.length < pattern.eventTypes.length) return null;

    return this._buildMatch(rule, pattern, matchedSequence);
  }

  /**
   * Evaluate a **threshold** pattern.
   *
   * Counts events matching `eventTypes` and conditions within
   * the window. Returns a match when the count meets or exceeds
   * the pattern's `threshold` value.
   */
  private _evaluateThreshold(
    rule: CEPRule,
    pattern: CEPPattern,
    windowEvents: CEPEvent[],
  ): CEPPatternMatch | null {
    const matching = windowEvents.filter(
      (e) =>
        pattern.eventTypes.includes(e.type) &&
        this._matchesConditions(e, pattern.conditions),
    );

    const threshold = pattern.threshold ?? 1;

    if (matching.length < threshold) return null;

    return this._buildMatch(rule, pattern, matching);
  }

  /**
   * Evaluate an **absence** pattern.
   *
   * Returns a match when **no** events of the specified types
   * exist within the window (that also satisfy conditions). This
   * is useful for detecting missing heartbeats, late
   * acknowledgements, etc.
   */
  private _evaluateAbsence(
    rule: CEPRule,
    pattern: CEPPattern,
    windowEvents: CEPEvent[],
  ): CEPPatternMatch | null {
    const found = windowEvents.some(
      (e) =>
        pattern.eventTypes.includes(e.type) &&
        this._matchesConditions(e, pattern.conditions),
    );

    // Match only when the event type is absent
    if (found) return null;

    return this._buildMatch(rule, pattern, []);
  }

  /**
   * Evaluate a **repetition** pattern.
   *
   * Counts occurrences of events matching `eventTypes` and
   * conditions within the window. Returns a match if the count
   * falls within `[minOccurrences, maxOccurrences]`.
   */
  private _evaluateRepetition(
    rule: CEPRule,
    pattern: CEPPattern,
    windowEvents: CEPEvent[],
  ): CEPPatternMatch | null {
    const matching = windowEvents.filter(
      (e) =>
        pattern.eventTypes.includes(e.type) &&
        this._matchesConditions(e, pattern.conditions),
    );

    const count = matching.length;
    const min = pattern.minOccurrences ?? 1;
    const max = pattern.maxOccurrences ?? Infinity;

    if (count < min || count > max) return null;

    return this._buildMatch(rule, pattern, matching);
  }

  /**
   * Evaluate a **conjunction** pattern.
   *
   * Returns a match when **all** specified `eventTypes` are
   * present (with at least one qualifying event each) within
   * the window.
   */
  private _evaluateConjunction(
    rule: CEPRule,
    pattern: CEPPattern,
    windowEvents: CEPEvent[],
  ): CEPPatternMatch | null {
    const matchedEvents: CEPEvent[] = [];

    for (const eventType of pattern.eventTypes) {
      const found = windowEvents.find(
        (e) =>
          e.type === eventType &&
          this._matchesConditions(e, pattern.conditions),
      );

      if (!found) return null;

      matchedEvents.push(found);
    }

    return this._buildMatch(rule, pattern, matchedEvents);
  }

  /**
   * Evaluate a **disjunction** pattern.
   *
   * Returns a match when **any** of the specified `eventTypes`
   * is present (with at least one qualifying event) within the
   * window.
   */
  private _evaluateDisjunction(
    rule: CEPRule,
    pattern: CEPPattern,
    windowEvents: CEPEvent[],
  ): CEPPatternMatch | null {
    const matchedEvents: CEPEvent[] = [];

    for (const eventType of pattern.eventTypes) {
      const found = windowEvents.filter(
        (e) =>
          e.type === eventType &&
          this._matchesConditions(e, pattern.conditions),
      );

      matchedEvents.push(...found);
    }

    if (matchedEvents.length === 0) return null;

    return this._buildMatch(rule, pattern, matchedEvents);
  }

  /**
   * Evaluate a **trend** pattern.
   *
   * Detects an increasing, decreasing, or stable trend in a
   * specific field across events within the window. The field
   * is determined by the first condition's `field` property.
   *
   * A trend is confirmed when at least two consecutive data
   * points satisfy the specified direction.
   */
  private _evaluateTrend(
    rule: CEPRule,
    pattern: CEPPattern,
    windowEvents: CEPEvent[],
  ): CEPPatternMatch | null {
    if (!pattern.trendDirection) return null;

    // Filter to relevant event types
    const relevant = windowEvents.filter(
      (e) => pattern.eventTypes.includes(e.type),
    );

    if (relevant.length < 2) return null;

    // Sort by timestamp ascending
    const sorted = [...relevant].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
    );

    // Determine the trend field from the first condition, or
    // fall back to `aggregations[0].field`, or 'value'
    const trendField =
      (pattern.conditions.length > 0 ? pattern.conditions[0].field : undefined) ??
      (pattern.aggregations && pattern.aggregations.length > 0
        ? pattern.aggregations[0].field
        : undefined) ??
      'value';

    // Extract numeric values for the field
    const values: { event: CEPEvent; value: number }[] = [];
    for (const event of sorted) {
      const v = this._resolveField(event, trendField);
      if (typeof v === 'number') {
        values.push({ event, value: v });
      }
    }

    if (values.length < 2) return null;

    // Check if trend matches the specified direction
    let trendMatches = true;

    for (let i = 1; i < values.length; i++) {
      const diff = values[i].value - values[i - 1].value;

      switch (pattern.trendDirection) {
        case 'increasing':
          if (diff <= 0) {
            trendMatches = false;
          }
          break;
        case 'decreasing':
          if (diff >= 0) {
            trendMatches = false;
          }
          break;
        case 'stable':
          if (diff !== 0) {
            trendMatches = false;
          }
          break;
      }

      if (!trendMatches) break;
    }

    if (!trendMatches) return null;

    return this._buildMatch(
      rule,
      pattern,
      values.map((v) => v.event),
    );
  }

  // ── Condition Matching ──────────────────────────────────────

  /**
   * Check whether an event satisfies **all** of the given
   * conditions.
   *
   * Each condition specifies a `field` path (resolved against
   * the event's `data`, or top-level properties), an
   * `operator`, and a comparison `value`.
   *
   * Supported operators:
   * - `equals`      — strict equality (`===`)
   * - `notEquals`   — strict inequality (`!==`)
   * - `greaterThan` — numeric `>`
   * - `lessThan`    — numeric `<`
   * - `contains`    — substring or array inclusion
   * - `matches`     — regular expression test
   * - `in`          — value is a member of the condition array
   * - `exists`      — field is not `undefined` or `null`
   */
  private _matchesConditions(
    event: CEPEvent,
    conditions: CEPCondition[],
  ): boolean {
    for (const condition of conditions) {
      const fieldValue = this._resolveField(event, condition.field);

      switch (condition.operator) {
        case 'equals':
          if (fieldValue !== condition.value) return false;
          break;

        case 'notEquals':
          if (fieldValue === condition.value) return false;
          break;

        case 'greaterThan':
          if (
            typeof fieldValue !== 'number' ||
            fieldValue <= (condition.value as number)
          ) {
            return false;
          }
          break;

        case 'lessThan':
          if (
            typeof fieldValue !== 'number' ||
            fieldValue >= (condition.value as number)
          ) {
            return false;
          }
          break;

        case 'contains':
          if (typeof fieldValue === 'string') {
            if (!fieldValue.includes(String(condition.value))) return false;
          } else if (Array.isArray(fieldValue)) {
            if (!fieldValue.includes(condition.value)) return false;
          } else {
            return false;
          }
          break;

        case 'matches':
          if (typeof fieldValue !== 'string') return false;
          try {
            const regex = new RegExp(String(condition.value));
            if (!regex.test(fieldValue)) return false;
          } catch {
            return false;
          }
          break;

        case 'in':
          if (!Array.isArray(condition.value)) return false;
          if (!(condition.value as any[]).includes(fieldValue)) return false;
          break;

        case 'exists':
          if (fieldValue === undefined || fieldValue === null) {
            // condition.value can be `true` (field must exist) or
            // `false` (field must NOT exist)
            if (condition.value !== false) return false;
          } else {
            if (condition.value === false) return false;
          }
          break;

        default:
          // Unknown operator — treat as non-matching
          return false;
      }
    }

    return true;
  }

  // ── Window Management ───────────────────────────────────────

  /**
   * Retrieve events from the buffer that fall within the
   * specified window configuration.
   *
   * Window types:
   * - **sliding / tumbling** — events within `sizeMs`
   *   milliseconds of the current time.
   * - **count** — the most recent `count` events.
   * - **session** — events within `sessionGapMs` of the latest
   *   event (backwards from most recent).
   * - **global** — all events in the buffer.
   */
  private _getEventsInWindow(window: WindowConfig): CEPEvent[] {
    const buffer = this._eventBuffer;
    if (buffer.length === 0) return [];

    switch (window.type) {
      case 'sliding':
      case 'tumbling': {
        if (!window.sizeMs) return [...buffer];

        const now = Date.now();
        const cutoff = now - window.sizeMs;

        return buffer.filter(
          (e) => new Date(e.timestamp).getTime() >= cutoff,
        );
      }

      case 'count': {
        const count = window.count ?? buffer.length;
        return buffer.slice(-count);
      }

      case 'session': {
        if (buffer.length === 0) return [];
        if (!window.sessionGapMs) return [...buffer];

        // Walk backwards from the latest event, collecting events
        // that are within sessionGapMs of their successor.
        const sorted = [...buffer].sort(
          (a, b) =>
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
        );

        const sessionEvents: CEPEvent[] = [sorted[0]];
        let lastTs = new Date(sorted[0].timestamp).getTime();

        for (let i = 1; i < sorted.length; i++) {
          const ts = new Date(sorted[i].timestamp).getTime();
          if (lastTs - ts <= window.sessionGapMs) {
            sessionEvents.push(sorted[i]);
            lastTs = ts;
          } else {
            break;
          }
        }

        // Return in chronological order
        return sessionEvents.reverse();
      }

      case 'global':
      default:
        return [...buffer];
    }
  }

  // ── Aggregations ────────────────────────────────────────────

  /**
   * Compute aggregation values over a set of events.
   *
   * Supported aggregation types:
   * - **count**      — number of events
   * - **sum**        — sum of the field's numeric values
   * - **avg**        — arithmetic mean
   * - **min**        — minimum value
   * - **max**        — maximum value
   * - **stddev**     — population standard deviation
   * - **percentile** — the Nth percentile (using nearest-rank)
   *
   * @returns A map of alias to computed value.
   */
  private _computeAggregations(
    events: CEPEvent[],
    aggregations: CEPAggregation[],
  ): Record<string, number> {
    const result: Record<string, number> = {};

    for (const agg of aggregations) {
      switch (agg.type) {
        case 'count': {
          result[agg.alias] = events.length;
          break;
        }

        case 'sum': {
          const values = this._extractNumericValues(events, agg.field);
          result[agg.alias] = values.reduce((acc, v) => acc + v, 0);
          break;
        }

        case 'avg': {
          const values = this._extractNumericValues(events, agg.field);
          result[agg.alias] =
            values.length > 0
              ? values.reduce((acc, v) => acc + v, 0) / values.length
              : 0;
          break;
        }

        case 'min': {
          const values = this._extractNumericValues(events, agg.field);
          result[agg.alias] =
            values.length > 0 ? Math.min(...values) : 0;
          break;
        }

        case 'max': {
          const values = this._extractNumericValues(events, agg.field);
          result[agg.alias] =
            values.length > 0 ? Math.max(...values) : 0;
          break;
        }

        case 'stddev': {
          const values = this._extractNumericValues(events, agg.field);
          if (values.length === 0) {
            result[agg.alias] = 0;
          } else {
            const mean =
              values.reduce((acc, v) => acc + v, 0) / values.length;
            const squaredDiffs = values.map((v) => (v - mean) ** 2);
            const variance =
              squaredDiffs.reduce((acc, v) => acc + v, 0) / values.length;
            result[agg.alias] = Math.sqrt(variance);
          }
          break;
        }

        case 'percentile': {
          const values = this._extractNumericValues(events, agg.field);
          const p = agg.percentile ?? 50;

          if (values.length === 0) {
            result[agg.alias] = 0;
          } else {
            const sorted = [...values].sort((a, b) => a - b);
            // Nearest-rank method
            const rank = Math.ceil((p / 100) * sorted.length);
            const idx = Math.max(0, Math.min(rank - 1, sorted.length - 1));
            result[agg.alias] = sorted[idx];
          }
          break;
        }

        default:
          result[agg.alias] = 0;
          break;
      }
    }

    return result;
  }

  // ── Query / Accessors ───────────────────────────────────────

  /**
   * Retrieve recent pattern matches.
   *
   * @param limit - Maximum number of matches to return. When
   *   omitted, all stored matches are returned.
   * @returns An array of the most recent matches (newest first).
   */
  getRecentMatches(limit?: number): CEPPatternMatch[] {
    const reversed = [...this._matches].reverse();
    if (limit !== undefined && limit >= 0) {
      return reversed.slice(0, limit);
    }
    return reversed;
  }

  /**
   * Clear the event buffer.
   *
   * This does **not** remove registered rules or reset counters.
   */
  clearBuffer(): void {
    this._eventBuffer = [];
  }

  // ── Callback Registration ───────────────────────────────────

  /**
   * Register a callback invoked each time a pattern matches.
   *
   * @returns An unsubscribe function.
   */
  onPatternMatch(callback: PatternMatchCallback): () => void {
    this._onPatternMatch.push(callback);

    return () => {
      const idx = this._onPatternMatch.indexOf(callback);
      if (idx >= 0) {
        this._onPatternMatch.splice(idx, 1);
      }
    };
  }

  /**
   * Register a callback invoked each time an event is processed.
   *
   * @returns An unsubscribe function.
   */
  onEventProcessed(callback: EventProcessedCallback): () => void {
    this._onEventProcessed.push(callback);

    return () => {
      const idx = this._onEventProcessed.indexOf(callback);
      if (idx >= 0) {
        this._onEventProcessed.splice(idx, 1);
      }
    };
  }

  // ── Getters ─────────────────────────────────────────────────

  /** All registered CEP rules. */
  get allRules(): CEPRule[] {
    return Array.from(this._rules.values());
  }

  /** Total number of registered rules. */
  get ruleCount(): number {
    return this._rules.size;
  }

  /** Number of enabled rules. */
  get enabledRuleCount(): number {
    let n = 0;
    for (const rule of this._rules.values()) {
      if (rule.enabled) n++;
    }
    return n;
  }

  /** Total events processed since engine creation. */
  get eventsProcessed(): number {
    return this._eventsProcessed;
  }

  /** Total patterns matched since engine creation. */
  get patternsMatched(): number {
    return this._patternsMatched;
  }

  /** Current number of events in the buffer. */
  get bufferSize(): number {
    return this._eventBuffer.length;
  }

  // ── Private Helpers ─────────────────────────────────────────

  /**
   * Build a {@link CEPPatternMatch} from a rule, pattern, and
   * the set of matched events. Computes aggregations if the
   * pattern defines any.
   */
  private _buildMatch(
    rule: CEPRule,
    pattern: CEPPattern,
    matchedEvents: CEPEvent[],
  ): CEPPatternMatch {
    const aggregationValues =
      pattern.aggregations && pattern.aggregations.length > 0
        ? this._computeAggregations(matchedEvents, pattern.aggregations)
        : {};

    // Compute group key if groupBy is defined
    let groupKey: string | undefined;
    if (pattern.groupBy && pattern.groupBy.length > 0 && matchedEvents.length > 0) {
      const firstEvent = matchedEvents[0];
      const keyParts: string[] = [];
      for (const field of pattern.groupBy) {
        const val = this._resolveField(firstEvent, field);
        keyParts.push(String(val ?? ''));
      }
      groupKey = keyParts.join(':');
    }

    const match: CEPPatternMatch = {
      id: generateId(),
      patternId: pattern.id,
      patternName: pattern.name,
      matchedEvents,
      aggregationValues,
      matchedAt: new Date().toISOString(),
      groupKey,
      metadata: { ruleId: rule.id, ruleName: rule.name },
    };

    return match;
  }

  /**
   * Resolve a dot-separated field path against a CEP event.
   *
   * First checks top-level event properties (`type`, `source`,
   * `priority`, etc.), then traverses the `data` object.
   *
   * @example
   * ```ts
   * _resolveField(event, 'type')         // => event.type
   * _resolveField(event, 'data.amount')  // => event.data.amount
   * _resolveField(event, 'amount')       // => event.data.amount (fallback)
   * ```
   */
  private _resolveField(event: CEPEvent, field: string): any {
    // Direct top-level access
    if (field in event) {
      return (event as any)[field];
    }

    // Check if field starts with 'data.' — explicit data path
    if (field.startsWith('data.')) {
      return this._getNestedValue(event.data, field.substring(5));
    }

    // Check correlationKeys
    if (field.startsWith('correlationKeys.')) {
      return this._getNestedValue(
        event.correlationKeys,
        field.substring(16),
      );
    }

    // Check headers
    if (field.startsWith('headers.')) {
      return this._getNestedValue(event.headers, field.substring(8));
    }

    // Fallback: treat field as a path into event.data
    return this._getNestedValue(event.data, field);
  }

  /**
   * Walk a dot-separated path through a nested object.
   *
   * @returns The value at the path, or `undefined` if any
   *          segment is missing.
   */
  private _getNestedValue(obj: Record<string, any>, path: string): any {
    const segments = path.split('.');
    let current: any = obj;

    for (const segment of segments) {
      if (current === null || current === undefined) return undefined;
      if (typeof current !== 'object') return undefined;
      current = current[segment];
    }

    return current;
  }

  /**
   * Extract numeric values for a given field from a list of
   * events.
   *
   * Events where the field is missing or non-numeric are
   * skipped.
   */
  private _extractNumericValues(
    events: CEPEvent[],
    field?: string,
  ): number[] {
    if (!field) return [];

    const values: number[] = [];
    for (const event of events) {
      const v = this._resolveField(event, field);
      if (typeof v === 'number' && !Number.isNaN(v)) {
        values.push(v);
      }
    }
    return values;
  }
}
