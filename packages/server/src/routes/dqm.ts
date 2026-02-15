import { Router } from 'express';
import { getDQM } from '../services/integration';

const router = Router();

// ============================================================
// DQM Topics
// ============================================================

router.get('/topics', (_req, res) => {
  const dqm = getDQM();
  const names = dqm.messaging.topicNames;
  const topics = names.map((name: string) => {
    const t = dqm.messaging.getTopic(name)!;
    const stats = t.getStats();
    return {
      name: t.name,
      type: t.type,
      subscriptionCount: t.subscriptionCount,
      messageBacklog: t.messageBacklog,
      published: stats.totalPublished,
      delivered: stats.totalDelivered,
    };
  });
  res.json(topics);
});

router.post('/topics', (req, res) => {
  const dqm = getDQM();
  const config = req.body;
  if (!config.name) return res.status(400).json({ error: 'name is required' });
  if (!config.type) config.type = 'standard';
  const topic = dqm.messaging.createTopic(config);
  res.status(201).json({ name: topic.name, type: topic.type });
});

router.delete('/topics/:name', (req, res) => {
  const dqm = getDQM();
  dqm.messaging.deleteTopic(req.params.name);
  res.json({ success: true });
});

// ============================================================
// DQM Queues
// ============================================================

router.get('/queues', (_req, res) => {
  const dqm = getDQM();
  const names = dqm.messaging.queueNames;
  const queues = names.map((name: string) => {
    const q = dqm.messaging.getQueue(name)!;
    const stats = q.getStats();
    return {
      name: q.name,
      type: q.type,
      depth: q.depth,
      deadLetterDepth: q.deadLetterDepth,
      enqueued: stats.totalEnqueued,
      dequeued: stats.totalDequeued,
    };
  });
  res.json(queues);
});

router.post('/queues', (req, res) => {
  const dqm = getDQM();
  const config = req.body;
  if (!config.name) return res.status(400).json({ error: 'name is required' });
  if (!config.type) config.type = 'standard';
  const queue = dqm.messaging.createQueue(config);
  res.status(201).json({ name: queue.name, type: queue.type });
});

router.delete('/queues/:name', (req, res) => {
  const dqm = getDQM();
  dqm.messaging.deleteQueue(req.params.name);
  res.json({ success: true });
});

// ============================================================
// DQM Quality Rules
// ============================================================

router.get('/quality/rules', (_req, res) => {
  const dqm = getDQM();
  const rules = dqm.rules.rules;
  res.json(rules);
});

router.get('/quality/rules/:id', (req, res) => {
  const dqm = getDQM();
  const rule = dqm.rules.getRule(req.params.id);
  if (!rule) return res.status(404).json({ error: 'Quality rule not found' });
  res.json(rule);
});

router.post('/quality/rules', (req, res) => {
  const dqm = getDQM();
  const rule = req.body;
  if (!rule.id || !rule.name) return res.status(400).json({ error: 'id and name are required' });
  dqm.rules.registerRule(rule);
  res.status(201).json(rule);
});

router.delete('/quality/rules/:id', (req, res) => {
  const dqm = getDQM();
  dqm.rules.unregisterRule(req.params.id);
  res.json({ success: true });
});

// ============================================================
// DQM Scoring
// ============================================================

router.get('/scoring/current', (_req, res) => {
  const dqm = getDQM();
  const score = dqm.scoring.lastScore;
  res.json(score ?? { overall: 0, grade: 'N/A', dimensions: {} });
});

router.get('/scoring/history', (_req, res) => {
  const dqm = getDQM();
  res.json(dqm.scoring.history);
});

router.get('/scoring/trend', (_req, res) => {
  const dqm = getDQM();
  res.json({ trend: dqm.scoring.trend });
});

router.get('/scoring/weights', (_req, res) => {
  const dqm = getDQM();
  res.json(dqm.scoring.weights);
});

// ============================================================
// DQM Cleansing Rules
// ============================================================

router.get('/cleansing/rules', (_req, res) => {
  const dqm = getDQM();
  res.json(dqm.cleansing.rules);
});

router.get('/cleansing/rules/:id', (req, res) => {
  const dqm = getDQM();
  const rule = dqm.cleansing.getRule(req.params.id);
  if (!rule) return res.status(404).json({ error: 'Cleansing rule not found' });
  res.json(rule);
});

router.post('/cleansing/rules', (req, res) => {
  const dqm = getDQM();
  const rule = req.body;
  if (!rule.id || !rule.name) return res.status(400).json({ error: 'id and name are required' });
  dqm.cleansing.registerRule(rule);
  res.status(201).json(rule);
});

