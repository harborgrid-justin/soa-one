import { useEffect, useState } from 'react';
import { ShieldCheck, CheckCircle } from 'lucide-react';
import { getDIQualityRules, getDIQualityScore } from '../api/client';

export function DIQuality() {
  const [rules, setRules] = useState<any[]>([]);
  const [score, setScore] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getDIQualityRules(), getDIQualityScore()])
      .then(([r, s]) => { setRules(r); setScore(s); })
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

  const overall = score?.overall ?? 0;
  const scoreColor = overall >= 0.9 ? 'text-green-600' : overall >= 0.7 ? 'text-amber-600' : 'text-red-600';

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-slate-500">Data quality profiling, validation, and scoring across all data assets.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="card p-6 text-center">
          <div className="text-xs text-slate-500 mb-2">Overall Quality Score</div>
          <div className={`text-4xl font-bold ${scoreColor}`}>{(overall * 100).toFixed(1)}%</div>
        </div>
        <div className="card p-6 text-center">
          <div className="text-xs text-slate-500 mb-2">Quality Rules</div>
          <div className="text-4xl font-bold text-slate-900">{rules.length}</div>
        </div>
        <div className="card p-6 text-center">
          <div className="text-xs text-slate-500 mb-2">Dimensions Tracked</div>
          <div className="text-4xl font-bold text-slate-900">6</div>
          <div className="text-xs text-slate-400 mt-1">completeness, accuracy, consistency, timeliness, uniqueness, validity</div>
        </div>
      </div>

      <div className="card">
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900">Quality Rules ({rules.length})</h2>
        </div>
        {rules.length > 0 ? (
          <div className="divide-y divide-slate-100">
            {rules.map((r: any) => (
              <div key={r.id} className="px-6 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <ShieldCheck className="w-4 h-4 text-emerald-500" />
                  <div>
                    <div className="text-sm font-medium text-slate-900">{r.name}</div>
                    <div className="text-xs text-slate-500">{r.type} — {r.column ?? r.table ?? 'global'}</div>
                  </div>
                </div>
                <span className={r.enabled !== false ? 'badge-green' : 'badge-gray'}>
                  {r.enabled !== false ? 'active' : 'disabled'}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-8 text-center text-sm text-slate-400">No quality rules defined yet.</div>
        )}
      </div>
    </div>
  );
}
