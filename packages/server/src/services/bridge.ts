// ============================================================
// SOA One — ESB ⇄ CMS ⇄ DI ⇄ DQM ⇄ SOA Bridge
// ============================================================
//
// Provides multi-directional awareness between the ESB, CMS, DI,
// DQM, and SOA modules without any module importing the others
// directly.
//
// 1. CMS → ESB: CMS document/workflow events are published
//    to ESB channels so downstream consumers can react.
//
// 2. ESB → CMS: ESB message events on cms.* channels can
//    trigger CMS operations (document creation, status
//    changes, workflow starts).
//
// 3. DI → ESB:  DI pipeline/CDC/replication events are published
//    to ESB channels for downstream processing.
//
// 4. DI → CMS:  DI lineage and catalog data can be stored
//    as CMS documents for governance.
//
// 5. DQM → ESB: DQM quality/messaging events are published
//    to ESB channels for downstream processing.
//
// 6. DQM → CMS: DQM quality audit events are recorded in CMS
//    audit for compliance and traceability.
//
// 7. SOA → ESB: SOA process/task/CEP/B2B/API events are published
//    to ESB channels for downstream processing.
//
// 8. SOA → CMS: SOA audit events are recorded in CMS audit.
//
// 9. Bridge Plugin: An engine plugin that exposes cross-module
//    functions usable in rules.
// ============================================================

import type { ServiceBus } from '@soa-one/esb';
import type { ContentManagementSystem } from '@soa-one/cms';
import type { DataIntegrator } from '@soa-one/di';
import type { DataQualityMessaging } from '@soa-one/dqm';
import type { SOASuite } from '@soa-one/soa';

// ── SDK-Compatible Types (same as ESB/CMS plugins) ──────────

type OperatorHandler = (fieldValue: any, compareValue: any) => boolean;

type ActionHandler = (
  output: Record<string, any>,
  action: { type: string; field: string; value: any },
  input: Record<string, any>,
) => void;

type ExecutionHook = (context: {
  ruleSet: any;
  input: Record<string, any>;
  output: Record<string, any>;
  result?: any;
  metadata: Record<string, any>;
}) => any;

type CustomFunction = (...args: any[]) => any;

interface EnginePlugin {
  name: string;
  version?: string;
  operators?: Record<string, OperatorHandler>;
  actionHandlers?: Record<string, ActionHandler>;
  hooks?: {
    beforeExecute?: ExecutionHook[];
    afterExecute?: ExecutionHook[];
  };
  functions?: Record<string, CustomFunction>;
  onRegister?: () => void;
  onDestroy?: () => void;
}

// ── Bridge Plugin ───────────────────────────────────────────

/**
 * Create an engine plugin that provides cross-module operations.
 *
 * This plugin gives rules the ability to coordinate between ESB,
 * CMS, DI, DQM, and SOA — for example, a rule can validate data
 * quality, execute a DI pipeline, start a BPEL process, AND
 * publish an ESB notification in a single execution.
 */
