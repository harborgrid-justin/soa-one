import { Router } from 'express';
import { getSOA } from '../services/integration';

const router = Router();

// ============================================================
// SOA Services (Registry)
// ============================================================

router.get('/services', (req, res) => {
  const soa = getSOA();
  const { status } = req.query;
  let services;
  if (status) {
    services = soa.registry.getServicesByStatus(String(status) as any);
  } else {
    services = soa.registry.allServices;
  }
  res.json(services.map((s: any) => ({
    id: s.id,
    name: s.name,
    version: s.version,
    status: s.status,
    endpointCount: s.endpoints.length,
    contractCount: s.contracts.length,
    dependencyCount: s.dependencies.length,
    tags: s.tags,
  })));
});

router.get('/services/:id', (req, res) => {
  const soa = getSOA();
  const service = soa.registry.get(String(req.params.id));
  if (!service) return res.status(404).json({ error: 'Service not found' });
  res.json(service);
});

router.post('/services', (req, res) => {
  const soa = getSOA();
  const service = req.body;
  if (!service.name) return res.status(400).json({ error: 'name is required' });
  const registered = soa.registry.register(service);
  res.status(201).json(registered);
});

router.put('/services/:id', (req, res) => {
  const soa = getSOA();
  const id = String(req.params.id);
  // SDK has no update method; re-register with same ID to overwrite
  const body = req.body;
  body.id = id;
  const updated = soa.registry.register(body);
  res.json(updated);
});

router.delete('/services/:id', (req, res) => {
  const soa = getSOA();
  soa.registry.deregister(String(req.params.id));
  res.json({ success: true });
});

router.put('/services/:id/status', (req, res) => {
  const soa = getSOA();
  const { status } = req.body;
  if (!status) return res.status(400).json({ error: 'status is required' });
  const ok = soa.registry.updateStatus(String(req.params.id), status);
  if (!ok) return res.status(404).json({ error: 'Service not found' });
  res.json({ success: true, status });
});

router.post('/services/:id/endpoints', (req, res) => {
  const soa = getSOA();
  const endpoint = req.body;
  if (!endpoint.uri) return res.status(400).json({ error: 'uri is required' });
  const ok = soa.registry.addEndpoint(String(req.params.id), endpoint);
  if (!ok) return res.status(404).json({ error: 'Service not found' });
  res.status(201).json({ success: true });
});

router.delete('/services/:id/endpoints/:uri', (req, res) => {
  const soa = getSOA();
  const ok = soa.registry.removeEndpoint(String(req.params.id), decodeURIComponent(String(req.params.uri)));
  if (!ok) return res.status(404).json({ error: 'Service or endpoint not found' });
  res.json({ success: true });
});

router.get('/services/:id/endpoints/healthy', (req, res) => {
  const soa = getSOA();
  const endpoints = soa.registry.getHealthyEndpoints(String(req.params.id));
  res.json(endpoints);
});

router.post('/services/:id/contracts', (req, res) => {
  const soa = getSOA();
  const contract = soa.registry.addContract(String(req.params.id), req.body);
  if (!contract) return res.status(404).json({ error: 'Service not found' });
  res.status(201).json(contract);
});

router.get('/services/:id/contract/active', (req, res) => {
  const soa = getSOA();
  const contract = soa.registry.getActiveContract(String(req.params.id));
  if (!contract) return res.status(404).json({ error: 'No active contract' });
  res.json(contract);
});

router.post('/services/:id/health-check', (req, res) => {
  const soa = getSOA();
  const { uri, healthy, responseTimeMs } = req.body;
  if (!uri) return res.status(400).json({ error: 'uri is required' });
  const ok = soa.registry.recordHealthCheck(String(req.params.id), uri, healthy ?? true, responseTimeMs ?? 0);
  if (!ok) return res.status(404).json({ error: 'Service not found' });
  res.json({ success: true });
});

router.get('/services/:id/dependencies', (req, res) => {
  const soa = getSOA();
  const graph = soa.registry.getDependencyGraph(String(req.params.id));
  if (!graph) return res.status(404).json({ error: 'Service not found' });
  res.json(graph);
});

// ============================================================
// SOA BPEL Processes
// ============================================================

router.get('/processes', (_req, res) => {
  const soa = getSOA();
  const defs = soa.bpel.allProcesses;
  res.json(defs.map((p: any) => ({
    id: p.id,
    name: p.name,
    version: p.version,
    status: p.status,
    scopeCount: p.scopes?.length ?? 0,
  })));
});

router.get('/processes/:id', (req, res) => {
  const soa = getSOA();
  const def = soa.bpel.getProcess(String(req.params.id));
  if (!def) return res.status(404).json({ error: 'Process not found' });
  res.json(def);
});

router.post('/processes', (req, res) => {
  const soa = getSOA();
  const def = req.body;
  if (!def.id || !def.name) return res.status(400).json({ error: 'id and name are required' });
  soa.bpel.deployProcess(def);
  res.status(201).json(def);
});

router.put('/processes/:id', (req, res) => {
  const soa = getSOA();
  const id = String(req.params.id);
  const body = req.body;
  body.id = id;
  // Re-deploy to update
  soa.bpel.deployProcess(body);
  res.json(body);
});

router.delete('/processes/:id', (req, res) => {
  const soa = getSOA();
  soa.bpel.undeployProcess(String(req.params.id));
  res.json({ success: true });
});

router.get('/processes/:id/instances', (req, res) => {
  const soa = getSOA();
  const instances = soa.bpel.getInstancesByProcess(String(req.params.id));
  res.json(instances);
});

router.post('/processes/:id/start', async (req, res) => {
  const soa = getSOA();
  const { input, initiator } = req.body;
  const instance = await soa.bpel.startProcess(String(req.params.id), input ?? {}, initiator ?? 'api');
  res.status(201).json(instance);
});

router.get('/instances', (req, res) => {
  const soa = getSOA();
  const { status } = req.query;
  if (status) {
    res.json(soa.bpel.getInstancesByStatus(String(status) as any));
  } else {
    res.json(soa.bpel.allProcesses.flatMap((p: any) => soa.bpel.getInstancesByProcess(p.id)));
  }
});

router.get('/instances/:id', (req, res) => {
  const soa = getSOA();
  const instance = soa.bpel.getInstance(String(req.params.id));
  if (!instance) return res.status(404).json({ error: 'Instance not found' });
  res.json(instance);
});

router.post('/instances/:id/suspend', async (req, res) => {
  const soa = getSOA();
  await soa.bpel.suspendInstance(String(req.params.id));
  res.json({ success: true });
});

router.post('/instances/:id/resume', async (req, res) => {
  const soa = getSOA();
  await soa.bpel.resumeInstance(String(req.params.id));
  res.json({ success: true });
});

router.post('/instances/:id/terminate', async (req, res) => {
  const soa = getSOA();
  await soa.bpel.terminateInstance(String(req.params.id));
  res.json({ success: true });
});

