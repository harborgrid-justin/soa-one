import { Router } from 'express';
import { getDI } from '../services/integration';

const router = Router();

// ============================================================
// DI Connectors
// ============================================================

router.get('/connectors', (_req, res) => {
  const di = getDI();
  const connectors = di.connectors.list();
  res.json(connectors.map((c) => ({
    id: c.config.id,
    name: c.config.name,
    type: c.config.type,
    dialect: c.config.dialect,
    host: c.config.host,
    status: c.status,
    isConnected: c.isConnected,
  })));
});

router.post('/connectors', (req, res) => {
  const di = getDI();
  const config = req.body;
  if (!config.name || !config.type) return res.status(400).json({ error: 'name and type are required' });
  if (!config.id) config.id = `conn-${Date.now()}`;
  di.connectors.register(config);
  const connector = di.connectors.get(config.id);
  res.status(201).json({
    id: config.id,
    name: config.name,
    type: config.type,
    status: connector?.status ?? 'disconnected',
  });
});

router.delete('/connectors/:id', (req, res) => {
  const di = getDI();
  di.connectors.unregister(req.params.id);
  res.json({ success: true });
});

// ============================================================
// DI Pipelines
// ============================================================

router.get('/pipelines', (_req, res) => {
  const di = getDI();
  const pipelines = di.pipelines.listPipelines();
  res.json(pipelines.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    stageCount: p.stages?.length ?? 0,
    enabled: p.enabled,
  })));
});

router.get('/pipelines/:id', (req, res) => {
  const di = getDI();
  const pipeline = di.pipelines.getPipeline(req.params.id);
  if (!pipeline) return res.status(404).json({ error: 'Pipeline not found' });
  res.json(pipeline);
});

router.post('/pipelines', (req, res) => {
  const di = getDI();
  const definition = req.body;
  if (!definition.id || !definition.name) return res.status(400).json({ error: 'id and name are required' });
  di.pipelines.registerPipeline(definition);
  res.status(201).json(definition);
});

router.delete('/pipelines/:id', (req, res) => {
  const di = getDI();
  di.pipelines.unregisterPipeline(req.params.id);
  res.json({ success: true });
});

router.get('/pipelines/:id/instances', (req, res) => {
  const di = getDI();
  const instances = di.pipelines.getInstancesByPipeline(req.params.id);
  res.json(instances.map((i) => ({
    instanceId: i.instanceId,
    pipelineId: i.pipelineId,
    status: i.status,
    startedAt: i.startedAt,
    completedAt: i.completedAt,
    metrics: i.metrics,
  })));
});

// ============================================================
// DI CDC Streams
// ============================================================

router.get('/cdc', (_req, res) => {
  const di = getDI();
  const states = di.cdc.getStates();
  res.json(states);
});

router.post('/cdc', (req, res) => {
  const di = getDI();
  const config = req.body;
  if (!config.id || !config.name) return res.status(400).json({ error: 'id and name are required' });
  di.cdc.createStream(config);
  res.status(201).json({ id: config.id, name: config.name, status: 'idle' });
});

router.delete('/cdc/:id', (req, res) => {
  const di = getDI();
  di.cdc.removeStream(req.params.id);
  res.json({ success: true });
});

// ============================================================
// DI Replication
// ============================================================

router.get('/replication', (_req, res) => {
  const di = getDI();
  const states = di.replication.getStates();
  res.json(states);
});

router.post('/replication', (req, res) => {
  const di = getDI();
  const config = req.body;
  if (!config.id || !config.name) return res.status(400).json({ error: 'id and name are required' });
  di.replication.createStream(config);
  res.status(201).json({ id: config.id, name: config.name, status: 'idle' });
});

router.delete('/replication/:id', (req, res) => {
  const di = getDI();
  di.replication.removeStream(req.params.id);
  res.json({ success: true });
});

// ============================================================
// DI Quality
// ============================================================

router.get('/quality/rules', (_req, res) => {
  const di = getDI();
  const rules = di.quality.listRules();
  res.json(rules);
});

router.get('/quality/score', (_req, res) => {
  const di = getDI();
  const score = di.quality.lastScore;
  res.json(score ?? { overall: 0, dimensions: {} });
});

router.post('/quality/rules', (req, res) => {
  const di = getDI();
  const rule = req.body;
  if (!rule.id || !rule.name) return res.status(400).json({ error: 'id and name are required' });
  di.quality.registerRule(rule);
  res.status(201).json(rule);
});

// ============================================================
// DI Lineage
// ============================================================

router.get('/lineage/nodes', (_req, res) => {
  const di = getDI();
  const graph = di.lineage.getGraph();
  res.json({ nodes: graph.nodes, edges: graph.edges });
});

router.post('/lineage/nodes', (req, res) => {
  const di = getDI();
  const node = req.body;
  if (!node.id || !node.name) return res.status(400).json({ error: 'id and name are required' });
  di.lineage.addNode(node);
  res.status(201).json(node);
});

