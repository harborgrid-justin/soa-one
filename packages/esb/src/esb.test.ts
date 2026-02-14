// ============================================================
// SOA One ESB — Comprehensive Tests
// ============================================================

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  // Core
  ServiceBus,
  createMessage,
  generateId,
  resolvePath,
  evaluateRoutingOperator,

  // Channels
  MessageChannel,
  ChannelManager,

  // Router
  MessageRouter,

  // Transformer
  MessageTransformer,
  builtInTransformFunctions,
  setPath,
  deletePath,

  // Patterns
  Splitter,
  Aggregator,
  ContentFilter,
  ContentEnricher,
  ClaimCheck,
  WireTap,
  IdempotentConsumer,

  // Resilience
  CircuitBreaker,
  CircuitBreakerOpenError,
  RetryExecutor,
  Bulkhead,
  BulkheadFullError,
  TimeoutExecutor,
  TimeoutError,
  RateLimiter,
  ResilienceBuilder,

  // Middleware
  MiddlewarePipeline,
  createCorrelationMiddleware,
  createBreadcrumbMiddleware,
  createTimestampMiddleware,
  createSizeLimitMiddleware,

  // Mediation
  ProtocolMediator,
  RestProtocolAdapter,
  SoapProtocolAdapter,

  // Correlation
  CorrelationEngine,

  // Saga
  SagaCoordinator,

  // Metrics
  MetricCollector,

  // Security
  MessageSigner,
  SecurityGuard,
  SecurityViolationError,

  // Validation
  SchemaValidator,

  // Scheduling
  parseCronExpression,
  matchesCron,
  MessageScheduler,

  // Plugin
  createESBPlugin,
} from './index';

import type {
  ESBMessage,
  Route,
  RoutingCondition,
  RoutingConditionGroup,
  SagaDefinition,
  MessageSchema,
} from './types';

// ── Helpers ───────────────────────────────────────────────────

function createTestMessage(body: any = { test: true }, overrides: Partial<ESBMessage> = {}): ESBMessage {
  return createMessage(body, {
    headers: { messageType: 'test', source: 'unit-test' },
    ...overrides,
  });
}

// ════════════════════════════════════════════════════════════
// MESSAGE & CHANNEL TESTS
// ════════════════════════════════════════════════════════════

describe('createMessage', () => {
  it('creates a message with defaults', () => {
    const msg = createMessage({ hello: 'world' });
    assert.ok(msg.id);
    assert.ok(msg.timestamp);
    assert.equal(msg.priority, 'normal');
    assert.equal(msg.contentType, 'application/json');
    assert.deepEqual(msg.body, { hello: 'world' });
  });

  it('accepts overrides', () => {
    const msg = createMessage({ data: 1 }, {
      priority: 'high',
      correlationId: 'corr-123',
    });
    assert.equal(msg.priority, 'high');
    assert.equal(msg.correlationId, 'corr-123');
  });
});

describe('generateId', () => {
  it('generates unique IDs', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 100; i++) ids.add(generateId());
    assert.equal(ids.size, 100);
  });
});

describe('resolvePath', () => {
  it('resolves nested paths', () => {
    assert.equal(resolvePath({ a: { b: { c: 42 } } }, 'a.b.c'), 42);
  });

  it('returns undefined for missing paths', () => {
    assert.equal(resolvePath({ a: 1 }, 'b.c'), undefined);
  });

  it('handles null intermediates', () => {
    assert.equal(resolvePath({ a: null }, 'a.b'), undefined);
  });
});

describe('evaluateRoutingOperator', () => {
  it('equals', () => {
    assert.ok(evaluateRoutingOperator(5, 'equals', 5));
    assert.ok(!evaluateRoutingOperator(5, 'equals', 6));
  });

  it('greaterThan', () => {
    assert.ok(evaluateRoutingOperator(10, 'greaterThan', 5));
    assert.ok(!evaluateRoutingOperator(3, 'greaterThan', 5));
  });

  it('contains', () => {
    assert.ok(evaluateRoutingOperator('hello world', 'contains', 'world'));
    assert.ok(evaluateRoutingOperator([1, 2, 3], 'contains', 2));
  });

  it('in', () => {
    assert.ok(evaluateRoutingOperator('b', 'in', ['a', 'b', 'c']));
    assert.ok(!evaluateRoutingOperator('d', 'in', ['a', 'b', 'c']));
  });

  it('matches (regex)', () => {
    assert.ok(evaluateRoutingOperator('order-123', 'matches', 'order-\\d+'));
    assert.ok(!evaluateRoutingOperator('item-abc', 'matches', 'order-\\d+'));
  });

  it('exists / notExists', () => {
    assert.ok(evaluateRoutingOperator('value', 'exists', undefined));
    assert.ok(!evaluateRoutingOperator(null, 'exists', undefined));
    assert.ok(evaluateRoutingOperator(null, 'notExists', undefined));
  });

  it('startsWith / endsWith', () => {
    assert.ok(evaluateRoutingOperator('hello', 'startsWith', 'hel'));
    assert.ok(evaluateRoutingOperator('hello', 'endsWith', 'llo'));
  });
});

