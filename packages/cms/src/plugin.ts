// ============================================================
// SOA One CMS — Engine Plugin
// ============================================================
//
// Provides a plugin that integrates the CMS module with the
// @soa-one/engine rule engine. This ensures 100% compatibility
// with the existing SDK.
//
// The plugin:
// - Registers CMS-specific operators for content rules
// - Registers CMS action handlers for document operations
// - Provides execution hooks for CMS-aware rule processing
// - Exposes CMS functions callable from rules
// ============================================================

import type { ContentManagementSystem } from './cms';
import { generateId } from './document';

// ── SDK-Compatible Types ────────────────────────────────────

// These types mirror the @soa-one/engine plugin interfaces
// to maintain 100% compatibility without a direct dependency.

/** Operator handler compatible with @soa-one/engine. */
type OperatorHandler = (fieldValue: any, compareValue: any) => boolean;

/** Action handler compatible with @soa-one/engine. */
type ActionHandler = (
  output: Record<string, any>,
  action: { type: string; field: string; value: any },
  input: Record<string, any>,
) => void;

/** Execution hook compatible with @soa-one/engine. */
type ExecutionHook = (context: {
  ruleSet: any;
  input: Record<string, any>;
  output: Record<string, any>;
  result?: any;
  metadata: Record<string, any>;
}) => any;

/** Rule hook compatible with @soa-one/engine. */
type RuleHook = (context: {
  rule: any;
  input: Record<string, any>;
  output: Record<string, any>;
  result?: any;
  skip?: boolean;
  metadata: Record<string, any>;
}) => any;

/** Custom function compatible with @soa-one/engine. */
type CustomFunction = (...args: any[]) => any;

/**
 * EnginePlugin interface compatible with @soa-one/engine.
 * Defined here to avoid a circular dependency.
 */
export interface EnginePlugin {
  name: string;
  version?: string;
  operators?: Record<string, OperatorHandler>;
  actionHandlers?: Record<string, ActionHandler>;
  hooks?: {
    beforeExecute?: ExecutionHook[];
    afterExecute?: ExecutionHook[];
    beforeRule?: RuleHook[];
    afterRule?: RuleHook[];
  };
  functions?: Record<string, CustomFunction>;
  onRegister?: () => void;
  onDestroy?: () => void;
}

// ── CMS Engine Plugin Factory ───────────────────────────────

/**
 * Create an @soa-one/engine plugin that integrates the CMS.
 *
 * Usage with @soa-one/engine:
 * ```ts
 * import { RuleEngine } from '@soa-one/engine';
 * import { ContentManagementSystem, createCMSPlugin } from '@soa-one/cms';
 *
 * const cms = new ContentManagementSystem({ name: 'my-cms' });
 * await cms.init();
 *
 * const engine = new RuleEngine({
 *   plugins: [createCMSPlugin(cms)],
 * });
 *
 * // Rules can now use CMS operators and actions
 * const result = await engine.execute(ruleSet, input);
 * ```
 */
