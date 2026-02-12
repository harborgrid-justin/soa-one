import { useEffect, useState } from 'react';
import {
  Key,
  Plus,
  Copy,
  Trash2,
  ToggleLeft,
  ToggleRight,
  RefreshCw,
  Shield,
  Code,
  BarChart3,
  Eye,
  EyeOff,
} from 'lucide-react';
import { Modal } from '../components/common/Modal';
import api from '../api/client';
import { useStore } from '../store';

interface ApiKey {
  id: string;
  name: string;
  key: string;
  prefix: string;
  active: boolean;
  usageCount: number;
  rateLimit: number;
  lastUsedAt: string | null;
  createdAt: string;
}

export function ApiGateway() {
  const { addNotification } = useStore();
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyRateLimit, setNewKeyRateLimit] = useState(1000);
  const [revealedKeys, setRevealedKeys] = useState<Set<string>>(new Set());
  const [activeDocTab, setActiveDocTab] = useState<'curl' | 'javascript' | 'python'>('curl');

  const fetchKeys = () => {
    setLoading(true);
    api
      .get('/api-keys')
      .then((r) => setKeys(r.data.keys || r.data || []))
      .catch(() => {
        setKeys([]);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchKeys();
  }, []);

  const handleCreate = () => {
    if (!newKeyName.trim()) {
      addNotification({ type: 'error', message: 'API key name is required' });
      return;
    }
    api
      .post('/api-keys', { name: newKeyName, rateLimit: newKeyRateLimit })
      .then((r) => {
        addNotification({ type: 'success', message: 'API key created' });
        setShowCreateModal(false);
        setNewKeyName('');
        setNewKeyRateLimit(1000);
        fetchKeys();
      })
      .catch(() => {
        addNotification({ type: 'error', message: 'Failed to create API key' });
      });
  };

  const toggleKey = (keyId: string, currentActive: boolean) => {
    api
      .put(`/api-keys/${keyId}`, { active: !currentActive })
      .then(() => {
        setKeys((prev) =>
          prev.map((k) => (k.id === keyId ? { ...k, active: !currentActive } : k))
        );
        addNotification({
          type: 'success',
          message: `API key ${!currentActive ? 'activated' : 'deactivated'}`,
        });
      })
      .catch(() => {
        addNotification({ type: 'error', message: 'Failed to update API key' });
      });
  };

  const deleteKey = (keyId: string) => {
    api
      .delete(`/api-keys/${keyId}`)
      .then(() => {
        setKeys((prev) => prev.filter((k) => k.id !== keyId));
        addNotification({ type: 'success', message: 'API key deleted' });
      })
      .catch(() => {
        addNotification({ type: 'error', message: 'Failed to delete API key' });
      });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      addNotification({ type: 'success', message: 'Copied to clipboard' });
    });
  };

  const toggleReveal = (keyId: string) => {
    setRevealedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(keyId)) next.delete(keyId);
      else next.add(keyId);
      return next;
    });
  };

  const maskKey = (key: string) => {
    if (key.length <= 8) return key;
    return key.slice(0, 8) + '...' + key.slice(-4);
  };

  const codeExamples = {
    curl: `curl -X POST https://your-domain.com/api/v1/execute/{ruleSetId} \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: your-api-key-here" \\
  -d '{"input": {"age": 25, "income": 50000}}'`,
    javascript: `import axios from 'axios';

const api = axios.create({
  baseURL: 'https://your-domain.com/api/v1',
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': 'your-api-key-here',
  },
});

const result = await api.post(\`/execute/\${ruleSetId}\`, {
  input: { age: 25, income: 50000 },
});

console.log(result.data);`,
    python: `import requests

headers = {
    "Content-Type": "application/json",
    "X-API-Key": "your-api-key-here",
}

response = requests.post(
    f"https://your-domain.com/api/v1/execute/{rule_set_id}",
    headers=headers,
    json={"input": {"age": 25, "income": 50000}},
)

print(response.json())`,
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-brand-50 flex items-center justify-center">
            <Key className="w-5 h-5 text-brand-600" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-slate-900">API Gateway</h1>
            <p className="text-sm text-slate-500">Manage API keys and view documentation</p>
          </div>
        </div>
        <button onClick={() => setShowCreateModal(true)} className="btn-primary">
          <Plus className="w-4 h-4" />
          Create API Key
        </button>
      </div>

      {/* API Keys Table */}
      <div className="card">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center gap-2">
          <Shield className="w-5 h-5 text-slate-400" />
          <h3 className="font-semibold text-slate-900">API Keys</h3>
        </div>
        {keys.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left px-6 py-3 font-medium text-slate-500">Name</th>
                  <th className="text-left px-6 py-3 font-medium text-slate-500">Key</th>
                  <th className="text-left px-6 py-3 font-medium text-slate-500">Status</th>
                  <th className="text-left px-6 py-3 font-medium text-slate-500">Usage</th>
                  <th className="text-left px-6 py-3 font-medium text-slate-500">Rate Limit</th>
                  <th className="text-left px-6 py-3 font-medium text-slate-500">Last Used</th>
                  <th className="text-right px-6 py-3 font-medium text-slate-500">Actions</th>
                </tr>
              </thead>
              <tbody>
                {keys.map((apiKey) => (
                  <tr key={apiKey.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                    <td className="px-6 py-3 font-medium text-slate-900">{apiKey.name}</td>
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-2">
                        <code className="text-xs bg-slate-100 rounded px-2 py-1 font-mono text-slate-700">
                          {revealedKeys.has(apiKey.id) ? apiKey.key : maskKey(apiKey.key || apiKey.prefix + '...')}
                        </code>
                        <button
                          onClick={() => toggleReveal(apiKey.id)}
                          className="p-1 rounded hover:bg-slate-100 text-slate-400"
                        >
                          {revealedKeys.has(apiKey.id) ? (
                            <EyeOff className="w-3.5 h-3.5" />
                          ) : (
                            <Eye className="w-3.5 h-3.5" />
                          )}
                        </button>
                        <button
                          onClick={() => copyToClipboard(apiKey.key)}
                          className="p-1 rounded hover:bg-slate-100 text-slate-400"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                    <td className="px-6 py-3">
                      <span className={apiKey.active ? 'badge-green' : 'badge-gray'}>
                        {apiKey.active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-1.5">
                        <BarChart3 className="w-3.5 h-3.5 text-slate-400" />
                        <span className="text-slate-700">
                          {apiKey.usageCount?.toLocaleString() || 0}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-3 text-slate-600">
                      {apiKey.rateLimit?.toLocaleString() || '1,000'}/hr
                    </td>
                    <td className="px-6 py-3 text-slate-500 text-xs">
                      {apiKey.lastUsedAt
                        ? new Date(apiKey.lastUsedAt).toLocaleString()
                        : 'Never'}
                    </td>
                    <td className="px-6 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => toggleKey(apiKey.id, apiKey.active)}
                          className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
                          title={apiKey.active ? 'Deactivate' : 'Activate'}
                        >
                          {apiKey.active ? (
                            <ToggleRight className="w-5 h-5 text-emerald-500" />
                          ) : (
                            <ToggleLeft className="w-5 h-5 text-slate-400" />
                          )}
                        </button>
                        <button
                          onClick={() => deleteKey(apiKey.id)}
                          className="p-1.5 rounded-lg hover:bg-red-100 text-slate-400 hover:text-red-500 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="px-6 py-16 text-center">
            <Key className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-slate-900 mb-1">No API Keys</h3>
            <p className="text-sm text-slate-500 mb-4">
              Create an API key to programmatically access your rule sets.
            </p>
            <button onClick={() => setShowCreateModal(true)} className="btn-primary btn-sm">
              <Plus className="w-3.5 h-3.5" />
              Create API Key
            </button>
          </div>
        )}
      </div>

      {/* Documentation section */}
      <div className="card">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center gap-2">
          <Code className="w-5 h-5 text-slate-400" />
          <h3 className="font-semibold text-slate-900">API Documentation</h3>
        </div>
        <div className="p-6">
          <p className="text-sm text-slate-600 mb-4">
            Use your API key to authenticate requests. Include it in the{' '}
            <code className="bg-slate-100 px-1.5 py-0.5 rounded text-xs font-mono">X-API-Key</code>{' '}
            header of every request.
          </p>

          {/* Language tabs */}
          <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-0.5 w-fit mb-4">
            {(['curl', 'javascript', 'python'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveDocTab(tab)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors capitalize ${
                  activeDocTab === tab
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          <div className="relative">
            <pre className="bg-slate-900 text-slate-100 rounded-xl p-4 text-xs font-mono overflow-x-auto leading-relaxed">
              {codeExamples[activeDocTab]}
            </pre>
            <button
              onClick={() => copyToClipboard(codeExamples[activeDocTab])}
              className="absolute top-3 right-3 p-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 transition-colors"
            >
              <Copy className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Create API Key Modal */}
      <Modal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Create API Key"
      >
        <div className="space-y-4">
          <div>
            <label className="label">Key Name</label>
            <input
              className="input"
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
              placeholder="e.g. Production Backend"
            />
          </div>
          <div>
            <label className="label">Rate Limit (requests/hour)</label>
            <input
              type="number"
              className="input"
              value={newKeyRateLimit}
              onChange={(e) => setNewKeyRateLimit(Number(e.target.value))}
              min={1}
            />
          </div>
          <div className="bg-amber-50 rounded-lg p-3 text-sm text-amber-700 flex items-start gap-2">
            <Shield className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <p>
              The API key will only be shown once after creation. Make sure to copy and store it
              securely.
            </p>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setShowCreateModal(false)} className="btn-secondary">
              Cancel
            </button>
            <button onClick={handleCreate} className="btn-primary">
              <Key className="w-4 h-4" />
              Create Key
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
