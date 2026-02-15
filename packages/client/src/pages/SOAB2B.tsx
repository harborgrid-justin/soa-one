import { useEffect, useState } from 'react';
import { Building2, Plus, Trash2, Pencil, Save, FileText, ChevronDown, ChevronRight } from 'lucide-react';
import { getSOAPartners, createSOAPartner, updateSOAPartner, deleteSOAPartner, getSOAAgreements, createSOAAgreement, updateSOAAgreement, deleteSOAAgreement } from '../api/client';
import { Modal } from '../components/common/Modal';
import { useStore } from '../store';

const STATUS_COLORS: Record<string, string> = { active: 'bg-emerald-50 text-emerald-700', inactive: 'bg-slate-100 text-slate-500', pending: 'bg-amber-50 text-amber-700', suspended: 'bg-red-50 text-red-700' };
const PROTOCOLS = ['AS2', 'SFTP', 'HTTPS', 'EDI/X12', 'EDIFACT', 'ebXML', 'RosettaNet'];

export function SOAB2B() {
  const [tab, setTab] = useState<'partners' | 'agreements'>('partners');
  const [partners, setPartners] = useState<any[]>([]);
  const [agreements, setAgreements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [editing, setEditing] = useState<any>(null);
  const [formName, setFormName] = useState('');
  const [formProtocol, setFormProtocol] = useState('AS2');
  const [formDescription, setFormDescription] = useState('');
  const { addNotification } = useStore();

  const load = () => {
    setLoading(true);
    Promise.all([getSOAPartners(), getSOAAgreements().catch(() => [])]).then(([p, a]) => { setPartners(p); setAgreements(a); }).catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    if (!formName.trim()) return;
    try {
      if (tab === 'partners') { await createSOAPartner({ name: formName.trim(), protocol: formProtocol, description: formDescription }); }
      else { await createSOAAgreement({ name: formName.trim(), type: formProtocol, description: formDescription }); }
      addNotification({ type: 'success', message: `${tab === 'partners' ? 'Partner' : 'Agreement'} created` });
      setShowCreate(false); setFormName(''); setFormProtocol('AS2'); setFormDescription(''); load();
    } catch { addNotification({ type: 'error', message: 'Failed to create' }); }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}"?`)) return;
    try {
      if (tab === 'partners') { await deleteSOAPartner(id); } else { await deleteSOAAgreement(id); }
      addNotification({ type: 'success', message: 'Deleted' }); load();
    } catch { addNotification({ type: 'error', message: 'Failed to delete' }); }
  };

  const openEdit = (item: any) => { setEditing(item); setFormName(item.name); setFormProtocol(item.protocol || item.type || 'AS2'); setFormDescription(item.description || ''); };
  const handleSaveEdit = async () => {
    if (!editing || !formName.trim()) return;
    try {
      if (tab === 'partners') { await updateSOAPartner(editing.id, { name: formName.trim(), protocol: formProtocol, description: formDescription }); }
      else { await updateSOAAgreement(editing.id, { name: formName.trim(), type: formProtocol, description: formDescription }); }
      addNotification({ type: 'success', message: 'Updated' }); setEditing(null); load();
    } catch { addNotification({ type: 'error', message: 'Failed to update' }); }
  };

  const items = tab === 'partners' ? partners : agreements;
  const icon = tab === 'partners' ? Building2 : FileText;
  const Icon = icon;

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button onClick={() => setTab('partners')} className={`px-3 py-1.5 text-sm rounded-lg ${tab === 'partners' ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>Partners</button>
          <button onClick={() => setTab('agreements')} className={`px-3 py-1.5 text-sm rounded-lg ${tab === 'agreements' ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>Agreements</button>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary btn-sm"><Plus className="w-3.5 h-3.5" /> New {tab === 'partners' ? 'Partner' : 'Agreement'}</button>
      </div>
      {items.length > 0 ? (
        <div className="space-y-2">
          {items.map((item) => (
            <div key={item.id} className="card">
              <div className="px-6 py-4 flex items-center justify-between group">
                <div className="flex items-center gap-4">
                  <button onClick={() => setExpanded(expanded === item.id ? null : item.id)} className="text-slate-400 hover:text-slate-700">{expanded === item.id ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}</button>
                  <div className="w-10 h-10 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center"><Icon className="w-5 h-5" /></div>
                  <div><div className="font-medium text-slate-900">{item.name}</div><div className="text-xs text-slate-500">{item.protocol || item.type || '—'}{item.exchangeCount != null ? ` · ${item.exchangeCount} exchanges` : ''}</div></div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[item.status] || STATUS_COLORS.inactive}`}>{item.status || 'inactive'}</span>
                  <button onClick={() => openEdit(item)} className="btn-secondary btn-sm"><Pencil className="w-3.5 h-3.5" /></button>
                  <button onClick={() => handleDelete(item.id, item.name)} className="p-1.5 rounded opacity-0 group-hover:opacity-100 hover:bg-red-50 text-slate-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
              {expanded === item.id && item.description && <div className="border-t border-slate-100 px-6 py-4 text-sm text-slate-600">{item.description}</div>}
            </div>
          ))}
        </div>
      ) : (
        <div className="card p-16 text-center"><Icon className="w-10 h-10 text-slate-300 mx-auto mb-3" /><h3 className="font-semibold text-slate-900 mb-1">No {tab}</h3><p className="text-sm text-slate-500 mb-4">Create a {tab === 'partners' ? 'trading partner' : 'trading agreement'}.</p><button onClick={() => setShowCreate(true)} className="btn-primary"><Plus className="w-4 h-4" /> Create</button></div>
      )}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title={`Create ${tab === 'partners' ? 'Partner' : 'Agreement'}`}>
        <div className="space-y-4">
          <div><label className="label">Name</label><input className="input" value={formName} onChange={e => setFormName(e.target.value)} autoFocus /></div>
          <div><label className="label">{tab === 'partners' ? 'Protocol' : 'Type'}</label><select className="input" value={formProtocol} onChange={e => setFormProtocol(e.target.value)}>{PROTOCOLS.map(p => <option key={p} value={p}>{p}</option>)}</select></div>
          <div><label className="label">Description</label><textarea className="input" rows={2} value={formDescription} onChange={e => setFormDescription(e.target.value)} /></div>
          <div className="flex justify-end gap-3 pt-2"><button onClick={() => setShowCreate(false)} className="btn-secondary">Cancel</button><button onClick={handleCreate} className="btn-primary" disabled={!formName.trim()}>Create</button></div>
        </div>
      </Modal>
      <Modal open={!!editing} onClose={() => setEditing(null)} title={`Edit ${tab === 'partners' ? 'Partner' : 'Agreement'}`}>
        <div className="space-y-4">
          <div><label className="label">Name</label><input className="input" value={formName} onChange={e => setFormName(e.target.value)} /></div>
          <div><label className="label">{tab === 'partners' ? 'Protocol' : 'Type'}</label><select className="input" value={formProtocol} onChange={e => setFormProtocol(e.target.value)}>{PROTOCOLS.map(p => <option key={p} value={p}>{p}</option>)}</select></div>
          <div><label className="label">Description</label><textarea className="input" rows={2} value={formDescription} onChange={e => setFormDescription(e.target.value)} /></div>
          <div className="flex justify-end gap-3 pt-2"><button onClick={() => setEditing(null)} className="btn-secondary">Cancel</button><button onClick={handleSaveEdit} className="btn-primary" disabled={!formName.trim()}><Save className="w-3.5 h-3.5" /> Save</button></div>
        </div>
      </Modal>
    </div>
  );
}
