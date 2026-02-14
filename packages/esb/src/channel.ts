// ============================================================
// SOA One ESB — Message Channels
// ============================================================
//
// Implements point-to-point, publish-subscribe, dead-letter,
// request-reply, and priority message channels with deduplication,
// TTL enforcement, backpressure, and competing consumer support.
// ============================================================

import type {
  ESBMessage,
  MessageEnvelope,
  ChannelConfig,
  ChannelType,
  MessageHandler,
  MessageFilter,
  MessagePriority,
  Subscription,
  PRIORITY_WEIGHTS,
} from './types';

// ── Helpers ───────────────────────────────────────────────────

let _idCounter = 0;

/** Generate a unique ID without external dependencies. */
export function generateId(): string {
  const time = Date.now().toString(36);
  const rand = Math.random().toString(36).substring(2, 10);
  return `${time}-${rand}-${(++_idCounter).toString(36)}`;
}

/** Resolve a dot-notation path on an object. */
export function resolvePath(obj: any, path: string): any {
  if (!obj || !path) return undefined;
  const parts = path.split('.');
  let current = obj;
  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    current = current[part];
  }
  return current;
}

// ── Message Factory ───────────────────────────────────────────

/** Create a new ESB message with sensible defaults. */
export function createMessage<T = any>(
  body: T,
  options: Partial<ESBMessage<T>> = {},
): ESBMessage<T> {
  return {
    id: options.id ?? generateId(),
    correlationId: options.correlationId,
    causationId: options.causationId,
    timestamp: options.timestamp ?? new Date().toISOString(),
    headers: options.headers ?? {},
    body,
    metadata: options.metadata ?? {},
    replyTo: options.replyTo,
    priority: options.priority ?? 'normal',
    expiration: options.expiration,
    contentType: options.contentType ?? 'application/json',
    encoding: options.encoding ?? 'utf-8',
  };
}

/** Wrap a message in a delivery envelope. */
export function createEnvelope<T = any>(
  message: ESBMessage<T>,
): MessageEnvelope<T> {
  return {
    message,
    deliveryCount: 0,
    firstDeliveryTime: new Date().toISOString(),
    acknowledged: false,
  };
}

// ── Message Channel ───────────────────────────────────────────

/**
 * In-memory message channel supporting point-to-point, pub/sub,
 * dead-letter, request-reply, and priority semantics.
 *
 * Features beyond Oracle ESB:
 * - Message deduplication with configurable window
 * - Priority queuing with 5 priority levels
 * - Backpressure via maxSize
 * - Competing consumers for point-to-point channels
 * - TTL enforcement with automatic expiry
 * - Built-in delivery tracking via envelopes
 */
export class MessageChannel {
  readonly name: string;
  readonly type: ChannelType;
  private readonly _config: Required<
    Pick<ChannelConfig, 'maxSize' | 'ttlMs' | 'persistent' | 'maxRetries' | 'retryDelayMs' | 'deduplication' | 'deduplicationWindowMs'>
  > & ChannelConfig;

  private _queue: MessageEnvelope[] = [];
  private _subscriptions: Map<string, Subscription> = new Map();
  private _handlers: MessageHandler[] = [];
  private _consumerIndex = 0;
  private _deduplicationSet: Map<string, number> = new Map();
  private _paused = false;
  private _destroyed = false;

  // Metrics
  private _messagesIn = 0;
  private _messagesOut = 0;
  private _messagesFailed = 0;
  private _messagesExpired = 0;
  private _messagesDeduplicated = 0;

  /** Event listeners */
  private _listeners: Map<string, Array<(data: any) => void>> = new Map();

  constructor(config: ChannelConfig) {
    this.name = config.name;
    this.type = config.type;
    this._config = {
      ...config,
      maxSize: config.maxSize ?? 0,
      ttlMs: config.ttlMs ?? 0,
      persistent: config.persistent ?? false,
      maxRetries: config.maxRetries ?? 3,
      retryDelayMs: config.retryDelayMs ?? 1000,
      deduplication: config.deduplication ?? false,
      deduplicationWindowMs: config.deduplicationWindowMs ?? 60_000,
    };
  }

