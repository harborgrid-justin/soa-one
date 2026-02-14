import { useEffect, useState } from 'react';
import { Vault, CheckCircle } from 'lucide-react';
import { getIAMPAMAccounts } from '../api/client';

export function IAMPAM() {
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getIAMPAMAccounts().then(setAccounts).catch(() => {}).finally(() => setLoading(false));
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
        <p className="text-sm text-slate-500">Privileged Access Management — credential vaults, privileged account checkout/checkin, session recording, and command restrictions.</p>
      </div>

      <div className="card">
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900">Privileged Accounts ({accounts.length})</h2>
        </div>
        {accounts.length > 0 ? (
          <div className="divide-y divide-slate-100">
            {accounts.map((a: any) => (
              <div key={a.id} className="px-6 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Vault className="w-4 h-4 text-teal-500" />
                  <div>
                    <div className="text-sm font-medium text-slate-900">{a.name}</div>
                    <div className="text-xs text-slate-500">{a.platform}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded">{a.type}</span>
                  <div className="text-xs text-slate-400">
                    rotated {new Date(a.lastRotated).toLocaleDateString()}
                  </div>
                  <span className={a.status === 'active' ? 'badge-green' : 'text-xs text-slate-400'}>
                    {a.status === 'active' && <CheckCircle className="w-3 h-3 mr-1" />}
                    {a.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-8 text-center text-sm text-slate-400">No privileged accounts registered.</div>
        )}
      </div>
    </div>
  );
}
