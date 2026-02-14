import { useEffect, useState } from 'react';
import { Building2, FileText, CheckCircle } from 'lucide-react';
import { getSOAPartners, getSOAAgreements, getSOAExchanges } from '../api/client';

export function SOAB2B() {
  const [partners, setPartners] = useState<any[]>([]);
  const [agreements, setAgreements] = useState<any[]>([]);
  const [exchanges, setExchanges] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getSOAPartners(), getSOAAgreements(), getSOAExchanges()])
      .then(([p, a, e]) => { setPartners(p); setAgreements(a); setExchanges(e); })
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

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-slate-500">B2B Gateway — manage trading partners, agreements, and document exchanges with protocol support.</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="card p-4 text-center">
          <div className="text-2xl font-bold text-pink-600">{partners.length}</div>
          <div className="text-xs text-slate-500">Partners</div>
        </div>
        <div className="card p-4 text-center">
          <div className="text-2xl font-bold text-indigo-600">{agreements.length}</div>
          <div className="text-xs text-slate-500">Agreements</div>
        </div>
        <div className="card p-4 text-center">
          <div className="text-2xl font-bold text-slate-900">{exchanges.length}</div>
          <div className="text-xs text-slate-500">Exchanges</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <div className="px-6 py-4 border-b border-slate-100">
            <h2 className="font-semibold text-slate-900">Trading Partners ({partners.length})</h2>
          </div>
          {partners.length > 0 ? (
            <div className="divide-y divide-slate-100">
              {partners.map((p: any) => (
                <div key={p.id} className="px-6 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Building2 className="w-4 h-4 text-pink-500" />
                    <div>
                      <div className="text-sm font-medium text-slate-900">{p.name}</div>
                      <div className="text-xs text-slate-500">{p.contactEmail ?? p.id}</div>
                    </div>
                  </div>
                  <span className={p.status === 'active' ? 'badge-green' : 'text-xs text-slate-400'}>
                    {p.status === 'active' && <CheckCircle className="w-3 h-3 mr-1" />}
                    {p.status}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center text-sm text-slate-400">No partners registered yet.</div>
          )}
        </div>

        <div className="card">
          <div className="px-6 py-4 border-b border-slate-100">
            <h2 className="font-semibold text-slate-900">Recent Exchanges ({exchanges.length})</h2>
          </div>
          {exchanges.length > 0 ? (
            <div className="divide-y divide-slate-100">
              {exchanges.slice(0, 10).map((e: any) => (
                <div key={e.id} className="px-6 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <FileText className="w-4 h-4 text-indigo-500" />
                    <div>
                      <div className="text-sm font-medium text-slate-900">{e.documentType}</div>
                      <div className="text-xs text-slate-500">{e.direction} — {e.format}</div>
                    </div>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    e.status === 'delivered' ? 'bg-green-100 text-green-700' :
                    e.status === 'failed' ? 'bg-red-100 text-red-700' :
                    'bg-blue-100 text-blue-700'
                  }`}>
                    {e.status}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center text-sm text-slate-400">No document exchanges yet.</div>
          )}
        </div>
      </div>
    </div>
  );
}