describe('MessageChannel', () => {
  it('point-to-point with consumer', async () => {
    const channel = new MessageChannel({ name: 'test', type: 'point-to-point' });
    const received: ESBMessage[] = [];
    channel.addConsumer(async (msg) => { received.push(msg); });

    const msg = createTestMessage({ order: 1 });
    await channel.send(msg);

    assert.equal(received.length, 1);
    assert.deepEqual(received[0].body, { order: 1 });
  });

  it('pub/sub delivers to all subscribers', async () => {
    const channel = new MessageChannel({ name: 'events', type: 'publish-subscribe' });
    const sub1: ESBMessage[] = [];
    const sub2: ESBMessage[] = [];

    channel.subscribe('s1', async (msg) => { sub1.push(msg); });
    channel.subscribe('s2', async (msg) => { sub2.push(msg); });

    await channel.send(createTestMessage({ event: 'click' }));

    assert.equal(sub1.length, 1);
    assert.equal(sub2.length, 1);
  });

  it('backpressure rejects when full', async () => {
    const channel = new MessageChannel({ name: 'small', type: 'point-to-point', maxSize: 2 });

    await channel.send(createTestMessage({ n: 1 }));
    await channel.send(createTestMessage({ n: 2 }));
    const result = await channel.send(createTestMessage({ n: 3 }));

    assert.equal(result, false); // Rejected
    assert.equal(channel.depth, 2);
  });

  it('deduplication rejects duplicate messages', async () => {
    const channel = new MessageChannel({
      name: 'dedup',
      type: 'point-to-point',
      deduplication: true,
      deduplicationWindowMs: 10_000,
    });

    const msg = createTestMessage({ data: 1 });
    await channel.send(msg);
    const result = await channel.send(msg); // Same ID

    assert.equal(result, false);
    assert.equal(channel.depth, 1);
  });

  it('pull-based receive', async () => {
    const channel = new MessageChannel({ name: 'pull', type: 'point-to-point' });
    await channel.send(createTestMessage({ n: 1 }));
    await channel.send(createTestMessage({ n: 2 }));

    const msg1 = channel.receive();
    assert.deepEqual(msg1?.body, { n: 1 });

    const msg2 = channel.receive();
    assert.deepEqual(msg2?.body, { n: 2 });

    assert.equal(channel.receive(), undefined);
  });

  it('pause and resume', async () => {
    const channel = new MessageChannel({ name: 'pausable', type: 'point-to-point' });

    channel.pause();
    const result = await channel.send(createTestMessage());
    assert.equal(result, false);

    channel.resume();
    const result2 = await channel.send(createTestMessage());
    assert.equal(result2, true);
  });

  it('priority channel sorts by priority', async () => {
    const channel = new MessageChannel({ name: 'prio', type: 'priority' });

    await channel.send(createMessage({ n: 1 }, { priority: 'low' }));
    await channel.send(createMessage({ n: 2 }, { priority: 'highest' }));
    await channel.send(createMessage({ n: 3 }, { priority: 'normal' }));

    const first = channel.receive();
    assert.equal(first?.body.n, 2); // highest priority first
  });

  it('metrics tracking', async () => {
    const channel = new MessageChannel({ name: 'metrics', type: 'point-to-point' });
    await channel.send(createTestMessage());
    await channel.send(createTestMessage());

    const metrics = channel.metrics;
    assert.equal(metrics.messagesIn, 2);
    assert.equal(metrics.queueDepth, 2);
  });
});

describe('ChannelManager', () => {
  it('creates and retrieves channels', () => {
    const mgr = new ChannelManager();
    mgr.createChannel({ name: 'ch1', type: 'point-to-point' });
    mgr.createChannel({ name: 'ch2', type: 'publish-subscribe' });

    assert.ok(mgr.getChannel('ch1'));
    assert.ok(mgr.getChannel('ch2'));
    assert.deepEqual(mgr.channelNames.sort(), ['ch1', 'ch2']);
  });

  it('throws on duplicate channel names', () => {
    const mgr = new ChannelManager();
    mgr.createChannel({ name: 'ch1', type: 'point-to-point' });
    assert.throws(() => mgr.createChannel({ name: 'ch1', type: 'point-to-point' }));
  });
});

// ════════════════════════════════════════════════════════════
// ROUTER TESTS
// ════════════════════════════════════════════════════════════

describe('MessageRouter', () => {
  it('content-based routing', () => {
    const router = new MessageRouter();
    router.addRoute({
      id: 'r1',
      name: 'High-value orders',
      source: 'orders',
      destinations: ['premium-processing'],
      condition: {
        field: 'total',
        source: 'body',
        operator: 'greaterThan',
        value: 1000,
      },
      priority: 10,
      enabled: true,
    });
    router.addRoute({
      id: 'r2',
      name: 'Standard orders',
      source: 'orders',
      destinations: ['standard-processing'],
      condition: {
        field: 'total',
        source: 'body',
        operator: 'lessThanOrEqual',
        value: 1000,
      },
      priority: 5,
      enabled: true,
    });

    const highValue = createMessage({ total: 5000 });
    const lowValue = createMessage({ total: 50 });

    const highMatches = router.evaluate(highValue);
    assert.equal(highMatches[0].destinations[0], 'premium-processing');

    const lowMatches = router.evaluate(lowValue);
    assert.equal(lowMatches[0].destinations[0], 'standard-processing');
  });

  it('header-based routing', () => {
    const router = new MessageRouter({ routes: [], strategy: 'header-based' });
    router.addRoute({
      id: 'r1',
      name: 'Tenant A',
      source: 'input',
      destinations: ['tenant-a'],
      condition: {
        field: 'tenantId',
        source: 'headers',
        operator: 'equals',
        value: 'tenant-a',
      },
      priority: 10,
      enabled: true,
    });

    const msg = createMessage({}, {
      headers: { tenantId: 'tenant-a' },
    });
    const matches = router.evaluate(msg);
    assert.equal(matches.length, 1);
    assert.equal(matches[0].destinations[0], 'tenant-a');
  });

  it('multicast routing', () => {
    const router = new MessageRouter({ routes: [], strategy: 'multicast' });
    router.addRoute({
      id: 'r1', name: 'A', source: '', destinations: ['ch-a'],
      priority: 10, enabled: true,
    });
    router.addRoute({
      id: 'r2', name: 'B', source: '', destinations: ['ch-b'],
      priority: 5, enabled: true,
    });

    const matches = router.evaluate(createTestMessage());
    assert.equal(matches.length, 2); // All routes match
  });

  it('resolve returns unique destinations', () => {
    const router = new MessageRouter();
    router.addRoute({
      id: 'r1', name: 'A', source: '', destinations: ['dest'],
      priority: 10, enabled: true,
    });

    const destinations = router.resolve(createTestMessage());
    assert.deepEqual(destinations, ['dest']);
  });

  it('default destination when no match', () => {
    const router = new MessageRouter();
    router.defaultDestination = 'fallback';

    const destinations = router.resolve(createTestMessage());
    assert.deepEqual(destinations, ['fallback']);
  });

  it('AND/OR condition groups', () => {
    const router = new MessageRouter();
    router.addRoute({
      id: 'r1',
      name: 'Complex',
      source: '',
      destinations: ['matched'],
      condition: {
        logic: 'AND',
        conditions: [
          { field: 'type', source: 'body', operator: 'equals', value: 'order' },
          {
            logic: 'OR',
            conditions: [
              { field: 'total', source: 'body', operator: 'greaterThan', value: 100 },
              { field: 'priority', source: 'body', operator: 'equals', value: 'rush' },
            ],
          },
        ],
      } as RoutingConditionGroup,
      priority: 10,
      enabled: true,
    });

    const match = createMessage({ type: 'order', total: 200 });
    const noMatch = createMessage({ type: 'order', total: 50 });

    assert.equal(router.evaluate(match).length, 1);
    assert.equal(router.evaluate(noMatch).length, 0);
  });
});

// ════════════════════════════════════════════════════════════
// TRANSFORMER TESTS
// ════════════════════════════════════════════════════════════

