import { useEffect, useState } from 'react';
import { Workflow, CheckCircle, Play } from 'lucide-react';
import { getSOAProcesses } from '../api/client';

export function SOAProcesses() {
  const [processes, setProcesses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getSOAProcesses().then(setProcesses).catch(() => {}).finally(() => setLoading(false));
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
        <p className="text-sm text-slate-500">BPEL Process Engine — deploy, start, and monitor business process orchestrations with scopes and fault handlers.</p>
      </div>

      <div className="card">
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900">Process Definitions ({processes.length})</h2>
        </div>
        {processes.length > 0 ? (
          <div className="divide-y divide-slate-100">
            {processes.map((p: any) => (
              <div key={p.id} className="px-6 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Workflow className="w-4 h-4 text-emerald-500" />
                  <div>
                    <div className="text-sm font-medium text-slate-900">{p.name}</div>
                    <div className="text-xs text-slate-500">
                      v{p.version} — {p.scopeCount} scopes
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
          <div className="p-8 text-center text-sm text-slate-400">No processes deployed yet.</div>
        )}
      </div>
    </div>
  );
}
