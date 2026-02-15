import { useEffect, useState } from 'react';
import { Cable, Plus, Trash2, Pencil, Save, ChevronDown, ChevronRight } from 'lucide-react';
import { getDIConnectors, createDIConnector, updateDIConnector, deleteDIConnector } from '../api/client';
import { Modal } from '../components/common/Modal';
import { useStore } from '../store';

const CONNECTOR_TYPES = ['database', 'file', 'api', 'cloud', 'messaging', 'custom'];
const DIALECTS = ['postgresql', 'mysql', 'oracle', 'sqlserver', 'mongodb', 'redis', 'kafka', 'rest', 's3'];

export function DIConnectors() {
  const [connectors, setConnectors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [editing, setEditing] = useState<any>(null);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState('database');
  const [newDialect, setNewDialect] = useState('postgresql');
  const [newHost, setNewHost] = useState('');
  const [editName, setEditName] = useState('');
  const [editHost, setEditHost] = useState('');
  const { addNotification } = useStore();

  const load = () => { setLoading(true); getDIConnectors().then(setConnectors).catch(() => {}).finally(() => setLoading(false)); };
  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    try {
      await createDIConnector({ name: newName.trim(), type: newType, dialect: newDialect, host: newHost });
      addNotification({ type: 'success', message: 'Connector created' });
      setShowCreate(false); setNewName(''); setNewType('database'); setNewDialect('postgresql'); setNewHost('');
      load();
    } catch { addNotification({ type: 'error', message: 'Failed to create connector' }); }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete connector "${name}"?`)) return;
    try { await deleteDIConnector(id); addNotification({ type: 'success', message: 'Connector deleted' }); load(); } catch { addNotification({ type: 'error', message: 'Failed to delete connector' }); }
  };

  const openEdit = (c: any) => { setEditing(c); setEditName(c.name); setEditHost(c.host || ''); };
  const handleSaveEdit = async () => {
    if (!editing || !editName.trim()) return;
    try { await updateDIConnector(editing.id, { name: editName.trim(), host: editHost }); addNotification({ type: 'success', message: 'Connector updated' }); setEditing(null); load(); } catch { addNotification({ type: 'error', message: 'Failed to update connector' }); }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">Manage data source and target connectors.</p>
        <button onClick={() => setShowCreate(true)} className="btn-primary btn-sm"><Plus className="w-3.5 h-3.5" /> New Connector</button>
      </div>
      {connectors.length > 0 ? (
        <div className="space-y-2">
          {connectors.map((c) => (
            <div key={c.id} className="card">
              <div className="px-6 py-4 flex items-center justify-between group">
                <div className="flex items-center gap-4">
                  <button onClick={() => setExpanded(expanded === c.id ? null : c.id)} className="text-slate-400 hover:text-slate-700">{expanded === c.id ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}</button>
                  <div className="w-10 h-10 rounded-lg bg-violet-50 text-violet-600 flex items-center justify-center"><Cable className="w-5 h-5" /></div>
                  <div>
                    <div className="font-medium text-slate-900">{c.name}</div>
                    <div className="text-xs text-slate-500">{c.type} · {c.dialect}{c.host ? ` · ${c.host}` : ''}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${c.isConnected ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{c.isConnected ? 'Connected' : 'Disconnected'}</span>
                  <button onClick={() => openEdit(c)} className="btn-secondary btn-sm"><Pencil className="w-3.5 h-3.5" /></button>
                  <button onClick={() => handleDelete(c.id, c.name)} className="p-1.5 rounded opacity-0 group-hover:opacity-100 hover:bg-red-50 text-slate-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
              {expanded === c.id && (
                <div className="border-t border-slate-100 px-6 py-4 text-sm text-slate-600 grid grid-cols-3 gap-4">
                  <div><span className="text-slate-400">Type:</span> {c.type}</div>
                  <div><span className="text-slate-400">Dialect:</span> {c.dialect}</div>
                  <div><span className="text-slate-400">Status:</span> {c.status || 'unknown'}</div>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="card p-16 text-center"><Cable className="w-10 h-10 text-slate-300 mx-auto mb-3" /><h3 className="font-semibold text-slate-900 mb-1">No connectors yet</h3><p className="text-sm text-slate-500 mb-4">Create a connector to link data sources.</p><button onClick={() => setShowCreate(true)} className="btn-primary"><Plus className="w-4 h-4" /> Create Connector</button></div>
      )}

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Create Connector">
        <div className="space-y-4">
          <div><label className="label">Name</label><input className="input" placeholder="e.g., Production DB" value={newName} onChange={e => setNewName(e.target.value)} autoFocus /></div>
          <div className="grid grid-cols-2 gap-4"><div><label className="label">Type</label><select className="input" value={newType} onChange={e => setNewType(e.target.value)}>{CONNECTOR_TYPES.map(t => <option key={t} value={t}>{t}</option>)}</select></div><div><label className="label">Dialect</label><select className="input" value={newDialect} onChange={e => setNewDialect(e.target.value)}>{DIALECTS.map(d => <option key={d} value={d}>{d}</option>)}</select></div></div>
          <div><label className="label">Host</label><input className="input" placeholder="e.g., db.example.com" value={newHost} onChange={e => setNewHost(e.target.value)} /></div>
          <div className="flex justify-end gap-3 pt-2"><button onClick={() => setShowCreate(false)} className="btn-secondary">Cancel</button><button onClick={handleCreate} className="btn-primary" disabled={!newName.trim()}>Create</button></div>
        </div>
      </Modal>

      <Modal open={!!editing} onClose={() => setEditing(null)} title="Edit Connector">
        <div className="space-y-4">
          <div><label className="label">Name</label><input className="input" value={editName} onChange={e => setEditName(e.target.value)} /></div>
          <div><label className="label">Host</label><input className="input" value={editHost} onChange={e => setEditHost(e.target.value)} /></div>
          <div className="flex justify-end gap-3 pt-2"><button onClick={() => setEditing(null)} className="btn-secondary">Cancel</button><button onClick={handleSaveEdit} className="btn-primary" disabled={!editName.trim()}><Save className="w-3.5 h-3.5" /> Save</button></div>
        </div>
      </Modal>
    </div>
  );
}
