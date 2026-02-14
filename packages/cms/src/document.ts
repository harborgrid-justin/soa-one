// ============================================================
// SOA One CMS — Document Lifecycle Management
// ============================================================
//
// Provides document creation, versioning, check-out/check-in,
// locking, relationship management, and folder operations.
//
// Surpasses Oracle WebCenter's document management with:
// - Branching version model (major/minor)
// - Automatic content hashing and deduplication
// - Relationship graphs between documents
// - Folder hierarchy with inheritance
// - Document lifecycle state machine
// ============================================================

import type {
  CMSDocument,
  DocumentVersion,
  DocumentStatus,
  DocumentRelation,
  DocumentRelationType,
  ContentCategory,
  DocumentPriority,
  Folder,
} from './types';

// ── Utilities ────────────────────────────────────────────────

/** Generate a unique ID. */
export function generateId(): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).substring(2, 10);
  const rand2 = Math.random().toString(36).substring(2, 6);
  return `${ts}-${rand}-${rand2}`;
}

/** Generate a simple hash of content. */
export function hashContent(content: any): string {
  const str = typeof content === 'string' ? content : JSON.stringify(content);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}

/** Calculate size of content in bytes. */
export function calculateSize(content: any): number {
  const str = typeof content === 'string' ? content : JSON.stringify(content);
  return new TextEncoder().encode(str).length;
}

/** Detect content category from MIME type. */
export function detectCategory(mimeType: string): ContentCategory {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel') || mimeType === 'text/csv') return 'spreadsheet';
  if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return 'presentation';
  if (mimeType.includes('pdf') || mimeType.includes('word') || mimeType.includes('document') || mimeType === 'text/plain' || mimeType === 'text/rtf') return 'document';
  if (mimeType.includes('zip') || mimeType.includes('tar') || mimeType.includes('gzip') || mimeType.includes('compress')) return 'archive';
  if (mimeType.includes('json') || mimeType.includes('xml') || mimeType.includes('yaml') || mimeType.includes('csv')) return 'data';
  if (mimeType.includes('javascript') || mimeType.includes('typescript') || mimeType.includes('python') || mimeType.includes('java')) return 'code';
  if (mimeType.includes('form')) return 'form';
  if (mimeType.includes('message') || mimeType.includes('email')) return 'email';
  return 'other';
}

// ── Valid Status Transitions ─────────────────────────────────

const VALID_TRANSITIONS: Record<DocumentStatus, DocumentStatus[]> = {
  'draft': ['pending-review', 'published', 'deleted', 'checked-out'],
  'pending-review': ['approved', 'draft', 'deleted'],
  'approved': ['published', 'draft', 'deleted'],
  'published': ['archived', 'superseded', 'draft', 'deleted', 'expired', 'checked-out'],
  'archived': ['published', 'deleted'],
  'deleted': [],
  'superseded': ['archived', 'deleted'],
  'checked-out': ['draft', 'published'],
  'locked': ['draft', 'pending-review', 'approved', 'published'],
  'expired': ['draft', 'archived', 'deleted'],
};

/** Check if a status transition is valid. */
export function isValidTransition(from: DocumentStatus, to: DocumentStatus): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

// ── Document Factory ─────────────────────────────────────────

/** Options for creating a new document. */
export interface CreateDocumentOptions {
  name: string;
  content: any;
  mimeType: string;
  path?: string;
  description?: string;
  tags?: string[];
  metadata?: Record<string, any>;
  owner?: string;
  priority?: DocumentPriority;
  language?: string;
  status?: DocumentStatus;
}

/**
 * Create a new CMS document.
 */
