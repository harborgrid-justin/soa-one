import { useEffect, useState } from 'react';
import { Activity, AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import { getDIAlerts, getDIPipelineHealth, getDIMetrics } from '../api/client';
import type { DIDashboardData } from '../types';

export function DIMonitoring() {
  const [alerts, setAlerts] = useState<any[]>([]);
  const [health, setHealth] = useState<any[]>([]);
  const [metrics, setMetrics] = useState<DIDashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getDIAlerts(), getDIPipelineHealth(), getDIMetrics()])
      .then(([a, h, m]) => { setAlerts(a); setHealth(h); setMetrics(m); })
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

  const HEALTH_COLORS: Record<string, string> = {
    healthy: 'badge-green',
    degraded: 'badge-yellow',
    unhealthy: 'badge-red',
    unknown: 'badge-gray',
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-slate-500">Data Integration monitoring — alerts, pipeline health, and system metrics.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-4 text-center">
          <div className="text-2xl font-bold text-slate-900">{s?.totalPipelines ?? 0}</div>
          <div className="text-xs text-slate-500">Total Pipelines</div>
        </div>
        <div className="card p-4 text-center">
          <div className="text-2xl font-bold text-slate-900">{s?.activePipelines ?? 0}</div>
          <div className="text-xs text-slate-500">Active Pipelines</div>
        </div>
        <div className="card p-4 text-center">
          <div className="text-2xl font-bold text-slate-900">{s?.activeAlerts ?? 0}</div>
          <div className="text-xs text-slate-500">Active Alerts</div>
        </div>
        <div className="card p-4 text-center">
          <div className="text-2xl font-bold text-slate-900">{((s?.qualityScore ?? 0) * 100).toFixed(0)}%</div>
          <div className="text-xs text-slate-500">Quality Score</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
                      <div className="text-sm font-medium text-slate-900">{alert.ruleName}</div>
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

        <div className="card">
          <div className="px-6 py-4 border-b border-slate-100">
            <h2 className="font-semibold text-slate-900">Pipeline Health ({health.length})</h2>
          </div>
          {health.length > 0 ? (
            <div className="divide-y divide-slate-100">
              {health.map((h: any) => (
                <div key={h.pipelineId} className="px-6 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Activity className="w-4 h-4 text-slate-500" />
                    <div>
                      <div className="text-sm font-medium text-slate-900">{h.pipelineName}</div>
                      <div className="text-xs text-slate-500">
                        {(h.successRate * 100).toFixed(0)}% success rate — avg {h.averageDurationMs?.toFixed(0)}ms
                      </div>
                    </div>
                  </div>
                  <span className={HEALTH_COLORS[h.status] ?? 'badge-gray'}>{h.status}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center text-sm text-slate-400">No pipeline health data yet.</div>
          )}
        </div>
      </div>
    </div>
  );
}
