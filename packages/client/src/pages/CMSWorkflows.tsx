import { useEffect, useState } from 'react';
import {
  Workflow, Plus, Trash2, CheckCircle, PauseCircle, Play,
  Clock, ChevronDown, ChevronRight, Pencil, Save, ChevronUp,
} from 'lucide-react';
import { getCMSWorkflows, createCMSWorkflow, updateCMSWorkflow, deleteCMSWorkflow } from '../api/client';
import { Modal } from '../components/common/Modal';
import { useStore } from '../store';
import type { CMSWorkflow, CMSWorkflowInstance } from '../types';

const INSTANCE_STATUS_COLORS: Record<string, string> = {
  running: 'badge-yellow',
  completed: 'badge-green',
  failed: 'badge-red',
  cancelled: 'badge-gray',
  paused: 'badge-yellow',
};

const STEP_TYPES = [
  { value: 'approval', label: 'Approval', desc: 'Require manual approval' },
  { value: 'review', label: 'Review', desc: 'Document review step' },
  { value: 'notification', label: 'Notification', desc: 'Send notification' },
  { value: 'conditional', label: 'Conditional', desc: 'Branch based on condition' },
  { value: 'transform', label: 'Transform', desc: 'Transform document' },
  { value: 'publish', label: 'Publish', desc: 'Publish to channel' },
  { value: 'archive', label: 'Archive', desc: 'Archive document' },
  { value: 'custom', label: 'Custom', desc: 'Custom action' },
];

