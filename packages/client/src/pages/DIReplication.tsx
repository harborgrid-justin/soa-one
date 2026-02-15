import { useEffect, useState } from 'react';
import { Copy, Plus, Trash2, Pencil, Save, ChevronDown, ChevronRight } from 'lucide-react';
import { getDIReplicationStreams, createDIReplicationStream, updateDIReplicationStream, deleteDIReplicationStream } from '../api/client';
import { Modal } from '../components/common/Modal';
import { useStore } from '../store';

const STATUS_COLORS: Record<string, string> = { active: 'bg-emerald-50 text-emerald-700', idle: 'bg-slate-100 text-slate-500', paused: 'bg-amber-50 text-amber-700', error: 'bg-red-50 text-red-700' };

export function DIReplication() {
  const [streams, setStreams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [editing, setEditing] = useState<any>(null);
  const [newName, setNewName] = useState('');
  const [newMode, setNewMode] = useState('full');
  const [editName, setEditName] = useState('');
  const [editMode, setEditMode] = useState('');
  const { addNotification } = useStore();

  const load = () => { setLoading(true); getDIReplicationStreams().then(setStreams).catch(() => {}).finally(() => setLoading(false)); };
  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    try { await createDIReplicationStream({ name: newName.trim(), mode: newMode }); addNotification({ type: 'success', message: 'Replication stream created' }); setShowCreate(false); setNewName(''); setNewMode('full'); load(); } catch { addNotification({ type: 'error', message: 'Failed to create stream' }); }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete replication stream "${name}"?`)) return;
    try { await deleteDIReplicationStream(id); addNotification({ type: 'success', message: 'Stream deleted' }); load(); } catch { addNotification({ type: 'error', message: 'Failed to delete stream' }); }
  };

  const openEdit = (s: any) => { setEditing(s); setEditName(s.name); setEditMode(s.mode || 'full'); };
  const handleSaveEdit = async () => {
    if (!editing || !editName.trim()) return;
    try { await updateDIReplicationStream(editing.streamId || editing.id, { name: editName.trim(), mode: editMode }); addNotification({ type: 'success', message: 'Stream updated' }); setEditing(null); load(); } catch { addNotification({ type: 'error', message: 'Failed to update stream' }); }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">Manage data replication streams across systems.</p>
        <button onClick={() => setShowCreate(true)} className="btn-primary btn-sm"><Plus className="w-3.5 h-3.5" /> New Stream</button>
      </div>
      {streams.length > 0 ? (
        <div className="space-y-2">
          {streams.map((s) => (
            <div key={s.streamId || s.id} className="card">
              <div className="px-6 py-4 flex items-center justify-between group">
                <div className="flex items-center gap-4">
                  <button onClick={() => setExpanded(expanded === (s.streamId || s.id) ? null : (s.streamId || s.id))} className="text-slate-400 hover:text-slate-700">{expanded === (s.streamId || s.id) ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}</button>
                  <div className="w-10 h-10 rounded-lg bg-cyan-50 text-cyan-600 flex items-center justify-center"><Copy className="w-5 h-5" /></div>
                  <div><div className="font-medium text-slate-900">{s.name}</div><div className="text-xs text-slate-500">{(s.eventsApplied ?? 0).toLocaleString()} applied · {s.conflicts ?? 0} conflicts</div></div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[s.status] || STATUS_COLORS.idle}`}>{s.status}</span>
                  <button onClick={() => openEdit(s)} className="btn-secondary btn-sm"><Pencil className="w-3.5 h-3.5" /></button>
                  <button onClick={() => handleDelete(s.streamId || s.id, s.name)} className="p-1.5 rounded opacity-0 group-hover:opacity-100 hover:bg-red-50 text-slate-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
              {expanded === (s.streamId || s.id) && (
                <div className="border-t border-slate-100 px-6 py-4 text-sm text-slate-600 grid grid-cols-3 gap-4">
                  <div><span className="text-slate-400">Stream ID:</span> {s.streamId || s.id}</div>
                  <div><span className="text-slate-400">Events Applied:</span> {(s.eventsApplied ?? 0).toLocaleString()}</div>
                  <div><span className="text-slate-400">Conflicts:</span> {s.conflicts ?? 0}</div>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="card p-16 text-center"><Copy className="w-10 h-10 text-slate-300 mx-auto mb-3" /><h3 className="font-semibold text-slate-900 mb-1">No replication streams</h3><p className="text-sm text-slate-500 mb-4">Create a replication stream to sync data.</p><button onClick={() => setShowCreate(true)} className="btn-primary"><Plus className="w-4 h-4" /> Create Stream</button></div>
      )}

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Create Replication Stream">
        <div className="space-y-4">
          <div><label className="label">Name</label><input className="input" placeholder="e.g., prod-to-staging" value={newName} onChange={e => setNewName(e.target.value)} autoFocus /></div>
          <div><label className="label">Mode</label><select className="input" value={newMode} onChange={e => setNewMode(e.target.value)}><option value="full">Full</option><option value="incremental">Incremental</option><option value="snapshot">Snapshot</option></select></div>
          <div className="flex justify-end gap-3 pt-2"><button onClick={() => setShowCreate(false)} className="btn-secondary">Cancel</button><button onClick={handleCreate} className="btn-primary" disabled={!newName.trim()}>Create</button></div>
        </div>
      </Modal>

      <Modal open={!!editing} onClose={() => setEditing(null)} title="Edit Replication Stream">
        <div className="space-y-4">
          <div><label className="label">Name</label><input className="input" value={editName} onChange={e => setEditName(e.target.value)} /></div>
          <div><label className="label">Mode</label><select className="input" value={editMode} onChange={e => setEditMode(e.target.value)}><option value="full">Full</option><option value="incremental">Incremental</option><option value="snapshot">Snapshot</option></select></div>
          <div className="flex justify-end gap-3 pt-2"><button onClick={() => setEditing(null)} className="btn-secondary">Cancel</button><button onClick={handleSaveEdit} className="btn-primary" disabled={!editName.trim()}><Save className="w-3.5 h-3.5" /> Save</button></div>
        </div>
      </Modal>
    </div>
  );
}
