import { useEffect, useState } from 'react';
import { BarChart3, Plus, Trash2, Pencil, Save, Activity, ChevronDown, ChevronRight } from 'lucide-react';
import { getSOAKPIs, createSOAKPI, updateSOAKPI, deleteSOAKPI, getSOABAMAlerts, getSOABAMDashboards } from '../api/client';
import { Modal } from '../components/common/Modal';
import { useStore } from '../store';

const KPI_TYPES = ['throughput', 'latency', 'error-rate', 'availability', 'utilization', 'sla-compliance', 'custom'];
const STATUS_COLORS: Record<string, string> = { normal: 'bg-emerald-50 text-emerald-700', warning: 'bg-amber-50 text-amber-700', critical: 'bg-red-50 text-red-700', inactive: 'bg-slate-100 text-slate-500' };

export function SOABAM() {
  const [kpis, setKpis] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [editing, setEditing] = useState<any>(null);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState('throughput');
  const [newThreshold, setNewThreshold] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [editName, setEditName] = useState('');
  const [editThreshold, setEditThreshold] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const { addNotification } = useStore();

  const load = () => {
    setLoading(true);
    Promise.all([getSOAKPIs(), getSOABAMAlerts().catch(() => [])]).then(([k, a]) => { setKpis(k); setAlerts(a); }).catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    try { await createSOAKPI({ name: newName.trim(), type: newType, threshold: newThreshold ? Number(newThreshold) : undefined, description: newDescription }); addNotification({ type: 'success', message: 'KPI created' }); setShowCreate(false); setNewName(''); setNewType('throughput'); setNewThreshold(''); setNewDescription(''); load(); } catch { addNotification({ type: 'error', message: 'Failed to create KPI' }); }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete KPI "${name}"?`)) return;
    try { await deleteSOAKPI(id); addNotification({ type: 'success', message: 'KPI deleted' }); load(); } catch { addNotification({ type: 'error', message: 'Failed to delete KPI' }); }
  };

  const openEdit = (k: any) => { setEditing(k); setEditName(k.name); setEditThreshold(k.threshold?.toString() || ''); setEditDescription(k.description || ''); };
  const handleSaveEdit = async () => {
    if (!editing || !editName.trim()) return;
    try { await updateSOAKPI(editing.id, { name: editName.trim(), threshold: editThreshold ? Number(editThreshold) : undefined, description: editDescription }); addNotification({ type: 'success', message: 'KPI updated' }); setEditing(null); load(); } catch { addNotification({ type: 'error', message: 'Failed to update KPI' }); }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" /></div>;

  const normalCount = kpis.filter(k => k.status === 'normal').length;
  const warningCount = kpis.filter(k => k.status === 'warning').length;
  const criticalCount = kpis.filter(k => k.status === 'critical').length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">Business Activity Monitoring — track KPIs and business metrics.</p>
        <button onClick={() => setShowCreate(true)} className="btn-primary btn-sm"><Plus className="w-3.5 h-3.5" /> New KPI</button>
      </div>
      <div className="grid grid-cols-4 gap-4">
        <div className="card p-4 text-center"><div className="text-2xl font-bold text-slate-900">{kpis.length}</div><div className="text-xs text-slate-500">Total KPIs</div></div>
        <div className="card p-4 text-center"><div className="text-2xl font-bold text-emerald-600">{normalCount}</div><div className="text-xs text-slate-500">Normal</div></div>
        <div className="card p-4 text-center"><div className="text-2xl font-bold text-amber-600">{warningCount}</div><div className="text-xs text-slate-500">Warning</div></div>
        <div className="card p-4 text-center"><div className="text-2xl font-bold text-red-600">{criticalCount}</div><div className="text-xs text-slate-500">Critical</div></div>
      </div>
      {alerts.length > 0 && (
        <div className="card p-4"><h3 className="font-medium text-slate-900 mb-2 flex items-center gap-2"><Activity className="w-4 h-4 text-red-500" /> Active Alerts</h3>
          <div className="space-y-1">{alerts.slice(0, 5).map((a: any, i: number) => <div key={i} className="text-sm px-3 py-2 rounded bg-red-50 text-red-700">{a.message || a.name || 'Alert'}</div>)}</div>
        </div>
      )}
      {kpis.length > 0 ? (
        <div className="space-y-2">
          {kpis.map((k) => (
            <div key={k.id} className="card">
              <div className="px-6 py-4 flex items-center justify-between group">
                <div className="flex items-center gap-4">
                  <button onClick={() => setExpanded(expanded === k.id ? null : k.id)} className="text-slate-400 hover:text-slate-700">{expanded === k.id ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}</button>
                  <div className="w-10 h-10 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center"><BarChart3 className="w-5 h-5" /></div>
                  <div>
                    <div className="font-medium text-slate-900">{k.name}</div>
                    <div className="text-xs text-slate-500">{k.type || 'custom'}{k.value != null ? ` · Current: ${k.value}` : ''}{k.threshold != null ? ` · Threshold: ${k.threshold}` : ''}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[k.status] || STATUS_COLORS.inactive}`}>{k.status || 'inactive'}</span>
                  <button onClick={() => openEdit(k)} className="btn-secondary btn-sm"><Pencil className="w-3.5 h-3.5" /></button>
                  <button onClick={() => handleDelete(k.id, k.name)} className="p-1.5 rounded opacity-0 group-hover:opacity-100 hover:bg-red-50 text-slate-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
              {expanded === k.id && k.description && <div className="border-t border-slate-100 px-6 py-4 text-sm text-slate-600">{k.description}</div>}
            </div>
          ))}
        </div>
      ) : (
        <div className="card p-16 text-center"><BarChart3 className="w-10 h-10 text-slate-300 mx-auto mb-3" /><h3 className="font-semibold text-slate-900 mb-1">No KPIs</h3><p className="text-sm text-slate-500 mb-4">Create business activity KPIs to monitor.</p><button onClick={() => setShowCreate(true)} className="btn-primary"><Plus className="w-4 h-4" /> Create KPI</button></div>
      )}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Create KPI">
        <div className="space-y-4">
          <div><label className="label">Name</label><input className="input" value={newName} onChange={e => setNewName(e.target.value)} autoFocus /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">Type</label><select className="input" value={newType} onChange={e => setNewType(e.target.value)}>{KPI_TYPES.map(t => <option key={t} value={t}>{t}</option>)}</select></div>
            <div><label className="label">Threshold</label><input className="input" type="number" value={newThreshold} onChange={e => setNewThreshold(e.target.value)} /></div>
          </div>
          <div><label className="label">Description</label><textarea className="input" rows={2} value={newDescription} onChange={e => setNewDescription(e.target.value)} /></div>
          <div className="flex justify-end gap-3 pt-2"><button onClick={() => setShowCreate(false)} className="btn-secondary">Cancel</button><button onClick={handleCreate} className="btn-primary" disabled={!newName.trim()}>Create</button></div>
        </div>
      </Modal>
      <Modal open={!!editing} onClose={() => setEditing(null)} title="Edit KPI">
        <div className="space-y-4">
          <div><label className="label">Name</label><input className="input" value={editName} onChange={e => setEditName(e.target.value)} /></div>
          <div><label className="label">Threshold</label><input className="input" type="number" value={editThreshold} onChange={e => setEditThreshold(e.target.value)} /></div>
          <div><label className="label">Description</label><textarea className="input" rows={2} value={editDescription} onChange={e => setEditDescription(e.target.value)} /></div>
          <div className="flex justify-end gap-3 pt-2"><button onClick={() => setEditing(null)} className="btn-secondary">Cancel</button><button onClick={handleSaveEdit} className="btn-primary" disabled={!editName.trim()}><Save className="w-3.5 h-3.5" /> Save</button></div>
        </div>
      </Modal>
    </div>
  );
}
