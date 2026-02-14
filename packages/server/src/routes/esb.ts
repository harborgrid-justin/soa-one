import { Router } from 'express';
import { prisma } from '../prisma';
import { type AuthRequest } from '../auth/middleware';
import { createAuditLog } from './audit';

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

export default router;