  // ── Publishing ────────────────────────────────────────────

  /**
   * Send a message to this channel.
   * Returns true if the message was accepted, false if rejected
   * (backpressure, duplicate, expired, or filtered).
   */
  async send(message: ESBMessage): Promise<boolean> {
    if (this._destroyed) {
      throw new Error(`Channel "${this.name}" has been destroyed.`);
    }
    if (this._paused) {
      return false;
    }

    // Check backpressure
    if (this._config.maxSize > 0 && this._queue.length >= this._config.maxSize) {
      this._emit('backpressure', { messageId: message.id, queueSize: this._queue.length });
      return false;
    }

    // Check deduplication
    if (this._config.deduplication) {
      if (this._deduplicationSet.has(message.id)) {
        this._messagesDeduplicated++;
        return false;
      }
      this._deduplicationSet.set(message.id, Date.now());
      this._cleanDeduplicationSet();
    }

    // Check TTL / expiration
    if (message.expiration) {
      const messageTime = new Date(message.timestamp).getTime();
      if (Date.now() - messageTime > message.expiration) {
        this._messagesExpired++;
        this._emit('message:expired', { messageId: message.id });
        return false;
      }
    }

    // Apply filters
    if (this._config.filters && this._config.filters.length > 0) {
      const passes = this._applyFilters(message, this._config.filters);
      if (!passes) {
        this._emit('message:filtered', { messageId: message.id });
        return false;
      }
    }

    const envelope = createEnvelope(message);
    this._messagesIn++;

    // Route based on channel type
    switch (this.type) {
      case 'point-to-point':
        return this._deliverPointToPoint(envelope);
      case 'publish-subscribe':
        return this._deliverPubSub(envelope);
      case 'priority':
        return this._deliverPriority(envelope);
      case 'request-reply':
        return this._deliverRequestReply(envelope);
      case 'dead-letter':
        this._queue.push(envelope);
        this._emit('message:deadLettered', { messageId: message.id });
        return true;
      default:
        this._queue.push(envelope);
        return true;
    }
  }

  // ── Consuming ─────────────────────────────────────────────

  /** Register a handler for point-to-point consumption (competing consumers). */
  addConsumer(handler: MessageHandler): void {
    this._handlers.push(handler);
  }

  /** Remove a consumer handler. */
  removeConsumer(handler: MessageHandler): void {
    const idx = this._handlers.indexOf(handler);
    if (idx >= 0) this._handlers.splice(idx, 1);
  }

  /** Subscribe to a pub/sub channel. Returns subscription ID. */
  subscribe(
    subscriberId: string,
    handler: MessageHandler,
    filter?: MessageFilter,
  ): string {
    const sub: Subscription = {
      id: generateId(),
      channelName: this.name,
      subscriberId,
      filter,
      handler,
      active: true,
      createdAt: new Date().toISOString(),
    };
    this._subscriptions.set(sub.id, sub);
    return sub.id;
  }

  /** Unsubscribe from a pub/sub channel. */
  unsubscribe(subscriptionId: string): boolean {
    return this._subscriptions.delete(subscriptionId);
  }

  /** Receive a message from the queue (pull-based consumption). */
  receive(): ESBMessage | undefined {
    this._purgeExpired();
    const envelope = this._queue.shift();
    if (envelope) {
      envelope.acknowledged = true;
      this._messagesOut++;
      return envelope.message;
    }
    return undefined;
  }

  /** Peek at the next message without removing it. */
  peek(): ESBMessage | undefined {
    this._purgeExpired();
    return this._queue[0]?.message;
  }

  // ── Request-Reply ─────────────────────────────────────────

  /**
   * Send a request and wait for a reply on the specified reply channel.
   * This is a convenience for the request-reply pattern.
   */
  async request(
    message: ESBMessage,
    replyChannel: MessageChannel,
    timeoutMs: number = 30_000,
  ): Promise<ESBMessage | undefined> {
    const correlationId = message.correlationId ?? generateId();
    message.correlationId = correlationId;
    message.replyTo = replyChannel.name;

    return new Promise<ESBMessage | undefined>((resolve) => {
      let resolved = false;
      const timer = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          resolve(undefined);
        }
      }, timeoutMs);

