// ============================================================
// SOA One DQM — Enterprise Messaging Service
// ============================================================

import type {
  DQMMessage,
  TopicConfig,
  TopicType,
  SubscriptionConfig,
  SubscriptionType,
  QueueConfig,
  QueueType,
  MessageHandler,
  MessageFilter,
  MessagePriority,
  DeliveryMode,
  MessageState,
  TopicStats,
  QueueStats,
  MessageSchemaConfig,
} from './types';

import { generateId } from './profiler';

// ── Helpers ───────────────────────────────────────────────────

/** Simple hash function for key-shared routing. */
function hashKey(key: string, bucketCount: number): number {
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    const ch = key.charCodeAt(i);
    hash = ((hash << 5) - hash + ch) | 0;
  }
  return Math.abs(hash) % bucketCount;
}

/** Create a DQM message with defaults. */
function createDQMMessage<T>(
  body: T,
  topicOrQueue: string,
  options: {
    key?: string;
    headers?: Record<string, string>;
    priority?: MessagePriority;
    correlationId?: string;
    replyTo?: string;
    ttlMs?: number;
    publishedBy?: string;
    delayMs?: number;
    deliveryMode?: DeliveryMode;
    maxRetries?: number;
  } = {},
): DQMMessage<T> {
  return {
    id: generateId(),
    topic: topicOrQueue,
    key: options.key,
    body,
    headers: options.headers ?? {},
    priority: options.priority ?? 5,
    deliveryMode: options.deliveryMode ?? 'at-least-once',
    timestamp: new Date().toISOString(),
    publishedBy: options.publishedBy ?? 'system',
    correlationId: options.correlationId,
    replyTo: options.replyTo,
    ttlMs: options.ttlMs,
    retryCount: 0,
    maxRetries: options.maxRetries ?? 3,
    state: 'pending',
    metadata: options.delayMs ? { delayUntil: Date.now() + options.delayMs } : undefined,
  };
}

// ── Subscription ──────────────────────────────────────────────

/**
 * A subscription to a topic. Tracks delivery, acknowledgment,
 * and pending message state for its consumer.
 */
export class Subscription {
  readonly id: string;
  readonly topicName: string;
  readonly name: string;
  readonly type: SubscriptionType;
  readonly config: SubscriptionConfig;
  readonly handler: MessageHandler;

  _filter?: MessageFilter;
  _pendingAcks: Set<string> = new Set();
  _delivered = 0;
  _acknowledged = 0;

  constructor(
    topicName: string,
    config: SubscriptionConfig,
    handler: MessageHandler,
  ) {
    this.id = config.id || generateId();
    this.topicName = topicName;
    this.name = config.name;
    this.type = config.type;
    this.config = config;
    this.handler = handler;
  }

  /** Deliver a message to this subscription's handler. */
  deliver(message: DQMMessage): void {
    // Apply filter if configured
    if (this._filter && !this._filter(message)) {
      return;
    }

    this._delivered++;
    this._pendingAcks.add(message.id);

    try {
      this.handler(message);
    } catch {
      // Handler errors do not propagate; message stays pending
    }
  }

  /** Acknowledge a delivered message. */
  acknowledge(messageId: string): void {
    if (this._pendingAcks.has(messageId)) {
      this._pendingAcks.delete(messageId);
      this._acknowledged++;
    }
  }

  /** Reject a delivered message. */
  reject(messageId: string): void {
    this._pendingAcks.delete(messageId);
  }

  /** Number of messages delivered but not yet acknowledged. */
  get backlog(): number {
    return this._pendingAcks.size;
  }

  /** Subscription delivery statistics. */
  get stats(): { delivered: number; acknowledged: number; pending: number } {
    return {
      delivered: this._delivered,
      acknowledged: this._acknowledged,
      pending: this._pendingAcks.size,
    };
  }
}

// ── Topic ─────────────────────────────────────────────────────

/**
 * Pub/sub topic with support for exclusive, shared, failover,
 * and key-shared subscription types. Includes dead-letter handling
 * and optional schema validation.
 */
