import { Router } from 'express';
import { prisma } from '../prisma';
import { type AuthRequest } from '../auth/middleware';
import { createAuditLog } from './audit';
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
  createMessage,
} from '@soa-one/esb';

const router = Router();

// ============================================================
// ESB Channels
// ============================================================

router.get('/channels', async (_req, res) => {
  const channels = await prisma.eSBChannel.findMany({ orderBy: { updatedAt: 'desc' } });
  res.json(channels.map((c) => ({ ...c, config: JSON.parse(c.config) })));
});

router.get('/channels/:id', async (req, res) => {
  const channel = await prisma.eSBChannel.findUnique({ where: { id: req.params.id } });
  if (!channel) return res.status(404).json({ error: 'Channel not found' });
  res.json({ ...channel, config: JSON.parse(channel.config) });
});

router.post('/channels', async (req: AuthRequest, res) => {
  const { name, type, config } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });

  const channel = await prisma.eSBChannel.create({
    data: {
      name,
      type: type || 'point-to-point',
      config: JSON.stringify(config || {}),
      tenantId: req.user?.tenantId,
    },
  });

  if (req.user) {
    await createAuditLog({
      tenantId: req.user.tenantId, userId: req.user.id, userName: req.user.name,
      action: 'create', entity: 'esb-channel', entityId: channel.id, entityName: channel.name,
    });
  }

  res.status(201).json({ ...channel, config: JSON.parse(channel.config) });
});

router.put('/channels/:id', async (req, res) => {
  const { name, type, config, status } = req.body;
  const data: any = {};
  if (name !== undefined) data.name = name;
  if (type !== undefined) data.type = type;
  if (config !== undefined) data.config = JSON.stringify(config);
  if (status !== undefined) data.status = status;

  const channel = await prisma.eSBChannel.update({ where: { id: req.params.id }, data });
  res.json({ ...channel, config: JSON.parse(channel.config) });
});

router.delete('/channels/:id', async (req, res) => {
  await prisma.eSBChannel.delete({ where: { id: req.params.id } });
  res.json({ success: true });
});

// ============================================================
// ESB Endpoints
// ============================================================

router.get('/endpoints', async (_req, res) => {
  const endpoints = await prisma.eSBEndpoint.findMany({ orderBy: { updatedAt: 'desc' } });
  res.json(endpoints.map((e) => ({ ...e, config: JSON.parse(e.config) })));
});

router.get('/endpoints/:id', async (req, res) => {
  const endpoint = await prisma.eSBEndpoint.findUnique({ where: { id: req.params.id } });
  if (!endpoint) return res.status(404).json({ error: 'Endpoint not found' });
  res.json({ ...endpoint, config: JSON.parse(endpoint.config) });
});

router.post('/endpoints', async (req: AuthRequest, res) => {
  const { name, channelId, protocol, config } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });

  const endpoint = await prisma.eSBEndpoint.create({
    data: {
      name,
      channelId: channelId || null,
      protocol: protocol || 'rest',
      config: JSON.stringify(config || {}),
      tenantId: req.user?.tenantId,
    },
  });

  if (req.user) {
    await createAuditLog({
      tenantId: req.user.tenantId, userId: req.user.id, userName: req.user.name,
      action: 'create', entity: 'esb-endpoint', entityId: endpoint.id, entityName: endpoint.name,
    });
  }

  res.status(201).json({ ...endpoint, config: JSON.parse(endpoint.config) });
});

router.put('/endpoints/:id', async (req, res) => {
  const { name, channelId, protocol, config, status } = req.body;
  const data: any = {};
  if (name !== undefined) data.name = name;
  if (channelId !== undefined) data.channelId = channelId;
  if (protocol !== undefined) data.protocol = protocol;
  if (config !== undefined) data.config = JSON.stringify(config);
  if (status !== undefined) data.status = status;

  const endpoint = await prisma.eSBEndpoint.update({ where: { id: req.params.id }, data });
  res.json({ ...endpoint, config: JSON.parse(endpoint.config) });
});

router.delete('/endpoints/:id', async (req, res) => {
  await prisma.eSBEndpoint.delete({ where: { id: req.params.id } });
  res.json({ success: true });
});

