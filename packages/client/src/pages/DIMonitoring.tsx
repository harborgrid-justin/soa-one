import { useEffect, useState } from 'react';
import { Activity, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { getDIAlerts, getDIPipelineHealth, getDIMetrics } from '../api/client';
import type { DIDashboardData } from '../types';

const SEVERITY_COLORS: Record<string, string> = { critical: 'bg-red-50 text-red-700', high: 'bg-orange-50 text-orange-700', medium: 'bg-amber-50 text-amber-700', low: 'bg-blue-50 text-blue-700', info: 'bg-slate-100 text-slate-600' };

export function DIMonitoring() {
  const [alerts, setAlerts] = useState<any[]>([]);
  const [health, setHealth] = useState<any[]>([]);
  const [metrics, setMetrics] = useState<DIDashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getDIAlerts().catch(() => []), getDIPipelineHealth().catch(() => []), getDIMetrics().catch(() => null)])
      .then(([a, h, m]) => { setAlerts(a); setHealth(h); setMetrics(m); })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" /></div>;

  const summary = metrics?.summary;

  return (
    <div className="space-y-6">
      {summary && (
        <div className="grid grid-cols-4 gap-4">
          <div className="card p-4 text-center"><div className="text-2xl font-bold text-slate-900">{summary.totalPipelines ?? 0}</div><div className="text-xs text-slate-500">Total Pipelines</div></div>
          <div className="card p-4 text-center"><div className="text-2xl font-bold text-emerald-600">{summary.activePipelines ?? 0}</div><div className="text-xs text-slate-500">Active</div></div>
          <div className="card p-4 text-center"><div className="text-2xl font-bold text-red-600">{summary.activeAlerts ?? alerts.length}</div><div className="text-xs text-slate-500">Alerts</div></div>
          <div className="card p-4 text-center"><div className="text-2xl font-bold text-blue-600">{summary.qualityScore ?? 0}%</div><div className="text-xs text-slate-500">Quality Score</div></div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-amber-500" /><h3 className="font-semibold text-slate-900">Active Alerts ({alerts.length})</h3></div>
          <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
            {alerts.length > 0 ? alerts.map((a, i) => (
              <div key={i} className="px-6 py-3 flex items-center justify-between">
                <div><div className="text-sm font-medium text-slate-900">{a.ruleName || a.message || 'Alert'}</div><div className="text-xs text-slate-500">{a.message || ''}</div></div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${SEVERITY_COLORS[a.severity] || SEVERITY_COLORS.info}`}>{a.severity}</span>
              </div>
            )) : <div className="px-6 py-8 text-center text-sm text-slate-400">No active alerts</div>}
          </div>
        </div>

        <div className="card">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2"><Activity className="w-4 h-4 text-blue-500" /><h3 className="font-semibold text-slate-900">Pipeline Health ({health.length})</h3></div>
          <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
            {health.length > 0 ? health.map((h, i) => (
              <div key={i} className="px-6 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {h.status === 'healthy' ? <CheckCircle className="w-4 h-4 text-emerald-500" /> : <XCircle className="w-4 h-4 text-red-500" />}
                  <div><div className="text-sm font-medium text-slate-900">{h.pipelineName}</div><div className="text-xs text-slate-500">{h.successRate != null ? `${h.successRate}% success` : ''} · avg {h.averageDurationMs ?? 0}ms</div></div>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${h.status === 'healthy' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>{h.status}</span>
              </div>
            )) : <div className="px-6 py-8 text-center text-sm text-slate-400">No health data</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
