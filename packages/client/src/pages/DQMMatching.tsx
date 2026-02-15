import { useEffect, useState } from 'react';
import { GitMerge, Plus, Trash2, Pencil, Save, Power } from 'lucide-react';
import { getDQMMatchingRules, createDQMMatchingRule, updateDQMMatchingRule, deleteDQMMatchingRule } from '../api/client';
import { Modal } from '../components/common/Modal';
import { useStore } from '../store';

const MATCH_ALGORITHMS = ['exact', 'fuzzy', 'phonetic', 'levenshtein', 'jaro-winkler', 'soundex', 'metaphone', 'custom'];

export function DQMMatching() {
  const [rules, setRules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [newName, setNewName] = useState('');
  const [newAlgorithm, setNewAlgorithm] = useState('fuzzy');
  const [newThreshold, setNewThreshold] = useState('0.85');
  const [editName, setEditName] = useState('');
  const [editThreshold, setEditThreshold] = useState('');
  const { addNotification } = useStore();

  const load = () => { setLoading(true); getDQMMatchingRules().then(setRules).catch(() => {}).finally(() => setLoading(false)); };
  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    try { await createDQMMatchingRule({ name: newName.trim(), algorithm: newAlgorithm, threshold: parseFloat(newThreshold) || 0.85 }); addNotification({ type: 'success', message: 'Matching rule created' }); setShowCreate(false); setNewName(''); setNewAlgorithm('fuzzy'); setNewThreshold('0.85'); load(); } catch { addNotification({ type: 'error', message: 'Failed to create rule' }); }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete matching rule "${name}"?`)) return;
    try { await deleteDQMMatchingRule(id); addNotification({ type: 'success', message: 'Rule deleted' }); load(); } catch { addNotification({ type: 'error', message: 'Failed to delete rule' }); }
  };

  const handleToggle = async (r: any) => {
    try { await updateDQMMatchingRule(r.id, { enabled: !r.enabled }); addNotification({ type: 'success', message: `Rule ${r.enabled ? 'disabled' : 'enabled'}` }); load(); } catch { addNotification({ type: 'error', message: 'Failed to toggle rule' }); }
  };

  const openEdit = (r: any) => { setEditing(r); setEditName(r.name); setEditThreshold(String(r.threshold ?? 0.85)); };
  const handleSaveEdit = async () => {
    if (!editing || !editName.trim()) return;
    try { await updateDQMMatchingRule(editing.id, { name: editName.trim(), threshold: parseFloat(editThreshold) || 0.85 }); addNotification({ type: 'success', message: 'Rule updated' }); setEditing(null); load(); } catch { addNotification({ type: 'error', message: 'Failed to update rule' }); }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">Configure record matching and deduplication rules.</p>
        <button onClick={() => setShowCreate(true)} className="btn-primary btn-sm"><Plus className="w-3.5 h-3.5" /> New Rule</button>
      </div>
      {rules.length > 0 ? (
        <div className="space-y-2">
          {rules.map((r) => (
            <div key={r.id} className="card px-6 py-4 flex items-center justify-between group">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-violet-50 text-violet-600 flex items-center justify-center"><GitMerge className="w-5 h-5" /></div>
                <div><div className="font-medium text-slate-900">{r.name}</div><div className="text-xs text-slate-500">{r.algorithm || 'fuzzy'} · threshold {r.threshold ?? 0.85}</div></div>
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${r.enabled !== false ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{r.enabled !== false ? 'Enabled' : 'Disabled'}</span>
                <button onClick={() => handleToggle(r)} className="btn-secondary btn-sm"><Power className="w-3.5 h-3.5" /></button>
                <button onClick={() => openEdit(r)} className="btn-secondary btn-sm"><Pencil className="w-3.5 h-3.5" /></button>
                <button onClick={() => handleDelete(r.id, r.name)} className="p-1.5 rounded opacity-0 group-hover:opacity-100 hover:bg-red-50 text-slate-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="card p-16 text-center"><GitMerge className="w-10 h-10 text-slate-300 mx-auto mb-3" /><h3 className="font-semibold text-slate-900 mb-1">No matching rules</h3><p className="text-sm text-slate-500 mb-4">Create matching rules for deduplication.</p><button onClick={() => setShowCreate(true)} className="btn-primary"><Plus className="w-4 h-4" /> Create Rule</button></div>
      )}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Create Matching Rule">
        <div className="space-y-4">
          <div><label className="label">Name</label><input className="input" value={newName} onChange={e => setNewName(e.target.value)} autoFocus /></div>
          <div className="grid grid-cols-2 gap-4"><div><label className="label">Algorithm</label><select className="input" value={newAlgorithm} onChange={e => setNewAlgorithm(e.target.value)}>{MATCH_ALGORITHMS.map(a => <option key={a} value={a}>{a}</option>)}</select></div><div><label className="label">Threshold</label><input className="input" type="number" step="0.05" min="0" max="1" value={newThreshold} onChange={e => setNewThreshold(e.target.value)} /></div></div>
          <div className="flex justify-end gap-3 pt-2"><button onClick={() => setShowCreate(false)} className="btn-secondary">Cancel</button><button onClick={handleCreate} className="btn-primary" disabled={!newName.trim()}>Create</button></div>
        </div>
      </Modal>
      <Modal open={!!editing} onClose={() => setEditing(null)} title="Edit Matching Rule">
        <div className="space-y-4">
          <div><label className="label">Name</label><input className="input" value={editName} onChange={e => setEditName(e.target.value)} /></div>
          <div><label className="label">Threshold</label><input className="input" type="number" step="0.05" min="0" max="1" value={editThreshold} onChange={e => setEditThreshold(e.target.value)} /></div>
          <div className="flex justify-end gap-3 pt-2"><button onClick={() => setEditing(null)} className="btn-secondary">Cancel</button><button onClick={handleSaveEdit} className="btn-primary" disabled={!editName.trim()}><Save className="w-3.5 h-3.5" /> Save</button></div>
        </div>
      </Modal>
    </div>
  );
}