// ============================================================
// ESB Routes
// ============================================================

router.get('/routes', async (_req, res) => {
  const routes = await prisma.eSBRoute.findMany({ orderBy: [{ priority: 'desc' }, { updatedAt: 'desc' }] });
  res.json(routes.map((r) => ({ ...r, conditions: JSON.parse(r.conditions), targets: JSON.parse(r.targets) })));
});

router.get('/routes/:id', async (req, res) => {
  const route = await prisma.eSBRoute.findUnique({ where: { id: req.params.id } });
  if (!route) return res.status(404).json({ error: 'Route not found' });
  res.json({ ...route, conditions: JSON.parse(route.conditions), targets: JSON.parse(route.targets) });
});

router.post('/routes', async (req: AuthRequest, res) => {
  const { name, source, strategy, conditions, targets, priority, enabled } = req.body;
  if (!name || !source) return res.status(400).json({ error: 'name and source are required' });

  const route = await prisma.eSBRoute.create({
    data: {
      name,
      source,
      strategy: strategy || 'content-based',
      conditions: JSON.stringify(conditions || []),
      targets: JSON.stringify(targets || []),
      priority: priority ?? 0,
      enabled: enabled ?? true,
      tenantId: req.user?.tenantId,
    },
  });

  if (req.user) {
    await createAuditLog({
      tenantId: req.user.tenantId, userId: req.user.id, userName: req.user.name,
      action: 'create', entity: 'esb-route', entityId: route.id, entityName: route.name,
    });
  }

  res.status(201).json({ ...route, conditions: JSON.parse(route.conditions), targets: JSON.parse(route.targets) });
});

router.put('/routes/:id', async (req, res) => {
  const { name, source, strategy, conditions, targets, priority, enabled } = req.body;
  const data: any = {};
  if (name !== undefined) data.name = name;
  if (source !== undefined) data.source = source;
  if (strategy !== undefined) data.strategy = strategy;
  if (conditions !== undefined) data.conditions = JSON.stringify(conditions);
  if (targets !== undefined) data.targets = JSON.stringify(targets);
  if (priority !== undefined) data.priority = priority;
  if (enabled !== undefined) data.enabled = enabled;

  const route = await prisma.eSBRoute.update({ where: { id: req.params.id }, data });
  res.json({ ...route, conditions: JSON.parse(route.conditions), targets: JSON.parse(route.targets) });
});

router.delete('/routes/:id', async (req, res) => {
  await prisma.eSBRoute.delete({ where: { id: req.params.id } });
  res.json({ success: true });
});

// ============================================================
// ESB Transformers
// ============================================================

router.get('/transformers', async (_req, res) => {
  const transformers = await prisma.eSBTransformer.findMany({ orderBy: { updatedAt: 'desc' } });
  res.json(transformers.map((t) => ({ ...t, pipeline: JSON.parse(t.pipeline) })));
});

router.get('/transformers/:id', async (req, res) => {
  const transformer = await prisma.eSBTransformer.findUnique({ where: { id: req.params.id } });
  if (!transformer) return res.status(404).json({ error: 'Transformer not found' });
  res.json({ ...transformer, pipeline: JSON.parse(transformer.pipeline) });
});

router.post('/transformers', async (req: AuthRequest, res) => {
  const { name, channel, pipeline, enabled } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });

  const transformer = await prisma.eSBTransformer.create({
    data: {
      name,
      channel: channel || null,
      pipeline: JSON.stringify(pipeline || []),
      enabled: enabled ?? true,
      tenantId: req.user?.tenantId,
    },
  });

  if (req.user) {
    await createAuditLog({
      tenantId: req.user.tenantId, userId: req.user.id, userName: req.user.name,
      action: 'create', entity: 'esb-transformer', entityId: transformer.id, entityName: transformer.name,
    });
  }

  res.status(201).json({ ...transformer, pipeline: JSON.parse(transformer.pipeline) });
});

