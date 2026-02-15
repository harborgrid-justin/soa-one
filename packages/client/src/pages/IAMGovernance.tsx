import { useEffect, useState } from 'react';
import { Scale, Plus, Trash2, Pencil, Save, ClipboardList, Shield, FileText, ChevronDown, ChevronRight } from 'lucide-react';
import { getIAMCampaigns, createIAMCampaign, updateIAMCampaign, deleteIAMCampaign, getIAMSoDPolicies, createIAMSoDPolicy, updateIAMSoDPolicy, deleteIAMSoDPolicy, getIAMAccessRequests, createIAMAccessRequest, updateIAMAccessRequest, deleteIAMAccessRequest } from '../api/client';
import { Modal } from '../components/common/Modal';
import { useStore } from '../store';

const STATUS_COLORS: Record<string, string> = { active: 'bg-emerald-50 text-emerald-700', draft: 'bg-slate-100 text-slate-500', pending: 'bg-amber-50 text-amber-700', completed: 'bg-blue-50 text-blue-700', approved: 'bg-emerald-50 text-emerald-700', denied: 'bg-red-50 text-red-700' };
type Tab = 'campaigns' | 'sod' | 'requests';

export function IAMGovernance() {
  const [tab, setTab] = useState<Tab>('campaigns');
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [sodPolicies, setSodPolicies] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [editing, setEditing] = useState<any>(null);
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const { addNotification } = useStore();

  const load = () => {
    setLoading(true);
    Promise.all([getIAMCampaigns().catch(() => []), getIAMSoDPolicies().catch(() => []), getIAMAccessRequests().catch(() => [])]).then(([c, s, r]) => { setCampaigns(c); setSodPolicies(s); setRequests(r); }).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const items = tab === 'campaigns' ? campaigns : tab === 'sod' ? sodPolicies : requests;
  const labels: Record<Tab, string> = { campaigns: 'Campaign', sod: 'SoD Policy', requests: 'Access Request' };

  const handleCreate = async () => {
    if (!formName.trim()) return;
    try {
      if (tab === 'campaigns') await createIAMCampaign({ name: formName.trim(), description: formDescription });
      else if (tab === 'sod') await createIAMSoDPolicy({ name: formName.trim(), description: formDescription });
      else await createIAMAccessRequest({ name: formName.trim(), description: formDescription });
      addNotification({ type: 'success', message: `${labels[tab]} created` }); setShowCreate(false); setFormName(''); setFormDescription(''); load();
    } catch { addNotification({ type: 'error', message: 'Failed to create' }); }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}"?`)) return;
    try {
      if (tab === 'campaigns') await deleteIAMCampaign(id);
      else if (tab === 'sod') await deleteIAMSoDPolicy(id);
      else await deleteIAMAccessRequest(id);
      addNotification({ type: 'success', message: 'Deleted' }); load();
    } catch { addNotification({ type: 'error', message: 'Failed to delete' }); }
  };

  const openEdit = (item: any) => { setEditing(item); setFormName(item.name); setFormDescription(item.description || ''); };
  const handleSaveEdit = async () => {
    if (!editing || !formName.trim()) return;
    try {
      if (tab === 'campaigns') await updateIAMCampaign(editing.id, { name: formName.trim(), description: formDescription });
      else if (tab === 'sod') await updateIAMSoDPolicy(editing.id, { name: formName.trim(), description: formDescription });
      else await updateIAMAccessRequest(editing.id, { name: formName.trim(), description: formDescription });
      addNotification({ type: 'success', message: 'Updated' }); setEditing(null); load();
    } catch { addNotification({ type: 'error', message: 'Failed to update' }); }
  };

  const Icons: Record<Tab, typeof Scale> = { campaigns: ClipboardList, sod: Shield, requests: FileText };
  const Icon = Icons[tab];

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {(['campaigns', 'sod', 'requests'] as Tab[]).map(t => (
            <button key={t} onClick={() => setTab(t)} className={`px-3 py-1.5 text-sm rounded-lg ${tab === t ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>{labels[t]}s</button>
          ))}
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary btn-sm"><Plus className="w-3.5 h-3.5" /> New {labels[tab]}</button>
      </div>
      {items.length > 0 ? (
        <div className="space-y-2">
          {items.map((item) => (
            <div key={item.id} className="card">
              <div className="px-6 py-4 flex items-center justify-between group">
                <div className="flex items-center gap-4">
                  <button onClick={() => setExpanded(expanded === item.id ? null : item.id)} className="text-slate-400 hover:text-slate-700">{expanded === item.id ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}</button>
                  <div className="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center"><Icon className="w-5 h-5" /></div>
                  <div><div className="font-medium text-slate-900">{item.name}</div><div className="text-xs text-slate-500">{item.type || labels[tab]}{item.requestor ? ` · ${item.requestor}` : ''}</div></div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[item.status] || STATUS_COLORS.draft}`}>{item.status || 'draft'}</span>
                  <button onClick={() => openEdit(item)} className="btn-secondary btn-sm"><Pencil className="w-3.5 h-3.5" /></button>
                  <button onClick={() => handleDelete(item.id, item.name)} className="p-1.5 rounded opacity-0 group-hover:opacity-100 hover:bg-red-50 text-slate-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
              {expanded === item.id && item.description && <div className="border-t border-slate-100 px-6 py-4 text-sm text-slate-600">{item.description}</div>}
            </div>
          ))}
        </div>
      ) : (
        <div className="card p-16 text-center"><Icon className="w-10 h-10 text-slate-300 mx-auto mb-3" /><h3 className="font-semibold text-slate-900 mb-1">No {labels[tab].toLowerCase()}s</h3><p className="text-sm text-slate-500 mb-4">Create governance {labels[tab].toLowerCase()}s.</p><button onClick={() => setShowCreate(true)} className="btn-primary"><Plus className="w-4 h-4" /> Create</button></div>
      )}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title={`Create ${labels[tab]}`}>
        <div className="space-y-4">
          <div><label className="label">Name</label><input className="input" value={formName} onChange={e => setFormName(e.target.value)} autoFocus /></div>
          <div><label className="label">Description</label><textarea className="input" rows={2} value={formDescription} onChange={e => setFormDescription(e.target.value)} /></div>
          <div className="flex justify-end gap-3 pt-2"><button onClick={() => setShowCreate(false)} className="btn-secondary">Cancel</button><button onClick={handleCreate} className="btn-primary" disabled={!formName.trim()}>Create</button></div>
        </div>
      </Modal>
      <Modal open={!!editing} onClose={() => setEditing(null)} title={`Edit ${labels[tab]}`}>
        <div className="space-y-4">
          <div><label className="label">Name</label><input className="input" value={formName} onChange={e => setFormName(e.target.value)} /></div>
          <div><label className="label">Description</label><textarea className="input" rows={2} value={formDescription} onChange={e => setFormDescription(e.target.value)} /></div>
          <div className="flex justify-end gap-3 pt-2"><button onClick={() => setEditing(null)} className="btn-secondary">Cancel</button><button onClick={handleSaveEdit} className="btn-primary" disabled={!formName.trim()}><Save className="w-3.5 h-3.5" /> Save</button></div>
        </div>
      </Modal>
    </div>
  );
}
