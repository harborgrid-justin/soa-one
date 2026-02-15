import { Router } from 'express';
import { getDI } from '../services/integration';

const router = Router();

// ============================================================
// DI Connectors
// ============================================================

router.get('/connectors', (_req, res) => {
  const di = getDI();
  const connectors = di.connectors.list();
  res.json(connectors.map((c: any) => ({
    id: c.config.id,
    name: c.config.name,
    type: c.config.type,
    dialect: c.config.dialect,
    host: c.config.host,
    status: c.status,
    isConnected: c.isConnected,
  })));
});

router.get('/connectors/connected', (_req, res) => {
  const di = getDI();
  const connectors = di.connectors.getConnected();
  res.json(connectors.map((c: any) => ({
    id: c.config.id,
    name: c.config.name,
    type: c.config.type,
    status: c.status,
    isConnected: c.isConnected,
  })));
});

router.get('/connectors/states', (_req, res) => {
  const di = getDI();
  res.json(di.connectors.getStates());
});

router.get('/connectors/:id', (req, res) => {
  const di = getDI();
  const connector = di.connectors.get(String(req.params.id));
  if (!connector) return res.status(404).json({ error: 'Connector not found' });
  res.json({
    id: connector.config.id,
    name: connector.config.name,
    type: connector.config.type,
    dialect: connector.config.dialect,
    host: connector.config.host,
    status: connector.status,
    isConnected: connector.isConnected,
    config: connector.config,
  });
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

router.put('/connectors/:id', (req, res) => {
  const di = getDI();
  const id = String(req.params.id);
  const config = req.body;
  config.id = id;
  // Re-register to update
  di.connectors.register(config);
  const connector = di.connectors.get(id);
  res.json({
    id,
    name: config.name,
    type: config.type,
    status: connector?.status ?? 'disconnected',
  });
});

router.delete('/connectors/:id', async (req, res) => {
  const di = getDI();
  await di.connectors.unregister(String(req.params.id));
  res.json({ success: true });
});

router.post('/connectors/:id/test', async (req, res) => {
  const di = getDI();
  const connector = di.connectors.get(String(req.params.id));
  if (!connector) return res.status(404).json({ error: 'Connector not found' });
  try {
    const result = await connector.testConnection();
    res.json(result);
  } catch (e: any) { res.status(500).json({ success: false, error: e.message }); }
});

router.post('/connectors/connect-all', async (_req, res) => {
  const di = getDI();
  const errors = await di.connectors.connectAll();
  const errorEntries: Record<string, string> = {};
  errors.forEach((err, key) => { errorEntries[key] = err.message; });
  res.json({ success: true, errors: errorEntries });
});

router.post('/connectors/disconnect-all', async (_req, res) => {
  const di = getDI();
  await di.connectors.disconnectAll();
  res.json({ success: true });
});

router.post('/connectors/health-checks/start', (req, res) => {
  const di = getDI();
  const { intervalMs } = req.body;
  di.connectors.startHealthChecks(intervalMs);
  res.json({ success: true });
});

router.post('/connectors/health-checks/stop', (_req, res) => {
  const di = getDI();
  di.connectors.stopHealthChecks();
  res.json({ success: true });
});

router.get('/connectors/stats', (_req, res) => {
  const di = getDI();
  res.json({
    count: di.connectors.count,
    connectedCount: di.connectors.connectedCount,
    connectorIds: di.connectors.connectorIds,
  });
});

// ============================================================
// DI Pipelines
// ============================================================

router.get('/pipelines', (_req, res) => {
  const di = getDI();
  const pipelines = di.pipelines.listPipelines();
  res.json(pipelines.map((p: any) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    stageCount: p.stages?.length ?? 0,
    enabled: p.enabled,
  })));
});