export function CMSWorkflows() {
  const [workflows, setWorkflows] = useState<CMSWorkflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [editingWorkflow, setEditingWorkflow] = useState<CMSWorkflow | null>(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editSteps, setEditSteps] = useState<any[]>([]);
  const [editTriggers, setEditTriggers] = useState('');
  const { addNotification } = useStore();

  const load = () => {
    setLoading(true);
    getCMSWorkflows()
      .then(setWorkflows)
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    try {
      await createCMSWorkflow({ name: newName.trim(), description: newDescription });
      addNotification({ type: 'success', message: 'Workflow created' });
      setShowCreate(false);
      setNewName(''); setNewDescription('');
      load();
    } catch {
      addNotification({ type: 'error', message: 'Failed to create workflow' });
    }
  };

  const handleToggle = async (wf: CMSWorkflow) => {
    try {
      await updateCMSWorkflow(wf.id, { enabled: !wf.enabled });
      addNotification({ type: 'success', message: `Workflow ${wf.enabled ? 'disabled' : 'enabled'}` });
      load();
    } catch {
      addNotification({ type: 'error', message: 'Failed to update workflow' });
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete workflow "${name}"? This cannot be undone.`)) return;
    try {
      await deleteCMSWorkflow(id);
      addNotification({ type: 'success', message: 'Workflow deleted' });
      load();
    } catch {
      addNotification({ type: 'error', message: 'Failed to delete workflow' });
    }
  };

  const openEdit = (wf: CMSWorkflow) => {
    setEditingWorkflow(wf);
    setEditName(wf.name);
    setEditDescription(wf.description || '');
    setEditSteps([...(wf.steps || [])]);
    setEditTriggers(JSON.stringify(wf.triggers || [], null, 2));
  };

  const handleSaveEdit = async () => {
    if (!editingWorkflow || !editName.trim()) return;
    try {
      let triggers: any[] = [];
      try { triggers = JSON.parse(editTriggers); } catch { /* keep empty */ }
      await updateCMSWorkflow(editingWorkflow.id, {
        name: editName.trim(),
        description: editDescription,
        steps: editSteps,
        triggers,
      });
      addNotification({ type: 'success', message: 'Workflow updated' });
      setEditingWorkflow(null);
      load();
    } catch {
      addNotification({ type: 'error', message: 'Failed to update workflow' });
    }
  };

  const addStep = () => {
    setEditSteps([...editSteps, { name: '', action: 'approval', config: {} }]);
  };

  const removeStep = (index: number) => {
    setEditSteps(editSteps.filter((_, i) => i !== index));
  };

  const moveStep = (index: number, direction: 'up' | 'down') => {
    const arr = [...editSteps];
    const target = direction === 'up' ? index - 1 : index + 1;
    if (target < 0 || target >= arr.length) return;
    [arr[index], arr[target]] = [arr[target], arr[index]];
    setEditSteps(arr);
  };

  const updateStep = (index: number, field: string, value: string) => {
    const arr = [...editSteps];
    arr[index] = { ...arr[index], [field]: value };
    setEditSteps(arr);
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
        <p className="text-sm text-slate-500">Define document approval, review, and publishing workflows.</p>
        <button onClick={() => setShowCreate(true)} className="btn-primary btn-sm">
          <Plus className="w-3.5 h-3.5" /> New Workflow
        </button>
      </div>

      {workflows.length > 0 ? (
        <div className="space-y-3">
          {workflows.map((wf) => {
            const isExpanded = expanded === wf.id;
            const runningCount = (wf.instances || []).filter((i) => i.status === 'running').length;
            return (
              <div key={wf.id} className="card">
                <div className="px-6 py-4 flex items-center justify-between group">
                  <div className="flex items-center gap-4">
                    <button onClick={() => setExpanded(isExpanded ? null : wf.id)} className="text-slate-400 hover:text-slate-700">
                      {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </button>
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${wf.enabled ? 'text-violet-600 bg-violet-50' : 'text-slate-400 bg-slate-100'}`}>
                      <Workflow className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="font-medium text-slate-900">{wf.name}</div>
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <span>{wf.steps.length} steps</span>
                        {runningCount > 0 && (
                          <><span className="text-slate-300">|</span><span className="text-amber-600">{runningCount} running</span></>
                        )}
                        {wf.description && (
                          <><span className="text-slate-300">|</span><span className="truncate max-w-[200px]">{wf.description}</span></>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={wf.enabled ? 'badge-green' : 'badge-gray'}>
                      {wf.enabled ? <CheckCircle className="w-3 h-3 mr-1" /> : <PauseCircle className="w-3 h-3 mr-1" />}
                      {wf.enabled ? 'Enabled' : 'Disabled'}
                    </span>
                    <button onClick={() => openEdit(wf)} className="btn-secondary btn-sm">
                      <Pencil className="w-3.5 h-3.5" /> Edit
                    </button>
                    <button onClick={() => handleToggle(wf)} className="btn-secondary btn-sm">
                      {wf.enabled ? <PauseCircle className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                      {wf.enabled ? 'Disable' : 'Enable'}
                    </button>
                    <button onClick={() => handleDelete(wf.id, wf.name)} className="p-1.5 rounded opacity-0 group-hover:opacity-100 hover:bg-red-50 text-slate-400 hover:text-red-600">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t border-slate-100 px-6 py-4">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <div>
                        <h3 className="text-sm font-semibold text-slate-700 mb-3">Steps</h3>
                        {wf.steps.length > 0 ? (
                          <div className="space-y-2">
                            {wf.steps.map((step: any, idx: number) => (
                              <div key={idx} className="flex items-center gap-3 text-sm">
                                <div className="w-6 h-6 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-xs font-bold">{idx + 1}</div>
                                <span className="text-slate-700">{step.name || step.action || `Step ${idx + 1}`}</span>
                                {step.action && <span className="text-xs text-slate-400">({step.action})</span>}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-slate-400">No steps defined — click Edit to add steps</p>
                        )}
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-slate-700 mb-3">Recent Instances</h3>
                        {wf.instances && wf.instances.length > 0 ? (
                          <div className="space-y-2">
                            {wf.instances.slice(0, 5).map((inst: CMSWorkflowInstance) => (
                              <div key={inst.id} className="flex items-center justify-between text-sm">
                                <div className="flex items-center gap-2">
                                  <span className={INSTANCE_STATUS_COLORS[inst.status] || 'badge-gray'}>{inst.status}</span>
                                  <span className="text-slate-500">Step {inst.currentStep + 1}</span>
                                </div>
                                <span className="text-xs text-slate-400">
                                  <Clock className="w-3 h-3 inline mr-1" />
                                  {new Date(inst.startedAt).toLocaleDateString()}
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-slate-400">No instances yet</p>
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
          <Workflow className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <h3 className="font-semibold text-slate-900 mb-1">No workflows yet</h3>
          <p className="text-sm text-slate-500 mb-4">Create a workflow to automate document review and approval.</p>
          <button onClick={() => setShowCreate(true)} className="btn-primary"><Plus className="w-4 h-4" /> Create Workflow</button>
        </div>
      )}

      {/* Create Modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Create Document Workflow">
        <div className="space-y-4">
          <div>
            <label className="label">Workflow Name</label>
            <input className="input" placeholder="e.g., Contract Approval" value={newName} onChange={(e) => setNewName(e.target.value)} autoFocus />
          </div>
          <div>
            <label className="label">Description</label>
            <textarea className="input" rows={2} placeholder="Optional description" value={newDescription} onChange={(e) => setNewDescription(e.target.value)} />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setShowCreate(false)} className="btn-secondary">Cancel</button>
            <button onClick={handleCreate} className="btn-primary" disabled={!newName.trim()}>Create</button>
          </div>
        </div>
      </Modal>

      {/* Edit Workflow Modal */}
      <Modal open={!!editingWorkflow} onClose={() => setEditingWorkflow(null)} title="Edit Workflow" size="lg">
        <div className="space-y-4">
          <div>
            <label className="label">Workflow Name</label>
            <input className="input" value={editName} onChange={(e) => setEditName(e.target.value)} />
          </div>
          <div>
            <label className="label">Description</label>
            <textarea className="input" rows={2} value={editDescription} onChange={(e) => setEditDescription(e.target.value)} />
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="label mb-0">Steps ({editSteps.length})</label>
              <button onClick={addStep} className="btn-secondary btn-sm"><Plus className="w-3 h-3" /> Add Step</button>
            </div>
            {editSteps.length === 0 && (
              <p className="text-sm text-slate-400 text-center py-4">No steps defined. Click &quot;Add Step&quot; to build your workflow.</p>
            )}
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {editSteps.map((step, i) => (
                <div key={i} className="p-3 rounded-lg border border-slate-200 bg-slate-50">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="w-5 h-5 rounded-full bg-violet-100 text-violet-700 text-xs font-bold flex items-center justify-center">{i + 1}</span>
                    <input
                      className="input py-1 text-sm flex-1"
                      placeholder="Step name"
                      value={step.name || ''}
                      onChange={(e) => updateStep(i, 'name', e.target.value)}
                    />
                    <select
                      className="input py-1 text-sm w-36"
                      value={step.action || 'approval'}
                      onChange={(e) => updateStep(i, 'action', e.target.value)}
                    >
                      {STEP_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                    <button onClick={() => moveStep(i, 'up')} disabled={i === 0} className="p-1 hover:bg-slate-200 rounded disabled:opacity-30">
                      <ChevronUp className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => moveStep(i, 'down')} disabled={i === editSteps.length - 1} className="p-1 hover:bg-slate-200 rounded disabled:opacity-30">
                      <ChevronDown className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => removeStep(i)} className="p-1 hover:bg-red-50 text-red-400 hover:text-red-600 rounded">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div>
            <label className="label">Triggers (JSON)</label>
            <textarea className="input text-xs font-mono h-20" value={editTriggers} onChange={(e) => setEditTriggers(e.target.value)} placeholder='[{"event": "document.created", "condition": {}}]' />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setEditingWorkflow(null)} className="btn-secondary">Cancel</button>
            <button onClick={handleSaveEdit} className="btn-primary" disabled={!editName.trim()}>
              <Save className="w-3.5 h-3.5" /> Save Changes
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
