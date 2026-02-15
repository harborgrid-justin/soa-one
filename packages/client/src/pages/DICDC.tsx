import { useEffect, useState } from 'react';
import { Radio, Plus, Trash2, Pencil, Save, ChevronDown, ChevronRight } from 'lucide-react';
import { getDICDCStreams, createDICDCStream, updateDICDCStream, deleteDICDCStream } from '../api/client';
import { Modal } from '../components/common/Modal';
import { useStore } from '../store';

const STATUS_COLORS: Record<string, string> = { streaming: 'bg-emerald-50 text-emerald-700', idle: 'bg-slate-100 text-slate-500', paused: 'bg-amber-50 text-amber-700', error: 'bg-red-50 text-red-700' };
const CAPTURE_METHODS = ['log-based', 'trigger-based', 'timestamp-based', 'hybrid'];

export function DICDC() {
  const [streams, setStreams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [editing, setEditing] = useState<any>(null);
  const [newName, setNewName] = useState('');
  const [newMethod, setNewMethod] = useState('log-based');
  const [editName, setEditName] = useState('');
  const [editMethod, setEditMethod] = useState('');
  const { addNotification } = useStore();

  const load = () => { setLoading(true); getDICDCStreams().then(setStreams).catch(() => {}).finally(() => setLoading(false)); };
  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    try { await createDICDCStream({ name: newName.trim(), captureMethod: newMethod }); addNotification({ type: 'success', message: 'CDC stream created' }); setShowCreate(false); setNewName(''); setNewMethod('log-based'); load(); } catch { addNotification({ type: 'error', message: 'Failed to create CDC stream' }); }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete CDC stream "${name}"?`)) return;
    try { await deleteDICDCStream(id); addNotification({ type: 'success', message: 'CDC stream deleted' }); load(); } catch { addNotification({ type: 'error', message: 'Failed to delete stream' }); }
  };

  const openEdit = (s: any) => { setEditing(s); setEditName(s.name); setEditMethod(s.captureMethod || 'log-based'); };
  const handleSaveEdit = async () => {
    if (!editing || !editName.trim()) return;
    try { await updateDICDCStream(editing.streamId || editing.id, { name: editName.trim(), captureMethod: editMethod }); addNotification({ type: 'success', message: 'CDC stream updated' }); setEditing(null); load(); } catch { addNotification({ type: 'error', message: 'Failed to update stream' }); }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">Monitor and manage Change Data Capture streams.</p>
        <button onClick={() => setShowCreate(true)} className="btn-primary btn-sm"><Plus className="w-3.5 h-3.5" /> New CDC Stream</button>
      </div>
      {streams.length > 0 ? (
        <div className="space-y-2">
          {streams.map((s) => (
            <div key={s.streamId || s.id} className="card">
              <div className="px-6 py-4 flex items-center justify-between group">
                <div className="flex items-center gap-4">
                  <button onClick={() => setExpanded(expanded === (s.streamId || s.id) ? null : (s.streamId || s.id))} className="text-slate-400 hover:text-slate-700">{expanded === (s.streamId || s.id) ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}</button>
                  <div className="w-10 h-10 rounded-lg bg-green-50 text-green-600 flex items-center justify-center"><Radio className="w-5 h-5" /></div>
                  <div><div className="font-medium text-slate-900">{s.name}</div><div className="text-xs text-slate-500">{s.captureMethod} · {(s.eventsProcessed ?? 0).toLocaleString()} events processed</div></div>
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
                  <div><span className="text-slate-400">Events:</span> {(s.eventsProcessed ?? 0).toLocaleString()}</div>
                  <div><span className="text-slate-400">Method:</span> {s.captureMethod}</div>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="card p-16 text-center"><Radio className="w-10 h-10 text-slate-300 mx-auto mb-3" /><h3 className="font-semibold text-slate-900 mb-1">No CDC streams</h3><p className="text-sm text-slate-500 mb-4">Create a CDC stream to capture data changes.</p><button onClick={() => setShowCreate(true)} className="btn-primary"><Plus className="w-4 h-4" /> Create Stream</button></div>
      )}

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Create CDC Stream">
        <div className="space-y-4">
          <div><label className="label">Name</label><input className="input" placeholder="e.g., orders-cdc" value={newName} onChange={e => setNewName(e.target.value)} autoFocus /></div>
          <div><label className="label">Capture Method</label><select className="input" value={newMethod} onChange={e => setNewMethod(e.target.value)}>{CAPTURE_METHODS.map(m => <option key={m} value={m}>{m}</option>)}</select></div>
          <div className="flex justify-end gap-3 pt-2"><button onClick={() => setShowCreate(false)} className="btn-secondary">Cancel</button><button onClick={handleCreate} className="btn-primary" disabled={!newName.trim()}>Create</button></div>
        </div>
      </Modal>

      <Modal open={!!editing} onClose={() => setEditing(null)} title="Edit CDC Stream">
        <div className="space-y-4">
          <div><label className="label">Name</label><input className="input" value={editName} onChange={e => setEditName(e.target.value)} /></div>
          <div><label className="label">Capture Method</label><select className="input" value={editMethod} onChange={e => setEditMethod(e.target.value)}>{CAPTURE_METHODS.map(m => <option key={m} value={m}>{m}</option>)}</select></div>
          <div className="flex justify-end gap-3 pt-2"><button onClick={() => setEditing(null)} className="btn-secondary">Cancel</button><button onClick={handleSaveEdit} className="btn-primary" disabled={!editName.trim()}><Save className="w-3.5 h-3.5" /> Save</button></div>
        </div>
      </Modal>
    </div>
  );
}