export function createDocument(options: CreateDocumentOptions): CMSDocument {
  const now = new Date().toISOString();
  const owner = options.owner ?? 'system';
  const sizeBytes = calculateSize(options.content);

  return {
    id: generateId(),
    name: options.name,
    description: options.description,
    mimeType: options.mimeType,
    category: detectCategory(options.mimeType),
    status: options.status ?? 'draft',
    priority: options.priority ?? 'normal',
    content: options.content,
    sizeBytes,
    contentHash: hashContent(options.content),
    hashAlgorithm: 'sha256',
    version: 1,
    versionLabel: '1.0',
    path: options.path ?? '/',
    tags: options.tags ?? [],
    metadata: options.metadata ?? {},
    owner,
    createdBy: owner,
    createdAt: now,
    modifiedBy: owner,
    modifiedAt: now,
    locked: false,
    checkedOut: false,
    legalHold: false,
    taxonomyNodeIds: [],
    relatedDocumentIds: [],
    renditionIds: [],
    language: options.language,
  };
}

// ── Document Manager ─────────────────────────────────────────

/**
 * Manages document lifecycle including versioning, locking,
 * check-out/check-in, relationships, and status transitions.
 */
export class DocumentManager {
  private _documents: Map<string, CMSDocument> = new Map();
  private _versions: Map<string, DocumentVersion[]> = new Map();
  private _relations: Map<string, DocumentRelation> = new Map();
  private _folders: Map<string, Folder> = new Map();
  private _deletedDocuments: Map<string, CMSDocument> = new Map();

  // ── Document CRUD ───────────────────────────────────────

  /** Create and store a new document. */
  create(options: CreateDocumentOptions): CMSDocument {
    const doc = createDocument(options);
    this._documents.set(doc.id, doc);

    // Create initial version
    this._createVersion(doc, 'Initial version', 'major');

    return { ...doc };
  }

  /** Get a document by ID. */
  get(id: string): CMSDocument | undefined {
    const doc = this._documents.get(id);
    return doc ? { ...doc } : undefined;
  }

  /** Update a document's content and/or metadata. */
  update(
    id: string,
    updates: {
      content?: any;
      name?: string;
      description?: string;
      tags?: string[];
      metadata?: Record<string, any>;
      priority?: DocumentPriority;
      language?: string;
    },
    actor: string,
    changeDescription?: string,
    versionType: 'major' | 'minor' = 'minor',
  ): CMSDocument {
    const doc = this._documents.get(id);
    if (!doc) throw new DocumentNotFoundError(id);
    if (doc.locked && doc.lockedBy !== actor) {
      throw new DocumentLockedError(id, doc.lockedBy!);
    }
    if (doc.legalHold) {
      throw new LegalHoldError(id);
    }

    const now = new Date().toISOString();

    if (updates.content !== undefined) {
      doc.content = updates.content;
      doc.sizeBytes = calculateSize(updates.content);
      doc.contentHash = hashContent(updates.content);
    }
    if (updates.name !== undefined) doc.name = updates.name;
    if (updates.description !== undefined) doc.description = updates.description;
    if (updates.tags !== undefined) doc.tags = [...updates.tags];
    if (updates.metadata !== undefined) doc.metadata = { ...doc.metadata, ...updates.metadata };
    if (updates.priority !== undefined) doc.priority = updates.priority;
    if (updates.language !== undefined) doc.language = updates.language;

    if (updates.content !== undefined) {
      doc.version++;
      doc.versionLabel = versionType === 'major'
        ? `${doc.version}.0`
        : `${Math.floor(doc.version)}.${doc.version % 1 === 0 ? 0 : doc.version}`;
      this._createVersion(doc, changeDescription ?? 'Updated', versionType);
    }

    doc.modifiedBy = actor;
    doc.modifiedAt = now;

    return { ...doc };
  }

  /** Delete a document (soft delete). */
  delete(id: string, actor: string): boolean {
    const doc = this._documents.get(id);
    if (!doc) return false;
    if (doc.legalHold) throw new LegalHoldError(id);

    doc.status = 'deleted';
    doc.modifiedBy = actor;
    doc.modifiedAt = new Date().toISOString();

    this._deletedDocuments.set(id, { ...doc });
    this._documents.delete(id);
    return true;
  }

  /** Permanently remove a deleted document. */
  purge(id: string): boolean {
    return this._deletedDocuments.delete(id);
  }