router.put('/transformers/:id', async (req, res) => {
  const { name, channel, pipeline, enabled } = req.body;
  const data: any = {};
  if (name !== undefined) data.name = name;
  if (channel !== undefined) data.channel = channel;
  if (pipeline !== undefined) data.pipeline = JSON.stringify(pipeline);
  if (enabled !== undefined) data.enabled = enabled;

  const transformer = await prisma.eSBTransformer.update({ where: { id: req.params.id }, data });
  res.json({ ...transformer, pipeline: JSON.parse(transformer.pipeline) });
});

router.delete('/transformers/:id', async (req, res) => {
  await prisma.eSBTransformer.delete({ where: { id: req.params.id } });
  res.json({ success: true });
});

// ============================================================
// ESB Sagas
// ============================================================

router.get('/sagas', async (_req, res) => {
  const sagas = await prisma.eSBSagaDefinition.findMany({
    include: { instances: { take: 5, orderBy: { startedAt: 'desc' } } },
    orderBy: { updatedAt: 'desc' },
  });
  res.json(sagas.map((s) => ({
    ...s,
    steps: JSON.parse(s.steps),
    retryPolicy: s.retryPolicy ? JSON.parse(s.retryPolicy) : null,
    instances: s.instances.map((i) => ({
      ...i,
      context: JSON.parse(i.context),
      logs: JSON.parse(i.logs),
    })),
  })));
});

router.get('/sagas/:id', async (req, res) => {
  const saga = await prisma.eSBSagaDefinition.findUnique({
    where: { id: req.params.id },
    include: { instances: { orderBy: { startedAt: 'desc' } } },
  });
  if (!saga) return res.status(404).json({ error: 'Saga not found' });
  res.json({
    ...saga,
    steps: JSON.parse(saga.steps),
    retryPolicy: saga.retryPolicy ? JSON.parse(saga.retryPolicy) : null,
    instances: saga.instances.map((i) => ({
      ...i,
      context: JSON.parse(i.context),
      logs: JSON.parse(i.logs),
    })),
  });
});

router.post('/sagas', async (req: AuthRequest, res) => {
  const { name, description, steps, timeout, retryPolicy } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });

  const saga = await prisma.eSBSagaDefinition.create({
    data: {
      name,
      description: description || '',
      steps: JSON.stringify(steps || []),
      timeout: timeout || null,
      retryPolicy: retryPolicy ? JSON.stringify(retryPolicy) : null,
      tenantId: req.user?.tenantId,
    },
  });

  if (req.user) {
    await createAuditLog({
      tenantId: req.user.tenantId, userId: req.user.id, userName: req.user.name,
      action: 'create', entity: 'esb-saga', entityId: saga.id, entityName: saga.name,
    });
  }

  res.status(201).json({ ...saga, steps: JSON.parse(saga.steps), retryPolicy: saga.retryPolicy ? JSON.parse(saga.retryPolicy) : null });
});

router.put('/sagas/:id', async (req, res) => {
  const { name, description, steps, timeout, retryPolicy } = req.body;
  const data: any = {};
  if (name !== undefined) data.name = name;
  if (description !== undefined) data.description = description;
  if (steps !== undefined) data.steps = JSON.stringify(steps);
  if (timeout !== undefined) data.timeout = timeout;
  if (retryPolicy !== undefined) data.retryPolicy = retryPolicy ? JSON.stringify(retryPolicy) : null;

  const saga = await prisma.eSBSagaDefinition.update({ where: { id: req.params.id }, data });
  res.json({ ...saga, steps: JSON.parse(saga.steps), retryPolicy: saga.retryPolicy ? JSON.parse(saga.retryPolicy) : null });
});

router.delete('/sagas/:id', async (req, res) => {
  await prisma.eSBSagaDefinition.delete({ where: { id: req.params.id } });
  res.json({ success: true });
});

// Saga instances
router.get('/sagas/:id/instances', async (req, res) => {
  const instances = await prisma.eSBSagaInstance.findMany({
    where: { definitionId: req.params.id },
    orderBy: { startedAt: 'desc' },
  });
  res.json(instances.map((i) => ({ ...i, context: JSON.parse(i.context), logs: JSON.parse(i.logs) })));
});

router.get('/saga-instances/:id', async (req, res) => {
  const instance = await prisma.eSBSagaInstance.findUnique({ where: { id: req.params.id } });
  if (!instance) return res.status(404).json({ error: 'Saga instance not found' });
  res.json({ ...instance, context: JSON.parse(instance.context), logs: JSON.parse(instance.logs) });
});

