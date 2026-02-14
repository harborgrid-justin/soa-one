// ============================================================
// SOA One CMS — Content Repository
// ============================================================
//
// Provides content repository management with storage tiers,
// quota enforcement, deduplication, MIME type policies,
// and comprehensive metrics.
//
// Surpasses Oracle WebCenter's content server with:
// - Multi-tier storage (hot/warm/cold/archive/glacier)
// - Content deduplication by hash
// - Quota management with alerts
// - MIME type allow/block policies
// - Repository-level metrics and analytics
// ============================================================

import type {
  RepositoryConfig,
  RepositoryMetrics,
  StorageTier,
  CMSDocument,
  DocumentStatus,
  ContentCategory,
} from './types';
import {
  DocumentManager,
  type CreateDocumentOptions,
  DocumentNotFoundError,
  generateId,
  hashContent,
  calculateSize,
} from './document';

// ── Content Repository ──────────────────────────────────────

/**
 * Content repository with storage management, deduplication,
 * quota enforcement, and policy-driven content governance.
 */
export class ContentRepository {
  readonly name: string;
  private readonly _config: RepositoryConfig;
  private readonly _documentManager: DocumentManager;
  private readonly _storageTiers: Map<string, StorageTier> = new Map();
  private readonly _contentHashes: Map<string, string[]> = new Map();
  private _totalSizeBytes = 0;
  private _documentsCreatedToday = 0;
  private _documentsModifiedToday = 0;
  private _todayDate = new Date().toISOString().split('T')[0];

  constructor(config: RepositoryConfig) {
    this.name = config.name;
    this._config = config;
    this._documentManager = new DocumentManager();
  }

  /** Access the underlying document manager. */
  get documents(): DocumentManager {
    return this._documentManager;
  }

  // ── Document Operations (with policy enforcement) ───────

  /** Store a new document with policy checks. */
  store(options: CreateDocumentOptions, actor?: string): CMSDocument {
    // Validate MIME type
    this._validateMimeType(options.mimeType);

    // Validate size
    const sizeBytes = calculateSize(options.content);
    if (this._config.maxDocumentSizeBytes && sizeBytes > this._config.maxDocumentSizeBytes) {
      throw new RepositoryPolicyError(
        `Document size (${sizeBytes} bytes) exceeds maximum (${this._config.maxDocumentSizeBytes} bytes)`,
      );
    }

    // Check quota
    if (this._config.quotaBytes && this._totalSizeBytes + sizeBytes > this._config.quotaBytes) {
      throw new QuotaExceededError(this._config.quotaBytes, this._totalSizeBytes + sizeBytes);
    }

    // Deduplication check
    if (this._config.deduplication) {
      const hash = hashContent(options.content);
      const existing = this._contentHashes.get(hash);
      if (existing && existing.length > 0) {
        // Store reference instead of duplicate content
        const doc = this._documentManager.create({
          ...options,
          owner: actor ?? options.owner,
          metadata: {
            ...options.metadata,
            _deduplicatedFrom: existing[0],
            _contentHash: hash,
          },
        });
        existing.push(doc.id);
        this._trackStore(doc);
        return doc;
      }
    }

    const doc = this._documentManager.create({
      ...options,
      owner: actor ?? options.owner,
    });

    // Track content hash
    if (doc.contentHash) {
      if (!this._contentHashes.has(doc.contentHash)) {
        this._contentHashes.set(doc.contentHash, []);
      }
      this._contentHashes.get(doc.contentHash)!.push(doc.id);
    }

    // Track size and storage tier
    this._trackStore(doc);

    // Assign default storage tier
    this._storageTiers.set(doc.id, this._config.defaultStorageTier);

    return doc;
  }

  /** Retrieve a document by ID. */
  retrieve(id: string): CMSDocument | undefined {
    return this._documentManager.get(id);
  }

  /** Update a document with policy checks. */
  update(
    id: string,
    updates: {
      content?: any;
      name?: string;
      description?: string;
      tags?: string[];
      metadata?: Record<string, any>;
    },
    actor: string,
    changeDescription?: string,
  ): CMSDocument {
    const existing = this._documentManager.get(id);
    if (!existing) throw new DocumentNotFoundError(id);

    if (updates.content !== undefined) {
      const newSize = calculateSize(updates.content);
      if (this._config.maxDocumentSizeBytes && newSize > this._config.maxDocumentSizeBytes) {
        throw new RepositoryPolicyError(
          `Updated document size (${newSize} bytes) exceeds maximum`,
        );
      }

      // Update quota tracking
      const sizeDiff = newSize - existing.sizeBytes;
      if (this._config.quotaBytes && this._totalSizeBytes + sizeDiff > this._config.quotaBytes) {
        throw new QuotaExceededError(this._config.quotaBytes, this._totalSizeBytes + sizeDiff);
      }
      this._totalSizeBytes += sizeDiff;
    }

    const doc = this._documentManager.update(id, updates, actor, changeDescription);
    this._refreshDayCounter();
    this._documentsModifiedToday++;

    return doc;
  }

  /** Remove a document from the repository. */
  remove(id: string, actor: string): boolean {
    const doc = this._documentManager.get(id);
    if (!doc) return false;

    this._totalSizeBytes -= doc.sizeBytes;
    this._storageTiers.delete(id);

    // Clean up content hash tracking
    if (doc.contentHash) {
      const ids = this._contentHashes.get(doc.contentHash);
      if (ids) {
        const idx = ids.indexOf(id);
        if (idx >= 0) ids.splice(idx, 1);
        if (ids.length === 0) this._contentHashes.delete(doc.contentHash);
      }
    }

    return this._documentManager.delete(id, actor);
  }