router.post('/instances/:id/compensate', async (req, res) => {
  const soa = getSOA();
  await soa.bpel.compensateInstance(String(req.params.id));
  res.json({ success: true });
});

// Nested process-instance routes
router.get('/processes/:pId/instances/:iId', (req, res) => {
  const soa = getSOA();
  const instance = soa.bpel.getInstance(String(req.params.iId));
  if (!instance) return res.status(404).json({ error: 'Instance not found' });
  res.json(instance);
});

router.post('/processes/:pId/instances/:iId/suspend', async (req, res) => {
  const soa = getSOA();
  await soa.bpel.suspendInstance(String(req.params.iId));
  res.json({ success: true });
});

router.post('/processes/:pId/instances/:iId/resume', async (req, res) => {
  const soa = getSOA();
  await soa.bpel.resumeInstance(String(req.params.iId));
  res.json({ success: true });
});

router.post('/processes/:pId/instances/:iId/terminate', async (req, res) => {
  const soa = getSOA();
  await soa.bpel.terminateInstance(String(req.params.iId));
  res.json({ success: true });
});

router.post('/processes/:pId/instances/:iId/compensate', async (req, res) => {
  const soa = getSOA();
  await soa.bpel.compensateInstance(String(req.params.iId));
  res.json({ success: true });
});

// ============================================================
// SOA Human Tasks
// ============================================================

router.get('/tasks', (req, res) => {
  const soa = getSOA();
  const { status, owner, potentialOwner } = req.query;
  let tasks;
  if (status) {
    tasks = soa.tasks.getTasksByStatus(String(status) as any);
  } else if (owner) {
    tasks = soa.tasks.getTasksByOwner(String(owner));
  } else if (potentialOwner) {
    tasks = soa.tasks.getTasksByPotentialOwner(String(potentialOwner));
  } else {
    tasks = soa.tasks.allTasks;
  }
  res.json(tasks.map((t: any) => ({
    id: t.id,
    definitionId: t.definitionId,
    title: t.title,
    status: t.status,
    priority: t.priority,
    assignee: t.assignee,
    createdAt: t.createdAt,
    dueDate: t.dueDate,
  })));
});

router.get('/tasks/overdue', (_req, res) => {
  const soa = getSOA();
  res.json(soa.tasks.getOverdueTasks());
});

router.get('/tasks/expired', (_req, res) => {
  const soa = getSOA();
  res.json(soa.tasks.getExpiredTasks());
});

router.get('/tasks/:id', (req, res) => {
  const soa = getSOA();
  const task = soa.tasks.getTask(String(req.params.id));
  if (!task) return res.status(404).json({ error: 'Task not found' });
  res.json(task);
});

router.post('/tasks', (req, res) => {
  const soa = getSOA();
  const { definitionId, input, processInstanceId, activityId } = req.body;
  if (!definitionId) return res.status(400).json({ error: 'definitionId is required' });
  const task = soa.tasks.createTask(definitionId, input ?? {}, processInstanceId, activityId);
  res.status(201).json(task);
});

router.post('/tasks/:id/claim', (req, res) => {
  const soa = getSOA();
  const { assignee } = req.body;
  const task = soa.tasks.claimTask(String(req.params.id), assignee ?? 'api-user');
  res.json(task);
});

router.post('/tasks/:id/start', (req, res) => {
  const soa = getSOA();
  const { userId } = req.body;
  const task = soa.tasks.startTask(String(req.params.id), userId ?? 'api-user');
  res.json(task);
});

router.post('/tasks/:id/complete', (req, res) => {
  const soa = getSOA();
  const { userId, output, outcome } = req.body;
  const task = soa.tasks.completeTask(String(req.params.id), userId ?? 'api-user', output ?? {}, outcome ?? 'completed');
  res.json(task);
});

router.post('/tasks/:id/fail', (req, res) => {
  const soa = getSOA();
  const { userId, reason } = req.body;
  const task = soa.tasks.failTask(String(req.params.id), userId ?? 'api-user', reason ?? 'Failed via API');
  res.json(task);
});

router.post('/tasks/:id/delegate', (req, res) => {
  const soa = getSOA();
  const { fromUser, toUser } = req.body;
  if (!toUser) return res.status(400).json({ error: 'toUser is required' });
  const task = soa.tasks.delegateTask(String(req.params.id), fromUser ?? 'api-user', toUser);
  res.json(task);
});

router.post('/tasks/:id/suspend', (req, res) => {
  const soa = getSOA();
  const task = soa.tasks.suspendTask(String(req.params.id));
  res.json(task);
});

router.post('/tasks/:id/resume', (req, res) => {
  const soa = getSOA();
  const task = soa.tasks.resumeTask(String(req.params.id));
  res.json(task);
});

router.post('/tasks/:id/escalate', (req, res) => {
  const soa = getSOA();
  const task = soa.tasks.escalateTask(String(req.params.id));
  res.json(task);
});

router.post('/tasks/:id/comments', (req, res) => {
  const soa = getSOA();
  const { author, text } = req.body;
  if (!text) return res.status(400).json({ error: 'text is required' });
  const comment = soa.tasks.addComment(String(req.params.id), author ?? 'api-user', text);
  res.status(201).json(comment);
});

router.post('/tasks/:id/attachments', (req, res) => {
  const soa = getSOA();
  const { name, mimeType, content, addedBy } = req.body;
  if (!name || !content) return res.status(400).json({ error: 'name and content are required' });
  const attachment = soa.tasks.addAttachment(String(req.params.id), name, mimeType ?? 'application/octet-stream', content, addedBy ?? 'api-user');
  res.status(201).json(attachment);
});

router.get('/tasks/:id/comments', (req, res) => {
  const soa = getSOA();
  res.json(soa.tasks.getComments(String(req.params.id)));
});

router.get('/tasks/:id/attachments', (req, res) => {
  const soa = getSOA();
  res.json(soa.tasks.getAttachments(String(req.params.id)));
});

router.put('/tasks/:id', (req, res) => {
  const soa = getSOA();
  try {
    res.json(soa.tasks.updateTask(String(req.params.id), req.body));
  } catch (e: any) { res.status(404).json({ error: e.message }); }
});

router.delete('/tasks/:id', (req, res) => {
  const soa = getSOA();
  const ok = soa.tasks.removeTask(String(req.params.id));
  if (!ok) return res.status(404).json({ error: 'Task not found' });
  res.json({ success: true });
});

router.get('/task-definitions', (_req, res) => {
  const soa = getSOA();
  res.json(soa.tasks.allDefinitions);
});

router.get('/task-definitions/:id', (req, res) => {
  const soa = getSOA();
  const def = soa.tasks.getDefinition(String(req.params.id));
  if (!def) return res.status(404).json({ error: 'Definition not found' });
  res.json(def);
});

router.post('/task-definitions', (req, res) => {
  const soa = getSOA();
  const def = req.body;
  if (!def.id || !def.name) return res.status(400).json({ error: 'id and name are required' });
  soa.tasks.registerDefinition(def);
  res.status(201).json(def);
});