describe('MessageTransformer', () => {
  let transformer: MessageTransformer;

  beforeEach(() => {
    transformer = new MessageTransformer();
  });

  it('map transform with field mappings', () => {
    const msg = createMessage({ firstName: 'John', lastName: 'Doe', age: 30 });
    const result = transformer.applyTransform(msg, {
      type: 'map',
      name: 'rename-fields',
      config: {
        mappings: [
          { source: 'firstName', target: 'first_name' },
          { source: 'lastName', target: 'last_name' },
          { source: 'age', target: 'user_age' },
        ],
      },
    });

    assert.equal(result.body.first_name, 'John');
    assert.equal(result.body.last_name, 'Doe');
    assert.equal(result.body.user_age, 30);
  });

  it('map transform with functions', () => {
    const msg = createMessage({ name: '  Hello World  ' });
    const result = transformer.applyTransform(msg, {
      type: 'map',
      name: 'trim',
      config: {
        mappings: [
          { source: 'name', target: 'name', transform: 'trim' },
        ],
        preserveUnmapped: true,
      },
    });

    assert.equal(result.body.name, 'Hello World');
  });

  it('template transform', () => {
    const msg = createMessage({
      first: 'John',
      last: 'Doe',
    });
    const result = transformer.applyTransform(msg, {
      type: 'template',
      name: 'greeting',
      config: {
        template: {
          fullName: '{{first}} {{last}}',
          greeting: 'Hello {{first}}!',
        },
      },
    });

    assert.equal(result.body.fullName, 'John Doe');
    assert.equal(result.body.greeting, 'Hello John!');
  });

  it('rename transform', () => {
    const msg = createMessage({ old_name: 'value' });
    const result = transformer.applyTransform(msg, {
      type: 'rename',
      name: 'rename',
      config: { renames: { old_name: 'new_name' } },
    });

    assert.equal(result.body.new_name, 'value');
    assert.equal(result.body.old_name, undefined);
  });

  it('remove transform', () => {
    const msg = createMessage({ keep: 1, remove: 2 });
    const result = transformer.applyTransform(msg, {
      type: 'remove',
      name: 'cleanup',
      config: { fields: ['remove'] },
    });

    assert.equal(result.body.keep, 1);
    assert.equal(result.body.remove, undefined);
  });

  it('flatten transform', () => {
    const msg = createMessage({ a: { b: { c: 1 } }, d: 2 });
    const result = transformer.applyTransform(msg, {
      type: 'flatten',
      name: 'flat',
      config: {},
    });

    assert.equal(result.body['a.b.c'], 1);
    assert.equal(result.body.d, 2);
  });

  it('unflatten transform', () => {
    const msg = createMessage({ 'a.b.c': 1, 'd': 2 });
    const result = transformer.applyTransform(msg, {
      type: 'unflatten',
      name: 'unflat',
      config: {},
    });

    assert.equal(result.body.a.b.c, 1);
    assert.equal(result.body.d, 2);
  });

  it('pipeline execution', () => {
    const msg = createMessage({ name: '  John  ', age: '25' });
    const result = transformer.executePipeline(msg, {
      name: 'cleanup',
      steps: [
        {
          type: 'map',
          name: 'trim-name',
          config: {
            mappings: [
              { source: 'name', target: 'name', transform: 'trim' },
              { source: 'age', target: 'age', transform: 'toNumber' },
            ],
            preserveUnmapped: true,
          },
        },
      ],
      stopOnError: true,
    });

    assert.equal(result.body.name, 'John');
    assert.equal(result.body.age, 25);
  });

  it('does not mutate original message', () => {
    const msg = createMessage({ name: 'original' });
    transformer.applyTransform(msg, {
      type: 'map',
      name: 'remap',
      config: {
        mappings: [{ source: 'name', target: 'label' }],
      },
    });

    assert.equal(msg.body.name, 'original');
  });
});

describe('builtInTransformFunctions', () => {
  it('toUpperCase', () => {
    assert.equal(builtInTransformFunctions.toUpperCase('hello'), 'HELLO');
  });

  it('toNumber', () => {
    assert.equal(builtInTransformFunctions.toNumber('42'), 42);
  });

  it('length', () => {
    assert.equal(builtInTransformFunctions.length('hello'), 5);
    assert.equal(builtInTransformFunctions.length([1, 2, 3]), 3);
  });

  it('unique', () => {
    assert.deepEqual(builtInTransformFunctions.unique([1, 2, 2, 3]), [1, 2, 3]);
  });
});

describe('setPath / deletePath', () => {
  it('sets nested values', () => {
    const obj: any = {};
    setPath(obj, 'a.b.c', 42);
    assert.equal(obj.a.b.c, 42);
  });

  it('deletes nested values', () => {
    const obj = { a: { b: 1 } };
    assert.ok(deletePath(obj, 'a.b'));
    assert.equal((obj.a as any).b, undefined);
  });
});

// ════════════════════════════════════════════════════════════
// EIP PATTERNS TESTS
// ════════════════════════════════════════════════════════════

describe('Splitter', () => {
  it('splits array field into multiple messages', () => {
    const splitter = new Splitter({
      splitField: 'items',
      preserveOriginal: false,
      addSplitMetadata: true,
    });

    const msg = createMessage({
      orderId: '123',
      items: [
        { name: 'Widget', qty: 2 },
        { name: 'Gadget', qty: 1 },
      ],
    });

    const parts = splitter.split(msg);
    assert.equal(parts.length, 2);
    assert.equal(parts[0].body.name, 'Widget');
    assert.equal(parts[1].body.name, 'Gadget');
    assert.equal(parts[0].metadata._split.index, 0);
    assert.equal(parts[0].metadata._split.total, 2);
  });

  it('returns original if field is not an array', () => {
    const splitter = new Splitter({
      splitField: 'items',
      preserveOriginal: false,
      addSplitMetadata: false,
    });

    const msg = createMessage({ items: 'not-array' });
    const parts = splitter.split(msg);
    assert.equal(parts.length, 1);
  });
});

