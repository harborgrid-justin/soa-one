// ============================================================
// SOA One ESB — Domain Value Maps (DVM)
// ============================================================
//
// Oracle SOA Suite Domain Value Map equivalent. Lookup tables
// for mapping codes/values across domains (e.g., country codes,
// status codes). Supports fallback defaults, qualifiers, and
// bidirectional mapping.
// ============================================================

import { generateId } from './channel';

// ── Types ────────────────────────────────────────────────────

export interface DomainValueMap {
  id: string;
  name: string;
  description?: string;
  domains: DVMDomain[];
  qualifiers: string[];
  entries: DVMEntry[];
  defaultValues: Record<string, string>;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DVMDomain {
  name: string;
  description?: string;
}

export interface DVMEntry {
  id: string;
  values: Record<string, string>;     // domainName → value
  qualifier?: string;
  enabled: boolean;
}

// ── DomainValueMapManager ────────────────────────────────────

export class DomainValueMapManager {
  private _maps = new Map<string, DomainValueMap>();

  // ── Maps ──

  createMap(map: Omit<DomainValueMap, 'id' | 'createdAt' | 'updatedAt'>): DomainValueMap {
    const now = new Date().toISOString();
    const m: DomainValueMap = { ...map, id: generateId(), createdAt: now, updatedAt: now };
    this._maps.set(m.id, m);
    return m;
  }

  getMap(id: string): DomainValueMap | undefined {
    return this._maps.get(id);
  }

  getMapByName(name: string): DomainValueMap | undefined {
    for (const m of this._maps.values()) {
      if (m.name === name) return m;
    }
    return undefined;
  }

  updateMap(id: string, updates: Partial<DomainValueMap>): DomainValueMap {
    const m = this._maps.get(id);
    if (!m) throw new Error(`DVM not found: ${id}`);
    Object.assign(m, updates, { updatedAt: new Date().toISOString() });
    return m;
  }

  removeMap(id: string): boolean {
    return this._maps.delete(id);
  }

  get allMaps(): DomainValueMap[] {
    return [...this._maps.values()];
  }

  // ── Entries ──

  addEntry(mapId: string, entry: Omit<DVMEntry, 'id'>): DVMEntry {
    const m = this._maps.get(mapId);
    if (!m) throw new Error(`DVM not found: ${mapId}`);
    const e: DVMEntry = { ...entry, id: generateId() };
    m.entries.push(e);
    m.updatedAt = new Date().toISOString();
    return e;
  }

  getEntry(mapId: string, entryId: string): DVMEntry | undefined {
    return this._maps.get(mapId)?.entries.find(e => e.id === entryId);
  }

  updateEntry(mapId: string, entryId: string, updates: Partial<DVMEntry>): DVMEntry {
    const m = this._maps.get(mapId);
    if (!m) throw new Error(`DVM not found: ${mapId}`);
    const e = m.entries.find(x => x.id === entryId);
    if (!e) throw new Error(`DVM entry not found: ${entryId}`);
    Object.assign(e, updates);
    m.updatedAt = new Date().toISOString();
    return e;
  }

  removeEntry(mapId: string, entryId: string): boolean {
    const m = this._maps.get(mapId);
    if (!m) return false;
    const idx = m.entries.findIndex(e => e.id === entryId);
    if (idx < 0) return false;
    m.entries.splice(idx, 1);
    m.updatedAt = new Date().toISOString();
    return true;
  }

  getEntries(mapId: string): DVMEntry[] {
    return this._maps.get(mapId)?.entries ?? [];
  }

  // ── Lookups ──

  lookup(mapId: string, sourceDomain: string, sourceValue: string, targetDomain: string, qualifier?: string): string | undefined {
    const m = this._maps.get(mapId);
    if (!m || !m.enabled) return m?.defaultValues[targetDomain];

    const entry = m.entries.find(
      e => e.enabled &&
        e.values[sourceDomain] === sourceValue &&
        (!qualifier || e.qualifier === qualifier)
    );
    return entry?.values[targetDomain] ?? m.defaultValues[targetDomain];
  }

  reverseLookup(mapId: string, targetDomain: string, targetValue: string, sourceDomain: string, qualifier?: string): string | undefined {
    return this.lookup(mapId, targetDomain, targetValue, sourceDomain, qualifier);
  }

  bulkLookup(mapId: string, sourceDomain: string, sourceValues: string[], targetDomain: string, qualifier?: string): Record<string, string | undefined> {
    const result: Record<string, string | undefined> = {};
    for (const val of sourceValues) {
      result[val] = this.lookup(mapId, sourceDomain, val, targetDomain, qualifier);
    }
    return result;
  }

  // ── Stats ──

  getStats(): { maps: number; totalEntries: number } {
    let totalEntries = 0;
    for (const m of this._maps.values()) totalEntries += m.entries.length;
    return { maps: this._maps.size, totalEntries };
  }
}
