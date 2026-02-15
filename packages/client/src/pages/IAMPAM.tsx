import { useEffect, useState } from 'react';
import { KeyRound, Plus, Trash2, Pencil, Save, LogIn, LogOut, ChevronDown, ChevronRight } from 'lucide-react';
import { getIAMPAMAccounts, createIAMPAMAccount, updateIAMPAMAccount, deleteIAMPAMAccount, checkoutIAMPAMAccount, checkinIAMPAMCheckout } from '../api/client';
import { Modal } from '../components/common/Modal';
import { useStore } from '../store';

const STATUS_COLORS: Record<string, string> = { available: 'bg-emerald-50 text-emerald-700', 'checked-out': 'bg-amber-50 text-amber-700', locked: 'bg-red-50 text-red-700', disabled: 'bg-slate-100 text-slate-500' };
const ACCOUNT_TYPES = ['local-admin', 'domain-admin', 'service-account', 'root', 'database-admin', 'network-device', 'cloud-admin'];

export function IAMPAM() {
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [editing, setEditing] = useState<any>(null);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState('local-admin');
  const [newHost, setNewHost] = useState('');
  const [editName, setEditName] = useState('');
  const [editHost, setEditHost] = useState('');
  const { addNotification } = useStore();

  const load = () => { setLoading(true); getIAMPAMAccounts().then(setAccounts).catch(() => {}).finally(() => setLoading(false)); };
  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    try { await createIAMPAMAccount({ name: newName.trim(), type: newType, host: newHost }); addNotification({ type: 'success', message: 'Account created' }); setShowCreate(false); setNewName(''); setNewType('local-admin'); setNewHost(''); load(); } catch { addNotification({ type: 'error', message: 'Failed to create account' }); }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete privileged account "${name}"?`)) return;
    try { await deleteIAMPAMAccount(id); addNotification({ type: 'success', message: 'Account deleted' }); load(); } catch { addNotification({ type: 'error', message: 'Failed to delete account' }); }
  };

  const handleCheckout = async (id: string) => {
    try { await checkoutIAMPAMAccount(id); addNotification({ type: 'success', message: 'Account checked out' }); load(); } catch { addNotification({ type: 'error', message: 'Failed to checkout' }); }
  };

  const handleCheckin = async (a: any) => {
    const checkoutId = a.currentCheckoutId || a.id;
    try { await checkinIAMPAMCheckout(checkoutId); addNotification({ type: 'success', message: 'Account checked in' }); load(); } catch { addNotification({ type: 'error', message: 'Failed to checkin' }); }
  };

  const openEdit = (a: any) => { setEditing(a); setEditName(a.name); setEditHost(a.host || ''); };
  const handleSaveEdit = async () => {
    if (!editing || !editName.trim()) return;
    try { await updateIAMPAMAccount(editing.id, { name: editName.trim(), host: editHost }); addNotification({ type: 'success', message: 'Account updated' }); setEditing(null); load(); } catch { addNotification({ type: 'error', message: 'Failed to update account' }); }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">Manage privileged accounts with checkout/checkin workflow.</p>
        <button onClick={() => setShowCreate(true)} className="btn-primary btn-sm"><Plus className="w-3.5 h-3.5" /> New Account</button>
      </div>
      {accounts.length > 0 ? (
        <div className="space-y-2">
          {accounts.map((a) => (
            <div key={a.id} className="card">
              <div className="px-6 py-4 flex items-center justify-between group">
                <div className="flex items-center gap-4">
                  <button onClick={() => setExpanded(expanded === a.id ? null : a.id)} className="text-slate-400 hover:text-slate-700">{expanded === a.id ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}</button>
                  <div className="w-10 h-10 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center"><KeyRound className="w-5 h-5" /></div>
                  <div><div className="font-medium text-slate-900">{a.name}</div><div className="text-xs text-slate-500">{a.type || 'unknown'}{a.host ? ` · ${a.host}` : ''}</div></div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[a.status] || STATUS_COLORS.disabled}`}>{a.status || 'unknown'}</span>
                  {a.status === 'available' && <button onClick={() => handleCheckout(a.id)} className="btn-secondary btn-sm" title="Checkout"><LogIn className="w-3.5 h-3.5" /></button>}
                  {a.status === 'checked-out' && <button onClick={() => handleCheckin(a)} className="btn-secondary btn-sm" title="Checkin"><LogOut className="w-3.5 h-3.5" /></button>}
                  <button onClick={() => openEdit(a)} className="btn-secondary btn-sm"><Pencil className="w-3.5 h-3.5" /></button>
                  <button onClick={() => handleDelete(a.id, a.name)} className="p-1.5 rounded opacity-0 group-hover:opacity-100 hover:bg-red-50 text-slate-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
              {expanded === a.id && (
                <div className="border-t border-slate-100 px-6 py-4 text-sm text-slate-600 grid grid-cols-2 gap-2">
                  <div><span className="text-slate-400">Last Checkout:</span> {a.lastCheckout ? new Date(a.lastCheckout).toLocaleString() : 'Never'}</div>
                  <div><span className="text-slate-400">Checked Out By:</span> {a.checkedOutBy || '—'}</div>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="card p-16 text-center"><KeyRound className="w-10 h-10 text-slate-300 mx-auto mb-3" /><h3 className="font-semibold text-slate-900 mb-1">No privileged accounts</h3><p className="text-sm text-slate-500 mb-4">Register privileged accounts for managed access.</p><button onClick={() => setShowCreate(true)} className="btn-primary"><Plus className="w-4 h-4" /> Create Account</button></div>
      )}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Create Privileged Account">
        <div className="space-y-4">
          <div><label className="label">Account Name</label><input className="input" value={newName} onChange={e => setNewName(e.target.value)} autoFocus /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">Type</label><select className="input" value={newType} onChange={e => setNewType(e.target.value)}>{ACCOUNT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}</select></div>
            <div><label className="label">Host</label><input className="input" value={newHost} onChange={e => setNewHost(e.target.value)} placeholder="server.domain.com" /></div>
          </div>
          <div className="flex justify-end gap-3 pt-2"><button onClick={() => setShowCreate(false)} className="btn-secondary">Cancel</button><button onClick={handleCreate} className="btn-primary" disabled={!newName.trim()}>Create</button></div>
        </div>
      </Modal>
      <Modal open={!!editing} onClose={() => setEditing(null)} title="Edit Account">
        <div className="space-y-4">
          <div><label className="label">Account Name</label><input className="input" value={editName} onChange={e => setEditName(e.target.value)} /></div>
          <div><label className="label">Host</label><input className="input" value={editHost} onChange={e => setEditHost(e.target.value)} /></div>
          <div className="flex justify-end gap-3 pt-2"><button onClick={() => setEditing(null)} className="btn-secondary">Cancel</button><button onClick={handleSaveEdit} className="btn-primary" disabled={!editName.trim()}><Save className="w-3.5 h-3.5" /> Save</button></div>
        </div>
      </Modal>
    </div>
  );
}