export class Topic {
  private _config: TopicConfig;
  private _messages: DQMMessage[] = [];
  private _subscriptions: Map<string, Subscription> = new Map();
  private _stats = {
    published: 0,
    delivered: 0,
    acknowledged: 0,
    deadLettered: 0,
  };

  /** Round-robin index for shared subscriptions. */
  private _sharedIndex = 0;

  constructor(config: TopicConfig) {
    this._config = config;
  }

  // ── Accessors ─────────────────────────────────────────────

  /** Topic name. */
  get name(): string {
    return this._config.name;
  }

  /** Topic type. */
  get type(): TopicType {
    return this._config.type;
  }

  /** Full topic configuration. */
  get config(): TopicConfig {
    return this._config;
  }

  /** Number of active subscriptions. */
  get subscriptionCount(): number {
    return this._subscriptions.size;
  }

  /** Number of messages in the backlog. */
  get messageBacklog(): number {
    return this._messages.length;
  }

  // ── Publishing ────────────────────────────────────────────

  /**
   * Publish a message to this topic.
   * The message is delivered to all matching subscriptions based
   * on subscription type and filters.
   */
  publish<T>(
    body: T,
    options: {
      key?: string;
      headers?: Record<string, string>;
      priority?: MessagePriority;
      correlationId?: string;
      replyTo?: string;
      ttlMs?: number;
      publishedBy?: string;
    } = {},
  ): DQMMessage<T> {
    this._validateSchema(body);

    const message = createDQMMessage<T>(body, this._config.name, {
      ...options,
      deliveryMode: this._config.deliveryMode,
      maxRetries: this._config.maxRetries,
    });

    this._messages.push(message);
    this._stats.published++;

    this._deliverToSubscriptions(message);

    return message;
  }

  // ── Subscription Management ───────────────────────────────

  /** Subscribe to this topic with a handler. */
  subscribe(config: SubscriptionConfig, handler: MessageHandler): Subscription {
    const sub = new Subscription(this._config.name, config, handler);

    // Parse filter expression into a filter function if provided
    if (config.filter) {
      const filterExpr = config.filter;
      sub._filter = (msg: DQMMessage) => {
        // Support simple header-based filter: "header.key=value"
        const match = filterExpr.match(/^header\.(\w+)\s*=\s*(.+)$/);
        if (match) {
          return msg.headers[match[1]] === match[2].trim();
        }
        // Support key-based filter: "key=value"
        const keyMatch = filterExpr.match(/^key\s*=\s*(.+)$/);
        if (keyMatch) {
          return msg.key === keyMatch[1].trim();
        }
        return true;
      };
    }

    this._subscriptions.set(sub.id, sub);
    return sub;
  }

  /** Unsubscribe by subscription ID. */
  unsubscribe(subscriptionId: string): void {
    this._subscriptions.delete(subscriptionId);
  }

  /** Get a subscription by ID. */
  getSubscription(id: string): Subscription | undefined {
    return this._subscriptions.get(id);
  }

  // ── Stats ─────────────────────────────────────────────────

  /** Get topic statistics. */
  getStats(): TopicStats {
    return {
      name: this._config.name,
      type: this._config.type,
      totalPublished: this._stats.published,
      totalDelivered: this._stats.delivered,
      totalAcknowledged: this._stats.acknowledged,
      totalDeadLettered: this._stats.deadLettered,
      activeSubscriptions: this._subscriptions.size,
      messageBacklog: this._messages.length,
      publishRate: 0,
      deliveryRate: 0,
      averageLatencyMs: 0,
    };
  }

  /** Purge all messages from the backlog. */
  purge(): void {
    this._messages = [];
  }

  // ── Private ───────────────────────────────────────────────

