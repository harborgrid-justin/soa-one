import { useEffect, useState } from 'react';
import { Network, Plus, Trash2, Pencil, Save, Power } from 'lucide-react';
import { getSOAProxies, createSOAProxy, updateSOAProxy, deleteSOAProxy } from '../api/client';
import { Modal } from '../components/common/Modal';
import { useStore } from '../store';

const STATUS_COLORS: Record<string, string> = { healthy: 'bg-emerald-50 text-emerald-700', degraded: 'bg-amber-50 text-amber-700', down: 'bg-red-50 text-red-700', unknown: 'bg-slate-100 text-slate-500' };
const PROXY_TYPES = ['sidecar', 'ingress', 'egress', 'gateway', 'load-balancer'];

export function SOAMesh() {
  const [proxies, setProxies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState('sidecar');
  const [newTarget, setNewTarget] = useState('');
  const [editName, setEditName] = useState('');
  const [editTarget, setEditTarget] = useState('');
  const { addNotification } = useStore();

  const load = () => { setLoading(true); getSOAProxies().then(setProxies).catch(() => {}).finally(() => setLoading(false)); };
  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    try { await createSOAProxy({ name: newName.trim(), type: newType, target: newTarget }); addNotification({ type: 'success', message: 'Proxy created' }); setShowCreate(false); setNewName(''); setNewType('sidecar'); setNewTarget(''); load(); } catch { addNotification({ type: 'error', message: 'Failed to create proxy' }); }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete proxy "${name}"?`)) return;
    try { await deleteSOAProxy(id); addNotification({ type: 'success', message: 'Proxy deleted' }); load(); } catch { addNotification({ type: 'error', message: 'Failed to delete proxy' }); }
  };

  const handleToggle = async (p: any) => {
    try { await updateSOAProxy(p.id, { enabled: !p.enabled }); addNotification({ type: 'success', message: `Proxy ${p.enabled ? 'disabled' : 'enabled'}` }); load(); } catch { addNotification({ type: 'error', message: 'Failed to toggle proxy' }); }
  };

  const openEdit = (p: any) => { setEditing(p); setEditName(p.name); setEditTarget(p.target || ''); };
  const handleSaveEdit = async () => {
    if (!editing || !editName.trim()) return;
    try { await updateSOAProxy(editing.id, { name: editName.trim(), target: editTarget }); addNotification({ type: 'success', message: 'Proxy updated' }); setEditing(null); load(); } catch { addNotification({ type: 'error', message: 'Failed to update proxy' }); }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">Manage service mesh sidecar proxies and traffic routing.</p>
        <button onClick={() => setShowCreate(true)} className="btn-primary btn-sm"><Plus className="w-3.5 h-3.5" /> New Proxy</button>
      </div>
      {proxies.length > 0 ? (
        <div className="space-y-2">
          {proxies.map((p) => (
            <div key={p.id} className="card px-6 py-4 flex items-center justify-between group">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-cyan-50 text-cyan-600 flex items-center justify-center"><Network className="w-5 h-5" /></div>
                <div><div className="font-medium text-slate-900">{p.name}</div><div className="text-xs text-slate-500">{p.type || 'sidecar'}{p.target ? ` → ${p.target}` : ''}{p.requestCount != null ? ` · ${p.requestCount} reqs` : ''}</div></div>
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[p.status] || STATUS_COLORS.unknown}`}>{p.status || 'unknown'}</span>
                <button onClick={() => handleToggle(p)} className="btn-secondary btn-sm"><Power className="w-3.5 h-3.5" /></button>
                <button onClick={() => openEdit(p)} className="btn-secondary btn-sm"><Pencil className="w-3.5 h-3.5" /></button>
                <button onClick={() => handleDelete(p.id, p.name)} className="p-1.5 rounded opacity-0 group-hover:opacity-100 hover:bg-red-50 text-slate-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="card p-16 text-center"><Network className="w-10 h-10 text-slate-300 mx-auto mb-3" /><h3 className="font-semibold text-slate-900 mb-1">No proxies</h3><p className="text-sm text-slate-500 mb-4">Deploy service mesh sidecar proxies.</p><button onClick={() => setShowCreate(true)} className="btn-primary"><Plus className="w-4 h-4" /> Create Proxy</button></div>
      )}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Create Proxy">
        <div className="space-y-4">
          <div><label className="label">Name</label><input className="input" value={newName} onChange={e => setNewName(e.target.value)} autoFocus /></div>
          <div><label className="label">Type</label><select className="input" value={newType} onChange={e => setNewType(e.target.value)}>{PROXY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}</select></div>
          <div><label className="label">Target Service</label><input className="input" value={newTarget} onChange={e => setNewTarget(e.target.value)} placeholder="service:port" /></div>
          <div className="flex justify-end gap-3 pt-2"><button onClick={() => setShowCreate(false)} className="btn-secondary">Cancel</button><button onClick={handleCreate} className="btn-primary" disabled={!newName.trim()}>Create</button></div>
        </div>
      </Modal>
      <Modal open={!!editing} onClose={() => setEditing(null)} title="Edit Proxy">
        <div className="space-y-4">
          <div><label className="label">Name</label><input className="input" value={editName} onChange={e => setEditName(e.target.value)} /></div>
          <div><label className="label">Target Service</label><input className="input" value={editTarget} onChange={e => setEditTarget(e.target.value)} /></div>
          <div className="flex justify-end gap-3 pt-2"><button onClick={() => setEditing(null)} className="btn-secondary">Cancel</button><button onClick={handleSaveEdit} className="btn-primary" disabled={!editName.trim()}><Save className="w-3.5 h-3.5" /> Save</button></div>
        </div>
      </Modal>
    </div>
  );
}
