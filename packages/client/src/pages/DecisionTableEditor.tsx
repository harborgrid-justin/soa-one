import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, Save, ToggleLeft, ToggleRight } from 'lucide-react';
import { getDecisionTable, updateDecisionTable } from '../api/client';
import { useStore } from '../store';
import type { DecisionTableData, DecisionTableColumn, DecisionTableRow, ComparisonOperator, ActionType } from '../types';

export function DecisionTableEditor() {
  const { id } = useParams<{ id: string }>();
  const [table, setTable] = useState<DecisionTableData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { addNotification } = useStore();

  const load = () => {
    if (!id) return;
    getDecisionTable(id)
      .then((t) => {
        setTable({
          ...t,
          columns: typeof t.columns === 'string' ? JSON.parse(t.columns) : t.columns,
          rows: typeof t.rows === 'string' ? JSON.parse(t.rows) : t.rows,
        });
      })
      .catch(() => addNotification({ type: 'error', message: 'Failed to load table' }))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [id]);

  const handleSave = async () => {
    if (!table || !id) return;
    setSaving(true);
    try {
      await updateDecisionTable(id, {
        name: table.name,
        columns: table.columns,
        rows: table.rows,
      });
      addNotification({ type: 'success', message: 'Decision table saved' });
    } catch {
      addNotification({ type: 'error', message: 'Failed to save table' });
    } finally {
      setSaving(false);
    }
  };

  const addColumn = (type: 'condition' | 'action') => {
    if (!table) return;
    const col: DecisionTableColumn = {
      id: `col-${Date.now()}`,
      name: type === 'condition' ? 'New Condition' : 'New Action',
      field: '',
      type,
      operator: type === 'condition' ? 'equals' : undefined,
      actionType: type === 'action' ? 'SET' : undefined,
    };
    setTable({ ...table, columns: [...table.columns, col] });
  };

  const updateColumn = (colId: string, field: string, value: any) => {
    if (!table) return;
    setTable({
      ...table,
      columns: table.columns.map((c) => c.id === colId ? { ...c, [field]: value } : c),
    });
  };

  const removeColumn = (colId: string) => {
    if (!table) return;
    setTable({
      ...table,
      columns: table.columns.filter((c) => c.id !== colId),
      rows: table.rows.map((r) => {
        const { [colId]: _, ...rest } = r.values;
        return { ...r, values: rest };
      }),
    });
  };

  const addRow = () => {
    if (!table) return;
    const row: DecisionTableRow = {
      id: `row-${Date.now()}`,
      values: Object.fromEntries(table.columns.map((c) => [c.id, ''])),
      enabled: true,
    };
    setTable({ ...table, rows: [...table.rows, row] });
  };

  const updateCell = (rowId: string, colId: string, value: any) => {
    if (!table) return;
    setTable({
      ...table,
      rows: table.rows.map((r) =>
        r.id === rowId ? { ...r, values: { ...r.values, [colId]: value } } : r
      ),
    });
  };

  const toggleRow = (rowId: string) => {
    if (!table) return;
    setTable({
      ...table,
      rows: table.rows.map((r) => r.id === rowId ? { ...r, enabled: !r.enabled } : r),
    });
  };

  const removeRow = (rowId: string) => {
    if (!table) return;
    setTable({ ...table, rows: table.rows.filter((r) => r.id !== rowId) });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!table) return <div className="text-center py-16 text-slate-500">Table not found</div>;

  const condCols = table.columns.filter((c) => c.type === 'condition');
  const actCols = table.columns.filter((c) => c.type === 'action');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm">
          <Link to="/decision-tables" className="text-slate-500 hover:text-slate-700 flex items-center gap-1">
            <ArrowLeft className="w-4 h-4" /> Decision Tables
          </Link>
          <span className="text-slate-300">/</span>
          <span className="text-slate-900 font-medium">{table.name}</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => addColumn('condition')} className="btn-secondary btn-sm">
            <Plus className="w-3.5 h-3.5" /> Condition Column
          </button>
          <button onClick={() => addColumn('action')} className="btn-secondary btn-sm">
            <Plus className="w-3.5 h-3.5" /> Action Column
          </button>
          <button onClick={handleSave} className="btn-primary btn-sm" disabled={saving}>
            <Save className="w-3.5 h-3.5" /> {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      {/* Table name edit */}
      <div className="card p-5">
        <input
          className="text-lg font-semibold text-slate-900 bg-transparent border-none outline-none w-full"
          value={table.name}
          onChange={(e) => setTable({ ...table, name: e.target.value })}
        />
        <p className="text-sm text-slate-500 mt-1">
          {condCols.length} condition{condCols.length !== 1 ? 's' : ''}, {actCols.length} action{actCols.length !== 1 ? 's' : ''}, {table.rows.length} row{table.rows.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Decision Table Grid */}
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            {/* Column type headers */}
            <tr className="border-b border-slate-200">
              <th className="w-10" />
              {condCols.length > 0 && (
                <th colSpan={condCols.length} className="px-3 py-2 text-center text-xs font-semibold uppercase tracking-wider text-blue-600 bg-blue-50/50 border-r border-slate-200">
                  Conditions (IF)
                </th>
              )}
              {actCols.length > 0 && (
                <th colSpan={actCols.length} className="px-3 py-2 text-center text-xs font-semibold uppercase tracking-wider text-emerald-600 bg-emerald-50/50">
                  Actions (THEN)
                </th>
              )}
              <th className="w-16" />
            </tr>
            {/* Column names */}
            <tr className="border-b border-slate-200">
              <th className="w-10 px-2" />
              {table.columns.map((col) => (
                <th key={col.id} className={`px-3 py-2 text-left min-w-[160px] ${col.type === 'condition' ? 'bg-blue-50/30' : 'bg-emerald-50/30'}`}>
                  <input
                    className="font-medium text-slate-900 bg-transparent border-none outline-none w-full text-sm"
                    value={col.name}
                    onChange={(e) => updateColumn(col.id, 'name', e.target.value)}
                  />
                  <div className="flex items-center gap-1 mt-1">
                    <input
                      className="text-xs text-slate-500 bg-transparent border-none outline-none flex-1"
                      placeholder="field.path"
                      value={col.field}
                      onChange={(e) => updateColumn(col.id, 'field', e.target.value)}
                    />
                    <button onClick={() => removeColumn(col.id)} className="text-slate-300 hover:text-red-500">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </th>
              ))}
              <th className="w-16" />
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row, ri) => (
              <tr key={row.id} className={`border-b border-slate-100 ${!row.enabled ? 'opacity-40' : ''} hover:bg-slate-50/50`}>
                <td className="px-2 text-center">
                  <span className="text-xs text-slate-400">{ri + 1}</span>
                </td>
                {table.columns.map((col) => (
                  <td key={col.id} className={`px-3 py-2 ${col.type === 'condition' ? 'bg-blue-50/10' : 'bg-emerald-50/10'}`}>
                    <input
                      className="w-full bg-transparent border-none outline-none text-sm text-slate-700 placeholder-slate-300"
                      placeholder={col.type === 'condition' ? '* (any)' : 'value'}
                      value={row.values[col.id] === null || row.values[col.id] === undefined ? '' : String(row.values[col.id])}
                      onChange={(e) => {
                        let val: any = e.target.value;
                        if (val === '') val = '';
                        else if (val === 'true') val = true;
                        else if (val === 'false') val = false;
                        else if (!isNaN(Number(val)) && val.trim() !== '') val = Number(val);
                        updateCell(row.id, col.id, val);
                      }}
                    />
                  </td>
                ))}
                <td className="px-2">
                  <div className="flex items-center gap-1">
                    <button onClick={() => toggleRow(row.id)} className="p-1 rounded hover:bg-slate-100">
                      {row.enabled ? <ToggleRight className="w-4 h-4 text-emerald-600" /> : <ToggleLeft className="w-4 h-4 text-slate-300" />}
                    </button>
                    <button onClick={() => removeRow(row.id)} className="p-1 rounded hover:bg-red-50 text-slate-400 hover:text-red-600">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="px-4 py-3 border-t border-slate-100">
          <button onClick={addRow} className="btn-ghost btn-sm text-slate-500">
            <Plus className="w-3.5 h-3.5" /> Add Row
          </button>
        </div>
      </div>
    </div>
  );
}
