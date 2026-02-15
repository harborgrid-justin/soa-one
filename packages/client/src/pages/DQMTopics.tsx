import { useEffect, useState } from 'react';
import { Hash, Plus, Trash2, Pencil, Save, ChevronDown, ChevronRight } from 'lucide-react';
import { getDQMTopics, createDQMTopic, updateDQMTopic, deleteDQMTopic } from '../api/client';
import { Modal } from '../components/common/Modal';
import { useStore } from '../store';

export function DQMTopics() {
  const [topics, setTopics] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [editing, setEditing] = useState<any>(null);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState('standard');
  const [newPartitions, setNewPartitions] = useState('1');
  const [editName, setEditName] = useState('');
  const [editPartitions, setEditPartitions] = useState('');
  const { addNotification } = useStore();

  const load = () => { setLoading(true); getDQMTopics().then(setTopics).catch(() => {}).finally(() => setLoading(false)); };
  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    try { await createDQMTopic({ name: newName.trim(), type: newType, partitions: parseInt(newPartitions) || 1 }); addNotification({ type: 'success', message: 'Topic created' }); setShowCreate(false); setNewName(''); setNewType('standard'); setNewPartitions('1'); load(); } catch { addNotification({ type: 'error', message: 'Failed to create topic' }); }
  };

  const handleDelete = async (name: string) => {
    if (!confirm(`Delete topic "${name}"?`)) return;
    try { await deleteDQMTopic(name); addNotification({ type: 'success', message: 'Topic deleted' }); load(); } catch { addNotification({ type: 'error', message: 'Failed to delete topic' }); }
  };

  const openEdit = (t: any) => { setEditing(t); setEditName(t.name); setEditPartitions(String(t.partitions ?? 1)); };
  const handleSaveEdit = async () => {
    if (!editing || !editName.trim()) return;
    try { await updateDQMTopic(editing.name, { partitions: parseInt(editPartitions) || 1 }); addNotification({ type: 'success', message: 'Topic updated' }); setEditing(null); load(); } catch { addNotification({ type: 'error', message: 'Failed to update topic' }); }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">Manage message topics for pub/sub messaging.</p>
        <button onClick={() => setShowCreate(true)} className="btn-primary btn-sm"><Plus className="w-3.5 h-3.5" /> New Topic</button>
      </div>
      {topics.length > 0 ? (
        <div className="space-y-2">
          {topics.map((t) => (
            <div key={t.name} className="card">
              <div className="px-6 py-4 flex items-center justify-between group">
                <div className="flex items-center gap-4">
                  <button onClick={() => setExpanded(expanded === t.name ? null : t.name)} className="text-slate-400 hover:text-slate-700">{expanded === t.name ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}</button>
                  <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center"><Hash className="w-5 h-5" /></div>
                  <div><div className="font-medium text-slate-900">{t.name}</div><div className="text-xs text-slate-500">{t.type || 'standard'} · {t.subscriptionCount ?? 0} subs · backlog {t.messageBacklog ?? 0}</div></div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-xs text-slate-500">{(t.published ?? 0).toLocaleString()} pub / {(t.delivered ?? 0).toLocaleString()} del</div>
                  <button onClick={() => openEdit(t)} className="btn-secondary btn-sm"><Pencil className="w-3.5 h-3.5" /></button>
                  <button onClick={() => handleDelete(t.name)} className="p-1.5 rounded opacity-0 group-hover:opacity-100 hover:bg-red-50 text-slate-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
              {expanded === t.name && (
                <div className="border-t border-slate-100 px-6 py-4 text-sm text-slate-600 grid grid-cols-4 gap-4">
                  <div><span className="text-slate-400">Published:</span> {(t.published ?? 0).toLocaleString()}</div>
                  <div><span className="text-slate-400">Delivered:</span> {(t.delivered ?? 0).toLocaleString()}</div>
                  <div><span className="text-slate-400">Subscriptions:</span> {t.subscriptionCount ?? 0}</div>
                  <div><span className="text-slate-400">Backlog:</span> {t.messageBacklog ?? 0}</div>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="card p-16 text-center"><Hash className="w-10 h-10 text-slate-300 mx-auto mb-3" /><h3 className="font-semibold text-slate-900 mb-1">No topics</h3><p className="text-sm text-slate-500 mb-4">Create a topic to start publishing messages.</p><button onClick={() => setShowCreate(true)} className="btn-primary"><Plus className="w-4 h-4" /> Create Topic</button></div>
      )}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Create Topic">
        <div className="space-y-4">
          <div><label className="label">Name</label><input className="input" placeholder="e.g., order-events" value={newName} onChange={e => setNewName(e.target.value)} autoFocus /></div>
          <div className="grid grid-cols-2 gap-4"><div><label className="label">Type</label><select className="input" value={newType} onChange={e => setNewType(e.target.value)}><option value="standard">Standard</option><option value="compacted">Compacted</option><option value="partitioned">Partitioned</option></select></div><div><label className="label">Partitions</label><input className="input" type="number" min="1" value={newPartitions} onChange={e => setNewPartitions(e.target.value)} /></div></div>
          <div className="flex justify-end gap-3 pt-2"><button onClick={() => setShowCreate(false)} className="btn-secondary">Cancel</button><button onClick={handleCreate} className="btn-primary" disabled={!newName.trim()}>Create</button></div>
        </div>
      </Modal>
      <Modal open={!!editing} onClose={() => setEditing(null)} title="Edit Topic">
        <div className="space-y-4">
          <div><label className="label">Name</label><input className="input bg-slate-50" value={editName} disabled /></div>
          <div><label className="label">Partitions</label><input className="input" type="number" min="1" value={editPartitions} onChange={e => setEditPartitions(e.target.value)} /></div>
          <div className="flex justify-end gap-3 pt-2"><button onClick={() => setEditing(null)} className="btn-secondary">Cancel</button><button onClick={handleSaveEdit} className="btn-primary"><Save className="w-3.5 h-3.5" /> Save</button></div>
        </div>
      </Modal>
    </div>
  );
}
