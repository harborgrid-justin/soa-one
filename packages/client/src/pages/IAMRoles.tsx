import { useEffect, useState } from 'react';
import { ShieldCheck, Plus, Trash2, Pencil, Save, ChevronDown, ChevronRight } from 'lucide-react';
import { getIAMRoles, createIAMRole, updateIAMRole, deleteIAMRole } from '../api/client';
import { Modal } from '../components/common/Modal';
import { useStore } from '../store';

const ROLE_TYPES = ['standard', 'admin', 'service', 'composite', 'temporary'];

export function IAMRoles() {
  const [roles, setRoles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [editing, setEditing] = useState<any>(null);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState('standard');
  const [newDescription, setNewDescription] = useState('');
  const [newPermissions, setNewPermissions] = useState('');
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editPermissions, setEditPermissions] = useState('');
  const { addNotification } = useStore();

  const load = () => { setLoading(true); getIAMRoles().then(setRoles).catch(() => {}).finally(() => setLoading(false)); };
  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    const perms = newPermissions.split(',').map(p => p.trim()).filter(Boolean);
    try { await createIAMRole({ name: newName.trim(), type: newType, description: newDescription, permissions: perms.length ? perms : undefined }); addNotification({ type: 'success', message: 'Role created' }); setShowCreate(false); setNewName(''); setNewType('standard'); setNewDescription(''); setNewPermissions(''); load(); } catch { addNotification({ type: 'error', message: 'Failed to create role' }); }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete role "${name}"?`)) return;
    try { await deleteIAMRole(id); addNotification({ type: 'success', message: 'Role deleted' }); load(); } catch { addNotification({ type: 'error', message: 'Failed to delete role' }); }
  };

  const openEdit = (r: any) => { setEditing(r); setEditName(r.name); setEditDescription(r.description || ''); setEditPermissions(Array.isArray(r.permissions) ? r.permissions.join(', ') : ''); };
  const handleSaveEdit = async () => {
    if (!editing || !editName.trim()) return;
    const perms = editPermissions.split(',').map(p => p.trim()).filter(Boolean);
    try { await updateIAMRole(editing.id, { name: editName.trim(), description: editDescription, permissions: perms.length ? perms : undefined }); addNotification({ type: 'success', message: 'Role updated' }); setEditing(null); load(); } catch { addNotification({ type: 'error', message: 'Failed to update role' }); }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">Manage roles and permissions assignments.</p>
        <button onClick={() => setShowCreate(true)} className="btn-primary btn-sm"><Plus className="w-3.5 h-3.5" /> New Role</button>
      </div>
      {roles.length > 0 ? (
        <div className="space-y-2">
          {roles.map((r) => (
            <div key={r.id} className="card">
              <div className="px-6 py-4 flex items-center justify-between group">
                <div className="flex items-center gap-4">
                  <button onClick={() => setExpanded(expanded === r.id ? null : r.id)} className="text-slate-400 hover:text-slate-700">{expanded === r.id ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}</button>
                  <div className="w-10 h-10 rounded-lg bg-violet-50 text-violet-600 flex items-center justify-center"><ShieldCheck className="w-5 h-5" /></div>
                  <div><div className="font-medium text-slate-900">{r.name}</div><div className="text-xs text-slate-500">{r.type || 'standard'}{r.memberCount != null ? ` · ${r.memberCount} members` : ''}{r.permissionCount != null ? ` · ${r.permissionCount} perms` : ''}</div></div>
                </div>
                <div className="flex items-center gap-3">
                  <button onClick={() => openEdit(r)} className="btn-secondary btn-sm"><Pencil className="w-3.5 h-3.5" /></button>
                  <button onClick={() => handleDelete(r.id, r.name)} className="p-1.5 rounded opacity-0 group-hover:opacity-100 hover:bg-red-50 text-slate-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
              {expanded === r.id && (
                <div className="border-t border-slate-100 px-6 py-4 text-sm text-slate-600">
                  {r.description && <p className="mb-2">{r.description}</p>}
                  {Array.isArray(r.permissions) && r.permissions.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">{r.permissions.map((p: string) => <span key={p} className="text-xs px-2 py-0.5 bg-violet-50 text-violet-700 rounded">{p}</span>)}</div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="card p-16 text-center"><ShieldCheck className="w-10 h-10 text-slate-300 mx-auto mb-3" /><h3 className="font-semibold text-slate-900 mb-1">No roles</h3><p className="text-sm text-slate-500 mb-4">Create roles for access control.</p><button onClick={() => setShowCreate(true)} className="btn-primary"><Plus className="w-4 h-4" /> Create Role</button></div>
      )}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Create Role">
        <div className="space-y-4">
          <div><label className="label">Name</label><input className="input" value={newName} onChange={e => setNewName(e.target.value)} autoFocus /></div>
          <div><label className="label">Type</label><select className="input" value={newType} onChange={e => setNewType(e.target.value)}>{ROLE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}</select></div>
          <div><label className="label">Description</label><textarea className="input" rows={2} value={newDescription} onChange={e => setNewDescription(e.target.value)} /></div>
          <div><label className="label">Permissions (comma-separated)</label><input className="input" value={newPermissions} onChange={e => setNewPermissions(e.target.value)} placeholder="read, write, admin" /></div>
          <div className="flex justify-end gap-3 pt-2"><button onClick={() => setShowCreate(false)} className="btn-secondary">Cancel</button><button onClick={handleCreate} className="btn-primary" disabled={!newName.trim()}>Create</button></div>
        </div>
      </Modal>
      <Modal open={!!editing} onClose={() => setEditing(null)} title="Edit Role">
        <div className="space-y-4">
          <div><label className="label">Name</label><input className="input" value={editName} onChange={e => setEditName(e.target.value)} /></div>
          <div><label className="label">Description</label><textarea className="input" rows={2} value={editDescription} onChange={e => setEditDescription(e.target.value)} /></div>
          <div><label className="label">Permissions (comma-separated)</label><input className="input" value={editPermissions} onChange={e => setEditPermissions(e.target.value)} /></div>
          <div className="flex justify-end gap-3 pt-2"><button onClick={() => setEditing(null)} className="btn-secondary">Cancel</button><button onClick={handleSaveEdit} className="btn-primary" disabled={!editName.trim()}><Save className="w-3.5 h-3.5" /> Save</button></div>
        </div>
      </Modal>
    </div>
  );
}
