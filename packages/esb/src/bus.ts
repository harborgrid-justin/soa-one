// ============================================================
// SOA One ESB — ServiceBus (Main Orchestrator)
// ============================================================
//
// The ServiceBus is the central orchestrator that ties together
// all ESB subsystems: channels, routing, transformation,
// middleware, protocol mediation, resilience, sagas, metrics,
// security, validation, and scheduling.
//
// Provides a unified API for:
// - Sending and receiving messages
// - Channel management
// - Route management
// - Endpoint management
// - Saga orchestration
// - Metrics and monitoring
// - Lifecycle management (init/shutdown)
//
// 100% compatible with @soa-one/engine SDK via the ESB plugin.
// ============================================================

import type {
  ESBMessage,
  ESBConfig,
  ChannelConfig,
  Route,
  EndpointConfig,
  TransformationPipeline,
  TransformerConfig,
  MessageHandler,
  MessageFilter,
  ESBMetrics,
  ESBEvent,
  ESBEventType,
  ESBEventListener,
  SecurityContext,
  SagaDefinition,
  ScheduledDelivery,
  SecurityPolicy,
  ValidationConfig,
  MessageSchema,
  MediationRule,
  MiddlewareFunction,
  MiddlewareDefinition,
  ErrorHandlerConfig,
} from './types';

import {
  MessageChannel,
  ChannelManager,
  createMessage,
  generateId,
} from './channel';
import { MessageRouter, type RouteMatch } from './router';
import { MessageTransformer } from './transformer';
import {
  Splitter,
  Aggregator,
  ContentFilter,
  ContentEnricher,
  ScatterGather,
  Resequencer,
  ClaimCheck,
  WireTap,
  IdempotentConsumer,
  Normalizer,
} from './patterns';
import {
  CircuitBreaker,
  RetryExecutor,
  Bulkhead,
  TimeoutExecutor,
  RateLimiter,
} from './resilience';
import {
  MiddlewarePipeline,
  createCorrelationMiddleware,
  createTimestampMiddleware,
} from './middleware';
import { ProtocolMediator } from './mediator';
import { CorrelationEngine } from './correlation';
import { SagaCoordinator, type SagaStepExecutor, type SagaStepCompensator } from './saga';
import { MetricCollector } from './metrics';
import { SecurityGuard } from './security';
import { SchemaValidator } from './validator';
import { MessageScheduler } from './scheduler';

// ── ServiceBus ────────────────────────────────────────────────

/**
 * Central Enterprise Service Bus orchestrator.
 *
 * Usage:
 * ```ts
 * const bus = new ServiceBus({
 *   name: 'my-esb',
 *   channels: [{ name: 'orders', type: 'publish-subscribe' }],
 *   metricsEnabled: true,
 * });
 * await bus.init();
 *
 * bus.subscribe('orders', 'order-processor', async (msg) => {
 *   console.log('Received order:', msg.body);
 * });
 *
 * await bus.send('orders', { orderId: '123', total: 99.99 });
 * await bus.shutdown();
 * ```
 */
export class ServiceBus {
  readonly name: string;
  private readonly _config: ESBConfig;

  // Subsystems
  private readonly _channelManager: ChannelManager;
  private readonly _router: MessageRouter;
  private readonly _transformer: MessageTransformer;
  private readonly _middleware: MiddlewarePipeline;
  private readonly _mediator: ProtocolMediator;
  private readonly _sagaCoordinator: SagaCoordinator;
  private readonly _metrics: MetricCollector;
  private readonly _scheduler: MessageScheduler;
  private _securityGuard?: SecurityGuard;
  private _schemaValidator?: SchemaValidator;

  // Endpoints
  private _endpoints: Map<string, EndpointConfig> = new Map();

  // Event listeners
  private _eventListeners: Map<string, ESBEventListener[]> = new Map();

  // State
  private _initialized = false;
  private _destroyed = false;