  /**
   * Route a message to subscriptions based on their type:
   * - exclusive: only the first subscription receives it
   * - shared: round-robin across subscriptions
   * - failover: deliver to first; second is backup
   * - key-shared: hash the key to pick a subscription
   */
  private _deliverToSubscriptions(message: DQMMessage): void {
    if (this._subscriptions.size === 0) {
      return;
    }

    const subs = Array.from(this._subscriptions.values());
    let delivered = false;

    // Group subscriptions by type and process each group
    const exclusive = subs.filter((s) => s.type === 'exclusive');
    const shared = subs.filter((s) => s.type === 'shared');
    const failover = subs.filter((s) => s.type === 'failover');
    const keyShared = subs.filter((s) => s.type === 'key-shared');

    // Exclusive: only the first subscription receives the message
    if (exclusive.length > 0) {
      exclusive[0].deliver(message);
      this._stats.delivered++;
      delivered = true;
    }

    // Shared: round-robin across shared subscriptions
    if (shared.length > 0) {
      const idx = this._sharedIndex % shared.length;
      this._sharedIndex++;
      shared[idx].deliver(message);
      this._stats.delivered++;
      delivered = true;
    }

    // Failover: deliver to first, fall back to second if first fails
    if (failover.length > 0) {
      const primary = failover[0];
      try {
        primary.deliver(message);
        this._stats.delivered++;
        delivered = true;
      } catch {
        // Primary failed; try backup
        if (failover.length > 1) {
          failover[1].deliver(message);
          this._stats.delivered++;
          delivered = true;
        }
      }
    }

    // Key-shared: hash key to determine which subscriber gets it
    if (keyShared.length > 0) {
      const key = message.key ?? message.id;
      const idx = hashKey(key, keyShared.length);
      keyShared[idx].deliver(message);
      this._stats.delivered++;
      delivered = true;
    }

    // If no subscription matched or delivery failed, handle dead letter
    if (!delivered) {
      this._handleDeadLetter(message);
    }
  }

  /** Move message to dead-letter topic. */
  private _handleDeadLetter(message: DQMMessage): void {
    message.state = 'dead-lettered';
    this._stats.deadLettered++;
  }

  /** Validate message body against configured schema. */
  private _validateSchema(body: any): void {
    if (!this._config.schemaValidation || !this._config.messageSchema) {
      return;
    }

    const schema = this._config.messageSchema;
    if (schema.type === 'json-schema' && schema.schema) {
      const definition = schema.schema;

      // Validate required fields
      if (definition.required && Array.isArray(definition.required)) {
        for (const field of definition.required) {
          if (body === null || body === undefined || !(field in body)) {
            throw new Error(
              `Schema validation failed: missing required field "${field}" in topic "${this._config.name}"`,
            );
          }
        }
      }

      // Validate property types
      if (definition.properties && typeof body === 'object' && body !== null) {
        for (const [prop, propSchema] of Object.entries(definition.properties)) {
          if (prop in body) {
            const expectedType = (propSchema as any).type;
            if (expectedType) {
              const actualType = typeof body[prop];
              if (expectedType === 'integer') {
                if (!Number.isInteger(body[prop])) {
                  throw new Error(
                    `Schema validation failed: field "${prop}" must be integer in topic "${this._config.name}"`,
                  );
                }
              } else if (actualType !== expectedType) {
                throw new Error(
                  `Schema validation failed: field "${prop}" must be ${expectedType} in topic "${this._config.name}"`,
                );
              }
            }
          }
        }
      }

      // Strict mode: disallow extra fields
      if (schema.strict && definition.properties && typeof body === 'object' && body !== null) {
        const allowed = new Set(Object.keys(definition.properties));
        for (const key of Object.keys(body)) {
          if (!allowed.has(key)) {
            throw new Error(
              `Schema validation failed: unexpected field "${key}" in topic "${this._config.name}"`,
            );
          }
        }
      }
    }
  }
}

// ── MessageQueue ──────────────────────────────────────────────

/**
 * Point-to-point message queue with support for standard, priority,
 * FIFO, and delay queue semantics. Includes dead-letter handling
 * and competing consumer support.
 */
export class MessageQueue {
  private _config: QueueConfig;
  private _messages: DQMMessage[] = [];
  private _deadLetterMessages: DQMMessage[] = [];
  private _consumers: Map<string, MessageHandler> = new Map();
  private _stats = {
    enqueued: 0,
    dequeued: 0,
    deadLettered: 0,
  };

  /** Round-robin index for consumer dispatch. */
  private _consumerIndex = 0;

  constructor(config: QueueConfig) {
    this._config = config;
  }

  // ── Accessors ─────────────────────────────────────────────

  /** Queue name. */
  get name(): string {
    return this._config.name;
  }

