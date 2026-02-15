// ============================================================
// SOA One ESB — Cross-Reference (XRef) Tables
// ============================================================
//
// Oracle SOA Suite Cross-Reference equivalent. Maps
// identifiers across systems (e.g., Customer ID in CRM →
// Account ID in ERP). Supports bulk lookup, reverse lookup,
// and cleanup of stale mappings.
// ============================================================

import { generateId } from './channel';

// ── Types ────────────────────────────────────────────────────

export interface XRefTable {
  id: string;
  name: string;
  description?: string;
  columns: XRefColumn[];
  createdAt: string;
  updatedAt: string;
}

export interface XRefColumn {
  name: string;
  systemId: string;
  isPrimary: boolean;
}

export interface XRefRow {
  id: string;
  tableId: string;
  values: Record<string, string>;     // columnName → value
  createdAt: string;
  updatedAt: string;
}

// ── CrossReferenceManager ────────────────────────────────────

export class CrossReferenceManager {
  private _tables = new Map<string, XRefTable>();
  private _rows: XRefRow[] = [];

  // ── Tables ──

  createTable(table: Omit<XRefTable, 'id' | 'createdAt' | 'updatedAt'>): XRefTable {
    const now = new Date().toISOString();
    const t: XRefTable = { ...table, id: generateId(), createdAt: now, updatedAt: now };
    this._tables.set(t.id, t);
    return t;
  }

  getTable(id: string): XRefTable | undefined {
    return this._tables.get(id);
  }

  getTableByName(name: string): XRefTable | undefined {
    for (const t of this._tables.values()) {
      if (t.name === name) return t;
    }
    return undefined;
  }

  updateTable(id: string, updates: Partial<XRefTable>): XRefTable {
    const t = this._tables.get(id);
    if (!t) throw new Error(`XRef table not found: ${id}`);
    Object.assign(t, updates, { updatedAt: new Date().toISOString() });
    return t;
  }

  removeTable(id: string): boolean {
    this._rows = this._rows.filter(r => r.tableId !== id);
    return this._tables.delete(id);
  }

  get allTables(): XRefTable[] {
    return [...this._tables.values()];
  }

  // ── Rows ──

  addRow(tableId: string, values: Record<string, string>): XRefRow {
    if (!this._tables.has(tableId)) throw new Error(`XRef table not found: ${tableId}`);
    const now = new Date().toISOString();
    const row: XRefRow = { id: generateId(), tableId, values, createdAt: now, updatedAt: now };
    this._rows.push(row);
    return row;
  }

  getRow(id: string): XRefRow | undefined {
    return this._rows.find(r => r.id === id);
  }

  updateRow(id: string, values: Record<string, string>): XRefRow {
    const row = this._rows.find(r => r.id === id);
    if (!row) throw new Error(`XRef row not found: ${id}`);
    row.values = { ...row.values, ...values };
    row.updatedAt = new Date().toISOString();
    return row;
  }

  removeRow(id: string): boolean {
    const idx = this._rows.findIndex(r => r.id === id);
    if (idx < 0) return false;
    this._rows.splice(idx, 1);
    return true;
  }

  getRowsByTable(tableId: string): XRefRow[] {
    return this._rows.filter(r => r.tableId === tableId);
  }

  // ── Lookups ──

  lookup(tableId: string, sourceColumn: string, sourceValue: string, targetColumn: string): string | undefined {
    const row = this._rows.find(
      r => r.tableId === tableId && r.values[sourceColumn] === sourceValue
    );
    return row?.values[targetColumn];
  }

  reverseLookup(tableId: string, targetColumn: string, targetValue: string, sourceColumn: string): string | undefined {
    const row = this._rows.find(
      r => r.tableId === tableId && r.values[targetColumn] === targetValue
    );
    return row?.values[sourceColumn];
  }

  bulkLookup(tableId: string, sourceColumn: string, sourceValues: string[], targetColumn: string): Record<string, string | undefined> {
    const result: Record<string, string | undefined> = {};
    for (const val of sourceValues) {
      result[val] = this.lookup(tableId, sourceColumn, val, targetColumn);
    }
    return result;
  }

  // ── Maintenance ──

  purgeTable(tableId: string): number {
    const before = this._rows.length;
    this._rows = this._rows.filter(r => r.tableId !== tableId);
    return before - this._rows.length;
  }

  getStats(): { tables: number; rows: number } {
    return { tables: this._tables.size, rows: this._rows.length };
  }
}
