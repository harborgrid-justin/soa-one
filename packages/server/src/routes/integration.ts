import { Router } from 'express';
import {
  isIntegrationReady,
  getBus,
  getCMS,
  getDI,
  getDQM,
  getSOA,
  getEngine,
} from '../services/integration';

const router = Router();

// ============================================================
// Integration Status & Cross-Module Metrics
// ============================================================

router.get('/status', (_req, res) => {
  if (!isIntegrationReady()) {
    return res.status(503).json({
      status: 'not_ready',
      modules: { engine: false, esb: false, cms: false, di: false, dqm: false, soa: false, bridge: false },
      timestamp: new Date().toISOString(),
    });
  }

  const bus = getBus();
  const cms = getCMS();
  const di = getDI();
  const dqm = getDQM();
  const soa = getSOA();
  const engine = getEngine();

  const esbMetrics = bus.getMetrics();
  const cmsMetrics = cms.getMetrics();
  const diMetrics = di.getMetrics();
  const dqmMetrics = dqm.getMetrics();
  const soaMetrics = soa.getMetrics();

  res.json({
    status: 'ready',
    modules: {
      engine: {
        available: true,
        plugins: engine.registry.pluginNames,
        operators: engine.registry.operatorNames,
        actionHandlers: engine.registry.actionHandlerTypes,
        functions: engine.registry.functionNames,
      },
      esb: {
        available: true,
        name: bus.name,
        channels: bus.channelNames,
        endpoints: bus.endpointNames.length,
        messagesProcessed: esbMetrics.messagesProcessed,
      },
      cms: {
        available: true,
        name: cms.name,
        totalDocuments: cmsMetrics.totalDocuments,
        activeWorkflows: cmsMetrics.activeWorkflows,
        documentsUnderHold: cmsMetrics.documentsUnderHold,
      },
      di: {
        available: true,
        name: di.name,
        totalConnectors: diMetrics.totalConnectors,
        activeConnectors: diMetrics.activeConnectors,
        totalPipelines: diMetrics.totalPipelines,
        activePipelines: diMetrics.activePipelines,
        totalCDCStreams: diMetrics.totalCDCStreams,
        totalReplicationStreams: diMetrics.totalReplicationStreams,
        catalogEntries: diMetrics.catalogEntries,
        qualityScore: diMetrics.qualityScore,
      },
      dqm: {
        available: true,
        name: dqm.name,
        totalQualityRules: dqmMetrics.totalQualityRules,
        totalTopics: dqmMetrics.totalTopics,
        totalQueues: dqmMetrics.totalQueues,
        messagesPublished: dqmMetrics.messagesPublished,
        currentQualityScore: dqmMetrics.currentQualityScore,
      },
      soa: {
        available: true,
        name: soa.name,
        totalServices: soaMetrics.totalServices,
        activeServices: soaMetrics.activeServices,
        totalProcessDefinitions: soaMetrics.totalProcessDefinitions,
        activeProcessInstances: soaMetrics.activeProcessInstances,
        totalPartners: soaMetrics.totalPartners,
        totalAPIs: soaMetrics.totalAPIs,
        publishedAPIs: soaMetrics.publishedAPIs,
        totalKPIs: soaMetrics.totalKPIs,
        activeAlerts: soaMetrics.activeAlerts,
      },
      bridge: {
        available: true,
        version: '1.0.0',
        eventChannels: [
          'cms.events', 'cms.documents', 'cms.workflows',
          'esb.events',
          'di.events', 'di.pipelines', 'di.cdc',
          'dqm.events', 'dqm.quality', 'dqm.messaging',
          'soa.events', 'soa.processes', 'soa.tasks', 'soa.cep', 'soa.b2b', 'soa.api',
        ],
      },
    },
    timestamp: new Date().toISOString(),
  });
});

export default router;
