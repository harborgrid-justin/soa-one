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
  CheckSquare,
  Bell,
  FlaskRound,
  Store,
  BarChart3,
} from 'lucide-react';
import { getDashboardStats } from '../api/client';
import { StatCard } from '../components/common/StatCard';
import { Skeleton, StatsSkeleton, TableSkeleton } from '../components/common/Skeleton';
import { Tooltip } from '../components/common/Tooltip';
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
      <div className="space-y-6">
        <div className="card p-6">
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-64" />
            </div>
            <div className="flex items-center gap-2">
              <Skeleton className="h-9 w-28 rounded-lg" />
              <Skeleton className="h-9 w-32 rounded-lg" />
            </div>
          </div>
        </div>
        <StatsSkeleton count={4} />
        <StatsSkeleton count={3} />
        <TableSkeleton rows={5} columns={4} />
      </div>
    );
  }

  const cards = [
    { label: 'Projects', value: stats?.projects ?? 0, icon: <FolderOpen className="w-5 h-5" />, iconColor: 'text-blue-600 bg-blue-50', link: '/projects' },
    { label: 'Rule Sets', value: stats?.ruleSets ?? 0, icon: <GitBranch className="w-5 h-5" />, iconColor: 'text-purple-600 bg-purple-50', link: '/rule-sets' },
    { label: 'Rules', value: stats?.rules ?? 0, icon: <FileCheck className="w-5 h-5" />, iconColor: 'text-emerald-600 bg-emerald-50', link: '/rule-sets' },
    { label: 'Decision Tables', value: stats?.decisionTables ?? 0, icon: <Table2 className="w-5 h-5" />, iconColor: 'text-amber-600 bg-amber-50', link: '/decision-tables' },
  ];

  const metricCards = [
    { label: 'Total Executions', value: stats?.totalExecutions ?? 0, icon: <Zap className="w-5 h-5" />, iconColor: 'text-brand-600 bg-brand-50' },
    { label: 'Success Rate', value: `${stats?.successRate ?? 100}%`, icon: <TrendingUp className="w-5 h-5" />, iconColor: 'text-emerald-600 bg-emerald-50' },
    { label: 'Avg Response', value: `${stats?.avgExecutionTimeMs ?? 0}ms`, icon: <Clock className="w-5 h-5" />, iconColor: 'text-amber-600 bg-amber-50' },
  ];

  const pendingApprovals = stats?.pendingApprovals ?? 0;
  const unreadNotifications = stats?.unreadNotifications ?? 0;
  const simulations = stats?.simulations ?? 0;
  const templates = stats?.templates ?? 0;

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div className="card p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Welcome to SOA One</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Enterprise Business Rules Platform — v8.0</p>
          </div>
          <div className="flex items-center gap-2">
            <Tooltip content="View execution analytics and trends">
              <Link to="/analytics" className="btn-secondary">
                <BarChart3 className="w-4 h-4" /> Analytics
              </Link>
            </Tooltip>
            <Link to="/projects" className="btn-primary">
              <FolderOpen className="w-4 h-4" /> Open Projects
            </Link>
          </div>
        </div>
      </div>

      {/* Resource counts */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card) => (
          <Link key={card.label} to={card.link}>
            <StatCard
              label={card.label}
              value={card.value}
              icon={card.icon}
              iconColor={card.iconColor}
            />
          </Link>
        ))}
      </div>

      {/* Execution metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {metricCards.map((card) => (
          <StatCard
            key={card.label}
            label={card.label}
            value={card.value}
            icon={card.icon}
            iconColor={card.iconColor}
          />
        ))}
      </div>

      {/* V3+V4 Quick access */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {pendingApprovals > 0 && (
          <Link to="/approvals" className="card p-4 hover:shadow-md transition-shadow border-l-4 border-l-amber-400">
            <div className="flex items-center gap-3">
              <CheckSquare className="w-5 h-5 text-amber-500" />
              <div>
                <div className="text-lg font-bold text-slate-900 dark:text-white">{pendingApprovals}</div>
                <div className="text-xs text-slate-500 dark:text-slate-400">Pending Approvals</div>
              </div>
            </div>
          </Link>
        )}
        {unreadNotifications > 0 && (
          <Link to="/notifications" className="card p-4 hover:shadow-md transition-shadow border-l-4 border-l-red-400">
            <div className="flex items-center gap-3">
              <Bell className="w-5 h-5 text-red-500" />
              <div>
                <div className="text-lg font-bold text-slate-900 dark:text-white">{unreadNotifications}</div>
                <div className="text-xs text-slate-500 dark:text-slate-400">Unread Notifications</div>
              </div>
            </div>
          </Link>
        )}
        <Link to="/simulations" className="card p-4 hover:shadow-md transition-shadow border-l-4 border-l-brand-400">
          <div className="flex items-center gap-3">
            <FlaskRound className="w-5 h-5 text-brand-500" />
            <div>
              <div className="text-lg font-bold text-slate-900 dark:text-white">{simulations}</div>
              <div className="text-xs text-slate-500 dark:text-slate-400">Simulations Run</div>
            </div>
          </div>
        </Link>
        <Link to="/templates" className="card p-4 hover:shadow-md transition-shadow border-l-4 border-l-emerald-400">
          <div className="flex items-center gap-3">
            <Store className="w-5 h-5 text-emerald-500" />
            <div>
              <div className="text-lg font-bold text-slate-900 dark:text-white">{templates}</div>
              <div className="text-xs text-slate-500 dark:text-slate-400">Templates Available</div>
            </div>
          </div>
        </Link>
      </div>

      {/* Recent executions */}
      <div className="card">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
          <h3 className="font-semibold text-slate-900 dark:text-white">Recent Executions</h3>
          <Link to="/monitoring" className="text-sm text-brand-600 hover:text-brand-700">
            View All
          </Link>
        </div>
        {stats?.recentExecutions && stats.recentExecutions.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800">
                  <th className="text-left px-6 py-3 font-medium text-slate-500 dark:text-slate-400">Rule Set</th>
                  <th className="text-left px-6 py-3 font-medium text-slate-500 dark:text-slate-400">Status</th>
                  <th className="text-left px-6 py-3 font-medium text-slate-500 dark:text-slate-400">Duration</th>
                  <th className="text-left px-6 py-3 font-medium text-slate-500 dark:text-slate-400">Time</th>
                </tr>
              </thead>
              <tbody>
                {stats.recentExecutions.slice(0, 10).map((exec: any) => (
                  <tr key={exec.id} className="border-b border-slate-50 dark:border-slate-800/50 hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                    <td className="px-6 py-3 font-medium text-slate-900 dark:text-white">{exec.ruleSet?.name || exec.ruleSetId}</td>
                    <td className="px-6 py-3">
                      <span className={exec.status === 'success' ? 'badge-green' : 'badge-red'}>
                        {exec.status}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-slate-600 dark:text-slate-400">{exec.executionTimeMs}ms</td>
                    <td className="px-6 py-3 text-slate-500 dark:text-slate-400">{new Date(exec.createdAt).toLocaleTimeString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="px-6 py-12 text-center">
            <Activity className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
            <p className="text-sm text-slate-500 dark:text-slate-400">No executions yet. Run your first rule set to see results here.</p>
          </div>
        )}
      </div>
    </div>
  );
}