router.post('/sagas/:id/instances', async (req: AuthRequest, res) => {
  const { context } = req.body;
  const instance = await prisma.eSBSagaInstance.create({
    data: {
      definitionId: String(req.params.id),
      status: 'running',
      context: JSON.stringify(context || {}),
      logs: JSON.stringify([]),
    },
  });
  res.status(201).json({ ...instance, context: JSON.parse(instance.context), logs: JSON.parse(instance.logs) });
});

router.put('/saga-instances/:id', async (req, res) => {
  const { status, currentStep, context, logs } = req.body;
  const data: any = {};
  if (status !== undefined) {
    data.status = status;
    if (status === 'completed' || status === 'failed' || status === 'compensated') {
      data.completedAt = new Date();
    }
  }
  if (currentStep !== undefined) data.currentStep = currentStep;
  if (context !== undefined) data.context = JSON.stringify(context);
  if (logs !== undefined) data.logs = JSON.stringify(logs);

  const instance = await prisma.eSBSagaInstance.update({ where: { id: req.params.id }, data });
  res.json({ ...instance, context: JSON.parse(instance.context), logs: JSON.parse(instance.logs) });
});

// ============================================================
// ESB Messages (recent history / dead-letter)
// ============================================================

router.get('/messages', async (req, res) => {
  const { channelName, status, limit } = req.query;
  const where: any = {};
  if (channelName) where.channelName = String(channelName);
  if (status) where.status = String(status);

  const messages = await prisma.eSBMessage.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: Math.min(Number(limit) || 50, 200),
  });
  res.json(messages.map((m) => ({ ...m, headers: JSON.parse(m.headers), body: JSON.parse(m.body) })));
});

router.post('/messages', async (req: AuthRequest, res) => {
  const { channelName, type, headers, body, correlationId } = req.body;
  if (!channelName) return res.status(400).json({ error: 'channelName is required' });

  const message = await prisma.eSBMessage.create({
    data: {
      channelName,
      type: type || 'event',
      headers: JSON.stringify(headers || {}),
      body: JSON.stringify(body || {}),
      correlationId: correlationId || null,
      tenantId: req.user?.tenantId,
    },
  });

  res.status(201).json({ ...message, headers: JSON.parse(message.headers), body: JSON.parse(message.body) });
});

router.get('/messages/:id', async (req, res) => {
  const message = await prisma.eSBMessage.findUnique({ where: { id: req.params.id } });
  if (!message) return res.status(404).json({ error: 'Message not found' });
  res.json({ ...message, headers: JSON.parse(message.headers), body: JSON.parse(message.body) });
});

router.put('/messages/:id/status', async (req, res) => {
  const { status } = req.body;
  if (!status) return res.status(400).json({ error: 'status is required' });
  const message = await prisma.eSBMessage.update({
    where: { id: req.params.id },
    data: { status },
  });
  res.json({ ...message, headers: JSON.parse(message.headers), body: JSON.parse(message.body) });
});

router.post('/messages/:id/retry', async (req, res) => {
  const original = await prisma.eSBMessage.findUnique({ where: { id: req.params.id } });
  if (!original) return res.status(404).json({ error: 'Message not found' });
  // Reset status to pending for retry
  const updated = await prisma.eSBMessage.update({
    where: { id: req.params.id },
    data: { status: 'pending' },
  });
  res.json({ ...updated, headers: JSON.parse(updated.headers), body: JSON.parse(updated.body) });
});

router.delete('/messages/:id', async (req, res) => {
  await prisma.eSBMessage.delete({ where: { id: req.params.id } });
  res.json({ success: true });
});

// ============================================================
// ESB Metrics / Dashboard
// ============================================================

