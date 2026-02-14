import { useEffect, useState } from 'react';
import { Network, CheckCircle } from 'lucide-react';
import { getSOAProxies } from '../api/client';

export function SOAMesh() {
  const [proxies, setProxies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getSOAProxies().then(setProxies).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-slate-500">Service Mesh — traffic management, circuit breakers, rate limiting, retries, canary routing, and observability sidecars.</p>
      </div>

      <div className="card">
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900">Mesh Proxies ({proxies.length})</h2>
        </div>
        {proxies.length > 0 ? (
          <div className="divide-y divide-slate-100">
            {proxies.map((p: any) => (
              <div key={p.id} className="px-6 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Network className="w-4 h-4 text-teal-500" />
                  <div>
                    <div className="text-sm font-medium text-slate-900">{p.id}</div>
                    <div className="text-xs text-slate-500">
                      {p.upstreams?.length ?? 0} upstreams — LB: {p.loadBalancer ?? 'round-robin'}
                    </div>
                  </div>
                </div>
                <span className={p.healthy !== false ? 'badge-green' : 'text-xs text-red-500'}>
                  {p.healthy !== false && <CheckCircle className="w-3 h-3 mr-1" />}
                  {p.healthy !== false ? 'healthy' : 'unhealthy'}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-8 text-center text-sm text-slate-400">No mesh proxies configured yet.</div>
        )}
      </div>
    </div>
  );
}
