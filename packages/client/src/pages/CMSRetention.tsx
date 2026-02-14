import { useEffect, useState } from 'react';
import {
  Shield, Plus, Trash2, Clock, Archive, AlertTriangle,
  CheckCircle, PauseCircle, Lock,
} from 'lucide-react';
import { getCMSRetentionPolicies, createCMSRetentionPolicy, updateCMSRetentionPolicy, deleteCMSRetentionPolicy, getCMSLegalHolds, createCMSLegalHold, updateCMSLegalHold } from '../api/client';
import { Modal } from '../components/common/Modal';
import { useStore } from '../store';
import type { CMSRetentionPolicy, CMSLegalHold } from '../types';

const DISPOSITION_LABELS: Record<string, string> = {
  delete: 'Delete',
  archive: 'Archive',
  transfer: 'Transfer',
  review: 'Review',
  extend: 'Extend',
  reclassify: 'Reclassify',
};

export function CMSRetention() {
  const [policies, setPolicies] = useState<CMSRetentionPolicy[]>([]);
  const [legalHolds, setLegalHolds] = useState<CMSLegalHold[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'policies' | 'holds'>('policies');
  const [showCreatePolicy, setShowCreatePolicy] = useState(false);
  const [showCreateHold, setShowCreateHold] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newTrigger, setNewTrigger] = useState('creation');
  const [newPeriod, setNewPeriod] = useState(365);
  const [newDisposition, setNewDisposition] = useState('archive');
  const [newReason, setNewReason] = useState('');
  const { addNotification } = useStore();

  const load = () => {
    setLoading(true);
    Promise.all([getCMSRetentionPolicies(), getCMSLegalHolds()])
      .then(([p, h]) => { setPolicies(p); setLegalHolds(h); })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleCreatePolicy = async () => {
    if (!newName.trim()) return;
    try {
      await createCMSRetentionPolicy({
        name: newName.trim(),
        description: newDescription,
        trigger: newTrigger,
        retentionPeriod: newPeriod,
        disposition: newDisposition,
      });
      addNotification({ type: 'success', message: 'Retention policy created' });
      setShowCreatePolicy(false);
      resetForm();
      load();
    } catch {
      addNotification({ type: 'error', message: 'Failed to create policy' });
    }
  };

  const handleCreateHold = async () => {
    if (!newName.trim()) return;
    try {
      await createCMSLegalHold({ name: newName.trim(), description: newDescription, reason: newReason });
      addNotification({ type: 'success', message: 'Legal hold created' });
      setShowCreateHold(false);
      resetForm();
      load();
    } catch {
      addNotification({ type: 'error', message: 'Failed to create legal hold' });
    }
  };

  const handleTogglePolicy = async (policy: CMSRetentionPolicy) => {
    try {
      await updateCMSRetentionPolicy(policy.id, { enabled: !policy.enabled });
      addNotification({ type: 'success', message: `Policy ${policy.enabled ? 'disabled' : 'enabled'}` });
      load();
    } catch {
      addNotification({ type: 'error', message: 'Failed to update policy' });
    }
  };

  const handleReleaseHold = async (hold: CMSLegalHold) => {
    if (!confirm(`Release legal hold "${hold.name}"?`)) return;
    try {
      await updateCMSLegalHold(hold.id, { active: false });
      addNotification({ type: 'success', message: 'Legal hold released' });
      load();
    } catch {
      addNotification({ type: 'error', message: 'Failed to release hold' });
    }
  };

  const handleDeletePolicy = async (id: string, name: string) => {
    if (!confirm(`Delete retention policy "${name}"?`)) return;
    try {
      await deleteCMSRetentionPolicy(id);
      addNotification({ type: 'success', message: 'Policy deleted' });
      load();
    } catch {
      addNotification({ type: 'error', message: 'Failed to delete policy' });
    }
  };

  const resetForm = () => {
    setNewName('');
    setNewDescription('');
    setNewTrigger('creation');
    setNewPeriod(365);
    setNewDisposition('archive');
    setNewReason('');
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
        <p className="text-sm text-slate-500">Manage records retention policies and legal holds for compliance.</p>
        <div className="flex items-center gap-2">
          {tab === 'policies' && (
            <button onClick={() => setShowCreatePolicy(true)} className="btn-primary btn-sm">
              <Plus className="w-3.5 h-3.5" /> New Policy
            </button>
          )}
          {tab === 'holds' && (
            <button onClick={() => setShowCreateHold(true)} className="btn-primary btn-sm">
              <Plus className="w-3.5 h-3.5" /> New Legal Hold
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-lg w-fit">
        <button
          onClick={() => setTab('policies')}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${tab === 'policies' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
        >
          Retention Policies ({policies.length})
        </button>
        <button
          onClick={() => setTab('holds')}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${tab === 'holds' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
        >
          Legal Holds ({legalHolds.filter((h) => h.active).length} active)
        </button>
      </div>

      {/* Retention Policies */}
      {tab === 'policies' && (
        policies.length > 0 ? (
          <div className="card divide-y divide-slate-100">
            {policies.map((policy) => (
              <div key={policy.id} className="px-6 py-4 flex items-center justify-between group">
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${policy.enabled ? 'text-blue-600 bg-blue-50' : 'text-slate-400 bg-slate-100'}`}>
                    <Archive className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="font-medium text-slate-900">{policy.name}</div>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <span>Trigger: {policy.trigger}</span>
                      <span className="text-slate-300">|</span>
                      <span>Retain: {policy.retentionPeriod} days</span>
                      <span className="text-slate-300">|</span>
                      <span>Action: {DISPOSITION_LABELS[policy.disposition] || policy.disposition}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={policy.enabled ? 'badge-green' : 'badge-gray'}>
                    {policy.enabled ? <CheckCircle className="w-3 h-3 mr-1" /> : <PauseCircle className="w-3 h-3 mr-1" />}
                    {policy.enabled ? 'Active' : 'Disabled'}
                  </span>
                  <button onClick={() => handleTogglePolicy(policy)} className="btn-secondary btn-sm">
                    {policy.enabled ? 'Disable' : 'Enable'}
                  </button>
                  <button onClick={() => handleDeletePolicy(policy.id, policy.name)} className="p-1.5 rounded opacity-0 group-hover:opacity-100 hover:bg-red-50 text-slate-400 hover:text-red-600">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="card p-16 text-center">
            <Archive className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <h3 className="font-semibold text-slate-900 mb-1">No retention policies</h3>
            <p className="text-sm text-slate-500 mb-4">Create a retention policy to manage document lifecycle.</p>
            <button onClick={() => setShowCreatePolicy(true)} className="btn-primary">
              <Plus className="w-4 h-4" /> Create Policy
            </button>
          </div>
        )
      )}

      {/* Legal Holds */}
      {tab === 'holds' && (
        legalHolds.length > 0 ? (
          <div className="card divide-y divide-slate-100">
            {legalHolds.map((hold) => (
              <div key={hold.id} className="px-6 py-4 flex items-center justify-between group">
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${hold.active ? 'text-red-600 bg-red-50' : 'text-slate-400 bg-slate-100'}`}>
                    <Lock className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="font-medium text-slate-900">{hold.name}</div>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      {hold.reason && <span>{hold.reason}</span>}
                      <span className="text-slate-300">|</span>
                      <span>{hold.documentIds.length} documents</span>
                      <span className="text-slate-300">|</span>
                      <span>Created {new Date(hold.createdAt).toLocaleDateString()}</span>
                      {hold.releasedAt && (
                        <>
                          <span className="text-slate-300">|</span>
                          <span>Released {new Date(hold.releasedAt).toLocaleDateString()}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={hold.active ? 'badge-red' : 'badge-gray'}>
                    {hold.active ? <AlertTriangle className="w-3 h-3 mr-1" /> : <CheckCircle className="w-3 h-3 mr-1" />}
                    {hold.active ? 'Active' : 'Released'}
                  </span>
                  {hold.active && (
                    <button onClick={() => handleReleaseHold(hold)} className="btn-secondary btn-sm">Release</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="card p-16 text-center">
            <Lock className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <h3 className="font-semibold text-slate-900 mb-1">No legal holds</h3>
            <p className="text-sm text-slate-500 mb-4">Create a legal hold to preserve documents for litigation or investigation.</p>
            <button onClick={() => setShowCreateHold(true)} className="btn-primary">
              <Plus className="w-4 h-4" /> Create Legal Hold
            </button>
          </div>
        )
      )}

      {/* Create Policy Modal */}
      <Modal open={showCreatePolicy} onClose={() => { setShowCreatePolicy(false); resetForm(); }} title="Create Retention Policy">
        <div className="space-y-4">
          <div>
            <label className="label">Policy Name</label>
            <input className="input" placeholder="e.g., 7-Year SOX Retention" value={newName} onChange={(e) => setNewName(e.target.value)} autoFocus />
          </div>
          <div>
            <label className="label">Description</label>
            <textarea className="input" rows={2} value={newDescription} onChange={(e) => setNewDescription(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Trigger</label>
              <select className="input" value={newTrigger} onChange={(e) => setNewTrigger(e.target.value)}>
                <option value="creation">Creation Date</option>
                <option value="lastModified">Last Modified</option>
                <option value="lastAccessed">Last Accessed</option>
                <option value="published">Published Date</option>
                <option value="approved">Approval Date</option>
              </select>
            </div>
            <div>
              <label className="label">Retention Period (days)</label>
              <input className="input" type="number" min={1} value={newPeriod} onChange={(e) => setNewPeriod(Number(e.target.value))} />
            </div>
          </div>
          <div>
            <label className="label">Disposition</label>
            <select className="input" value={newDisposition} onChange={(e) => setNewDisposition(e.target.value)}>
              {Object.entries(DISPOSITION_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => { setShowCreatePolicy(false); resetForm(); }} className="btn-secondary">Cancel</button>
            <button onClick={handleCreatePolicy} className="btn-primary" disabled={!newName.trim()}>Create</button>
          </div>
        </div>
      </Modal>

      {/* Create Legal Hold Modal */}
      <Modal open={showCreateHold} onClose={() => { setShowCreateHold(false); resetForm(); }} title="Create Legal Hold">
        <div className="space-y-4">
          <div>
            <label className="label">Hold Name</label>
            <input className="input" placeholder="e.g., Litigation Hold - Case #12345" value={newName} onChange={(e) => setNewName(e.target.value)} autoFocus />
          </div>
          <div>
            <label className="label">Description</label>
            <textarea className="input" rows={2} value={newDescription} onChange={(e) => setNewDescription(e.target.value)} />
          </div>
          <div>
            <label className="label">Reason</label>
            <input className="input" placeholder="e.g., Pending litigation" value={newReason} onChange={(e) => setNewReason(e.target.value)} />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => { setShowCreateHold(false); resetForm(); }} className="btn-secondary">Cancel</button>
            <button onClick={handleCreateHold} className="btn-primary" disabled={!newName.trim()}>Create</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
