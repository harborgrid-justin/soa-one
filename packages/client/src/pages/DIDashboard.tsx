import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  Database, GitBranch, Radio, Copy, Clock, BookOpen,
  AlertTriangle, Activity, Shield, Search, CheckCircle,
} from 'lucide-react';
import { getDIMetrics } from '../api/client';
import type { DIDashboardData } from '../types';

export function DIDashboard() {
  const [data, setData] = useState<DIDashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getDIMetrics()
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
    { label: 'Connectors', value: s?.totalConnectors ?? 0, icon: Database, color: 'text-blue-600 bg-blue-50', link: '/di/connectors' },
    { label: 'Pipelines', value: s?.totalPipelines ?? 0, icon: GitBranch, color: 'text-violet-600 bg-violet-50', link: '/di/pipelines' },
    { label: 'CDC Streams', value: s?.totalCDCStreams ?? 0, icon: Radio, color: 'text-emerald-600 bg-emerald-50', link: '/di/cdc' },
    { label: 'Replication', value: s?.totalReplicationStreams ?? 0, icon: Copy, color: 'text-pink-600 bg-pink-50', link: '/di/replication' },
    { label: 'Schedules', value: s?.totalSchedules ?? 0, icon: Clock, color: 'text-amber-600 bg-amber-50', link: '/di/schedules' },
    { label: 'Catalog', value: s?.catalogEntries ?? 0, icon: BookOpen, color: 'text-slate-600 bg-slate-50', link: '/di/catalog' },
    { label: 'Alerts', value: s?.activeAlerts ?? 0, icon: AlertTriangle, color: s?.activeAlerts ? 'text-red-600 bg-red-50' : 'text-slate-400 bg-slate-50', link: '/di/alerts' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-slate-500">Data Integration overview — connectors, pipelines, CDC streams, and data catalog.</p>
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

      {/* Active Connectors */}
      <div className="card">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-semibold text-slate-900">Active Connectors</h2>
          <NavLink to="/di/connectors" className="text-sm text-brand-600 hover:underline">View all</NavLink>
        </div>
        {data?.connectors && data.connectors.length > 0 ? (
          <div className="divide-y divide-slate-100">
            {data.connectors.map((conn) => (
              <div key={conn.id} className="px-6 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Database className="w-4 h-4 text-blue-500" />
                  <div>
                    <div className="text-sm font-medium text-slate-900">{conn.name}</div>
                    <div className="text-xs text-slate-500">{conn.type}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={
                    conn.status === 'connected' || conn.status === 'active' ? 'badge-green' :
                    conn.status === 'error' || conn.status === 'failed' ? 'badge-red' : 'badge-gray'
                  }>
                    {conn.isConnected && <CheckCircle className="w-3 h-3 mr-1" />}
                    {conn.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-8 text-center text-sm text-slate-400">No connectors configured yet.</div>
        )}
      </div>

      {/* Recent Pipelines */}
      <div className="card">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-semibold text-slate-900">Recent Pipelines</h2>
          <NavLink to="/di/pipelines" className="text-sm text-brand-600 hover:underline">View all</NavLink>
        </div>
        {data?.pipelines && data.pipelines.length > 0 ? (
          <div className="divide-y divide-slate-100">
            {data.pipelines.map((pipe) => (
              <div key={pipe.id} className="px-6 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <GitBranch className="w-4 h-4 text-violet-500" />
                  <div>
                    <div className="text-sm font-medium text-slate-900">{pipe.name}</div>
                    <div className="text-xs text-slate-500">{pipe.stageCount} stages</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={pipe.enabled ? 'badge-green' : 'badge-gray'}>
                    {pipe.enabled && <CheckCircle className="w-3 h-3 mr-1" />}
                    {pipe.enabled ? 'active' : 'idle'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-8 text-center text-sm text-slate-400">No pipelines configured yet.</div>
        )}
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { to: '/di/connectors', label: 'Connectors', desc: 'Manage data source and target connections', icon: Database, color: 'text-blue-600' },
          { to: '/di/pipelines', label: 'Pipelines', desc: 'Build and monitor data pipelines', icon: GitBranch, color: 'text-violet-600' },
          { to: '/di/cdc', label: 'CDC', desc: 'Change data capture streams', icon: Radio, color: 'text-emerald-600' },
          { to: '/di/catalog', label: 'Catalog', desc: 'Browse data catalog and lineage', icon: BookOpen, color: 'text-amber-600' },
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
