import { useEffect, useState } from 'react';
import {
  Repeat, Plus, Trash2, ToggleLeft, ToggleRight,
  Code2, ArrowRightLeft, Layers,
} from 'lucide-react';
import { getESBTransformers, createESBTransformer, updateESBTransformer, deleteESBTransformer } from '../api/client';
import { Modal } from '../components/common/Modal';
import { useStore } from '../store';
import type { ESBTransformer } from '../types';

const STEP_TYPES = [
  { value: 'map', label: 'Map', desc: 'Transform field values' },
  { value: 'template', label: 'Template', desc: 'Apply template with variables' },
  { value: 'rename', label: 'Rename', desc: 'Rename fields' },
  { value: 'remove', label: 'Remove', desc: 'Remove fields' },
  { value: 'merge', label: 'Merge', desc: 'Deep-merge objects' },
  { value: 'flatten', label: 'Flatten', desc: 'Flatten nested objects' },
  { value: 'unflatten', label: 'Unflatten', desc: 'Rebuild nested structure' },
  { value: 'script', label: 'Script', desc: 'Custom script transformation' },
  { value: 'custom', label: 'Custom', desc: 'Custom function' },
];

export function ESBTransformers() {
  const [transformers, setTransformers] = useState<ESBTransformer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newChannel, setNewChannel] = useState('');
  const [showDetail, setShowDetail] = useState<ESBTransformer | null>(null);
  const { addNotification } = useStore();

  const load = () => {
    setLoading(true);
    getESBTransformers()
      .then(setTransformers)
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    try {
      await createESBTransformer({
        name: newName.trim(),
        channel: newChannel.trim() || null,
        pipeline: [],
      });
      addNotification({ type: 'success', message: 'Transformer created' });
      setShowCreate(false);
      setNewName('');
      setNewChannel('');
      load();
    } catch {
      addNotification({ type: 'error', message: 'Failed to create transformer' });
    }
  };

  const handleToggle = async (transformer: ESBTransformer) => {
    try {
      await updateESBTransformer(transformer.id, { enabled: !transformer.enabled });
      addNotification({ type: 'success', message: `Transformer ${transformer.enabled ? 'disabled' : 'enabled'}` });
      load();
    } catch {
      addNotification({ type: 'error', message: 'Failed to update' });
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete transformer "${name}"?`)) return;
    try {
      await deleteESBTransformer(id);
      addNotification({ type: 'success', message: 'Transformer deleted' });
      load();
    } catch {
      addNotification({ type: 'error', message: 'Failed to delete' });
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
        <p className="text-sm text-slate-500">Build message transformation pipelines with 20+ built-in functions — map, template, rename, flatten, and more.</p>
        <button onClick={() => setShowCreate(true)} className="btn-primary btn-sm">
          <Plus className="w-3.5 h-3.5" /> New Transformer
        </button>
      </div>

      {transformers.length > 0 ? (
        <div className="card divide-y divide-slate-100">
          {transformers.map((transformer) => (
            <div key={transformer.id} className={`px-6 py-4 flex items-center justify-between group ${!transformer.enabled ? 'opacity-50' : ''}`}>
              <div className="flex items-center gap-4 cursor-pointer" onClick={() => setShowDetail(transformer)}>
                <div className="w-10 h-10 rounded-lg flex items-center justify-center text-amber-600 bg-amber-50">
                  <Repeat className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-medium text-slate-900">{transformer.name}</div>
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <span className="flex items-center gap-1">
                      <Layers className="w-3 h-3" />
                      {transformer.pipeline.length} step{transformer.pipeline.length !== 1 ? 's' : ''}
                    </span>
                    {transformer.channel && (
                      <>
                        <span className="text-slate-300">|</span>
                        <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded">{transformer.channel}</span>
                      </>
                    )}
                    {!transformer.channel && (
                      <>
                        <span className="text-slate-300">|</span>
                        <span className="italic text-slate-400">reusable (no channel)</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={() => handleToggle(transformer)} className="btn-secondary btn-sm">
                  {transformer.enabled ? <ToggleRight className="w-4 h-4 text-green-500" /> : <ToggleLeft className="w-4 h-4 text-slate-400" />}
                  {transformer.enabled ? 'On' : 'Off'}
                </button>
                <button
                  onClick={() => handleDelete(transformer.id, transformer.name)}
                  className="p-1.5 rounded opacity-0 group-hover:opacity-100 hover:bg-red-50 text-slate-400 hover:text-red-600"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="card p-16 text-center">
          <Repeat className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <h3 className="font-semibold text-slate-900 mb-1">No transformers yet</h3>
          <p className="text-sm text-slate-500 mb-4">Create a transformer to modify messages as they flow through the bus.</p>
          <button onClick={() => setShowCreate(true)} className="btn-primary">
            <Plus className="w-4 h-4" /> Create Transformer
          </button>
        </div>
      )}

      {/* Pipeline steps info */}
      <div className="card p-6">
        <h3 className="font-semibold text-slate-900 mb-3">Available Transform Steps</h3>
        <div className="grid grid-cols-3 gap-3">
          {STEP_TYPES.map((step) => (
            <div key={step.value} className="p-3 rounded-lg border border-slate-200 bg-slate-50">
              <div className="text-sm font-medium text-slate-900">{step.label}</div>
              <div className="text-xs text-slate-500">{step.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Create Modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Create Transformer">
        <div className="space-y-4">
          <div>
            <label className="label">Transformer Name</label>
            <input className="input" placeholder="e.g., normalize-order" value={newName} onChange={(e) => setNewName(e.target.value)} autoFocus />
          </div>
          <div>
            <label className="label">Bound Channel (optional)</label>
            <input className="input" placeholder="e.g., order-events (leave empty for reusable)" value={newChannel} onChange={(e) => setNewChannel(e.target.value)} />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setShowCreate(false)} className="btn-secondary">Cancel</button>
            <button onClick={handleCreate} className="btn-primary" disabled={!newName.trim()}>Create</button>
          </div>
        </div>
      </Modal>

      {/* Detail Modal */}
      <Modal open={!!showDetail} onClose={() => setShowDetail(null)} title={showDetail?.name || 'Transformer Details'}>
        <div className="space-y-3">
          {showDetail?.pipeline.length ? (
            showDetail.pipeline.map((step: any, i: number) => (
              <div key={i} className="p-3 rounded-lg border border-slate-200 bg-slate-50">
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-700 text-xs font-bold flex items-center justify-center">{i + 1}</span>
                  <span className="text-sm font-medium text-slate-900 uppercase">{step.type}</span>
                </div>
                <pre className="text-xs text-slate-600 overflow-auto">{JSON.stringify(step, null, 2)}</pre>
              </div>
            ))
          ) : (
            <p className="text-sm text-slate-500 text-center py-4">No pipeline steps defined yet.</p>
          )}
        </div>
      </Modal>
    </div>
  );
}