export function createBridgePlugin(
  bus: ServiceBus,
  cms: ContentManagementSystem,
  di?: DataIntegrator,
  dqm?: DataQualityMessaging,
  soa?: SOASuite,
): EnginePlugin {
  return {
    name: 'soa-one-bridge',
    version: '1.0.0',

    // ── Cross-Module Action Handlers ──────────────────────
    actionHandlers: {
      /**
       * Create a CMS document and publish an ESB event about it.
       * Usage: type="BRIDGE_CREATE_AND_NOTIFY", field="documentName",
       *        value={ content, mimeType, channel }
       */
      BRIDGE_CREATE_AND_NOTIFY: (
        output: Record<string, any>,
        action: { type: string; field: string; value: any },
        _input: Record<string, any>,
      ): void => {
        const config = action.value;
        try {
          const doc = cms.repository.store({
            name: action.field,
            content: config.content ?? '',
            mimeType: config.mimeType ?? 'text/plain',
            path: config.path ?? '/',
            tags: config.tags ?? [],
            metadata: config.metadata ?? {},
            owner: config.owner ?? 'bridge',
          });

          const channel = config.channel ?? 'cms.documents';
          bus.send(channel, {
            event: 'document:created',
            documentId: doc.id,
            name: doc.name,
            mimeType: doc.mimeType,
            createdAt: doc.createdAt,
          }, {
            headers: { messageType: 'cms.document.created' },
          }).catch(() => {});

          if (!output._bridgeOps) output._bridgeOps = [];
          output._bridgeOps.push({
            action: 'create-and-notify',
            documentId: doc.id,
            channel,
            timestamp: new Date().toISOString(),
          });
        } catch {
          // Swallow errors in action handlers
        }
      },

      /**
       * Send an ESB message when a CMS document status changes.
       * Usage: type="BRIDGE_STATUS_AND_NOTIFY", field="documentId",
       *        value={ status, channel }
       */
      BRIDGE_STATUS_AND_NOTIFY: (
        output: Record<string, any>,
        action: { type: string; field: string; value: any },
        _input: Record<string, any>,
      ): void => {
        const config = action.value;
        try {
          cms.repository.documents.changeStatus(
            action.field,
            config.status,
            'bridge',
          );

          const channel = config.channel ?? 'cms.documents';
          bus.send(channel, {
            event: 'document:status-changed',
            documentId: action.field,
            newStatus: config.status,
            changedAt: new Date().toISOString(),
          }, {
            headers: { messageType: 'cms.document.status-changed' },
          }).catch(() => {});

          if (!output._bridgeOps) output._bridgeOps = [];
          output._bridgeOps.push({
            action: 'status-and-notify',
            documentId: action.field,
            status: config.status,
            channel,
            timestamp: new Date().toISOString(),
          });
        } catch {
          // Swallow errors
        }
      },

      /**
       * Execute a DI pipeline and notify via ESB.
       * Usage: type="BRIDGE_PIPELINE_AND_NOTIFY", field="pipelineId",
       *        value={ parameters, channel }
       */
      BRIDGE_PIPELINE_AND_NOTIFY: (
        output: Record<string, any>,
        action: { type: string; field: string; value: any },
        _input: Record<string, any>,
      ): void => {
        if (!di) return;
        const config = action.value;
        const pipelineId = action.field;
        const params = typeof config === 'object' ? (config.parameters ?? {}) : {};

        di.pipelines.execute(pipelineId, params, 'bridge').then((instance: any) => {
          const channel = config?.channel ?? 'di.pipelines';
          bus.send(channel, {
            event: 'pipeline:executed',
            pipelineId,
            instanceId: instance.instanceId,
            status: instance.status,
            triggeredAt: new Date().toISOString(),
          }, {
            headers: { messageType: 'di.pipeline.executed' },
          }).catch(() => {});

          if (!output._bridgeOps) output._bridgeOps = [];
          output._bridgeOps.push({
            action: 'pipeline-and-notify',
            pipelineId,
            instanceId: instance.instanceId,
            channel,
            timestamp: new Date().toISOString(),
          });
        }).catch(() => {});
      },

      /**
       * Validate data quality and publish results via ESB.
       * Usage: type="BRIDGE_VALIDATE_AND_NOTIFY", field="datasetName",
       *        value={ data, ruleIds, channel }
       */
      BRIDGE_VALIDATE_AND_NOTIFY: (
        output: Record<string, any>,
        action: { type: string; field: string; value: any },
        input: Record<string, any>,
      ): void => {
        if (!dqm) return;
        const config = action.value;
        const data = config?.data ?? (Array.isArray(input.data) ? input.data : [input]);

        try {
          const result = dqm.rules.evaluateAll(data, config?.ruleIds);

          const channel = config?.channel ?? 'dqm.quality';
          bus.send(channel, {
            event: 'validation:completed',
            datasetName: action.field,
            passRate: result.overallPassRate,
            totalViolations: result.totalViolations,
            timestamp: result.timestamp,
          }, {
            headers: { messageType: 'dqm.validation.completed' },
          }).catch(() => {});

          if (!output._bridgeOps) output._bridgeOps = [];
          output._bridgeOps.push({
            action: 'validate-and-notify',
            datasetName: action.field,
            passRate: result.overallPassRate,
            channel,
            timestamp: new Date().toISOString(),
          });
        } catch {
          // Swallow errors
        }
      },

      /**
       * Publish a DQM message and forward event to ESB.
       * Usage: type="BRIDGE_DQM_PUBLISH_AND_FORWARD", field="topicName",
       *        value={ body, esbChannel }
       */
      BRIDGE_DQM_PUBLISH_AND_FORWARD: (
        output: Record<string, any>,
        action: { type: string; field: string; value: any },
        _input: Record<string, any>,
      ): void => {
        if (!dqm) return;
        const config = action.value;

        try {
          const msg = dqm.messaging.publish(action.field, config.body ?? config, {
            publishedBy: 'bridge',
          });

          const esbChannel = config?.esbChannel ?? 'dqm.messaging';
          bus.send(esbChannel, {
            event: 'dqm:message-published',
            topic: action.field,
            messageId: msg.id,
            timestamp: msg.timestamp,
          }, {
            headers: { messageType: 'dqm.message.published' },
          }).catch(() => {});

          if (!output._bridgeOps) output._bridgeOps = [];
          output._bridgeOps.push({
            action: 'dqm-publish-and-forward',
            topic: action.field,
            messageId: msg.id,
            esbChannel,
            timestamp: new Date().toISOString(),
          });
        } catch {
          // Swallow errors
        }
      },
    },

    // ── Execution Hooks ─────────────────────────────────────
    hooks: {
      beforeExecute: [
        (context) => {
          // Add integration metadata so rules know all modules
          // are available
          context.metadata.integration = {
            esb: {
              available: true,
              busName: bus.name,
              channels: bus.channelNames,
            },
            cms: {
              available: true,
              cmsName: cms.name,
              documentCount: cms.getMetrics().totalDocuments,
            },
            di: di ? {
              available: true,
              diName: di.name,
              totalPipelines: di.getMetrics().totalPipelines,
              totalConnectors: di.getMetrics().totalConnectors,
            } : { available: false },
            dqm: dqm ? {
              available: true,
              dqmName: dqm.name,
              totalQualityRules: dqm.getMetrics().totalQualityRules,
              totalTopics: dqm.getMetrics().totalTopics,
              totalQueues: dqm.getMetrics().totalQueues,
              currentQualityScore: dqm.getMetrics().currentQualityScore,
            } : { available: false },
            soa: soa ? {
              available: true,
              soaName: soa.name,
              totalServices: soa.getMetrics().totalServices,
              totalProcesses: soa.getMetrics().totalProcessDefinitions,
              activeProcesses: soa.getMetrics().activeProcessInstances,
              pendingTasks: soa.getMetrics().pendingTasks,
              totalPartners: soa.getMetrics().totalPartners,
              totalAPIs: soa.getMetrics().totalAPIs,
              totalKPIs: soa.getMetrics().totalKPIs,
            } : { available: false },
            bridge: { version: '1.0.0' },
          };
          return context;
        },
      ],
    },

    // ── Cross-Module Functions ───────────────────────────────
    functions: {
      /**
       * Publish a CMS document event to the ESB.
       * Usage in rules: bridge_notifyDocumentEvent(documentId, eventType)
       */
      bridge_notifyDocumentEvent: (
        documentId: string,
        eventType: string,
      ): boolean => {
        const doc = cms.repository.documents.get(documentId);
        if (!doc) return false;

        bus.send('cms.documents', {
          event: eventType,
          documentId: doc.id,
          name: doc.name,
          status: doc.status,
          category: doc.category,
          timestamp: new Date().toISOString(),
        }, {
          headers: { messageType: `cms.${eventType}` },
        }).catch(() => {});

        return true;
      },

      /**
       * Get a combined status of ESB, CMS, DI, and DQM.
       * Usage in rules: bridge_getStatus()
       */
      bridge_getStatus: (): Record<string, any> => {
        const esbMetrics = bus.getMetrics();
        const cmsMetrics = cms.getMetrics();
        const result: Record<string, any> = {
          esb: {
            name: bus.name,
            channels: bus.channelNames.length,
            endpoints: bus.endpointNames.length,
            messagesProcessed: esbMetrics.messagesProcessed,
          },
          cms: {
            name: cms.name,
            totalDocuments: cmsMetrics.totalDocuments,
            activeWorkflows: cmsMetrics.activeWorkflows,
          },
        };
        if (di) {
          const diMetrics = di.getMetrics();
          result.di = {
            name: di.name,
            totalPipelines: diMetrics.totalPipelines,
            activePipelines: diMetrics.activePipelines,
            totalConnectors: diMetrics.totalConnectors,
            totalCDCStreams: diMetrics.totalCDCStreams,
          };
        }
        if (dqm) {
          const dqmMetrics = dqm.getMetrics();
          result.dqm = {
            name: dqm.name,
            totalQualityRules: dqmMetrics.totalQualityRules,
            totalTopics: dqmMetrics.totalTopics,
            totalQueues: dqmMetrics.totalQueues,
            currentQualityScore: dqmMetrics.currentQualityScore,
            currentQualityGrade: dqmMetrics.currentQualityGrade,
            messagesPublished: dqmMetrics.messagesPublished,
            activeAlerts: dqmMetrics.activeAlerts,
          };
        }
        return result;
      },

      /**
       * Send an ESB message from a CMS document's content.
       * Usage in rules: bridge_sendDocumentContent(documentId, channelName)
       */
      bridge_sendDocumentContent: (
        documentId: string,
        channelName: string,
      ): boolean => {
        const doc = cms.repository.documents.get(documentId);
        if (!doc) return false;

        bus.send(channelName, {
          documentId: doc.id,
          name: doc.name,
          content: doc.content,
          mimeType: doc.mimeType,
          metadata: doc.metadata,
        }, {
          headers: { messageType: 'cms.document.content' },
        }).catch(() => {});

        return true;
      },

      /**
       * Create a CMS document from an ESB message payload.
       * Usage in rules: bridge_storeMessage(name, content, mimeType)
       */
      bridge_storeMessage: (
        name: string,
        content: string,
        mimeType?: string,
      ): string | null => {
        try {
          const doc = cms.repository.store({
            name,
            content,
            mimeType: mimeType ?? 'application/json',
            path: '/esb-messages',
            tags: ['esb-origin'],
            metadata: { source: 'esb-bridge' },
            owner: 'bridge',
          });
          return doc.id;
        } catch {
          return null;
        }
      },

      /**
       * Start a CMS workflow and publish the event to ESB.
       * Usage in rules: bridge_startWorkflowAndNotify(workflowId, documentId)
       */
      bridge_startWorkflowAndNotify: (
        workflowId: string,
        documentId: string,
      ): boolean => {
        cms.workflows.execute(workflowId, documentId, 'bridge')
          .then((instance: any) => {
            bus.send('cms.workflows', {
              event: 'workflow:started',
              workflowId,
              documentId,
              instanceId: instance.instanceId,
              timestamp: new Date().toISOString(),
            }, {
              headers: { messageType: 'cms.workflow.started' },
            }).catch(() => {});
          })
          .catch(() => {});

        return true;
      },

      /**
       * Get DI metrics from a rule.
       * Usage in rules: bridge_getDIMetrics()
       */
      bridge_getDIMetrics: (): any => {
        if (!di) return null;
        return di.getMetrics();
      },

      /**
       * Notify ESB about a DI pipeline event.
       * Usage in rules: bridge_notifyPipelineEvent(pipelineId, eventType)
       */
      bridge_notifyPipelineEvent: (
        pipelineId: string,
        eventType: string,
      ): boolean => {
        bus.send('di.pipelines', {
          event: eventType,
          pipelineId,
          timestamp: new Date().toISOString(),
        }, {
          headers: { messageType: `di.${eventType}` },
        }).catch(() => {});
        return true;
      },

      /**
       * Get DQM metrics from a rule.
       * Usage in rules: bridge_getDQMMetrics()
       */
      bridge_getDQMMetrics: (): any => {
        if (!dqm) return null;
        return dqm.getMetrics();
      },

      /**
       * Publish a DQM quality event to the ESB.
       * Usage in rules: bridge_notifyQualityEvent(eventType, data)
       */
      bridge_notifyQualityEvent: (
        eventType: string,
        data?: Record<string, any>,
      ): boolean => {
        bus.send('dqm.quality', {
          event: eventType,
          ...(data ?? {}),
          timestamp: new Date().toISOString(),
        }, {
          headers: { messageType: `dqm.${eventType}` },
        }).catch(() => {});
        return true;
      },

      /**
       * Forward a DQM message to an ESB channel.
       * Usage in rules: bridge_forwardDQMToESB(topicName, channelName)
       */
      bridge_forwardDQMToESB: (
        topicName: string,
        channelName: string,
      ): boolean => {
        if (!dqm) return false;
        const topic = dqm.messaging.getTopic(topicName);
        if (!topic) return false;

        bus.send(channelName, {
          event: 'dqm:topic-forwarded',
          topic: topicName,
          timestamp: new Date().toISOString(),
        }, {
          headers: { messageType: 'dqm.topic.forwarded' },
        }).catch(() => {});

        return true;
      },

      /**
       * Validate data quality and store results as CMS document.
       * Usage in rules: bridge_validateAndStore(datasetName, data, ruleIds)
       */
      bridge_validateAndStore: (
        datasetName: string,
        data: Record<string, any>[],
        ruleIds?: string[],
      ): string | null => {
        if (!dqm) return null;
        try {
          const result = dqm.rules.evaluateAll(data, ruleIds);

          const doc = cms.repository.store({
            name: `quality-report-${datasetName}-${Date.now()}`,
            content: JSON.stringify(result, null, 2),
            mimeType: 'application/json',
            path: '/dqm-reports',
            tags: ['dqm-quality-report', datasetName],
            metadata: {
              source: 'dqm-bridge',
              datasetName,
              passRate: result.overallPassRate,
              totalViolations: result.totalViolations,
            },
            owner: 'bridge',
          });

          return doc.id;
        } catch {
          return null;
        }
      },

      /**
       * Get the current DQM quality score.
       * Usage in rules: bridge_getQualityScore()
       */
      bridge_getQualityScore: (): number => {
        if (!dqm) return 0;
        return dqm.scoring.lastScore?.overall ?? 0;
      },

      /**
       * Get the current DQM quality grade.
       * Usage in rules: bridge_getQualityGrade()
       */
      bridge_getQualityGrade: (): string => {
        if (!dqm) return 'N/A';
        return dqm.scoring.lastScore?.grade ?? 'N/A';
      },

      /**
       * Get SOA metrics from a rule.
       * Usage in rules: bridge_getSOAMetrics()
       */
      bridge_getSOAMetrics: (): any => {
        if (!soa) return null;
        return soa.getMetrics();
      },

      /**
       * Notify ESB about a SOA process event.
       * Usage in rules: bridge_notifyProcessEvent(processInstanceId, eventType)
       */
      bridge_notifyProcessEvent: (
        processInstanceId: string,
        eventType: string,
      ): boolean => {
        bus.send('soa.processes', {
          event: eventType,
          processInstanceId,
          timestamp: new Date().toISOString(),
        }, {
          headers: { messageType: `soa.${eventType}` },
        }).catch(() => {});
        return true;
      },

      /**
       * Notify ESB about a SOA task event.
       * Usage in rules: bridge_notifyTaskEvent(taskInstanceId, eventType)
       */
      bridge_notifyTaskEvent: (
        taskInstanceId: string,
        eventType: string,
      ): boolean => {
        bus.send('soa.tasks', {
          event: eventType,
          taskInstanceId,
          timestamp: new Date().toISOString(),
        }, {
          headers: { messageType: `soa.${eventType}` },
        }).catch(() => {});
        return true;
      },

      /**
       * Forward a SOA B2B document exchange to ESB.
       * Usage in rules: bridge_notifyB2BExchange(exchangeId, eventType)
       */
      bridge_notifyB2BExchange: (
        exchangeId: string,
        eventType: string,
      ): boolean => {
        bus.send('soa.b2b', {
          event: eventType,
          exchangeId,
          timestamp: new Date().toISOString(),
        }, {
          headers: { messageType: `soa.b2b.${eventType}` },
        }).catch(() => {});
        return true;
      },

      /**
       * Start a SOA BPEL process and notify ESB.
       * Usage in rules: bridge_startProcessAndNotify(processId, input)
       */
      bridge_startProcessAndNotify: (
        processId: string,
        input?: Record<string, any>,
      ): boolean => {
        if (!soa) return false;
        soa.bpel.startProcess(processId, input ?? {}, 'bridge')
          .then((instance: any) => {
            bus.send('soa.processes', {
              event: 'process:started',
              processId,
              instanceId: instance.instanceId,
              timestamp: new Date().toISOString(),
            }, {
              headers: { messageType: 'soa.process.started' },
            }).catch(() => {});
          })
          .catch(() => {});
        return true;
      },

      /**
       * Create a SOA human task and notify ESB.
       * Usage in rules: bridge_createTaskAndNotify(definitionId, input)
       */
      bridge_createTaskAndNotify: (
        definitionId: string,
        input?: Record<string, any>,
      ): boolean => {
        if (!soa) return false;
        try {
          const task = soa.tasks.createTask(definitionId, input ?? {});
          bus.send('soa.tasks', {
            event: 'task:created',
            taskInstanceId: task.instanceId,
            definitionId,
            timestamp: new Date().toISOString(),
          }, {
            headers: { messageType: 'soa.task.created' },
          }).catch(() => {});
          return true;
        } catch {
          return false;
        }
      },
    },

    onRegister: () => {
      console.log('[bridge] ESB ⇄ CMS ⇄ DI ⇄ DQM ⇄ SOA bridge plugin registered');
    },

    onDestroy: () => {
      console.log('[bridge] ESB ⇄ CMS ⇄ DI ⇄ DQM ⇄ SOA bridge plugin destroyed');
    },
  };
}