router.put('/task-definitions/:id', (req, res) => {
  const soa = getSOA();
  try {
    res.json(soa.tasks.updateDefinition(String(req.params.id), req.body));
  } catch (e: any) { res.status(404).json({ error: e.message }); }
});

router.delete('/task-definitions/:id', (req, res) => {
  const soa = getSOA();
  const ok = soa.tasks.removeDefinition(String(req.params.id));
  if (!ok) return res.status(404).json({ error: 'Definition not found' });
  res.json({ success: true });
});

router.get('/tasks-stats', (_req, res) => {
  const soa = getSOA();
  res.json({
    definitionCount: soa.tasks.definitionCount,
    instanceCount: soa.tasks.instanceCount,
    pendingCount: soa.tasks.pendingCount,
    inProgressCount: soa.tasks.inProgressCount,
    completedCount: soa.tasks.completedCount,
    overdueCount: soa.tasks.overdueCount,
  });
});

// ============================================================
// SOA CEP (Complex Event Processing)
// ============================================================

router.get('/cep/rules', (_req, res) => {
  const soa = getSOA();
  res.json(soa.cep.allRules);
});

router.get('/cep/rules/:id', (req, res) => {
  const soa = getSOA();
  const rule = soa.cep.getRule(String(req.params.id));
  if (!rule) return res.status(404).json({ error: 'CEP rule not found' });
  res.json(rule);
});

router.post('/cep/rules', (req, res) => {
  const soa = getSOA();
  const rule = req.body;
  if (!rule.id || !rule.name) return res.status(400).json({ error: 'id and name are required' });
  soa.cep.registerRule(rule);
  res.status(201).json(rule);
});

router.put('/cep/rules/:id', (req, res) => {
  const soa = getSOA();
  const id = String(req.params.id);
  const body = req.body;
  body.id = id;
  // registerRule overwrites by ID
  soa.cep.registerRule(body);
  res.json(body);
});

router.delete('/cep/rules/:id', (req, res) => {
  const soa = getSOA();
  const ok = soa.cep.removeRule(String(req.params.id));
  if (!ok) return res.status(404).json({ error: 'CEP rule not found' });
  res.json({ success: true });
});

router.post('/cep/events', (req, res) => {
  const soa = getSOA();
  const event = req.body;
  const matches = soa.cep.processEvent(event);
  res.json({ processed: true, matchCount: matches.length, matches });
});

router.post('/cep/events/batch', (req, res) => {
  const soa = getSOA();
  const events = req.body;
  if (!Array.isArray(events)) return res.status(400).json({ error: 'body must be an array of events' });
  const matches = soa.cep.processBatch(events);
  res.json({ processed: true, eventCount: events.length, matchCount: matches.length, matches });
});

// ============================================================
// SOA B2B Gateway
// ============================================================

router.get('/b2b/partners', (_req, res) => {
  const soa = getSOA();
  res.json(soa.b2b.allPartners);
});

router.get('/b2b/partners/active', (_req, res) => {
  const soa = getSOA();
  res.json(soa.b2b.getActivePartners());
});

router.get('/b2b/partners/:id', (req, res) => {
  const soa = getSOA();
  const partner = soa.b2b.getPartner(String(req.params.id));
  if (!partner) return res.status(404).json({ error: 'Partner not found' });
  res.json(partner);
});

router.get('/b2b/partners/code/:code', (req, res) => {
  const soa = getSOA();
  const partner = soa.b2b.getPartnerByCode(String(req.params.code));
  if (!partner) return res.status(404).json({ error: 'Partner not found' });
  res.json(partner);
});

router.post('/b2b/partners', (req, res) => {
  const soa = getSOA();
  const partner = req.body;
  if (!partner.id || !partner.name) return res.status(400).json({ error: 'id and name are required' });
  soa.b2b.registerPartner(partner);
  res.status(201).json(partner);
});

router.put('/b2b/partners/:id', (req, res) => {
  const soa = getSOA();
  const id = String(req.params.id);
  const body = req.body;
  body.id = id;
  // Re-register to update
  soa.b2b.registerPartner(body);
  res.json(body);
});

router.put('/b2b/partners/:id/status', (req, res) => {
  const soa = getSOA();
  const { status } = req.body;
  if (!status) return res.status(400).json({ error: 'status is required' });
  soa.b2b.updatePartnerStatus(String(req.params.id), status);
  res.json({ success: true, status });
});

router.delete('/b2b/partners/:id', (req, res) => {
  const soa = getSOA();
  const ok = soa.b2b.removePartner(String(req.params.id));
  if (!ok) return res.status(404).json({ error: 'Partner not found' });
  res.json({ success: true });
});

router.get('/b2b/agreements', (_req, res) => {
  const soa = getSOA();
  res.json(soa.b2b.allAgreements);
});

router.get('/b2b/agreements/active', (_req, res) => {
  const soa = getSOA();
  res.json(soa.b2b.getActiveAgreements());
});

router.get('/b2b/agreements/:id', (req, res) => {
  const soa = getSOA();
  const agreement = soa.b2b.getAgreement(String(req.params.id));
  if (!agreement) return res.status(404).json({ error: 'Agreement not found' });
  res.json(agreement);
});

router.get('/b2b/partners/:id/agreements', (req, res) => {
  const soa = getSOA();
  res.json(soa.b2b.getAgreementsByPartner(String(req.params.id)));
});

router.post('/b2b/agreements', (req, res) => {
  const soa = getSOA();
  const agreement = req.body;
  if (!agreement.id || !agreement.partnerId) return res.status(400).json({ error: 'id and partnerId are required' });
  soa.b2b.registerAgreement(agreement);
  res.status(201).json(agreement);
});

router.put('/b2b/agreements/:id', (req, res) => {
  const soa = getSOA();
  try {
    res.json(soa.b2b.updateAgreement(String(req.params.id), req.body));
  } catch (e: any) { res.status(404).json({ error: e.message }); }
});

router.delete('/b2b/agreements/:id', (req, res) => {
  const soa = getSOA();
  const ok = soa.b2b.removeAgreement(String(req.params.id));
  if (!ok) return res.status(404).json({ error: 'Agreement not found' });
  res.json({ success: true });
});

router.get('/b2b/exchanges', (req, res) => {
  const soa = getSOA();
  const { partnerId, status, limit } = req.query;
  let exchanges;
  if (partnerId) {
    exchanges = soa.b2b.getExchangesByPartner(String(partnerId), limit ? Number(limit) : undefined);
  } else if (status) {
    exchanges = soa.b2b.getExchangesByStatus(String(status) as any);
  } else {
    exchanges = soa.b2b.allExchanges;
  }
  res.json(exchanges);
});

router.get('/b2b/exchanges/:id', (req, res) => {
  const soa = getSOA();
  const exchange = soa.b2b.getExchange(String(req.params.id));
  if (!exchange) return res.status(404).json({ error: 'Exchange not found' });
  res.json(exchange);
});