  /** Queue type. */
  get type(): QueueType {
    return this._config.type;
  }

  /** Current queue depth (number of ready messages). */
  get depth(): number {
    if (this._config.type === 'delay') {
      return this._messages.filter((m) => this._isReady(m)).length;
    }
    return this._messages.length;
  }

  /** Number of messages in the dead-letter queue. */
  get deadLetterDepth(): number {
    return this._deadLetterMessages.length;
  }

  // ── Enqueue / Dequeue ─────────────────────────────────────

  /**
   * Enqueue a message. For priority queues, the message is
   * inserted in sorted order (higher priority = first). For
   * delay queues, a delayMs flag marks the message as delayed.
   */
  enqueue<T>(
    body: T,
    options: {
      key?: string;
      headers?: Record<string, string>;
      priority?: MessagePriority;
      delayMs?: number;
      ttlMs?: number;
      publishedBy?: string;
    } = {},
  ): DQMMessage<T> {
    // Check max size backpressure
    if (this._config.maxSize && this._config.maxSize > 0 && this._messages.length >= this._config.maxSize) {
      throw new Error(`Queue "${this._config.name}" is full (max ${this._config.maxSize}).`);
    }

    const effectiveDelay = options.delayMs ?? this._config.delayMs;

    const message = createDQMMessage<T>(body, this._config.name, {
      ...options,
      delayMs: effectiveDelay,
      deliveryMode: this._config.deliveryMode,
      maxRetries: this._config.maxRetries,
    });

    if (this._config.type === 'priority') {
      // Insert sorted: higher priority values come first
      this._insertByPriority(message);
    } else {
      this._messages.push(message);
    }

    this._stats.enqueued++;

    // Attempt immediate delivery to a consumer
    this._dispatchToConsumer();

    return message;
  }

  /**
   * Dequeue the next ready message.
   * For priority queues, returns the highest-priority message.
   * For FIFO, returns the oldest message.
   * For delay queues, only returns messages whose delay has expired.
   */
  dequeue(): DQMMessage | undefined {
    this._processDelayed();

    if (this._config.type === 'delay') {
      const readyIdx = this._messages.findIndex((m) => this._isReady(m));
      if (readyIdx === -1) return undefined;
      const message = this._messages.splice(readyIdx, 1)[0];
      message.state = 'delivered';
      this._stats.dequeued++;
      return message;
    }

    const message = this._messages.shift();
    if (message) {
      message.state = 'delivered';
      this._stats.dequeued++;
    }
    return message;
  }

  /** Peek at the next ready message without removing it. */
  peek(): DQMMessage | undefined {
    this._processDelayed();

    if (this._config.type === 'delay') {
      return this._messages.find((m) => this._isReady(m));
    }

    return this._messages[0];
  }

  // ── Consumer Management ───────────────────────────────────

  /** Register a consumer handler with an ID. */
  registerConsumer(id: string, handler: MessageHandler): void {
    this._consumers.set(id, handler);
  }

  /** Unregister a consumer by ID. */
  unregisterConsumer(id: string): void {
    this._consumers.delete(id);
  }

  // ── Acknowledgment ────────────────────────────────────────

  /** Acknowledge a message by ID, confirming successful processing. */
  acknowledge(messageId: string): void {
    const idx = this._messages.findIndex((m) => m.id === messageId);
    if (idx >= 0) {
      this._messages[idx].state = 'acknowledged';
      this._messages.splice(idx, 1);
    }
  }

  /**
   * Reject a message. If retries remain, re-enqueue with
   * incremented retry count. Otherwise, move to the dead-letter queue.
   */
  reject(messageId: string): void {
    const idx = this._messages.findIndex((m) => m.id === messageId);
    if (idx < 0) return;

    const message = this._messages.splice(idx, 1)[0];
    message.retryCount++;

    if (message.retryCount < message.maxRetries) {
      message.state = 'redelivered';
      // Apply retry delay if configured
      if (this._config.retryDelayMs) {
        message.metadata = message.metadata ?? {};
        message.metadata.delayUntil = Date.now() + this._config.retryDelayMs;
      }
      if (this._config.type === 'priority') {
        this._insertByPriority(message);
      } else {
        this._messages.push(message);
      }
    } else {
      this._handleDeadLetter(message);
    }
  }