describe('Aggregator', () => {
  it('aggregates by completion size', () => {
    const aggregator = new Aggregator({
      correlationField: 'orderId',
      correlationSource: 'body',
      completionSize: 3,
      strategy: 'list',
    });

    const r1 = aggregator.add(createMessage({ orderId: 'A', item: 1 }));
    assert.equal(r1, undefined);
    const r2 = aggregator.add(createMessage({ orderId: 'A', item: 2 }));
    assert.equal(r2, undefined);
    const r3 = aggregator.add(createMessage({ orderId: 'A', item: 3 }));

    assert.ok(r3);
    assert.equal(r3!.body.count, 3);
    assert.equal(r3!.body.items.length, 3);

    aggregator.destroy();
  });

  it('separates by correlation key', () => {
    const aggregator = new Aggregator({
      correlationField: 'group',
      correlationSource: 'body',
      completionSize: 2,
      strategy: 'merge',
    });

    aggregator.add(createMessage({ group: 'A', valueA: 1 }));
    aggregator.add(createMessage({ group: 'B', valueB: 2 }));
    const resultA = aggregator.add(createMessage({ group: 'A', valueA2: 3 }));

    assert.ok(resultA);
    assert.equal(resultA!.body.valueA, 1);
    assert.equal(resultA!.body.valueA2, 3);
    assert.equal(aggregator.pendingGroups, 1); // Group B still pending

    aggregator.destroy();
  });
});

describe('ContentFilter', () => {
  it('whitelist keeps only specified fields', () => {
    const msg = createMessage({ name: 'John', age: 30, ssn: '123-45-6789' });
    const filtered = ContentFilter.whitelist(msg, ['name', 'age']);

    assert.equal(filtered.body.name, 'John');
    assert.equal(filtered.body.age, 30);
    assert.equal(filtered.body.ssn, undefined);
  });

  it('blacklist removes specified fields', () => {
    const msg = createMessage({ name: 'John', age: 30, ssn: '123-45-6789' });
    const filtered = ContentFilter.blacklist(msg, ['ssn']);

    assert.equal(filtered.body.name, 'John');
    assert.equal(filtered.body.ssn, undefined);
  });
});

describe('ClaimCheck', () => {
  it('check in and check out', () => {
    const cc = new ClaimCheck({ storeName: 'test-store' });

    const msg = createMessage({ large: 'payload', data: [1, 2, 3] });
    const checked = cc.checkIn(msg);

    assert.ok(checked.metadata.claimCheck);
    assert.equal(checked.body.large, undefined); // Body is lightweight

    const restored = cc.checkOut(checked);
    assert.equal(restored.body.large, 'payload');
    assert.deepEqual(restored.body.data, [1, 2, 3]);
    assert.equal(restored.metadata.claimCheck, undefined);
  });
});

describe('WireTap', () => {
  it('taps a copy without modifying original', () => {
    const tap = new WireTap({ tapChannel: 'monitor', headersOnly: false });
    const tapped: ESBMessage[] = [];
    tap.onTap((msg) => tapped.push(msg));

    const msg = createMessage({ secret: 'data' });
    const result = tap.tap(msg);

    assert.equal(result, msg); // Original unchanged
    assert.equal(tapped.length, 1);
    assert.equal(tapped[0].metadata.wireTap.originalMessageId, msg.id);
  });
});

describe('IdempotentConsumer', () => {
  it('allows first, rejects duplicate', () => {
    const ic = new IdempotentConsumer('id', 'id');

    const msg = createMessage({ data: 1 });
    assert.ok(ic.tryProcess(msg));
    assert.ok(!ic.tryProcess(msg)); // Duplicate
    assert.ok(ic.isDuplicate(msg));
  });
});

// ════════════════════════════════════════════════════════════
// RESILIENCE TESTS
// ════════════════════════════════════════════════════════════

describe('CircuitBreaker', () => {
  it('opens after failure threshold', async () => {
    const cb = new CircuitBreaker({
      failureThreshold: 2,
      successThreshold: 1,
      resetTimeoutMs: 100,
      halfOpenMaxCalls: 1,
    });

    assert.equal(cb.state, 'closed');

    // Two failures should open the circuit
    try { await cb.execute(() => Promise.reject(new Error('fail'))); } catch {}
    try { await cb.execute(() => Promise.reject(new Error('fail'))); } catch {}

    assert.equal(cb.state, 'open');

    // Next call should be rejected
    await assert.rejects(
      () => cb.execute(() => Promise.resolve('ok')),
      (err: any) => err instanceof CircuitBreakerOpenError,
    );
  });

  it('transitions to half-open after reset timeout', async () => {
    const cb = new CircuitBreaker({
      failureThreshold: 1,
      successThreshold: 1,
      resetTimeoutMs: 50,
      halfOpenMaxCalls: 1,
    });

    try { await cb.execute(() => Promise.reject(new Error('fail'))); } catch {}
    assert.equal(cb.state, 'open');

    // Wait for reset timeout
    await new Promise((resolve) => setTimeout(resolve, 60));
    assert.equal(cb.state, 'half-open');

    // Success should close it
    await cb.execute(() => Promise.resolve('ok'));
    assert.equal(cb.state, 'closed');
  });
});

describe('RetryExecutor', () => {
  it('retries on failure and succeeds', async () => {
    let attempts = 0;
    const retry = new RetryExecutor({
      maxAttempts: 3,
      initialDelayMs: 10,
      maxDelayMs: 100,
      backoffMultiplier: 2,
    });

    const result = await retry.execute(async () => {
      attempts++;
      if (attempts < 3) throw new Error('not yet');
      return 'success';
    });

    assert.equal(result, 'success');
    assert.equal(attempts, 3);
  });

  it('throws after max attempts', async () => {
    const retry = new RetryExecutor({
      maxAttempts: 2,
      initialDelayMs: 10,
      maxDelayMs: 50,
      backoffMultiplier: 1,
    });

    await assert.rejects(
      () => retry.execute(() => Promise.reject(new Error('always fails'))),
      { message: 'always fails' },
    );
  });
});

describe('Bulkhead', () => {
  it('limits concurrent executions', async () => {
    const bh = new Bulkhead({ maxConcurrent: 2, maxQueue: 0 });

    let active = 0;
    let maxActive = 0;
    const operation = async () => {
      active++;
      maxActive = Math.max(maxActive, active);
      await new Promise((r) => setTimeout(r, 50));
      active--;
      return 'done';
    };

    const results = await Promise.allSettled([
      bh.execute(operation),
      bh.execute(operation),
      bh.execute(operation), // This should be rejected (no queue)
    ]);

    assert.equal(results[0].status, 'fulfilled');
    assert.equal(results[1].status, 'fulfilled');
    assert.equal(results[2].status, 'rejected');
    assert.ok(maxActive <= 2);
  });
});