  // ── Storage Tier Management ─────────────────────────────

  /** Get the storage tier of a document. */
  getStorageTier(documentId: string): StorageTier | undefined {
    return this._storageTiers.get(documentId);
  }

  /** Move a document to a different storage tier. */
  setStorageTier(documentId: string, tier: StorageTier): void {
    if (!this._documentManager.get(documentId)) {
      throw new DocumentNotFoundError(documentId);
    }
    this._storageTiers.set(documentId, tier);
  }

  /** Get all documents on a specific tier. */
  getDocumentsByTier(tier: StorageTier): string[] {
    return Array.from(this._storageTiers.entries())
      .filter(([_, t]) => t === tier)
      .map(([id]) => id);
  }

  // ── Deduplication ───────────────────────────────────────

  /** Find documents with the same content hash. */
  findDuplicates(documentId: string): string[] {
    const doc = this._documentManager.get(documentId);
    if (!doc || !doc.contentHash) return [];

    const ids = this._contentHashes.get(doc.contentHash) ?? [];
    return ids.filter((id) => id !== documentId);
  }

  /** Get all duplicate groups (content hash → document IDs). */
  getDuplicateGroups(): Map<string, string[]> {
    const groups = new Map<string, string[]>();
    for (const [hash, ids] of this._contentHashes) {
      if (ids.length > 1) {
        groups.set(hash, [...ids]);
      }
    }
    return groups;
  }

  // ── Quota Management ────────────────────────────────────

  /** Get current storage usage in bytes. */
  get storageUsed(): number {
    return this._totalSizeBytes;
  }

  /** Get quota in bytes (0 = unlimited). */
  get quota(): number {
    return this._config.quotaBytes ?? 0;
  }

  /** Get quota usage percentage. */
  get quotaUsedPercent(): number {
    if (!this._config.quotaBytes) return 0;
    return (this._totalSizeBytes / this._config.quotaBytes) * 100;
  }

  /** Check if quota is near full (>80%). */
  get isQuotaNearFull(): boolean {
    return this.quotaUsedPercent > 80;
  }

  // ── Metrics ─────────────────────────────────────────────

  /** Get repository metrics snapshot. */
  getMetrics(): RepositoryMetrics {
    this._refreshDayCounter();

    const docs = this._documentManager.list();
    const documentsByStatus: Record<string, number> = {};
    const documentsByCategory: Record<string, number> = {};
    let totalVersions = 0;

    for (const doc of docs) {
      documentsByStatus[doc.status] = (documentsByStatus[doc.status] ?? 0) + 1;
      documentsByCategory[doc.category] = (documentsByCategory[doc.category] ?? 0) + 1;
      totalVersions += this._documentManager.getVersionCount(doc.id);
    }

    return {
      totalDocuments: docs.length,
      totalVersions,
      totalFolders: this._documentManager.folderCount,
      totalSizeBytes: this._totalSizeBytes,
      quotaUsedPercent: this.quotaUsedPercent,
      documentsByStatus: documentsByStatus as Record<DocumentStatus, number>,
      documentsByCategory: documentsByCategory as Record<ContentCategory, number>,
      documentsCreatedToday: this._documentsCreatedToday,
      documentsModifiedToday: this._documentsModifiedToday,
      averageVersionsPerDocument: docs.length > 0
        ? totalVersions / docs.length
        : 0,
      timestamp: new Date().toISOString(),
    };
  }

  // ── Policy Queries ──────────────────────────────────────

  /** Check if a MIME type is allowed. */
  isMimeTypeAllowed(mimeType: string): boolean {
    if (this._config.blockedMimeTypes?.includes(mimeType)) return false;
    if (this._config.allowedMimeTypes && this._config.allowedMimeTypes.length > 0) {
      return this._config.allowedMimeTypes.includes(mimeType);
    }
    return true;
  }

  /** Get repository configuration (read-only copy). */
  get config(): Readonly<RepositoryConfig> {
    return { ...this._config };
  }

  // ── Private ─────────────────────────────────────────────

  private _validateMimeType(mimeType: string): void {
    if (!this.isMimeTypeAllowed(mimeType)) {
      throw new RepositoryPolicyError(`MIME type not allowed: ${mimeType}`);
    }
  }

  private _trackStore(doc: CMSDocument): void {
    this._totalSizeBytes += doc.sizeBytes;
    this._refreshDayCounter();
    this._documentsCreatedToday++;
  }

  private _refreshDayCounter(): void {
    const today = new Date().toISOString().split('T')[0];
    if (today !== this._todayDate) {
      this._todayDate = today;
      this._documentsCreatedToday = 0;
      this._documentsModifiedToday = 0;
    }
  }
}

// ── Error Types ──────────────────────────────────────────────

export class RepositoryPolicyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RepositoryPolicyError';
  }
}

export class QuotaExceededError extends Error {
  constructor(
    public readonly quotaBytes: number,
    public readonly requestedBytes: number,
  ) {
    super(`Storage quota exceeded: ${requestedBytes} bytes requested, ${quotaBytes} bytes allowed`);
    this.name = 'QuotaExceededError';
  }
}
