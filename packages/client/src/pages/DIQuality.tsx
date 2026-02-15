import { useEffect, useState } from 'react';
import { ShieldCheck, Plus, Trash2, Pencil, Save, Power } from 'lucide-react';
import { getDIQualityRules, getDIQualityScore, createDIQualityRule, updateDIQualityRule, deleteDIQualityRule } from '../api/client';
import { Modal } from '../components/common/Modal';
import { useStore } from '../store';

const RULE_TYPES = ['completeness', 'uniqueness', 'validity', 'consistency', 'timeliness', 'accuracy'];

export function DIQuality() {
  const [rules, setRules] = useState<any[]>([]);
  const [score, setScore] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState('completeness');
  const [newTable, setNewTable] = useState('');
  const [newColumn, setNewColumn] = useState('');
  const [editName, setEditName] = useState('');
  const [editTable, setEditTable] = useState('');
  const [editColumn, setEditColumn] = useState('');
  const { addNotification } = useStore();

  const load = () => {
    setLoading(true);
    Promise.all([getDIQualityRules(), getDIQualityScore().catch(() => null)])
      .then(([r, s]) => { setRules(r); setScore(s); })
      .catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    try { await createDIQualityRule({ name: newName.trim(), type: newType, table: newTable, column: newColumn }); addNotification({ type: 'success', message: 'Quality rule created' }); setShowCreate(false); setNewName(''); setNewType('completeness'); setNewTable(''); setNewColumn(''); load(); } catch { addNotification({ type: 'error', message: 'Failed to create rule' }); }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete quality rule "${name}"?`)) return;
    try { await deleteDIQualityRule(id); addNotification({ type: 'success', message: 'Rule deleted' }); load(); } catch { addNotification({ type: 'error', message: 'Failed to delete rule' }); }
  };

  const handleToggle = async (r: any) => {
    try { await updateDIQualityRule(r.id, { enabled: !r.enabled }); addNotification({ type: 'success', message: `Rule ${r.enabled ? 'disabled' : 'enabled'}` }); load(); } catch { addNotification({ type: 'error', message: 'Failed to toggle rule' }); }
  };

  const openEdit = (r: any) => { setEditing(r); setEditName(r.name); setEditTable(r.table || ''); setEditColumn(r.column || ''); };
  const handleSaveEdit = async () => {
    if (!editing || !editName.trim()) return;
    try { await updateDIQualityRule(editing.id, { name: editName.trim(), table: editTable, column: editColumn }); addNotification({ type: 'success', message: 'Rule updated' }); setEditing(null); load(); } catch { addNotification({ type: 'error', message: 'Failed to update rule' }); }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6">
      {score && (
        <div className="card p-6">
          <div className="flex items-center gap-4 mb-4">
            <div className={`w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold ${(score.overall ?? 0) >= 80 ? 'bg-emerald-50 text-emerald-700' : (score.overall ?? 0) >= 60 ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700'}`}>{score.overall ?? 0}%</div>
            <div><div className="font-semibold text-slate-900">Data Quality Score</div><div className="text-sm text-slate-500">{rules.length} rules · {score.dimensions ? Object.keys(score.dimensions).length : 0} dimensions</div></div>
          </div>
          {score.dimensions && (
            <div className="grid grid-cols-3 gap-3">{Object.entries(score.dimensions).map(([k, v]: any) => (<div key={k} className="text-center p-2 bg-slate-50 rounded"><div className="text-lg font-semibold">{v ?? 0}%</div><div className="text-xs text-slate-500 capitalize">{k}</div></div>))}</div>
          )}
        </div>
      )}

      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">Manage data quality rules and validations.</p>
        <button onClick={() => setShowCreate(true)} className="btn-primary btn-sm"><Plus className="w-3.5 h-3.5" /> New Rule</button>
      </div>

      {rules.length > 0 ? (
        <div className="space-y-2">
          {rules.map((r) => (
            <div key={r.id} className="card px-6 py-4 flex items-center justify-between group">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center"><ShieldCheck className="w-5 h-5" /></div>
                <div><div className="font-medium text-slate-900">{r.name}</div><div className="text-xs text-slate-500">{r.type} · {r.table || '—'}.{r.column || '—'}</div></div>
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${r.enabled ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{r.enabled ? 'Enabled' : 'Disabled'}</span>
                <button onClick={() => handleToggle(r)} className="btn-secondary btn-sm"><Power className="w-3.5 h-3.5" /></button>
                <button onClick={() => openEdit(r)} className="btn-secondary btn-sm"><Pencil className="w-3.5 h-3.5" /></button>
                <button onClick={() => handleDelete(r.id, r.name)} className="p-1.5 rounded opacity-0 group-hover:opacity-100 hover:bg-red-50 text-slate-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="card p-16 text-center"><ShieldCheck className="w-10 h-10 text-slate-300 mx-auto mb-3" /><h3 className="font-semibold text-slate-900 mb-1">No quality rules</h3><p className="text-sm text-slate-500 mb-4">Create rules to validate data quality.</p><button onClick={() => setShowCreate(true)} className="btn-primary"><Plus className="w-4 h-4" /> Create Rule</button></div>
      )}

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Create Quality Rule">
        <div className="space-y-4">
          <div><label className="label">Name</label><input className="input" placeholder="e.g., Email Completeness" value={newName} onChange={e => setNewName(e.target.value)} autoFocus /></div>
          <div><label className="label">Type</label><select className="input" value={newType} onChange={e => setNewType(e.target.value)}>{RULE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}</select></div>
          <div className="grid grid-cols-2 gap-4"><div><label className="label">Table</label><input className="input" value={newTable} onChange={e => setNewTable(e.target.value)} /></div><div><label className="label">Column</label><input className="input" value={newColumn} onChange={e => setNewColumn(e.target.value)} /></div></div>
          <div className="flex justify-end gap-3 pt-2"><button onClick={() => setShowCreate(false)} className="btn-secondary">Cancel</button><button onClick={handleCreate} className="btn-primary" disabled={!newName.trim()}>Create</button></div>
        </div>
      </Modal>

      <Modal open={!!editing} onClose={() => setEditing(null)} title="Edit Quality Rule">
        <div className="space-y-4">
          <div><label className="label">Name</label><input className="input" value={editName} onChange={e => setEditName(e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-4"><div><label className="label">Table</label><input className="input" value={editTable} onChange={e => setEditTable(e.target.value)} /></div><div><label className="label">Column</label><input className="input" value={editColumn} onChange={e => setEditColumn(e.target.value)} /></div></div>
          <div className="flex justify-end gap-3 pt-2"><button onClick={() => setEditing(null)} className="btn-secondary">Cancel</button><button onClick={handleSaveEdit} className="btn-primary" disabled={!editName.trim()}><Save className="w-3.5 h-3.5" /> Save</button></div>
        </div>
      </Modal>
    </div>
  );
}
