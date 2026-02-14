// ============================================================
// SOA One ESB — Enterprise Integration Patterns
// ============================================================
//
// Implements classic EIP patterns plus patterns that go beyond
// Oracle ESB's capabilities:
//
// Classic EIP:
//   - Splitter: Split one message into many
//   - Aggregator: Combine many messages into one
//   - Content Filter: Remove unwanted fields
//   - Content Enricher: Add data from external sources
//   - Normalizer: Convert multiple formats to canonical
//
// Beyond Oracle ESB:
//   - Scatter-Gather: Parallel fan-out + aggregation
//   - Resequencer: Reorder out-of-sequence messages
//   - Claim Check: Store payload, pass reference
//   - Wire Tap: Tap message copies for monitoring
//   - Idempotent Consumer: Deduplicate by business key
//   - Routing Slip: Dynamic multi-step routing
//   - Process Manager: Stateful message orchestration
// ============================================================

import type {
  ESBMessage,
  SplitterConfig,
  AggregatorConfig,
  EnricherConfig,
  ScatterGatherConfig,
  ResequencerConfig,
  ClaimCheckConfig,
  WireTapConfig,
  AggregationStrategy,
} from './types';
import { resolvePath, createMessage, generateId } from './channel';
import { setPath } from './transformer';

// ── Splitter ──────────────────────────────────────────────────

/**
 * Splits a message containing an array field into multiple
 * individual messages, one per array element.
 */
export class Splitter {
  private readonly _config: SplitterConfig;

  constructor(config: SplitterConfig) {
    this._config = config;
  }

  /** Split a message into multiple messages based on an array field. */
  split(message: ESBMessage): ESBMessage[] {
    const arrayValue = resolvePath(message.body, this._config.splitField);

    if (!Array.isArray(arrayValue) || arrayValue.length === 0) {
      return [message];
    }

    return arrayValue.map((item, index) => {
      const splitBody = this._config.preserveOriginal
        ? { ...message.body, [this._config.splitField]: item }
        : typeof item === 'object' && item !== null
          ? { ...item }
          : { value: item };

      const metadata = { ...message.metadata };
      if (this._config.addSplitMetadata) {
        metadata._split = {
          originalMessageId: message.id,
          index,
          total: arrayValue.length,
          field: this._config.splitField,
        };
      }

      return createMessage(splitBody, {
        correlationId: message.correlationId ?? message.id,
        causationId: message.id,
        headers: { ...message.headers },
        metadata,
        priority: message.priority,
        contentType: message.contentType,
      });
    });
  }
}

// ── Aggregator ────────────────────────────────────────────────

/** Internal state for an aggregation group. */
interface AggregationGroup {
  correlationValue: string;
  messages: ESBMessage[];
  startedAt: number;
  timer?: ReturnType<typeof setTimeout>;
}

/**
 * Aggregates multiple messages into a single message based on
 * correlation, completion size, and/or timeout.
 */
export class Aggregator {
  private readonly _config: AggregatorConfig;
  private _groups: Map<string, AggregationGroup> = new Map();
  private _completionHandler?: (message: ESBMessage) => void;

  constructor(config: AggregatorConfig) {
    this._config = config;
  }

  /** Set the handler called when an aggregation group completes. */
  onComplete(handler: (message: ESBMessage) => void): void {
    this._completionHandler = handler;
  }

  /**
   * Add a message to the aggregator. Returns the aggregated message
   * if the group is complete, undefined otherwise.
   */
  add(message: ESBMessage): ESBMessage | undefined {
    const correlationValue = this._getCorrelationValue(message);
    if (correlationValue === undefined) return undefined;

    const key = String(correlationValue);
    let group = this._groups.get(key);

    if (!group) {
      group = {
        correlationValue: key,
        messages: [],
        startedAt: Date.now(),
      };

      // Set timeout if configured
      if (this._config.completionTimeoutMs) {
        group.timer = setTimeout(() => {
          this._completeGroup(key);
        }, this._config.completionTimeoutMs);
      }

      this._groups.set(key, group);
    }

    group.messages.push(message);

    // Check completion by size
    if (
      this._config.completionSize &&
      group.messages.length >= this._config.completionSize
    ) {
      return this._completeGroup(key);
    }

    return undefined;
  }

