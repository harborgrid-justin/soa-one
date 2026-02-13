import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plug, Plus, Globe, Database, Webhook, FileInput, Trash2,
  CheckCircle, XCircle, Clock, RefreshCw, Play,
} from 'lucide-react';
import { getAdapters, createAdapter, deleteAdapter, testAdapter } from '../api/client';
import { Modal } from '../components/common/Modal';
import { useStore } from '../store';

const TYPE_ICONS: Record<string, any> = {
  rest: Globe,
  database: Database,
  webhook: Webhook,
  file: FileInput,
};

const TYPE_COLORS: Record<string, string> = {
  rest: 'text-blue-600 bg-blue-50',
  database: 'text-purple-600 bg-purple-50',
  webhook: 'text-amber-600 bg-amber-50',
  file: 'text-slate-600 bg-slate-50',
};

export function AdaptersList() {
  const [adapters, setAdapters] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState('rest');
  const [newProjectId, setNewProjectId] = useState('');
  const [testing, setTesting] = useState<string | null>(null);
  const { addNotification } = useStore();
  const navigate = useNavigate();

  const load = () => {
    setLoading(true);
    getAdapters()
      .then(setAdapters)
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    try {
      // Use first project ID if available, or empty
      await createAdapter({ projectId: newProjectId || adapters[0]?.projectId || '', name: newName.trim(), type: newType });
      addNotification({ type: 'success', message: 'Adapter created' });
      setShowCreate(false);
      setNewName('');
      load();
    } catch {
      addNotification({ type: 'error', message: 'Failed to create adapter' });
    }
  };

  const handleTest = async (id: string) => {
    setTesting(id);
    try {
      const result = await testAdapter(id);
      addNotification({
        type: result.success ? 'success' : 'error',
        message: result.success ? `Connection successful (${result.responseTimeMs || 0}ms)` : `Test failed: ${result.error}`,
      });
      load();
    } catch {
      addNotification({ type: 'error', message: 'Test failed' });
    } finally {
      setTesting(null);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete adapter "${name}"?`)) return;
    try {
      await deleteAdapter(id);
      addNotification({ type: 'success', message: 'Adapter deleted' });
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
        <p className="text-sm text-slate-500">Connect external data sources — REST APIs, databases, webhooks, and files.</p>
        <button onClick={() => setShowCreate(true)} className="btn-primary btn-sm">
          <Plus className="w-3.5 h-3.5" /> New Adapter
        </button>
      </div>

      {adapters.length > 0 ? (
        <div className="card divide-y divide-slate-100">
          {adapters.map((adapter) => {
            const Icon = TYPE_ICONS[adapter.type] || Plug;
            const colors = TYPE_COLORS[adapter.type] || 'text-slate-600 bg-slate-50';
            return (
              <div key={adapter.id} className="px-6 py-4 flex items-center justify-between group">
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${colors}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="font-medium text-slate-900">{adapter.name}</div>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <span className="uppercase font-medium">{adapter.type}</span>
                      {adapter.config?.baseUrl && (
                        <>
                          <span className="text-slate-300">|</span>
                          <span className="font-mono">{adapter.config.baseUrl}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {adapter.lastTestedAt && (
                    <span className="text-xs text-slate-400 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      Tested {new Date(adapter.lastTestedAt).toLocaleDateString()}
                    </span>
                  )}
                  <span className={
                    adapter.status === 'active' ? 'badge-green' :
                    adapter.status === 'error' ? 'badge-red' : 'badge-gray'
                  }>
                    {adapter.status === 'active' ? <><CheckCircle className="w-3 h-3 mr-1" />active</> :
                     adapter.status === 'error' ? <><XCircle className="w-3 h-3 mr-1" />error</> :
                     'inactive'}
                  </span>
                  <button
                    onClick={() => handleTest(adapter.id)}
                    className="btn-secondary btn-sm"
                    disabled={testing === adapter.id}
                  >
                    {testing === adapter.id ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                    Test
                  </button>
                  <button
                    onClick={() => handleDelete(adapter.id, adapter.name)}
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
          <Plug className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <h3 className="font-semibold text-slate-900 mb-1">No adapters yet</h3>
          <p className="text-sm text-slate-500 mb-4">Create an adapter to connect to external data sources.</p>
          <button onClick={() => setShowCreate(true)} className="btn-primary">
            <Plus className="w-4 h-4" /> Create Adapter
          </button>
        </div>
      )}

      {/* Create Modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Create Integration Adapter">
        <div className="space-y-4">
          <div>
            <label className="label">Adapter Name</label>
            <input className="input" placeholder="e.g., Credit Score API" value={newName} onChange={(e) => setNewName(e.target.value)} autoFocus />
          </div>
          <div>
            <label className="label">Type</label>
            <div className="grid grid-cols-2 gap-3">
              {[
                { type: 'rest', label: 'REST API', desc: 'HTTP endpoints', icon: Globe },
                { type: 'database', label: 'Database', desc: 'SQL queries', icon: Database },
                { type: 'webhook', label: 'Webhook', desc: 'Incoming hooks', icon: Webhook },
                { type: 'file', label: 'File', desc: 'CSV/JSON files', icon: FileInput },
              ].map((opt) => (
                <button
                  key={opt.type}
                  onClick={() => setNewType(opt.type)}
                  className={`p-3 rounded-lg border text-left transition-colors ${newType === opt.type ? 'border-brand-500 bg-brand-50' : 'border-slate-200 hover:border-slate-300'}`}
                >
                  <opt.icon className={`w-5 h-5 mb-1 ${newType === opt.type ? 'text-brand-600' : 'text-slate-400'}`} />
                  <div className="text-sm font-medium text-slate-900">{opt.label}</div>
                  <div className="text-xs text-slate-500">{opt.desc}</div>
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
