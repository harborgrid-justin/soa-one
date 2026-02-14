import { useEffect, useState } from 'react';
import { ShieldAlert, AlertTriangle, Activity } from 'lucide-react';
import { getIAMAnomalies, getIAMMetrics } from '../api/client';

export function IAMRisk() {
  const [anomalies, setAnomalies] = useState<any[]>([]);
  const [metrics, setMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      getIAMAnomalies().catch(() => []),
      getIAMMetrics().catch(() => ({}))
    ]).then(([a, m]) => {
      setAnomalies(a);
      setMetrics(m);
    }).finally(() => setLoading(false));
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
        <p className="text-sm text-slate-500">Risk Engine — adaptive risk scoring, behavioral analytics, anomaly detection, and threat intelligence.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs text-slate-500">Average Risk Score</div>
            <Activity className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-semibold text-slate-900">{metrics?.averageRiskScore || 0}</div>
          <div className="mt-2 h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div className={`h-full ${
              (metrics?.averageRiskScore || 0) > 70 ? 'bg-red-500' :
              (metrics?.averageRiskScore || 0) > 40 ? 'bg-orange-500' :
              'bg-green-500'
            }`} style={{ width: `${metrics?.averageRiskScore || 0}%` }} />
          </div>
        </div>

        <div className="card p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs text-slate-500">High Risk Sessions</div>
            <AlertTriangle className="w-4 h-4 text-orange-500" />
          </div>
          <div className="text-2xl font-semibold text-slate-900">{metrics?.highRiskSessions || 0}</div>
        </div>

        <div className="card p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs text-slate-500">Anomalies Detected</div>
            <ShieldAlert className="w-4 h-4 text-red-500" />
          </div>
          <div className="text-2xl font-semibold text-slate-900">{metrics?.anomaliesDetected || 0}</div>
        </div>

        <div className="card p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs text-slate-500">Active Threat Indicators</div>
            <AlertTriangle className="w-4 h-4 text-red-600" />
          </div>
          <div className="text-2xl font-semibold text-slate-900">{metrics?.activeThreatIndicators || 0}</div>
        </div>
      </div>

      <div className="card">
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900">Recent Anomalies ({anomalies.length})</h2>
        </div>
        {anomalies.length > 0 ? (
          <div className="divide-y divide-slate-100">
            {anomalies.map((a: any) => (
              <div key={a.id} className="px-6 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <ShieldAlert className={`w-4 h-4 ${
                    a.severity === 'critical' ? 'text-red-600' :
                    a.severity === 'high' ? 'text-orange-600' :
                    a.severity === 'medium' ? 'text-yellow-600' :
                    'text-slate-500'
                  }`} />
                  <div>
                    <div className="text-sm font-medium text-slate-900">{a.type}</div>
                    <div className="text-xs text-slate-500">{a.identityId} — {a.description}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-xs text-slate-400">
                    {new Date(a.detectedAt).toLocaleString()}
                  </div>
                  <span className={
                    a.severity === 'critical' ? 'text-xs px-2 py-0.5 bg-red-50 text-red-600 rounded' :
                    a.severity === 'high' ? 'text-xs px-2 py-0.5 bg-orange-50 text-orange-600 rounded' :
                    a.severity === 'medium' ? 'text-xs px-2 py-0.5 bg-yellow-50 text-yellow-600 rounded' :
                    'text-xs px-2 py-0.5 bg-slate-50 text-slate-600 rounded'
                  }>
                    {a.severity}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-8 text-center text-sm text-slate-400">No anomalies detected.</div>
        )}
      </div>
    </div>
  );
}
