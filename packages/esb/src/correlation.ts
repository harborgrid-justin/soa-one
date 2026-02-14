// ============================================================
// SOA One ESB — Message Correlation Engine
// ============================================================
//
// Correlates related messages across channels and services
// using correlation IDs, business keys, and custom strategies.
//
// Beyond Oracle ESB:
// - Multi-field correlation keys
// - Configurable correlation strategies
// - Correlation with TTL and cleanup
// - Correlation groups with completion predicates
// - Correlation chain tracking (message lineage)
// ============================================================

import type { ESBMessage } from './types';
import { resolvePath, generateId } from './channel';

// ── Types ─────────────────────────────────────────────────────

/** Correlation strategy. */
export type CorrelationStrategy =
  | 'correlationId'
  | 'businessKey'
  | 'headerField'
  | 'bodyField'
  | 'composite';

/** Correlation key configuration. */
export interface CorrelationKeyConfig {
  /** Strategy for extracting the correlation key. */
  strategy: CorrelationStrategy;
  /** Field path(s) to extract the key from. */
  fields: string[];
  /** Source of the field(s). */
  source: 'body' | 'headers' | 'metadata';
}

/** A correlation group tracks related messages. */
export interface CorrelationGroup {
  /** Unique group ID. */
  id: string;
  /** The correlation key value. */
  correlationKey: string;
  /** Messages in this group. */
  messages: ESBMessage[];
  /** When the group was created. */
  createdAt: number;
  /** When the group was last updated. */
  updatedAt: number;
  /** Whether the group is complete. */
  complete: boolean;
  /** Custom metadata. */
  metadata: Record<string, any>;
}

/** Completion predicate for a correlation group. */
export type CompletionPredicate = (group: CorrelationGroup) => boolean;

// ── Correlation Engine ────────────────────────────────────────

/**
 * Correlates messages by extracting correlation keys and
 * grouping related messages together. Supports multiple
 * correlation strategies and completion predicates.
 */
export class CorrelationEngine {
  private _groups: Map<string, CorrelationGroup> = new Map();
  private _keyConfig: CorrelationKeyConfig;
  private _completionPredicate?: CompletionPredicate;
  private _ttlMs: number;
  private _onComplete?: (group: CorrelationGroup) => void;

  constructor(
    keyConfig: CorrelationKeyConfig,
    options: {
      ttlMs?: number;
      completionPredicate?: CompletionPredicate;
    } = {},
  ) {
    this._keyConfig = keyConfig;
    this._ttlMs = options.ttlMs ?? 300_000; // 5 minutes default
    this._completionPredicate = options.completionPredicate;
  }

  /** Set a handler for completed correlation groups. */
  onComplete(handler: (group: CorrelationGroup) => void): void {
    this._onComplete = handler;
  }

  /**
   * Correlate a message: extract its key and add it to the
   * appropriate correlation group.
   *
   * Returns the correlation group if complete, undefined otherwise.
   */
  correlate(message: ESBMessage): CorrelationGroup | undefined {
    this._cleanup();

    const key = this._extractKey(message);
    if (key === undefined) return undefined;

    const keyStr = String(key);
    let group = this._groups.get(keyStr);

    if (!group) {
      group = {
        id: generateId(),
        correlationKey: keyStr,
        messages: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        complete: false,
        metadata: {},
      };
      this._groups.set(keyStr, group);
    }

    group.messages.push(message);
    group.updatedAt = Date.now();

    // Check completion
    if (this._completionPredicate && this._completionPredicate(group)) {
      group.complete = true;
      this._groups.delete(keyStr);

      if (this._onComplete) {
        this._onComplete(group);
      }

      return group;
    }

    return undefined;
  }

  /** Get a correlation group by key. */
  getGroup(correlationKey: string): CorrelationGroup | undefined {
    return this._groups.get(correlationKey);
  }

  /** Get all pending groups. */
  get pendingGroups(): CorrelationGroup[] {
    return Array.from(this._groups.values());
  }

  /** Get the number of pending groups. */
  get pendingCount(): number {
    return this._groups.size;
  }

  /** Force complete a group by key. */
  forceComplete(correlationKey: string): CorrelationGroup | undefined {
    const group = this._groups.get(correlationKey);
    if (group) {
      group.complete = true;
      this._groups.delete(correlationKey);
      if (this._onComplete) {
        this._onComplete(group);
      }
      return group;
    }
    return undefined;
  }

  /** Get the message lineage (chain of causation) for a message. */
  getLineage(messageId: string): ESBMessage[] {
    const lineage: ESBMessage[] = [];

    for (const group of this._groups.values()) {
      for (const msg of group.messages) {
        if (msg.id === messageId || msg.causationId === messageId) {
          lineage.push(msg);
        }
      }
    }

    // Sort by timestamp
    return lineage.sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
    );
  }

  /** Clear all groups. */
  clear(): void {
    this._groups.clear();
  }

  /** Destroy the engine. */
  destroy(): void {
    this._groups.clear();
  }

  // ── Private ───────────────────────────────────────────────

  private _extractKey(message: ESBMessage): any {
    switch (this._keyConfig.strategy) {
      case 'correlationId':
        return message.correlationId ?? message.id;

      case 'headerField':
        return this._getFieldValue(message, this._keyConfig.fields[0], 'headers');

      case 'bodyField':
        return this._getFieldValue(message, this._keyConfig.fields[0], 'body');

      case 'businessKey':
      case 'composite': {
        // Combine multiple fields into a composite key
        const parts = this._keyConfig.fields.map((field) =>
          String(this._getFieldValue(message, field, this._keyConfig.source) ?? ''),
        );
        return parts.join(':');
      }

      default:
        return message.correlationId ?? message.id;
    }
  }

  private _getFieldValue(
    message: ESBMessage,
    field: string,
    source: string,
  ): any {
    switch (source) {
      case 'headers':
        return resolvePath(message.headers, field);
      case 'metadata':
        return resolvePath(message.metadata, field);
      default:
        return resolvePath(message.body, field);
    }
  }

  private _cleanup(): void {
    const cutoff = Date.now() - this._ttlMs;
    for (const [key, group] of this._groups) {
      if (group.updatedAt < cutoff) {
        this._groups.delete(key);
      }
    }
  }
}