router.delete('/cleansing/rules/:id', (req, res) => {
  const dqm = getDQM();
  dqm.cleansing.unregisterRule(req.params.id);
  res.json({ success: true });
});

// ============================================================
// DQM Record Matching
// ============================================================

router.get('/matching/rules', (_req, res) => {
  const dqm = getDQM();
  res.json(dqm.matching.rules);
});

router.get('/matching/rules/:id', (req, res) => {
  const dqm = getDQM();
  const rule = dqm.matching.getRule(req.params.id);
  if (!rule) return res.status(404).json({ error: 'Match rule not found' });
  res.json(rule);
});

router.post('/matching/rules', (req, res) => {
  const dqm = getDQM();
  const rule = req.body;
  if (!rule.id || !rule.name) return res.status(400).json({ error: 'id and name are required' });
  dqm.matching.registerRule(rule);
  res.status(201).json(rule);
});

router.delete('/matching/rules/:id', (req, res) => {
  const dqm = getDQM();
  dqm.matching.unregisterRule(req.params.id);
  res.json({ success: true });
});

// ============================================================
// DQM Profiling
// ============================================================

router.post('/profiling/dataset', (req, res) => {
  const dqm = getDQM();
  const { name, rows, options } = req.body;
  if (!name || !rows) return res.status(400).json({ error: 'name and rows are required' });
  const profile = dqm.profiler.profileDataset(name, rows, options);
  res.json(profile);
});

router.post('/profiling/column', (req, res) => {
  const dqm = getDQM();
  const { name, values } = req.body;
  if (!name || !values) return res.status(400).json({ error: 'name and values are required' });
  const profile = dqm.profiler.profileColumn(name, values);
  res.json(profile);
});

// ============================================================
// DQM Monitoring / Alerts
// ============================================================

router.get('/monitoring/alerts', (_req, res) => {
  const dqm = getDQM();
  res.json(dqm.monitoring.alerts.activeAlerts);
});

router.post('/monitoring/alerts/:id/acknowledge', (req, res) => {
  const dqm = getDQM();
  dqm.monitoring.alerts.acknowledge(req.params.id);
  res.json({ success: true });
});

router.post('/monitoring/alerts/:id/resolve', (req, res) => {
  const dqm = getDQM();
  dqm.monitoring.alerts.resolve(req.params.id);
  res.json({ success: true });
});

router.get('/monitoring/alert-rules', (_req, res) => {
  const dqm = getDQM();
  res.json({ ruleCount: dqm.monitoring.alerts.ruleCount, activeAlerts: dqm.monitoring.alerts.activeCount });
});

// ============================================================
// DQM Security / Audit
// ============================================================

router.get('/security/audit', (req, res) => {
  const dqm = getDQM();
  const { action, actor, limit } = req.query;
  const entries = dqm.security.audit.query({
    action: action ? String(action) : undefined,
    actor: actor ? String(actor) : undefined,
  });
  const maxResults = Math.min(Number(limit) || 50, 200);
  res.json(entries.slice(-maxResults));
});

router.get('/security/policies', (_req, res) => {
  const dqm = getDQM();
  res.json(dqm.security.accessControl.policies);
});

router.get('/security/masking-rules', (_req, res) => {
  const dqm = getDQM();
  res.json(dqm.security.masker.rules);
});

// ============================================================
// DQM Metrics / Dashboard
// ============================================================

router.get('/metrics', (_req, res) => {
  const dqm = getDQM();
  const metrics = dqm.getMetrics();
  const messagingStats = dqm.messaging.getStats();

  res.json({
    summary: {
      totalQualityRules: metrics.totalQualityRules,
      activeQualityRules: metrics.activeQualityRules,
      totalCleansingRules: metrics.totalCleansingRules,
      totalMatchRules: metrics.totalMatchRules,
      totalTopics: metrics.totalTopics,
      activeTopics: metrics.activeTopics,
      totalQueues: metrics.totalQueues,
      activeQueues: metrics.activeQueues,
      totalSubscriptions: metrics.totalSubscriptions,
      messagesPublished: metrics.messagesPublished,
      messagesDelivered: metrics.messagesDelivered,
      messagesDeadLettered: metrics.messagesDeadLettered,
      profilesExecuted: metrics.profilesExecuted,
      validationsExecuted: metrics.validationsExecuted,
      cleansingOperationsExecuted: metrics.cleansingOperationsExecuted,
      matchOperationsExecuted: metrics.matchOperationsExecuted,
      currentQualityScore: metrics.currentQualityScore,
      currentQualityGrade: metrics.currentQualityGrade,
      activeAlerts: metrics.activeAlerts,
      uptimeMs: metrics.uptimeMs,
    },
    topics: messagingStats.topics,
    queues: messagingStats.queues,
  });
});

export default router;
