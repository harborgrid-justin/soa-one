import { useEffect, useState } from 'react';
import { Monitor, Activity, Users, ShieldCheck, Key, AlertTriangle } from 'lucide-react';
import { getIAMMetrics } from '../api/client';

export function IAMMonitoring() {
  const [metrics, setMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { getIAMMetrics().then(setMetrics).catch(() => {}).finally(() => setLoading(false)); }, []);

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" /></div>;

  const cards = [
    { label: 'Identities', value: metrics?.identities ?? metrics?.totalIdentities ?? '—', icon: Users, color: 'bg-blue-50 text-blue-600' },
    { label: 'Active Sessions', value: metrics?.activeSessions ?? '—', icon: Monitor, color: 'bg-emerald-50 text-emerald-600' },
    { label: 'Roles', value: metrics?.roles ?? metrics?.totalRoles ?? '—', icon: ShieldCheck, color: 'bg-violet-50 text-violet-600' },
    { label: 'Active Tokens', value: metrics?.activeTokens ?? '—', icon: Key, color: 'bg-amber-50 text-amber-600' },
    { label: 'Auth Requests (24h)', value: metrics?.authRequests24h ?? '—', icon: Activity, color: 'bg-sky-50 text-sky-600' },
    { label: 'Failed Logins (24h)', value: metrics?.failedLogins24h ?? '—', icon: AlertTriangle, color: 'bg-red-50 text-red-600' },
  ];

  return (
    <div className="space-y-6">
      <p className="text-sm text-slate-500">IAM system overview and health metrics.</p>
      <div className="grid grid-cols-3 gap-4">
        {cards.map(c => {
          const Icon = c.icon;
          return (
            <div key={c.label} className="card p-5">
              <div className="flex items-center gap-3 mb-2">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${c.color}`}><Icon className="w-5 h-5" /></div>
                <span className="text-sm text-slate-500">{c.label}</span>
              </div>
              <div className="text-2xl font-bold text-slate-900">{c.value}</div>
            </div>
          );
        })}
      </div>
      {metrics && (
        <div className="card p-6">
          <h3 className="font-medium text-slate-900 mb-4">All Metrics</h3>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(metrics).map(([key, value]) => (
              <div key={key} className="flex justify-between p-2 bg-slate-50 rounded text-sm">
                <span className="text-slate-600">{key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase())}</span>
                <span className="font-medium text-slate-900">{String(value)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {!metrics && (
        <div className="card p-12 text-center"><Monitor className="w-10 h-10 text-slate-300 mx-auto mb-3" /><h3 className="font-semibold text-slate-900 mb-1">No metrics available</h3><p className="text-sm text-slate-500">IAM metrics service is not responding.</p></div>
      )}
    </div>
  );
}
