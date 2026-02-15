// ============================================================
// SOA One ESB — Event Delivery Network (EDN)
// ============================================================
//
// Oracle SOA Suite Event Delivery Network equivalent.
// Publish-subscribe backbone for business events with
// filtering, topics, subscriptions, replay, and DLQ.
// ============================================================

import { generateId } from './channel';

// ── Types ────────────────────────────────────────────────────

export type EventPriority = 'low' | 'normal' | 'high' | 'critical';
export type SubscriptionMode = 'durable' | 'transient';
export type DeliveryGuarantee = 'at-most-once' | 'at-least-once' | 'exactly-once';

export interface BusinessEvent {
  id: string;
  namespace: string;
  name: string;
  version: string;
  priority: EventPriority;
  payload: Record<string, any>;
  headers: Record<string, string>;
  source: string;
  correlationId?: string;
  publishedAt: string;
  expiresAt?: string;
  deliveredCount: number;
}

export interface EventTopic {
  id: string;
  namespace: string;
  name: string;
  description?: string;
  schema?: Record<string, any>;
  retentionMs: number;
  partitions: number;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface EventSubscription {
  id: string;
  topicId: string;
  subscriberId: string;
  filter?: string;
  mode: SubscriptionMode;
  deliveryGuarantee: DeliveryGuarantee;
  maxRetries: number;
  handler: (event: BusinessEvent) => void | Promise<void>;
  enabled: boolean;
  createdAt: string;
}

export interface DeadLetterEntry {
  id: string;
  event: BusinessEvent;
  subscriptionId: string;
  failureReason: string;
  attempts: number;
  failedAt: string;
}

// ── EventDeliveryNetwork ─────────────────────────────────────

export class EventDeliveryNetwork {
  private _topics = new Map<string, EventTopic>();
  private _subscriptions = new Map<string, EventSubscription>();
  private _eventLog: BusinessEvent[] = [];
  private _deadLetters: DeadLetterEntry[] = [];
  private _onPublished: ((e: BusinessEvent) => void) | null = null;
  private _onDelivered: ((e: BusinessEvent, subId: string) => void) | null = null;
  private _onDeadLetter: ((d: DeadLetterEntry) => void) | null = null;

  // ── Topics ──

  createTopic(topic: Omit<EventTopic, 'id' | 'createdAt' | 'updatedAt'>): EventTopic {
    const now = new Date().toISOString();
    const t: EventTopic = { ...topic, id: generateId(), createdAt: now, updatedAt: now };
    this._topics.set(t.id, t);
    return t;
  }

  getTopic(id: string): EventTopic | undefined {
    return this._topics.get(id);
  }

  getTopicByName(namespace: string, name: string): EventTopic | undefined {
    for (const t of this._topics.values()) {
      if (t.namespace === namespace && t.name === name) return t;
    }
    return undefined;
  }

  updateTopic(id: string, updates: Partial<EventTopic>): EventTopic {
    const t = this._topics.get(id);
    if (!t) throw new Error(`Topic not found: ${id}`);
    Object.assign(t, updates, { updatedAt: new Date().toISOString() });
    return t;
  }

  removeTopic(id: string): boolean {
    return this._topics.delete(id);
  }

  get allTopics(): EventTopic[] {
    return [...this._topics.values()];
  }

  // ── Subscriptions ──

  subscribe(sub: Omit<EventSubscription, 'id' | 'createdAt'>): EventSubscription {
    const s: EventSubscription = { ...sub, id: generateId(), createdAt: new Date().toISOString() };
    this._subscriptions.set(s.id, s);
    return s;
  }

  unsubscribe(id: string): boolean {
    return this._subscriptions.delete(id);
  }

  getSubscription(id: string): EventSubscription | undefined {
    return this._subscriptions.get(id);
  }

  getSubscriptionsByTopic(topicId: string): EventSubscription[] {
    return [...this._subscriptions.values()].filter(s => s.topicId === topicId);
  }

  getSubscriptionsBySubscriber(subscriberId: string): EventSubscription[] {
    return [...this._subscriptions.values()].filter(s => s.subscriberId === subscriberId);
  }