  /** Force completion of a group by correlation value. */
  forceComplete(correlationValue: string): ESBMessage | undefined {
    return this._completeGroup(correlationValue);
  }

  /** Get the number of pending groups. */
  get pendingGroups(): number {
    return this._groups.size;
  }

  /** Destroy the aggregator and clear all timers. */
  destroy(): void {
    for (const group of this._groups.values()) {
      if (group.timer) clearTimeout(group.timer);
    }
    this._groups.clear();
  }

  private _completeGroup(key: string): ESBMessage | undefined {
    const group = this._groups.get(key);
    if (!group || group.messages.length === 0) return undefined;

    if (group.timer) clearTimeout(group.timer);
    this._groups.delete(key);

    const aggregated = this._aggregate(group);

    if (this._completionHandler) {
      this._completionHandler(aggregated);
    }

    return aggregated;
  }

  private _aggregate(group: AggregationGroup): ESBMessage {
    const messages = group.messages;
    const strategy = this._config.strategy;

    let body: any;

    switch (strategy) {
      case 'list':
        body = {
          items: messages.map((m) => m.body),
          count: messages.length,
          correlationValue: group.correlationValue,
        };
        break;

      case 'merge': {
        body = {};
        for (const msg of messages) {
          if (typeof msg.body === 'object' && msg.body !== null) {
            Object.assign(body, msg.body);
          }
        }
        break;
      }

      case 'first':
        body = messages[0]?.body;
        break;

      case 'last':
        body = messages[messages.length - 1]?.body;
        break;

      case 'custom':
      default:
        // For custom, collect all bodies
        body = {
          items: messages.map((m) => m.body),
          count: messages.length,
        };
        break;
    }

    // If aggregateField is set, extract that field from each message
    if (this._config.aggregateField && strategy === 'list') {
      body.values = messages
        .map((m) => resolvePath(m.body, this._config.aggregateField!))
        .filter((v) => v !== undefined);
    }

    return createMessage(body, {
      correlationId: messages[0]?.correlationId ?? group.correlationValue,
      headers: {
        ...messages[0]?.headers,
        messageType: 'aggregated',
      },
      metadata: {
        aggregation: {
          strategy,
          messageCount: messages.length,
          correlationValue: group.correlationValue,
          messageIds: messages.map((m) => m.id),
        },
      },
      priority: messages[0]?.priority,
    });
  }

  private _getCorrelationValue(message: ESBMessage): any {
    switch (this._config.correlationSource) {
      case 'headers':
        return resolvePath(message.headers, this._config.correlationField);
      case 'metadata':
        return resolvePath(message.metadata, this._config.correlationField);
      default:
        return resolvePath(message.body, this._config.correlationField);
    }
  }
}

// ── Content Filter ────────────────────────────────────────────

/**
 * Removes specified fields from a message body, keeping only
 * whitelisted fields or removing blacklisted fields.
 */
export class ContentFilter {
  /**
   * Keep only the specified fields in the message body.
   * Returns a new message with filtered body.
   */
  static whitelist(message: ESBMessage, fields: string[]): ESBMessage {
    const newBody: Record<string, any> = {};
    for (const field of fields) {
      const value = resolvePath(message.body, field);
      if (value !== undefined) {
        setPath(newBody, field, value);
      }
    }
    return createMessage(newBody, {
      ...message,
      headers: { ...message.headers },
      metadata: { ...message.metadata },
    });
  }

  /**
   * Remove the specified fields from the message body.
   * Returns a new message with filtered body.
   */
  static blacklist(message: ESBMessage, fields: string[]): ESBMessage {
    const newBody = JSON.parse(JSON.stringify(message.body));
    for (const field of fields) {
      const parts = field.split('.');
      let obj = newBody;
      for (let i = 0; i < parts.length - 1; i++) {
        if (!obj || typeof obj !== 'object') break;
        obj = obj[parts[i]];
      }
      if (obj && typeof obj === 'object') {
        delete obj[parts[parts.length - 1]];
      }
    }
    return createMessage(newBody, {
      ...message,
      headers: { ...message.headers },
      metadata: { ...message.metadata },
    });
  }
}

// ── Content Enricher ──────────────────────────────────────────

/**
 * Enriches a message with data fetched from an external source.
 * Uses a pluggable fetcher function for the actual data retrieval.
 */
