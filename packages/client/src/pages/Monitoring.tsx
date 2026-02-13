import { useEffect, useState } from 'react';
import { Activity, CheckCircle, XCircle, Clock, TrendingUp, RefreshCw } from 'lucide-react';
import { getDashboardStats } from '../api/client';
import type { DashboardStats } from '../types';

export function Monitoring() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    getDashboardStats()
      .then(setStats)
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  if (loading && !stats) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">Real-time monitoring of rule executions and system health.</p>
        <button onClick={load} className="btn-secondary btn-sm" disabled={loading}>
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-brand-50 flex items-center justify-center">
              <Activity className="w-5 h-5 text-brand-600" />
            </div>
            <span className="text-sm text-slate-500">Total Executions</span>
          </div>
          <div className="text-3xl font-bold text-slate-900">{stats?.totalExecutions ?? 0}</div>
        </div>
        <div className="card p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-emerald-600" />
            </div>
            <span className="text-sm text-slate-500">Success Rate</span>
          </div>
          <div className="text-3xl font-bold text-slate-900">{stats?.successRate ?? 100}%</div>
        </div>
        <div className="card p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center">
              <Clock className="w-5 h-5 text-amber-600" />
            </div>
            <span className="text-sm text-slate-500">Avg Response</span>
          </div>
          <div className="text-3xl font-bold text-slate-900">{stats?.avgExecutionTimeMs ?? 0}<span className="text-sm font-normal text-slate-500">ms</span></div>
        </div>
        <div className="card p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-red-50 flex items-center justify-center">
              <XCircle className="w-5 h-5 text-red-600" />
            </div>
            <span className="text-sm text-slate-500">Errors</span>
          </div>
          <div className="text-3xl font-bold text-slate-900">{stats?.errorCount ?? 0}</div>
        </div>
      </div>

      {/* Recent executions */}
      <div className="card">
        <div className="px-6 py-4 border-b border-slate-200">
          <h3 className="font-semibold text-slate-900">Execution History</h3>
        </div>
        {stats?.recentExecutions && stats.recentExecutions.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left px-6 py-3 font-medium text-slate-500">Rule Set</th>
                  <th className="text-left px-6 py-3 font-medium text-slate-500">Version</th>
                  <th className="text-left px-6 py-3 font-medium text-slate-500">Status</th>
                  <th className="text-left px-6 py-3 font-medium text-slate-500">Duration</th>
                  <th className="text-left px-6 py-3 font-medium text-slate-500">Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {stats.recentExecutions.map((exec: any) => (
                  <tr key={exec.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                    <td className="px-6 py-3 font-medium text-slate-900">
                      {exec.ruleSet?.name || exec.ruleSetId.slice(0, 8)}
                    </td>
                    <td className="px-6 py-3 text-slate-600">v{exec.version}</td>
                    <td className="px-6 py-3">
                      <span className={exec.status === 'success' ? 'badge-green' : 'badge-red'}>
                        {exec.status === 'success' ? (
                          <><CheckCircle className="w-3 h-3 mr-1" /> success</>
                        ) : (
                          <><XCircle className="w-3 h-3 mr-1" /> error</>
                        )}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-slate-600 font-mono text-xs">{exec.executionTimeMs}ms</td>
                    <td className="px-6 py-3 text-slate-500 text-xs">
                      {new Date(exec.createdAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="px-6 py-12 text-center">
            <Activity className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-sm text-slate-500">No executions recorded yet.</p>
          </div>
        )}
      </div>
    </div>
  );
}
