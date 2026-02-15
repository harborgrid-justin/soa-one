import { useEffect, useState } from 'react';
import { Inbox, Plus, Trash2, Pencil, Save, ChevronDown, ChevronRight } from 'lucide-react';
import { getDQMQueues, createDQMQueue, updateDQMQueue, deleteDQMQueue } from '../api/client';
import { Modal } from '../components/common/Modal';
import { useStore } from '../store';

export function DQMQueues() {
  const [queues, setQueues] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [editing, setEditing] = useState<any>(null);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState('standard');
  const [editName, setEditName] = useState('');
  const { addNotification } = useStore();

  const load = () => { setLoading(true); getDQMQueues().then(setQueues).catch(() => {}).finally(() => setLoading(false)); };
  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    try { await createDQMQueue({ name: newName.trim(), type: newType }); addNotification({ type: 'success', message: 'Queue created' }); setShowCreate(false); setNewName(''); setNewType('standard'); load(); } catch { addNotification({ type: 'error', message: 'Failed to create queue' }); }
  };

  const handleDelete = async (name: string) => {
    if (!confirm(`Delete queue "${name}"?`)) return;
    try { await deleteDQMQueue(name); addNotification({ type: 'success', message: 'Queue deleted' }); load(); } catch { addNotification({ type: 'error', message: 'Failed to delete queue' }); }
  };

  const openEdit = (q: any) => { setEditing(q); setEditName(q.name); };
  const handleSaveEdit = async () => {
    if (!editing) return;
    try { await updateDQMQueue(editing.name, { type: editing.type }); addNotification({ type: 'success', message: 'Queue updated' }); setEditing(null); load(); } catch { addNotification({ type: 'error', message: 'Failed to update queue' }); }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">Manage message queues for point-to-point messaging.</p>
        <button onClick={() => setShowCreate(true)} className="btn-primary btn-sm"><Plus className="w-3.5 h-3.5" /> New Queue</button>
      </div>
      {queues.length > 0 ? (
        <div className="space-y-2">
          {queues.map((q) => (
            <div key={q.name} className="card">
              <div className="px-6 py-4 flex items-center justify-between group">
                <div className="flex items-center gap-4">
                  <button onClick={() => setExpanded(expanded === q.name ? null : q.name)} className="text-slate-400 hover:text-slate-700">{expanded === q.name ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}</button>
                  <div className="w-10 h-10 rounded-lg bg-orange-50 text-orange-600 flex items-center justify-center"><Inbox className="w-5 h-5" /></div>
                  <div><div className="font-medium text-slate-900">{q.name}</div><div className="text-xs text-slate-500">{q.type || 'standard'} · depth {q.depth ?? 0} · DLQ {q.deadLetterDepth ?? 0}</div></div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-xs text-slate-500">{(q.enqueued ?? 0).toLocaleString()} in / {(q.dequeued ?? 0).toLocaleString()} out</div>
                  <button onClick={() => openEdit(q)} className="btn-secondary btn-sm"><Pencil className="w-3.5 h-3.5" /></button>
                  <button onClick={() => handleDelete(q.name)} className="p-1.5 rounded opacity-0 group-hover:opacity-100 hover:bg-red-50 text-slate-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
              {expanded === q.name && (
                <div className="border-t border-slate-100 px-6 py-4 text-sm text-slate-600 grid grid-cols-4 gap-4">
                  <div><span className="text-slate-400">Enqueued:</span> {(q.enqueued ?? 0).toLocaleString()}</div>
                  <div><span className="text-slate-400">Dequeued:</span> {(q.dequeued ?? 0).toLocaleString()}</div>
                  <div><span className="text-slate-400">Acknowledged:</span> {(q.acknowledged ?? 0).toLocaleString()}</div>
                  <div><span className="text-slate-400">Dead Letter:</span> {q.deadLetterDepth ?? 0}</div>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="card p-16 text-center"><Inbox className="w-10 h-10 text-slate-300 mx-auto mb-3" /><h3 className="font-semibold text-slate-900 mb-1">No queues</h3><p className="text-sm text-slate-500 mb-4">Create a queue for point-to-point messaging.</p><button onClick={() => setShowCreate(true)} className="btn-primary"><Plus className="w-4 h-4" /> Create Queue</button></div>
      )}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Create Queue">
        <div className="space-y-4">
          <div><label className="label">Name</label><input className="input" placeholder="e.g., order-processing" value={newName} onChange={e => setNewName(e.target.value)} autoFocus /></div>
          <div><label className="label">Type</label><select className="input" value={newType} onChange={e => setNewType(e.target.value)}><option value="standard">Standard</option><option value="priority">Priority</option><option value="delay">Delay</option></select></div>
          <div className="flex justify-end gap-3 pt-2"><button onClick={() => setShowCreate(false)} className="btn-secondary">Cancel</button><button onClick={handleCreate} className="btn-primary" disabled={!newName.trim()}>Create</button></div>
        </div>
      </Modal>
      <Modal open={!!editing} onClose={() => setEditing(null)} title="Edit Queue">
        <div className="space-y-4">
          <div><label className="label">Name</label><input className="input bg-slate-50" value={editName} disabled /></div>
          <div className="flex justify-end gap-3 pt-2"><button onClick={() => setEditing(null)} className="btn-secondary">Cancel</button><button onClick={handleSaveEdit} className="btn-primary"><Save className="w-3.5 h-3.5" /> Save</button></div>
        </div>
      </Modal>
    </div>
  );
}