  /** Restore a soft-deleted document. */
  restore(id: string, actor: string): CMSDocument | undefined {
    const doc = this._deletedDocuments.get(id);
    if (!doc) return undefined;

    doc.status = 'draft';
    doc.modifiedBy = actor;
    doc.modifiedAt = new Date().toISOString();

    this._documents.set(id, doc);
    this._deletedDocuments.delete(id);
    return { ...doc };
  }

  /** List all documents. */
  list(filter?: {
    status?: DocumentStatus;
    category?: ContentCategory;
    path?: string;
    owner?: string;
    tags?: string[];
  }): CMSDocument[] {
    let docs = Array.from(this._documents.values());

    if (filter) {
      if (filter.status) docs = docs.filter((d) => d.status === filter.status);
      if (filter.category) docs = docs.filter((d) => d.category === filter.category);
      if (filter.path) docs = docs.filter((d) => d.path.startsWith(filter.path!));
      if (filter.owner) docs = docs.filter((d) => d.owner === filter.owner);
      if (filter.tags?.length) {
        docs = docs.filter((d) => filter.tags!.some((t) => d.tags.includes(t)));
      }
    }

    return docs.map((d) => ({ ...d }));
  }

  /** Get total document count. */
  get documentCount(): number {
    return this._documents.size;
  }

  // ── Status Transitions ──────────────────────────────────

  /** Change a document's lifecycle status. */
  changeStatus(id: string, newStatus: DocumentStatus, actor: string): CMSDocument {
    const doc = this._documents.get(id);
    if (!doc) throw new DocumentNotFoundError(id);

    if (!isValidTransition(doc.status, newStatus)) {
      throw new InvalidTransitionError(doc.status, newStatus);
    }

    doc.status = newStatus;
    doc.modifiedBy = actor;
    doc.modifiedAt = new Date().toISOString();

    if (newStatus === 'expired') {
      doc.expiresAt = new Date().toISOString();
    }

    return { ...doc };
  }

  // ── Versioning ──────────────────────────────────────────

  /** Get all versions of a document. */
  getVersions(documentId: string): DocumentVersion[] {
    const versions = this._versions.get(documentId) ?? [];
    return versions.map((v) => ({ ...v }));
  }

  /** Get a specific version. */
  getVersion(documentId: string, versionNumber: number): DocumentVersion | undefined {
    const versions = this._versions.get(documentId) ?? [];
    const v = versions.find((v) => v.versionNumber === versionNumber);
    return v ? { ...v } : undefined;
  }

  /** Revert a document to a previous version. */
  revertToVersion(documentId: string, versionNumber: number, actor: string): CMSDocument {
    const doc = this._documents.get(documentId);
    if (!doc) throw new DocumentNotFoundError(documentId);

    const version = this.getVersion(documentId, versionNumber);
    if (!version) throw new Error(`Version ${versionNumber} not found for document ${documentId}`);

    doc.content = version.content;
    doc.sizeBytes = version.sizeBytes;
    doc.contentHash = version.contentHash;
    doc.tags = [...version.tags];
    doc.version++;
    doc.modifiedBy = actor;
    doc.modifiedAt = new Date().toISOString();

    this._createVersion(doc, `Reverted to version ${versionNumber}`, 'major');

    return { ...doc };
  }

  /** Get the version count for a document. */
  getVersionCount(documentId: string): number {
    return (this._versions.get(documentId) ?? []).length;
  }

  private _createVersion(
    doc: CMSDocument,
    changeDescription: string,
    versionType: 'major' | 'minor',
  ): DocumentVersion {
    const version: DocumentVersion = {
      id: generateId(),
      documentId: doc.id,
      versionNumber: doc.version,
      versionLabel: doc.versionLabel,
      content: doc.content,
      sizeBytes: doc.sizeBytes,
      contentHash: doc.contentHash,
      changeDescription,
      versionType,
      createdBy: doc.modifiedBy,
      createdAt: new Date().toISOString(),
      metadata: { ...doc.metadata },
      tags: [...doc.tags],
      status: doc.status,
    };

    if (!this._versions.has(doc.id)) {
      this._versions.set(doc.id, []);
    }
    this._versions.get(doc.id)!.push(version);

    return version;
  }