router.get('/metrics', async (_req, res) => {
  const [channels, endpoints, routes, transformers, sagas, messages, deadLetters] = await Promise.all([
    prisma.eSBChannel.count(),
    prisma.eSBEndpoint.count(),
    prisma.eSBRoute.count(),
    prisma.eSBTransformer.count(),
    prisma.eSBSagaInstance.count({ where: { status: 'running' } }),
    prisma.eSBMessage.count(),
    prisma.eSBMessage.count({ where: { status: 'dead-letter' } }),
  ]);

  const recentMessages = await prisma.eSBMessage.findMany({
    orderBy: { createdAt: 'desc' },
    take: 10,
  });

  const channelList = await prisma.eSBChannel.findMany({
    select: { id: true, name: true, type: true, status: true, messageCount: true, errorCount: true, lastActivity: true },
    orderBy: { messageCount: 'desc' },
    take: 20,
  });

  res.json({
    summary: {
      totalChannels: channels,
      totalEndpoints: endpoints,
      totalRoutes: routes,
      totalTransformers: transformers,
      activeSagas: sagas,
      totalMessages: messages,
      deadLetterCount: deadLetters,
    },
    channels: channelList,
    recentMessages: recentMessages.map((m) => ({
      ...m,
      headers: JSON.parse(m.headers),
      body: JSON.parse(m.body),
    })),
  });
});

router.get('/metrics/snapshots', async (req, res) => {
  const { limit } = req.query;
  const snapshots = await prisma.eSBMetricSnapshot.findMany({
    orderBy: { createdAt: 'desc' },
    take: Math.min(Number(limit) || 24, 100),
  });
  res.json(snapshots.map((s) => ({
    ...s,
    circuitBreakers: JSON.parse(s.circuitBreakers),
    rateLimiters: JSON.parse(s.rateLimiters),
    snapshot: JSON.parse(s.snapshot),
  })));
});

router.post('/metrics/snapshots', async (req, res) => {
  const { totalMessages, deliveredCount, failedCount, avgLatencyMs, circuitBreakers, rateLimiters, snapshot } = req.body;

  const [activeChannels, activeEndpoints, activeSagas] = await Promise.all([
    prisma.eSBChannel.count({ where: { status: 'active' } }),
    prisma.eSBEndpoint.count({ where: { status: 'active' } }),
    prisma.eSBSagaInstance.count({ where: { status: 'running' } }),
  ]);

  const record = await prisma.eSBMetricSnapshot.create({
    data: {
      totalMessages: totalMessages ?? 0,
      deliveredCount: deliveredCount ?? 0,
      failedCount: failedCount ?? 0,
      avgLatencyMs: avgLatencyMs ?? 0,
      activeChannels,
      activeEndpoints,
      activeSagas,
      circuitBreakers: JSON.stringify(circuitBreakers || {}),
      rateLimiters: JSON.stringify(rateLimiters || {}),
      snapshot: JSON.stringify(snapshot || {}),
    },
  });

  res.status(201).json(record);
});

// ============================================================
// ESB Patterns (EIP)
// ============================================================

/** Helper: wrap a plain body into an ESBMessage */
function toESBMessage(body: any) {
  return createMessage(body.body ?? body, {
    correlationId: body.correlationId,
    headers: body.headers,
    metadata: body.metadata,
    priority: body.priority,
    contentType: body.contentType,
  });
}

// Splitter — split a message by an array field
router.post('/patterns/split', (req, res) => {
  const { config, message } = req.body;
  if (!config?.splitField || !message) return res.status(400).json({ error: 'config.splitField and message are required' });
  const splitter = new Splitter(config);
  const results = splitter.split(toESBMessage(message));
  res.json(results);
});

// Aggregator — submit messages to an aggregation group
const aggregators = new Map<string, Aggregator>();

router.post('/patterns/aggregate', (req, res) => {
  const { groupId, config, message } = req.body;
  if (!groupId || !config || !message) return res.status(400).json({ error: 'groupId, config, and message are required' });
  let agg = aggregators.get(groupId);
  if (!agg) {
    agg = new Aggregator(config);
    aggregators.set(groupId, agg);
  }
  const result = agg.add(toESBMessage(message));
  if (result) {
    aggregators.delete(groupId);
    return res.json({ completed: true, result });
  }
  res.json({ completed: false, message: 'Message added to aggregation group' });
});

