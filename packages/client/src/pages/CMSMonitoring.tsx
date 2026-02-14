import { useEffect, useState } from 'react';
import {
  Activity, FileText, FolderOpen, Workflow, Tags,
  Shield, Clock, MessageSquare, Image, Database,
  RefreshCw, TrendingUp,
} from 'lucide-react';
import { getCMSMetrics, getCMSAudit } from '../api/client';
import type { CMSDashboardData } from '../types';

interface AuditEntry {
  id: string;
  userName: string | null;
  action: string;
  entity: string;
  entityName: string | null;
  createdAt: string;
}

export function CMSMonitoring() {
  const [data, setData] = useState<CMSDashboardData | null>(null);
  const [recentActivity, setRecentActivity] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    Promise.all([getCMSMetrics(), getCMSAudit({ limit: 20 })])
      .then(([metrics, audit]) => { setData(metrics); setRecentActivity(audit); })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const s = data?.summary;

  const metrics = [
    { label: 'Documents', value: s?.totalDocuments ?? 0, icon: FileText, color: 'text-blue-600 bg-blue-50' },
    { label: 'Folders', value: s?.totalFolders ?? 0, icon: FolderOpen, color: 'text-amber-600 bg-amber-50' },
    { label: 'Workflows', value: s?.totalWorkflows ?? 0, icon: Workflow, color: 'text-violet-600 bg-violet-50' },
    { label: 'Active Workflows', value: s?.activeWorkflows ?? 0, icon: TrendingUp, color: 'text-pink-600 bg-pink-50' },
    { label: 'Taxonomies', value: s?.totalTaxonomies ?? 0, icon: Tags, color: 'text-emerald-600 bg-emerald-50' },
    { label: 'Retention Policies', value: s?.retentionPolicies ?? 0, icon: Shield, color: 'text-indigo-600 bg-indigo-50' },
    { label: 'Active Legal Holds', value: s?.activeLegalHolds ?? 0, icon: Shield, color: s?.activeLegalHolds ? 'text-red-600 bg-red-50' : 'text-slate-400 bg-slate-50' },
    { label: 'Comments', value: s?.totalComments ?? 0, icon: MessageSquare, color: 'text-cyan-600 bg-cyan-50' },
    { label: 'Renditions', value: s?.totalRenditions ?? 0, icon: Image, color: 'text-fuchsia-600 bg-fuchsia-50' },
    { label: 'Metadata Schemas', value: s?.metadataSchemas ?? 0, icon: Database, color: 'text-teal-600 bg-teal-50' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">Content management system health, metrics, and activity monitoring.</p>
        <button onClick={load} className="btn-secondary btn-sm">
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {metrics.map((m) => (
          <div key={m.label} className="card p-4">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${m.color} mb-2`}>
              <m.icon className="w-4.5 h-4.5" />
            </div>
            <div className="text-2xl font-bold text-slate-900">{m.value}</div>
            <div className="text-xs text-slate-500">{m.label}</div>
          </div>
        ))}
      </div>

      {/* Status and Category Breakdown side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <div className="px-6 py-4 border-b border-slate-100">
            <h2 className="font-semibold text-slate-900">Documents by Status</h2>
          </div>
          {data?.statusBreakdown && data.statusBreakdown.length > 0 ? (
            <div className="p-6 space-y-2">
              {data.statusBreakdown.map((item) => {
                const total = data.statusBreakdown.reduce((acc, i) => acc + i.count, 0);
                const pct = total > 0 ? Math.round((item.count / total) * 100) : 0;
                return (
                  <div key={item.status}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-slate-700 capitalize">{item.status.replace(/-/g, ' ')}</span>
                      <span className="text-slate-500 font-mono">{item.count} ({pct}%)</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full">
                      <div className="h-2 bg-brand-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-6 text-center text-sm text-slate-400">No data</div>
          )}
        </div>

        <div className="card">
          <div className="px-6 py-4 border-b border-slate-100">
            <h2 className="font-semibold text-slate-900">Documents by Category</h2>
          </div>
          {data?.categoryBreakdown && data.categoryBreakdown.length > 0 ? (
            <div className="p-6 space-y-2">
              {data.categoryBreakdown.map((item) => {
                const total = data.categoryBreakdown.reduce((acc, i) => acc + i.count, 0);
                const pct = total > 0 ? Math.round((item.count / total) * 100) : 0;
                return (
                  <div key={item.category}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-slate-700 capitalize">{item.category}</span>
                      <span className="text-slate-500 font-mono">{item.count} ({pct}%)</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full">
                      <div className="h-2 bg-emerald-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-6 text-center text-sm text-slate-400">No data</div>
          )}
        </div>
      </div>

      {/* Recent Activity */}
      <div className="card">
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900">Recent Activity</h2>
        </div>
        {recentActivity.length > 0 ? (
          <div className="divide-y divide-slate-100">
            {recentActivity.map((entry) => (
              <div key={entry.id} className="px-6 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Activity className="w-4 h-4 text-slate-400" />
                  <div className="text-sm">
                    <span className="font-medium text-slate-900">{entry.userName || 'System'}</span>
                    <span className="mx-1 text-slate-400">{entry.action}</span>
                    <span className="text-slate-600">{entry.entity}</span>
                    {entry.entityName && <span className="text-slate-500 ml-1">"{entry.entityName}"</span>}
                  </div>
                </div>
                <span className="text-xs text-slate-400 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {new Date(entry.createdAt).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-8 text-center text-sm text-slate-400">No recent activity.</div>
        )}
      </div>
    </div>
  );
}
