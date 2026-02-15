import { useEffect, useState } from 'react';
import { Workflow, Plus, Trash2, Pencil, Save, Play, ChevronDown, ChevronRight } from 'lucide-react';
import { getSOAProcesses, createSOAProcess, updateSOAProcess, deleteSOAProcess, startSOAProcess } from '../api/client';
import { Modal } from '../components/common/Modal';
import { useStore } from '../store';

const STATUS_COLORS: Record<string, string> = { active: 'bg-emerald-50 text-emerald-700', deployed: 'bg-blue-50 text-blue-700', suspended: 'bg-amber-50 text-amber-700', retired: 'bg-slate-100 text-slate-500' };

export function SOAProcesses() {
  const [processes, setProcesses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [editing, setEditing] = useState<any>(null);
  const [newName, setNewName] = useState('');
  const [newVersion, setNewVersion] = useState('1.0');
  const [newDescription, setNewDescription] = useState('');
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const { addNotification } = useStore();

  const load = () => { setLoading(true); getSOAProcesses().then(setProcesses).catch(() => {}).finally(() => setLoading(false)); };
  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    try { await createSOAProcess({ name: newName.trim(), version: newVersion, description: newDescription }); addNotification({ type: 'success', message: 'Process created' }); setShowCreate(false); setNewName(''); setNewVersion('1.0'); setNewDescription(''); load(); } catch { addNotification({ type: 'error', message: 'Failed to create process' }); }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete process "${name}"?`)) return;
    try { await deleteSOAProcess(id); addNotification({ type: 'success', message: 'Process deleted' }); load(); } catch { addNotification({ type: 'error', message: 'Failed to delete process' }); }
  };

  const handleStart = async (id: string) => {
    try { await startSOAProcess(id); addNotification({ type: 'success', message: 'Process started' }); load(); } catch { addNotification({ type: 'error', message: 'Failed to start process' }); }
  };

  const openEdit = (p: any) => { setEditing(p); setEditName(p.name); setEditDescription(p.description || ''); };
  const handleSaveEdit = async () => {
    if (!editing || !editName.trim()) return;
    try { await updateSOAProcess(editing.id, { name: editName.trim(), description: editDescription }); addNotification({ type: 'success', message: 'Process updated' }); setEditing(null); load(); } catch { addNotification({ type: 'error', message: 'Failed to update process' }); }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">Manage BPEL business processes and orchestrations.</p>
        <button onClick={() => setShowCreate(true)} className="btn-primary btn-sm"><Plus className="w-3.5 h-3.5" /> New Process</button>
      </div>
      {processes.length > 0 ? (
        <div className="space-y-2">
          {processes.map((p) => (
            <div key={p.id} className="card">
              <div className="px-6 py-4 flex items-center justify-between group">
                <div className="flex items-center gap-4">
                  <button onClick={() => setExpanded(expanded === p.id ? null : p.id)} className="text-slate-400 hover:text-slate-700">{expanded === p.id ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}</button>
                  <div className="w-10 h-10 rounded-lg bg-violet-50 text-violet-600 flex items-center justify-center"><Workflow className="w-5 h-5" /></div>
                  <div><div className="font-medium text-slate-900">{p.name} <span className="text-xs text-slate-400">v{p.version || '—'}</span></div><div className="text-xs text-slate-500">{p.activityCount ?? 0} activities</div></div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[p.status] || STATUS_COLORS.suspended}`}>{p.status || 'inactive'}</span>
                  <button onClick={() => handleStart(p.id)} className="btn-secondary btn-sm"><Play className="w-3.5 h-3.5" /></button>
                  <button onClick={() => openEdit(p)} className="btn-secondary btn-sm"><Pencil className="w-3.5 h-3.5" /></button>
                  <button onClick={() => handleDelete(p.id, p.name)} className="p-1.5 rounded opacity-0 group-hover:opacity-100 hover:bg-red-50 text-slate-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
              {expanded === p.id && p.description && <div className="border-t border-slate-100 px-6 py-4 text-sm text-slate-600">{p.description}</div>}
            </div>
          ))}
        </div>
      ) : (
        <div className="card p-16 text-center"><Workflow className="w-10 h-10 text-slate-300 mx-auto mb-3" /><h3 className="font-semibold text-slate-900 mb-1">No processes</h3><p className="text-sm text-slate-500 mb-4">Create a BPEL process definition.</p><button onClick={() => setShowCreate(true)} className="btn-primary"><Plus className="w-4 h-4" /> Create Process</button></div>
      )}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Create Process">
        <div className="space-y-4">
          <div><label className="label">Name</label><input className="input" value={newName} onChange={e => setNewName(e.target.value)} autoFocus /></div>
          <div><label className="label">Version</label><input className="input" value={newVersion} onChange={e => setNewVersion(e.target.value)} /></div>
          <div><label className="label">Description</label><textarea className="input" rows={2} value={newDescription} onChange={e => setNewDescription(e.target.value)} /></div>
          <div className="flex justify-end gap-3 pt-2"><button onClick={() => setShowCreate(false)} className="btn-secondary">Cancel</button><button onClick={handleCreate} className="btn-primary" disabled={!newName.trim()}>Create</button></div>
        </div>
      </Modal>
      <Modal open={!!editing} onClose={() => setEditing(null)} title="Edit Process">
        <div className="space-y-4">
          <div><label className="label">Name</label><input className="input" value={editName} onChange={e => setEditName(e.target.value)} /></div>
          <div><label className="label">Description</label><textarea className="input" rows={2} value={editDescription} onChange={e => setEditDescription(e.target.value)} /></div>
          <div className="flex justify-end gap-3 pt-2"><button onClick={() => setEditing(null)} className="btn-secondary">Cancel</button><button onClick={handleSaveEdit} className="btn-primary" disabled={!editName.trim()}><Save className="w-3.5 h-3.5" /> Save</button></div>
        </div>
      </Modal>
    </div>
  );
}
