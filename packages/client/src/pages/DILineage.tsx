import { useEffect, useState } from 'react';
import { Network, Plus, Trash2, Pencil, Save, ChevronDown, ChevronRight } from 'lucide-react';
import { getDILineage, createDILineageNode, updateDILineageNode, deleteDILineageNode, getDILineageImpact } from '../api/client';
import { Modal } from '../components/common/Modal';
import { useStore } from '../store';

const NODE_TYPES = ['table', 'view', 'column', 'pipeline', 'report', 'api', 'file', 'custom'];

export function DILineage() {
  const [nodes, setNodes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [editing, setEditing] = useState<any>(null);
  const [impact, setImpact] = useState<any>(null);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState('table');
  const [newDescription, setNewDescription] = useState('');
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const { addNotification } = useStore();

  const load = () => { setLoading(true); getDILineage().then(setNodes).catch(() => {}).finally(() => setLoading(false)); };
  useEffect(() => { load(); }, []);

  const roots = nodes.filter((n: any) => n.isRoot);
  const leaves = nodes.filter((n: any) => n.isLeaf);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    try { await createDILineageNode({ name: newName.trim(), type: newType, description: newDescription }); addNotification({ type: 'success', message: 'Lineage node created' }); setShowCreate(false); setNewName(''); setNewType('table'); setNewDescription(''); load(); } catch { addNotification({ type: 'error', message: 'Failed to create node' }); }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete lineage node "${name}"?`)) return;
    try { await deleteDILineageNode(id); addNotification({ type: 'success', message: 'Node deleted' }); load(); } catch { addNotification({ type: 'error', message: 'Failed to delete node' }); }
  };

  const openEdit = (n: any) => { setEditing(n); setEditName(n.name); setEditDescription(n.description || ''); };
  const handleSaveEdit = async () => {
    if (!editing || !editName.trim()) return;
    try { await updateDILineageNode(editing.id, { name: editName.trim(), description: editDescription }); addNotification({ type: 'success', message: 'Node updated' }); setEditing(null); load(); } catch { addNotification({ type: 'error', message: 'Failed to update node' }); }
  };

  const showImpact = async (nodeId: string) => {
    try { const data = await getDILineageImpact(nodeId); setImpact(data); } catch { addNotification({ type: 'error', message: 'Failed to load impact analysis' }); }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-4 gap-4">
        <div className="card p-4 text-center"><div className="text-2xl font-bold text-slate-900">{nodes.length}</div><div className="text-xs text-slate-500">Total Nodes</div></div>
        <div className="card p-4 text-center"><div className="text-2xl font-bold text-blue-600">{roots.length}</div><div className="text-xs text-slate-500">Root Sources</div></div>
        <div className="card p-4 text-center"><div className="text-2xl font-bold text-emerald-600">{leaves.length}</div><div className="text-xs text-slate-500">Leaf Targets</div></div>
        <div className="card p-4 text-center"><div className="text-2xl font-bold text-violet-600">{nodes.length - roots.length - leaves.length}</div><div className="text-xs text-slate-500">Intermediate</div></div>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">Manage data lineage nodes and track data flow.</p>
        <button onClick={() => setShowCreate(true)} className="btn-primary btn-sm"><Plus className="w-3.5 h-3.5" /> New Node</button>
      </div>

      {nodes.length > 0 ? (
        <div className="space-y-2">
          {nodes.map((n) => (
            <div key={n.id} className="card">
              <div className="px-6 py-4 flex items-center justify-between group">
                <div className="flex items-center gap-4">
                  <button onClick={() => setExpanded(expanded === n.id ? null : n.id)} className="text-slate-400 hover:text-slate-700">{expanded === n.id ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}</button>
                  <div className="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center"><Network className="w-5 h-5" /></div>
                  <div><div className="font-medium text-slate-900">{n.name}</div><div className="text-xs text-slate-500">{n.type}{n.isRoot ? ' · root' : ''}{n.isLeaf ? ' · leaf' : ''}</div></div>
                </div>
                <div className="flex items-center gap-3">
                  <button onClick={() => showImpact(n.id)} className="btn-secondary btn-sm text-xs">Impact</button>
                  <button onClick={() => openEdit(n)} className="btn-secondary btn-sm"><Pencil className="w-3.5 h-3.5" /></button>
                  <button onClick={() => handleDelete(n.id, n.name)} className="p-1.5 rounded opacity-0 group-hover:opacity-100 hover:bg-red-50 text-slate-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
              {expanded === n.id && n.description && <div className="border-t border-slate-100 px-6 py-4 text-sm text-slate-600">{n.description}</div>}
            </div>
          ))}
        </div>
      ) : (
        <div className="card p-16 text-center"><Network className="w-10 h-10 text-slate-300 mx-auto mb-3" /><h3 className="font-semibold text-slate-900 mb-1">No lineage nodes</h3><p className="text-sm text-slate-500 mb-4">Create nodes to map data lineage.</p><button onClick={() => setShowCreate(true)} className="btn-primary"><Plus className="w-4 h-4" /> Create Node</button></div>
      )}

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Create Lineage Node">
        <div className="space-y-4">
          <div><label className="label">Name</label><input className="input" placeholder="e.g., customers_table" value={newName} onChange={e => setNewName(e.target.value)} autoFocus /></div>
          <div><label className="label">Type</label><select className="input" value={newType} onChange={e => setNewType(e.target.value)}>{NODE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}</select></div>
          <div><label className="label">Description</label><textarea className="input" rows={2} value={newDescription} onChange={e => setNewDescription(e.target.value)} /></div>
          <div className="flex justify-end gap-3 pt-2"><button onClick={() => setShowCreate(false)} className="btn-secondary">Cancel</button><button onClick={handleCreate} className="btn-primary" disabled={!newName.trim()}>Create</button></div>
        </div>
      </Modal>

      <Modal open={!!editing} onClose={() => setEditing(null)} title="Edit Lineage Node">
        <div className="space-y-4">
          <div><label className="label">Name</label><input className="input" value={editName} onChange={e => setEditName(e.target.value)} /></div>
          <div><label className="label">Description</label><textarea className="input" rows={2} value={editDescription} onChange={e => setEditDescription(e.target.value)} /></div>
          <div className="flex justify-end gap-3 pt-2"><button onClick={() => setEditing(null)} className="btn-secondary">Cancel</button><button onClick={handleSaveEdit} className="btn-primary" disabled={!editName.trim()}><Save className="w-3.5 h-3.5" /> Save</button></div>
        </div>
      </Modal>

      <Modal open={!!impact} onClose={() => setImpact(null)} title="Impact Analysis">
        <div className="space-y-3">
          {impact && Array.isArray(impact.impacted) ? impact.impacted.map((item: any, i: number) => (
            <div key={i} className="p-3 bg-slate-50 rounded text-sm"><span className="font-medium">{item.name || item.id}</span> <span className="text-xs text-slate-500">({item.type})</span></div>
          )) : <p className="text-sm text-slate-500">No impacted nodes found.</p>}
          <div className="flex justify-end pt-2"><button onClick={() => setImpact(null)} className="btn-secondary">Close</button></div>
        </div>
      </Modal>
    </div>
  );
}
