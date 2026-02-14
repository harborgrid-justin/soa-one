import { useEffect, useState } from 'react';
import { KeyRound, CheckCircle } from 'lucide-react';
import { getIAMSessions } from '../api/client';

export function IAMSessions() {
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getIAMSessions().then(setSessions).catch(() => {}).finally(() => setLoading(false));
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
        <p className="text-sm text-slate-500">Session Management — monitor active sessions, SSO sessions, and session bindings.</p>
      </div>

      <div className="card">
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900">Active Sessions ({sessions.length})</h2>
        </div>
        {sessions.length > 0 ? (
          <div className="divide-y divide-slate-100">
            {sessions.map((s: any) => (
              <div key={s.id} className="px-6 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <KeyRound className="w-4 h-4 text-violet-500" />
                  <div>
                    <div className="text-sm font-medium text-slate-900">{s.identityId}</div>
                    <div className="text-xs text-slate-500">
                      {s.ipAddress} — {s.userAgent}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right text-xs text-slate-500">
                    <div>Created: {new Date(s.createdAt).toLocaleString()}</div>
                    <div>Expires: {new Date(s.expiresAt).toLocaleString()}</div>
                  </div>
                  <span className={s.status === 'active' ? 'badge-green' : 'text-xs text-slate-400'}>
                    {s.status === 'active' && <CheckCircle className="w-3 h-3 mr-1" />}
                    {s.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-8 text-center text-sm text-slate-400">No active sessions.</div>
        )}
      </div>
    </div>
  );
}