  constructor(config: ESBConfig) {
    this.name = config.name;
    this._config = config;

    // Initialize subsystems
    this._channelManager = new ChannelManager();
    this._router = new MessageRouter(config.routing);
    this._transformer = new MessageTransformer();
    this._middleware = new MiddlewarePipeline();
    this._mediator = new ProtocolMediator();
    this._sagaCoordinator = new SagaCoordinator();
    this._metrics = new MetricCollector();
    this._scheduler = new MessageScheduler();

    // Security
    if (config.security) {
      this._securityGuard = new SecurityGuard(config.security);
    }

    // Validation
    if (config.validation) {
      this._schemaValidator = new SchemaValidator(config.validation);
    }

    // Register default middleware
    this._middleware.use(createCorrelationMiddleware());
    this._middleware.use(createTimestampMiddleware());

    // Set up scheduler delivery handler
    this._scheduler.onDelivery(async (schedule) => {
      await this.send(schedule.destination, schedule.message.body, {
        headers: schedule.message.headers,
        priority: schedule.message.priority,
        correlationId: schedule.message.correlationId,
      });
    });
  }

  // ── Lifecycle ─────────────────────────────────────────────

  /**
   * Initialize the service bus: create configured channels
   * and endpoints.
   */
  async init(): Promise<void> {
    if (this._initialized) return;
    if (this._destroyed) {
      throw new Error('Cannot init a destroyed ServiceBus. Create a new instance.');
    }

    // Create configured channels
    if (this._config.channels) {
      for (const channelConfig of this._config.channels) {
        this._channelManager.createChannel(channelConfig);
      }
    }

    // Register configured endpoints
    if (this._config.endpoints) {
      for (const endpoint of this._config.endpoints) {
        this._endpoints.set(endpoint.name, endpoint);
      }
    }

    this._initialized = true;
    this._emitEvent('bus:started', 'ServiceBus');
  }

  /**
   * Shut down the service bus: destroy all channels, cancel
   * schedules, and clean up resources.
   */
  async shutdown(): Promise<void> {
    if (this._destroyed) return;

    this._emitEvent('bus:stopped', 'ServiceBus');

    this._channelManager.destroyAll();
    this._scheduler.destroy();
    this._middleware.clear();

    this._initialized = false;
    this._destroyed = true;
  }

  /** Whether the bus is initialized. */
  get isInitialized(): boolean {
    return this._initialized;
  }

  /** Whether the bus has been shut down. */
  get isDestroyed(): boolean {
    return this._destroyed;
  }

  // ── Messaging ─────────────────────────────────────────────

  /**
   * Send a message to a channel.
   * The message flows through middleware, validation, security,
   * and routing before delivery.
   */
  async send<T = any>(
    channelName: string,
    body: T,
    options: Partial<ESBMessage<T>> = {},
  ): Promise<ESBMessage<T>> {
    this._ensureInitialized();

    const message = createMessage(body, {
      ...options,
      headers: {
        ...options.headers,
        destination: channelName,
      },
    }) as ESBMessage<T>;

    return this.sendMessage(channelName, message);
  }

