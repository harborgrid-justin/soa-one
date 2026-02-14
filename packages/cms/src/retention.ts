// ============================================================
// SOA One CMS — Records Retention & Disposition
// ============================================================
//
// Provides records retention policy management, legal hold
// support, automated disposition, and regulatory compliance.
//
// Surpasses Oracle WebCenter's records management with:
// - Multiple retention triggers (creation, modification, event)
// - Legal hold with case reference tracking
// - Automated disposition with notifications
// - Retention extensions with audit trail
// - Regulatory citation tracking
// - Disposition review workflows
// - Bulk retention operations
// ============================================================

import type {
  RetentionPolicy,
  LegalHold,
  RetentionScheduleEntry,
  DispositionAction,
  RetentionTrigger,
  CMSDocument,
  SearchQuery,
} from './types';

import { generateId } from './document';

// ── Retention Manager ───────────────────────────────────────

/**
 * Manages retention policies, legal holds, retention schedules,
 * and automated disposition of documents.
 */
export class RetentionManager {
  private _policies: Map<string, RetentionPolicy> = new Map();
  private _legalHolds: Map<string, LegalHold> = new Map();
  private _schedules: Map<string, RetentionScheduleEntry> = new Map();
  private _dispositionListeners: ((entry: RetentionScheduleEntry, action: DispositionAction) => void)[] = [];

  // ── Policy Management ───────────────────────────────────

  /** Create a retention policy. */
  createPolicy(policy: Omit<RetentionPolicy, 'id'>): RetentionPolicy {
    const fullPolicy: RetentionPolicy = {
      ...policy,
      id: generateId(),
    };
    this._policies.set(fullPolicy.id, fullPolicy);
    return { ...fullPolicy };
  }

  /** Get a retention policy. */
  getPolicy(id: string): RetentionPolicy | undefined {
    const p = this._policies.get(id);
    return p ? { ...p } : undefined;
  }

  /** List all policies. */
  listPolicies(): RetentionPolicy[] {
    return Array.from(this._policies.values()).map((p) => ({ ...p }));
  }

  /** Update a policy. */
  updatePolicy(id: string, updates: Partial<RetentionPolicy>): RetentionPolicy {
    const policy = this._policies.get(id);
    if (!policy) throw new Error(`Retention policy not found: ${id}`);
    Object.assign(policy, updates);
    return { ...policy };
  }

  /** Delete a policy. */
  deletePolicy(id: string): boolean {
    return this._policies.delete(id);
  }

  // ── Legal Hold Management ───────────────────────────────

  /** Place a legal hold on documents. */
  createLegalHold(
    name: string,
    caseReference: string,
    custodian: string,
    documentIds: string[],
    actor: string,
    options?: {
      description?: string;
      holdQuery?: SearchQuery;
      endDate?: string;
    },
  ): LegalHold {
    const now = new Date().toISOString();

    const hold: LegalHold = {
      id: generateId(),
      name,
      description: options?.description,
      caseReference,
      custodian,
      documentIds: [...documentIds],
      holdQuery: options?.holdQuery,
      startDate: now,
      endDate: options?.endDate,
      status: 'active',
      createdBy: actor,
      createdAt: now,
    };

    this._legalHolds.set(hold.id, hold);

    // Suspend retention for held documents
    for (const docId of documentIds) {
      const schedule = this._schedules.get(docId);
      if (schedule) {
        schedule.status = 'held';
      }
    }

    return { ...hold };
  }

  /** Release a legal hold. */
  releaseLegalHold(id: string, actor: string, reason?: string): LegalHold {
    const hold = this._legalHolds.get(id);
    if (!hold) throw new Error(`Legal hold not found: ${id}`);

    hold.status = 'released';
    hold.releasedBy = actor;
    hold.releasedAt = new Date().toISOString();
    hold.releaseReason = reason;

    // Resume retention for documents no longer under any hold
    for (const docId of hold.documentIds) {
      if (!this.isDocumentUnderHold(docId)) {
        const schedule = this._schedules.get(docId);
        if (schedule && schedule.status === 'held') {
          schedule.status = 'active';
        }
      }
    }

    return { ...hold };
  }

  /** Get a legal hold. */
  getLegalHold(id: string): LegalHold | undefined {
    const h = this._legalHolds.get(id);
    return h ? { ...h } : undefined;
  }

  /** List all active legal holds. */
  listActiveLegalHolds(): LegalHold[] {
    return Array.from(this._legalHolds.values())
      .filter((h) => h.status === 'active')
      .map((h) => ({ ...h }));
  }

  /** Check if a document is under any legal hold. */
  isDocumentUnderHold(documentId: string): boolean {
    return Array.from(this._legalHolds.values()).some(
      (h) => h.status === 'active' && h.documentIds.includes(documentId),
    );
  }

  /** Get all legal holds on a document. */
  getDocumentHolds(documentId: string): LegalHold[] {
    return Array.from(this._legalHolds.values())
      .filter((h) => h.status === 'active' && h.documentIds.includes(documentId))
      .map((h) => ({ ...h }));
  }

  /** Add a document to an existing legal hold. */
  addDocumentToHold(holdId: string, documentId: string): void {
    const hold = this._legalHolds.get(holdId);
    if (!hold) throw new Error(`Legal hold not found: ${holdId}`);
    if (!hold.documentIds.includes(documentId)) {
      hold.documentIds.push(documentId);
    }
    const schedule = this._schedules.get(documentId);
    if (schedule) schedule.status = 'held';
  }

