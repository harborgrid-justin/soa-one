import { useEffect, useState } from 'react';
import { Globe, CheckCircle } from 'lucide-react';
import { getSOAServices } from '../api/client';

export function SOAServices() {
  const [services, setServices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getSOAServices().then(setServices).catch(() => {}).finally(() => setLoading(false));
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
        <p className="text-sm text-slate-500">Service Registry — register, discover, and manage versioned service contracts and endpoints.</p>
      </div>

      <div className="card">
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900">Registered Services ({services.length})</h2>
        </div>
        {services.length > 0 ? (
          <div className="divide-y divide-slate-100">
            {services.map((s: any) => (
              <div key={s.id} className="px-6 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Globe className="w-4 h-4 text-blue-500" />
                  <div>
                    <div className="text-sm font-medium text-slate-900">{s.name}</div>
                    <div className="text-xs text-slate-500">
                      v{s.version} — {s.endpointCount} endpoints — {s.contractCount} contracts — {s.dependencyCount} deps
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {s.tags?.length > 0 && (
                    <div className="flex gap-1">
                      {s.tags.slice(0, 3).map((tag: string) => (
                        <span key={tag} className="text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded">{tag}</span>
                      ))}
                    </div>
                  )}
                  <span className={s.status === 'active' ? 'badge-green' : 'text-xs text-slate-400'}>
                    {s.status === 'active' && <CheckCircle className="w-3 h-3 mr-1" />}
                    {s.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-8 text-center text-sm text-slate-400">No services registered yet.</div>
        )}
      </div>
    </div>
  );
}
