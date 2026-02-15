import { useEffect, useState } from 'react';
import { GitBranch, Plus, Trash2, Pencil, Save, Power, ChevronDown, ChevronRight } from 'lucide-react';
import { getDIPipelines, createDIPipeline, updateDIPipeline, deleteDIPipeline } from '../api/client';
import { Modal } from '../components/common/Modal';
import { useStore } from '../store';

export function DIPipelines() {
  const [pipelines, setPipelines] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [editing, setEditing] = useState<any>(null);
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newType, setNewType] = useState('batch');
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const { addNotification } = useStore();

  const load = () => {
    setLoading(true);
    getDIPipelines().then(setPipelines).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    try {
      await createDIPipeline({ name: newName.trim(), description: newDescription, type: newType });
      addNotification({ type: 'success', message: 'Pipeline created' });
      setShowCreate(false); setNewName(''); setNewDescription(''); setNewType('batch');
      load();
    } catch { addNotification({ type: 'error', message: 'Failed to create pipeline' }); }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete pipeline "${name}"?`)) return;
    try {
      await deleteDIPipeline(id);
      addNotification({ type: 'success', message: 'Pipeline deleted' });
      load();
    } catch { addNotification({ type: 'error', message: 'Failed to delete pipeline' }); }
  };

  const handleToggle = async (p: any) => {
    try {
      await updateDIPipeline(p.id, { enabled: !p.enabled });
      addNotification({ type: 'success', message: `Pipeline ${p.enabled ? 'disabled' : 'enabled'}` });
      load();
    } catch { addNotification({ type: 'error', message: 'Failed to toggle pipeline' }); }
  };

  const openEdit = (p: any) => { setEditing(p); setEditName(p.name); setEditDescription(p.description || ''); };
  const handleSaveEdit = async () => {
    if (!editing || !editName.trim()) return;
    try {
      await updateDIPipeline(editing.id, { name: editName.trim(), description: editDescription });
      addNotification({ type: 'success', message: 'Pipeline updated' });
      setEditing(null); load();
    } catch { addNotification({ type: 'error', message: 'Failed to update pipeline' }); }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">Manage data integration pipelines for ETL/ELT workloads.</p>
        <button onClick={() => setShowCreate(true)} className="btn-primary btn-sm"><Plus className="w-3.5 h-3.5" /> New Pipeline</button>
      </div>

      {pipelines.length > 0 ? (
        <div className="space-y-2">
          {pipelines.map((p) => (
            <div key={p.id} className="card">
              <div className="px-6 py-4 flex items-center justify-between group">
                <div className="flex items-center gap-4">
                  <button onClick={() => setExpanded(expanded === p.id ? null : p.id)} className="text-slate-400 hover:text-slate-700">
                    {expanded === p.id ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </button>
                  <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center"><GitBranch className="w-5 h-5" /></div>
                  <div>
                    <div className="font-medium text-slate-900">{p.name}</div>
                    <div className="text-xs text-slate-500">{p.stageCount ?? 0} stages</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${p.enabled ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{p.enabled ? 'Enabled' : 'Disabled'}</span>
                  <button onClick={() => handleToggle(p)} className="btn-secondary btn-sm"><Power className="w-3.5 h-3.5" /></button>
                  <button onClick={() => openEdit(p)} className="btn-secondary btn-sm"><Pencil className="w-3.5 h-3.5" /></button>
                  <button onClick={() => handleDelete(p.id, p.name)} className="p-1.5 rounded opacity-0 group-hover:opacity-100 hover:bg-red-50 text-slate-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
              {expanded === p.id && (
                <div className="border-t border-slate-100 px-6 py-4 text-sm text-slate-600">
                  {p.description && <p className="mb-2">{p.description}</p>}
                  <div className="grid grid-cols-3 gap-4 text-xs"><div><span className="text-slate-400">Type:</span> {p.type || 'batch'}</div><div><span className="text-slate-400">Stages:</span> {p.stageCount ?? 0}</div><div><span className="text-slate-400">Created:</span> {p.createdAt ? new Date(p.createdAt).toLocaleDateString() : 'N/A'}</div></div>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="card p-16 text-center"><GitBranch className="w-10 h-10 text-slate-300 mx-auto mb-3" /><h3 className="font-semibold text-slate-900 mb-1">No pipelines yet</h3><p className="text-sm text-slate-500 mb-4">Create a pipeline to start integrating data.</p><button onClick={() => setShowCreate(true)} className="btn-primary"><Plus className="w-4 h-4" /> Create Pipeline</button></div>
      )}

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Create Pipeline">
        <div className="space-y-4">
          <div><label className="label">Name</label><input className="input" placeholder="e.g., Customer Data Sync" value={newName} onChange={e => setNewName(e.target.value)} autoFocus /></div>
          <div><label className="label">Description</label><textarea className="input" rows={2} value={newDescription} onChange={e => setNewDescription(e.target.value)} /></div>
          <div><label className="label">Type</label><select className="input" value={newType} onChange={e => setNewType(e.target.value)}><option value="batch">Batch</option><option value="streaming">Streaming</option><option value="hybrid">Hybrid</option></select></div>
          <div className="flex justify-end gap-3 pt-2"><button onClick={() => setShowCreate(false)} className="btn-secondary">Cancel</button><button onClick={handleCreate} className="btn-primary" disabled={!newName.trim()}>Create</button></div>
        </div>
      </Modal>

      <Modal open={!!editing} onClose={() => setEditing(null)} title="Edit Pipeline">
        <div className="space-y-4">
          <div><label className="label">Name</label><input className="input" value={editName} onChange={e => setEditName(e.target.value)} /></div>
          <div><label className="label">Description</label><textarea className="input" rows={2} value={editDescription} onChange={e => setEditDescription(e.target.value)} /></div>
          <div className="flex justify-end gap-3 pt-2"><button onClick={() => setEditing(null)} className="btn-secondary">Cancel</button><button onClick={handleSaveEdit} className="btn-primary" disabled={!editName.trim()}><Save className="w-3.5 h-3.5" /> Save</button></div>
        </div>
      </Modal>
    </div>
  );
}
