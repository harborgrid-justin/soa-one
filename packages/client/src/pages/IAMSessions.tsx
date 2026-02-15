import { useEffect, useState } from 'react';
import { MonitorSmartphone, XCircle } from 'lucide-react';
import { getIAMSessions, revokeIAMSession } from '../api/client';
import { useStore } from '../store';

const STATUS_COLORS: Record<string, string> = { active: 'bg-emerald-50 text-emerald-700', expired: 'bg-slate-100 text-slate-500', revoked: 'bg-red-50 text-red-700' };

export function IAMSessions() {
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { addNotification } = useStore();

  const load = () => { setLoading(true); getIAMSessions().then(setSessions).catch(() => {}).finally(() => setLoading(false)); };
  useEffect(() => { load(); }, []);

  const handleRevoke = async (id: string) => {
    if (!confirm('Revoke this session?')) return;
    try { await revokeIAMSession(id); addNotification({ type: 'success', message: 'Session revoked' }); load(); } catch { addNotification({ type: 'error', message: 'Failed to revoke session' }); }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" /></div>;

  const activeCount = sessions.filter(s => s.status === 'active').length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">Monitor and manage active user sessions.</p>
        <div className="text-sm text-slate-600">{activeCount} active session{activeCount !== 1 ? 's' : ''}</div>
      </div>
      {sessions.length > 0 ? (
        <div className="space-y-2">
          {sessions.map((s) => (
            <div key={s.id} className="card px-6 py-4 flex items-center justify-between group">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center"><MonitorSmartphone className="w-5 h-5" /></div>
                <div>
                  <div className="font-medium text-slate-900">{s.identityName || s.identityId || 'Unknown'}</div>
                  <div className="text-xs text-slate-500">
                    {s.ipAddress || '—'}{s.userAgent ? ` · ${s.userAgent.slice(0, 40)}` : ''}
                    {s.createdAt ? ` · Started ${new Date(s.createdAt).toLocaleString()}` : ''}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[s.status] || STATUS_COLORS.expired}`}>{s.status || 'unknown'}</span>
                {s.status === 'active' && <button onClick={() => handleRevoke(s.id)} className="btn-secondary btn-sm text-red-600 hover:bg-red-50" title="Revoke"><XCircle className="w-3.5 h-3.5" /></button>}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="card p-16 text-center"><MonitorSmartphone className="w-10 h-10 text-slate-300 mx-auto mb-3" /><h3 className="font-semibold text-slate-900 mb-1">No sessions</h3><p className="text-sm text-slate-500">No active sessions found.</p></div>
      )}
    </div>
  );
}