// ── Event Bridge ────────────────────────────────────────────

/**
 * Set up multi-directional event forwarding between ESB, CMS, DI, DQM, and SOA.
 *
 * CMS → ESB: Document and workflow events are published to
 *            ESB pub/sub channels for downstream consumers.
 *
 * ESB → CMS: Message events are recorded in CMS audit for
 *            compliance and traceability.
 *
 * DI → ESB:  Pipeline, CDC, and replication events are published
 *            to ESB channels for downstream processing.
 *
 * DI → CMS:  DI audit events are recorded in CMS audit.
 *
 * DQM → ESB: Quality, messaging, and alert events are published
 *            to ESB channels for downstream processing.
 *
 * DQM → CMS: DQM audit events are recorded in CMS audit.
 *
 * SOA → ESB: Process, task, CEP, B2B, and API events are published
 *            to ESB channels for downstream processing.
 *
 * SOA → CMS: SOA audit events are recorded in CMS audit.
 */
export function setupEventBridge(
  bus: ServiceBus,
  cms: ContentManagementSystem,
  di?: DataIntegrator,
  dqm?: DataQualityMessaging,
  soa?: SOASuite,
): void {
  // ── CMS → ESB: Forward document lifecycle events ──────

  const cmsDocumentEvents = [
    'document:created',
    'document:updated',
    'document:deleted',
    'document:status-changed',
    'document:checked-out',
    'document:checked-in',
    'document:versioned',
  ] as const;

  for (const eventType of cmsDocumentEvents) {
    cms.on(eventType, (event: any) => {
      bus.send('cms.events', {
        ...event,
        bridgedFrom: 'cms',
      }, {
        headers: { messageType: eventType },
      }).catch(() => {});
    });
  }

  // ── CMS → ESB: Forward workflow events ────────────────

  const cmsWorkflowEvents = [
    'workflow:started',
    'workflow:completed',
    'workflow:failed',
    'workflow:step-completed',
  ] as const;

  for (const eventType of cmsWorkflowEvents) {
    cms.on(eventType, (event: any) => {
      bus.send('cms.workflows', {
        ...event,
        bridgedFrom: 'cms',
      }, {
        headers: { messageType: eventType },
      }).catch(() => {});
    });
  }

  // ── ESB → CMS: Record ESB message events in CMS audit ─

  const esbAuditEvents = [
    'message:sent',
    'message:failed',
    'message:deadLettered',
    'saga:started',
    'saga:completed',
    'saga:failed',
  ] as const;

  for (const eventType of esbAuditEvents) {
    bus.on(eventType, (event: any) => {
      cms.security.recordAudit({
        action: `esb.${eventType}`,
        actor: 'esb-bridge',
        details: {
          ...event.data,
          messageId: event.messageId,
          bridgedFrom: 'esb',
        },
        success: eventType !== 'message:failed' && eventType !== 'saga:failed',
      });
    });
  }

  // ── DI → ESB: Forward DI pipeline and lifecycle events ─

  if (di) {
    const diPipelineEvents = [
      'pipeline:completed',
      'pipeline:failed',
    ] as const;

    for (const eventType of diPipelineEvents) {
      di.on(eventType, (event: any) => {
        bus.send('di.pipelines', {
          ...event,
          bridgedFrom: 'di',
        }, {
          headers: { messageType: eventType },
        }).catch(() => {});
      });
    }

    const diLifecycleEvents = [
      'di:started',
      'di:stopped',
      'schedule:completed',
      'schedule:failed',
      'alert:fired',
      'alert:resolved',
    ] as const;

    for (const eventType of diLifecycleEvents) {
      di.on(eventType, (event: any) => {
        bus.send('di.events', {
          ...event,
          bridgedFrom: 'di',
        }, {
          headers: { messageType: eventType },
        }).catch(() => {});
      });
    }

    // ── DI → CMS: Record DI events in CMS audit ──────

    for (const eventType of [...diPipelineEvents, ...diLifecycleEvents]) {
      di.on(eventType, (event: any) => {
        cms.security.recordAudit({
          action: `di.${eventType}`,
          actor: 'di-bridge',
          details: {
            ...event.data,
            pipelineId: event.pipelineId,
            bridgedFrom: 'di',
          },
          success: !eventType.includes('failed'),
        });
      });
    }
  }

  // ── DQM → ESB: Forward DQM quality and messaging events ─

  if (dqm) {
    const dqmQualityEvents = [
      'profile:completed',
      'profile:failed',
      'validation:completed',
      'validation:failed',
      'cleansing:completed',
      'cleansing:failed',
      'matching:completed',
      'matching:failed',
      'score:calculated',
      'score:degraded',
    ] as const;

    for (const eventType of dqmQualityEvents) {
      dqm.on(eventType, (event: any) => {
        bus.send('dqm.quality', {
          ...event,
          bridgedFrom: 'dqm',
        }, {
          headers: { messageType: eventType },
        }).catch(() => {});
      });
    }

    const dqmMessagingEvents = [
      'message:published',
      'message:delivered',
      'message:dead-lettered',
      'message:expired',
      'topic:created',
      'topic:deleted',
      'queue:created',
      'queue:deleted',
    ] as const;

    for (const eventType of dqmMessagingEvents) {
      dqm.on(eventType, (event: any) => {
        bus.send('dqm.messaging', {
          ...event,
          bridgedFrom: 'dqm',
        }, {
          headers: { messageType: eventType },
        }).catch(() => {});
      });
    }

    const dqmLifecycleEvents = [
      'dqm:started',
      'dqm:stopped',
      'alert:fired',
      'alert:resolved',
    ] as const;

    for (const eventType of dqmLifecycleEvents) {
      dqm.on(eventType, (event: any) => {
        bus.send('dqm.events', {
          ...event,
          bridgedFrom: 'dqm',
        }, {
          headers: { messageType: eventType },
        }).catch(() => {});
      });
    }

    // ── DQM → CMS: Record DQM events in CMS audit ──────

    for (const eventType of [...dqmQualityEvents, ...dqmMessagingEvents, ...dqmLifecycleEvents]) {
      dqm.on(eventType, (event: any) => {
        cms.security.recordAudit({
          action: `dqm.${eventType}`,
          actor: 'dqm-bridge',
          details: {
            ...event.data,
            bridgedFrom: 'dqm',
          },
          success: !eventType.includes('failed'),
        });
      });
    }
  }

  // ── SOA → ESB: Forward SOA process and task events ────

  if (soa) {
    const soaProcessEvents = [
      'process:started',
      'process:completed',
      'process:faulted',
      'process:terminated',
      'process:compensating',
      'process:compensated',
    ] as const;

    for (const eventType of soaProcessEvents) {
      soa.on(eventType, (event: any) => {
        bus.send('soa.processes', {
          ...event,
          bridgedFrom: 'soa',
        }, {
          headers: { messageType: eventType },
        }).catch(() => {});
      });
    }

    const soaTaskEvents = [
      'task:created',
      'task:claimed',
      'task:completed',
      'task:delegated',
      'task:escalated',
      'task:expired',
    ] as const;

    for (const eventType of soaTaskEvents) {
      soa.on(eventType, (event: any) => {
        bus.send('soa.tasks', {
          ...event,
          bridgedFrom: 'soa',
        }, {
          headers: { messageType: eventType },
        }).catch(() => {});
      });
    }

    // ── SOA → ESB: Forward CEP pattern events ─────────

    soa.on('cep:pattern-matched', (event: any) => {
      bus.send('soa.cep', {
        ...event,
        bridgedFrom: 'soa',
      }, {
        headers: { messageType: 'cep:pattern-matched' },
      }).catch(() => {});
    });

    // ── SOA → ESB: Forward B2B document events ────────

    const soaB2BEvents = [
      'b2b:document-sent',
      'b2b:document-received',
      'b2b:document-failed',
    ] as const;

    for (const eventType of soaB2BEvents) {
      soa.on(eventType, (event: any) => {
        bus.send('soa.b2b', {
          ...event,
          bridgedFrom: 'soa',
        }, {
          headers: { messageType: eventType },
        }).catch(() => {});
      });
    }

    // ── SOA → ESB: Forward API events ─────────────────

    soa.on('api:published', (event: any) => {
      bus.send('soa.api', {
        ...event,
        bridgedFrom: 'soa',
      }, {
        headers: { messageType: 'api:published' },
      }).catch(() => {});
    });

    const soaLifecycleEvents = [
      'soa:started',
      'soa:stopped',
      'sla:breached',
      'compensation:started',
      'compensation:completed',
      'compensation:failed',
      'bam:alert-fired',
      'bam:alert-resolved',
    ] as const;

    for (const eventType of soaLifecycleEvents) {
      soa.on(eventType, (event: any) => {
        bus.send('soa.events', {
          ...event,
          bridgedFrom: 'soa',
        }, {
          headers: { messageType: eventType },
        }).catch(() => {});
      });
    }

    // ── SOA → CMS: Record SOA events in CMS audit ─────

    const allSoaEvents = [
      ...soaProcessEvents,
      ...soaTaskEvents,
      ...soaB2BEvents,
      ...soaLifecycleEvents,
    ];

    for (const eventType of allSoaEvents) {
      soa.on(eventType, (event: any) => {
        cms.security.recordAudit({
          action: `soa.${eventType}`,
          actor: 'soa-bridge',
          details: {
            ...event.data,
            processInstanceId: event.processInstanceId,
            bridgedFrom: 'soa',
          },
          success: !eventType.includes('failed') && !eventType.includes('faulted'),
        });
      });
    }
  }
}