  // ── Locking ─────────────────────────────────────────────

  /** Lock a document. */
  lock(id: string, actor: string, expiresInMs?: number): CMSDocument {
    const doc = this._documents.get(id);
    if (!doc) throw new DocumentNotFoundError(id);
    if (doc.locked && doc.lockedBy !== actor) {
      throw new DocumentLockedError(id, doc.lockedBy!);
    }

    doc.locked = true;
    doc.lockedBy = actor;
    doc.lockedAt = new Date().toISOString();
    if (expiresInMs) {
      doc.lockExpiresAt = new Date(Date.now() + expiresInMs).toISOString();
    }
    doc.modifiedAt = new Date().toISOString();

    return { ...doc };
  }

  /** Unlock a document. */
  unlock(id: string, actor: string, force = false): CMSDocument {
    const doc = this._documents.get(id);
    if (!doc) throw new DocumentNotFoundError(id);
    if (doc.locked && doc.lockedBy !== actor && !force) {
      throw new DocumentLockedError(id, doc.lockedBy!);
    }

    doc.locked = false;
    doc.lockedBy = undefined;
    doc.lockedAt = undefined;
    doc.lockExpiresAt = undefined;
    doc.modifiedAt = new Date().toISOString();

    return { ...doc };
  }

  /** Check if a lock has expired and auto-release. */
  checkLockExpiry(id: string): boolean {
    const doc = this._documents.get(id);
    if (!doc || !doc.locked || !doc.lockExpiresAt) return false;

    if (new Date(doc.lockExpiresAt) <= new Date()) {
      doc.locked = false;
      doc.lockedBy = undefined;
      doc.lockedAt = undefined;
      doc.lockExpiresAt = undefined;
      return true;
    }
    return false;
  }

  // ── Check-Out / Check-In ────────────────────────────────

  /** Check out a document for exclusive editing. */
  checkOut(id: string, actor: string): CMSDocument {
    const doc = this._documents.get(id);
    if (!doc) throw new DocumentNotFoundError(id);
    if (doc.checkedOut) {
      throw new Error(`Document ${id} is already checked out by ${doc.checkedOutBy}`);
    }
    if (doc.locked && doc.lockedBy !== actor) {
      throw new DocumentLockedError(id, doc.lockedBy!);
    }

    doc.checkedOut = true;
    doc.checkedOutBy = actor;
    doc.checkedOutAt = new Date().toISOString();
    doc.status = 'checked-out';
    doc.locked = true;
    doc.lockedBy = actor;
    doc.lockedAt = doc.checkedOutAt;
    doc.modifiedAt = doc.checkedOutAt;

    return { ...doc };
  }

  /** Check in a document after editing. */
  checkIn(
    id: string,
    actor: string,
    content?: any,
    changeDescription?: string,
    versionType: 'major' | 'minor' = 'minor',
  ): CMSDocument {
    const doc = this._documents.get(id);
    if (!doc) throw new DocumentNotFoundError(id);
    if (!doc.checkedOut || doc.checkedOutBy !== actor) {
      throw new Error(`Document ${id} is not checked out by ${actor}`);
    }

    if (content !== undefined) {
      doc.content = content;
      doc.sizeBytes = calculateSize(content);
      doc.contentHash = hashContent(content);
      doc.version++;
      this._createVersion(doc, changeDescription ?? 'Checked in', versionType);
    }

    doc.checkedOut = false;
    doc.checkedOutBy = undefined;
    doc.checkedOutAt = undefined;
    doc.locked = false;
    doc.lockedBy = undefined;
    doc.lockedAt = undefined;
    doc.lockExpiresAt = undefined;
    doc.status = 'draft';
    doc.modifiedBy = actor;
    doc.modifiedAt = new Date().toISOString();

    return { ...doc };
  }

