import { useEffect, useState } from 'react';
import { Shield, Download, RefreshCw, User, Clock, Filter } from 'lucide-react';
import { getAuditLogs } from '../api/client';

const ACTION_COLORS: Record<string, string> = {
  create: 'badge-green',
  update: 'badge-blue',
  delete: 'badge-red',
  execute: 'badge-yellow',
  publish: 'badge-green',
  rollback: 'badge-yellow',
  login: 'badge-blue',
  logout: 'badge-gray',
  invite: 'badge-blue',
};

const ENTITY_ICONS: Record<string, string> = {
  project: 'P',
  ruleSet: 'RS',
  rule: 'R',
  decisionTable: 'DT',
  dataModel: 'DM',
  workflow: 'WF',
  adapter: 'AD',
  user: 'U',
  tenant: 'T',
};

export function AuditLog() {
  const [logs, setLogs] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ action: '', entity: '', limit: 50 });

  const load = () => {
    setLoading(true);
    const params: any = { limit: filter.limit };
    if (filter.action) params.action = filter.action;
    if (filter.entity) params.entity = filter.entity;

    getAuditLogs(params)
      .then((data) => {
        setLogs(data.logs || []);
        setTotal(data.total || 0);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [filter]);

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(logs, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-log-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">
          Complete audit trail of all changes and actions. {total} total entries.
        </p>
        <div className="flex items-center gap-2">
          <button onClick={load} className="btn-secondary btn-sm" disabled={loading}>
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button onClick={handleExport} className="btn-secondary btn-sm">
            <Download className="w-3.5 h-3.5" /> Export
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4 flex items-center gap-4">
        <Filter className="w-4 h-4 text-slate-400" />
        <select
          className="input py-1.5 w-40 text-sm"
          value={filter.action}
          onChange={(e) => setFilter((f) => ({ ...f, action: e.target.value }))}
        >
          <option value="">All Actions</option>
          <option value="create">Create</option>
          <option value="update">Update</option>
          <option value="delete">Delete</option>
          <option value="execute">Execute</option>
          <option value="publish">Publish</option>
          <option value="login">Login</option>
          <option value="invite">Invite</option>
        </select>
        <select
          className="input py-1.5 w-40 text-sm"
          value={filter.entity}
          onChange={(e) => setFilter((f) => ({ ...f, entity: e.target.value }))}
        >
          <option value="">All Entities</option>
          <option value="project">Project</option>
          <option value="ruleSet">Rule Set</option>
          <option value="rule">Rule</option>
          <option value="workflow">Workflow</option>
          <option value="adapter">Adapter</option>
          <option value="user">User</option>
          <option value="tenant">Tenant</option>
        </select>
      </div>

      {/* Log entries */}
      <div className="card">
        {logs.length > 0 ? (
          <div className="divide-y divide-slate-100">
            {logs.map((log) => (
              <div key={log.id} className="px-6 py-4 flex items-start gap-4">
                <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-500 flex-shrink-0">
                  {ENTITY_ICONS[log.entity] || '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-slate-900 text-sm">
                      {log.userName || log.user?.name || 'System'}
                    </span>
                    <span className={ACTION_COLORS[log.action] || 'badge-gray'}>
                      {log.action}
                    </span>
                    <span className="text-sm text-slate-500">
                      {log.entity}{log.entityName ? `: ${log.entityName}` : ''}
                    </span>
                  </div>
                  {(log.before || log.after) && (
                    <div className="mt-2 flex gap-4 text-xs">
                      {log.before && (
                        <div className="bg-red-50 rounded p-2 flex-1">
                          <div className="font-medium text-red-600 mb-1">Before</div>
                          <pre className="text-red-700 whitespace-pre-wrap">{JSON.stringify(log.before, null, 2)}</pre>
                        </div>
                      )}
                      {log.after && (
                        <div className="bg-emerald-50 rounded p-2 flex-1">
                          <div className="font-medium text-emerald-600 mb-1">After</div>
                          <pre className="text-emerald-700 whitespace-pre-wrap">{JSON.stringify(log.after, null, 2)}</pre>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <div className="text-xs text-slate-400 flex items-center gap-1 flex-shrink-0">
                  <Clock className="w-3 h-3" />
                  {new Date(log.createdAt).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="px-6 py-16 text-center">
            <Shield className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-sm text-slate-500">No audit log entries found.</p>
          </div>
        )}
      </div>
    </div>
  );
}