router.post('/b2b/exchanges/send', (req, res) => {
  const soa = getSOA();
  const { partnerId, agreementId, documentType, content, format, metadata } = req.body;
  if (!partnerId || !agreementId || !content) return res.status(400).json({ error: 'partnerId, agreementId, and content are required' });
  const exchange = soa.b2b.sendDocument(partnerId, agreementId, documentType ?? 'generic', content, format ?? 'xml', metadata);
  res.status(201).json(exchange);
});

router.post('/b2b/exchanges/receive', (req, res) => {
  const soa = getSOA();
  const { partnerId, agreementId, documentType, content, format, metadata } = req.body;
  if (!partnerId || !agreementId || !content) return res.status(400).json({ error: 'partnerId, agreementId, and content are required' });
  const exchange = soa.b2b.receiveDocument(partnerId, agreementId, documentType ?? 'generic', content, format ?? 'xml', metadata);
  res.status(201).json(exchange);
});

router.post('/b2b/exchanges/:id/acknowledge', (req, res) => {
  const soa = getSOA();
  soa.b2b.acknowledgeExchange(String(req.params.id));
  res.json({ success: true });
});

router.get('/b2b/stats', (_req, res) => {
  const soa = getSOA();
  res.json({
    partnerCount: soa.b2b.partnerCount,
    activePartnerCount: soa.b2b.activePartnerCount,
    agreementCount: soa.b2b.agreementCount,
    activeAgreementCount: soa.b2b.activeAgreementCount,
    exchangeCount: soa.b2b.exchangeCount,
  });
});

// ============================================================
// SOA API Gateway
// ============================================================

router.get('/apis', (_req, res) => {
  const soa = getSOA();
  res.json(soa.api.allAPIs.map((a: any) => ({
    id: a.id,
    name: a.name,
    version: a.version,
    status: a.status,
    basePath: a.basePath,
    routeCount: a.routes?.length ?? 0,
  })));
});

router.get('/apis/published', (_req, res) => {
  const soa = getSOA();
  res.json(soa.api.getPublishedAPIs());
});

router.get('/apis/:id', (req, res) => {
  const soa = getSOA();
  const api = soa.api.getAPI(String(req.params.id));
  if (!api) return res.status(404).json({ error: 'API not found' });
  res.json(api);
});

router.get('/apis/name/:name', (req, res) => {
  const soa = getSOA();
  const api = soa.api.getAPIByName(String(req.params.name));
  if (!api) return res.status(404).json({ error: 'API not found' });
  res.json(api);
});

router.post('/apis', (req, res) => {
  const soa = getSOA();
  const apiDef = req.body;
  if (!apiDef.id || !apiDef.name) return res.status(400).json({ error: 'id and name are required' });
  const registered = soa.api.registerAPI(apiDef);
  res.status(201).json(registered);
});

router.put('/apis/:id', (req, res) => {
  const soa = getSOA();
  const id = String(req.params.id);
  const body = req.body;
  body.id = id;
  // Re-register to update
  const updated = soa.api.registerAPI(body);
  res.json(updated);
});

router.delete('/apis/:id', (req, res) => {
  const soa = getSOA();
  const ok = soa.api.removeAPI(String(req.params.id));
  if (!ok) return res.status(404).json({ error: 'API not found' });
  res.json({ success: true });
});

router.post('/apis/:id/publish', (req, res) => {
  const soa = getSOA();
  soa.api.publishAPI(String(req.params.id));
  res.json({ success: true, status: 'published' });
});

router.post('/apis/:id/deprecate', (req, res) => {
  const soa = getSOA();
  soa.api.deprecateAPI(String(req.params.id));
  res.json({ success: true, status: 'deprecated' });
});

router.post('/apis/:id/retire', (req, res) => {
  const soa = getSOA();
  soa.api.retireAPI(String(req.params.id));
  res.json({ success: true, status: 'retired' });
});

// API Routes
router.post('/apis/:id/routes', (req, res) => {
  const soa = getSOA();
  const route = req.body;
  if (!route.id) return res.status(400).json({ error: 'route id is required' });
  const ok = soa.api.addRoute(String(req.params.id), route);
  if (!ok) return res.status(404).json({ error: 'API not found' });
  res.status(201).json({ success: true });
});

router.delete('/apis/:apiId/routes/:routeId', (req, res) => {
  const soa = getSOA();
  const ok = soa.api.removeRoute(String(req.params.apiId), String(req.params.routeId));
  if (!ok) return res.status(404).json({ error: 'API or route not found' });
  res.json({ success: true });
});

router.post('/apis/:apiId/routes/:routeId/enable', (req, res) => {
  const soa = getSOA();
  const ok = soa.api.enableRoute(String(req.params.apiId), String(req.params.routeId));
  if (!ok) return res.status(404).json({ error: 'API or route not found' });
  res.json({ success: true });
});

router.post('/apis/:apiId/routes/:routeId/disable', (req, res) => {
  const soa = getSOA();
  const ok = soa.api.disableRoute(String(req.params.apiId), String(req.params.routeId));
  if (!ok) return res.status(404).json({ error: 'API or route not found' });
  res.json({ success: true });
});

// API Keys
router.post('/apis/keys', (req, res) => {
  const soa = getSOA();
  const { name, apiIds, owner, scopes, expiresAt } = req.body;
  if (!name || !apiIds) return res.status(400).json({ error: 'name and apiIds are required' });
  const result = soa.api.createAPIKey(name, apiIds, owner ?? 'api', scopes ?? [], expiresAt);
  res.status(201).json(result);
});

router.get('/apis/keys/:id', (req, res) => {
  const soa = getSOA();
  const key = soa.api.getAPIKey(String(req.params.id));
  if (!key) return res.status(404).json({ error: 'API key not found' });
  res.json(key);
});

router.post('/apis/keys/:id/revoke', (req, res) => {
  const soa = getSOA();
  const ok = soa.api.revokeAPIKey(String(req.params.id));
  if (!ok) return res.status(404).json({ error: 'API key not found' });
  res.json({ success: true });
});

// Nested API-key routes under /apis/:id/keys
router.post('/apis/:id/keys', (req, res) => {
  const soa = getSOA();
  const apiId = String(req.params.id);
  const { name, owner, scopes, expiresAt } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });
  const result = soa.api.createAPIKey(name, [apiId], owner ?? 'api', scopes ?? [], expiresAt);
  res.status(201).json(result);
});

router.delete('/apis/:apiId/keys/:keyId', (req, res) => {
  const soa = getSOA();
  const ok = soa.api.revokeAPIKey(String(req.params.keyId));
  if (!ok) return res.status(404).json({ error: 'API key not found' });
  res.json({ success: true });
});

