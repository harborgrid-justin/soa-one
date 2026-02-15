import { useEffect, useState } from 'react';
import { Activity, AlertTriangle, CheckCircle, Bell } from 'lucide-react';
import { getDQMAlerts, acknowledgeDQMAlert, resolveDQMAlert, getDQMAlertRules, getDQMMetrics } from '../api/client';
import { useStore } from '../store';

const SEV_COLORS: Record<string, string> = { critical: 'bg-red-50 text-red-700', high: 'bg-orange-50 text-orange-700', medium: 'bg-amber-50 text-amber-700', low: 'bg-blue-50 text-blue-700', info: 'bg-slate-100 text-slate-600' };

export function DQMMonitoring() {
  const [alerts, setAlerts] = useState<any[]>([]);
  const [alertRules, setAlertRules] = useState<any[]>([]);
  const [metrics, setMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { addNotification } = useStore();

  const load = () => {
    setLoading(true);
    Promise.all([getDQMAlerts().catch(() => []), getDQMAlertRules().catch(() => []), getDQMMetrics().catch(() => null)])
      .then(([a, r, m]) => { setAlerts(a); setAlertRules(r); setMetrics(m); })
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const handleAcknowledge = async (id: string) => {
    try { await acknowledgeDQMAlert(id); addNotification({ type: 'success', message: 'Alert acknowledged' }); load(); } catch { addNotification({ type: 'error', message: 'Failed to acknowledge alert' }); }
  };

  const handleResolve = async (id: string) => {
    try { await resolveDQMAlert(id); addNotification({ type: 'success', message: 'Alert resolved' }); load(); } catch { addNotification({ type: 'error', message: 'Failed to resolve alert' }); }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" /></div>;

  const summary = metrics?.summary;

  return (
    <div className="space-y-6">
      {summary && (
        <div className="grid grid-cols-4 gap-4">
          <div className="card p-4 text-center"><div className="text-2xl font-bold text-slate-900">{summary.totalQualityRules ?? 0}</div><div className="text-xs text-slate-500">Quality Rules</div></div>
          <div className="card p-4 text-center"><div className="text-2xl font-bold text-emerald-600">{summary.currentQualityScore ?? 0}%</div><div className="text-xs text-slate-500">Quality Score</div></div>
          <div className="card p-4 text-center"><div className="text-2xl font-bold text-amber-600">{alerts.length}</div><div className="text-xs text-slate-500">Active Alerts</div></div>
          <div className="card p-4 text-center"><div className="text-2xl font-bold text-blue-600">{summary.totalTopics ?? 0}</div><div className="text-xs text-slate-500">Topics</div></div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-amber-500" /><h3 className="font-semibold text-slate-900">Alerts ({alerts.length})</h3></div>
          <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
            {alerts.length > 0 ? alerts.map((a) => (
              <div key={a.id} className="px-6 py-3">
                <div className="flex items-center justify-between mb-1">
                  <div className="text-sm font-medium text-slate-900">{a.message || a.ruleName || 'Alert'}</div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${SEV_COLORS[a.severity] || SEV_COLORS.info}`}>{a.severity}</span>
                </div>
                <div className="flex gap-2 mt-1">
                  {a.status !== 'acknowledged' && <button onClick={() => handleAcknowledge(a.id)} className="text-xs text-blue-600 hover:underline">Acknowledge</button>}
                  {a.status !== 'resolved' && <button onClick={() => handleResolve(a.id)} className="text-xs text-emerald-600 hover:underline">Resolve</button>}
                </div>
              </div>
            )) : <div className="px-6 py-8 text-center text-sm text-slate-400 flex flex-col items-center"><CheckCircle className="w-6 h-6 text-emerald-300 mb-2" />No active alerts</div>}
          </div>
        </div>

        <div className="card">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2"><Bell className="w-4 h-4 text-blue-500" /><h3 className="font-semibold text-slate-900">Alert Rules ({alertRules.length})</h3></div>
          <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
            {alertRules.length > 0 ? alertRules.map((r, i) => (
              <div key={i} className="px-6 py-3 flex items-center justify-between">
                <div><div className="text-sm font-medium text-slate-900">{r.name || `Rule ${i + 1}`}</div><div className="text-xs text-slate-500">{r.condition || r.type || ''}</div></div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${r.enabled !== false ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{r.enabled !== false ? 'Active' : 'Disabled'}</span>
              </div>
            )) : <div className="px-6 py-8 text-center text-sm text-slate-400">No alert rules configured</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