// Content Filter — keep or remove fields
router.post('/patterns/content-filter', (req, res) => {
  const { mode, fields, message } = req.body;
  if (!fields || !message) return res.status(400).json({ error: 'fields and message are required' });
  const msg = toESBMessage(message);
  const result = mode === 'blacklist'
    ? ContentFilter.blacklist(msg, fields)
    : ContentFilter.whitelist(msg, fields);
  res.json(result);
});

// Content Enricher — enrich a message with provided data
router.post('/patterns/enrich', (req, res) => {
  const { targetField, enrichmentData, message } = req.body;
  if (!targetField || enrichmentData === undefined || !message) {
    return res.status(400).json({ error: 'targetField, enrichmentData, and message are required' });
  }
  const msg = toESBMessage(message);
  const newBody = { ...msg.body, [targetField]: enrichmentData };
  res.json(createMessage(newBody, {
    ...msg,
    headers: { ...msg.headers },
    metadata: { ...msg.metadata, enriched: true },
  }));
});

// Scatter-Gather — fan-out to multiple targets and aggregate responses
router.post('/patterns/scatter-gather', async (req, res) => {
  const { config, message } = req.body;
  if (!config?.targets || !message) {
    return res.status(400).json({ error: 'config.targets and message are required' });
  }
  const sg = new ScatterGather(config);
  const msg = toESBMessage(message);
  try {
    // Default handler echoes the message body per target (real usage would call external services)
    const result = await sg.execute(msg, async (target, m) => {
      return createMessage({ target, ...m.body }, {
        correlationId: m.correlationId,
        headers: { ...m.headers, target },
        metadata: { ...m.metadata },
      });
    });
    res.json(result);
  } catch (e: any) { res.status(422).json({ error: e.message }); }
});

// Wire Tap — tap a copy of a message
const wireTapInstance = new WireTap({ tapChannel: '_tap', headersOnly: false });
router.post('/patterns/wire-tap', (req, res) => {
  const { headersOnly, message } = req.body;
  if (!message) return res.status(400).json({ error: 'message is required' });
  const tap = headersOnly
    ? new WireTap({ tapChannel: '_tap', headersOnly: true })
    : wireTapInstance;
  tap.tap(toESBMessage(message));
  res.json({ tapped: true, messages: tap.tappedMessages });
});

router.get('/patterns/wire-tap/logs', (_req, res) => {
  res.json(wireTapInstance.tappedMessages);
});

// Idempotent Consumer — deduplicate messages
const idempotentConsumers = new Map<string, IdempotentConsumer>();

router.post('/patterns/idempotent', (req, res) => {
  const { consumerId, keyField, keySource, windowMs, message } = req.body;
  if (!consumerId || !message) return res.status(400).json({ error: 'consumerId and message are required' });
  let consumer = idempotentConsumers.get(consumerId);
  if (!consumer) {
    consumer = new IdempotentConsumer(keyField ?? 'id', keySource ?? 'id', windowMs);
    idempotentConsumers.set(consumerId, consumer);
  }
  const msg = toESBMessage(message);
  const isNew = consumer.tryProcess(msg);
  res.json({ duplicate: !isNew, message: isNew ? msg : null });
});

// Normalizer — normalize messages to canonical format
// Normalizer requires runtime function registration, so this endpoint
// applies a passthrough (returns the message as-is) to demonstrate the API.
router.post('/patterns/normalize', (req, res) => {
  const { message } = req.body;
  if (!message) return res.status(400).json({ error: 'message is required' });
  const normalizer = new Normalizer();
  const result = normalizer.normalize(toESBMessage(message));
  res.json(result);
});

// Saga compensate endpoint
router.post('/saga-instances/:id/compensate', async (req, res) => {
  const instance = await prisma.eSBSagaInstance.findUnique({ where: { id: req.params.id } });
  if (!instance) return res.status(404).json({ error: 'Saga instance not found' });

  const logs = JSON.parse(instance.logs);
  logs.push({ event: 'compensate_requested', timestamp: new Date().toISOString() });

  const updated = await prisma.eSBSagaInstance.update({
    where: { id: req.params.id },
    data: { status: 'compensating', logs: JSON.stringify(logs) },
  });
  res.json({ ...updated, context: JSON.parse(updated.context), logs: JSON.parse(updated.logs) });
});

export default router;