router.get('/pipelines/:id', (req, res) => {
  const di = getDI();
  const pipeline = di.pipelines.getPipeline(String(req.params.id));
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

router.put('/pipelines/:id', (req, res) => {
  const di = getDI();
  const id = String(req.params.id);
  const body = req.body;
  body.id = id;
  // Re-register to update
  di.pipelines.registerPipeline(body);
  res.json(body);
});

router.delete('/pipelines/:id', (req, res) => {
  const di = getDI();
  di.pipelines.unregisterPipeline(String(req.params.id));
  res.json({ success: true });
});

router.post('/pipelines/:id/validate', (req, res) => {
  const di = getDI();
  const pipeline = di.pipelines.getPipeline(String(req.params.id));
  if (!pipeline) return res.status(404).json({ error: 'Pipeline not found' });
  const result = di.pipelines.validate(pipeline);
  res.json(result);
});

router.post('/pipelines/:id/execute', async (req, res) => {
  const di = getDI();
  const { parameters, triggeredBy } = req.body;
  const instance = await di.pipelines.execute(String(req.params.id), parameters, triggeredBy ?? 'api');
  res.status(201).json(instance);
});

router.get('/pipelines/:id/instances', (req, res) => {
  const di = getDI();
  const instances = di.pipelines.getInstancesByPipeline(String(req.params.id));
  res.json(instances.map((i: any) => ({
    instanceId: i.instanceId,
    pipelineId: i.pipelineId,
    status: i.status,
    startedAt: i.startedAt,
    completedAt: i.completedAt,
    metrics: i.metrics,
  })));
});

router.get('/pipelines/instances/:instanceId', (req, res) => {
  const di = getDI();
  const instance = di.pipelines.getInstance(String(req.params.instanceId));
  if (!instance) return res.status(404).json({ error: 'Instance not found' });
  res.json(instance);
});

router.get('/pipelines/instances', (req, res) => {
  const di = getDI();
  const { status } = req.query;
  if (status) {
    res.json(di.pipelines.getInstancesByStatus(String(status) as any));
  } else {
    res.json(di.pipelines.listPipelines().flatMap((p: any) => di.pipelines.getInstancesByPipeline(p.id)));
  }
});

router.post('/pipelines/instances/:instanceId/pause', (req, res) => {
  const di = getDI();
  di.pipelines.pause(String(req.params.instanceId));
  res.json({ success: true });
});

router.post('/pipelines/instances/:instanceId/resume', (req, res) => {
  const di = getDI();
  di.pipelines.resume(String(req.params.instanceId));
  res.json({ success: true });
});

router.post('/pipelines/instances/:instanceId/cancel', (req, res) => {
  const di = getDI();
  di.pipelines.cancel(String(req.params.instanceId));
  res.json({ success: true });
});

router.get('/pipelines/stats', (_req, res) => {
  const di = getDI();
  res.json({
    pipelineCount: di.pipelines.pipelineCount,
    activeCount: di.pipelines.activeCount,
  });
});

// ============================================================
// DI CDC Streams
// ============================================================

router.get('/cdc', (_req, res) => {
  const di = getDI();
  const states = di.cdc.getStates();
  res.json(states);
});

router.get('/cdc/:id', (req, res) => {
  const di = getDI();
  const stream = di.cdc.getStream(String(req.params.id));
  if (!stream) return res.status(404).json({ error: 'CDC stream not found' });
  res.json(stream);
});

router.post('/cdc', (req, res) => {
  const di = getDI();
  const config = req.body;
  if (!config.id || !config.name) return res.status(400).json({ error: 'id and name are required' });
  di.cdc.createStream(config);
  res.status(201).json({ id: config.id, name: config.name, status: 'idle' });
});

router.delete('/cdc/:id', async (req, res) => {
  const di = getDI();
  await di.cdc.removeStream(String(req.params.id));
  res.json({ success: true });
});

router.put('/cdc/:id/pause', (req, res) => {
  const di = getDI();
  const stream = di.cdc.getStream(String(req.params.id));
  if (!stream) return res.status(404).json({ error: 'CDC stream not found' });
  stream.pause();
  res.json({ success: true, status: 'paused' });
});

router.put('/cdc/:id/resume', (req, res) => {
  const di = getDI();
  const stream = di.cdc.getStream(String(req.params.id));
  if (!stream) return res.status(404).json({ error: 'CDC stream not found' });
  stream.resume();
  res.json({ success: true, status: 'running' });
});

router.post('/cdc/start-all', async (_req, res) => {
  const di = getDI();
  await di.cdc.startAll();
  res.json({ success: true });
});

router.post('/cdc/stop-all', async (_req, res) => {
  const di = getDI();
  await di.cdc.stopAll();
  res.json({ success: true });
});

router.get('/cdc/stats', (_req, res) => {
  const di = getDI();
  res.json({
    count: di.cdc.count,
    activeCount: di.cdc.activeCount,
    totalEventsProcessed: di.cdc.totalEventsProcessed,
    streamIds: di.cdc.streamIds,
  });
});

// ============================================================
// DI Replication
// ============================================================

router.get('/replication', (_req, res) => {
  const di = getDI();
  const states = di.replication.getStates();
  res.json(states);
});

router.get('/replication/:id', (req, res) => {
  const di = getDI();
  const stream = di.replication.getStream(String(req.params.id));
  if (!stream) return res.status(404).json({ error: 'Replication stream not found' });
  res.json(stream);
});

router.post('/replication', (req, res) => {
  const di = getDI();
  const config = req.body;
  if (!config.id || !config.name) return res.status(400).json({ error: 'id and name are required' });
  di.replication.createStream(config);
  res.status(201).json({ id: config.id, name: config.name, status: 'idle' });
});

router.delete('/replication/:id', async (req, res) => {
  const di = getDI();
  await di.replication.removeStream(String(req.params.id));
  res.json({ success: true });
});

router.put('/replication/:id/pause', (req, res) => {
  const di = getDI();
  const stream = di.replication.getStream(String(req.params.id));
  if (!stream) return res.status(404).json({ error: 'Replication stream not found' });
  stream.pause();
  res.json({ success: true, status: 'paused' });
});

router.put('/replication/:id/resume', (req, res) => {
  const di = getDI();
  const stream = di.replication.getStream(String(req.params.id));
  if (!stream) return res.status(404).json({ error: 'Replication stream not found' });
  stream.resume();
  res.json({ success: true, status: 'running' });
});

router.post('/replication/start-all', async (_req, res) => {
  const di = getDI();
  await di.replication.startAll();
  res.json({ success: true });
});

router.post('/replication/stop-all', async (_req, res) => {
  const di = getDI();
  await di.replication.stopAll();
  res.json({ success: true });
});

router.get('/replication/stats', (_req, res) => {
  const di = getDI();
  res.json({
    count: di.replication.count,
    activeCount: di.replication.activeCount,
    totalEventsApplied: di.replication.totalEventsApplied,
    totalConflicts: di.replication.totalConflicts,
    streamIds: di.replication.streamIds,
  });
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

router.put('/quality/rules/:id', (req, res) => {
  const di = getDI();
  const id = String(req.params.id);
  const body = req.body;
  body.id = id;
  // Re-register to update
  di.quality.registerRule(body);
  res.json(body);
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
  const result = di.lineage.analyzeImpact(String(req.params.nodeId), direction);
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

router.get('/catalog/all', (_req, res) => {
  const di = getDI();
  res.json(di.catalog.listEntries());
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
  const entry = di.catalog.getEntry(String(req.params.id));
  if (!entry) return res.status(404).json({ error: 'Catalog entry not found' });
  res.json(entry);
});

router.put('/catalog/:id', (req, res) => {
  const di = getDI();
  const id = String(req.params.id);
  const updated = di.catalog.updateEntry(id, req.body);
  res.json(updated);
});

router.delete('/catalog/:id', (req, res) => {
  const di = getDI();
  di.catalog.removeEntry(String(req.params.id));
  res.json({ success: true });
});

router.post('/catalog/:id/record-access', (req, res) => {
  const di = getDI();
  di.catalog.recordAccess(String(req.params.id));
  res.json({ success: true });
});

router.put('/catalog/:id/sensitivity', (req, res) => {
  const di = getDI();
  const { sensitivity } = req.body;
  if (!sensitivity) return res.status(400).json({ error: 'sensitivity is required' });
  di.catalog.classifySensitivity(String(req.params.id), sensitivity);
  res.json({ success: true });
});

router.post('/catalog/:id/auto-classify', (req, res) => {
  const di = getDI();
  const result = di.catalog.autoClassifySensitivity(String(req.params.id));
  res.json({ sensitivity: result });
});

router.get('/catalog/sensitivity/:level', (req, res) => {
  const di = getDI();
  res.json(di.catalog.getEntriesBySensitivity(String(req.params.level) as any));
});

router.get('/catalog/glossary/terms', (_req, res) => {
  const di = getDI();
  res.json(di.catalog.listGlossaryTerms());
});

router.get('/catalog/glossary/terms/:id', (req, res) => {
  const di = getDI();
  const term = di.catalog.getGlossaryTerm(String(req.params.id));
  if (!term) return res.status(404).json({ error: 'Glossary term not found' });
  res.json(term);
});

router.post('/catalog/glossary/terms', (req, res) => {
  const di = getDI();
  const term = req.body;
  if (!term.name) return res.status(400).json({ error: 'name is required' });
  const created = di.catalog.addGlossaryTerm(term);
  res.status(201).json(created);
});

router.put('/catalog/glossary/terms/:id', (req, res) => {
  const di = getDI();
  const updated = di.catalog.updateGlossaryTerm(String(req.params.id), req.body);
  res.json(updated);
});

router.delete('/catalog/glossary/terms/:id', (req, res) => {
  const di = getDI();
  di.catalog.removeGlossaryTerm(String(req.params.id));
  res.json({ success: true });
});

router.get('/catalog/glossary/search', (req, res) => {
  const di = getDI();
  const { text } = req.query;
  if (!text) return res.status(400).json({ error: 'text query is required' });
  res.json(di.catalog.searchGlossaryTerms(String(text)));
});

router.post('/catalog/glossary/terms/:termId/link/:entryId', (req, res) => {
  const di = getDI();
  di.catalog.linkTermToEntry(String(req.params.termId), String(req.params.entryId));
  res.json({ success: true });
});

router.get('/catalog/stats', (_req, res) => {
  const di = getDI();
  res.json({
    entryCount: di.catalog.entryCount,
    glossaryTermCount: di.catalog.glossaryTermCount,
  });
});

// ============================================================
// DI Scheduling
// ============================================================

router.get('/schedules', (_req, res) => {
  const di = getDI();
  const schedules = di.scheduler.listSchedules();
  res.json(schedules);
});

router.get('/schedules/:id', (req, res) => {
  const di = getDI();
  const schedule = di.scheduler.getSchedule(String(req.params.id));
  if (!schedule) return res.status(404).json({ error: 'Schedule not found' });
  res.json(schedule);
});

router.post('/schedules', (req, res) => {
  const di = getDI();
  const schedule = req.body;
  if (!schedule.id || !schedule.name) return res.status(400).json({ error: 'id and name are required' });
  di.scheduler.registerSchedule(schedule);
  res.status(201).json(schedule);
});

router.put('/schedules/:id', (req, res) => {
  const di = getDI();
  const id = String(req.params.id);
  const body = req.body;
  body.id = id;
  // Re-register to update
  di.scheduler.registerSchedule(body);
  res.json(body);
});

router.delete('/schedules/:id', (req, res) => {
  const di = getDI();
  di.scheduler.unregisterSchedule(String(req.params.id));
  res.json({ success: true });
});

router.post('/schedules/:id/enable', (req, res) => {
  const di = getDI();
  di.scheduler.enableSchedule(String(req.params.id));
  res.json({ success: true });
});

router.post('/schedules/:id/disable', (req, res) => {
  const di = getDI();
  di.scheduler.disableSchedule(String(req.params.id));
  res.json({ success: true });
});

router.post('/schedules/:id/trigger', async (req, res) => {
  const di = getDI();
  const { parameters, triggeredBy } = req.body;
  const job = await di.scheduler.trigger(String(req.params.id), parameters, triggeredBy ?? 'api');
  res.status(201).json(job);
});

router.get('/schedules/:id/jobs', (req, res) => {
  const di = getDI();
  const jobs = di.scheduler.getJobsBySchedule(String(req.params.id));
  res.json(jobs);
});

router.get('/jobs/:id', (req, res) => {
  const di = getDI();
  const job = di.scheduler.getJob(String(req.params.id));
  if (!job) return res.status(404).json({ error: 'Job not found' });
  res.json(job);
});

router.get('/jobs', (req, res) => {
  const di = getDI();
  const { status, limit } = req.query;
  if (status) {
    res.json(di.scheduler.getJobsByStatus(String(status) as any));
  } else {
    res.json(di.scheduler.getJobHistory(limit ? Number(limit) : undefined));
  }
});

router.get('/scheduler/stats', (_req, res) => {
  const di = getDI();
  res.json({
    isStarted: di.scheduler.isStarted,
    scheduleCount: di.scheduler.scheduleCount,
    activeScheduleCount: di.scheduler.activeScheduleCount,
    runningJobCount: di.scheduler.runningJobCount,
    jobsToday: di.scheduler.jobsToday,
    successfulJobsToday: di.scheduler.successfulJobsToday,
    failedJobsToday: di.scheduler.failedJobsToday,
  });
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

  const connectors = di.connectors.list().map((c: any) => ({
    id: c.config.id,
    name: c.config.name,
    type: c.config.type,
    status: c.status,
    isConnected: c.isConnected,
  }));

  const pipelines = di.pipelines.listPipelines().map((p: any) => ({
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