router.get('/lineage/impact/:nodeId', (req, res) => {
  const di = getDI();
  const direction = (req.query.direction as string) === 'upstream' ? 'upstream' : 'downstream';
  const result = di.lineage.analyzeImpact(req.params.nodeId, direction);
  res.json(result);
});

// ============================================================
// DI Catalog
// ============================================================

router.get('/catalog', (req, res) => {
  const di = getDI();
  const { text, type, sensitivity, owner, limit } = req.query;
  const results = di.catalog.search({
    text: text ? String(text) : undefined,
    type: type as any,
    sensitivity: sensitivity as any,
    owner: owner ? String(owner) : undefined,
    limit: limit ? Number(limit) : 50,
  });
  res.json(results);
});

router.post('/catalog', (req, res) => {
  const di = getDI();
  const entry = req.body;
  if (!entry.name || !entry.type) return res.status(400).json({ error: 'name and type are required' });
  const created = di.catalog.registerEntry(entry);
  res.status(201).json(created);
});

router.get('/catalog/:id', (req, res) => {
  const di = getDI();
  const entry = di.catalog.getEntry(req.params.id);
  if (!entry) return res.status(404).json({ error: 'Catalog entry not found' });
  res.json(entry);
});

router.delete('/catalog/:id', (req, res) => {
  const di = getDI();
  di.catalog.removeEntry(req.params.id);
  res.json({ success: true });
});

router.get('/catalog/glossary/terms', (_req, res) => {
  const di = getDI();
  res.json(di.catalog.listGlossaryTerms());
});

// ============================================================
// DI Scheduling
// ============================================================

router.get('/schedules', (_req, res) => {
  const di = getDI();
  const schedules = di.scheduler.listSchedules();
  res.json(schedules);
});

router.post('/schedules', (req, res) => {
  const di = getDI();
  const schedule = req.body;
  if (!schedule.id || !schedule.name) return res.status(400).json({ error: 'id and name are required' });
  di.scheduler.registerSchedule(schedule);
  res.status(201).json(schedule);
});

router.get('/schedules/:id/jobs', (req, res) => {
  const di = getDI();
  const jobs = di.scheduler.getJobsBySchedule(req.params.id);
  res.json(jobs);
});

// ============================================================
// DI Monitoring
// ============================================================

router.get('/monitoring/alerts', (_req, res) => {
  const di = getDI();
  const alerts = di.monitoring.alerts.getActiveAlerts();
  res.json(alerts);
});

router.get('/monitoring/health', (_req, res) => {
  const di = getDI();
  const health = di.monitoring.health.getAllHealth();
  res.json(health);
});

// ============================================================
// DI Security / Audit
// ============================================================

router.get('/security/audit', (req, res) => {
  const di = getDI();
  const { action, actor, limit } = req.query;
  const entries = di.security.audit.searchAuditLog({
    action: action ? String(action) : undefined,
    actor: actor ? String(actor) : undefined,
  });
  const maxResults = Math.min(Number(limit) || 50, 200);
  res.json(entries.slice(-maxResults));
});

router.get('/security/policies', (_req, res) => {
  const di = getDI();
  res.json(di.security.accessControl.listPolicies());
});

router.get('/security/masking-rules', (_req, res) => {
  const di = getDI();
  res.json(di.security.masker.listRules());
});

// ============================================================
// DI Metrics / Dashboard
// ============================================================

router.get('/metrics', (_req, res) => {
  const di = getDI();
  const metrics = di.getMetrics();

  const connectors = di.connectors.list().map((c) => ({
    id: c.config.id,
    name: c.config.name,
    type: c.config.type,
    status: c.status,
    isConnected: c.isConnected,
  }));

  const pipelines = di.pipelines.listPipelines().map((p) => ({
    id: p.id,
    name: p.name,
    enabled: p.enabled,
    stageCount: p.stages?.length ?? 0,
  }));

  const cdcStreams = di.cdc.getStates();
  const replicationStreams = di.replication.getStates();

  res.json({
    summary: {
      totalConnectors: metrics.totalConnectors,
      activeConnectors: metrics.activeConnectors,
      totalPipelines: metrics.totalPipelines,
      activePipelines: metrics.activePipelines,
      totalCDCStreams: metrics.totalCDCStreams,
      activeCDCStreams: metrics.activeCDCStreams,
      totalReplicationStreams: metrics.totalReplicationStreams,
      activeReplicationStreams: metrics.activeReplicationStreams,
      totalSchedules: metrics.totalSchedules,
      activeAlerts: metrics.activeAlerts,
      catalogEntries: metrics.catalogEntries,
      lineageNodes: metrics.lineageNodes,
      qualityScore: metrics.qualityScore,
      uptimeMs: metrics.uptimeMs,
    },
    connectors,
    pipelines,
    cdcStreams,
    replicationStreams,
  });
});

export default router;
