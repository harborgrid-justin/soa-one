import { useEffect, useState } from 'react';
import { BarChart3 } from 'lucide-react';
import { getDQMCurrentScore, getDQMScoreHistory, getDQMScoreTrend, getDQMScoreWeights } from '../api/client';

export function DQMScoring() {
  const [score, setScore] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [trend, setTrend] = useState<any>(null);
  const [weights, setWeights] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getDQMCurrentScore().catch(() => null), getDQMScoreHistory().catch(() => []), getDQMScoreTrend().catch(() => null), getDQMScoreWeights().catch(() => null)])
      .then(([s, h, t, w]) => { setScore(s); setHistory(Array.isArray(h) ? h : []); setTrend(t); setWeights(w); })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6">
      {score && (
        <div className="card p-6">
          <div className="flex items-center gap-4 mb-4">
            <div className={`w-20 h-20 rounded-full flex items-center justify-center text-3xl font-bold ${(score.overall ?? 0) >= 80 ? 'bg-emerald-50 text-emerald-700' : (score.overall ?? 0) >= 60 ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700'}`}>{score.overall ?? 0}%</div>
            <div><div className="text-lg font-semibold text-slate-900">Overall Quality Score</div><div className="text-sm text-slate-500">Grade: {score.grade || 'N/A'} · {score.ruleCount ?? 0} rules evaluated</div></div>
          </div>
          {score.dimensions && (
            <div className="grid grid-cols-4 gap-3">{Object.entries(score.dimensions).map(([k, v]: any) => (
              <div key={k} className="text-center p-3 bg-slate-50 rounded-lg">
                <div className="text-xl font-bold">{v ?? 0}%</div>
                <div className="text-xs text-slate-500 capitalize">{k}</div>
                <div className="mt-1 h-1.5 bg-slate-200 rounded-full overflow-hidden"><div className={`h-full rounded-full ${v >= 80 ? 'bg-emerald-500' : v >= 60 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${v ?? 0}%` }} /></div>
              </div>
            ))}</div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {trend && (
          <div className="card p-6">
            <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2"><BarChart3 className="w-4 h-4" /> Score Trend</h3>
            <div className="space-y-2 text-sm text-slate-600">
              <div>Direction: <span className={`font-medium ${trend.direction === 'improving' ? 'text-emerald-600' : trend.direction === 'declining' ? 'text-red-600' : 'text-slate-600'}`}>{trend.direction || 'stable'}</span></div>
              {trend.change != null && <div>Change: {trend.change > 0 ? '+' : ''}{trend.change}%</div>}
            </div>
          </div>
        )}

        {weights && (
          <div className="card p-6">
            <h3 className="font-semibold text-slate-900 mb-4">Dimension Weights</h3>
            <div className="space-y-2">{Object.entries(weights).map(([k, v]: any) => (
              <div key={k} className="flex items-center justify-between text-sm">
                <span className="capitalize text-slate-600">{k}</span>
                <span className="font-medium text-slate-900">{v}%</span>
              </div>
            ))}</div>
          </div>
        )}
      </div>

      {history.length > 0 && (
        <div className="card p-6">
          <h3 className="font-semibold text-slate-900 mb-4">Score History</h3>
          <div className="space-y-2 max-h-60 overflow-y-auto">{history.map((h, i) => (
            <div key={i} className="flex items-center justify-between text-sm py-1 border-b border-slate-50">
              <span className="text-slate-500">{h.date || h.timestamp ? new Date(h.date || h.timestamp).toLocaleDateString() : `Entry ${i + 1}`}</span>
              <span className={`font-semibold ${(h.score ?? h.overall ?? 0) >= 80 ? 'text-emerald-600' : (h.score ?? h.overall ?? 0) >= 60 ? 'text-amber-600' : 'text-red-600'}`}>{h.score ?? h.overall ?? 0}%</span>
            </div>
          ))}</div>
        </div>
      )}
    </div>
  );
}
