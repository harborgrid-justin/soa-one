import { useEffect, useState } from 'react';
import { BarChart3, AlertTriangle, CheckCircle } from 'lucide-react';
import { getSOAKPIs, getSOABAMAlerts } from '../api/client';

export function SOABAM() {
  const [kpis, setKpis] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getSOAKPIs(), getSOABAMAlerts()])
      .then(([k, a]) => { setKpis(k); setAlerts(a); })
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

  const SEVERITY_COLORS: Record<string, string> = {
    critical: 'bg-red-100 text-red-700',
    warning: 'bg-amber-100 text-amber-700',
    info: 'bg-blue-100 text-blue-700',
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-slate-500">Business Activity Monitoring — KPI tracking, dashboards, alert rules, and real-time business metrics.</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="card p-4 text-center">
          <div className="text-2xl font-bold text-orange-600">{kpis.length}</div>
          <div className="text-xs text-slate-500">KPI Definitions</div>
        </div>
        <div className="card p-4 text-center">
          <div className="text-2xl font-bold text-red-600">{alerts.length}</div>
          <div className="text-xs text-slate-500">Active BAM Alerts</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <div className="px-6 py-4 border-b border-slate-100">
            <h2 className="font-semibold text-slate-900">KPIs ({kpis.length})</h2>
          </div>
          {kpis.length > 0 ? (
            <div className="divide-y divide-slate-100">
              {kpis.map((k: any) => (
                <div key={k.id} className="px-6 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <BarChart3 className="w-4 h-4 text-orange-500" />
                    <div>
                      <div className="text-sm font-medium text-slate-900">{k.name}</div>
                      <div className="text-xs text-slate-500">
                        unit: {k.unit ?? 'value'} — aggregation: {k.aggregation ?? 'latest'}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center text-sm text-slate-400">No KPIs defined yet.</div>
          )}
        </div>

        <div className="card">
          <div className="px-6 py-4 border-b border-slate-100">
            <h2 className="font-semibold text-slate-900">BAM Alerts ({alerts.length})</h2>
          </div>
          {alerts.length > 0 ? (
            <div className="divide-y divide-slate-100">
              {alerts.map((a: any) => (
                <div key={a.id} className="px-6 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <AlertTriangle className={`w-4 h-4 ${a.severity === 'critical' ? 'text-red-500' : 'text-amber-500'}`} />
                    <div>
                      <div className="text-sm font-medium text-slate-900">{a.ruleName ?? a.rule}</div>
                      <div className="text-xs text-slate-500">{a.message}</div>
                    </div>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${SEVERITY_COLORS[a.severity] ?? 'bg-slate-100 text-slate-600'}`}>
                    {a.severity}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center text-sm text-slate-400">
              <CheckCircle className="w-6 h-6 text-green-400 mx-auto mb-2" />
              No active BAM alerts
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
