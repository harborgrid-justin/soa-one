// ============================================================
// SOA One CMS — ContentManagementSystem (Main Orchestrator)
// ============================================================
//
// The ContentManagementSystem is the central orchestrator that
// ties together all CMS subsystems: documents, repository,
// workflow, imaging, search, taxonomy, retention, collaboration,
// security, rendition, and metadata.
//
// Provides a unified API for:
// - Document creation, versioning, and lifecycle
// - Content repository with storage policies
// - Workflow orchestration for documents
// - Document imaging and OCR
// - Full-text and metadata search
// - Taxonomy-based classification
// - Records retention and legal hold
// - Real-time collaboration
// - Security and access control
// - Multi-format renditions
// - Metadata extraction and management
//
// 100% compatible with @soa-one/engine SDK via the CMS plugin.
// ============================================================

import type {
  CMSConfig,
  CMSMetrics,
  CMSEvent,
  CMSEventType,
  CMSEventListener,
  CMSDocument,
} from './types';

import {
  ContentRepository,
} from './repository';
import { WorkflowEngine } from './workflow';
import {
  ImagingPipelineExecutor,
  OCREngine,
  BarcodeEngine,
  AnnotationManager,
  DocumentComparator,
  WatermarkEngine,
} from './imaging';
import { SearchEngine } from './search';
import { TaxonomyManager } from './taxonomy';
import { RetentionManager } from './retention';
import { CollaborationHub } from './collaboration';
import { AccessControlManager } from './security';
import { RenditionEngine } from './rendition';
import { MetadataSchemaManager } from './metadata';

// ── ContentManagementSystem ─────────────────────────────────

/**
 * Central Content Management System orchestrator.
 *
 * Usage:
 * ```ts
 * const cms = new ContentManagementSystem({
 *   name: 'my-cms',
 *   repository: {
 *     name: 'main',
 *     type: 'standard',
 *     defaultStorageTier: 'hot',
 *     versioningEnabled: true,
 *     autoHash: true,
 *     hashAlgorithm: 'sha256',
 *     deduplication: true,
 *   },
 * });
 * await cms.init();
 *
 * const doc = cms.repository.store({
 *   name: 'Report.pdf',
 *   content: 'Annual Report...',
 *   mimeType: 'application/pdf',
 *   owner: 'alice',
 * });
 *
 * cms.search.indexDocument(doc);
 * const results = cms.search.search({ type: 'fulltext', text: 'Annual' });
 *
 * await cms.shutdown();
 * ```
 */
export class ContentManagementSystem {
  readonly name: string;
  private readonly _config: CMSConfig;

  // Subsystems
  private readonly _repository: ContentRepository;
  private readonly _workflows: WorkflowEngine;
  private readonly _imaging: ImagingPipelineExecutor;
  private readonly _search: SearchEngine;
  private readonly _taxonomies: TaxonomyManager;
  private readonly _retention: RetentionManager;
  private readonly _collaboration: CollaborationHub;
  private readonly _security: AccessControlManager;
  private readonly _renditions: RenditionEngine;
  private readonly _metadata: MetadataSchemaManager;
  private readonly _annotations: AnnotationManager;

  // Event listeners
  private _eventListeners: Map<string, CMSEventListener[]> = new Map();

  // State
  private _initialized = false;
  private _destroyed = false;
  private _startTime = Date.now();

  constructor(config: CMSConfig) {
    this.name = config.name;
    this._config = config;

    // Initialize subsystems
    this._repository = new ContentRepository(config.repository ?? {
      name: config.name,
      type: 'standard',
      defaultStorageTier: 'hot',
      versioningEnabled: true,
      autoHash: true,
      hashAlgorithm: 'sha256',
      deduplication: false,
    });

    this._workflows = new WorkflowEngine();
    this._imaging = new ImagingPipelineExecutor();
    this._search = new SearchEngine();
    this._taxonomies = new TaxonomyManager();
    this._retention = new RetentionManager();
    this._collaboration = new CollaborationHub();
    this._security = new AccessControlManager(config.security);
    this._renditions = new RenditionEngine();
    this._metadata = new MetadataSchemaManager();
    this._annotations = new AnnotationManager();
  }

  // ── Lifecycle ───────────────────────────────────────────

  /** Initialize the CMS. */
  async init(): Promise<void> {
    if (this._initialized) return;
    if (this._destroyed) {
      throw new Error('Cannot init a destroyed CMS. Create a new instance.');
    }

    this._initialized = true;
    this._startTime = Date.now();
    this._emitEvent('cms:started', 'ContentManagementSystem');
  }

  /** Shut down the CMS. */
  async shutdown(): Promise<void> {
    if (this._destroyed) return;

    this._emitEvent('cms:stopped', 'ContentManagementSystem');

    this._initialized = false;
    this._destroyed = true;
  }

  /** Whether the CMS is initialized. */
  get isInitialized(): boolean {
    return this._initialized;
  }

  /** Whether the CMS has been shut down. */
  get isDestroyed(): boolean {
    return this._destroyed;
  }

  // ── Subsystem Access ────────────────────────────────────

  /** Access the content repository. */
  get repository(): ContentRepository {
    return this._repository;
  }

  /** Access the workflow engine. */
  get workflows(): WorkflowEngine {
    return this._workflows;
  }

  /** Access the imaging pipeline executor. */
  get imaging(): ImagingPipelineExecutor {
    return this._imaging;
  }

