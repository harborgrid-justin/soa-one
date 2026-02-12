import { useEffect, useState } from 'react';
import {
  BarChart3,
  TrendingUp,
  Clock,
  Zap,
  FileCheck,
  RefreshCw,
  Info,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import api from '../api/client';
import { useStore } from '../store';

type DateRange = '7d' | '30d' | '90d';

interface AnalyticsData {
  totalExecutions: number;
  successRate: number;
  avgTime: number;
  activeRules: number;
  executionTrend: { date: string; executions: number; errors: number }[];
  successBreakdown: { name: string; value: number }[];
  avgTimeTrend: { date: string; avgMs: number }[];
  topRuleSets: { name: string; count: number }[];
}

const PIE_COLORS = ['#10b981', '#ef4444', '#f59e0b', '#6366f1'];

export function Analytics() {
  const { addNotification } = useStore();
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<DateRange>('30d');
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [usingSampleData, setUsingSampleData] = useState(false);

  const fetchAnalytics = () => {
    setLoading(true);
    api
      .get('/analytics/dashboard', { params: { range: dateRange } })
      .then((r) => {
        setData(r.data);
        setUsingSampleData(false);
      })
      .catch(() => {
        setUsingSampleData(true);
        // Fallback to sample data for UI display
        const days = dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : 90;
        const trend = Array.from({ length: days }, (_, i) => {
          const d = new Date();
          d.setDate(d.getDate() - (days - 1 - i));
          return {
            date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            executions: Math.floor(Math.random() * 200) + 50,
            errors: Math.floor(Math.random() * 20),
          };
        });
        const totalExec = trend.reduce((s, t) => s + t.executions, 0);
        const totalErr = trend.reduce((s, t) => s + t.errors, 0);
        setData({
          totalExecutions: totalExec,
          successRate: Math.round(((totalExec - totalErr) / totalExec) * 100),
          avgTime: Math.floor(Math.random() * 40) + 10,
          activeRules: Math.floor(Math.random() * 50) + 20,
          executionTrend: trend,
          successBreakdown: [
            { name: 'Success', value: totalExec - totalErr },
            { name: 'Error', value: totalErr },
          ],
          avgTimeTrend: trend.map((t) => ({
            date: t.date,
            avgMs: Math.floor(Math.random() * 30) + 5,
          })),
          topRuleSets: [
            { name: 'Premium Calculator', count: Math.floor(Math.random() * 500) + 100 },
            { name: 'Eligibility Check', count: Math.floor(Math.random() * 400) + 80 },
            { name: 'Risk Assessment', count: Math.floor(Math.random() * 300) + 60 },
            { name: 'Discount Engine', count: Math.floor(Math.random() * 250) + 40 },
            { name: 'Fraud Detection', count: Math.floor(Math.random() * 200) + 30 },
          ],
        });
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchAnalytics();
  }, [dateRange]);

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-brand-50 flex items-center justify-center">
            <BarChart3 className="w-5 h-5 text-brand-600" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Analytics</h1>
            <p className="text-sm text-slate-500">Execution trends and performance insights</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Date range picker */}
          <div className="flex items-center bg-slate-100 rounded-lg p-0.5">
            {(['7d', '30d', '90d'] as DateRange[]).map((range) => (
              <button
                key={range}
                onClick={() => setDateRange(range)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  dateRange === range
                    ? 'bg-white text-brand-700 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {range === '7d' ? '7 Days' : range === '30d' ? '30 Days' : '90 Days'}
              </button>
            ))}
          </div>
          <button onClick={fetchAnalytics} className="btn-secondary btn-sm" disabled={loading}>
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Sample data banner */}
      {usingSampleData && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-2.5 text-sm text-blue-700 flex items-center gap-2">
          <Info className="w-4 h-4 text-blue-500 flex-shrink-0" />
          Showing sample data &mdash; connect analytics backend for live metrics
        </div>
      )}

      {/* Stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-brand-50 flex items-center justify-center">
              <Zap className="w-5 h-5 text-brand-600" />
            </div>
            <span className="text-sm text-slate-500">Total Executions</span>
          </div>
          <div className="text-3xl font-bold text-slate-900">
            {data?.totalExecutions?.toLocaleString() ?? 0}
          </div>
        </div>
        <div className="card p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-emerald-600" />
            </div>
            <span className="text-sm text-slate-500">Success Rate</span>
          </div>
          <div className="text-3xl font-bold text-slate-900">{data?.successRate ?? 0}%</div>
        </div>
        <div className="card p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center">
              <Clock className="w-5 h-5 text-amber-600" />
            </div>
            <span className="text-sm text-slate-500">Avg Time</span>
          </div>
          <div className="text-3xl font-bold text-slate-900">
            {data?.avgTime ?? 0}
            <span className="text-sm font-normal text-slate-500">ms</span>
          </div>
        </div>
        <div className="card p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center">
              <FileCheck className="w-5 h-5 text-purple-600" />
            </div>
            <span className="text-sm text-slate-500">Active Rules</span>
          </div>
          <div className="text-3xl font-bold text-slate-900">{data?.activeRules ?? 0}</div>
        </div>
      </div>

      {/* Charts grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Execution Trend (AreaChart) */}
        <div className="card p-6">
          <h3 className="font-semibold text-slate-900 mb-4">Execution Trend</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data?.executionTrend || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  tickLine={false}
                  axisLine={{ stroke: '#e2e8f0' }}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  tickLine={false}
                  axisLine={{ stroke: '#e2e8f0' }}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0',
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="executions"
                  stroke="#6366f1"
                  fill="#6366f1"
                  fillOpacity={0.1}
                  strokeWidth={2}
                  name="Executions"
                />
                <Area
                  type="monotone"
                  dataKey="errors"
                  stroke="#ef4444"
                  fill="#ef4444"
                  fillOpacity={0.1}
                  strokeWidth={2}
                  name="Errors"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Success/Error Breakdown (PieChart) */}
        <div className="card p-6">
          <h3 className="font-semibold text-slate-900 mb-4">Success / Error Breakdown</h3>
          <div className="h-64 flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data?.successBreakdown || []}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {(data?.successBreakdown || []).map((_, index) => (
                    <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0',
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex items-center justify-center gap-6 mt-2">
            {(data?.successBreakdown || []).map((entry, i) => (
              <div key={entry.name} className="flex items-center gap-2 text-sm">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }}
                />
                <span className="text-slate-600">{entry.name}</span>
                <span className="font-semibold text-slate-900">{entry.value.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Average Execution Time (LineChart) */}
        <div className="card p-6">
          <h3 className="font-semibold text-slate-900 mb-4">Average Execution Time</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data?.avgTimeTrend || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  tickLine={false}
                  axisLine={{ stroke: '#e2e8f0' }}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  tickLine={false}
                  axisLine={{ stroke: '#e2e8f0' }}
                  unit="ms"
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0',
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                  }}
                  formatter={(value: any) => [`${value}ms`, 'Avg Time']}
                />
                <Line
                  type="monotone"
                  dataKey="avgMs"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, fill: '#f59e0b' }}
                  name="Avg Time"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top Rule Sets by Execution Count (BarChart) */}
        <div className="card p-6">
          <h3 className="font-semibold text-slate-900 mb-4">Top Rule Sets by Executions</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data?.topRuleSets || []} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                <XAxis
                  type="number"
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  tickLine={false}
                  axisLine={{ stroke: '#e2e8f0' }}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  tickLine={false}
                  axisLine={{ stroke: '#e2e8f0' }}
                  width={120}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0',
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                  }}
                />
                <Bar dataKey="count" fill="#6366f1" radius={[0, 4, 4, 0]} name="Executions" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