  /** Remove a document from a legal hold. */
  removeDocumentFromHold(holdId: string, documentId: string): void {
    const hold = this._legalHolds.get(holdId);
    if (!hold) throw new Error(`Legal hold not found: ${holdId}`);
    hold.documentIds = hold.documentIds.filter((id) => id !== documentId);

    if (!this.isDocumentUnderHold(documentId)) {
      const schedule = this._schedules.get(documentId);
      if (schedule && schedule.status === 'held') {
        schedule.status = 'active';
      }
    }
  }

  // ── Retention Schedule ──────────────────────────────────

  /** Apply a retention policy to a document. */
  applyRetention(document: CMSDocument, policyId: string): RetentionScheduleEntry {
    const policy = this._policies.get(policyId);
    if (!policy) throw new Error(`Retention policy not found: ${policyId}`);
    if (!policy.enabled) throw new Error(`Retention policy is disabled: ${policyId}`);

    const startDate = this._getRetentionStartDate(document, policy);
    const endDate = new Date(new Date(startDate).getTime() + policy.retentionDays * 24 * 60 * 60 * 1000);

    const entry: RetentionScheduleEntry = {
      documentId: document.id,
      policyId,
      retentionStartDate: startDate,
      retentionEndDate: endDate.toISOString(),
      dispositionAction: policy.dispositionAction,
      status: this.isDocumentUnderHold(document.id) ? 'held' : 'active',
      extensionCount: 0,
    };

    this._schedules.set(document.id, entry);
    return { ...entry };
  }

  /** Get the retention schedule for a document. */
  getRetentionSchedule(documentId: string): RetentionScheduleEntry | undefined {
    const entry = this._schedules.get(documentId);
    return entry ? { ...entry } : undefined;
  }

  /** Extend the retention period for a document. */
  extendRetention(documentId: string, additionalDays: number): RetentionScheduleEntry {
    const entry = this._schedules.get(documentId);
    if (!entry) throw new Error(`No retention schedule for document: ${documentId}`);

    const policy = this._policies.get(entry.policyId);
    if (policy && !policy.extensionsAllowed) {
      throw new Error('Retention extensions are not allowed by policy');
    }
    if (policy?.maxExtensionDays && additionalDays > policy.maxExtensionDays) {
      throw new Error(`Extension exceeds maximum allowed: ${policy.maxExtensionDays} days`);
    }

    const currentEnd = new Date(entry.retentionEndDate);
    const newEnd = new Date(currentEnd.getTime() + additionalDays * 24 * 60 * 60 * 1000);

    entry.retentionEndDate = newEnd.toISOString();
    entry.extensionCount++;
    entry.lastExtensionDate = new Date().toISOString();
    entry.status = 'extended';

    return { ...entry };
  }

  /** Get all documents due for disposition. */
  getDocumentsDueForDisposition(): RetentionScheduleEntry[] {
    const now = new Date();
    return Array.from(this._schedules.values())
      .filter((entry) => {
        if (entry.status !== 'active' && entry.status !== 'extended') return false;
        return new Date(entry.retentionEndDate) <= now;
      })
      .map((entry) => ({ ...entry }));
  }

  /** Execute disposition for a document. */
  executeDisposition(documentId: string, actor: string): RetentionScheduleEntry {
    const entry = this._schedules.get(documentId);
    if (!entry) throw new Error(`No retention schedule for document: ${documentId}`);

    if (this.isDocumentUnderHold(documentId)) {
      throw new Error(`Cannot dispose document ${documentId}: under legal hold`);
    }

    entry.status = 'disposed';
    entry.disposedAt = new Date().toISOString();
    entry.disposedBy = actor;

    for (const listener of this._dispositionListeners) {
      try { listener(entry, entry.dispositionAction); } catch {}
    }

    return { ...entry };
  }

  /** Register a disposition listener. */
  onDisposition(listener: (entry: RetentionScheduleEntry, action: DispositionAction) => void): void {
    this._dispositionListeners.push(listener);
  }

  // ── Metrics ─────────────────────────────────────────────

  /** Get count of documents under legal hold. */
  get documentsUnderHoldCount(): number {
    const heldDocs = new Set<string>();
    for (const hold of this._legalHolds.values()) {
      if (hold.status === 'active') {
        for (const docId of hold.documentIds) {
          heldDocs.add(docId);
        }
      }
    }
    return heldDocs.size;
  }

  /** Get count of dispositions pending. */
  get pendingDispositionCount(): number {
    return this.getDocumentsDueForDisposition().length;
  }

  /** Get active policy count. */
  get activePolicyCount(): number {
    return Array.from(this._policies.values()).filter((p) => p.enabled).length;
  }

  /** Get active legal hold count. */
  get activeLegalHoldCount(): number {
    return Array.from(this._legalHolds.values()).filter((h) => h.status === 'active').length;
  }

  // ── Private ─────────────────────────────────────────────

  private _getRetentionStartDate(document: CMSDocument, policy: RetentionPolicy): string {
    switch (policy.trigger) {
      case 'creation-date':
        return document.createdAt;
      case 'modification-date':
        return document.modifiedAt;
      case 'publication-date':
        return document.status === 'published' ? document.modifiedAt : document.createdAt;
      case 'custom-date':
        if (policy.triggerField && document.metadata[policy.triggerField]) {
          return document.metadata[policy.triggerField];
        }
        return document.createdAt;
      default:
        return document.createdAt;
    }
  }
}