export function createCMSPlugin(cms: ContentManagementSystem): EnginePlugin {
  return {
    name: 'soa-one-cms',
    version: '1.0.0',

    // ── Custom Operators ──────────────────────────────────
    operators: {
      /**
       * Check if a document exists.
       * Usage: field="documentId", operator="documentExists", value=true
       */
      documentExists: (fieldValue: any, _compareValue: any): boolean => {
        return cms.repository.documents.get(String(fieldValue)) !== undefined;
      },

      /**
       * Check if a document has a specific status.
       * Usage: field="documentId", operator="documentHasStatus", value="published"
       */
      documentHasStatus: (fieldValue: any, compareValue: any): boolean => {
        const doc = cms.repository.documents.get(String(fieldValue));
        return doc?.status === String(compareValue);
      },

      /**
       * Check if a document is under legal hold.
       * Usage: field="documentId", operator="documentUnderHold", value=true
       */
      documentUnderHold: (fieldValue: any, _compareValue: any): boolean => {
        return cms.retention.isDocumentUnderHold(String(fieldValue));
      },

      /**
       * Check if a document's content matches a pattern.
       * Usage: field="documentContent", operator="contentMatches", value="pattern"
       */
      contentMatches: (fieldValue: any, compareValue: any): boolean => {
        try {
          return new RegExp(String(compareValue)).test(String(fieldValue));
        } catch {
          return false;
        }
      },

      /**
       * Check if a document has a specific tag.
       * Usage: field="documentId", operator="documentHasTag", value="important"
       */
      documentHasTag: (fieldValue: any, compareValue: any): boolean => {
        const doc = cms.repository.documents.get(String(fieldValue));
        return doc?.tags.includes(String(compareValue)) ?? false;
      },

      /**
       * Check if a document category matches.
       * Usage: field="documentId", operator="documentCategoryIs", value="image"
       */
      documentCategoryIs: (fieldValue: any, compareValue: any): boolean => {
        const doc = cms.repository.documents.get(String(fieldValue));
        return doc?.category === String(compareValue);
      },

      /**
       * Check if a document's size exceeds a threshold.
       * Usage: field="documentId", operator="documentSizeExceeds", value=1000000
       */
      documentSizeExceeds: (fieldValue: any, compareValue: any): boolean => {
        const doc = cms.repository.documents.get(String(fieldValue));
        return doc ? doc.sizeBytes > Number(compareValue) : false;
      },

      /**
       * Check if a document has active workflows.
       * Usage: field="documentId", operator="hasActiveWorkflow", value=true
       */
      hasActiveWorkflow: (fieldValue: any, _compareValue: any): boolean => {
        const instances = cms.workflows.getInstancesByDocument(String(fieldValue));
        return instances.some((i) => i.status === 'active');
      },
    },

    // ── Custom Action Handlers ────────────────────────────
    actionHandlers: {
      /**
       * Create a document in the CMS.
       * Usage: type="CMS_CREATE", field="documentName", value={ content, mimeType }
       */
      CMS_CREATE: (
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
            owner: config.owner ?? 'rule-engine',
          });

          if (!output._cmsDocuments) output._cmsDocuments = [];
          output._cmsDocuments.push({
            documentId: doc.id,
            name: doc.name,
            createdAt: doc.createdAt,
          });
        } catch {
          // Swallow errors in action handlers
        }
      },

      /**
       * Update a document's status.
       * Usage: type="CMS_STATUS", field="documentId", value="published"
       */
      CMS_STATUS: (
        output: Record<string, any>,
        action: { type: string; field: string; value: any },
        _input: Record<string, any>,
      ): void => {
        try {
          cms.repository.documents.changeStatus(
            action.field,
            action.value,
            'rule-engine',
          );

          if (!output._cmsStatusChanges) output._cmsStatusChanges = [];
          output._cmsStatusChanges.push({
            documentId: action.field,
            newStatus: action.value,
            changedAt: new Date().toISOString(),
          });
        } catch {
          // Swallow errors
        }
      },

      /**
       * Apply a retention policy to a document.
       * Usage: type="CMS_RETENTION", field="documentId", value="policyId"
       */
      CMS_RETENTION: (
        output: Record<string, any>,
        action: { type: string; field: string; value: any },
        _input: Record<string, any>,
      ): void => {
        try {
          const doc = cms.repository.documents.get(action.field);
          if (doc) {
            const entry = cms.retention.applyRetention(doc, String(action.value));

            if (!output._cmsRetention) output._cmsRetention = [];
            output._cmsRetention.push({
              documentId: action.field,
              policyId: action.value,
              retentionEndDate: entry.retentionEndDate,
            });
          }
        } catch {
          // Swallow errors
        }
      },

      /**
       * Classify a document under a taxonomy node.
       * Usage: type="CMS_CLASSIFY", field="documentId", value="nodeId"
       */
      CMS_CLASSIFY: (
        output: Record<string, any>,
        action: { type: string; field: string; value: any },
        _input: Record<string, any>,
      ): void => {
        try {
          cms.taxonomies.classifyDocument(action.field, String(action.value));

          if (!output._cmsClassifications) output._cmsClassifications = [];
          output._cmsClassifications.push({
            documentId: action.field,
            nodeId: action.value,
            classifiedAt: new Date().toISOString(),
          });
        } catch {
          // Swallow errors
        }
      },

      /**
       * Start a workflow on a document.
       * Usage: type="CMS_WORKFLOW", field="documentId", value={ workflowId, initiatedBy }
       */
      CMS_WORKFLOW: (
        output: Record<string, any>,
        action: { type: string; field: string; value: any },
        _input: Record<string, any>,
      ): void => {
        const config = action.value;
        cms.workflows.execute(
          config.workflowId,
          action.field,
          config.initiatedBy ?? 'rule-engine',
        ).then((instance) => {
          if (!output._cmsWorkflows) output._cmsWorkflows = [];
          output._cmsWorkflows.push({
            instanceId: instance.instanceId,
            documentId: action.field,
            workflowId: config.workflowId,
          });
        }).catch(() => {});
      },
    },

    // ── Execution Hooks ───────────────────────────────────
    hooks: {
      beforeExecute: [
        (context) => {
          // Add CMS metadata to execution context
          const metrics = cms.getMetrics();
          context.metadata.cms = {
            name: cms.name,
            totalDocuments: metrics.totalDocuments,
            activeWorkflows: metrics.activeWorkflows,
            documentsUnderHold: metrics.documentsUnderHold,
          };
          return context;
        },
      ],

      afterExecute: [
        (context) => {
          // Record rule execution in CMS audit
          if (context.result) {
            cms.security.recordAudit({
              action: 'rule-engine.execute',
              actor: 'rule-engine',
              details: {
                ruleSet: context.ruleSet.name ?? context.ruleSet.id,
                rulesFired: context.result.rulesFired?.length ?? 0,
                executionTimeMs: context.result.executionTimeMs ?? 0,
              },
              success: true,
            });
          }
          return context;
        },
      ],
    },

    // ── Custom Functions ──────────────────────────────────
    functions: {
      /**
       * Get a document by ID.
       * Usage: cms_getDocument(documentId)
       */
      cms_getDocument: (documentId: string) => {
        return cms.repository.documents.get(documentId);
      },

      /**
       * Get total document count.
       * Usage: cms_documentCount()
       */
      cms_documentCount: () => {
        return cms.repository.documents.documentCount;
      },

      /**
       * Check if a document exists.
       * Usage: cms_documentExists(documentId)
       */
      cms_documentExists: (documentId: string) => {
        return cms.repository.documents.get(documentId) !== undefined;
      },

      /**
       * Get CMS metrics.
       * Usage: cms_getMetrics()
       */
      cms_getMetrics: () => {
        return cms.getMetrics();
      },

      /**
       * Search documents by text.
       * Usage: cms_search(queryText)
       */
      cms_search: (queryText: string) => {
        return cms.search.search({ type: 'fulltext', text: queryText });
      },

      /**
       * Generate a unique ID.
       * Usage: cms_generateId()
       */
      cms_generateId: () => {
        return generateId();
      },

      /**
       * Get document tags.
       * Usage: cms_getDocumentTags(documentId)
       */
      cms_getDocumentTags: (documentId: string) => {
        const doc = cms.repository.documents.get(documentId);
        return doc?.tags ?? [];
      },

      /**
       * Get document classification nodes.
       * Usage: cms_getDocumentClassifications(documentId)
       */
      cms_getDocumentClassifications: (documentId: string) => {
        return cms.taxonomies.getDocumentClassifications(documentId);
      },

      /**
       * Get active workflow count for a document.
       * Usage: cms_activeWorkflowCount(documentId)
       */
      cms_activeWorkflowCount: (documentId: string) => {
        return cms.workflows.getInstancesByDocument(documentId)
          .filter((i) => i.status === 'active').length;
      },

      /**
       * Get the retention schedule for a document.
       * Usage: cms_getRetentionSchedule(documentId)
       */
      cms_getRetentionSchedule: (documentId: string) => {
        return cms.retention.getRetentionSchedule(documentId);
      },
    },

    // ── Lifecycle ─────────────────────────────────────────
    onRegister: () => {
      cms.security.recordAudit({
        action: 'plugin.registered',
        actor: 'rule-engine',
        details: { plugin: 'soa-one-cms' },
        success: true,
      });
    },

    onDestroy: () => {
      cms.security.recordAudit({
        action: 'plugin.destroyed',
        actor: 'rule-engine',
        details: { plugin: 'soa-one-cms' },
        success: true,
      });
    },
  };
}
