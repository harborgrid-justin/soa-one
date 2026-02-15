import { useEffect, useState } from 'react';
import { ClipboardList, Plus, Trash2, Pencil, Save, UserCheck, CheckCircle } from 'lucide-react';
import { getSOATasks, createSOATask, updateSOATask, deleteSOATask, claimSOATask, completeSOATask } from '../api/client';
import { Modal } from '../components/common/Modal';
import { useStore } from '../store';

const STATUS_COLORS: Record<string, string> = { pending: 'bg-amber-50 text-amber-700', assigned: 'bg-blue-50 text-blue-700', completed: 'bg-emerald-50 text-emerald-700', expired: 'bg-red-50 text-red-700' };
const PRIORITIES = ['low', 'medium', 'high', 'critical'];

export function SOATasks() {
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [newName, setNewName] = useState('');
  const [newPriority, setNewPriority] = useState('medium');
  const [newDescription, setNewDescription] = useState('');
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const { addNotification } = useStore();

  const load = () => { setLoading(true); getSOATasks().then(setTasks).catch(() => {}).finally(() => setLoading(false)); };
  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    try { await createSOATask({ name: newName.trim(), priority: newPriority, description: newDescription }); addNotification({ type: 'success', message: 'Task created' }); setShowCreate(false); setNewName(''); setNewPriority('medium'); setNewDescription(''); load(); } catch { addNotification({ type: 'error', message: 'Failed to create task' }); }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete task "${name}"?`)) return;
    try { await deleteSOATask(id); addNotification({ type: 'success', message: 'Task deleted' }); load(); } catch { addNotification({ type: 'error', message: 'Failed to delete task' }); }
  };

  const handleClaim = async (id: string) => {
    try { await claimSOATask(id, 'current-user'); addNotification({ type: 'success', message: 'Task claimed' }); load(); } catch { addNotification({ type: 'error', message: 'Failed to claim task' }); }
  };

  const handleComplete = async (id: string) => {
    try { await completeSOATask(id); addNotification({ type: 'success', message: 'Task completed' }); load(); } catch { addNotification({ type: 'error', message: 'Failed to complete task' }); }
  };

  const openEdit = (t: any) => { setEditing(t); setEditName(t.name); setEditDescription(t.description || ''); };
  const handleSaveEdit = async () => {
    if (!editing || !editName.trim()) return;
    try { await updateSOATask(editing.id, { name: editName.trim(), description: editDescription }); addNotification({ type: 'success', message: 'Task updated' }); setEditing(null); load(); } catch { addNotification({ type: 'error', message: 'Failed to update task' }); }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">Manage human tasks and approvals.</p>
        <button onClick={() => setShowCreate(true)} className="btn-primary btn-sm"><Plus className="w-3.5 h-3.5" /> New Task</button>
      </div>
      {tasks.length > 0 ? (
        <div className="space-y-2">
          {tasks.map((t) => (
            <div key={t.id} className="card px-6 py-4 flex items-center justify-between group">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-orange-50 text-orange-600 flex items-center justify-center"><ClipboardList className="w-5 h-5" /></div>
                <div><div className="font-medium text-slate-900">{t.name}</div><div className="text-xs text-slate-500">{t.priority || 'medium'} priority{t.assignee ? ` · ${t.assignee}` : ''}</div></div>
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[t.status] || STATUS_COLORS.pending}`}>{t.status || 'pending'}</span>
                {(!t.status || t.status === 'pending') && <button onClick={() => handleClaim(t.id)} className="btn-secondary btn-sm" title="Claim"><UserCheck className="w-3.5 h-3.5" /></button>}
                {t.status === 'assigned' && <button onClick={() => handleComplete(t.id)} className="btn-secondary btn-sm" title="Complete"><CheckCircle className="w-3.5 h-3.5" /></button>}
                <button onClick={() => openEdit(t)} className="btn-secondary btn-sm"><Pencil className="w-3.5 h-3.5" /></button>
                <button onClick={() => handleDelete(t.id, t.name)} className="p-1.5 rounded opacity-0 group-hover:opacity-100 hover:bg-red-50 text-slate-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="card p-16 text-center"><ClipboardList className="w-10 h-10 text-slate-300 mx-auto mb-3" /><h3 className="font-semibold text-slate-900 mb-1">No tasks</h3><p className="text-sm text-slate-500 mb-4">Create human tasks for workflow approvals.</p><button onClick={() => setShowCreate(true)} className="btn-primary"><Plus className="w-4 h-4" /> Create Task</button></div>
      )}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Create Task">
        <div className="space-y-4">
          <div><label className="label">Name</label><input className="input" value={newName} onChange={e => setNewName(e.target.value)} autoFocus /></div>
          <div><label className="label">Priority</label><select className="input" value={newPriority} onChange={e => setNewPriority(e.target.value)}>{PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}</select></div>
          <div><label className="label">Description</label><textarea className="input" rows={2} value={newDescription} onChange={e => setNewDescription(e.target.value)} /></div>
          <div className="flex justify-end gap-3 pt-2"><button onClick={() => setShowCreate(false)} className="btn-secondary">Cancel</button><button onClick={handleCreate} className="btn-primary" disabled={!newName.trim()}>Create</button></div>
        </div>
      </Modal>
      <Modal open={!!editing} onClose={() => setEditing(null)} title="Edit Task">
        <div className="space-y-4">
          <div><label className="label">Name</label><input className="input" value={editName} onChange={e => setEditName(e.target.value)} /></div>
          <div><label className="label">Description</label><textarea className="input" rows={2} value={editDescription} onChange={e => setEditDescription(e.target.value)} /></div>
          <div className="flex justify-end gap-3 pt-2"><button onClick={() => setEditing(null)} className="btn-secondary">Cancel</button><button onClick={handleSaveEdit} className="btn-primary" disabled={!editName.trim()}><Save className="w-3.5 h-3.5" /> Save</button></div>
        </div>
      </Modal>
    </div>
  );
}
