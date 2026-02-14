import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  ShieldCheck, MessageSquare, Inbox, Sparkles, Layers, Search,
  GitBranch, Activity, AlertTriangle, CheckCircle,
} from 'lucide-react';
import { getDQMMetrics } from '../api/client';
import type { DQMDashboardData } from '../types';

export function DQMDashboard() {
  const [data, setData] = useState<DQMDashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getDQMMetrics()
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
  const scoreColor = (s?.currentQualityScore ?? 0) >= 0.9 ? 'text-green-600' : (s?.currentQualityScore ?? 0) >= 0.7 ? 'text-amber-600' : 'text-red-600';

  const statCards = [
    { label: 'Quality Rules', value: s?.totalQualityRules ?? 0, icon: ShieldCheck, color: 'text-emerald-600 bg-emerald-50', link: '/dqm/quality-rules' },
    { label: 'Topics', value: s?.totalTopics ?? 0, icon: MessageSquare, color: 'text-blue-600 bg-blue-50', link: '/dqm/topics' },
    { label: 'Queues', value: s?.totalQueues ?? 0, icon: Inbox, color: 'text-violet-600 bg-violet-50', link: '/dqm/queues' },
    { label: 'Cleansing Rules', value: s?.totalCleansingRules ?? 0, icon: Sparkles, color: 'text-pink-600 bg-pink-50', link: '/dqm/cleansing' },
    { label: 'Match Rules', value: s?.totalMatchRules ?? 0, icon: GitBranch, color: 'text-amber-600 bg-amber-50', link: '/dqm/matching' },
    { label: 'Subscriptions', value: s?.totalSubscriptions ?? 0, icon: Layers, color: 'text-slate-600 bg-slate-50', link: '/dqm/topics' },
    { label: 'Alerts', value: s?.activeAlerts ?? 0, icon: AlertTriangle, color: s?.activeAlerts ? 'text-red-600 bg-red-50' : 'text-slate-400 bg-slate-50', link: '/dqm/monitoring' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-slate-500">Data Quality & Messaging overview — quality rules, profiling, cleansing, matching, topics, and queues.</p>
      </div>

      {/* Quality Score Banner */}
      <div className="card p-6 flex items-center justify-between">
        <div>
          <div className="text-xs text-slate-500 mb-1">Current Quality Score</div>
          <div className={`text-4xl font-bold ${scoreColor}`}>
            {((s?.currentQualityScore ?? 0) * 100).toFixed(1)}%
          </div>
          <div className="text-sm text-slate-500 mt-1">Grade: {s?.currentQualityGrade ?? 'N/A'}</div>
        </div>
        <div className="grid grid-cols-2 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold text-slate-900">{s?.messagesPublished ?? 0}</div>
            <div className="text-xs text-slate-500">Published</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900">{s?.messagesDelivered ?? 0}</div>
            <div className="text-xs text-slate-500">Delivered</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900">{s?.validationsExecuted ?? 0}</div>
            <div className="text-xs text-slate-500">Validations</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900">{s?.profilesExecuted ?? 0}</div>
            <div className="text-xs text-slate-500">Profiles</div>
          </div>
        </div>
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

      {/* Topics & Queues */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="font-semibold text-slate-900">Topics</h2>
            <NavLink to="/dqm/topics" className="text-sm text-brand-600 hover:underline">View all</NavLink>
          </div>
          {data?.topics && data.topics.length > 0 ? (
            <div className="divide-y divide-slate-100">
              {data.topics.slice(0, 5).map((t: any) => (
                <div key={t.name} className="px-6 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <MessageSquare className="w-4 h-4 text-blue-500" />
                    <div>
                      <div className="text-sm font-medium text-slate-900">{t.name}</div>
                      <div className="text-xs text-slate-500">{t.subscriptionCount} subscribers</div>
                    </div>
                  </div>
                  <span className="badge-green">
                    <CheckCircle className="w-3 h-3 mr-1" />
                    active
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center text-sm text-slate-400">No topics configured yet.</div>
          )}
        </div>

        <div className="card">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="font-semibold text-slate-900">Queues</h2>
            <NavLink to="/dqm/queues" className="text-sm text-brand-600 hover:underline">View all</NavLink>
          </div>
          {data?.queues && data.queues.length > 0 ? (
            <div className="divide-y divide-slate-100">
              {data.queues.slice(0, 5).map((q: any) => (
                <div key={q.name} className="px-6 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Inbox className="w-4 h-4 text-violet-500" />
                    <div>
                      <div className="text-sm font-medium text-slate-900">{q.name}</div>
                      <div className="text-xs text-slate-500">depth: {q.depth} | DLQ: {q.deadLetterDepth}</div>
                    </div>
                  </div>
                  <span className="badge-green">
                    <CheckCircle className="w-3 h-3 mr-1" />
                    active
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center text-sm text-slate-400">No queues configured yet.</div>
          )}
        </div>
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { to: '/dqm/quality-rules', label: 'Quality Rules', desc: 'Define validation and quality rules', icon: ShieldCheck, color: 'text-emerald-600' },
          { to: '/dqm/profiling', label: 'Profiling', desc: 'Profile datasets and columns', icon: Search, color: 'text-blue-600' },
          { to: '/dqm/cleansing', label: 'Cleansing', desc: 'Data cleansing and standardization', icon: Sparkles, color: 'text-pink-600' },
          { to: '/dqm/matching', label: 'Matching', desc: 'Record matching and deduplication', icon: GitBranch, color: 'text-amber-600' },
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