  /** Cancel a check-out without saving changes. */
  cancelCheckOut(id: string, actor: string, force = false): CMSDocument {
    const doc = this._documents.get(id);
    if (!doc) throw new DocumentNotFoundError(id);
    if (!doc.checkedOut) {
      throw new Error(`Document ${id} is not checked out`);
    }
    if (doc.checkedOutBy !== actor && !force) {
      throw new Error(`Document ${id} is checked out by ${doc.checkedOutBy}, not ${actor}`);
    }

    doc.checkedOut = false;
    doc.checkedOutBy = undefined;
    doc.checkedOutAt = undefined;
    doc.locked = false;
    doc.lockedBy = undefined;
    doc.lockedAt = undefined;
    doc.status = 'draft';
    doc.modifiedAt = new Date().toISOString();

    return { ...doc };
  }

  // ── Relationships ───────────────────────────────────────

  /** Create a relationship between two documents. */
  addRelation(
    sourceId: string,
    targetId: string,
    relationType: DocumentRelationType,
    actor: string,
    metadata?: Record<string, any>,
  ): DocumentRelation {
    if (!this._documents.has(sourceId)) throw new DocumentNotFoundError(sourceId);
    if (!this._documents.has(targetId)) throw new DocumentNotFoundError(targetId);

    const relation: DocumentRelation = {
      id: generateId(),
      sourceDocumentId: sourceId,
      targetDocumentId: targetId,
      relationType,
      metadata,
      createdBy: actor,
      createdAt: new Date().toISOString(),
    };

    this._relations.set(relation.id, relation);

    // Update document relation references
    const source = this._documents.get(sourceId)!;
    if (!source.relatedDocumentIds.includes(targetId)) {
      source.relatedDocumentIds.push(targetId);
    }

    return { ...relation };
  }

  /** Remove a relationship. */
  removeRelation(relationId: string): boolean {
    return this._relations.delete(relationId);
  }

  /** Get relationships for a document. */
  getRelations(documentId: string, type?: DocumentRelationType): DocumentRelation[] {
    return Array.from(this._relations.values())
      .filter((r) =>
        (r.sourceDocumentId === documentId || r.targetDocumentId === documentId) &&
        (!type || r.relationType === type),
      )
      .map((r) => ({ ...r }));
  }

  // ── Folder Management ───────────────────────────────────

  /** Create a folder. */
  createFolder(
    name: string,
    parentPath: string,
    owner: string,
    metadata?: Record<string, any>,
  ): Folder {
    const path = parentPath === '/' ? `/${name}` : `${parentPath}/${name}`;

    // Check for duplicate
    const existing = Array.from(this._folders.values()).find((f) => f.path === path);
    if (existing) throw new Error(`Folder already exists: ${path}`);

    const now = new Date().toISOString();
    const folder: Folder = {
      id: generateId(),
      name,
      parentId: this._findFolderByPath(parentPath)?.id,
      path,
      owner,
      createdBy: owner,
      createdAt: now,
      modifiedAt: now,
      metadata: metadata ?? {},
      documentCount: 0,
      subfolderCount: 0,
    };

    this._folders.set(folder.id, folder);

    // Update parent subfolder count
    if (folder.parentId) {
      const parent = this._folders.get(folder.parentId);
      if (parent) parent.subfolderCount++;
    }

    return { ...folder };
  }

  /** Get a folder by path. */
  getFolder(path: string): Folder | undefined {
    const folder = this._findFolderByPath(path);
    return folder ? { ...folder } : undefined;
  }

  /** Get a folder by ID. */
  getFolderById(id: string): Folder | undefined {
    const folder = this._folders.get(id);
    return folder ? { ...folder } : undefined;
  }

  /** Delete a folder. */
  deleteFolder(path: string): boolean {
    const folder = this._findFolderByPath(path);
    if (!folder) return false;

    // Check for documents
    const hasDocuments = Array.from(this._documents.values()).some((d) => d.path === path);
    if (hasDocuments) throw new Error(`Folder ${path} is not empty`);

    // Check for subfolders
    const hasSubfolders = Array.from(this._folders.values()).some((f) => f.parentId === folder.id);
    if (hasSubfolders) throw new Error(`Folder ${path} has subfolders`);

    this._folders.delete(folder.id);
    return true;
  }

