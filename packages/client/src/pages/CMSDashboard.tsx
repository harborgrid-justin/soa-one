import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  FileText, FolderOpen, Workflow, Tags, Shield, Clock,
  MessageSquare, Image, Database, Search,
} from 'lucide-react';
import { getCMSMetrics } from '../api/client';
import type { CMSDashboardData } from '../types';

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-700',
  'pending-review': 'bg-yellow-100 text-yellow-700',
  'in-review': 'bg-blue-100 text-blue-700',
  approved: 'bg-emerald-100 text-emerald-700',
  published: 'bg-green-100 text-green-700',
  archived: 'bg-gray-100 text-gray-600',
};

export function CMSDashboard() {
  const [data, setData] = useState<CMSDashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getCMSMetrics()
      .then(setData)
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

  const s = data?.summary;

  const statCards = [
    { label: 'Documents', value: s?.totalDocuments ?? 0, icon: FileText, color: 'text-blue-600 bg-blue-50', link: '/cms/documents' },
    { label: 'Folders', value: s?.totalFolders ?? 0, icon: FolderOpen, color: 'text-amber-600 bg-amber-50', link: '/cms/documents' },
    { label: 'Workflows', value: s?.totalWorkflows ?? 0, icon: Workflow, color: 'text-violet-600 bg-violet-50', link: '/cms/workflows' },
    { label: 'Active Workflows', value: s?.activeWorkflows ?? 0, icon: Workflow, color: 'text-pink-600 bg-pink-50', link: '/cms/workflows' },
    { label: 'Taxonomies', value: s?.totalTaxonomies ?? 0, icon: Tags, color: 'text-emerald-600 bg-emerald-50', link: '/cms/taxonomies' },
    { label: 'Legal Holds', value: s?.activeLegalHolds ?? 0, icon: Shield, color: s?.activeLegalHolds ? 'text-red-600 bg-red-50' : 'text-slate-400 bg-slate-50', link: '/cms/retention' },
    { label: 'Comments', value: s?.totalComments ?? 0, icon: MessageSquare, color: 'text-slate-600 bg-slate-50', link: '/cms/documents' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-slate-500">Content Management System overview — documents, workflows, taxonomies, and governance.</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-4">
        {statCards.map((card) => (
          <NavLink key={card.label} to={card.link} className="card p-4 hover:shadow-md transition-shadow">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${card.color} mb-2`}>
              <card.icon className="w-4.5 h-4.5" />
            </div>
            <div className="text-2xl font-bold text-slate-900">{card.value}</div>
            <div className="text-xs text-slate-500">{card.label}</div>
          </NavLink>
        ))}
      </div>

      {/* Recent Documents */}
      <div className="card">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-semibold text-slate-900">Recent Documents</h2>
          <NavLink to="/cms/documents" className="text-sm text-brand-600 hover:underline">View all</NavLink>
        </div>
        {data?.recentDocuments && data.recentDocuments.length > 0 ? (
          <div className="divide-y divide-slate-100">
            {data.recentDocuments.map((doc) => (
              <div key={doc.id} className="px-6 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <FileText className="w-4 h-4 text-blue-500" />
                  <div>
                    <div className="text-sm font-medium text-slate-900">{doc.name}</div>
                    <div className="text-xs text-slate-500">{doc.category} &middot; {formatBytes(doc.sizeBytes)}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[doc.status] || 'bg-slate-100 text-slate-600'}`}>
                    {doc.status}
                  </span>
                  <span className="text-xs text-slate-400 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {new Date(doc.updatedAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-8 text-center text-sm text-slate-400">No documents yet.</div>
        )}
      </div>

      {/* Status & Category Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <div className="px-6 py-4 border-b border-slate-100">
            <h2 className="font-semibold text-slate-900">By Status</h2>
          </div>
          {data?.statusBreakdown && data.statusBreakdown.length > 0 ? (
            <div className="p-6 space-y-3">
              {data.statusBreakdown.map((item) => (
                <div key={item.status} className="flex items-center justify-between">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[item.status] || 'bg-slate-100 text-slate-600'}`}>
                    {item.status}
                  </span>
                  <span className="text-sm font-mono text-slate-700">{item.count}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-6 text-center text-sm text-slate-400">No data</div>
          )}
        </div>
        <div className="card">
          <div className="px-6 py-4 border-b border-slate-100">
            <h2 className="font-semibold text-slate-900">By Category</h2>
          </div>
          {data?.categoryBreakdown && data.categoryBreakdown.length > 0 ? (
            <div className="p-6 space-y-3">
              {data.categoryBreakdown.map((item) => (
                <div key={item.category} className="flex items-center justify-between">
                  <span className="text-sm text-slate-700 capitalize">{item.category}</span>
                  <span className="text-sm font-mono text-slate-700">{item.count}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-6 text-center text-sm text-slate-400">No data</div>
          )}
        </div>
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { to: '/cms/documents', label: 'Document Library', desc: 'Browse and manage content', icon: FileText, color: 'text-blue-600' },
          { to: '/cms/search', label: 'Search', desc: 'Full-text search across documents', icon: Search, color: 'text-violet-600' },
          { to: '/cms/workflows', label: 'Workflows', desc: 'Document approval & review flows', icon: Workflow, color: 'text-amber-600' },
          { to: '/cms/taxonomies', label: 'Taxonomies', desc: 'Classify and organize content', icon: Tags, color: 'text-emerald-600' },
        ].map((link) => (
          <NavLink key={link.to} to={link.to} className="card p-5 hover:shadow-md transition-shadow group">
            <link.icon className={`w-6 h-6 ${link.color} mb-2`} />
            <div className="font-medium text-slate-900 group-hover:text-brand-600 transition-colors">{link.label}</div>
            <div className="text-xs text-slate-500 mt-1">{link.desc}</div>
          </NavLink>
        ))}
      </div>
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}