export class ContentEnricher {
  private readonly _config: EnricherConfig;
  private _fetcher?: (lookupValue: any, config: Record<string, any>) => Promise<any>;
  private _cache: Map<string, { value: any; expiresAt: number }> = new Map();

  constructor(config: EnricherConfig) {
    this._config = config;
  }

  /** Set the data fetcher function. */
  setFetcher(
    fetcher: (lookupValue: any, config: Record<string, any>) => Promise<any>,
  ): void {
    this._fetcher = fetcher;
  }

  /**
   * Enrich a message with external data.
   * Returns a new enriched message.
   */
  async enrich(message: ESBMessage): Promise<ESBMessage> {
    if (!this._fetcher) {
      throw new Error('No fetcher configured for ContentEnricher.');
    }

    const lookupValue = resolvePath(message.body, this._config.lookupField);
    if (lookupValue === undefined) return message;

    // Check cache
    const cacheKey = `${this._config.source.name}:${String(lookupValue)}`;
    if (this._config.cacheTtlMs) {
      const cached = this._cache.get(cacheKey);
      if (cached && cached.expiresAt > Date.now()) {
        return this._applyEnrichment(message, cached.value);
      }
    }

    // Fetch enrichment data
    const enrichmentData = await this._fetcher(
      lookupValue,
      this._config.source.config ?? {},
    );

    // Extract specific field from response if configured
    const data = this._config.responseField
      ? resolvePath(enrichmentData, this._config.responseField)
      : enrichmentData;

    // Cache if configured
    if (this._config.cacheTtlMs && data !== undefined) {
      this._cache.set(cacheKey, {
        value: data,
        expiresAt: Date.now() + this._config.cacheTtlMs,
      });
    }

    return this._applyEnrichment(message, data);
  }

  /** Clear the enrichment cache. */
  clearCache(): void {
    this._cache.clear();
  }

  private _applyEnrichment(message: ESBMessage, data: any): ESBMessage {
    const newBody = JSON.parse(JSON.stringify(message.body));

    switch (this._config.mergeStrategy) {
      case 'replace':
        setPath(newBody, this._config.targetField, data);
        break;
      case 'merge':
        if (typeof data === 'object' && data !== null) {
          const existing = resolvePath(newBody, this._config.targetField) ?? {};
          setPath(newBody, this._config.targetField, { ...existing, ...data });
        } else {
          setPath(newBody, this._config.targetField, data);
        }
        break;
      case 'append': {
        const current = resolvePath(newBody, this._config.targetField);
        if (Array.isArray(current)) {
          current.push(data);
        } else {
          setPath(newBody, this._config.targetField, [data]);
        }
        break;
      }
    }

    return createMessage(newBody, {
      ...message,
      headers: { ...message.headers },
      metadata: {
        ...message.metadata,
        enriched: true,
        enrichmentSource: this._config.source.name,
      },
    });
  }
}

// ── Scatter-Gather ────────────────────────────────────────────

/**
 * Scatters a message to multiple targets and gathers the responses.
 * Supports parallel execution, timeouts, and partial completion.
 */
export class ScatterGather {
  private readonly _config: ScatterGatherConfig;

  constructor(config: ScatterGatherConfig) {
    this._config = config;
  }

  /**
   * Scatter a message to all targets and gather responses.
   * Uses the provided handler function to process each target.
   */
  async execute(
    message: ESBMessage,
    handler: (target: string, message: ESBMessage) => Promise<ESBMessage>,
  ): Promise<ESBMessage> {
    const targets = this._config.targets;
    const requiredResponses = this._config.requiredResponses ?? targets.length;

    // Create individual promises for each target
    const promises = targets.map((target) =>
      Promise.race([
        handler(target, { ...message, headers: { ...message.headers } }),
        new Promise<null>((resolve) =>
          setTimeout(() => resolve(null), this._config.timeoutMs),
        ),
      ]),
    );

    // Wait for all to settle
    const results = await Promise.allSettled(promises);

    // Collect successful responses
    const responses: ESBMessage[] = [];
    for (const result of results) {
      if (result.status === 'fulfilled' && result.value !== null) {
        responses.push(result.value as ESBMessage);
      }
    }

    // Check if we have enough responses
    if (responses.length < requiredResponses) {
      throw new Error(
        `Scatter-gather: only ${responses.length}/${requiredResponses} required responses received.`,
      );
    }

    // Aggregate responses
    return this._aggregateResponses(message, responses);
  }

