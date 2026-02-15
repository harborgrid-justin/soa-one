import { useEffect, useState } from 'react';
import { ShieldCheck, Shield, FileText, CheckCircle, Clock } from 'lucide-react';
import { getIAMCampaigns, getIAMSoDPolicies, getIAMAccessRequests } from '../api/client';

export function IAMGovernance() {
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [sodPolicies, setSodPolicies] = useState<any[]>([]);
  const [accessRequests, setAccessRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      getIAMCampaigns().catch(() => []),
      getIAMSoDPolicies().catch(() => []),
      getIAMAccessRequests().catch(() => [])
    ]).then(([c, s, a]) => {
      setCampaigns(c);
      setSodPolicies(s);
      setAccessRequests(a);
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
        <p className="text-sm text-slate-500">Identity Governance — certification campaigns, Segregation of Duties policies, and access request workflows.</p>
      </div>

      <div className="card">
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900">Certification Campaigns ({campaigns.length})</h2>
        </div>
        {campaigns.length > 0 ? (
          <div className="divide-y divide-slate-100">
            {campaigns.map((c: any) => (
              <div key={c.id} className="px-6 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <ShieldCheck className="w-4 h-4 text-indigo-500" />
                  <div>
                    <div className="text-sm font-medium text-slate-900">{c.name}</div>
                    <div className="text-xs text-slate-500">{c.type}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-24">
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-indigo-500" style={{ width: `${c.completionPercentage}%` }} />
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">{c.completionPercentage}%</div>
                  </div>
                  <span className={c.status === 'active' ? 'badge-green' : c.status === 'completed' ? 'badge-blue' : 'text-xs text-slate-400'}>
                    {c.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-8 text-center text-sm text-slate-400">No certification campaigns.</div>
        )}
      </div>

      <div className="card">
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900">SoD Policies ({sodPolicies.length})</h2>
        </div>
        {sodPolicies.length > 0 ? (
          <div className="divide-y divide-slate-100">
            {sodPolicies.map((p: any) => (
              <div key={p.id} className="px-6 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Shield className="w-4 h-4 text-slate-500" />
                  <div>
                    <div className="text-sm font-medium text-slate-900">{p.name}</div>
                    <div className="text-xs text-slate-500">{p.type}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={
                    p.severity === 'critical' ? 'text-xs px-2 py-0.5 bg-red-50 text-red-600 rounded' :
                    p.severity === 'high' ? 'text-xs px-2 py-0.5 bg-orange-50 text-orange-600 rounded' :
                    p.severity === 'medium' ? 'text-xs px-2 py-0.5 bg-yellow-50 text-yellow-600 rounded' :
                    'text-xs px-2 py-0.5 bg-slate-50 text-slate-600 rounded'
                  }>
                    {p.severity}
                  </span>
                  <span className={p.enabled ? 'badge-green' : 'text-xs text-slate-400'}>
                    {p.enabled ? <CheckCircle className="w-3 h-3 mr-1" /> : null}
                    {p.enabled ? 'enabled' : 'disabled'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-8 text-center text-sm text-slate-400">No SoD policies configured.</div>
        )}
      </div>

      <div className="card">
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900">Pending Access Requests ({accessRequests.length})</h2>
        </div>
        {accessRequests.length > 0 ? (
          <div className="divide-y divide-slate-100">
            {accessRequests.map((r: any) => (
              <div key={r.id} className="px-6 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <FileText className="w-4 h-4 text-amber-500" />
                  <div>
                    <div className="text-sm font-medium text-slate-900">{r.identityId}</div>
                    <div className="text-xs text-slate-500">{r.resource}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={
                    r.status === 'pending' ? 'text-xs px-2 py-0.5 bg-amber-50 text-amber-600 rounded flex items-center' :
                    r.status === 'approved' ? 'text-xs px-2 py-0.5 bg-green-50 text-green-600 rounded flex items-center' :
                    r.status === 'rejected' ? 'text-xs px-2 py-0.5 bg-red-50 text-red-600 rounded flex items-center' :
                    'text-xs text-slate-400'
                  }>
                    {r.status === 'pending' && <Clock className="w-3 h-3 mr-1" />}
                    {r.status === 'approved' && <CheckCircle className="w-3 h-3 mr-1" />}
                    {r.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-8 text-center text-sm text-slate-400">No pending access requests.</div>
        )}
      </div>
    </div>
  );
}