  // ── Stats ─────────────────────────────────────────────────

  /** Get queue statistics. */
  getStats(): QueueStats {
    const now = Date.now();
    let oldestAge = 0;
    if (this._messages.length > 0) {
      const oldest = new Date(this._messages[0].timestamp).getTime();
      oldestAge = now - oldest;
    }

    return {
      name: this._config.name,
      type: this._config.type,
      depth: this.depth,
      totalEnqueued: this._stats.enqueued,
      totalDequeued: this._stats.dequeued,
      totalDeadLettered: this._stats.deadLettered,
      oldestMessageAge: oldestAge,
      averageProcessingTimeMs: 0,
    };
  }

  /** Purge all messages from the queue. */
  purge(): void {
    this._messages = [];
    this._deadLetterMessages = [];
  }

  // ── Private ───────────────────────────────────────────────

  /** Move delayed messages to ready state when their delay expires. */
  private _processDelayed(): void {
    const now = Date.now();
    for (const message of this._messages) {
      if (
        message.metadata?.delayUntil &&
        now >= message.metadata.delayUntil
      ) {
        delete message.metadata.delayUntil;
      }
    }
  }

  /** Move a message to the dead-letter queue. */
  private _handleDeadLetter(message: DQMMessage): void {
    message.state = 'dead-lettered';
    this._deadLetterMessages.push(message);
    this._stats.deadLettered++;
  }

  /** Insert a message in priority order (higher priority = first). */
  private _insertByPriority(message: DQMMessage): void {
    let inserted = false;
    for (let i = 0; i < this._messages.length; i++) {
      if (message.priority > this._messages[i].priority) {
        this._messages.splice(i, 0, message);
        inserted = true;
        break;
      }
    }
    if (!inserted) {
      this._messages.push(message);
    }
  }

  /** Check whether a delayed message is ready for delivery. */
  private _isReady(message: DQMMessage): boolean {
    if (message.metadata?.delayUntil) {
      return Date.now() >= message.metadata.delayUntil;
    }
    return true;
  }

  /** Dispatch a ready message to the next consumer (round-robin). */
  private _dispatchToConsumer(): void {
    if (this._consumers.size === 0) return;

    const message = this.peek();
    if (!message) return;

    const consumerIds = Array.from(this._consumers.keys());
    const idx = this._consumerIndex % consumerIds.length;
    this._consumerIndex++;

    const handler = this._consumers.get(consumerIds[idx]);
    if (handler) {
      try {
        handler(message);
      } catch {
        // Consumer errors are swallowed; message remains in queue
      }
    }
  }
}

// ── MessagingService ──────────────────────────────────────────

/**
 * Central messaging orchestrator for the DQM module.
 * Manages topics and queues, provides a unified API for
 * publishing, enqueueing, subscribing, and monitoring.
 */
export class MessagingService {
  private _topics: Map<string, Topic> = new Map();
  private _queues: Map<string, MessageQueue> = new Map();
  private _deadLetterTopic: Topic | null = null;

  // ── Topic Management ──────────────────────────────────────

  /** Create and register a new topic. */
  createTopic(config: TopicConfig): Topic {
    if (this._topics.has(config.name)) {
      throw new Error(`Topic "${config.name}" already exists.`);
    }

    const topic = new Topic(config);
    this._topics.set(config.name, topic);

    // Auto-create dead-letter topic if configured
    if (config.deadLetterTopic && !this._topics.has(config.deadLetterTopic)) {
      const dlt = new Topic({
        name: config.deadLetterTopic,
        type: 'standard',
      });
      this._topics.set(config.deadLetterTopic, dlt);
      if (!this._deadLetterTopic) {
        this._deadLetterTopic = dlt;
      }
    }

    return topic;
  }

  /** Delete a topic by name. */
  deleteTopic(name: string): void {
    const topic = this._topics.get(name);
    if (topic) {
      topic.purge();
      this._topics.delete(name);
    }
  }

  /** Get a topic by name. */
  getTopic(name: string): Topic | undefined {
    return this._topics.get(name);
  }

