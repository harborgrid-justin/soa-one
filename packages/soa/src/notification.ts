// ============================================================
// SOA One — Notification Service (Oracle UMS Equivalent)
// ============================================================
//
// Multi-channel notification delivery with templates, delivery
// preferences, retry logic, and delivery tracking. Equivalent
// to Oracle User Messaging Service (UMS).
// ============================================================

import { generateId } from './registry';

// ── Types ────────────────────────────────────────────────────

export type NotificationChannel = 'email' | 'sms' | 'voice' | 'im' | 'webhook' | 'push';
export type NotificationStatus = 'pending' | 'sent' | 'delivered' | 'failed' | 'expired' | 'cancelled';
export type NotificationPriority = 'low' | 'normal' | 'high' | 'critical';

export interface NotificationTemplate {
  id: string;
  name: string;
  channel: NotificationChannel;
  subject?: string;
  body: string;
  variables: string[];
  locale?: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationPreference {
  id: string;
  userId: string;
  channel: NotificationChannel;
  enabled: boolean;
  quietHoursStart?: string;
  quietHoursEnd?: string;
  categories: string[];
  createdAt: string;
  updatedAt: string;
}

export interface NotificationMessage {
  id: string;
  templateId?: string;
  channel: NotificationChannel;
  recipient: string;
  sender?: string;
  subject?: string;
  body: string;
  priority: NotificationPriority;
  status: NotificationStatus;
  category?: string;
  metadata?: Record<string, any>;
  attempts: number;
  maxAttempts: number;
  sentAt?: string;
  deliveredAt?: string;
  failedAt?: string;
  failureReason?: string;
  scheduledAt?: string;
  expiresAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DeliveryPolicy {
  id: string;
  name: string;
  channel: NotificationChannel;
  maxRetries: number;
  retryIntervalMs: number;
  ttlMs: number;
  batchSize: number;
  rateLimit: number;
  rateLimitWindowMs: number;
  fallbackChannel?: NotificationChannel;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface WebhookConfig {
  id: string;
  name: string;
  url: string;
  method: 'POST' | 'PUT';
  headers: Record<string, string>;
  secret?: string;
  enabled: boolean;
  lastTriggeredAt?: string;
  createdAt: string;
  updatedAt: string;
}

// ── NotificationService ──────────────────────────────────────

export class NotificationService {
  private _templates = new Map<string, NotificationTemplate>();
  private _preferences = new Map<string, NotificationPreference>();
  private _messages = new Map<string, NotificationMessage>();
  private _deliveryPolicies = new Map<string, DeliveryPolicy>();
  private _webhooks = new Map<string, WebhookConfig>();
  private _onSent: ((msg: NotificationMessage) => void) | null = null;
  private _onDelivered: ((msg: NotificationMessage) => void) | null = null;
  private _onFailed: ((msg: NotificationMessage) => void) | null = null;

  // ── Templates ──

  registerTemplate(template: Omit<NotificationTemplate, 'id' | 'createdAt' | 'updatedAt'>): NotificationTemplate {
    const now = new Date().toISOString();
    const t: NotificationTemplate = { ...template, id: generateId(), createdAt: now, updatedAt: now };
    this._templates.set(t.id, t);
    return t;
  }

  getTemplate(id: string): NotificationTemplate | undefined {
    return this._templates.get(id);
  }

  getTemplateByName(name: string): NotificationTemplate | undefined {
    for (const t of this._templates.values()) {
      if (t.name === name) return t;
    }
    return undefined;
  }

  updateTemplate(id: string, updates: Partial<NotificationTemplate>): NotificationTemplate {
    const t = this._templates.get(id);
    if (!t) throw new Error(`Template not found: ${id}`);
    Object.assign(t, updates, { updatedAt: new Date().toISOString() });
    return t;
  }

  removeTemplate(id: string): boolean {
    return this._templates.delete(id);
  }

  get allTemplates(): NotificationTemplate[] {
    return [...this._templates.values()];
  }

  get templateCount(): number {
    return this._templates.size;
  }

  // ── Preferences ──

  setPreference(pref: Omit<NotificationPreference, 'id' | 'createdAt' | 'updatedAt'>): NotificationPreference {
    const now = new Date().toISOString();
    const p: NotificationPreference = { ...pref, id: generateId(), createdAt: now, updatedAt: now };
    this._preferences.set(p.id, p);
    return p;
  }

  getPreference(id: string): NotificationPreference | undefined {
    return this._preferences.get(id);
  }

  getPreferencesByUser(userId: string): NotificationPreference[] {
    return [...this._preferences.values()].filter(p => p.userId === userId);
  }

  updatePreference(id: string, updates: Partial<NotificationPreference>): NotificationPreference {
    const p = this._preferences.get(id);
    if (!p) throw new Error(`Preference not found: ${id}`);
    Object.assign(p, updates, { updatedAt: new Date().toISOString() });
    return p;
  }

  removePreference(id: string): boolean {
    return this._preferences.delete(id);
  }

  get allPreferences(): NotificationPreference[] {
    return [...this._preferences.values()];
  }

  // ── Delivery Policies ──

  registerDeliveryPolicy(policy: Omit<DeliveryPolicy, 'id' | 'createdAt' | 'updatedAt'>): DeliveryPolicy {
    const now = new Date().toISOString();
    const p: DeliveryPolicy = { ...policy, id: generateId(), createdAt: now, updatedAt: now };
    this._deliveryPolicies.set(p.id, p);
    return p;
  }

  getDeliveryPolicy(id: string): DeliveryPolicy | undefined {
    return this._deliveryPolicies.get(id);
  }

  updateDeliveryPolicy(id: string, updates: Partial<DeliveryPolicy>): DeliveryPolicy {
    const p = this._deliveryPolicies.get(id);
    if (!p) throw new Error(`Delivery policy not found: ${id}`);
    Object.assign(p, updates, { updatedAt: new Date().toISOString() });
    return p;
  }

  removeDeliveryPolicy(id: string): boolean {
    return this._deliveryPolicies.delete(id);
  }

  get allDeliveryPolicies(): DeliveryPolicy[] {
    return [...this._deliveryPolicies.values()];
  }

  // ── Webhooks ──

  registerWebhook(config: Omit<WebhookConfig, 'id' | 'createdAt' | 'updatedAt'>): WebhookConfig {
    const now = new Date().toISOString();
    const w: WebhookConfig = { ...config, id: generateId(), createdAt: now, updatedAt: now };
    this._webhooks.set(w.id, w);
    return w;
  }

  getWebhook(id: string): WebhookConfig | undefined {
    return this._webhooks.get(id);
  }

  updateWebhook(id: string, updates: Partial<WebhookConfig>): WebhookConfig {
    const w = this._webhooks.get(id);
    if (!w) throw new Error(`Webhook not found: ${id}`);
    Object.assign(w, updates, { updatedAt: new Date().toISOString() });
    return w;
  }

  removeWebhook(id: string): boolean {
    return this._webhooks.delete(id);
  }

  get allWebhooks(): WebhookConfig[] {
    return [...this._webhooks.values()];
  }

  // ── Send Notifications ──

  send(options: {
    channel: NotificationChannel;
    recipient: string;
    subject?: string;
    body: string;
    sender?: string;
    templateId?: string;
    priority?: NotificationPriority;
    category?: string;
    metadata?: Record<string, any>;
    scheduledAt?: string;
    expiresAt?: string;
  }): NotificationMessage {
    const now = new Date().toISOString();
    const msg: NotificationMessage = {
      id: generateId(),
      channel: options.channel,
      recipient: options.recipient,
      sender: options.sender,
      subject: options.subject,
      body: options.body,
      templateId: options.templateId,
      priority: options.priority ?? 'normal',
      status: options.scheduledAt ? 'pending' : 'sent',
      category: options.category,
      metadata: options.metadata,
      attempts: options.scheduledAt ? 0 : 1,
      maxAttempts: 3,
      sentAt: options.scheduledAt ? undefined : now,
      scheduledAt: options.scheduledAt,
      expiresAt: options.expiresAt,
      createdAt: now,
      updatedAt: now,
    };
    this._messages.set(msg.id, msg);
    if (msg.status === 'sent') this._onSent?.(msg);
    return msg;
  }

  sendFromTemplate(templateId: string, recipient: string, variables: Record<string, string>, options?: {
    priority?: NotificationPriority;
    category?: string;
    sender?: string;
  }): NotificationMessage {
    const template = this._templates.get(templateId);
    if (!template) throw new Error(`Template not found: ${templateId}`);
    if (!template.enabled) throw new Error(`Template is disabled: ${templateId}`);

    let body = template.body;
    let subject = template.subject;
    for (const [key, value] of Object.entries(variables)) {
      body = body.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
      if (subject) subject = subject.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
    }

    return this.send({
      channel: template.channel,
      recipient,
      subject,
      body,
      templateId,
      priority: options?.priority,
      category: options?.category,
      sender: options?.sender,
    });
  }

  sendBroadcast(channel: NotificationChannel, recipients: string[], subject: string, body: string, options?: {
    priority?: NotificationPriority;
    category?: string;
  }): NotificationMessage[] {
    return recipients.map(r => this.send({ channel, recipient: r, subject, body, ...options }));
  }

  // ── Message Management ──

  getMessage(id: string): NotificationMessage | undefined {
    return this._messages.get(id);
  }

  getMessagesByRecipient(recipient: string, limit?: number): NotificationMessage[] {
    const msgs = [...this._messages.values()].filter(m => m.recipient === recipient);
    return limit ? msgs.slice(0, limit) : msgs;
  }

  getMessagesByStatus(status: NotificationStatus): NotificationMessage[] {
    return [...this._messages.values()].filter(m => m.status === status);
  }

  markDelivered(id: string): NotificationMessage {
    const msg = this._messages.get(id);
    if (!msg) throw new Error(`Message not found: ${id}`);
    msg.status = 'delivered';
    msg.deliveredAt = new Date().toISOString();
    msg.updatedAt = msg.deliveredAt;
    this._onDelivered?.(msg);
    return msg;
  }

  markFailed(id: string, reason: string): NotificationMessage {
    const msg = this._messages.get(id);
    if (!msg) throw new Error(`Message not found: ${id}`);
    msg.status = 'failed';
    msg.failedAt = new Date().toISOString();
    msg.failureReason = reason;
    msg.updatedAt = msg.failedAt;
    this._onFailed?.(msg);
    return msg;
  }

  retry(id: string): NotificationMessage {
    const msg = this._messages.get(id);
    if (!msg) throw new Error(`Message not found: ${id}`);
    if (msg.attempts >= msg.maxAttempts) throw new Error('Max retries exceeded');
    msg.attempts++;
    msg.status = 'sent';
    msg.sentAt = new Date().toISOString();
    msg.updatedAt = msg.sentAt;
    msg.failureReason = undefined;
    this._onSent?.(msg);
    return msg;
  }

  cancel(id: string): NotificationMessage {
    const msg = this._messages.get(id);
    if (!msg) throw new Error(`Message not found: ${id}`);
    msg.status = 'cancelled';
    msg.updatedAt = new Date().toISOString();
    return msg;
  }

  get allMessages(): NotificationMessage[] {
    return [...this._messages.values()];
  }

  get messageCount(): number {
    return this._messages.size;
  }

  get pendingCount(): number {
    return [...this._messages.values()].filter(m => m.status === 'pending').length;
  }

  get deliveredCount(): number {
    return [...this._messages.values()].filter(m => m.status === 'delivered').length;
  }

  get failedCount(): number {
    return [...this._messages.values()].filter(m => m.status === 'failed').length;
  }

  getStats(): {
    total: number;
    pending: number;
    sent: number;
    delivered: number;
    failed: number;
    cancelled: number;
    byChannel: Record<string, number>;
  } {
    const msgs = [...this._messages.values()];
    const byChannel: Record<string, number> = {};
    for (const m of msgs) {
      byChannel[m.channel] = (byChannel[m.channel] ?? 0) + 1;
    }
    return {
      total: msgs.length,
      pending: msgs.filter(m => m.status === 'pending').length,
      sent: msgs.filter(m => m.status === 'sent').length,
      delivered: msgs.filter(m => m.status === 'delivered').length,
      failed: msgs.filter(m => m.status === 'failed').length,
      cancelled: msgs.filter(m => m.status === 'cancelled').length,
      byChannel,
    };
  }

  // ── Events ──

  onSent(cb: (msg: NotificationMessage) => void): void { this._onSent = cb; }
  onDelivered(cb: (msg: NotificationMessage) => void): void { this._onDelivered = cb; }
  onFailed(cb: (msg: NotificationMessage) => void): void { this._onFailed = cb; }
}
