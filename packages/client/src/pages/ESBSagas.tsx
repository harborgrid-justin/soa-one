import { useEffect, useState } from 'react';
import {
  Workflow, Plus, Trash2, CheckCircle, XCircle, RefreshCw,
  Clock, ChevronDown, ChevronRight, AlertTriangle, RotateCcw,
} from 'lucide-react';
import { getESBSagas, createESBSaga, deleteESBSaga, getESBSagaInstances } from '../api/client';
import { Modal } from '../components/common/Modal';
import { useStore } from '../store';
import type { ESBSagaDefinition, ESBSagaInstance } from '../types';

const STATUS_STYLE: Record<string, string> = {
  running: 'badge-blue',
  completed: 'badge-green',
  compensating: 'badge-yellow',
  compensated: 'badge-yellow',
  failed: 'badge-red',
};

export function ESBSagas() {
  const [sagas, setSagas] = useState<ESBSagaDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [expandedSaga, setExpandedSaga] = useState<string | null>(null);
  const [instances, setInstances] = useState<ESBSagaInstance[]>([]);
  const [loadingInstances, setLoadingInstances] = useState(false);
  const { addNotification } = useStore();

  const load = () => {
    setLoading(true);
    getESBSagas()
      .then(setSagas)
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const toggleExpand = async (sagaId: string) => {
    if (expandedSaga === sagaId) {
      setExpandedSaga(null);
      return;
    }
    setExpandedSaga(sagaId);
    setLoadingInstances(true);
    try {
      const data = await getESBSagaInstances(sagaId);
      setInstances(data);
    } catch {
      setInstances([]);
    } finally {
      setLoadingInstances(false);
    }
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;
    try {
      await createESBSaga({ name: newName.trim(), description: newDesc.trim(), steps: [] });
      addNotification({ type: 'success', message: 'Saga created' });
      setShowCreate(false);
      setNewName('');
      setNewDesc('');
      load();
    } catch {
      addNotification({ type: 'error', message: 'Failed to create saga' });
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete saga "${name}" and all its instances?`)) return;
    try {
      await deleteESBSaga(id);
      addNotification({ type: 'success', message: 'Saga deleted' });
      if (expandedSaga === id) setExpandedSaga(null);
      load();
    } catch {
      addNotification({ type: 'error', message: 'Failed to delete saga' });
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
        <p className="text-sm text-slate-500">Orchestrate distributed transactions with step-by-step execution and automatic compensation on failure.</p>
        <button onClick={() => setShowCreate(true)} className="btn-primary btn-sm">
          <Plus className="w-3.5 h-3.5" /> New Saga
        </button>
      </div>

      {sagas.length > 0 ? (
        <div className="space-y-3">
          {sagas.map((saga) => {
            const isExpanded = expandedSaga === saga.id;
            const recentInstances = saga.instances || [];
            const runningCount = recentInstances.filter((i) => i.status === 'running').length;

            return (
              <div key={saga.id} className="card">
                <div className="px-6 py-4 flex items-center justify-between group">
                  <div className="flex items-center gap-4 cursor-pointer" onClick={() => toggleExpand(saga.id)}>
                    {isExpanded ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center text-pink-600 bg-pink-50">
                      <Workflow className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="font-medium text-slate-900">{saga.name}</div>
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        {saga.description && <span>{saga.description}</span>}
                        <span className="text-slate-300">|</span>
                        <span>{saga.steps.length} step{saga.steps.length !== 1 ? 's' : ''}</span>
                        {saga.timeout && (
                          <>
                            <span className="text-slate-300">|</span>
                            <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{saga.timeout}ms timeout</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {runningCount > 0 && (
                      <span className="badge-blue flex items-center gap-1">
                        <RefreshCw className="w-3 h-3 animate-spin" />
                        {runningCount} running
                      </span>
                    )}
                    <button
                      onClick={() => handleDelete(saga.id, saga.name)}
                      className="p-1.5 rounded opacity-0 group-hover:opacity-100 hover:bg-red-50 text-slate-400 hover:text-red-600"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t border-slate-100">
                    {/* Steps */}
                    {saga.steps.length > 0 && (
                      <div className="px-6 py-3 bg-slate-50">
                        <div className="text-xs font-semibold text-slate-500 uppercase mb-2">Saga Steps</div>
                        <div className="flex items-center gap-2 flex-wrap">
                          {saga.steps.map((step: any, i: number) => (
                            <div key={i} className="flex items-center gap-1">
                              <span className="px-2 py-1 rounded bg-white border border-slate-200 text-xs font-medium text-slate-700">
                                {step.name || `Step ${i + 1}`}
                              </span>
                              {i < saga.steps.length - 1 && <span className="text-slate-300">&rarr;</span>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Instances */}
                    <div className="px-6 py-3">
                      <div className="text-xs font-semibold text-slate-500 uppercase mb-2">Recent Instances</div>
                      {loadingInstances ? (
                        <div className="flex items-center justify-center py-4">
                          <RefreshCw className="w-4 h-4 animate-spin text-slate-400" />
                        </div>
                      ) : instances.length > 0 ? (
                        <div className="space-y-2">
                          {instances.map((inst) => (
                            <div key={inst.id} className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-100">
                              <div className="flex items-center gap-2">
                                <span className={STATUS_STYLE[inst.status] || 'badge-gray'}>
                                  {inst.status === 'completed' && <CheckCircle className="w-3 h-3 mr-1" />}
                                  {inst.status === 'failed' && <XCircle className="w-3 h-3 mr-1" />}
                                  {inst.status === 'running' && <RefreshCw className="w-3 h-3 mr-1 animate-spin" />}
                                  {(inst.status === 'compensating' || inst.status === 'compensated') && <RotateCcw className="w-3 h-3 mr-1" />}
                                  {inst.status}
                                </span>
                                <span className="text-xs text-slate-500">Step {inst.currentStep + 1}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                {inst.error && (
                                  <span className="text-xs text-red-500 flex items-center gap-1">
                                    <AlertTriangle className="w-3 h-3" />
                                    {inst.error.slice(0, 40)}
                                  </span>
                                )}
                                <span className="text-xs text-slate-400">{new Date(inst.startedAt).toLocaleString()}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-slate-400 py-2">No instances yet.</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="card p-16 text-center">
          <Workflow className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <h3 className="font-semibold text-slate-900 mb-1">No sagas defined</h3>
          <p className="text-sm text-slate-500 mb-4">Create a saga to orchestrate multi-step distributed transactions with compensation.</p>
          <button onClick={() => setShowCreate(true)} className="btn-primary">
            <Plus className="w-4 h-4" /> Create Saga
          </button>
        </div>
      )}

      {/* Create Modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Create Saga Definition">
        <div className="space-y-4">
          <div>
            <label className="label">Saga Name</label>
            <input className="input" placeholder="e.g., order-fulfillment" value={newName} onChange={(e) => setNewName(e.target.value)} autoFocus />
          </div>
          <div>
            <label className="label">Description</label>
            <textarea className="input" rows={2} placeholder="Describe the saga workflow..." value={newDesc} onChange={(e) => setNewDesc(e.target.value)} />
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
