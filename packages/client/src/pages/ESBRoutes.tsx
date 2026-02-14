import { useEffect, useState } from 'react';
import {
  GitBranch, Plus, Trash2, ToggleLeft, ToggleRight,
  ArrowRight, Shuffle, Target,
} from 'lucide-react';
import { getESBRoutes, createESBRoute, updateESBRoute, deleteESBRoute } from '../api/client';
import { Modal } from '../components/common/Modal';
import { useStore } from '../store';
import type { ESBRoute, ESBRoutingStrategy } from '../types';

const STRATEGY_META: Record<string, { label: string; desc: string; color: string }> = {
  'content-based': { label: 'Content-Based', desc: 'Route by message body fields', color: 'text-blue-600 bg-blue-50' },
  'header-based': { label: 'Header-Based', desc: 'Route by message headers', color: 'text-indigo-600 bg-indigo-50' },
  'round-robin': { label: 'Round Robin', desc: 'Distribute evenly across targets', color: 'text-emerald-600 bg-emerald-50' },
  'weighted': { label: 'Weighted', desc: 'Weighted distribution', color: 'text-teal-600 bg-teal-50' },
  'failover': { label: 'Failover', desc: 'Primary with fallback targets', color: 'text-orange-600 bg-orange-50' },
  'multicast': { label: 'Multicast', desc: 'Send to all targets', color: 'text-purple-600 bg-purple-50' },
  'priority-based': { label: 'Priority', desc: 'Route by message priority', color: 'text-amber-600 bg-amber-50' },
  'dynamic': { label: 'Dynamic', desc: 'Runtime-resolved targets', color: 'text-pink-600 bg-pink-50' },
  'itinerary': { label: 'Itinerary', desc: 'Multi-step routing slip', color: 'text-violet-600 bg-violet-50' },
  'recipient-list': { label: 'Recipient List', desc: 'Computed target list', color: 'text-cyan-600 bg-cyan-50' },
};

export function ESBRoutes() {
  const [routes, setRoutes] = useState<ESBRoute[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newSource, setNewSource] = useState('');
  const [newStrategy, setNewStrategy] = useState<ESBRoutingStrategy>('content-based');
  const [newTargets, setNewTargets] = useState('');
  const { addNotification } = useStore();

  const load = () => {
    setLoading(true);
    getESBRoutes()
      .then(setRoutes)
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    if (!newName.trim() || !newSource.trim()) return;
    try {
      await createESBRoute({
        name: newName.trim(),
        source: newSource.trim(),
        strategy: newStrategy,
        targets: newTargets.split(',').map((t) => t.trim()).filter(Boolean),
      });
      addNotification({ type: 'success', message: 'Route created' });
      setShowCreate(false);
      setNewName('');
      setNewSource('');
      setNewTargets('');
      load();
    } catch {
      addNotification({ type: 'error', message: 'Failed to create route' });
    }
  };

  const handleToggle = async (route: ESBRoute) => {
    try {
      await updateESBRoute(route.id, { enabled: !route.enabled });
      addNotification({ type: 'success', message: `Route ${route.enabled ? 'disabled' : 'enabled'}` });
      load();
    } catch {
      addNotification({ type: 'error', message: 'Failed to update route' });
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete route "${name}"?`)) return;
    try {
      await deleteESBRoute(id);
      addNotification({ type: 'success', message: 'Route deleted' });
      load();
    } catch {
      addNotification({ type: 'error', message: 'Failed to delete route' });
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
        <p className="text-sm text-slate-500">Define routing rules with 10 strategies including content-based, round-robin, failover, and multicast.</p>
        <button onClick={() => setShowCreate(true)} className="btn-primary btn-sm">
          <Plus className="w-3.5 h-3.5" /> New Route
        </button>
      </div>

      {routes.length > 0 ? (
        <div className="card divide-y divide-slate-100">
          {routes.map((route) => {
            const meta = STRATEGY_META[route.strategy] || STRATEGY_META['content-based'];
            return (
              <div key={route.id} className={`px-6 py-4 flex items-center justify-between group ${!route.enabled ? 'opacity-50' : ''}`}>
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${meta.color}`}>
                    <GitBranch className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="font-medium text-slate-900">{route.name}</div>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded">{route.source}</span>
                      <ArrowRight className="w-3 h-3 text-slate-400" />
                      {route.targets.length > 0 ? (
                        route.targets.map((t, i) => (
                          <span key={i} className="font-mono bg-slate-100 px-1.5 py-0.5 rounded">{t}</span>
                        ))
                      ) : (
                        <span className="italic text-slate-400">no targets</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${meta.color}`}>
                    {meta.label}
                  </span>
                  {route.priority > 0 && (
                    <span className="text-xs text-slate-400">P{route.priority}</span>
                  )}
                  <button onClick={() => handleToggle(route)} className="btn-secondary btn-sm">
                    {route.enabled ? <ToggleRight className="w-4 h-4 text-green-500" /> : <ToggleLeft className="w-4 h-4 text-slate-400" />}
                    {route.enabled ? 'Enabled' : 'Disabled'}
                  </button>
                  <button
                    onClick={() => handleDelete(route.id, route.name)}
                    className="p-1.5 rounded opacity-0 group-hover:opacity-100 hover:bg-red-50 text-slate-400 hover:text-red-600"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="card p-16 text-center">
          <GitBranch className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <h3 className="font-semibold text-slate-900 mb-1">No routes defined</h3>
          <p className="text-sm text-slate-500 mb-4">Create a routing rule to direct messages between channels.</p>
          <button onClick={() => setShowCreate(true)} className="btn-primary">
            <Plus className="w-4 h-4" /> Create Route
          </button>
        </div>
      )}

      {/* Create Modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Create Routing Rule">
        <div className="space-y-4">
          <div>
            <label className="label">Route Name</label>
            <input className="input" placeholder="e.g., order-routing" value={newName} onChange={(e) => setNewName(e.target.value)} autoFocus />
          </div>
          <div>
            <label className="label">Source Channel</label>
            <input className="input" placeholder="e.g., incoming-orders" value={newSource} onChange={(e) => setNewSource(e.target.value)} />
          </div>
          <div>
            <label className="label">Strategy</label>
            <select className="input" value={newStrategy} onChange={(e) => setNewStrategy(e.target.value as ESBRoutingStrategy)}>
              {Object.entries(STRATEGY_META).map(([key, meta]) => (
                <option key={key} value={key}>{meta.label} - {meta.desc}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Target Channels (comma-separated)</label>
            <input className="input" placeholder="e.g., domestic-orders, international-orders" value={newTargets} onChange={(e) => setNewTargets(e.target.value)} />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setShowCreate(false)} className="btn-secondary">Cancel</button>
            <button onClick={handleCreate} className="btn-primary" disabled={!newName.trim() || !newSource.trim()}>Create</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
