import { useEffect, useState } from 'react';
import { GitBranch } from 'lucide-react';
import { getDQMMatchingRules } from '../api/client';

export function DQMMatching() {
  const [rules, setRules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getDQMMatchingRules().then(setRules).catch(() => {}).finally(() => setLoading(false));
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
        <p className="text-sm text-slate-500">Record matching and deduplication — exact, fuzzy, Levenshtein, Jaro-Winkler, Soundex, and 12 algorithms.</p>
      </div>

      <div className="card">
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900">Match Rules ({rules.length})</h2>
        </div>
        {rules.length > 0 ? (
          <div className="divide-y divide-slate-100">
            {rules.map((r: any) => (
              <div key={r.id} className="px-6 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <GitBranch className="w-4 h-4 text-amber-500" />
                  <div>
                    <div className="text-sm font-medium text-slate-900">{r.name}</div>
                    <div className="text-xs text-slate-500">
                      threshold: {r.threshold ?? 0.8} — fields: {r.fields?.length ?? 0}
                    </div>
                  </div>
                </div>
                <span className={r.enabled !== false ? 'badge-green' : 'badge-gray'}>
                  {r.enabled !== false ? 'active' : 'disabled'}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-8 text-center text-sm text-slate-400">No match rules defined yet.</div>
        )}
      </div>
    </div>
  );
}
