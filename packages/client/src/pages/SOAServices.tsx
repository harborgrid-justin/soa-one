import { useEffect, useState } from 'react';
import { Server, Plus, Trash2, Pencil, Save, ChevronDown, ChevronRight } from 'lucide-react';
import { getSOAServices, createSOAService, updateSOAService, deleteSOAService } from '../api/client';
import { Modal } from '../components/common/Modal';
import { useStore } from '../store';

const STATUS_COLORS: Record<string, string> = { active: 'bg-emerald-50 text-emerald-700', inactive: 'bg-slate-100 text-slate-500', deprecated: 'bg-amber-50 text-amber-700', error: 'bg-red-50 text-red-700' };

export function SOAServices() {
  const [services, setServices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [editing, setEditing] = useState<any>(null);
  const [newName, setNewName] = useState('');
  const [newVersion, setNewVersion] = useState('1.0.0');
  const [newDescription, setNewDescription] = useState('');
  const [editName, setEditName] = useState('');
  const [editVersion, setEditVersion] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const { addNotification } = useStore();

  const load = () => { setLoading(true); getSOAServices().then(setServices).catch(() => {}).finally(() => setLoading(false)); };
  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    try { await createSOAService({ name: newName.trim(), version: newVersion, description: newDescription }); addNotification({ type: 'success', message: 'Service created' }); setShowCreate(false); setNewName(''); setNewVersion('1.0.0'); setNewDescription(''); load(); } catch { addNotification({ type: 'error', message: 'Failed to create service' }); }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete service "${name}"?`)) return;
    try { await deleteSOAService(id); addNotification({ type: 'success', message: 'Service deleted' }); load(); } catch { addNotification({ type: 'error', message: 'Failed to delete service' }); }
  };

  const openEdit = (s: any) => { setEditing(s); setEditName(s.name); setEditVersion(s.version || ''); setEditDescription(s.description || ''); };
  const handleSaveEdit = async () => {
    if (!editing || !editName.trim()) return;
    try { await updateSOAService(editing.id, { name: editName.trim(), version: editVersion, description: editDescription }); addNotification({ type: 'success', message: 'Service updated' }); setEditing(null); load(); } catch { addNotification({ type: 'error', message: 'Failed to update service' }); }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">Manage SOA service registry and endpoints.</p>
        <button onClick={() => setShowCreate(true)} className="btn-primary btn-sm"><Plus className="w-3.5 h-3.5" /> New Service</button>
      </div>
      {services.length > 0 ? (
        <div className="space-y-2">
          {services.map((s) => (
            <div key={s.id} className="card">
              <div className="px-6 py-4 flex items-center justify-between group">
                <div className="flex items-center gap-4">
                  <button onClick={() => setExpanded(expanded === s.id ? null : s.id)} className="text-slate-400 hover:text-slate-700">{expanded === s.id ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}</button>
                  <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center"><Server className="w-5 h-5" /></div>
                  <div><div className="font-medium text-slate-900">{s.name} <span className="text-xs text-slate-400">v{s.version || '—'}</span></div><div className="text-xs text-slate-500">{s.endpointCount ?? 0} endpoints · {s.contractCount ?? 0} contracts · {s.dependencyCount ?? 0} deps</div></div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[s.status] || STATUS_COLORS.inactive}`}>{s.status || 'inactive'}</span>
                  {s.tags?.length > 0 && <div className="flex gap-1">{s.tags.slice(0, 2).map((t: string) => <span key={t} className="text-xs px-1.5 py-0.5 bg-slate-100 rounded">{t}</span>)}</div>}
                  <button onClick={() => openEdit(s)} className="btn-secondary btn-sm"><Pencil className="w-3.5 h-3.5" /></button>
                  <button onClick={() => handleDelete(s.id, s.name)} className="p-1.5 rounded opacity-0 group-hover:opacity-100 hover:bg-red-50 text-slate-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
              {expanded === s.id && s.description && <div className="border-t border-slate-100 px-6 py-4 text-sm text-slate-600">{s.description}</div>}
            </div>
          ))}
        </div>
      ) : (
        <div className="card p-16 text-center"><Server className="w-10 h-10 text-slate-300 mx-auto mb-3" /><h3 className="font-semibold text-slate-900 mb-1">No services</h3><p className="text-sm text-slate-500 mb-4">Register a service in the SOA registry.</p><button onClick={() => setShowCreate(true)} className="btn-primary"><Plus className="w-4 h-4" /> Create Service</button></div>
      )}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Create Service">
        <div className="space-y-4">
          <div><label className="label">Name</label><input className="input" value={newName} onChange={e => setNewName(e.target.value)} autoFocus /></div>
          <div><label className="label">Version</label><input className="input" value={newVersion} onChange={e => setNewVersion(e.target.value)} /></div>
          <div><label className="label">Description</label><textarea className="input" rows={2} value={newDescription} onChange={e => setNewDescription(e.target.value)} /></div>
          <div className="flex justify-end gap-3 pt-2"><button onClick={() => setShowCreate(false)} className="btn-secondary">Cancel</button><button onClick={handleCreate} className="btn-primary" disabled={!newName.trim()}>Create</button></div>
        </div>
      </Modal>
      <Modal open={!!editing} onClose={() => setEditing(null)} title="Edit Service">
        <div className="space-y-4">
          <div><label className="label">Name</label><input className="input" value={editName} onChange={e => setEditName(e.target.value)} /></div>
          <div><label className="label">Version</label><input className="input" value={editVersion} onChange={e => setEditVersion(e.target.value)} /></div>
          <div><label className="label">Description</label><textarea className="input" rows={2} value={editDescription} onChange={e => setEditDescription(e.target.value)} /></div>
          <div className="flex justify-end gap-3 pt-2"><button onClick={() => setEditing(null)} className="btn-secondary">Cancel</button><button onClick={handleSaveEdit} className="btn-primary" disabled={!editName.trim()}><Save className="w-3.5 h-3.5" /> Save</button></div>
        </div>
      </Modal>
    </div>
  );
}