describe('TimeoutExecutor', () => {
  it('resolves before timeout', async () => {
    const te = new TimeoutExecutor({ timeoutMs: 200 });
    const result = await te.execute(async () => {
      await new Promise((r) => setTimeout(r, 10));
      return 42;
    });
    assert.equal(result, 42);
  });

  it('throws on timeout', async () => {
    const te = new TimeoutExecutor({ timeoutMs: 10 });
    await assert.rejects(
      () => te.execute(() => new Promise((r) => setTimeout(r, 200))),
      (err: any) => err instanceof TimeoutError,
    );
  });

  it('returns fallback on timeout', async () => {
    const te = new TimeoutExecutor({ timeoutMs: 10, fallback: 'default' });
    const result = await te.execute(() => new Promise((r) => setTimeout(r, 200)));
    assert.equal(result, 'default');
  });
});

describe('RateLimiter', () => {
  it('allows up to max operations', async () => {
    const rl = new RateLimiter({
      maxOperations: 3,
      windowMs: 1000,
      strategy: 'fixed-window',
      overflowStrategy: 'reject',
    });

    assert.ok(await rl.tryAcquire());
    assert.ok(await rl.tryAcquire());
    assert.ok(await rl.tryAcquire());
    assert.ok(!(await rl.tryAcquire())); // Exceeded

    assert.equal(rl.metrics.totalAllowed, 3);
    assert.equal(rl.metrics.totalRejected, 1);
  });
});

describe('ResilienceBuilder', () => {
  it('composes retry + timeout', async () => {
    let attempts = 0;
    const executor = new ResilienceBuilder()
      .withRetry({ maxAttempts: 3, initialDelayMs: 10, maxDelayMs: 50, backoffMultiplier: 1 })
      .withTimeout({ timeoutMs: 5000 })
      .build<string>();

    const result = await executor(async () => {
      attempts++;
      if (attempts < 2) throw new Error('fail');
      return 'ok';
    });

    assert.equal(result, 'ok');
    assert.equal(attempts, 2);
  });
});

// ════════════════════════════════════════════════════════════
// MIDDLEWARE TESTS
// ════════════════════════════════════════════════════════════

describe('MiddlewarePipeline', () => {
  it('executes middleware in order', async () => {
    const pipeline = new MiddlewarePipeline();
    const order: number[] = [];

    pipeline.add('first', async (ctx, next) => { order.push(1); await next(); }, 1);
    pipeline.add('second', async (ctx, next) => { order.push(2); await next(); }, 2);
    pipeline.add('third', async (ctx, next) => { order.push(3); await next(); }, 3);

    await pipeline.execute(createTestMessage());
    assert.deepEqual(order, [1, 2, 3]);
  });

  it('supports abort', async () => {
    const pipeline = new MiddlewarePipeline();
    const order: number[] = [];

    pipeline.add('first', async (ctx, next) => { order.push(1); await next(); }, 1);
    pipeline.add('blocker', async (ctx, _next) => {
      ctx.abort = true;
      ctx.abortReason = 'blocked';
    }, 2);
    pipeline.add('never', async (ctx, next) => { order.push(3); await next(); }, 3);

    const ctx = await pipeline.execute(createTestMessage());
    assert.deepEqual(order, [1]);
    assert.ok(ctx.abort);
    assert.equal(ctx.abortReason, 'blocked');
  });

  it('correlation middleware adds correlation ID', async () => {
    const pipeline = new MiddlewarePipeline();
    pipeline.use(createCorrelationMiddleware());

    const msg = createMessage({ test: 1 });
    const ctx = await pipeline.execute(msg);
    assert.ok(ctx.message.correlationId);
  });

  it('breadcrumb middleware tracks path', async () => {
    const pipeline = new MiddlewarePipeline();
    pipeline.use(createBreadcrumbMiddleware('service-a'));

    const ctx = await pipeline.execute(createTestMessage());
    assert.equal(ctx.message.headers.breadcrumb, 'service-a');
  });

  it('size limit middleware rejects large messages', async () => {
    const pipeline = new MiddlewarePipeline();
    pipeline.use(createSizeLimitMiddleware(10));

    const ctx = await pipeline.execute(
      createMessage({ largeField: 'this is a very long string that exceeds the limit' }),
    );
    assert.ok(ctx.abort);
  });
});

// ════════════════════════════════════════════════════════════
// PROTOCOL MEDIATION TESTS
// ════════════════════════════════════════════════════════════

describe('ProtocolMediator', () => {
  it('serializes to REST format', () => {
    const mediator = new ProtocolMediator();
    const msg = createMessage({ order: 123 });

    const serialized = mediator.serialize(msg, 'rest', { method: 'POST' });
    assert.equal(serialized.method, 'POST');
    assert.equal(serialized.headers['Content-Type'], 'application/json');
    assert.ok(serialized.body.includes('"order":123'));
  });

  it('serializes to SOAP format', () => {
    const mediator = new ProtocolMediator();
    const msg = createMessage({ amount: 100 });

    const serialized = mediator.serialize(msg, 'soap');
    assert.ok(serialized.body.includes('soap:Envelope'));
    assert.ok(serialized.body.includes('<amount>100</amount>'));
  });

  it('mediates between protocols', () => {
    const mediator = new ProtocolMediator();
    const msg = createMessage({ data: 'test' }, {
      contentType: 'application/json',
    });

    const mediated = mediator.mediate(msg, 'rest', 'soap');
    assert.equal(mediated.contentType, 'text/xml; charset=utf-8');
    assert.ok(mediated.metadata.mediation);
  });

  it('lists registered protocols', () => {
    const mediator = new ProtocolMediator();
    const protocols = mediator.registeredProtocols;
    assert.ok(protocols.includes('rest'));
    assert.ok(protocols.includes('soap'));
    assert.ok(protocols.includes('jms'));
  });
});

// ════════════════════════════════════════════════════════════
// CORRELATION TESTS
// ════════════════════════════════════════════════════════════

describe('CorrelationEngine', () => {
  it('correlates messages by body field', () => {
    const engine = new CorrelationEngine(
      { strategy: 'bodyField', fields: ['orderId'], source: 'body' },
      {
        completionPredicate: (group) => group.messages.length >= 2,
      },
    );

    const r1 = engine.correlate(createMessage({ orderId: 'A', step: 1 }));
    assert.equal(r1, undefined);

    const r2 = engine.correlate(createMessage({ orderId: 'A', step: 2 }));
    assert.ok(r2);
    assert.equal(r2!.messages.length, 2);
    assert.ok(r2!.complete);
  });

  it('separates groups by correlation key', () => {
    const engine = new CorrelationEngine(
      { strategy: 'bodyField', fields: ['orderId'], source: 'body' },
    );

    engine.correlate(createMessage({ orderId: 'A', data: 1 }));
    engine.correlate(createMessage({ orderId: 'B', data: 2 }));

    assert.equal(engine.pendingCount, 2);
    assert.ok(engine.getGroup('A'));
    assert.ok(engine.getGroup('B'));

    engine.destroy();
  });
});

