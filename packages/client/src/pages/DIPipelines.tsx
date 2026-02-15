import { useEffect, useState } from 'react';
import { GitBranch } from 'lucide-react';
import { getDIPipelines } from '../api/client';

export function DIPipelines() {
  const [pipelines, setPipelines] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getDIPipelines().then(setPipelines).catch(() => {}).finally(() => setLoading(false));
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
        <p className="text-sm text-slate-500">ETL/ELT pipeline definitions and execution history.</p>
      </div>

      <div className="card">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-semibold text-slate-900">Pipelines ({pipelines.length})</h2>
        </div>
        {pipelines.length > 0 ? (
          <div className="divide-y divide-slate-100">
            {pipelines.map((p) => (
              <div key={p.id} className="px-6 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <GitBranch className="w-4 h-4 text-violet-500" />
                  <div>
                    <div className="text-sm font-medium text-slate-900">{p.name}</div>
                    <div className="text-xs text-slate-500">{p.stageCount} stages</div>
                  </div>
                </div>
                <span className={p.enabled ? 'badge-green' : 'badge-gray'}>
                  {p.enabled ? 'enabled' : 'disabled'}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-8 text-center text-sm text-slate-400">No pipelines defined yet.</div>
        )}
      </div>
    </div>
  );
}
