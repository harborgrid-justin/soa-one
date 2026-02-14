// ============================================================
// SOA One — ESB ⇄ CMS Bridge
// ============================================================
//
// Provides bidirectional awareness between the ESB and CMS
// modules without either module importing the other directly.
//
// 1. CMS → ESB: CMS document/workflow events are published
//    to ESB channels so downstream consumers can react.
//
// 2. ESB → CMS: ESB message events on cms.* channels can
//    trigger CMS operations (document creation, status
//    changes, workflow starts).
//
// 3. Bridge Plugin: An engine plugin that exposes cross-module
//    functions usable in rules (e.g., send a CMS document
//    change notification via ESB, or query CMS state from
//    an ESB-triggered rule).
// ============================================================

import type { ServiceBus } from '@soa-one/esb';
import type { ContentManagementSystem } from '@soa-one/cms';

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
 * This plugin gives rules the ability to coordinate between ESB
 * and CMS — for example, a rule can create a CMS document AND
 * publish an ESB notification in a single execution.
 */
export function createBridgePlugin(
  bus: ServiceBus,
  cms: ContentManagementSystem,
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
    },

    // ── Execution Hooks ─────────────────────────────────────
    hooks: {
      beforeExecute: [
        (context) => {
          // Add integration metadata so rules know both modules
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
       * Get a combined status of both ESB and CMS.
       * Usage in rules: bridge_getStatus()
       */
      bridge_getStatus: (): Record<string, any> => {
        const esbMetrics = bus.getMetrics();
        const cmsMetrics = cms.getMetrics();
        return {
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
          .then((instance) => {
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
    },

    onRegister: () => {
      console.log('[bridge] ESB ⇄ CMS bridge plugin registered');
    },

    onDestroy: () => {
      console.log('[bridge] ESB ⇄ CMS bridge plugin destroyed');
    },
  };
}

// ── Event Bridge ────────────────────────────────────────────

/**
 * Set up bidirectional event forwarding between ESB and CMS.
 *
 * CMS → ESB: Document and workflow events are published to
 *            ESB pub/sub channels for downstream consumers.
 *
 * ESB → CMS: Message events are recorded in CMS audit for
 *            compliance and traceability.
 */
export function setupEventBridge(
  bus: ServiceBus,
  cms: ContentManagementSystem,
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
    cms.on(eventType, (event) => {
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
    cms.on(eventType, (event) => {
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
    bus.on(eventType, (event) => {
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
}