  /** List all topic names. */
  get topicNames(): string[] {
    return Array.from(this._topics.keys());
  }

  /** Number of registered topics. */
  get topicCount(): number {
    return this._topics.size;
  }

  // ── Queue Management ──────────────────────────────────────

  /** Create and register a new queue. */
  createQueue(config: QueueConfig): MessageQueue {
    if (this._queues.has(config.name)) {
      throw new Error(`Queue "${config.name}" already exists.`);
    }

    const queue = new MessageQueue(config);
    this._queues.set(config.name, queue);
    return queue;
  }

  /** Delete a queue by name. */
  deleteQueue(name: string): void {
    const queue = this._queues.get(name);
    if (queue) {
      queue.purge();
      this._queues.delete(name);
    }
  }

  /** Get a queue by name. */
  getQueue(name: string): MessageQueue | undefined {
    return this._queues.get(name);
  }

  /** List all queue names. */
  get queueNames(): string[] {
    return Array.from(this._queues.keys());
  }

  /** Number of registered queues. */
  get queueCount(): number {
    return this._queues.size;
  }

  // ── Publish / Enqueue ─────────────────────────────────────

  /** Publish a message to a named topic. */
  publish<T>(
    topicName: string,
    body: T,
    options: {
      key?: string;
      headers?: Record<string, string>;
      priority?: MessagePriority;
      correlationId?: string;
      replyTo?: string;
      ttlMs?: number;
      publishedBy?: string;
    } = {},
  ): DQMMessage<T> {
    const topic = this._topics.get(topicName);
    if (!topic) {
      throw new Error(`Topic "${topicName}" does not exist.`);
    }
    return topic.publish(body, options);
  }

  /** Enqueue a message to a named queue. */
  enqueue<T>(
    queueName: string,
    body: T,
    options: {
      key?: string;
      headers?: Record<string, string>;
      priority?: MessagePriority;
      delayMs?: number;
      ttlMs?: number;
      publishedBy?: string;
    } = {},
  ): DQMMessage<T> {
    const queue = this._queues.get(queueName);
    if (!queue) {
      throw new Error(`Queue "${queueName}" does not exist.`);
    }
    return queue.enqueue(body, options);
  }

  // ── Subscribe ─────────────────────────────────────────────

  /** Subscribe to a topic with a handler. */
  subscribe(
    topicName: string,
    config: SubscriptionConfig,
    handler: MessageHandler,
  ): Subscription {
    const topic = this._topics.get(topicName);
    if (!topic) {
      throw new Error(`Topic "${topicName}" does not exist.`);
    }
    return topic.subscribe(config, handler);
  }

  // ── Stats ─────────────────────────────────────────────────

  /** Get aggregated statistics for all topics and queues. */
  getStats(): { topics: TopicStats[]; queues: QueueStats[] } {
    const topics: TopicStats[] = [];
    for (const topic of this._topics.values()) {
      topics.push(topic.getStats());
    }

    const queues: QueueStats[] = [];
    for (const queue of this._queues.values()) {
      queues.push(queue.getStats());
    }

    return { topics, queues };
  }

  /** Total messages published across all topics. */
  get totalMessagesPublished(): number {
    let total = 0;
    for (const topic of this._topics.values()) {
      total += topic.getStats().totalPublished;
    }
    return total;
  }

  /** Total messages delivered across all topics. */
  get totalMessagesDelivered(): number {
    let total = 0;
    for (const topic of this._topics.values()) {
      total += topic.getStats().totalDelivered;
    }
    return total;
  }

  /** Total messages moved to dead-letter across all topics and queues. */
  get totalMessagesDeadLettered(): number {
    let total = 0;
    for (const topic of this._topics.values()) {
      total += topic.getStats().totalDeadLettered;
    }
    for (const queue of this._queues.values()) {
      total += queue.getStats().totalDeadLettered;
    }
    return total;
  }

  /** Shut down all topics and queues, releasing resources. */
  shutdown(): void {
    for (const topic of this._topics.values()) {
      topic.purge();
    }
    for (const queue of this._queues.values()) {
      queue.purge();
    }
    this._topics.clear();
    this._queues.clear();
    this._deadLetterTopic = null;
  }
}
