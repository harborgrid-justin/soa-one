import { Router } from 'express';
import {
  isIntegrationReady,
  getBus,
  getCMS,
  getDI,
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
      modules: { engine: false, esb: false, cms: false, di: false, bridge: false },
      timestamp: new Date().toISOString(),
    });
  }

  const bus = getBus();
  const cms = getCMS();
  const di = getDI();
  const engine = getEngine();

  const esbMetrics = bus.getMetrics();
  const cmsMetrics = cms.getMetrics();
  const diMetrics = di.getMetrics();

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
      bridge: {
        available: true,
        version: '1.0.0',
        eventChannels: ['cms.events', 'cms.documents', 'cms.workflows', 'esb.events', 'di.events', 'di.pipelines', 'di.cdc'],
      },
    },
    timestamp: new Date().toISOString(),
  });
});

export default router;