router.post('/apis/keys/validate', (req, res) => {
  const soa = getSOA();
  const { rawKey } = req.body;
  if (!rawKey) return res.status(400).json({ error: 'rawKey is required' });
  const key = soa.api.validateAPIKey(rawKey);
  if (!key) return res.status(401).json({ valid: false });
  res.json({ valid: true, key });
});

// API Usage & Metrics
router.post('/apis/:id/usage', (req, res) => {
  const soa = getSOA();
  const { routeId, method, path, statusCode, responseTimeMs, requestSizeBytes, responseSizeBytes, apiKeyId } = req.body;
  soa.api.recordUsage(String(req.params.id), routeId ?? '', method ?? 'GET', path ?? '/', statusCode ?? 200, responseTimeMs ?? 0, requestSizeBytes ?? 0, responseSizeBytes ?? 0, apiKeyId);
  res.json({ success: true });
});

router.get('/apis/:id/usage', (req, res) => {
  const soa = getSOA();
  const { limit } = req.query;
  res.json(soa.api.getUsageStats(String(req.params.id), limit ? Number(limit) : undefined));
});

router.get('/apis/:id/metrics', (req, res) => {
  const soa = getSOA();
  res.json(soa.api.getAPIMetrics(String(req.params.id)));
});

router.get('/apis/:id/rate-limit', (req, res) => {
  const soa = getSOA();
  const { routeId, apiKeyId } = req.query;
  res.json(soa.api.checkRateLimit(String(req.params.id), routeId ? String(routeId) : undefined, apiKeyId ? String(apiKeyId) : undefined));
});

router.get('/apis/stats', (_req, res) => {
  const soa = getSOA();
  res.json({
    apiCount: soa.api.apiCount,
    publishedCount: soa.api.publishedCount,
    keyCount: soa.api.keyCount,
    activeKeyCount: soa.api.activeKeyCount,
    totalRequests: soa.api.totalRequests,
  });
});

// ============================================================
// SOA Policies & SLAs
// ============================================================

router.get('/policies', (req, res) => {
  const soa = getSOA();
  const { type, serviceId } = req.query;
  let policies;
  if (type) {
    policies = soa.policy.getPoliciesByType(String(type) as any);
  } else if (serviceId) {
    policies = soa.policy.getPoliciesForService(String(serviceId));
  } else {
    policies = soa.policy.allPolicies;
  }
  res.json(policies);
});

router.get('/policies/:id', (req, res) => {
  const soa = getSOA();
  const policy = soa.policy.getPolicy(String(req.params.id));
  if (!policy) return res.status(404).json({ error: 'Policy not found' });
  res.json(policy);
});

router.post('/policies', (req, res) => {
  const soa = getSOA();
  const policy = req.body;
  if (!policy.id || !policy.name) return res.status(400).json({ error: 'id and name are required' });
  soa.policy.registerPolicy(policy);
  res.status(201).json(policy);
});

router.put('/policies/:id', (req, res) => {
  const soa = getSOA();
  const id = String(req.params.id);
  const body = req.body;
  body.id = id;
  // Re-register to update
  soa.policy.registerPolicy(body);
  res.json(body);
});

router.delete('/policies/:id', (req, res) => {
  const soa = getSOA();
  const ok = soa.policy.removePolicy(String(req.params.id));
  if (!ok) return res.status(404).json({ error: 'Policy not found' });
  res.json({ success: true });
});

router.post('/policies/:id/evaluate', (req, res) => {
  const soa = getSOA();
  const context = req.body;
  const result = soa.policy.evaluatePolicy(String(req.params.id), context);
  res.json(result);
});

router.post('/policies/evaluate-all', (req, res) => {
  const soa = getSOA();
  const { serviceId, context, enforcementPoint } = req.body;
  if (!serviceId) return res.status(400).json({ error: 'serviceId is required' });
  const result = soa.policy.evaluateAllPolicies(serviceId, context ?? {}, enforcementPoint ?? 'request');
  res.json(result);
});

router.post('/policies/:policyId/bind/:serviceId', (req, res) => {
  const soa = getSOA();
  const ok = soa.policy.bindPolicyToService(String(req.params.policyId), String(req.params.serviceId));
  if (!ok) return res.status(404).json({ error: 'Policy or service not found' });
  res.json({ success: true });
});

router.post('/policies/:policyId/unbind/:serviceId', (req, res) => {
  const soa = getSOA();
  const ok = soa.policy.unbindPolicyFromService(String(req.params.policyId), String(req.params.serviceId));
  if (!ok) return res.status(404).json({ error: 'Policy or service binding not found' });
  res.json({ success: true });
});

router.get('/policies/stats', (_req, res) => {
  const soa = getSOA();
  res.json({
    policyCount: soa.policy.policyCount,
    activePolicyCount: soa.policy.activePolicyCount,
    slaCount: soa.policy.slaCount,
    slaBreachCount: soa.policy.slaBreachCount,
  });
});

router.get('/slas', (_req, res) => {
  const soa = getSOA();
  res.json(soa.policy.allSLAs);
});

router.get('/slas/:id', (req, res) => {
  const soa = getSOA();
  const sla = soa.policy.getSLA(String(req.params.id));
  if (!sla) return res.status(404).json({ error: 'SLA not found' });
  res.json(sla);
});

router.post('/slas', (req, res) => {
  const soa = getSOA();
  const sla = req.body;
  if (!sla.id || !sla.name) return res.status(400).json({ error: 'id and name are required' });
  soa.policy.registerSLA(sla);
  res.status(201).json(sla);
});

router.put('/slas/:id', (req, res) => {
  const soa = getSOA();
  const id = String(req.params.id);
  const body = req.body;
  body.id = id;
  // Re-register to update
  soa.policy.registerSLA(body);
  res.json(body);
});

router.delete('/slas/:id', (req, res) => {
  const soa = getSOA();
  const ok = soa.policy.removeSLA(String(req.params.id));
  if (!ok) return res.status(404).json({ error: 'SLA not found' });
  res.json({ success: true });
});

router.post('/slas/:id/record', (req, res) => {
  const soa = getSOA();
  const { serviceId, metricValues } = req.body;
  if (!serviceId || !metricValues) return res.status(400).json({ error: 'serviceId and metricValues are required' });
  const record = soa.policy.recordSLAMetrics(String(req.params.id), serviceId, metricValues);
  if (!record) return res.status(404).json({ error: 'SLA not found' });
  res.json(record);
});

router.get('/slas/:id/compliance', (req, res) => {
  const soa = getSOA();
  const { serviceId } = req.query;
  res.json(soa.policy.getSLACompliance(String(req.params.id), serviceId ? String(serviceId) : undefined));
});

router.get('/slas/breaches', (req, res) => {
  const soa = getSOA();
  const { limit } = req.query;
  res.json(soa.policy.getRecentBreaches(limit ? Number(limit) : undefined));
});

// ============================================================
// SOA Service Mesh
// ============================================================

router.get('/mesh/proxies', (_req, res) => {
  const soa = getSOA();
  res.json(soa.mesh.allProxies);
});

