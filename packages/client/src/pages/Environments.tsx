import { useEffect, useState } from 'react';
import {
  Layers,
  Plus,
  ArrowRight,
  Lock,
  Unlock,
  CheckCircle,
  XCircle,
  Clock,
  RefreshCw,
  ChevronRight,
  Palette,
  GripVertical,
  Rocket,
  History,
} from 'lucide-react';
import { Modal } from '../components/common/Modal';
import { getRuleSets } from '../api/client';
import api from '../api/client';
import { useStore } from '../store';

interface Environment {
  id: string;
  name: string;
  slug: string;
  color: string;
  order: number;
  locked: boolean;
  currentVersion?: number;
  ruleSetCount: number;
  lastPromotedAt?: string;
}

interface Promotion {
  id: string;
  sourceEnvId: string;
  sourceEnvName: string;
  targetEnvId: string;
  targetEnvName: string;
  ruleSetId: string;
  ruleSetName: string;
  status: 'pending' | 'approved' | 'rejected' | 'completed';
  requestedBy: string;
  requestedAt: string;
  reviewedBy?: string;
  reviewedAt?: string;
}

const DEFAULT_COLORS = ['#3b82f6', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#ec4899'];

export function Environments() {
  const { addNotification } = useStore();
  const [environments, setEnvironments] = useState<Environment[]>([]);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [ruleSets, setRuleSets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showPromoteModal, setShowPromoteModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'pipeline' | 'history'>('pipeline');

  // Create form
  const [formName, setFormName] = useState('');
  const [formSlug, setFormSlug] = useState('');
  const [formColor, setFormColor] = useState(DEFAULT_COLORS[0]);
  const [formOrder, setFormOrder] = useState(0);

  // Promote form
  const [promoteRuleSetId, setPromoteRuleSetId] = useState('');
  const [promoteSourceEnvId, setPromoteSourceEnvId] = useState('');
  const [promoteTargetEnvId, setPromoteTargetEnvId] = useState('');

  const fetchData = async () => {
    setLoading(true);
    try {
      const [envRes, promoRes, rsRes] = await Promise.all([
        api.get('/environments'),
        api.get('/environments/promotions'),
        getRuleSets(),
      ]);
      setEnvironments(envRes.data.environments || envRes.data || []);
      setPromotions(promoRes.data.promotions || promoRes.data || []);
      setRuleSets(rsRes.ruleSets || rsRes || []);
    } catch (err) {
      addNotification({ type: 'error', message: 'Failed to load environments' });
      setEnvironments([]);
      setPromotions([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreate = async () => {
    if (!formName.trim() || !formSlug.trim()) {
      addNotification({ type: 'error', message: 'Name and slug are required' });
      return;
    }
    try {
      await api.post('/environments', {
        name: formName,
        slug: formSlug,
        color: formColor,
        order: formOrder,
      });
      addNotification({ type: 'success', message: 'Environment created' });
      setShowCreateModal(false);
      setFormName('');
      setFormSlug('');
      setFormColor(DEFAULT_COLORS[0]);
      setFormOrder(0);
      fetchData();
    } catch {
      addNotification({ type: 'error', message: 'Failed to create environment' });
    }
  };

  const handlePromote = async () => {
    if (!promoteRuleSetId || !promoteSourceEnvId || !promoteTargetEnvId) {
      addNotification({ type: 'error', message: 'All promotion fields are required' });
      return;
    }
    try {
      await api.post('/environments/promotions', {
        ruleSetId: promoteRuleSetId,
        sourceEnvId: promoteSourceEnvId,
        targetEnvId: promoteTargetEnvId,
      });
      addNotification({ type: 'success', message: 'Promotion request created' });
      setShowPromoteModal(false);
      setPromoteRuleSetId('');
      setPromoteSourceEnvId('');
      setPromoteTargetEnvId('');
      fetchData();
    } catch {
      addNotification({ type: 'error', message: 'Failed to create promotion' });
    }
  };

  const handlePromotionAction = async (id: string, action: 'approve' | 'reject') => {
    try {
      await api.put(`/environments/promotions/${id}/${action}`);
      addNotification({ type: 'success', message: `Promotion ${action}d` });
      fetchData();
    } catch {
      addNotification({ type: 'error', message: `Failed to ${action} promotion` });
    }
  };

  const handleToggleLock = async (envId: string, locked: boolean) => {
    try {
      await api.put(`/environments/${envId}`, { locked: !locked });
      addNotification({ type: 'success', message: `Environment ${locked ? 'unlocked' : 'locked'}` });
      fetchData();
    } catch {
      addNotification({ type: 'error', message: 'Failed to update environment' });
    }
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case 'completed':
      case 'approved':
        return 'badge-green';
      case 'pending':
        return 'badge-yellow';
      case 'rejected':
        return 'badge-gray';
      default:
        return 'badge-gray';
    }
  };

  const sorted = [...environments].sort((a, b) => a.order - b.order);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-brand-50 flex items-center justify-center">
            <Layers className="w-5 h-5 text-brand-600" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Environments</h1>
            <p className="text-sm text-slate-500">Multi-environment promotion pipeline</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowPromoteModal(true)} className="btn-secondary">
            <Rocket className="w-4 h-4" />
            Promote
          </button>
          <button onClick={() => setShowCreateModal(true)} className="btn-primary">
            <Plus className="w-4 h-4" />
            New Environment
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200">
        <button
          onClick={() => setActiveTab('pipeline')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'pipeline'
              ? 'border-brand-600 text-brand-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Layers className="w-4 h-4 inline mr-1.5" />
          Pipeline
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'history'
              ? 'border-brand-600 text-brand-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <History className="w-4 h-4 inline mr-1.5" />
          Promotion History
        </button>
      </div>

      {activeTab === 'pipeline' && (
        <>
          {/* Pipeline visualization */}
          {sorted.length > 0 ? (
            <div className="flex items-center gap-2 overflow-x-auto pb-4">
              {sorted.map((env, idx) => (
                <div key={env.id} className="flex items-center gap-2 flex-shrink-0">
                  <div
                    className="card p-5 min-w-[200px] relative"
                    style={{ borderTop: `3px solid ${env.color}` }}
                  >
                    {env.locked && (
                      <div className="absolute top-2 right-2">
                        <Lock className="w-4 h-4 text-amber-500" />
                      </div>
                    )}
                    <div className="flex items-center gap-2 mb-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: env.color }}
                      />
                      <h3 className="font-semibold text-slate-900">{env.name}</h3>
                    </div>
                    <p className="text-xs text-slate-500 font-mono mb-3">{env.slug}</p>
                    <div className="space-y-1 text-xs text-slate-600">
                      <div className="flex justify-between">
                        <span>Rule Sets:</span>
                        <span className="font-medium">{env.ruleSetCount}</span>
                      </div>
                      {env.currentVersion !== undefined && (
                        <div className="flex justify-between">
                          <span>Version:</span>
                          <span className="font-medium">v{env.currentVersion}</span>
                        </div>
                      )}
                      {env.lastPromotedAt && (
                        <div className="flex justify-between">
                          <span>Last promoted:</span>
                          <span>{new Date(env.lastPromotedAt).toLocaleDateString()}</span>
                        </div>
                      )}
                    </div>
                    <div className="mt-3 pt-3 border-t border-slate-100">
                      <button
                        onClick={() => handleToggleLock(env.id, env.locked)}
                        className="btn-secondary btn-sm w-full justify-center"
                      >
                        {env.locked ? (
                          <>
                            <Unlock className="w-3.5 h-3.5" /> Unlock
                          </>
                        ) : (
                          <>
                            <Lock className="w-3.5 h-3.5" /> Lock
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                  {idx < sorted.length - 1 && (
                    <ArrowRight className="w-6 h-6 text-slate-300 flex-shrink-0" />
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="card px-6 py-16 text-center">
              <Layers className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="text-sm text-slate-500 mb-4">No environments configured yet.</p>
              <button onClick={() => setShowCreateModal(true)} className="btn-primary btn-sm">
                <Plus className="w-3.5 h-3.5" />
                Create First Environment
              </button>
            </div>
          )}
        </>
      )}

      {activeTab === 'history' && (
        <div className="card">
          {promotions.length > 0 ? (
            <div className="divide-y divide-slate-100">
              {promotions.map((promo) => (
                <div key={promo.id} className="px-6 py-4 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm text-slate-900">
                        {promo.ruleSetName}
                      </span>
                      <span className="text-xs text-slate-400">
                        {promo.sourceEnvName}
                      </span>
                      <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                      <span className="text-xs text-slate-400">
                        {promo.targetEnvName}
                      </span>
                      <span className={statusBadge(promo.status)}>{promo.status}</span>
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                      Requested by {promo.requestedBy} on{' '}
                      {new Date(promo.requestedAt).toLocaleString()}
                      {promo.reviewedBy && (
                        <> &middot; Reviewed by {promo.reviewedBy}</>
                      )}
                    </div>
                  </div>
                  {promo.status === 'pending' && (
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => handlePromotionAction(promo.id, 'approve')}
                        className="btn-primary btn-sm"
                      >
                        <CheckCircle className="w-3.5 h-3.5" /> Approve
                      </button>
                      <button
                        onClick={() => handlePromotionAction(promo.id, 'reject')}
                        className="btn-secondary btn-sm text-red-600 hover:text-red-700"
                      >
                        <XCircle className="w-3.5 h-3.5" /> Reject
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="px-6 py-16 text-center">
              <History className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="text-sm text-slate-500">No promotions yet.</p>
            </div>
          )}
        </div>
      )}

      {/* Create Environment Modal */}
      <Modal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Create Environment"
      >
        <div className="space-y-4">
          <div>
            <label className="label">Name</label>
            <input
              className="input"
              value={formName}
              onChange={(e) => {
                setFormName(e.target.value);
                setFormSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''));
              }}
              placeholder="e.g. Production"
            />
          </div>
          <div>
            <label className="label">Slug</label>
            <input
              className="input font-mono"
              value={formSlug}
              onChange={(e) => setFormSlug(e.target.value)}
              placeholder="e.g. production"
            />
          </div>
          <div>
            <label className="label">Color</label>
            <div className="flex items-center gap-2">
              {DEFAULT_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setFormColor(c)}
                  className={`w-8 h-8 rounded-lg border-2 transition-all ${
                    formColor === c ? 'border-slate-900 scale-110' : 'border-transparent'
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
              <input
                type="color"
                value={formColor}
                onChange={(e) => setFormColor(e.target.value)}
                className="w-8 h-8 rounded cursor-pointer"
              />
            </div>
          </div>
          <div>
            <label className="label">Order</label>
            <input
              className="input"
              type="number"
              min={0}
              value={formOrder}
              onChange={(e) => setFormOrder(Number(e.target.value))}
            />
            <p className="text-xs text-slate-500 mt-1">Lower numbers appear first in the pipeline.</p>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setShowCreateModal(false)} className="btn-secondary">
              Cancel
            </button>
            <button onClick={handleCreate} className="btn-primary">
              <Plus className="w-4 h-4" />
              Create
            </button>
          </div>
        </div>
      </Modal>

      {/* Promote Modal */}
      <Modal
        open={showPromoteModal}
        onClose={() => setShowPromoteModal(false)}
        title="Promote Rule Set"
      >
        <div className="space-y-4">
          <div>
            <label className="label">Rule Set</label>
            <select
              className="input"
              value={promoteRuleSetId}
              onChange={(e) => setPromoteRuleSetId(e.target.value)}
            >
              <option value="">Select a rule set...</option>
              {ruleSets.map((rs: any) => (
                <option key={rs.id} value={rs.id}>
                  {rs.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Source Environment</label>
            <select
              className="input"
              value={promoteSourceEnvId}
              onChange={(e) => setPromoteSourceEnvId(e.target.value)}
            >
              <option value="">Select source...</option>
              {sorted.map((env) => (
                <option key={env.id} value={env.id}>
                  {env.name} ({env.slug})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Target Environment</label>
            <select
              className="input"
              value={promoteTargetEnvId}
              onChange={(e) => setPromoteTargetEnvId(e.target.value)}
            >
              <option value="">Select target...</option>
              {sorted
                .filter((env) => env.id !== promoteSourceEnvId)
                .map((env) => (
                  <option key={env.id} value={env.id}>
                    {env.name} ({env.slug})
                  </option>
                ))}
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setShowPromoteModal(false)} className="btn-secondary">
              Cancel
            </button>
            <button onClick={handlePromote} className="btn-primary">
              <Rocket className="w-4 h-4" />
              Promote
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
