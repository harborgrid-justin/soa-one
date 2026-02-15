import { useEffect, useState } from 'react';
import { Users, Plus, Trash2, Pencil, Save, Power, Lock, Unlock, ChevronDown, ChevronRight } from 'lucide-react';
import { getIAMIdentities, createIAMIdentity, updateIAMIdentity, deleteIAMIdentity, activateIAMIdentity, suspendIAMIdentity, lockIAMIdentity, unlockIAMIdentity } from '../api/client';
import { Modal } from '../components/common/Modal';
import { useStore } from '../store';

const STATUS_COLORS: Record<string, string> = { active: 'bg-emerald-50 text-emerald-700', suspended: 'bg-amber-50 text-amber-700', locked: 'bg-red-50 text-red-700', inactive: 'bg-slate-100 text-slate-500', provisioned: 'bg-blue-50 text-blue-700' };
const IDENTITY_TYPES = ['user', 'service', 'device', 'application', 'group'];

export function IAMIdentities() {
  const [identities, setIdentities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [editing, setEditing] = useState<any>(null);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState('user');
  const [newEmail, setNewEmail] = useState('');
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const { addNotification } = useStore();

  const load = () => { setLoading(true); getIAMIdentities().then(setIdentities).catch(() => {}).finally(() => setLoading(false)); };
  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    try { await createIAMIdentity({ name: newName.trim(), type: newType, email: newEmail }); addNotification({ type: 'success', message: 'Identity created' }); setShowCreate(false); setNewName(''); setNewType('user'); setNewEmail(''); load(); } catch { addNotification({ type: 'error', message: 'Failed to create identity' }); }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete identity "${name}"?`)) return;
    try { await deleteIAMIdentity(id); addNotification({ type: 'success', message: 'Identity deleted' }); load(); } catch { addNotification({ type: 'error', message: 'Failed to delete identity' }); }
  };

  const lifecycle = async (action: string, id: string, fn: (id: string) => Promise<any>) => {
    try { await fn(id); addNotification({ type: 'success', message: `Identity ${action}` }); load(); } catch { addNotification({ type: 'error', message: `Failed to ${action}` }); }
  };

  const openEdit = (i: any) => { setEditing(i); setEditName(i.name); setEditEmail(i.email || ''); };
  const handleSaveEdit = async () => {
    if (!editing || !editName.trim()) return;
    try { await updateIAMIdentity(editing.id, { name: editName.trim(), email: editEmail }); addNotification({ type: 'success', message: 'Identity updated' }); setEditing(null); load(); } catch { addNotification({ type: 'error', message: 'Failed to update identity' }); }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">Manage user identities and lifecycle operations.</p>
        <button onClick={() => setShowCreate(true)} className="btn-primary btn-sm"><Plus className="w-3.5 h-3.5" /> New Identity</button>
      </div>
      {identities.length > 0 ? (
        <div className="space-y-2">
          {identities.map((i) => (
            <div key={i.id} className="card">
              <div className="px-6 py-4 flex items-center justify-between group">
                <div className="flex items-center gap-4">
                  <button onClick={() => setExpanded(expanded === i.id ? null : i.id)} className="text-slate-400 hover:text-slate-700">{expanded === i.id ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}</button>
                  <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center"><Users className="w-5 h-5" /></div>
                  <div><div className="font-medium text-slate-900">{i.name}</div><div className="text-xs text-slate-500">{i.type || 'user'}{i.email ? ` · ${i.email}` : ''}{i.roleCount != null ? ` · ${i.roleCount} roles` : ''}</div></div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[i.status] || STATUS_COLORS.inactive}`}>{i.status || 'inactive'}</span>
                  {i.status !== 'active' && <button onClick={() => lifecycle('activated', i.id, activateIAMIdentity)} className="btn-secondary btn-sm" title="Activate"><Power className="w-3.5 h-3.5 text-emerald-600" /></button>}
                  {i.status === 'active' && <button onClick={() => lifecycle('suspended', i.id, suspendIAMIdentity)} className="btn-secondary btn-sm" title="Suspend"><Power className="w-3.5 h-3.5 text-amber-600" /></button>}
                  {i.status !== 'locked' && <button onClick={() => lifecycle('locked', i.id, lockIAMIdentity)} className="btn-secondary btn-sm" title="Lock"><Lock className="w-3.5 h-3.5" /></button>}
                  {i.status === 'locked' && <button onClick={() => lifecycle('unlocked', i.id, unlockIAMIdentity)} className="btn-secondary btn-sm" title="Unlock"><Unlock className="w-3.5 h-3.5" /></button>}
                  <button onClick={() => openEdit(i)} className="btn-secondary btn-sm"><Pencil className="w-3.5 h-3.5" /></button>
                  <button onClick={() => handleDelete(i.id, i.name)} className="p-1.5 rounded opacity-0 group-hover:opacity-100 hover:bg-red-50 text-slate-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
              {expanded === i.id && (
                <div className="border-t border-slate-100 px-6 py-4 text-sm text-slate-600 grid grid-cols-2 gap-2">
                  <div><span className="text-slate-400">Created:</span> {i.createdAt ? new Date(i.createdAt).toLocaleString() : '—'}</div>
                  <div><span className="text-slate-400">Last Login:</span> {i.lastLogin ? new Date(i.lastLogin).toLocaleString() : 'Never'}</div>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="card p-16 text-center"><Users className="w-10 h-10 text-slate-300 mx-auto mb-3" /><h3 className="font-semibold text-slate-900 mb-1">No identities</h3><p className="text-sm text-slate-500 mb-4">Create user and service identities.</p><button onClick={() => setShowCreate(true)} className="btn-primary"><Plus className="w-4 h-4" /> Create Identity</button></div>
      )}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Create Identity">
        <div className="space-y-4">
          <div><label className="label">Name</label><input className="input" value={newName} onChange={e => setNewName(e.target.value)} autoFocus /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">Type</label><select className="input" value={newType} onChange={e => setNewType(e.target.value)}>{IDENTITY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}</select></div>
            <div><label className="label">Email</label><input className="input" type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} /></div>
          </div>
          <div className="flex justify-end gap-3 pt-2"><button onClick={() => setShowCreate(false)} className="btn-secondary">Cancel</button><button onClick={handleCreate} className="btn-primary" disabled={!newName.trim()}>Create</button></div>
        </div>
      </Modal>
      <Modal open={!!editing} onClose={() => setEditing(null)} title="Edit Identity">
        <div className="space-y-4">
          <div><label className="label">Name</label><input className="input" value={editName} onChange={e => setEditName(e.target.value)} /></div>
          <div><label className="label">Email</label><input className="input" type="email" value={editEmail} onChange={e => setEditEmail(e.target.value)} /></div>
          <div className="flex justify-end gap-3 pt-2"><button onClick={() => setEditing(null)} className="btn-secondary">Cancel</button><button onClick={handleSaveEdit} className="btn-primary" disabled={!editName.trim()}><Save className="w-3.5 h-3.5" /> Save</button></div>
        </div>
      </Modal>
    </div>
  );
}
