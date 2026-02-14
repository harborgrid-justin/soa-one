import { Router } from 'express';
import { getSOA } from '../services/integration';

const router = Router();

// ============================================================
// SOA Services (Registry)
// ============================================================

router.get('/services', (_req, res) => {
  const soa = getSOA();
  const services = soa.registry.allServices.map((s: any) => ({
    id: s.id,
    name: s.name,
    version: s.version,
    status: s.status,
    endpointCount: s.endpoints.length,
    contractCount: s.contracts.length,
    dependencyCount: s.dependencies.length,
    tags: s.tags,
  }));
  res.json(services);
});

router.get('/services/:id', (req, res) => {
  const soa = getSOA();
  const service = soa.registry.get(req.params.id);
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

router.delete('/services/:id', (req, res) => {
  const soa = getSOA();
  soa.registry.deregister(req.params.id);
  res.json({ success: true });
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
  const def = soa.bpel.getProcess(req.params.id);
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

router.get('/processes/:id/instances', (req, res) => {
  const soa = getSOA();
  const instances = soa.bpel.getInstancesByProcess(req.params.id);
  res.json(instances);
});

router.post('/processes/:id/start', async (req, res) => {
  const soa = getSOA();
  const { input, initiator } = req.body;
  const instance = await soa.bpel.startProcess(req.params.id, input ?? {}, initiator ?? 'api');
  res.status(201).json(instance);
});

// ============================================================
// SOA Human Tasks
// ============================================================

router.get('/tasks', (_req, res) => {
  const soa = getSOA();
  const tasks = soa.tasks.allTasks;
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

router.get('/tasks/:id', (req, res) => {
  const soa = getSOA();
  const task = soa.tasks.getTask(req.params.id);
  if (!task) return res.status(404).json({ error: 'Task not found' });
  res.json(task);
});

router.post('/tasks', (req, res) => {
  const soa = getSOA();
  const { definitionId, input } = req.body;
  if (!definitionId) return res.status(400).json({ error: 'definitionId is required' });
  const task = soa.tasks.createTask(definitionId, input ?? {});
  res.status(201).json(task);
});

router.post('/tasks/:id/claim', (req, res) => {
  const soa = getSOA();
  const { assignee } = req.body;
  soa.tasks.claimTask(req.params.id, assignee ?? 'api-user');
  res.json({ success: true });
});

router.post('/tasks/:id/complete', (req, res) => {
  const soa = getSOA();
  const { userId, output, outcome } = req.body;
  soa.tasks.completeTask(req.params.id, userId ?? 'api-user', output ?? {}, outcome ?? 'completed');
  res.json({ success: true });
});

router.get('/task-definitions', (_req, res) => {
  const soa = getSOA();
  res.json(soa.tasks.allDefinitions);
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
  const rule = soa.cep.getRule(req.params.id);
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

router.post('/cep/events', (req, res) => {
  const soa = getSOA();
  const event = req.body;
  const matches = soa.cep.processEvent(event);
  res.json({ processed: true, matchCount: matches.length, matches });
});

// ============================================================
// SOA B2B Gateway
// ============================================================

router.get('/b2b/partners', (_req, res) => {
  const soa = getSOA();
  res.json(soa.b2b.allPartners);
});

router.get('/b2b/partners/:id', (req, res) => {
  const soa = getSOA();
  const partner = soa.b2b.getPartner(req.params.id);
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

router.get('/b2b/agreements', (_req, res) => {
  const soa = getSOA();
  res.json(soa.b2b.allAgreements);
});

router.post('/b2b/agreements', (req, res) => {
  const soa = getSOA();
  const agreement = req.body;
  if (!agreement.id || !agreement.partnerId) return res.status(400).json({ error: 'id and partnerId are required' });
  soa.b2b.registerAgreement(agreement);
  res.status(201).json(agreement);
});

router.get('/b2b/exchanges', (_req, res) => {
  const soa = getSOA();
  res.json(soa.b2b.allExchanges);
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

router.get('/apis/:id', (req, res) => {
  const soa = getSOA();
  const api = soa.api.getAPI(req.params.id);
  if (!api) return res.status(404).json({ error: 'API not found' });
  res.json(api);
});

router.post('/apis', (req, res) => {
  const soa = getSOA();
  const apiDef = req.body;
  if (!apiDef.id || !apiDef.name) return res.status(400).json({ error: 'id and name are required' });
  soa.api.registerAPI(apiDef);
  res.status(201).json(apiDef);
});

router.post('/apis/:id/publish', (req, res) => {
  const soa = getSOA();
  soa.api.publishAPI(req.params.id);
  res.json({ success: true, status: 'published' });
});

router.post('/apis/:id/deprecate', (req, res) => {
  const soa = getSOA();
  soa.api.deprecateAPI(req.params.id);
  res.json({ success: true, status: 'deprecated' });
});

router.post('/apis/:id/retire', (req, res) => {
  const soa = getSOA();
  soa.api.retireAPI(req.params.id);
  res.json({ success: true, status: 'retired' });
});

// ============================================================
// SOA Policies & SLAs
// ============================================================

router.get('/policies', (_req, res) => {
  const soa = getSOA();
  res.json(soa.policy.allPolicies);
});

router.get('/policies/:id', (req, res) => {
  const soa = getSOA();
  const policy = soa.policy.getPolicy(req.params.id);
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

router.get('/slas', (_req, res) => {
  const soa = getSOA();
  res.json(soa.policy.allSLAs);
});

router.post('/slas', (req, res) => {
  const soa = getSOA();
  const sla = req.body;
  if (!sla.id || !sla.name) return res.status(400).json({ error: 'id and name are required' });
  soa.policy.registerSLA(sla);
  res.status(201).json(sla);
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
  const proxy = soa.mesh.getProxy(req.params.id);
  if (!proxy) return res.status(404).json({ error: 'Proxy not found' });
  res.json(proxy);
});

router.post('/mesh/proxies', (req, res) => {
  const soa = getSOA();
  const config = req.body;
  if (!config.id) return res.status(400).json({ error: 'id is required' });
  soa.mesh.deployProxy(config);
  res.status(201).json(config);
});

// ============================================================
// SOA BAM (Business Activity Monitoring)
// ============================================================

router.get('/bam/kpis', (_req, res) => {
  const soa = getSOA();
  res.json(soa.bam.allKPIs);
});

router.post('/bam/kpis', (req, res) => {
  const soa = getSOA();
  const kpi = req.body;
  if (!kpi.id || !kpi.name) return res.status(400).json({ error: 'id and name are required' });
  soa.bam.registerKPI(kpi);
  res.status(201).json(kpi);
});

router.post('/bam/kpis/:id/record', (req, res) => {
  const soa = getSOA();
  const { value } = req.body;
  if (value === undefined) return res.status(400).json({ error: 'value is required' });
  soa.bam.recordKPIValue(req.params.id, value);
  res.json({ success: true });
});

router.get('/bam/alerts', (_req, res) => {
  const soa = getSOA();
  res.json(soa.bam.getActiveAlerts());
});

router.get('/bam/dashboards', (_req, res) => {
  const soa = getSOA();
  res.json(soa.bam.allDashboards);
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
  soa.monitoring.alerts.acknowledgeAlert(req.params.id);
  res.json({ success: true });
});

router.post('/monitoring/alerts/:id/resolve', (req, res) => {
  const soa = getSOA();
  soa.monitoring.alerts.resolveAlert(req.params.id);
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
  const { action, actor, limit } = req.query;
  let entries;
  if (action) {
    entries = soa.security.audit.getEntriesByAction(String(action));
  } else if (actor) {
    entries = soa.security.audit.getEntriesByActor(String(actor));
  } else {
    entries = soa.security.audit.getEntries();
  }
  const maxResults = Math.min(Number(limit) || 50, 200);
  res.json(entries.slice(-maxResults));
});

router.get('/security/policies', (_req, res) => {
  const soa = getSOA();
  res.json(soa.security.accessControl.policies);
});

router.get('/security/masking-rules', (_req, res) => {
  const soa = getSOA();
  res.json(soa.security.masker.rules);
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