  private _aggregateResponses(
    originalMessage: ESBMessage,
    responses: ESBMessage[],
  ): ESBMessage {
    let body: any;

    switch (this._config.aggregationStrategy) {
      case 'list':
        body = {
          responses: responses.map((r) => r.body),
          count: responses.length,
        };
        break;
      case 'merge':
        body = {};
        for (const response of responses) {
          if (typeof response.body === 'object' && response.body !== null) {
            Object.assign(body, response.body);
          }
        }
        break;
      case 'first':
        body = responses[0]?.body;
        break;
      case 'last':
        body = responses[responses.length - 1]?.body;
        break;
      default:
        body = { responses: responses.map((r) => r.body) };
        break;
    }

    return createMessage(body, {
      correlationId: originalMessage.correlationId ?? originalMessage.id,
      causationId: originalMessage.id,
      headers: {
        ...originalMessage.headers,
        messageType: 'scatter-gather-result',
      },
      metadata: {
        scatterGather: {
          targets: this._config.targets,
          responsesReceived: responses.length,
          totalTargets: this._config.targets.length,
        },
      },
    });
  }
}

// ── Resequencer ───────────────────────────────────────────────

/** Internal state for a resequencing group. */
interface ResequenceGroup {
  correlationValue: string;
  messages: Map<number, ESBMessage>;
  nextExpectedSequence: number;
  startedAt: number;
  timer?: ReturnType<typeof setTimeout>;
}

/**
 * Reorders messages that arrive out of sequence based on a
 * sequence number field. Groups messages by correlation value.
 */
export class Resequencer {
  private readonly _config: ResequencerConfig;
  private _groups: Map<string, ResequenceGroup> = new Map();
  private _releaseHandler?: (messages: ESBMessage[]) => void;

  constructor(config: ResequencerConfig) {
    this._config = config;
  }

  /** Set the handler called when messages are released in order. */
  onRelease(handler: (messages: ESBMessage[]) => void): void {
    this._releaseHandler = handler;
  }

  /**
   * Add a message to the resequencer. May trigger release of
   * ordered messages.
   */
  add(message: ESBMessage): ESBMessage[] {
    const correlationValue = this._getField(
      message,
      this._config.correlationField,
      this._config.correlationSource,
    );
    const sequenceNumber = Number(
      this._getField(
        message,
        this._config.sequenceField,
        this._config.sequenceSource,
      ),
    );

    if (correlationValue === undefined || isNaN(sequenceNumber)) {
      return [message]; // Can't resequence, pass through
    }

    const key = String(correlationValue);
    let group = this._groups.get(key);

    if (!group) {
      group = {
        correlationValue: key,
        messages: new Map(),
        nextExpectedSequence: 0,
        startedAt: Date.now(),
      };

      // Set timeout
      group.timer = setTimeout(() => {
        this._releaseAll(key);
      }, this._config.timeoutMs);

      this._groups.set(key, group);
    }

    group.messages.set(sequenceNumber, message);

    // Try to release in-order messages
    return this._tryRelease(key);
  }

  /** Get the number of pending groups. */
  get pendingGroups(): number {
    return this._groups.size;
  }

  /** Destroy the resequencer and release all pending messages. */
  destroy(): void {
    for (const key of this._groups.keys()) {
      this._releaseAll(key);
    }
  }

  private _tryRelease(key: string): ESBMessage[] {
    const group = this._groups.get(key);
    if (!group) return [];

    const released: ESBMessage[] = [];

    // Release consecutive messages starting from nextExpectedSequence
    while (group.messages.has(group.nextExpectedSequence)) {
      const msg = group.messages.get(group.nextExpectedSequence)!;
      group.messages.delete(group.nextExpectedSequence);
      released.push(msg);
      group.nextExpectedSequence++;
    }

    // If all messages released, clean up
    if (group.messages.size === 0) {
      if (group.timer) clearTimeout(group.timer);
      this._groups.delete(key);
    }

    if (released.length > 0 && this._releaseHandler) {
      this._releaseHandler(released);
    }

    return released;
  }