// ════════════════════════════════════════════════════════════
// SAGA TESTS
// ════════════════════════════════════════════════════════════

describe('SagaCoordinator', () => {
  it('executes a saga successfully', async () => {
    const coordinator = new SagaCoordinator();
    const log: string[] = [];

    const definition: SagaDefinition = {
      id: 'order-saga',
      name: 'Order Processing',
      steps: [
        { name: 'reserve-inventory' },
        { name: 'charge-payment' },
        { name: 'ship-order' },
      ],
    };

    coordinator.registerSaga(definition, {
      'reserve-inventory': {
        execute: async (ctx) => { log.push('reserve'); return { reserved: true }; },
        compensate: async (ctx) => { log.push('unreserve'); },
      },
      'charge-payment': {
        execute: async (ctx) => { log.push('charge'); return { charged: true }; },
        compensate: async (ctx) => { log.push('refund'); },
      },
      'ship-order': {
        execute: async (ctx) => { log.push('ship'); return { shipped: true }; },
        compensate: async (ctx) => { log.push('cancel-ship'); },
      },
    });

    const instance = await coordinator.execute('order-saga', { orderId: '123' });

    assert.equal(instance.status, 'completed');
    assert.deepEqual(log, ['reserve', 'charge', 'ship']);
    assert.ok(instance.context.data.reserved);
    assert.ok(instance.context.data.charged);
    assert.ok(instance.context.data.shipped);
  });

  it('compensates on failure', async () => {
    const coordinator = new SagaCoordinator();
    const log: string[] = [];

    coordinator.registerSaga(
      {
        id: 'fail-saga',
        name: 'Failing Saga',
        steps: [
          { name: 'step-1' },
          { name: 'step-2' },
          { name: 'step-3' },
        ],
      },
      {
        'step-1': {
          execute: async () => { log.push('exec-1'); },
          compensate: async () => { log.push('comp-1'); },
        },
        'step-2': {
          execute: async () => { log.push('exec-2'); },
          compensate: async () => { log.push('comp-2'); },
        },
        'step-3': {
          execute: async () => { throw new Error('step-3 failed'); },
          compensate: async () => { log.push('comp-3'); },
        },
      },
    );

    const instance = await coordinator.execute('fail-saga');

    assert.equal(instance.status, 'compensated');
    // Steps 1 and 2 should be compensated in reverse order
    assert.deepEqual(log, ['exec-1', 'exec-2', 'comp-2', 'comp-1']);
  });
});

// ════════════════════════════════════════════════════════════
// METRICS TESTS
// ════════════════════════════════════════════════════════════

describe('MetricCollector', () => {
  it('tracks counters', () => {
    const collector = new MetricCollector();
    collector.incrementCounter('requests', 1);
    collector.incrementCounter('requests', 5);

    assert.equal(collector.getCounter('requests'), 6);
  });

  it('tracks gauges', () => {
    const collector = new MetricCollector();
    collector.setGauge('connections', 10);
    collector.setGauge('connections', 15);

    assert.equal(collector.getGauge('connections'), 15);
  });

  it('calculates histogram percentiles', () => {
    const collector = new MetricCollector();
    for (let i = 1; i <= 100; i++) {
      collector.recordHistogram('latency', i);
    }

    const stats = collector.getHistogram('latency')!;
    assert.equal(stats.count, 100);
    assert.equal(stats.min, 1);
    assert.equal(stats.max, 100);
    assert.equal(stats.average, 50.5);
    assert.ok(stats.p95 >= 94);
    assert.ok(stats.p99 >= 98);
  });

  it('builds snapshot', () => {
    const collector = new MetricCollector();
    collector.incrementCounter('messages.processed', 100);
    collector.incrementCounter('messages.failed', 5);

    const snapshot = collector.buildSnapshot({
      channelDepths: { orders: 10 },
    });

    assert.equal(snapshot.messagesProcessed, 100);
    assert.equal(snapshot.messagesFailed, 5);
    assert.equal(snapshot.channelDepths.orders, 10);
    assert.ok(snapshot.uptimeMs >= 0);
  });

  it('supports labeled metrics', () => {
    const collector = new MetricCollector();
    collector.incrementCounter('http.requests', 1, { method: 'GET' });
    collector.incrementCounter('http.requests', 3, { method: 'POST' });

    assert.equal(collector.getCounter('http.requests', { method: 'GET' }), 1);
    assert.equal(collector.getCounter('http.requests', { method: 'POST' }), 3);
  });
});

// ════════════════════════════════════════════════════════════
// SECURITY TESTS
// ════════════════════════════════════════════════════════════

describe('MessageSigner', () => {
  it('signs and verifies messages', () => {
    const signer = new MessageSigner('my-secret-key');

    const msg = createMessage({ sensitive: 'data' });
    const signed = signer.sign(msg);

    assert.ok(signed.metadata.security.signature);
    assert.ok(signer.verify(signed));
  });

  it('detects tampered messages', () => {
    const signer = new MessageSigner('my-secret-key');

    const msg = createMessage({ amount: 100 });
    const signed = signer.sign(msg);

    // Tamper with the body
    signed.body.amount = 999;
    assert.ok(!signer.verify(signed));
  });
});

describe('SecurityGuard', () => {
  it('enforces message type allowlist', () => {
    const guard = new SecurityGuard({
      encryptionEnabled: false,
      integrityCheckEnabled: false,
      authPropagation: false,
      sanitizePayloads: false,
      allowedMessageTypes: ['order.created', 'order.updated'],
    });

    const allowed = createMessage({}, { headers: { messageType: 'order.created' } });
    guard.enforceOutbound(allowed); // Should not throw

    const blocked = createMessage({}, { headers: { messageType: 'admin.delete' } });
    assert.throws(
      () => guard.enforceOutbound(blocked),
      (err: any) => err instanceof SecurityViolationError,
    );
  });

  it('enforces size limits', () => {
    const guard = new SecurityGuard({
      encryptionEnabled: false,
      integrityCheckEnabled: false,
      authPropagation: false,
      sanitizePayloads: false,
      maxMessageSizeBytes: 50,
    });

    const large = createMessage({ data: 'x'.repeat(100) });
    assert.throws(
      () => guard.enforceOutbound(large),
      (err: any) => err.code === 'MESSAGE_TOO_LARGE',
    );
  });

  it('propagates security context', () => {
    const guard = new SecurityGuard({
      encryptionEnabled: false,
      integrityCheckEnabled: false,
      authPropagation: true,
      sanitizePayloads: false,
    });

    const msg = createMessage({ data: 1 });
    const secured = guard.applySecurityContext(msg, {
      principal: 'user@example.com',
      roles: ['admin'],
      tenantId: 'tenant-1',
    });

    assert.equal(secured.metadata.security.principal, 'user@example.com');
    assert.deepEqual(secured.metadata.security.roles, ['admin']);

    const extracted = guard.extractSecurityContext(secured);
    assert.equal(extracted?.principal, 'user@example.com');
    assert.equal(extracted?.tenantId, 'tenant-1');
  });
});

