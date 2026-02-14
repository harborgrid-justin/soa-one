import { useEffect, useState } from 'react';
import { Database, Plus, Trash2, CheckCircle, XCircle } from 'lucide-react';
import { getDIConnectors, createDIConnector, deleteDIConnector } from '../api/client';

export function DIConnectors() {
  const [connectors, setConnectors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    getDIConnectors().then(setConnectors).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

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
        <p className="text-sm text-slate-500">Manage data connectors — JDBC, files, APIs, cloud, and streaming sources.</p>
      </div>

      <div className="card">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-semibold text-slate-900">Connectors ({connectors.length})</h2>
        </div>
        {connectors.length > 0 ? (
          <div className="divide-y divide-slate-100">
            {connectors.map((c) => (
              <div key={c.id} className="px-6 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Database className="w-4 h-4 text-blue-500" />
                  <div>
                    <div className="text-sm font-medium text-slate-900">{c.name}</div>
                    <div className="text-xs text-slate-500">{c.type}{c.dialect ? ` / ${c.dialect}` : ''}{c.host ? ` — ${c.host}` : ''}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={c.isConnected ? 'badge-green' : 'badge-gray'}>
                    {c.isConnected ? <CheckCircle className="w-3 h-3 mr-1" /> : <XCircle className="w-3 h-3 mr-1" />}
                    {c.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-8 text-center text-sm text-slate-400">No connectors configured yet.</div>
        )}
      </div>
    </div>
  );
}
