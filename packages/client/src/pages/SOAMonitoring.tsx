import { useEffect, useState } from 'react';
import { Activity, AlertTriangle, CheckCircle } from 'lucide-react';
import { getSOAMonitoringAlerts, getSOAMetrics } from '../api/client';
import type { SOADashboardData } from '../types';

export function SOAMonitoring() {
  const [alerts, setAlerts] = useState<any[]>([]);
  const [metrics, setMetrics] = useState<SOADashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getSOAMonitoringAlerts(), getSOAMetrics()])
      .then(([a, m]) => { setAlerts(a); setMetrics(m); })
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

  const s = metrics?.summary;

  const SEVERITY_COLORS: Record<string, string> = {
    critical: 'bg-red-100 text-red-700',
    warning: 'bg-amber-100 text-amber-700',
    info: 'bg-blue-100 text-blue-700',
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-slate-500">SOA monitoring — alerts, process metrics, task tracking, and operational counters.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-4 text-center">
          <div className="text-2xl font-bold text-emerald-600">{s?.completedProcessInstances ?? 0}</div>
          <div className="text-xs text-slate-500">Completed Processes</div>
        </div>
        <div className="card p-4 text-center">
          <div className="text-2xl font-bold text-red-600">{s?.faultedProcessInstances ?? 0}</div>
          <div className="text-xs text-slate-500">Faulted Processes</div>
        </div>
        <div className="card p-4 text-center">
          <div className="text-2xl font-bold text-amber-600">{s?.eventsProcessed ?? 0}</div>
          <div className="text-xs text-slate-500">CEP Events</div>
        </div>
        <div className="card p-4 text-center">
          <div className="text-2xl font-bold text-blue-600">{s?.apiRequestsTotal ?? 0}</div>
          <div className="text-xs text-slate-500">API Requests</div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-4 text-center">
          <div className="text-2xl font-bold text-violet-600">{s?.pendingTasks ?? 0}</div>
          <div className="text-xs text-slate-500">Pending Tasks</div>
        </div>
        <div className="card p-4 text-center">
          <div className="text-2xl font-bold text-slate-900">{s?.overdueTasks ?? 0}</div>
          <div className="text-xs text-slate-500">Overdue Tasks</div>
        </div>
        <div className="card p-4 text-center">
          <div className="text-2xl font-bold text-pink-600">{s?.documentsExchanged ?? 0}</div>
          <div className="text-xs text-slate-500">B2B Docs Exchanged</div>
        </div>
        <div className="card p-4 text-center">
          <div className="text-2xl font-bold text-red-600">{s?.slaBreaches ?? 0}</div>
          <div className="text-xs text-slate-500">SLA Breaches</div>
        </div>
      </div>

      <div className="card">
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900">Active Alerts ({alerts.length})</h2>
        </div>
        {alerts.length > 0 ? (
          <div className="divide-y divide-slate-100">
            {alerts.map((alert: any) => (
              <div key={alert.id} className="px-6 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <AlertTriangle className={`w-4 h-4 ${alert.severity === 'critical' ? 'text-red-500' : 'text-amber-500'}`} />
                  <div>
                    <div className="text-sm font-medium text-slate-900">{alert.ruleName ?? alert.rule}</div>
                    <div className="text-xs text-slate-500">{alert.message}</div>
                  </div>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${SEVERITY_COLORS[alert.severity] ?? 'bg-slate-100 text-slate-600'}`}>
                  {alert.severity}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-8 text-center text-sm text-slate-400">
            <CheckCircle className="w-6 h-6 text-green-400 mx-auto mb-2" />
            No active alerts
          </div>
        )}
      </div>
    </div>
  );
}