  /**
   * Send a pre-constructed message to a channel.
   */
  async sendMessage<T = any>(
    channelName: string,
    message: ESBMessage<T>,
  ): Promise<ESBMessage<T>> {
    this._ensureInitialized();

    const start = Date.now();
    this._metrics.setGauge('messages.in_flight', 1);

    try {
      let processedMessage: ESBMessage = message as ESBMessage;

      // 1. Run middleware pipeline
      const ctx = await this._middleware.execute(processedMessage, {
        destinationChannel: channelName,
      });

      if (ctx.abort) {
        this._metrics.incrementCounter('messages.failed');
        throw new Error(`Message processing aborted: ${ctx.abortReason}`);
      }
      processedMessage = ctx.message;

      // 2. Validate outbound message
      if (this._schemaValidator && this._schemaValidator.shouldValidate('outbound')) {
        const validation = this._schemaValidator.validate(processedMessage);
        if (!validation.valid) {
          const errorMsg = validation.errors.map((e) => e.message).join('; ');
          if (this._schemaValidator.onFailure === 'reject') {
            this._metrics.incrementCounter('messages.failed');
            throw new Error(`Validation failed: ${errorMsg}`);
          }
          if (this._schemaValidator.onFailure === 'dead-letter') {
            const dlq = this._channelManager.getChannel('dead-letter');
            if (dlq) {
              processedMessage.metadata.validationErrors = validation.errors;
              await dlq.send(processedMessage);
            }
            return message;
          }
          // log-and-continue: continue processing
        }
      }

      // 3. Apply security
      if (this._securityGuard) {
        processedMessage = this._securityGuard.enforceOutbound(processedMessage);
      }

      // 4. Route the message
      const destinations = this._resolveDestinations(channelName, processedMessage);

      // 5. Deliver to each destination (auto-create channels on demand)
      for (const dest of destinations) {
        const channel = this._channelManager.getChannel(dest)
          ?? this._channelManager.createChannel({ name: dest, type: 'point-to-point' });
        await channel.send(processedMessage);
        this._emitEvent('message:sent', dest, { messageId: processedMessage.id });
      }

      // 6. Record metrics
      const latency = Date.now() - start;
      this._metrics.incrementCounter('messages.processed');
      this._metrics.recordHistogram('message.processing.latency', latency);
      this._metrics.recordThroughput();

      return message;
    } catch (error: any) {
      this._metrics.incrementCounter('messages.failed');
      this._emitEvent('message:failed', channelName, {
        messageId: message.id,
        error: error.message,
      });
      throw error;
    } finally {
      this._metrics.setGauge('messages.in_flight', 0);
    }
  }

  /**
   * Subscribe to messages on a channel.
   */
  subscribe(
    channelName: string,
    subscriberId: string,
    handler: MessageHandler,
    filter?: MessageFilter,
  ): string {
    this._ensureInitialized();
    const channel = this._getOrCreateChannel(channelName, 'publish-subscribe');
    return channel.subscribe(subscriberId, handler, filter);
  }

  /**
   * Unsubscribe from a channel.
   */
  unsubscribe(channelName: string, subscriptionId: string): boolean {
    const channel = this._channelManager.getChannel(channelName);
    if (channel) {
      return channel.unsubscribe(subscriptionId);
    }
    return false;
  }

  /**
   * Add a consumer to a point-to-point channel.
   */
  addConsumer(channelName: string, handler: MessageHandler): void {
    this._ensureInitialized();
    const channel = this._getOrCreateChannel(channelName, 'point-to-point');
    channel.addConsumer(handler);
  }

  /**
   * Receive a message from a channel (pull-based).
   */
  receive(channelName: string): ESBMessage | undefined {
    const channel = this._channelManager.getChannel(channelName);
    return channel?.receive();
  }

  /**
   * Send a request and wait for a reply.
   */
  async request<T = any>(
    channelName: string,
    body: T,
    timeoutMs: number = 30_000,
  ): Promise<ESBMessage | undefined> {
    this._ensureInitialized();

    const replyChannelName = `reply-${generateId()}`;
    const replyChannel = this._channelManager.getOrCreate({
      name: replyChannelName,
      type: 'request-reply',
    });
    const requestChannel = this._getOrCreateChannel(channelName, 'request-reply');

    const message = createMessage(body, {
      replyTo: replyChannelName,
      correlationId: generateId(),
    });

    const reply = await requestChannel.request(message, replyChannel, timeoutMs);

    // Clean up reply channel
    this._channelManager.removeChannel(replyChannelName);

    return reply;
  }

  // ── Channel Management ────────────────────────────────────

  /** Create a channel. */
  createChannel(config: ChannelConfig): MessageChannel {
    return this._channelManager.createChannel(config);
  }

  /** Get a channel by name. */
  getChannel(name: string): MessageChannel | undefined {
    return this._channelManager.getChannel(name);
  }