router.get('/mesh/proxies/:id', (req, res) => {
  const soa = getSOA();
  const proxy = soa.mesh.getProxy(String(req.params.id));
  if (!proxy) return res.status(404).json({ error: 'Proxy not found' });
  res.json(proxy);
});

router.get('/mesh/proxies/service/:serviceId', (req, res) => {
  const soa = getSOA();
  const proxy = soa.mesh.getProxyByService(String(req.params.serviceId));
  if (!proxy) return res.status(404).json({ error: 'Proxy not found for service' });
  res.json(proxy);
});

router.post('/mesh/proxies', (req, res) => {
  const soa = getSOA();
  const config = req.body;
  if (!config.id) return res.status(400).json({ error: 'id is required' });
  const proxy = soa.mesh.deployProxy(config);
  res.status(201).json(proxy);
});

router.put('/mesh/proxies/:id', (req, res) => {
  const soa = getSOA();
  try {
    res.json(soa.mesh.updateProxy(String(req.params.id), req.body));
  } catch (e: any) { res.status(404).json({ error: e.message }); }
});

router.delete('/mesh/proxies/:id', (req, res) => {
  const soa = getSOA();
  const ok = soa.mesh.removeProxy(String(req.params.id));
  if (!ok) return res.status(404).json({ error: 'Proxy not found' });
  res.json({ success: true });
});

router.put('/mesh/proxies/:id/traffic-policy', (req, res) => {
  const soa = getSOA();
  const policy = req.body;
  const ok = soa.mesh.updateTrafficPolicy(String(req.params.id), policy);
  if (!ok) return res.status(404).json({ error: 'Proxy not found' });
  res.json({ success: true });
});

router.get('/mesh/proxies/:id/metrics', (req, res) => {
  const soa = getSOA();
  const metrics = soa.mesh.getProxyMetrics(String(req.params.id));
  if (!metrics) return res.status(404).json({ error: 'Proxy not found' });
  res.json(metrics);
});

router.post('/mesh/proxies/:id/record-request', (req, res) => {
  const soa = getSOA();
  const { upstreamServiceId, success, latencyMs } = req.body;
  if (!upstreamServiceId) return res.status(400).json({ error: 'upstreamServiceId is required' });
  soa.mesh.recordRequest(String(req.params.id), upstreamServiceId, success ?? true, latencyMs ?? 0);
  res.json({ success: true });
});

router.get('/mesh/proxies/:proxyId/circuit/:upstreamId', (req, res) => {
  const soa = getSOA();
  const state = soa.mesh.getCircuitState(String(req.params.proxyId), String(req.params.upstreamId));
  res.json({ state });
});

router.post('/mesh/proxies/:proxyId/circuit/:upstreamId/open', (req, res) => {
  const soa = getSOA();
  const ok = soa.mesh.openCircuit(String(req.params.proxyId), String(req.params.upstreamId));
  if (!ok) return res.status(404).json({ error: 'Proxy not found' });
  res.json({ success: true, state: 'open' });
});

router.post('/mesh/proxies/:proxyId/circuit/:upstreamId/close', (req, res) => {
  const soa = getSOA();
  const ok = soa.mesh.closeCircuit(String(req.params.proxyId), String(req.params.upstreamId));
  if (!ok) return res.status(404).json({ error: 'Proxy not found' });
  res.json({ success: true, state: 'closed' });
});

router.get('/mesh/proxies/:id/rate-limit', (req, res) => {
  const soa = getSOA();
  res.json(soa.mesh.checkRateLimit(String(req.params.id)));
});

router.post('/mesh/proxies/:id/select-endpoint', (req, res) => {
  const soa = getSOA();
  const { endpoints } = req.body;
  if (!endpoints || !Array.isArray(endpoints)) return res.status(400).json({ error: 'endpoints array is required' });
  const selected = soa.mesh.selectEndpoint(String(req.params.id), endpoints);
  res.json({ endpoint: selected });
});

router.get('/mesh/health', (_req, res) => {
  const soa = getSOA();
  res.json(soa.mesh.getHealthStatus());
});

router.get('/mesh/stats', (_req, res) => {
  const soa = getSOA();
  res.json({
    proxyCount: soa.mesh.proxyCount,
    healthyCount: soa.mesh.healthyCount,
  });
});

// ============================================================
// SOA BAM (Business Activity Monitoring)
// ============================================================

router.get('/bam/kpis', (_req, res) => {
  const soa = getSOA();
  res.json(soa.bam.allKPIs);
});

router.get('/bam/kpis/:id', (req, res) => {
  const soa = getSOA();
  const kpi = soa.bam.getKPI(String(req.params.id));
  if (!kpi) return res.status(404).json({ error: 'KPI not found' });
  res.json(kpi);
});

router.post('/bam/kpis', (req, res) => {
  const soa = getSOA();
  const kpi = req.body;
  if (!kpi.id || !kpi.name) return res.status(400).json({ error: 'id and name are required' });
  soa.bam.registerKPI(kpi);
  res.status(201).json(kpi);
});

router.put('/bam/kpis/:id', (req, res) => {
  const soa = getSOA();
  const id = String(req.params.id);
  const body = req.body;
  body.id = id;
  // Re-register to update
  soa.bam.registerKPI(body);
  res.json(body);
});

router.delete('/bam/kpis/:id', (req, res) => {
  const soa = getSOA();
  const ok = soa.bam.removeKPI(String(req.params.id));
  if (!ok) return res.status(404).json({ error: 'KPI not found' });
  res.json({ success: true });
});

router.post('/bam/kpis/:id/record', (req, res) => {
  const soa = getSOA();
  const { value } = req.body;
  if (value === undefined) return res.status(400).json({ error: 'value is required' });
  soa.bam.recordKPIValue(String(req.params.id), value);
  res.json({ success: true });
});

router.get('/bam/kpis/:id/value', (req, res) => {
  const soa = getSOA();
  const value = soa.bam.getKPIValue(String(req.params.id));
  if (!value) return res.status(404).json({ error: 'No value recorded for KPI' });
  res.json(value);
});

router.get('/bam/kpis/:id/history', (req, res) => {
  const soa = getSOA();
  const { limit } = req.query;
  res.json(soa.bam.getKPIHistory(String(req.params.id), limit ? Number(limit) : undefined));
});

router.get('/bam/kpis/:id/trend', (req, res) => {
  const soa = getSOA();
  res.json({ trend: soa.bam.getKPITrend(String(req.params.id)) });
});

// BAM Dashboards
router.get('/bam/dashboards', (_req, res) => {
  const soa = getSOA();
  res.json(soa.bam.allDashboards);
});

router.get('/bam/dashboards/:id', (req, res) => {
  const soa = getSOA();
  const dashboard = soa.bam.getDashboard(String(req.params.id));
  if (!dashboard) return res.status(404).json({ error: 'Dashboard not found' });
  res.json(dashboard);
});

