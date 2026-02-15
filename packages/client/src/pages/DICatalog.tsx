import { useEffect, useState } from 'react';
import { BookOpen, Plus, Trash2, Pencil, Save, Search, ChevronDown, ChevronRight } from 'lucide-react';
import { getDICatalog, createDICatalogEntry, updateDICatalogEntry, deleteDICatalogEntry } from '../api/client';
import { Modal } from '../components/common/Modal';
import { useStore } from '../store';

const SENSITIVITY_COLORS: Record<string, string> = { public: 'bg-emerald-50 text-emerald-700', internal: 'bg-blue-50 text-blue-700', confidential: 'bg-amber-50 text-amber-700', restricted: 'bg-red-50 text-red-700' };

export function DICatalog() {
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [editing, setEditing] = useState<any>(null);
  const [search, setSearch] = useState('');
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState('table');
  const [newSchema, setNewSchema] = useState('');
  const [newSensitivity, setNewSensitivity] = useState('internal');
  const [editName, setEditName] = useState('');
  const [editSchema, setEditSchema] = useState('');
  const [editSensitivity, setEditSensitivity] = useState('');
  const [editTags, setEditTags] = useState('');
  const { addNotification } = useStore();

  const load = () => { setLoading(true); getDICatalog({ text: search || undefined }).then(setEntries).catch(() => {}).finally(() => setLoading(false)); };
  useEffect(() => { load(); }, [search]);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    try { await createDICatalogEntry({ name: newName.trim(), type: newType, schema: newSchema, sensitivity: newSensitivity }); addNotification({ type: 'success', message: 'Catalog entry created' }); setShowCreate(false); setNewName(''); setNewType('table'); setNewSchema(''); setNewSensitivity('internal'); load(); } catch { addNotification({ type: 'error', message: 'Failed to create entry' }); }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete catalog entry "${name}"?`)) return;
    try { await deleteDICatalogEntry(id); addNotification({ type: 'success', message: 'Entry deleted' }); load(); } catch { addNotification({ type: 'error', message: 'Failed to delete entry' }); }
  };

  const openEdit = (e: any) => { setEditing(e); setEditName(e.name); setEditSchema(e.schema || ''); setEditSensitivity(e.sensitivity || 'internal'); setEditTags((e.tags || []).join(', ')); };
  const handleSaveEdit = async () => {
    if (!editing || !editName.trim()) return;
    try { await updateDICatalogEntry(editing.id, { name: editName.trim(), schema: editSchema, sensitivity: editSensitivity, tags: editTags.split(',').map((t: string) => t.trim()).filter(Boolean) }); addNotification({ type: 'success', message: 'Entry updated' }); setEditing(null); load(); } catch { addNotification({ type: 'error', message: 'Failed to update entry' }); }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" /><input className="input pl-10" placeholder="Search catalog..." value={search} onChange={e => setSearch(e.target.value)} /></div>
        <button onClick={() => setShowCreate(true)} className="btn-primary btn-sm"><Plus className="w-3.5 h-3.5" /> New Entry</button>
      </div>

      {entries.length > 0 ? (
        <div className="space-y-2">
          {entries.map((e) => (
            <div key={e.id} className="card">
              <div className="px-6 py-4 flex items-center justify-between group">
                <div className="flex items-center gap-4">
                  <button onClick={() => setExpanded(expanded === e.id ? null : e.id)} className="text-slate-400 hover:text-slate-700">{expanded === e.id ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}</button>
                  <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center"><BookOpen className="w-5 h-5" /></div>
                  <div>
                    <div className="font-medium text-slate-900">{e.name}</div>
                    <div className="text-xs text-slate-500">{e.type}{e.schema ? ` · ${e.schema}` : ''}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {e.sensitivity && <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${SENSITIVITY_COLORS[e.sensitivity] || 'bg-slate-100 text-slate-500'}`}>{e.sensitivity}</span>}
                  {e.tags?.length > 0 && <div className="flex gap-1">{e.tags.slice(0, 3).map((t: string) => <span key={t} className="text-xs px-1.5 py-0.5 bg-slate-100 rounded">{t}</span>)}</div>}
                  <button onClick={() => openEdit(e)} className="btn-secondary btn-sm"><Pencil className="w-3.5 h-3.5" /></button>
                  <button onClick={() => handleDelete(e.id, e.name)} className="p-1.5 rounded opacity-0 group-hover:opacity-100 hover:bg-red-50 text-slate-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
              {expanded === e.id && (
                <div className="border-t border-slate-100 px-6 py-4 text-sm text-slate-600">
                  <div className="grid grid-cols-3 gap-4">
                    <div><span className="text-slate-400">Connector:</span> {e.connectorId || '—'}</div>
                    <div><span className="text-slate-400">Schema:</span> {e.schema || '—'}</div>
                    <div><span className="text-slate-400">Sensitivity:</span> {e.sensitivity || '—'}</div>
                  </div>
                  {e.tags?.length > 0 && <div className="mt-2 flex gap-1">{e.tags.map((t: string) => <span key={t} className="text-xs px-2 py-0.5 bg-slate-100 rounded">{t}</span>)}</div>}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="card p-16 text-center"><BookOpen className="w-10 h-10 text-slate-300 mx-auto mb-3" /><h3 className="font-semibold text-slate-900 mb-1">No catalog entries</h3><p className="text-sm text-slate-500 mb-4">Create catalog entries to document your data assets.</p><button onClick={() => setShowCreate(true)} className="btn-primary"><Plus className="w-4 h-4" /> Create Entry</button></div>
      )}

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Create Catalog Entry">
        <div className="space-y-4">
          <div><label className="label">Name</label><input className="input" placeholder="e.g., customer_orders" value={newName} onChange={e => setNewName(e.target.value)} autoFocus /></div>
          <div className="grid grid-cols-2 gap-4"><div><label className="label">Type</label><select className="input" value={newType} onChange={e => setNewType(e.target.value)}><option value="table">Table</option><option value="view">View</option><option value="api">API</option><option value="file">File</option></select></div><div><label className="label">Sensitivity</label><select className="input" value={newSensitivity} onChange={e => setNewSensitivity(e.target.value)}><option value="public">Public</option><option value="internal">Internal</option><option value="confidential">Confidential</option><option value="restricted">Restricted</option></select></div></div>
          <div><label className="label">Schema</label><input className="input" value={newSchema} onChange={e => setNewSchema(e.target.value)} /></div>
          <div className="flex justify-end gap-3 pt-2"><button onClick={() => setShowCreate(false)} className="btn-secondary">Cancel</button><button onClick={handleCreate} className="btn-primary" disabled={!newName.trim()}>Create</button></div>
        </div>
      </Modal>

      <Modal open={!!editing} onClose={() => setEditing(null)} title="Edit Catalog Entry">
        <div className="space-y-4">
          <div><label className="label">Name</label><input className="input" value={editName} onChange={e => setEditName(e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-4"><div><label className="label">Schema</label><input className="input" value={editSchema} onChange={e => setEditSchema(e.target.value)} /></div><div><label className="label">Sensitivity</label><select className="input" value={editSensitivity} onChange={e => setEditSensitivity(e.target.value)}><option value="public">Public</option><option value="internal">Internal</option><option value="confidential">Confidential</option><option value="restricted">Restricted</option></select></div></div>
          <div><label className="label">Tags (comma-separated)</label><input className="input" value={editTags} onChange={e => setEditTags(e.target.value)} /></div>
          <div className="flex justify-end gap-3 pt-2"><button onClick={() => setEditing(null)} className="btn-secondary">Cancel</button><button onClick={handleSaveEdit} className="btn-primary" disabled={!editName.trim()}><Save className="w-3.5 h-3.5" /> Save</button></div>
        </div>
      </Modal>
    </div>
  );
}