      // Listen for reply
      const handler: MessageHandler = (reply) => {
        if (reply.correlationId === correlationId && !resolved) {
          resolved = true;
          clearTimeout(timer);
          replyChannel.removeConsumer(handler);
          resolve(reply);
        }
      };
      replyChannel.addConsumer(handler);

      // Send the request
      this.send(message).catch(() => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timer);
          replyChannel.removeConsumer(handler);
          resolve(undefined);
        }
      });
    });
  }

  // ── Channel State ─────────────────────────────────────────

  /** Pause the channel (messages will be rejected). */
  pause(): void {
    this._paused = true;
  }

  /** Resume the channel. */
  resume(): void {
    this._paused = false;
  }

  /** Whether the channel is paused. */
  get isPaused(): boolean {
    return this._paused;
  }

  /** Current queue depth. */
  get depth(): number {
    return this._queue.length;
  }

  /** Number of active subscriptions. */
  get subscriptionCount(): number {
    return this._subscriptions.size;
  }

  /** Number of registered consumers. */
  get consumerCount(): number {
    return this._handlers.length;
  }

  /** Channel metrics. */
  get metrics() {
    return {
      messagesIn: this._messagesIn,
      messagesOut: this._messagesOut,
      messagesFailed: this._messagesFailed,
      messagesExpired: this._messagesExpired,
      messagesDeduplicated: this._messagesDeduplicated,
      queueDepth: this._queue.length,
      subscriptions: this._subscriptions.size,
      consumers: this._handlers.length,
    };
  }

  /** Drain all messages from the queue. */
  drain(): ESBMessage[] {
    const messages = this._queue.map((e) => e.message);
    this._queue = [];
    return messages;
  }

  /** Purge all messages without returning them. */
  purge(): number {
    const count = this._queue.length;
    this._queue = [];
    return count;
  }

  /** Destroy the channel and release resources. */
  destroy(): void {
    this._destroyed = true;
    this._queue = [];
    this._subscriptions.clear();
    this._handlers = [];
    this._deduplicationSet.clear();
    this._listeners.clear();
  }

  /** Whether the channel has been destroyed. */
  get isDestroyed(): boolean {
    return this._destroyed;
  }

  // ── Event Emitter ─────────────────────────────────────────

  on(event: string, listener: (data: any) => void): void {
    if (!this._listeners.has(event)) {
      this._listeners.set(event, []);
    }
    this._listeners.get(event)!.push(listener);
  }

  off(event: string, listener: (data: any) => void): void {
    const arr = this._listeners.get(event);
    if (arr) {
      const idx = arr.indexOf(listener);
      if (idx >= 0) arr.splice(idx, 1);
    }
  }

  private _emit(event: string, data: any): void {
    const arr = this._listeners.get(event);
    if (arr) {
      for (const listener of arr) {
        try {
          listener(data);
        } catch {
          // swallow listener errors
        }
      }
    }
  }

  // ── Private Delivery Methods ──────────────────────────────

  private async _deliverPointToPoint(envelope: MessageEnvelope): Promise<boolean> {
    if (this._handlers.length === 0) {
      // No consumers: queue the message
      this._queue.push(envelope);
      return true;
    }

    // Round-robin to competing consumers
    const handlerIndex = this._consumerIndex % this._handlers.length;
    this._consumerIndex++;
    const handler = this._handlers[handlerIndex];

    try {
      await handler(envelope.message);
      envelope.acknowledged = true;
      this._messagesOut++;
      return true;
    } catch {
      envelope.deliveryCount++;
      envelope.lastError = 'Handler threw an error';
      if (envelope.deliveryCount < this._config.maxRetries) {
        this._queue.push(envelope);
      } else {
        this._messagesFailed++;
        this._emit('message:failed', {
          messageId: envelope.message.id,
          deliveryCount: envelope.deliveryCount,
        });
      }
      return false;
    }
  }

  private async _deliverPubSub(envelope: MessageEnvelope): Promise<boolean> {
    if (this._subscriptions.size === 0) {
      // No subscribers: queue for later
      this._queue.push(envelope);
      return true;
    }

    let delivered = false;
    for (const sub of this._subscriptions.values()) {
      if (!sub.active) continue;

      // Apply subscription-level filter
      if (sub.filter) {
        const passes = this._applyFilters(envelope.message, [sub.filter]);
        if (!passes) continue;
      }

      try {
        await sub.handler(envelope.message);
        delivered = true;
      } catch {
        // Individual subscriber failure does not block others
      }
    }

    if (delivered) {
      this._messagesOut++;
      envelope.acknowledged = true;
    }
    return delivered;
  }

  private async _deliverPriority(envelope: MessageEnvelope): Promise<boolean> {
    // Insert into queue sorted by priority (highest first)
    const weight = this._getPriorityWeight(envelope.message.priority);
    let inserted = false;
    for (let i = 0; i < this._queue.length; i++) {
      const existing = this._getPriorityWeight(this._queue[i].message.priority);
      if (weight > existing) {
        this._queue.splice(i, 0, envelope);
        inserted = true;
        break;
      }
    }
    if (!inserted) {
      this._queue.push(envelope);
    }

    // Attempt immediate delivery if consumers exist
    if (this._handlers.length > 0) {
      const next = this._queue.shift();
      if (next) {
        const handlerIndex = this._consumerIndex % this._handlers.length;
        this._consumerIndex++;
        try {
          await this._handlers[handlerIndex](next.message);
          next.acknowledged = true;
          this._messagesOut++;
        } catch {
          this._queue.unshift(next);
        }
      }
    }

    return true;
  }

  private async _deliverRequestReply(envelope: MessageEnvelope): Promise<boolean> {
    // Same as point-to-point but ensures correlationId is set
    if (!envelope.message.correlationId) {
      envelope.message.correlationId = envelope.message.id;
    }
    return this._deliverPointToPoint(envelope);
  }

  // ── Private Helpers ───────────────────────────────────────

  private _applyFilters(message: ESBMessage, filters: MessageFilter[]): boolean {
    for (const filter of filters) {
      const result = this._evaluateFilterCondition(message, filter);
      const passed = filter.negate ? !result : result;
      if (!passed) return false;
    }
    return true;
  }

  private _evaluateFilterCondition(
    message: ESBMessage,
    filter: MessageFilter,
  ): boolean {
    const condition = filter.condition;
    if ('logic' in condition) {
      return this._evaluateConditionGroup(message, condition);
    }
    return this._evaluateSingleCondition(message, condition);
  }

  private _evaluateConditionGroup(
    message: ESBMessage,
    group: { logic: 'AND' | 'OR'; conditions: any[] },
  ): boolean {
    if (group.logic === 'AND') {
      return group.conditions.every((c: any) =>
        'logic' in c
          ? this._evaluateConditionGroup(message, c)
          : this._evaluateSingleCondition(message, c),
      );
    }
    return group.conditions.some((c: any) =>
      'logic' in c
        ? this._evaluateConditionGroup(message, c)
        : this._evaluateSingleCondition(message, c),
    );
  }

  private _evaluateSingleCondition(
    message: ESBMessage,
    condition: { field: string; source: string; operator: string; value: any },
  ): boolean {
    let fieldValue: any;
    switch (condition.source) {
      case 'headers':
        fieldValue = resolvePath(message.headers, condition.field);
        break;
      case 'metadata':
        fieldValue = resolvePath(message.metadata, condition.field);
        break;
      default:
        fieldValue = resolvePath(message.body, condition.field);
        break;
    }
    return evaluateRoutingOperator(fieldValue, condition.operator, condition.value);
  }

  private _getPriorityWeight(priority: MessagePriority): number {
    const weights: Record<MessagePriority, number> = {
      lowest: 0,
      low: 1,
      normal: 2,
      high: 3,
      highest: 4,
    };
    return weights[priority] ?? 2;
  }

  private _purgeExpired(): void {
    const now = Date.now();
    this._queue = this._queue.filter((envelope) => {
      if (envelope.message.expiration) {
        const messageTime = new Date(envelope.message.timestamp).getTime();
        if (now - messageTime > envelope.message.expiration) {
          this._messagesExpired++;
          return false;
        }
      }
      if (this._config.ttlMs > 0) {
        const envelopeTime = new Date(envelope.firstDeliveryTime).getTime();
        if (now - envelopeTime > this._config.ttlMs) {
          this._messagesExpired++;
          return false;
        }
      }
      return true;
    });
  }

  private _cleanDeduplicationSet(): void {
    const cutoff = Date.now() - this._config.deduplicationWindowMs;
    for (const [id, time] of this._deduplicationSet) {
      if (time < cutoff) {
        this._deduplicationSet.delete(id);
      }
    }
  }
}