router.get('/bam/dashboards/:id/data', (req, res) => {
  const soa = getSOA();
  const data = soa.bam.getDashboardData(String(req.params.id));
  if (!data) return res.status(404).json({ error: 'Dashboard not found' });
  // Convert Map to object for JSON serialization
  const obj: Record<string, any> = {};
  data.forEach((v: any, k: string) => { obj[k] = v; });
  res.json(obj);
});

router.post('/bam/dashboards', (req, res) => {
  const soa = getSOA();
  const { name, kpiIds, owner, shared } = req.body;
  if (!name || !kpiIds) return res.status(400).json({ error: 'name and kpiIds are required' });
  const dashboard = soa.bam.createDashboard(name, kpiIds, owner ?? 'api', shared);
  res.status(201).json(dashboard);
});

router.put('/bam/dashboards/:id', (req, res) => {
  const soa = getSOA();
  try {
    res.json(soa.bam.updateDashboard(String(req.params.id), req.body));
  } catch (e: any) { res.status(404).json({ error: e.message }); }
});

router.delete('/bam/dashboards/:id', (req, res) => {
  const soa = getSOA();
  const ok = soa.bam.removeDashboard(String(req.params.id));
  if (!ok) return res.status(404).json({ error: 'Dashboard not found' });
  res.json({ success: true });
});

// BAM Alert Rules
router.get('/bam/alert-rules', (_req, res) => {
  const soa = getSOA();
  res.json(soa.bam.allAlertRules);
});

router.post('/bam/alert-rules', (req, res) => {
  const soa = getSOA();
  const rule = req.body;
  if (!rule.id || !rule.name) return res.status(400).json({ error: 'id and name are required' });
  soa.bam.registerAlertRule(rule);
  res.status(201).json(rule);
});

router.delete('/bam/alert-rules/:id', (req, res) => {
  const soa = getSOA();
  const ok = soa.bam.removeAlertRule(String(req.params.id));
  if (!ok) return res.status(404).json({ error: 'Alert rule not found' });
  res.json({ success: true });
});

// BAM Alerts
router.get('/bam/alerts', (_req, res) => {
  const soa = getSOA();
  res.json(soa.bam.getActiveAlerts());
});

router.post('/bam/alerts/:id/acknowledge', (req, res) => {
  const soa = getSOA();
  const ok = soa.bam.acknowledgeAlert(String(req.params.id));
  if (!ok) return res.status(404).json({ error: 'Alert not found' });
  res.json({ success: true });
});

router.post('/bam/alerts/:id/resolve', (req, res) => {
  const soa = getSOA();
  const ok = soa.bam.resolveAlert(String(req.params.id));
  if (!ok) return res.status(404).json({ error: 'Alert not found' });
  res.json({ success: true });
});

router.get('/bam/stats', (_req, res) => {
  const soa = getSOA();
  res.json({
    kpiCount: soa.bam.kpiCount,
    dashboardCount: soa.bam.dashboardCount,
    alertRuleCount: soa.bam.alertRuleCount,
    activeAlertCount: soa.bam.activeAlertCount,
  });
});

// ============================================================
// SOA Compensation
// ============================================================

router.get('/compensation/handlers', (_req, res) => {
  const soa = getSOA();
  res.json(soa.compensation.handlerNames);
});

router.get('/compensation/transactions', (_req, res) => {
  const soa = getSOA();
  res.json(soa.compensation.allTransactions);
});

router.post('/compensation/handlers', (req, res) => {
  const soa = getSOA();
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });
  // Register a handler that logs; real handlers are typically registered in code
  soa.compensation.registerHandler(name, async (data: Record<string, any>) => {
    console.log(`Compensation handler ${name} invoked`, data);
  });
  res.status(201).json({ success: true, name });
});

router.post('/compensation/transactions', (req, res) => {
  const soa = getSOA();
  const { processInstanceId } = req.body;
  if (!processInstanceId) return res.status(400).json({ error: 'processInstanceId is required' });
  const tx = soa.compensation.createTransaction(processInstanceId);
  res.status(201).json(tx);
});

router.get('/compensation/transactions/:id', (req, res) => {
  const soa = getSOA();
  const tx = soa.compensation.getTransaction(String(req.params.id));
  if (!tx) return res.status(404).json({ error: 'Transaction not found' });
  res.json(tx);
});

router.get('/compensation/transactions/process/:processId', (req, res) => {
  const soa = getSOA();
  const tx = soa.compensation.getTransactionByProcess(String(req.params.processId));
  if (!tx) return res.status(404).json({ error: 'Transaction not found' });
  res.json(tx);
});

router.post('/compensation/transactions/:id/scopes', (req, res) => {
  const soa = getSOA();
  const { scopeName, parentScopeName } = req.body;
  if (!scopeName) return res.status(400).json({ error: 'scopeName is required' });
  const scope = soa.compensation.beginScope(String(req.params.id), scopeName, parentScopeName);
  if (!scope) return res.status(404).json({ error: 'Transaction not found' });
  res.status(201).json(scope);
});

router.post('/compensation/transactions/:id/scopes/:scopeName/complete', (req, res) => {
  const soa = getSOA();
  const ok = soa.compensation.completeScope(String(req.params.id), String(req.params.scopeName));
  if (!ok) return res.status(404).json({ error: 'Transaction or scope not found' });
  res.json({ success: true });
});

router.post('/compensation/transactions/:id/scopes/:scopeName/actions', (req, res) => {
  const soa = getSOA();
  const { actionName, handlerName, compensationData, originalActionId } = req.body;
  if (!actionName || !handlerName) return res.status(400).json({ error: 'actionName and handlerName are required' });
  const action = soa.compensation.registerAction(String(req.params.id), String(req.params.scopeName), actionName, handlerName, compensationData ?? {}, originalActionId);
  if (!action) return res.status(404).json({ error: 'Transaction or scope not found' });
  res.status(201).json(action);
});

router.post('/compensation/transactions/:id/scopes/:scopeName/compensate', async (req, res) => {
  const soa = getSOA();
  await soa.compensation.compensateScope(String(req.params.id), String(req.params.scopeName));
  res.json({ success: true });
});

router.post('/compensation/transactions/:id/compensate', async (req, res) => {
  const soa = getSOA();
  await soa.compensation.compensateTransaction(String(req.params.id));
  res.json({ success: true });
});

router.get('/compensation/stats', (_req, res) => {
  const soa = getSOA();
  res.json({
    transactionCount: soa.compensation.transactionCount,
    activeCount: soa.compensation.activeCount,
    compensatedCount: soa.compensation.compensatedCount,
    failedCount: soa.compensation.failedCount,
  });
});

// ============================================================
// SOA Monitoring / Alerts
// ============================================================

router.get('/monitoring/alerts', (_req, res) => {
  const soa = getSOA();
  res.json(soa.monitoring.alerts.getActiveAlerts());
});

router.post('/monitoring/alerts/:id/acknowledge', (req, res) => {
  const soa = getSOA();
  soa.monitoring.alerts.acknowledgeAlert(String(req.params.id));
  res.json({ success: true });
});

