// ============================================================
// SOA One DI — Data Catalog
// ============================================================
//
// Data catalog and metadata discovery for enterprise data assets.
//
// Features beyond Oracle Data Integrator:
// - Centralized catalog of all data assets
// - Automatic discovery from connectors
// - Business glossary with term management
// - Data sensitivity classification (PII, PHI, PCI)
// - Full-text search across catalog entries
// - Data stewardship assignment
// - Popularity tracking (access frequency)
// - Integration with lineage and quality
// - Tag-based organization
// - Column-level metadata with profiling stats
//
// Zero external dependencies.
// ============================================================

import type {
  CatalogEntry,
  CatalogEntryType,
  CatalogSearchQuery,
  GlossaryTerm,
  DataSensitivity,
  ColumnMetadata,
  SchemaMetadata,
} from './types';

import { generateId } from './connector';

// ── Data Catalog ────────────────────────────────────────────

/**
 * Central data catalog for discovering, organizing, and governing data assets.
 *
 * Usage:
 * ```ts
 * const catalog = new DataCatalog();
 *
 * // Register entries
 * catalog.registerEntry({
 *   name: 'customers',
 *   type: 'table',
 *   description: 'Customer master data',
 *   connectorId: 'postgres-main',
 *   owner: 'data-engineering',
 *   sensitivity: 'pii',
 *   tags: ['customer', 'master-data'],
 * });
 *
 * // Search
 * const results = catalog.search({ text: 'customer', sensitivity: 'pii' });
 *
 * // Business glossary
 * catalog.addGlossaryTerm({
 *   name: 'Customer',
 *   definition: 'An entity that purchases goods or services.',
 *   domain: 'Sales',
 *   status: 'approved',
 * });
 * ```
 */
export class DataCatalog {
  private readonly _entries = new Map<string, CatalogEntry>();
  private readonly _glossary = new Map<string, GlossaryTerm>();
  private _searchIndex = new Map<string, Set<string>>(); // token → entry IDs

  // ── Catalog Entries ───────────────────────────────────

  /** Register a catalog entry. */
  registerEntry(
    options: Omit<CatalogEntry, 'id' | 'createdAt'> & { id?: string },
  ): CatalogEntry {
    const id = options.id ?? generateId();
    const entry: CatalogEntry = {
      ...options,
      id,
      createdAt: new Date().toISOString(),
    };

    this._entries.set(id, entry);
    this._indexEntry(entry);
    return entry;
  }

  /** Update a catalog entry. */
  updateEntry(
    entryId: string,
    updates: Partial<Omit<CatalogEntry, 'id' | 'createdAt'>>,
  ): CatalogEntry {
    const entry = this._entries.get(entryId);
    if (!entry) throw new Error(`Catalog entry '${entryId}' not found.`);

    Object.assign(entry, updates, { updatedAt: new Date().toISOString() });
    this._indexEntry(entry);
    return entry;
  }

  /** Remove a catalog entry. */
  removeEntry(entryId: string): void {
    this._entries.delete(entryId);
    this._removeFromIndex(entryId);
  }

  /** Get a catalog entry. */
  getEntry(entryId: string): CatalogEntry | undefined {
    return this._entries.get(entryId);
  }

  /** List all catalog entries. */
  listEntries(): CatalogEntry[] {
    return Array.from(this._entries.values());
  }