  /** Remove a channel. */
  removeChannel(name: string): boolean {
    return this._channelManager.removeChannel(name);
  }

  /** List all channel names. */
  get channelNames(): string[] {
    return this._channelManager.channelNames;
  }

  // ── Route Management ──────────────────────────────────────

  /** Add a route. */
  addRoute(route: Route): void {
    this._router.addRoute(route);
  }

  /** Remove a route. */
  removeRoute(routeId: string): boolean {
    return this._router.removeRoute(routeId);
  }

  /** Get all routes. */
  get routes(): Route[] {
    return this._router.routes;
  }

  // ── Endpoint Management ───────────────────────────────────

  /** Register an endpoint. */
  registerEndpoint(config: EndpointConfig): void {
    this._endpoints.set(config.name, config);
  }

  /** Get an endpoint config. */
  getEndpoint(name: string): EndpointConfig | undefined {
    return this._endpoints.get(name);
  }

  /** List all endpoint names. */
  get endpointNames(): string[] {
    return Array.from(this._endpoints.keys());
  }

  // ── Transformation ────────────────────────────────────────

  /** Transform a message using a pipeline. */
  transform(
    message: ESBMessage,
    pipeline: TransformationPipeline,
  ): ESBMessage {
    return this._transformer.executePipeline(message, pipeline);
  }

  /** Apply a single transformation step. */
  applyTransform(
    message: ESBMessage,
    step: TransformerConfig,
  ): ESBMessage {
    return this._transformer.applyTransform(message, step);
  }

  /** Register a custom transform function. */
  registerTransformFunction(
    name: string,
    fn: (value: any) => any,
  ): void {
    this._transformer.registerFunction(name, fn);
  }

  // ── Middleware ─────────────────────────────────────────────

  /** Add middleware to the processing pipeline. */
  useMiddleware(definition: MiddlewareDefinition): void {
    this._middleware.use(definition);
  }

  /** Add a named middleware function. */
  addMiddleware(
    name: string,
    handler: MiddlewareFunction,
    order?: number,
  ): void {
    this._middleware.add(name, handler, order);
  }

  // ── Protocol Mediation ────────────────────────────────────

  /** Add a mediation rule. */
  addMediationRule(rule: MediationRule): void {
    this._mediator.addRule(rule);
  }

  /** Access the protocol mediator. */
  get mediator(): ProtocolMediator {
    return this._mediator;
  }

  // ── Saga Orchestration ────────────────────────────────────

  /** Register a saga. */
  registerSaga(
    definition: SagaDefinition,
    stepHandlers: Record<
      string,
      { execute: SagaStepExecutor; compensate: SagaStepCompensator }
    >,
  ): void {
    this._sagaCoordinator.registerSaga(definition, stepHandlers);
  }

  /** Execute a saga. */
  async executeSaga(
    sagaId: string,
    initialData?: Record<string, any>,
    metadata?: Record<string, any>,
  ) {
    return this._sagaCoordinator.execute(sagaId, initialData, metadata);
  }

  /** Access the saga coordinator. */
  get sagas(): SagaCoordinator {
    return this._sagaCoordinator;
  }

  // ── Validation ────────────────────────────────────────────

  /** Register a message schema. */
  registerSchema(messageType: string, schema: MessageSchema): void {
    if (!this._schemaValidator) {
      this._schemaValidator = new SchemaValidator({
        validateInbound: true,
        validateOutbound: true,
        onFailure: 'reject',
        schemas: {},
      });
    }
    this._schemaValidator.registerSchema(messageType, schema);
  }

  // ── Scheduling ────────────────────────────────────────────

  /** Schedule a delayed message delivery. */
  scheduleMessage(
    channelName: string,
    body: any,
    delayMs: number,
    options: Partial<ESBMessage> = {},
  ): string {
    const message = createMessage(body, options);
    return this._scheduler.scheduleDelayed(message, channelName, delayMs);
  }

