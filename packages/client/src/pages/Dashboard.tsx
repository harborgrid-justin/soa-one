import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  FolderOpen,
  GitBranch,
  FileCheck,
  Table2,
  Activity,
  Zap,
  TrendingUp,
  Clock,
} from 'lucide-react';
import { getDashboardStats } from '../api/client';
import type { DashboardStats } from '../types';

export function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getDashboardStats()
      .then(setStats)
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

  const cards = [
    { label: 'Projects', value: stats?.projects ?? 0, icon: FolderOpen, color: 'text-blue-600 bg-blue-50', link: '/projects' },
    { label: 'Rule Sets', value: stats?.ruleSets ?? 0, icon: GitBranch, color: 'text-purple-600 bg-purple-50', link: '/rule-sets' },
    { label: 'Rules', value: stats?.rules ?? 0, icon: FileCheck, color: 'text-emerald-600 bg-emerald-50', link: '/rule-sets' },
    { label: 'Decision Tables', value: stats?.decisionTables ?? 0, icon: Table2, color: 'text-amber-600 bg-amber-50', link: '/decision-tables' },
  ];

  const metricCards = [
    { label: 'Total Executions', value: stats?.totalExecutions ?? 0, icon: Zap, color: 'text-brand-600' },
    { label: 'Success Rate', value: `${stats?.successRate ?? 100}%`, icon: TrendingUp, color: 'text-emerald-600' },
    { label: 'Avg Response', value: `${stats?.avgExecutionTimeMs ?? 0}ms`, icon: Clock, color: 'text-amber-600' },
  ];

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div className="card p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Welcome to SOA One</h2>
            <p className="text-sm text-slate-500 mt-1">Enterprise Business Rules Platform</p>
          </div>
          <Link to="/projects" className="btn-primary">
            <FolderOpen className="w-4 h-4" />
            Open Projects
          </Link>
        </div>
      </div>

      {/* Resource counts */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card) => (
          <Link key={card.label} to={card.link} className="card p-5 hover:shadow-md transition-shadow group">
            <div className="flex items-center justify-between mb-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${card.color}`}>
                <card.icon className="w-5 h-5" />
              </div>
            </div>
            <div className="text-2xl font-bold text-slate-900">{card.value}</div>
            <div className="text-sm text-slate-500">{card.label}</div>
          </Link>
        ))}
      </div>

      {/* Execution metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {metricCards.map((card) => (
          <div key={card.label} className="card p-5">
            <div className="flex items-center gap-3 mb-2">
              <card.icon className={`w-5 h-5 ${card.color}`} />
              <span className="text-sm text-slate-500">{card.label}</span>
            </div>
            <div className="text-2xl font-bold text-slate-900">{card.value}</div>
          </div>
        ))}
      </div>

      {/* Recent executions */}
      <div className="card">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h3 className="font-semibold text-slate-900">Recent Executions</h3>
          <Link to="/monitoring" className="text-sm text-brand-600 hover:text-brand-700">
            View All
          </Link>
        </div>
        {stats?.recentExecutions && stats.recentExecutions.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left px-6 py-3 font-medium text-slate-500">Rule Set</th>
                  <th className="text-left px-6 py-3 font-medium text-slate-500">Status</th>
                  <th className="text-left px-6 py-3 font-medium text-slate-500">Duration</th>
                  <th className="text-left px-6 py-3 font-medium text-slate-500">Time</th>
                </tr>
              </thead>
              <tbody>
                {stats.recentExecutions.slice(0, 10).map((exec: any) => (
                  <tr key={exec.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                    <td className="px-6 py-3 font-medium text-slate-900">{exec.ruleSet?.name || exec.ruleSetId}</td>
                    <td className="px-6 py-3">
                      <span className={exec.status === 'success' ? 'badge-green' : 'badge-red'}>
                        {exec.status}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-slate-600">{exec.executionTimeMs}ms</td>
                    <td className="px-6 py-3 text-slate-500">{new Date(exec.createdAt).toLocaleTimeString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="px-6 py-12 text-center">
            <Activity className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-sm text-slate-500">No executions yet. Run your first rule set to see results here.</p>
          </div>
        )}
      </div>
    </div>
  );
}