// ════════════════════════════════════════════════════════════
// VALIDATION TESTS
// ════════════════════════════════════════════════════════════

describe('SchemaValidator', () => {
  it('validates required fields', () => {
    const validator = new SchemaValidator({
      validateInbound: true,
      validateOutbound: true,
      onFailure: 'reject',
      schemas: {
        'order.created': {
          id: 'order-schema',
          name: 'Order',
          version: '1.0',
          fields: [
            { name: 'orderId', type: 'string', required: true },
            { name: 'total', type: 'number', required: true, min: 0 },
          ],
        },
      },
    });

    const valid = createMessage(
      { orderId: 'A', total: 100 },
      { headers: { messageType: 'order.created' } },
    );
    const result = validator.validate(valid);
    assert.ok(result.valid);

    const invalid = createMessage(
      { total: -5 },
      { headers: { messageType: 'order.created' } },
    );
    const result2 = validator.validate(invalid);
    assert.ok(!result2.valid);
    assert.ok(result2.errors.length >= 1);
  });

  it('validates types', () => {
    const validator = new SchemaValidator({
      validateInbound: true,
      validateOutbound: true,
      onFailure: 'reject',
      schemas: {
        test: {
          id: 'test', name: 'Test', version: '1.0',
          fields: [
            { name: 'name', type: 'string', required: true },
            { name: 'count', type: 'number', required: false },
          ],
        },
      },
    });

    const wrongType = createMessage(
      { name: 123, count: 'abc' },
      { headers: { messageType: 'test' } },
    );
    const result = validator.validate(wrongType);
    assert.ok(!result.valid);
    assert.ok(result.errors.some((e) => e.field === 'name'));
    assert.ok(result.errors.some((e) => e.field === 'count'));
  });

  it('validates nested objects', () => {
    const validator = new SchemaValidator({
      validateInbound: true,
      validateOutbound: true,
      onFailure: 'reject',
      schemas: {
        nested: {
          id: 'nested', name: 'Nested', version: '1.0',
          fields: [
            {
              name: 'address', type: 'object', required: true, children: [
                { name: 'city', type: 'string', required: true },
                { name: 'zip', type: 'string', required: true, pattern: '^\\d{5}$' },
              ],
            },
          ],
        },
      },
    });

    const valid = createMessage(
      { address: { city: 'NYC', zip: '10001' } },
      { headers: { messageType: 'nested' } },
    );
    assert.ok(validator.validate(valid).valid);

    const invalid = createMessage(
      { address: { city: 'NYC', zip: 'bad' } },
      { headers: { messageType: 'nested' } },
    );
    assert.ok(!validator.validate(invalid).valid);
  });
});

// ════════════════════════════════════════════════════════════
// SCHEDULING TESTS
// ════════════════════════════════════════════════════════════

describe('parseCronExpression', () => {
  it('parses * * * * * (every minute)', () => {
    const schedule = parseCronExpression('* * * * *');
    assert.equal(schedule.minute.length, 60);
    assert.equal(schedule.hour.length, 24);
  });

  it('parses specific values', () => {
    const schedule = parseCronExpression('30 14 * * 1');
    assert.deepEqual(schedule.minute, [30]);
    assert.deepEqual(schedule.hour, [14]);
    assert.deepEqual(schedule.dayOfWeek, [1]);
  });

  it('parses step values', () => {
    const schedule = parseCronExpression('*/15 * * * *');
    assert.deepEqual(schedule.minute, [0, 15, 30, 45]);
  });

  it('rejects invalid expressions', () => {
    assert.throws(() => parseCronExpression('invalid'));
  });
});

describe('matchesCron', () => {
  it('matches a date against a schedule', () => {
    const schedule = parseCronExpression('30 14 * * *');
    const matching = new Date('2024-01-15T14:30:00');
    const notMatching = new Date('2024-01-15T14:31:00');

    assert.ok(matchesCron(matching, schedule));
    assert.ok(!matchesCron(notMatching, schedule));
  });
});

// ════════════════════════════════════════════════════════════
// SERVICE BUS INTEGRATION TESTS
// ════════════════════════════════════════════════════════════

