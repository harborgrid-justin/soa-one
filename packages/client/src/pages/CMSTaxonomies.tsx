import { useEffect, useState } from 'react';
import {
  Tags, Plus, Trash2, ChevronDown, ChevronRight, Settings,
} from 'lucide-react';
import { getCMSTaxonomies, createCMSTaxonomy, updateCMSTaxonomy, deleteCMSTaxonomy } from '../api/client';
import { Modal } from '../components/common/Modal';
import { useStore } from '../store';
import type { CMSTaxonomy } from '../types';

const TYPE_LABELS: Record<string, { label: string; desc: string; color: string }> = {
  hierarchical: { label: 'Hierarchical', desc: 'Tree-structured categories', color: 'text-blue-600 bg-blue-50' },
  flat: { label: 'Flat', desc: 'Simple tag list', color: 'text-emerald-600 bg-emerald-50' },
  network: { label: 'Network', desc: 'Many-to-many relationships', color: 'text-violet-600 bg-violet-50' },
  faceted: { label: 'Faceted', desc: 'Multi-dimensional classification', color: 'text-amber-600 bg-amber-50' },
};

export function CMSTaxonomies() {
  const [taxonomies, setTaxonomies] = useState<CMSTaxonomy[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newType, setNewType] = useState('hierarchical');
  const [expanded, setExpanded] = useState<string | null>(null);
  const { addNotification } = useStore();

  const load = () => {
    setLoading(true);
    getCMSTaxonomies()
      .then(setTaxonomies)
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    try {
      await createCMSTaxonomy({ name: newName.trim(), description: newDescription, type: newType });
      addNotification({ type: 'success', message: 'Taxonomy created' });
      setShowCreate(false);
      setNewName('');
      setNewDescription('');
      setNewType('hierarchical');
      load();
    } catch {
      addNotification({ type: 'error', message: 'Failed to create taxonomy' });
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete taxonomy "${name}"? This cannot be undone.`)) return;
    try {
      await deleteCMSTaxonomy(id);
      addNotification({ type: 'success', message: 'Taxonomy deleted' });
      load();
    } catch {
      addNotification({ type: 'error', message: 'Failed to delete taxonomy' });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">Create and manage taxonomies for classifying and organizing content.</p>
        <button onClick={() => setShowCreate(true)} className="btn-primary btn-sm">
          <Plus className="w-3.5 h-3.5" /> New Taxonomy
        </button>
      </div>

      {taxonomies.length > 0 ? (
        <div className="space-y-3">
          {taxonomies.map((tax) => {
            const isExpanded = expanded === tax.id;
            const meta = TYPE_LABELS[tax.type] || TYPE_LABELS.hierarchical;
            return (
              <div key={tax.id} className="card">
                <div className="px-6 py-4 flex items-center justify-between group">
                  <div className="flex items-center gap-4">
                    <button onClick={() => setExpanded(isExpanded ? null : tax.id)} className="text-slate-400 hover:text-slate-700">
                      {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </button>
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${meta.color}`}>
                      <Tags className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="font-medium text-slate-900">{tax.name}</div>
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <span className="font-medium">{meta.label}</span>
                        <span className="text-slate-300">|</span>
                        <span>{tax.nodes.length} nodes</span>
                        <span className="text-slate-300">|</span>
                        <span>{tax.rules.length} rules</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${meta.color}`}>{meta.label}</span>
                    <button onClick={() => handleDelete(tax.id, tax.name)} className="p-1.5 rounded opacity-0 group-hover:opacity-100 hover:bg-red-50 text-slate-400 hover:text-red-600">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t border-slate-100 px-6 py-4">
                    {tax.description && <p className="text-sm text-slate-600 mb-4">{tax.description}</p>}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <div>
                        <h3 className="text-sm font-semibold text-slate-700 mb-3">Nodes ({tax.nodes.length})</h3>
                        {tax.nodes.length > 0 ? (
                          <div className="space-y-1">
                            {tax.nodes.slice(0, 10).map((node: any, idx: number) => (
                              <div key={idx} className="text-sm text-slate-600 flex items-center gap-2">
                                <Tags className="w-3 h-3 text-slate-400" />
                                {node.name || node.label || `Node ${idx + 1}`}
                              </div>
                            ))}
                            {tax.nodes.length > 10 && <div className="text-xs text-slate-400">+{tax.nodes.length - 10} more</div>}
                          </div>
                        ) : (
                          <p className="text-sm text-slate-400">No nodes defined</p>
                        )}
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-slate-700 mb-3">Auto-Classification Rules ({tax.rules.length})</h3>
                        {tax.rules.length > 0 ? (
                          <div className="space-y-1">
                            {tax.rules.slice(0, 5).map((rule: any, idx: number) => (
                              <div key={idx} className="text-sm text-slate-600 flex items-center gap-2">
                                <Settings className="w-3 h-3 text-slate-400" />
                                {rule.name || rule.condition || `Rule ${idx + 1}`}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-slate-400">No classification rules</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="card p-16 text-center">
          <Tags className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <h3 className="font-semibold text-slate-900 mb-1">No taxonomies yet</h3>
          <p className="text-sm text-slate-500 mb-4">Create a taxonomy to classify and organize your documents.</p>
          <button onClick={() => setShowCreate(true)} className="btn-primary">
            <Plus className="w-4 h-4" /> Create Taxonomy
          </button>
        </div>
      )}

      {/* Create Modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Create Taxonomy">
        <div className="space-y-4">
          <div>
            <label className="label">Taxonomy Name</label>
            <input className="input" placeholder="e.g., Document Classification" value={newName} onChange={(e) => setNewName(e.target.value)} autoFocus />
          </div>
          <div>
            <label className="label">Description</label>
            <textarea className="input" rows={2} placeholder="Optional description" value={newDescription} onChange={(e) => setNewDescription(e.target.value)} />
          </div>
          <div>
            <label className="label">Type</label>
            <div className="space-y-2">
              {Object.entries(TYPE_LABELS).map(([type, meta]) => (
                <button
                  key={type}
                  onClick={() => setNewType(type)}
                  className={`w-full p-3 rounded-lg border text-left transition-colors ${
                    newType === type ? 'border-brand-500 bg-brand-50' : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="text-sm font-medium text-slate-900">{meta.label}</div>
                  <div className="text-xs text-slate-500">{meta.desc}</div>
                </button>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setShowCreate(false)} className="btn-secondary">Cancel</button>
            <button onClick={handleCreate} className="btn-primary" disabled={!newName.trim()}>Create</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