// ── Routing Operator Evaluator ────────────────────────────────

/**
 * Evaluate a routing operator. Compatible with @soa-one/engine's
 * operator semantics but extended with 'exists' and 'notExists'.
 */
export function evaluateRoutingOperator(
  fieldValue: any,
  operator: string,
  compareValue: any,
): boolean {
  switch (operator) {
    case 'equals':
      return fieldValue === compareValue;
    case 'notEquals':
      return fieldValue !== compareValue;
    case 'greaterThan':
      return fieldValue > compareValue;
    case 'greaterThanOrEqual':
      return fieldValue >= compareValue;
    case 'lessThan':
      return fieldValue < compareValue;
    case 'lessThanOrEqual':
      return fieldValue <= compareValue;
    case 'contains':
      if (typeof fieldValue === 'string') return fieldValue.includes(compareValue);
      if (Array.isArray(fieldValue)) return fieldValue.includes(compareValue);
      return false;
    case 'notContains':
      if (typeof fieldValue === 'string') return !fieldValue.includes(compareValue);
      if (Array.isArray(fieldValue)) return !fieldValue.includes(compareValue);
      return true;
    case 'startsWith':
      return typeof fieldValue === 'string' && fieldValue.startsWith(compareValue);
    case 'endsWith':
      return typeof fieldValue === 'string' && fieldValue.endsWith(compareValue);
    case 'in':
      return Array.isArray(compareValue) && compareValue.includes(fieldValue);
    case 'notIn':
      return Array.isArray(compareValue) && !compareValue.includes(fieldValue);
    case 'matches':
      try {
        return new RegExp(compareValue).test(String(fieldValue));
      } catch {
        return false;
      }
    case 'exists':
      return fieldValue !== undefined && fieldValue !== null;
    case 'notExists':
      return fieldValue === undefined || fieldValue === null;
    default:
      return false;
  }
}

