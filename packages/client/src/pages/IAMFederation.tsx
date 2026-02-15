import { useEffect, useState } from 'react';
import { Link2, Plus, Trash2, Pencil, Save, ChevronDown, ChevronRight } from 'lucide-react';
import { getIAMProviders, createIAMProvider, updateIAMProvider, deleteIAMProvider } from '../api/client';
import { Modal } from '../components/common/Modal';
import { useStore } from '../store';

const PROVIDER_TYPES = ['SAML', 'OIDC', 'OAuth2', 'LDAP', 'Active Directory', 'Social', 'Custom'];
const STATUS_COLORS: Record<string, string> = { active: 'bg-emerald-50 text-emerald-700', inactive: 'bg-slate-100 text-slate-500', error: 'bg-red-50 text-red-700' };

export function IAMFederation() {
  const [providers, setProviders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [editing, setEditing] = useState<any>(null);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState('SAML');
  const [newIssuer, setNewIssuer] = useState('');
  const [editName, setEditName] = useState('');
  const [editIssuer, setEditIssuer] = useState('');
  const { addNotification } = useStore();

  const load = () => { setLoading(true); getIAMProviders().then(setProviders).catch(() => {}).finally(() => setLoading(false)); };
  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    try { await createIAMProvider({ name: newName.trim(), type: newType, issuer: newIssuer }); addNotification({ type: 'success', message: 'Provider created' }); setShowCreate(false); setNewName(''); setNewType('SAML'); setNewIssuer(''); load(); } catch { addNotification({ type: 'error', message: 'Failed to create provider' }); }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete provider "${name}"?`)) return;
    try { await deleteIAMProvider(id); addNotification({ type: 'success', message: 'Provider deleted' }); load(); } catch { addNotification({ type: 'error', message: 'Failed to delete provider' }); }
  };

  const openEdit = (p: any) => { setEditing(p); setEditName(p.name); setEditIssuer(p.issuer || p.entityId || ''); };
  const handleSaveEdit = async () => {
    if (!editing || !editName.trim()) return;
    try { await updateIAMProvider(editing.id, { name: editName.trim(), issuer: editIssuer }); addNotification({ type: 'success', message: 'Provider updated' }); setEditing(null); load(); } catch { addNotification({ type: 'error', message: 'Failed to update provider' }); }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">Manage federated identity providers for SSO and external authentication.</p>
        <button onClick={() => setShowCreate(true)} className="btn-primary btn-sm"><Plus className="w-3.5 h-3.5" /> New Provider</button>
      </div>
      {providers.length > 0 ? (
        <div className="space-y-2">
          {providers.map((p) => (
            <div key={p.id} className="card">
              <div className="px-6 py-4 flex items-center justify-between group">
                <div className="flex items-center gap-4">
                  <button onClick={() => setExpanded(expanded === p.id ? null : p.id)} className="text-slate-400 hover:text-slate-700">{expanded === p.id ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}</button>
                  <div className="w-10 h-10 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center"><Link2 className="w-5 h-5" /></div>
                  <div><div className="font-medium text-slate-900">{p.name}</div><div className="text-xs text-slate-500">{p.type || p.protocol || '—'}{p.issuer ? ` · ${p.issuer}` : ''}</div></div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[p.status] || STATUS_COLORS.inactive}`}>{p.status || 'inactive'}</span>
                  <button onClick={() => openEdit(p)} className="btn-secondary btn-sm"><Pencil className="w-3.5 h-3.5" /></button>
                  <button onClick={() => handleDelete(p.id, p.name)} className="p-1.5 rounded opacity-0 group-hover:opacity-100 hover:bg-red-50 text-slate-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
              {expanded === p.id && (
                <div className="border-t border-slate-100 px-6 py-4 text-sm text-slate-600 grid grid-cols-2 gap-2">
                  <div><span className="text-slate-400">Entity ID:</span> {p.entityId || p.issuer || '—'}</div>
                  <div><span className="text-slate-400">SSO URL:</span> {p.ssoUrl || '—'}</div>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="card p-16 text-center"><Link2 className="w-10 h-10 text-slate-300 mx-auto mb-3" /><h3 className="font-semibold text-slate-900 mb-1">No providers</h3><p className="text-sm text-slate-500 mb-4">Configure identity providers for federation.</p><button onClick={() => setShowCreate(true)} className="btn-primary"><Plus className="w-4 h-4" /> Create Provider</button></div>
      )}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Create Provider">
        <div className="space-y-4">
          <div><label className="label">Name</label><input className="input" value={newName} onChange={e => setNewName(e.target.value)} autoFocus /></div>
          <div><label className="label">Protocol</label><select className="input" value={newType} onChange={e => setNewType(e.target.value)}>{PROVIDER_TYPES.map(t => <option key={t} value={t}>{t}</option>)}</select></div>
          <div><label className="label">Issuer / Entity ID</label><input className="input" value={newIssuer} onChange={e => setNewIssuer(e.target.value)} placeholder="https://idp.example.com" /></div>
          <div className="flex justify-end gap-3 pt-2"><button onClick={() => setShowCreate(false)} className="btn-secondary">Cancel</button><button onClick={handleCreate} className="btn-primary" disabled={!newName.trim()}>Create</button></div>
        </div>
      </Modal>
      <Modal open={!!editing} onClose={() => setEditing(null)} title="Edit Provider">
        <div className="space-y-4">
          <div><label className="label">Name</label><input className="input" value={editName} onChange={e => setEditName(e.target.value)} /></div>
          <div><label className="label">Issuer / Entity ID</label><input className="input" value={editIssuer} onChange={e => setEditIssuer(e.target.value)} /></div>
          <div className="flex justify-end gap-3 pt-2"><button onClick={() => setEditing(null)} className="btn-secondary">Cancel</button><button onClick={handleSaveEdit} className="btn-primary" disabled={!editName.trim()}><Save className="w-3.5 h-3.5" /> Save</button></div>
        </div>
      </Modal>
    </div>
  );
}
