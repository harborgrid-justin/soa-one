import { useEffect, useState } from 'react';
import { Code2, CheckCircle } from 'lucide-react';
import { getSOAAPIs } from '../api/client';

export function SOAAPIs() {
  const [apis, setApis] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getSOAAPIs().then(setApis).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const STATUS_COLORS: Record<string, string> = {
    created: 'bg-slate-100 text-slate-600',
    published: 'bg-green-100 text-green-700',
    deprecated: 'bg-amber-100 text-amber-700',
    retired: 'bg-red-100 text-red-700',
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-slate-500">API Gateway — full lifecycle API management with versioning, rate limiting, and API key management.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-4 text-center">
          <div className="text-2xl font-bold text-slate-900">{apis.length}</div>
          <div className="text-xs text-slate-500">Total APIs</div>
        </div>
        <div className="card p-4 text-center">
          <div className="text-2xl font-bold text-green-600">{apis.filter((a) => a.status === 'published').length}</div>
          <div className="text-xs text-slate-500">Published</div>
        </div>
        <div className="card p-4 text-center">
          <div className="text-2xl font-bold text-amber-600">{apis.filter((a) => a.status === 'deprecated').length}</div>
          <div className="text-xs text-slate-500">Deprecated</div>
        </div>
        <div className="card p-4 text-center">
          <div className="text-2xl font-bold text-red-600">{apis.filter((a) => a.status === 'retired').length}</div>
          <div className="text-xs text-slate-500">Retired</div>
        </div>
      </div>

      <div className="card">
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900">Managed APIs ({apis.length})</h2>
        </div>
        {apis.length > 0 ? (
          <div className="divide-y divide-slate-100">
            {apis.map((a: any) => (
              <div key={a.id} className="px-6 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Code2 className="w-4 h-4 text-indigo-500" />
                  <div>
                    <div className="text-sm font-medium text-slate-900">{a.name}</div>
                    <div className="text-xs text-slate-500">
                      v{a.version} — {a.basePath} — {a.routeCount} routes
                    </div>
                  </div>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[a.status] ?? 'bg-slate-100 text-slate-600'}`}>
                  {a.status}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-8 text-center text-sm text-slate-400">No APIs registered yet.</div>
        )}
      </div>
    </div>
  );
}