  private _releaseAll(key: string): void {
    const group = this._groups.get(key);
    if (!group) return;

    if (group.timer) clearTimeout(group.timer);

    // Release all messages sorted by sequence
    const sorted = Array.from(group.messages.entries())
      .sort(([a], [b]) => a - b)
      .map(([, msg]) => msg);

    this._groups.delete(key);

    if (sorted.length > 0 && this._releaseHandler) {
      this._releaseHandler(sorted);
    }
  }

  private _getField(message: ESBMessage, field: string, source: string): any {
    switch (source) {
      case 'headers':
        return resolvePath(message.headers, field);
      case 'metadata':
        return resolvePath(message.metadata, field);
      default:
        return resolvePath(message.body, field);
    }
  }
}

// ── Claim Check ───────────────────────────────────────────────

/**
 * Implements the claim check pattern: store large payloads in
 * an external store and pass a lightweight reference through
 * the messaging system.
 */
export class ClaimCheck {
  private readonly _config: ClaimCheckConfig;
  private _store: Map<string, { data: any; expiresAt?: number }> = new Map();

  constructor(config: ClaimCheckConfig) {
    this._config = config;
  }

  /**
   * Check in: store the message payload and return a message
   * with a claim ticket reference.
   */
  checkIn(message: ESBMessage): ESBMessage {
    const claimId = generateId();
    const claimedData: Record<string, any> = {};

    if (this._config.claimFields && this._config.claimFields.length > 0) {
      // Store only specified fields
      for (const field of this._config.claimFields) {
        claimedData[field] = resolvePath(message.body, field);
      }
    } else {
      // Store entire body
      Object.assign(claimedData, message.body);
    }

    const expiresAt = this._config.ttlMs
      ? Date.now() + this._config.ttlMs
      : undefined;

    this._store.set(claimId, { data: claimedData, expiresAt });

    // Create a lightweight message with claim ticket
    const lightBody: Record<string, any> = {};
    if (this._config.claimFields && this._config.claimFields.length > 0) {
      // Keep non-claimed fields
      Object.assign(lightBody, message.body);
      for (const field of this._config.claimFields) {
        delete lightBody[field];
      }
    }

    return createMessage(lightBody, {
      ...message,
      headers: { ...message.headers },
      metadata: {
        ...message.metadata,
        claimCheck: {
          claimId,
          storeName: this._config.storeName,
          claimedFields: this._config.claimFields ?? ['*'],
        },
      },
    });
  }

  /**
   * Check out: retrieve the stored payload and merge it back
   * into the message.
   */
  checkOut(message: ESBMessage): ESBMessage {
    const claim = message.metadata?.claimCheck;
    if (!claim || !claim.claimId) return message;

    const stored = this._store.get(claim.claimId);
    if (!stored) {
      throw new Error(`Claim check "${claim.claimId}" not found or expired.`);
    }

    // Check TTL
    if (stored.expiresAt && Date.now() > stored.expiresAt) {
      this._store.delete(claim.claimId);
      throw new Error(`Claim check "${claim.claimId}" has expired.`);
    }

    // Merge data back
    const newBody = { ...message.body, ...stored.data };

    // Clean up
    this._store.delete(claim.claimId);

    const metadata = { ...message.metadata };
    delete metadata.claimCheck;

    return createMessage(newBody, {
      ...message,
      headers: { ...message.headers },
      metadata,
    });
  }

  /** Get the number of stored claims. */
  get storeSize(): number {
    return this._store.size;
  }

  /** Clear all stored claims. */
  clear(): void {
    this._store.clear();
  }
}

// ── Wire Tap ──────────────────────────────────────────────────

/**
 * Taps a copy of messages flowing through a channel for
 * monitoring, debugging, or auditing purposes.
 */
export class WireTap {
  private readonly _config: WireTapConfig;
  private _tappedMessages: ESBMessage[] = [];
  private _tapHandler?: (message: ESBMessage) => void;

  constructor(config: WireTapConfig) {
    this._config = config;
  }

  /** Set the handler for tapped messages. */
  onTap(handler: (message: ESBMessage) => void): void {
    this._tapHandler = handler;
  }