describe('ServiceBus', () => {
  let bus: ServiceBus;

  beforeEach(async () => {
    bus = new ServiceBus({
      name: 'test-bus',
      channels: [
        { name: 'orders', type: 'publish-subscribe' },
        { name: 'notifications', type: 'point-to-point' },
      ],
      metricsEnabled: true,
    });
    await bus.init();
  });

  afterEach(async () => {
    await bus.shutdown();
  });

  it('initializes and shuts down', () => {
    assert.ok(bus.isInitialized);
    assert.ok(!bus.isDestroyed);
    assert.deepEqual(bus.channelNames.sort(), ['notifications', 'orders']);
  });

  it('sends and receives via pub/sub', async () => {
    const received: ESBMessage[] = [];
    bus.subscribe('orders', 'processor', async (msg) => {
      received.push(msg);
    });

    await bus.send('orders', { orderId: '123', total: 99 });

    assert.equal(received.length, 1);
    assert.equal(received[0].body.orderId, '123');
  });

  it('sends and receives via point-to-point', async () => {
    const received: ESBMessage[] = [];
    bus.addConsumer('notifications', async (msg) => {
      received.push(msg);
    });

    await bus.send('notifications', { text: 'Hello' });

    assert.equal(received.length, 1);
    assert.equal(received[0].body.text, 'Hello');
  });

  it('auto-creates channels on demand', async () => {
    await bus.send('dynamic-channel', { data: 1 });
    assert.ok(bus.getChannel('dynamic-channel'));
  });

  it('emits bus events', async () => {
    const events: any[] = [];
    bus.on('message:sent', (event) => events.push(event));

    await bus.send('orders', { orderId: '456' });

    assert.equal(events.length, 1);
    assert.equal(events[0].type, 'message:sent');
  });

  it('collects metrics', async () => {
    await bus.send('orders', { orderId: '1' });
    await bus.send('orders', { orderId: '2' });

    const metrics = bus.getMetrics();
    assert.equal(metrics.messagesProcessed, 2);
    assert.ok(metrics.uptimeMs >= 0);
  });

  it('transforms messages', () => {
    const msg = createMessage({ name: 'John', age: 30 });
    const transformed = bus.transform(msg, {
      name: 'test-pipeline',
      steps: [
        {
          type: 'map',
          name: 'remap',
          config: {
            mappings: [
              { source: 'name', target: 'userName' },
              { source: 'age', target: 'userAge' },
            ],
          },
        },
      ],
      stopOnError: true,
    });

    assert.equal(transformed.body.userName, 'John');
    assert.equal(transformed.body.userAge, 30);
  });

  it('routes messages', async () => {
    bus.createChannel({ name: 'premium', type: 'publish-subscribe' });
    const premiumOrders: ESBMessage[] = [];
    bus.subscribe('premium', 'prem-handler', async (msg) => {
      premiumOrders.push(msg);
    });

    bus.addRoute({
      id: 'premium-route',
      name: 'Premium Orders',
      source: 'orders',
      destinations: ['premium'],
      condition: {
        field: 'total',
        source: 'body',
        operator: 'greaterThan',
        value: 1000,
      },
      priority: 10,
      enabled: true,
    });

    await bus.send('orders', { orderId: '999', total: 5000 });

    assert.equal(premiumOrders.length, 1);
    assert.equal(premiumOrders[0].body.total, 5000);
  });

  it('registers and executes sagas', async () => {
    const log: string[] = [];

    bus.registerSaga(
      {
        id: 'test-saga',
        name: 'Test Saga',
        steps: [{ name: 'step-a' }, { name: 'step-b' }],
      },
      {
        'step-a': {
          execute: async () => { log.push('a'); return { a: true }; },
          compensate: async () => { log.push('undo-a'); },
        },
        'step-b': {
          execute: async () => { log.push('b'); return { b: true }; },
          compensate: async () => { log.push('undo-b'); },
        },
      },
    );

    const instance = await bus.executeSaga('test-saga', { input: 1 });
    assert.equal(instance.status, 'completed');
    assert.deepEqual(log, ['a', 'b']);
  });

  it('prevents double init and use after destroy', async () => {
    await bus.shutdown();
    assert.ok(bus.isDestroyed);
    assert.throws(() => bus.subscribe('orders', 'x', async () => {}));
  });
});

// ════════════════════════════════════════════════════════════
// ENGINE PLUGIN TESTS
// ════════════════════════════════════════════════════════════

describe('createESBPlugin', () => {
  it('creates a valid engine plugin', async () => {
    const bus = new ServiceBus({ name: 'plugin-test' });
    await bus.init();

    const plugin = createESBPlugin(bus);

    assert.equal(plugin.name, 'soa-one-esb');
    assert.equal(plugin.version, '1.0.0');
    assert.ok(plugin.operators);
    assert.ok(plugin.actionHandlers);
    assert.ok(plugin.hooks);
    assert.ok(plugin.functions);
    assert.ok(plugin.onRegister);
    assert.ok(plugin.onDestroy);

    // Test custom operators
    assert.ok(plugin.operators!.channelHasMessages);
    assert.ok(plugin.operators!.channelDepthExceeds);
    assert.ok(plugin.operators!.endpointExists);
    assert.ok(plugin.operators!.messageTypeMatches);

    // Test custom actions
    assert.ok(plugin.actionHandlers!.ESB_SEND);
    assert.ok(plugin.actionHandlers!.ESB_PUBLISH);
    assert.ok(plugin.actionHandlers!.ESB_SCHEDULE);

    // Test custom functions
    assert.ok(plugin.functions!.esb_createMessage);
    assert.ok(plugin.functions!.esb_channelDepth);
    assert.ok(plugin.functions!.esb_generateId);

    // Test operator: channelHasMessages
    bus.createChannel({ name: 'test-ch', type: 'point-to-point' });
    assert.ok(!plugin.operators!.channelHasMessages('test-ch', true));
    await bus.getChannel('test-ch')!.send(createTestMessage());
    assert.ok(plugin.operators!.channelHasMessages('test-ch', true));

    // Test operator: messageTypeMatches
    assert.ok(plugin.operators!.messageTypeMatches('order.created', 'order.*'));
    assert.ok(!plugin.operators!.messageTypeMatches('user.created', 'order.*'));

    // Test function: esb_channelDepth
    assert.equal(plugin.functions!.esb_channelDepth('test-ch'), 1);

    // Test function: esb_generateId
    const id = plugin.functions!.esb_generateId();
    assert.ok(id);
    assert.equal(typeof id, 'string');

    // Test hooks
    assert.equal(plugin.hooks!.beforeExecute!.length, 1);
    assert.equal(plugin.hooks!.afterExecute!.length, 1);

    const hookCtx: any = {
      ruleSet: { id: 'rs1', name: 'Test' },
      input: {},
      output: {},
      metadata: {},
    };
    const result = plugin.hooks!.beforeExecute![0](hookCtx);
    assert.ok(result.metadata.esb);
    assert.equal(result.metadata.esb.busName, 'plugin-test');

    // Test lifecycle
    plugin.onRegister!();
    plugin.onDestroy!();

    await bus.shutdown();
  });
});

// ════════════════════════════════════════════════════════════
// FINAL: All features work together
// ════════════════════════════════════════════════════════════

describe('End-to-End: ESB full pipeline', () => {
  it('processes a message through the complete pipeline', async () => {
    const bus = new ServiceBus({
      name: 'e2e-bus',
      channels: [
        { name: 'inbound', type: 'publish-subscribe' },
        { name: 'processed', type: 'point-to-point' },
      ],
    });
    await bus.init();

    // Add routing
    bus.addRoute({
      id: 'process-route',
      name: 'Process all',
      source: 'inbound',
      destinations: ['processed'],
      priority: 10,
      enabled: true,
    });

    // Add a consumer on the processed channel
    const processedMessages: ESBMessage[] = [];
    bus.addConsumer('processed', async (msg) => {
      processedMessages.push(msg);
    });

    // Send a message
    await bus.send('inbound', {
      orderId: 'ORD-001',
      customer: 'Alice',
      total: 150.00,
    });

    // Verify end-to-end flow
    assert.equal(processedMessages.length, 1);
    assert.equal(processedMessages[0].body.orderId, 'ORD-001');

    // Verify metrics
    const metrics = bus.getMetrics();
    assert.ok(metrics.messagesProcessed >= 1);

    await bus.shutdown();
  });
});
