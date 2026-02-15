import { useEffect, useState } from 'react';
import { Monitor, AlertTriangle, CheckCircle, XCircle, Activity } from 'lucide-react';
import { getSOAMonitoringAlerts, acknowledgeSOAAlert, resolveSOAAlert, getSOACounters } from '../api/client';
import { useStore } from '../store';

const SEVERITY_COLORS: Record<string, string> = { critical: 'bg-red-50 text-red-700 border-red-200', warning: 'bg-amber-50 text-amber-700 border-amber-200', info: 'bg-blue-50 text-blue-700 border-blue-200' };

export function SOAMonitoring() {
  const [alerts, setAlerts] = useState<any[]>([]);
  const [counters, setCounters] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { addNotification } = useStore();

  const load = () => {
    setLoading(true);
    Promise.all([getSOAMonitoringAlerts().catch(() => []), getSOACounters().catch(() => null)]).then(([a, c]) => { setAlerts(a); setCounters(c); }).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const handleAcknowledge = async (id: string) => {
    try { await acknowledgeSOAAlert(id); addNotification({ type: 'success', message: 'Alert acknowledged' }); load(); } catch { addNotification({ type: 'error', message: 'Failed to acknowledge' }); }
  };

  const handleResolve = async (id: string) => {
    try { await resolveSOAAlert(id); addNotification({ type: 'success', message: 'Alert resolved' }); load(); } catch { addNotification({ type: 'error', message: 'Failed to resolve' }); }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" /></div>;

  const criticalCount = alerts.filter(a => a.severity === 'critical').length;
  const warningCount = alerts.filter(a => a.severity === 'warning').length;
  const activeCount = alerts.filter(a => a.status !== 'resolved').length;

  return (
    <div className="space-y-6">
      <p className="text-sm text-slate-500">SOA infrastructure monitoring and alert management.</p>
      <div className="grid grid-cols-4 gap-4">
        <div className="card p-4 text-center"><div className="text-2xl font-bold text-slate-900">{counters?.services ?? '—'}</div><div className="text-xs text-slate-500">Services</div></div>
        <div className="card p-4 text-center"><div className="text-2xl font-bold text-slate-900">{activeCount}</div><div className="text-xs text-slate-500">Active Alerts</div></div>
        <div className="card p-4 text-center"><div className="text-2xl font-bold text-red-600">{criticalCount}</div><div className="text-xs text-slate-500">Critical</div></div>
        <div className="card p-4 text-center"><div className="text-2xl font-bold text-amber-600">{warningCount}</div><div className="text-xs text-slate-500">Warnings</div></div>
      </div>
      {counters && (
        <div className="card p-6">
          <h3 className="font-medium text-slate-900 mb-4 flex items-center gap-2"><Activity className="w-4 h-4" /> System Counters</h3>
          <div className="grid grid-cols-3 gap-4 text-sm">
            {Object.entries(counters).map(([key, value]) => (
              <div key={key} className="flex justify-between p-2 bg-slate-50 rounded"><span className="text-slate-600">{key}</span><span className="font-medium">{String(value)}</span></div>
            ))}
          </div>
        </div>
      )}
      <div className="space-y-2">
        <h3 className="font-medium text-slate-900">Alerts</h3>
        {alerts.length > 0 ? alerts.map((a) => (
          <div key={a.id} className={`card px-6 py-4 flex items-center justify-between border ${SEVERITY_COLORS[a.severity] || SEVERITY_COLORS.info}`}>
            <div className="flex items-center gap-4">
              <AlertTriangle className="w-5 h-5" />
              <div><div className="font-medium">{a.message || a.name || 'Alert'}</div><div className="text-xs opacity-75">{a.source || '—'} · {a.timestamp ? new Date(a.timestamp).toLocaleString() : '—'}</div></div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${a.status === 'resolved' ? 'bg-emerald-100 text-emerald-700' : a.status === 'acknowledged' ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'}`}>{a.status || 'active'}</span>
              {a.status !== 'acknowledged' && a.status !== 'resolved' && <button onClick={() => handleAcknowledge(a.id)} className="btn-secondary btn-sm" title="Acknowledge"><CheckCircle className="w-3.5 h-3.5" /></button>}
              {a.status !== 'resolved' && <button onClick={() => handleResolve(a.id)} className="btn-secondary btn-sm" title="Resolve"><XCircle className="w-3.5 h-3.5" /></button>}
            </div>
          </div>
        )) : (
          <div className="card p-12 text-center"><Monitor className="w-10 h-10 text-slate-300 mx-auto mb-3" /><h3 className="font-semibold text-slate-900 mb-1">No alerts</h3><p className="text-sm text-slate-500">All systems operating normally.</p></div>
        )}
      </div>
    </div>
  );
}
