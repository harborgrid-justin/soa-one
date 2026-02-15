import { useEffect, useState } from 'react';
import { Globe, Plus, Trash2, Pencil, Save, Send, Archive, ChevronDown, ChevronRight } from 'lucide-react';
import { getSOAAPIs, createSOAAPI, updateSOAAPI, deleteSOAAPI, publishSOAAPI, deprecateSOAAPI } from '../api/client';
import { Modal } from '../components/common/Modal';
import { useStore } from '../store';

const STATUS_COLORS: Record<string, string> = { published: 'bg-emerald-50 text-emerald-700', draft: 'bg-slate-100 text-slate-500', deprecated: 'bg-amber-50 text-amber-700', retired: 'bg-red-50 text-red-700' };
const API_TYPES = ['REST', 'SOAP', 'GraphQL', 'gRPC', 'WebSocket', 'AsyncAPI'];

export function SOAAPIs() {
  const [apis, setApis] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [editing, setEditing] = useState<any>(null);
  const [newName, setNewName] = useState('');
  const [newVersion, setNewVersion] = useState('1.0.0');
  const [newType, setNewType] = useState('REST');
  const [newDescription, setNewDescription] = useState('');
  const [editName, setEditName] = useState('');
  const [editVersion, setEditVersion] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const { addNotification } = useStore();

  const load = () => { setLoading(true); getSOAAPIs().then(setApis).catch(() => {}).finally(() => setLoading(false)); };
  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    try { await createSOAAPI({ name: newName.trim(), version: newVersion, type: newType, description: newDescription }); addNotification({ type: 'success', message: 'API created' }); setShowCreate(false); setNewName(''); setNewVersion('1.0.0'); setNewType('REST'); setNewDescription(''); load(); } catch { addNotification({ type: 'error', message: 'Failed to create API' }); }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete API "${name}"?`)) return;
    try { await deleteSOAAPI(id); addNotification({ type: 'success', message: 'API deleted' }); load(); } catch { addNotification({ type: 'error', message: 'Failed to delete API' }); }
  };

  const handlePublish = async (id: string) => { try { await publishSOAAPI(id); addNotification({ type: 'success', message: 'API published' }); load(); } catch { addNotification({ type: 'error', message: 'Failed to publish' }); } };
  const handleDeprecate = async (id: string) => { try { await deprecateSOAAPI(id); addNotification({ type: 'success', message: 'API deprecated' }); load(); } catch { addNotification({ type: 'error', message: 'Failed to deprecate' }); } };

  const openEdit = (a: any) => { setEditing(a); setEditName(a.name); setEditVersion(a.version || ''); setEditDescription(a.description || ''); };
  const handleSaveEdit = async () => {
    if (!editing || !editName.trim()) return;
    try { await updateSOAAPI(editing.id, { name: editName.trim(), version: editVersion, description: editDescription }); addNotification({ type: 'success', message: 'API updated' }); setEditing(null); load(); } catch { addNotification({ type: 'error', message: 'Failed to update API' }); }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">Manage API lifecycle, publishing and governance.</p>
        <button onClick={() => setShowCreate(true)} className="btn-primary btn-sm"><Plus className="w-3.5 h-3.5" /> New API</button>
      </div>
      {apis.length > 0 ? (
        <div className="space-y-2">
          {apis.map((a) => (
            <div key={a.id} className="card">
              <div className="px-6 py-4 flex items-center justify-between group">
                <div className="flex items-center gap-4">
                  <button onClick={() => setExpanded(expanded === a.id ? null : a.id)} className="text-slate-400 hover:text-slate-700">{expanded === a.id ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}</button>
                  <div className="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center"><Globe className="w-5 h-5" /></div>
                  <div><div className="font-medium text-slate-900">{a.name} <span className="text-xs text-slate-400">v{a.version || '—'}</span></div><div className="text-xs text-slate-500">{a.type || 'REST'}{a.operationCount != null ? ` · ${a.operationCount} ops` : ''}</div></div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[a.status] || STATUS_COLORS.draft}`}>{a.status || 'draft'}</span>
                  {(!a.status || a.status === 'draft') && <button onClick={() => handlePublish(a.id)} className="btn-secondary btn-sm" title="Publish"><Send className="w-3.5 h-3.5" /></button>}
                  {a.status === 'published' && <button onClick={() => handleDeprecate(a.id)} className="btn-secondary btn-sm" title="Deprecate"><Archive className="w-3.5 h-3.5" /></button>}
                  <button onClick={() => openEdit(a)} className="btn-secondary btn-sm"><Pencil className="w-3.5 h-3.5" /></button>
                  <button onClick={() => handleDelete(a.id, a.name)} className="p-1.5 rounded opacity-0 group-hover:opacity-100 hover:bg-red-50 text-slate-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
              {expanded === a.id && a.description && <div className="border-t border-slate-100 px-6 py-4 text-sm text-slate-600">{a.description}</div>}
            </div>
          ))}
        </div>
      ) : (
        <div className="card p-16 text-center"><Globe className="w-10 h-10 text-slate-300 mx-auto mb-3" /><h3 className="font-semibold text-slate-900 mb-1">No APIs</h3><p className="text-sm text-slate-500 mb-4">Create and publish APIs for consumption.</p><button onClick={() => setShowCreate(true)} className="btn-primary"><Plus className="w-4 h-4" /> Create API</button></div>
      )}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Create API">
        <div className="space-y-4">
          <div><label className="label">Name</label><input className="input" value={newName} onChange={e => setNewName(e.target.value)} autoFocus /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">Version</label><input className="input" value={newVersion} onChange={e => setNewVersion(e.target.value)} /></div>
            <div><label className="label">Type</label><select className="input" value={newType} onChange={e => setNewType(e.target.value)}>{API_TYPES.map(t => <option key={t} value={t}>{t}</option>)}</select></div>
          </div>
          <div><label className="label">Description</label><textarea className="input" rows={2} value={newDescription} onChange={e => setNewDescription(e.target.value)} /></div>
          <div className="flex justify-end gap-3 pt-2"><button onClick={() => setShowCreate(false)} className="btn-secondary">Cancel</button><button onClick={handleCreate} className="btn-primary" disabled={!newName.trim()}>Create</button></div>
        </div>
      </Modal>
      <Modal open={!!editing} onClose={() => setEditing(null)} title="Edit API">
        <div className="space-y-4">
          <div><label className="label">Name</label><input className="input" value={editName} onChange={e => setEditName(e.target.value)} /></div>
          <div><label className="label">Version</label><input className="input" value={editVersion} onChange={e => setEditVersion(e.target.value)} /></div>
          <div><label className="label">Description</label><textarea className="input" rows={2} value={editDescription} onChange={e => setEditDescription(e.target.value)} /></div>
          <div className="flex justify-end gap-3 pt-2"><button onClick={() => setEditing(null)} className="btn-secondary">Cancel</button><button onClick={handleSaveEdit} className="btn-primary" disabled={!editName.trim()}><Save className="w-3.5 h-3.5" /> Save</button></div>
        </div>
      </Modal>
    </div>
  );
}