  /** Schedule a recurring message. */
  scheduleRecurring(
    channelName: string,
    body: any,
    cronExpression: string,
    options: Partial<ESBMessage> = {},
    maxDeliveries: number = 0,
  ): string {
    const message = createMessage(body, options);
    return this._scheduler.scheduleRecurring(
      message,
      channelName,
      cronExpression,
      maxDeliveries,
    );
  }

  /** Cancel a scheduled delivery. */
  cancelSchedule(scheduleId: string): boolean {
    return this._scheduler.cancel(scheduleId);
  }

  /** Access the scheduler. */
  get scheduler(): MessageScheduler {
    return this._scheduler;
  }

  // ── Metrics ───────────────────────────────────────────────

  /** Get a snapshot of ESB metrics. */
  getMetrics(): ESBMetrics {
    const channelDepths: Record<string, number> = {};
    for (const channel of this._channelManager.channels) {
      channelDepths[channel.name] = channel.depth;
    }

    return this._metrics.buildSnapshot({
      channelDepths,
      activeSagas: this._sagaCoordinator.getInstancesByStatus('running').length,
    });
  }

  /** Access the metric collector. */
  get metrics(): MetricCollector {
    return this._metrics;
  }

  // ── Events ────────────────────────────────────────────────

  /** Subscribe to ESB events. */
  on(eventType: ESBEventType, listener: ESBEventListener): void {
    if (!this._eventListeners.has(eventType)) {
      this._eventListeners.set(eventType, []);
    }
    this._eventListeners.get(eventType)!.push(listener);
  }

  /** Unsubscribe from ESB events. */
  off(eventType: ESBEventType, listener: ESBEventListener): void {
    const listeners = this._eventListeners.get(eventType);
    if (listeners) {
      const idx = listeners.indexOf(listener);
      if (idx >= 0) listeners.splice(idx, 1);
    }
  }

  // ── Access to Subsystems ──────────────────────────────────

  /** Access the channel manager. */
  get channelManager(): ChannelManager {
    return this._channelManager;
  }

  /** Access the message router. */
  get router(): MessageRouter {
    return this._router;
  }

  /** Access the message transformer. */
  get transformer(): MessageTransformer {
    return this._transformer;
  }

  /** Access the middleware pipeline. */
  get middlewarePipeline(): MiddlewarePipeline {
    return this._middleware;
  }

  /** Access the security guard. */
  get security(): SecurityGuard | undefined {
    return this._securityGuard;
  }

  /** Access the schema validator. */
  get validator(): SchemaValidator | undefined {
    return this._schemaValidator;
  }

  // ── Private ───────────────────────────────────────────────

  private _ensureInitialized(): void {
    if (!this._initialized) {
      throw new Error('ServiceBus is not initialized. Call init() first.');
    }
    if (this._destroyed) {
      throw new Error('ServiceBus has been destroyed. Create a new instance.');
    }
  }

  private _getOrCreateChannel(
    name: string,
    defaultType: 'point-to-point' | 'publish-subscribe' | 'request-reply',
  ): MessageChannel {
    let channel = this._channelManager.getChannel(name);
    if (!channel) {
      channel = this._channelManager.createChannel({
        name,
        type: defaultType,
      });
    }
    return channel;
  }

  private _resolveDestinations(
    targetChannel: string,
    message: ESBMessage,
  ): string[] {
    // Try routing table first
    const routedDestinations = this._router.resolve(message);
    if (routedDestinations.length > 0) {
      return routedDestinations;
    }
    // Default: deliver to the specified channel
    return [targetChannel];
  }

  private _emitEvent(
    type: ESBEventType,
    source: string,
    data?: Record<string, any>,
  ): void {
    const event: ESBEvent = {
      type,
      timestamp: new Date().toISOString(),
      source,
      data,
    };

    const listeners = this._eventListeners.get(type);
    if (listeners) {
      for (const listener of listeners) {
        try {
          listener(event);
        } catch {
          // Swallow listener errors
        }
      }
    }
  }
}
