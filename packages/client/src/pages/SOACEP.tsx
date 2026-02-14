import { useEffect, useState } from 'react';
import { Zap, CheckCircle } from 'lucide-react';
import { getSOACEPRules } from '../api/client';

export function SOACEP() {
  const [rules, setRules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getSOACEPRules().then(setRules).catch(() => {}).finally(() => setLoading(false));
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
        <p className="text-sm text-slate-500">Complex Event Processing — define temporal patterns, aggregation rules, and real-time event correlation across 10 pattern types.</p>
      </div>

      <div className="card">
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900">CEP Rules ({rules.length})</h2>
        </div>
        {rules.length > 0 ? (
          <div className="divide-y divide-slate-100">
            {rules.map((r: any) => (
              <div key={r.id} className="px-6 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Zap className="w-4 h-4 text-amber-500" />
                  <div>
                    <div className="text-sm font-medium text-slate-900">{r.name}</div>
                    <div className="text-xs text-slate-500">
                      {r.patterns?.length ?? 0} patterns — window: {r.window?.duration ?? 'none'}
                    </div>
                  </div>
                </div>
                <span className={r.enabled !== false ? 'badge-green' : 'text-xs text-slate-400'}>
                  {r.enabled !== false && <CheckCircle className="w-3 h-3 mr-1" />}
                  {r.enabled !== false ? 'enabled' : 'disabled'}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-8 text-center text-sm text-slate-400">No CEP rules registered yet.</div>
        )}
      </div>
    </div>
  );
}