// ── Channel Manager ───────────────────────────────────────────

/**
 * Manages a collection of named channels with lifecycle support.
 */
export class ChannelManager {
  private _channels: Map<string, MessageChannel> = new Map();

  /** Create and register a new channel. */
  createChannel(config: ChannelConfig): MessageChannel {
    if (this._channels.has(config.name)) {
      throw new Error(`Channel "${config.name}" already exists.`);
    }
    const channel = new MessageChannel(config);
    this._channels.set(config.name, channel);
    return channel;
  }

  /** Get a channel by name. */
  getChannel(name: string): MessageChannel | undefined {
    return this._channels.get(name);
  }

  /** Get or create a channel. */
  getOrCreate(config: ChannelConfig): MessageChannel {
    return this._channels.get(config.name) ?? this.createChannel(config);
  }

  /** Remove and destroy a channel. */
  removeChannel(name: string): boolean {
    const channel = this._channels.get(name);
    if (channel) {
      channel.destroy();
      this._channels.delete(name);
      return true;
    }
    return false;
  }

  /** List all channel names. */
  get channelNames(): string[] {
    return Array.from(this._channels.keys());
  }

  /** Get all channels. */
  get channels(): MessageChannel[] {
    return Array.from(this._channels.values());
  }

  /** Destroy all channels. */
  destroyAll(): void {
    for (const channel of this._channels.values()) {
      channel.destroy();
    }
    this._channels.clear();
  }
}