  /** Access the search engine. */
  get search(): SearchEngine {
    return this._search;
  }

  /** Access the taxonomy manager. */
  get taxonomies(): TaxonomyManager {
    return this._taxonomies;
  }

  /** Access the retention manager. */
  get retention(): RetentionManager {
    return this._retention;
  }

  /** Access the collaboration hub. */
  get collaboration(): CollaborationHub {
    return this._collaboration;
  }

  /** Access the access control manager. */
  get security(): AccessControlManager {
    return this._security;
  }

  /** Access the rendition engine. */
  get renditions(): RenditionEngine {
    return this._renditions;
  }

  /** Access the metadata schema manager. */
  get metadata(): MetadataSchemaManager {
    return this._metadata;
  }

  /** Access the annotation manager. */
  get annotations(): AnnotationManager {
    return this._annotations;
  }

  // ── Convenience Methods ─────────────────────────────────

  /**
   * Store a document with full lifecycle processing:
   * index for search, auto-classify, extract metadata,
   * auto-generate renditions, and apply retention.
   */
  async ingest(options: {
    name: string;
    content: any;
    mimeType: string;
    path?: string;
    owner?: string;
    tags?: string[];
    metadata?: Record<string, any>;
  }): Promise<CMSDocument> {
    this._ensureInitialized();

    // 1. Store in repository
    const doc = this._repository.store(options, options.owner);

    // 2. Extract metadata
    const extracted = this._metadata.extractMetadata(doc);
    if (Object.keys(extracted).length > 0) {
      this._repository.update(
        doc.id,
        { metadata: { ...doc.metadata, ...extracted } },
        options.owner ?? 'system',
        'Metadata extraction',
      );
    }

    // 3. Index for search
    this._search.indexDocument(doc);

    // 4. Auto-classify
    this._taxonomies.autoClassifyAndApply(doc);

    // 5. Auto-generate renditions
    this._renditions.autoGenerate(doc);

    // 6. Apply default retention
    if (this._config.defaultRetentionPolicyId) {
      try {
        this._retention.applyRetention(doc, this._config.defaultRetentionPolicyId);
      } catch {
        // Skip if policy not found
      }
    }

    // 7. Record audit
    if (this._config.auditEnabled !== false) {
      this._security.recordAudit({
        action: 'document.ingested',
        documentId: doc.id,
        actor: options.owner ?? 'system',
        details: {
          name: doc.name,
          mimeType: doc.mimeType,
          sizeBytes: doc.sizeBytes,
        },
        success: true,
      });
    }

    this._emitEvent('document:created', 'ContentManagementSystem', doc.id);

    return doc;
  }

  // ── Metrics ─────────────────────────────────────────────

  /** Get a snapshot of CMS metrics. */
  getMetrics(): CMSMetrics {
    const repoMetrics = this._repository.getMetrics();
    const searchStats = this._search.stats;

    return {
      totalDocuments: repoMetrics.totalDocuments,
      totalVersions: repoMetrics.totalVersions,
      totalFolders: repoMetrics.totalFolders,
      totalStorageBytes: repoMetrics.totalSizeBytes,
      documentsByStatus: repoMetrics.documentsByStatus as Record<string, number>,
      documentsByCategory: repoMetrics.documentsByCategory as Record<string, number>,
      activeWorkflows: this._workflows.activeCount,
      pendingTasks: this._workflows.pendingTaskCount,
      documentsUnderHold: this._retention.documentsUnderHoldCount,
      activeUsers: 0, // Would need presence data
      searchQueriesToday: searchStats.searchCount,
      averageSearchLatencyMs: searchStats.averageLatencyMs,
      renditionsToday: this._renditions.totalGenerated,
      imagingOperationsToday: this._imaging.operationsCount,
      retentionDispositionsPending: this._retention.pendingDispositionCount,
      uptimeMs: Date.now() - this._startTime,
      timestamp: new Date().toISOString(),
    };
  }

  // ── Events ──────────────────────────────────────────────

  /** Subscribe to CMS events. */
  on(eventType: CMSEventType, listener: CMSEventListener): void {
    if (!this._eventListeners.has(eventType)) {
      this._eventListeners.set(eventType, []);
    }
    this._eventListeners.get(eventType)!.push(listener);
  }

  /** Unsubscribe from CMS events. */
  off(eventType: CMSEventType, listener: CMSEventListener): void {
    const listeners = this._eventListeners.get(eventType);
    if (listeners) {
      const idx = listeners.indexOf(listener);
      if (idx >= 0) listeners.splice(idx, 1);
    }
  }

  // ── Private ─────────────────────────────────────────────

  private _ensureInitialized(): void {
    if (!this._initialized) {
      throw new Error('CMS is not initialized. Call init() first.');
    }
    if (this._destroyed) {
      throw new Error('CMS has been destroyed. Create a new instance.');
    }
  }

  private _emitEvent(
    type: CMSEventType,
    source: string,
    documentId?: string,
    data?: Record<string, any>,
  ): void {
    const event: CMSEvent = {
      type,
      timestamp: new Date().toISOString(),
      source,
      documentId,
      data,
    };

    const listeners = this._eventListeners.get(type);
    if (listeners) {
      for (const listener of listeners) {
        try {
          listener(event);
        } catch {
          // Swallow listener errors
        }
      }
    }
  }
}
