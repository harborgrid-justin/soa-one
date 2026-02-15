import { useEffect, useState } from 'react';
import { Users, CheckCircle, Lock } from 'lucide-react';
import { getIAMIdentities } from '../api/client';

export function IAMIdentities() {
  const [identities, setIdentities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getIAMIdentities().then(setIdentities).catch(() => {}).finally(() => setLoading(false));
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
        <p className="text-sm text-slate-500">Identity Management — create, activate, suspend, lock, and manage user and service identities.</p>
      </div>

      <div className="card">
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900">Managed Identities ({identities.length})</h2>
        </div>
        {identities.length > 0 ? (
          <div className="divide-y divide-slate-100">
            {identities.map((identity: any) => (
              <div key={identity.id} className="px-6 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Users className="w-4 h-4 text-blue-500" />
                  <div>
                    <div className="text-sm font-medium text-slate-900">{identity.username}</div>
                    <div className="text-xs text-slate-500">{identity.email}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded">{identity.type}</span>
                  <span className="text-xs text-slate-500">{identity.roleCount} roles</span>
                  <span className={
                    identity.status === 'active' ? 'badge-green' :
                    identity.status === 'suspended' ? 'text-xs text-amber-500' :
                    identity.status === 'locked' ? 'text-xs text-red-500' :
                    'text-xs text-slate-400'
                  }>
                    {identity.status === 'active' && <CheckCircle className="w-3 h-3 mr-1" />}
                    {identity.status === 'locked' && <Lock className="w-3 h-3 mr-1" />}
                    {identity.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-8 text-center text-sm text-slate-400">No identities created yet.</div>
        )}
      </div>
    </div>
  );
}