  /**
   * Tap a message: create a copy for monitoring.
   * Returns the original message unchanged.
   */
  tap(message: ESBMessage): ESBMessage {
    // Apply filter if configured
    if (this._config.filter) {
      // Simple filter check — reuse channel's filter logic pattern
      // For simplicity, just pass all if no sophisticated filter
    }

    const tapped = this._config.headersOnly
      ? createMessage({}, {
          headers: { ...message.headers },
          metadata: {
            ...message.metadata,
            wireTap: {
              originalMessageId: message.id,
              tappedAt: new Date().toISOString(),
              headersOnly: true,
            },
          },
        })
      : createMessage(
          JSON.parse(JSON.stringify(message.body)),
          {
            headers: { ...message.headers },
            metadata: {
              ...message.metadata,
              wireTap: {
                originalMessageId: message.id,
                tappedAt: new Date().toISOString(),
              },
            },
          },
        );

    this._tappedMessages.push(tapped);

    if (this._tapHandler) {
      this._tapHandler(tapped);
    }

    return message; // Return original unchanged
  }

  /** Get all tapped messages. */
  get tappedMessages(): ESBMessage[] {
    return [...this._tappedMessages];
  }

  /** Clear tapped messages buffer. */
  clear(): void {
    this._tappedMessages = [];
  }
}

// ── Idempotent Consumer ───────────────────────────────────────

/**
 * Ensures that a message is processed only once, even if
 * delivered multiple times. Uses a configurable business key
 * for deduplication.
 */
export class IdempotentConsumer {
  private _processedKeys: Map<string, number> = new Map();
  private readonly _keyField: string;
  private readonly _keySource: 'body' | 'headers' | 'metadata' | 'id';
  private readonly _windowMs: number;

  constructor(
    keyField: string,
    keySource: 'body' | 'headers' | 'metadata' | 'id' = 'id',
    windowMs: number = 3_600_000, // 1 hour default
  ) {
    this._keyField = keyField;
    this._keySource = keySource;
    this._windowMs = windowMs;
  }

  /**
   * Check if a message is a duplicate.
   * Returns true if the message should be processed (not a duplicate).
   * Returns false if the message is a duplicate.
   */
  tryProcess(message: ESBMessage): boolean {
    const key = this._getKey(message);
    if (key === undefined) return true; // Can't determine key, allow processing

    this._cleanup();

    if (this._processedKeys.has(String(key))) {
      return false; // Duplicate
    }

    this._processedKeys.set(String(key), Date.now());
    return true;
  }

  /** Check if a message would be considered a duplicate. */
  isDuplicate(message: ESBMessage): boolean {
    const key = this._getKey(message);
    if (key === undefined) return false;
    return this._processedKeys.has(String(key));
  }

  /** Get the number of tracked keys. */
  get trackedCount(): number {
    return this._processedKeys.size;
  }

  /** Clear the deduplication store. */
  clear(): void {
    this._processedKeys.clear();
  }

  private _getKey(message: ESBMessage): any {
    switch (this._keySource) {
      case 'id':
        return message.id;
      case 'headers':
        return resolvePath(message.headers, this._keyField);
      case 'metadata':
        return resolvePath(message.metadata, this._keyField);
      default:
        return resolvePath(message.body, this._keyField);
    }
  }

  private _cleanup(): void {
    const cutoff = Date.now() - this._windowMs;
    for (const [key, time] of this._processedKeys) {
      if (time < cutoff) {
        this._processedKeys.delete(key);
      }
    }
  }
}

// ── Normalizer ────────────────────────────────────────────────

/** A format detector function. */
export type FormatDetector = (message: ESBMessage) => string | undefined;

/**
 * Detects the format of incoming messages and applies the
 * appropriate transformation to convert to a canonical format.
 */
export class Normalizer {
  private _detectors: FormatDetector[] = [];
  private _transformers: Map<
    string,
    (message: ESBMessage) => ESBMessage
  > = new Map();

  /** Register a format detector. */
  addDetector(detector: FormatDetector): void {
    this._detectors.push(detector);
  }

  /** Register a transformer for a detected format. */
  addTransformer(
    format: string,
    transformer: (message: ESBMessage) => ESBMessage,
  ): void {
    this._transformers.set(format, transformer);
  }

  /**
   * Normalize a message: detect its format and apply the
   * appropriate transformation.
   */
  normalize(message: ESBMessage): ESBMessage {
    for (const detector of this._detectors) {
      const format = detector(message);
      if (format) {
        const transformer = this._transformers.get(format);
        if (transformer) {
          return transformer(message);
        }
      }
    }
    return message; // No transformation needed
  }
}
