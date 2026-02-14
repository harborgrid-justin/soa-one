import { useEffect, useState } from 'react';
import { Shield, CheckCircle, AlertTriangle } from 'lucide-react';
import { getSOAPolicies, getSOASLAs } from '../api/client';

export function SOAPolicies() {
  const [policies, setPolicies] = useState<any[]>([]);
  const [slas, setSlas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getSOAPolicies(), getSOASLAs()])
      .then(([p, s]) => { setPolicies(p); setSlas(s); })
      .catch(() => {})
      .finally(() => setLoading(false));
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
        <p className="text-sm text-slate-500">Policy Manager — define security, throttling, and compliance policies with SLA enforcement and breach detection.</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="card p-4 text-center">
          <div className="text-2xl font-bold text-slate-900">{policies.length}</div>
          <div className="text-xs text-slate-500">Policies</div>
        </div>
        <div className="card p-4 text-center">
          <div className="text-2xl font-bold text-blue-600">{slas.length}</div>
          <div className="text-xs text-slate-500">SLA Definitions</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <div className="px-6 py-4 border-b border-slate-100">
            <h2 className="font-semibold text-slate-900">Policies ({policies.length})</h2>
          </div>
          {policies.length > 0 ? (
            <div className="divide-y divide-slate-100">
              {policies.map((p: any) => (
                <div key={p.id} className="px-6 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Shield className="w-4 h-4 text-slate-500" />
                    <div>
                      <div className="text-sm font-medium text-slate-900">{p.name}</div>
                      <div className="text-xs text-slate-500">{p.type} — scope: {p.scope ?? 'global'}</div>
                    </div>
                  </div>
                  <span className={p.enabled !== false ? 'badge-green' : 'text-xs text-slate-400'}>
                    {p.enabled !== false && <CheckCircle className="w-3 h-3 mr-1" />}
                    {p.enabled !== false ? 'active' : 'disabled'}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center text-sm text-slate-400">No policies defined yet.</div>
          )}
        </div>

        <div className="card">
          <div className="px-6 py-4 border-b border-slate-100">
            <h2 className="font-semibold text-slate-900">SLA Definitions ({slas.length})</h2>
          </div>
          {slas.length > 0 ? (
            <div className="divide-y divide-slate-100">
              {slas.map((s: any) => (
                <div key={s.id} className="px-6 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="w-4 h-4 text-amber-500" />
                    <div>
                      <div className="text-sm font-medium text-slate-900">{s.name}</div>
                      <div className="text-xs text-slate-500">
                        target: {s.target} — threshold: {s.threshold}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center text-sm text-slate-400">No SLA definitions yet.</div>
          )}
        </div>
      </div>
    </div>
  );
}