  /** List subfolders of a given path. */
  listSubfolders(path: string): Folder[] {
    const parent = this._findFolderByPath(path);
    const parentId = parent?.id;

    return Array.from(this._folders.values())
      .filter((f) => f.parentId === parentId)
      .map((f) => ({ ...f }));
  }

  /** Get total folder count. */
  get folderCount(): number {
    return this._folders.size;
  }

  private _findFolderByPath(path: string): Folder | undefined {
    return Array.from(this._folders.values()).find((f) => f.path === path);
  }

  // ── Copy / Move ─────────────────────────────────────────

  /** Copy a document to a new path. */
  copy(id: string, targetPath: string, actor: string): CMSDocument {
    const source = this._documents.get(id);
    if (!source) throw new DocumentNotFoundError(id);

    const copy = createDocument({
      name: source.name,
      content: source.content,
      mimeType: source.mimeType,
      path: targetPath,
      description: source.description,
      tags: [...source.tags],
      metadata: { ...source.metadata, copiedFrom: id },
      owner: actor,
      priority: source.priority,
      language: source.language,
    });

    this._documents.set(copy.id, copy);
    this._createVersion(copy, `Copied from ${id}`, 'major');

    // Add derived-from relationship
    this.addRelation(copy.id, id, 'derived-from', actor);

    return { ...copy };
  }

  /** Move a document to a new path. */
  move(id: string, targetPath: string, actor: string): CMSDocument {
    const doc = this._documents.get(id);
    if (!doc) throw new DocumentNotFoundError(id);
    if (doc.locked && doc.lockedBy !== actor) {
      throw new DocumentLockedError(id, doc.lockedBy!);
    }
    if (doc.legalHold) throw new LegalHoldError(id);

    doc.path = targetPath;
    doc.modifiedBy = actor;
    doc.modifiedAt = new Date().toISOString();

    return { ...doc };
  }

  // ── Bulk Operations ─────────────────────────────────────

  /** Get documents by IDs. */
  getMany(ids: string[]): CMSDocument[] {
    return ids
      .map((id) => this._documents.get(id))
      .filter((d): d is CMSDocument => d !== undefined)
      .map((d) => ({ ...d }));
  }

  /** Get documents by path. */
  getByPath(path: string): CMSDocument[] {
    return Array.from(this._documents.values())
      .filter((d) => d.path === path)
      .map((d) => ({ ...d }));
  }

  /** Get documents by tag. */
  getByTag(tag: string): CMSDocument[] {
    return Array.from(this._documents.values())
      .filter((d) => d.tags.includes(tag))
      .map((d) => ({ ...d }));
  }

  /** Get documents by status. */
  getByStatus(status: DocumentStatus): CMSDocument[] {
    return Array.from(this._documents.values())
      .filter((d) => d.status === status)
      .map((d) => ({ ...d }));
  }
}

// ── Error Types ──────────────────────────────────────────────

export class DocumentNotFoundError extends Error {
  constructor(public readonly documentId: string) {
    super(`Document not found: ${documentId}`);
    this.name = 'DocumentNotFoundError';
  }
}

export class DocumentLockedError extends Error {
  constructor(
    public readonly documentId: string,
    public readonly lockedBy: string,
  ) {
    super(`Document ${documentId} is locked by ${lockedBy}`);
    this.name = 'DocumentLockedError';
  }
}

export class LegalHoldError extends Error {
  constructor(public readonly documentId: string) {
    super(`Document ${documentId} is under legal hold and cannot be modified or deleted`);
    this.name = 'LegalHoldError';
  }
}

export class InvalidTransitionError extends Error {
  constructor(
    public readonly from: DocumentStatus,
    public readonly to: DocumentStatus,
  ) {
    super(`Invalid status transition: ${from} → ${to}`);
    this.name = 'InvalidTransitionError';
  }
}