router.post('/monitoring/alerts/:id/resolve', (req, res) => {
  const soa = getSOA();
  soa.monitoring.alerts.resolveAlert(String(req.params.id));
  res.json({ success: true });
});

router.get('/monitoring/counters', (_req, res) => {
  const soa = getSOA();
  const metrics = soa.getMetrics();
  res.json(metrics);
});

// ============================================================
// SOA Security / Audit
// ============================================================

router.get('/security/audit', (req, res) => {
  const soa = getSOA();
  const { action, actor, resource, limit } = req.query;
  let entries;
  if (action) {
    entries = soa.security.audit.getEntriesByAction(String(action));
  } else if (actor) {
    entries = soa.security.audit.getEntriesByActor(String(actor));
  } else if (resource) {
    entries = soa.security.audit.getEntriesByResource(String(resource));
  } else {
    entries = soa.security.audit.getEntries();
  }
  const maxResults = Math.min(Number(limit) || 50, 200);
  res.json(entries.slice(-maxResults));
});

router.post('/security/audit', (req, res) => {
  const soa = getSOA();
  const entry = soa.security.audit.log(req.body);
  res.status(201).json(entry);
});

router.delete('/security/audit', (_req, res) => {
  const soa = getSOA();
  soa.security.audit.clear();
  res.json({ success: true });
});

router.get('/security/policies', (_req, res) => {
  const soa = getSOA();
  res.json(soa.security.accessControl.policies);
});

router.post('/security/policies', (req, res) => {
  const soa = getSOA();
  const policy = req.body;
  if (!policy.id || !policy.name) return res.status(400).json({ error: 'id and name are required' });
  soa.security.accessControl.registerPolicy(policy);
  res.status(201).json(policy);
});

router.put('/security/policies/:id', (req, res) => {
  const soa = getSOA();
  try {
    res.json(soa.security.accessControl.updatePolicy(String(req.params.id), req.body));
  } catch (e: any) { res.status(404).json({ error: e.message }); }
});

router.delete('/security/policies/:id', (req, res) => {
  const soa = getSOA();
  const ok = soa.security.accessControl.removePolicy(String(req.params.id));
  if (!ok) return res.status(404).json({ error: 'Policy not found' });
  res.json({ success: true });
});

router.post('/security/check-access', (req, res) => {
  const soa = getSOA();
  const { actor, roles, action, resource } = req.body;
  if (!actor || !action || !resource) return res.status(400).json({ error: 'actor, action, and resource are required' });
  const result = soa.security.accessControl.checkAccess(actor, roles ?? [], action, resource);
  res.json(result);
});

router.get('/security/policies/role/:role', (req, res) => {
  const soa = getSOA();
  res.json(soa.security.accessControl.getPoliciesForRole(String(req.params.role)));
});

router.get('/security/masking-rules', (_req, res) => {
  const soa = getSOA();
  res.json(soa.security.masker.rules);
});

router.post('/security/masking-rules', (req, res) => {
  const soa = getSOA();
  const rule = req.body;
  if (!rule.id) return res.status(400).json({ error: 'id is required' });
  soa.security.masker.registerRule(rule);
  res.status(201).json(rule);
});

router.put('/security/masking-rules/:id', (req, res) => {
  const soa = getSOA();
  try {
    res.json(soa.security.masker.updateRule(String(req.params.id), req.body));
  } catch (e: any) { res.status(404).json({ error: e.message }); }
});

router.delete('/security/masking-rules/:id', (req, res) => {
  const soa = getSOA();
  const ok = soa.security.masker.removeRule(String(req.params.id));
  if (!ok) return res.status(404).json({ error: 'Masking rule not found' });
  res.json({ success: true });
});

router.post('/security/mask', (req, res) => {
  const soa = getSOA();
  const { value, strategy, parameters } = req.body;
  const masked = soa.security.masker.mask(value, strategy, parameters);
  res.json({ masked });
});

router.post('/security/mask-object', (req, res) => {
  const soa = getSOA();
  const masked = soa.security.masker.maskObject(req.body);
  res.json(masked);
});

router.get('/security/stats', (_req, res) => {
  const soa = getSOA();
  res.json({
    policyCount: soa.security.accessControl.policyCount,
    maskingRuleCount: soa.security.masker.ruleCount,
    auditEntryCount: soa.security.audit.count,
  });
});

// ============================================================
// SOA Metrics / Dashboard
// ============================================================

router.get('/metrics', (_req, res) => {
  const soa = getSOA();
  const metrics = soa.getMetrics();

  res.json({
    summary: {
      totalServices: metrics.totalServices,
      activeServices: metrics.activeServices,
      totalEndpoints: metrics.totalEndpoints,
      totalContracts: metrics.totalContracts,
      totalProcessDefinitions: metrics.totalProcessDefinitions,
      activeProcessInstances: metrics.activeProcessInstances,
      completedProcessInstances: metrics.completedProcessInstances,
      faultedProcessInstances: metrics.faultedProcessInstances,
      totalTaskDefinitions: metrics.totalTaskDefinitions,
      pendingTasks: metrics.pendingTasks,
      inProgressTasks: metrics.inProgressTasks,
      completedTasks: metrics.completedTasks,
      overdueTasks: metrics.overdueTasks,
      totalCEPRules: metrics.totalCEPRules,
      activeCEPRules: metrics.activeCEPRules,
      eventsProcessed: metrics.eventsProcessed,
      patternsMatched: metrics.patternsMatched,
      totalPartners: metrics.totalPartners,
      activePartners: metrics.activePartners,
      totalAgreements: metrics.totalAgreements,
      documentsExchanged: metrics.documentsExchanged,
      totalPolicies: metrics.totalPolicies,
      activePolicies: metrics.activePolicies,
      totalSLAs: metrics.totalSLAs,
      slaBreaches: metrics.slaBreaches,
      totalProxies: metrics.totalProxies,
      healthyProxies: metrics.healthyProxies,
      totalAPIs: metrics.totalAPIs,
      publishedAPIs: metrics.publishedAPIs,
      totalAPIKeys: metrics.totalAPIKeys,
      apiRequestsTotal: metrics.apiRequestsTotal,
      activeCompensations: metrics.activeCompensations,
      completedCompensations: metrics.completedCompensations,
      failedCompensations: metrics.failedCompensations,
      totalKPIs: metrics.totalKPIs,
      activeAlerts: metrics.activeAlerts,
      uptimeMs: metrics.uptimeMs,
    },
    services: soa.registry.allServices.slice(0, 10).map((s: any) => ({
      id: s.id,
      name: s.name,
      status: s.status,
      endpointCount: s.endpoints.length,
    })),
    processes: soa.bpel.allProcesses.slice(0, 10).map((p: any) => ({
      id: p.id,
      name: p.name,
      version: p.version,
      status: p.status,
    })),
  });
});

export default router;