  enableSubscription(id: string): void {
    const s = this._subscriptions.get(id);
    if (s) s.enabled = true;
  }

  disableSubscription(id: string): void {
    const s = this._subscriptions.get(id);
    if (s) s.enabled = false;
  }

  get allSubscriptions(): EventSubscription[] {
    return [...this._subscriptions.values()];
  }

  // ── Publish / Deliver ──

  publish(topicId: string, event: Omit<BusinessEvent, 'id' | 'publishedAt' | 'deliveredCount'>): BusinessEvent {
    const topic = this._topics.get(topicId);
    if (!topic) throw new Error(`Topic not found: ${topicId}`);
    if (!topic.enabled) throw new Error(`Topic is disabled: ${topicId}`);

    const e: BusinessEvent = {
      ...event,
      id: generateId(),
      publishedAt: new Date().toISOString(),
      deliveredCount: 0,
    };

    this._eventLog.push(e);
    this._onPublished?.(e);

    // Deliver to matching subscriptions
    const subs = this.getSubscriptionsByTopic(topicId).filter(s => s.enabled);
    for (const sub of subs) {
      try {
        sub.handler(e);
        e.deliveredCount++;
        this._onDelivered?.(e, sub.id);
      } catch (err) {
        const dlEntry: DeadLetterEntry = {
          id: generateId(),
          event: e,
          subscriptionId: sub.id,
          failureReason: err instanceof Error ? err.message : String(err),
          attempts: 1,
          failedAt: new Date().toISOString(),
        };
        this._deadLetters.push(dlEntry);
        this._onDeadLetter?.(dlEntry);
      }
    }

    return e;
  }

  // ── Event Log ──

  getEvent(id: string): BusinessEvent | undefined {
    return this._eventLog.find(e => e.id === id);
  }

  getEventsByTopic(namespace: string, name: string): BusinessEvent[] {
    return this._eventLog.filter(e => e.namespace === namespace && e.name === name);
  }

  replay(topicId: string, from: string, to?: string): BusinessEvent[] {
    const topic = this._topics.get(topicId);
    if (!topic) throw new Error(`Topic not found: ${topicId}`);
    return this._eventLog.filter(e =>
      e.namespace === topic.namespace &&
      e.name === topic.name &&
      e.publishedAt >= from &&
      (!to || e.publishedAt <= to)
    );
  }

  get allEvents(): BusinessEvent[] {
    return [...this._eventLog];
  }

  // ── Dead Letters ──

  getDeadLetters(): DeadLetterEntry[] {
    return [...this._deadLetters];
  }

  getDeadLettersBySubscription(subscriptionId: string): DeadLetterEntry[] {
    return this._deadLetters.filter(d => d.subscriptionId === subscriptionId);
  }

  retryDeadLetter(id: string): boolean {
    const idx = this._deadLetters.findIndex(d => d.id === id);
    if (idx < 0) return false;
    const entry = this._deadLetters[idx];
    const sub = this._subscriptions.get(entry.subscriptionId);
    if (!sub) return false;

    try {
      sub.handler(entry.event);
      this._deadLetters.splice(idx, 1);
      return true;
    } catch {
      entry.attempts++;
      entry.failedAt = new Date().toISOString();
      return false;
    }
  }

  purgeDeadLetters(): number {
    const count = this._deadLetters.length;
    this._deadLetters.length = 0;
    return count;
  }

  // ── Stats ──

  getStats(): {
    topics: number;
    subscriptions: number;
    publishedEvents: number;
    deadLetters: number;
  } {
    return {
      topics: this._topics.size,
      subscriptions: this._subscriptions.size,
      publishedEvents: this._eventLog.length,
      deadLetters: this._deadLetters.length,
    };
  }

  // ── Events ──

  onPublished(cb: (e: BusinessEvent) => void): void { this._onPublished = cb; }
  onDelivered(cb: (e: BusinessEvent, subId: string) => void): void { this._onDelivered = cb; }
  onDeadLetter(cb: (d: DeadLetterEntry) => void): void { this._onDeadLetter = cb; }
}
