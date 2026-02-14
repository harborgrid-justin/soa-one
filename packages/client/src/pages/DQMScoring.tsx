import { useEffect, useState } from 'react';
import { BarChart3, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { getDQMCurrentScore, getDQMScoreHistory, getDQMScoreTrend, getDQMScoreWeights } from '../api/client';

export function DQMScoring() {
  const [score, setScore] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [trend, setTrend] = useState<string>('stable');
  const [weights, setWeights] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getDQMCurrentScore(), getDQMScoreHistory(), getDQMScoreTrend(), getDQMScoreWeights()])
      .then(([s, h, t, w]) => { setScore(s); setHistory(h); setTrend(t.trend); setWeights(w); })
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
  const TrendIcon = trend === 'improving' ? TrendingUp : trend === 'degrading' ? TrendingDown : Minus;
  const trendColor = trend === 'improving' ? 'text-green-600' : trend === 'degrading' ? 'text-red-600' : 'text-slate-500';

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-slate-500">Quality scoring across 8 dimensions — completeness, accuracy, consistency, timeliness, uniqueness, validity, integrity, conformity.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="card p-6 text-center">
          <div className="text-xs text-slate-500 mb-2">Overall Quality Score</div>
          <div className={`text-4xl font-bold ${scoreColor}`}>{(overall * 100).toFixed(1)}%</div>
          <div className="text-sm text-slate-500 mt-1">Grade: {score?.grade ?? 'N/A'}</div>
        </div>
        <div className="card p-6 text-center">
          <div className="text-xs text-slate-500 mb-2">Trend</div>
          <div className="flex items-center justify-center gap-2">
            <TrendIcon className={`w-8 h-8 ${trendColor}`} />
            <div className={`text-2xl font-bold capitalize ${trendColor}`}>{trend}</div>
          </div>
        </div>
        <div className="card p-6 text-center">
          <div className="text-xs text-slate-500 mb-2">Score History</div>
          <div className="text-4xl font-bold text-slate-900">{history.length}</div>
          <div className="text-xs text-slate-400 mt-1">data points</div>
        </div>
      </div>

      {/* Dimension Weights */}
      {weights.length > 0 && (
        <div className="card">
          <div className="px-6 py-4 border-b border-slate-100">
            <h2 className="font-semibold text-slate-900">Dimension Weights</h2>
          </div>
          <div className="divide-y divide-slate-100">
            {weights.map((w: any) => (
              <div key={w.dimension} className="px-6 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <BarChart3 className="w-4 h-4 text-blue-500" />
                  <div className="text-sm font-medium text-slate-900 capitalize">{w.dimension}</div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-32 h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-brand-600 rounded-full"
                      style={{ width: `${(w.weight / Math.max(...weights.map((x: any) => x.weight))) * 100}%` }}
                    />
                  </div>
                  <span className="text-sm text-slate-600 w-10 text-right">{w.weight}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Score History */}
      {history.length > 0 && (
        <div className="card">
          <div className="px-6 py-4 border-b border-slate-100">
            <h2 className="font-semibold text-slate-900">Score History (Last {Math.min(history.length, 10)})</h2>
          </div>
          <div className="divide-y divide-slate-100">
            {history.slice(-10).reverse().map((entry: any, i: number) => {
              const s = entry.score?.overall ?? entry.overall ?? 0;
              const c = s >= 0.9 ? 'text-green-600' : s >= 0.7 ? 'text-amber-600' : 'text-red-600';
              return (
                <div key={i} className="px-6 py-3 flex items-center justify-between">
                  <div className="text-sm text-slate-600">{entry.timestamp ? new Date(entry.timestamp).toLocaleString() : `Entry ${history.length - i}`}</div>
                  <div className={`text-sm font-bold ${c}`}>{(s * 100).toFixed(1)}%</div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