  /** Search the catalog. */
  search(query: CatalogSearchQuery): CatalogEntry[] {
    let results: CatalogEntry[] = Array.from(this._entries.values());

    // Text search using index
    if (query.text) {
      const tokens = this._tokenize(query.text);
      const matchingIds = new Set<string>();

      for (const token of tokens) {
        for (const [indexToken, entryIds] of this._searchIndex) {
          if (indexToken.includes(token)) {
            for (const id of entryIds) {
              matchingIds.add(id);
            }
          }
        }
      }

      results = results.filter((e) => matchingIds.has(e.id));
    }

    // Filter by type
    if (query.type) {
      results = results.filter((e) => e.type === query.type);
    }

    // Filter by tags
    if (query.tags && query.tags.length > 0) {
      results = results.filter((e) =>
        query.tags!.some((tag) => e.tags?.includes(tag)),
      );
    }

    // Filter by owner
    if (query.owner) {
      results = results.filter((e) => e.owner === query.owner);
    }

    // Filter by classification
    if (query.classification) {
      results = results.filter(
        (e) => e.classification === query.classification,
      );
    }

    // Filter by sensitivity
    if (query.sensitivity) {
      results = results.filter(
        (e) => e.sensitivity === query.sensitivity,
      );
    }

    // Filter by connector
    if (query.connectorId) {
      results = results.filter(
        (e) => e.connectorId === query.connectorId,
      );
    }

    // Sort by popularity (descending)
    results.sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0));

    // Pagination
    const offset = query.offset ?? 0;
    const limit = query.limit ?? 100;
    return results.slice(offset, offset + limit);
  }

  /** Record an access event (increases popularity). */
  recordAccess(entryId: string): void {
    const entry = this._entries.get(entryId);
    if (entry) {
      entry.popularity = (entry.popularity ?? 0) + 1;
      entry.lastAccessedAt = new Date().toISOString();
    }
  }

  /**
   * Discover catalog entries from a connector's schema metadata.
   * Automatically creates catalog entries for discovered tables/views.
   */
  discoverFromSchema(
    connectorId: string,
    schema: SchemaMetadata,
    owner?: string,
  ): CatalogEntry[] {
    const entries: CatalogEntry[] = [];

    for (const table of schema.tables ?? []) {
      const existing = this._findByName(table.name, connectorId);
      if (existing) {
        // Update columns
        this.updateEntry(existing.id, { columns: table.columns });
        entries.push(existing);
      } else {
        const entry = this.registerEntry({
          name: table.name,
          type: table.type === 'view' ? 'view' : 'table',
          description: table.comment,
          connectorId,
          schema: table.schema ?? schema.schema,
          columns: table.columns,
          owner,
          tags: [],
          metadata: {
            rowCount: table.rowCount,
            sizeBytes: table.sizeBytes,
            primaryKey: table.primaryKey,
          },
        });
        entries.push(entry);
      }
    }

    return entries;
  }

  // ── Business Glossary ─────────────────────────────────

  /** Add a glossary term. */
  addGlossaryTerm(
    options: Omit<GlossaryTerm, 'id' | 'createdAt'> & { id?: string },
  ): GlossaryTerm {
    const id = options.id ?? generateId();
    const term: GlossaryTerm = {
      ...options,
      id,
      createdAt: new Date().toISOString(),
    };

    this._glossary.set(id, term);
    return term;
  }

  /** Update a glossary term. */
  updateGlossaryTerm(
    termId: string,
    updates: Partial<Omit<GlossaryTerm, 'id' | 'createdAt'>>,
  ): GlossaryTerm {
    const term = this._glossary.get(termId);
    if (!term) throw new Error(`Glossary term '${termId}' not found.`);

    Object.assign(term, updates, { updatedAt: new Date().toISOString() });
    return term;
  }

  /** Remove a glossary term. */
  removeGlossaryTerm(termId: string): void {
    this._glossary.delete(termId);
  }

  /** Get a glossary term. */
  getGlossaryTerm(termId: string): GlossaryTerm | undefined {
    return this._glossary.get(termId);
  }

  /** List all glossary terms. */
  listGlossaryTerms(): GlossaryTerm[] {
    return Array.from(this._glossary.values());
  }

  /** Search glossary terms. */
  searchGlossaryTerms(text: string): GlossaryTerm[] {
    const lowerText = text.toLowerCase();
    return Array.from(this._glossary.values()).filter(
      (term) =>
        term.name.toLowerCase().includes(lowerText) ||
        term.definition.toLowerCase().includes(lowerText) ||
        term.synonyms?.some((s) => s.toLowerCase().includes(lowerText)) ||
        term.abbreviation?.toLowerCase().includes(lowerText),
    );
  }

  /** Link a glossary term to a catalog entry. */
  linkTermToEntry(termId: string, entryId: string): void {
    const entry = this._entries.get(entryId);
    if (!entry) throw new Error(`Catalog entry '${entryId}' not found.`);

    if (!entry.glossaryTerms) entry.glossaryTerms = [];
    if (!entry.glossaryTerms.includes(termId)) {
      entry.glossaryTerms.push(termId);
    }
  }

  // ── Sensitivity Classification ────────────────────────

  /** Classify a catalog entry's data sensitivity. */
  classifySensitivity(
    entryId: string,
    sensitivity: DataSensitivity,
  ): void {
    const entry = this._entries.get(entryId);
    if (!entry) throw new Error(`Catalog entry '${entryId}' not found.`);
    entry.sensitivity = sensitivity;
  }

  /** Get all entries with a specific sensitivity level. */
  getEntriesBySensitivity(sensitivity: DataSensitivity): CatalogEntry[] {
    return Array.from(this._entries.values()).filter(
      (e) => e.sensitivity === sensitivity,
    );
  }

  /** Auto-detect sensitivity from column names (heuristic). */
  autoClassifySensitivity(entryId: string): DataSensitivity | null {
    const entry = this._entries.get(entryId);
    if (!entry || !entry.columns) return null;

    const columnNames = entry.columns.map((c) => c.name.toLowerCase());

    // PII patterns
    const piiPatterns = [
      'ssn', 'social_security', 'passport', 'driver_license',
      'national_id', 'birth_date', 'dob', 'date_of_birth',
    ];
    if (columnNames.some((c) => piiPatterns.some((p) => c.includes(p)))) {
      entry.sensitivity = 'pii';
      return 'pii';
    }

    // PHI patterns
    const phiPatterns = [
      'diagnosis', 'medication', 'patient', 'medical_record',
      'health', 'prescription', 'lab_result',
    ];
    if (columnNames.some((c) => phiPatterns.some((p) => c.includes(p)))) {
      entry.sensitivity = 'phi';
      return 'phi';
    }

    // PCI patterns
    const pciPatterns = [
      'credit_card', 'card_number', 'cvv', 'expiry',
      'card_holder', 'pan',
    ];
    if (columnNames.some((c) => pciPatterns.some((p) => c.includes(p)))) {
      entry.sensitivity = 'pci';
      return 'pci';
    }

    // Confidential patterns
    const confPatterns = [
      'salary', 'compensation', 'bonus', 'password', 'secret',
      'token', 'api_key',
    ];
    if (columnNames.some((c) => confPatterns.some((p) => c.includes(p)))) {
      entry.sensitivity = 'confidential';
      return 'confidential';
    }

    // Email/phone → internal
    const internalPatterns = ['email', 'phone', 'address', 'name'];
    if (columnNames.some((c) => internalPatterns.some((p) => c.includes(p)))) {
      entry.sensitivity = 'internal';
      return 'internal';
    }

    return null;
  }

  // ── Metrics ───────────────────────────────────────────

  /** Total catalog entries. */
  get entryCount(): number {
    return this._entries.size;
  }

  /** Total glossary terms. */
  get glossaryTermCount(): number {
    return this._glossary.size;
  }

  /** Clear the catalog. */
  clear(): void {
    this._entries.clear();
    this._glossary.clear();
    this._searchIndex.clear();
  }

  // ── Private ─────────────────────────────────────────────

  private _findByName(
    name: string,
    connectorId?: string,
  ): CatalogEntry | undefined {
    for (const entry of this._entries.values()) {
      if (entry.name === name && entry.connectorId === connectorId) {
        return entry;
      }
    }
    return undefined;
  }

  private _indexEntry(entry: CatalogEntry): void {
    // Remove old index
    this._removeFromIndex(entry.id);

    // Index name, description, tags
    const tokens = [
      ...this._tokenize(entry.name),
      ...this._tokenize(entry.description ?? ''),
      ...(entry.tags ?? []).flatMap((t) => this._tokenize(t)),
      ...(entry.columns ?? []).flatMap((c) => this._tokenize(c.name)),
    ];

    for (const token of tokens) {
      if (!this._searchIndex.has(token)) {
        this._searchIndex.set(token, new Set());
      }
      this._searchIndex.get(token)!.add(entry.id);
    }
  }

  private _removeFromIndex(entryId: string): void {
    for (const entryIds of this._searchIndex.values()) {
      entryIds.delete(entryId);
    }
  }

  private _tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length > 1);
  }
}
