import { useEffect, useState } from 'react';
import { Globe, CheckCircle } from 'lucide-react';
import { getIAMProviders } from '../api/client';

export function IAMFederation() {
  const [providers, setProviders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getIAMProviders().then(setProviders).catch(() => {}).finally(() => setLoading(false));
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
        <p className="text-sm text-slate-500">Federation — manage SAML 2.0, OAuth 2.0, and OpenID Connect identity providers and SCIM provisioning.</p>
      </div>

      <div className="card">
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900">Identity Providers ({providers.length})</h2>
        </div>
        {providers.length > 0 ? (
          <div className="divide-y divide-slate-100">
            {providers.map((p: any) => (
              <div key={p.id} className="px-6 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Globe className="w-4 h-4 text-pink-500" />
                  <div>
                    <div className="text-sm font-medium text-slate-900">{p.name}</div>
                    <div className="text-xs text-slate-500">
                      {p.protocol} — {p.type}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={p.status === 'active' ? 'badge-green' : 'text-xs text-slate-400'}>
                    {p.status === 'active' && <CheckCircle className="w-3 h-3 mr-1" />}
                    {p.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-8 text-center text-sm text-slate-400">No identity providers registered.</div>
        )}
      </div>
    </div>
  );
}
