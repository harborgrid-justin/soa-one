import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  Radio, ArrowRightLeft, GitBranch, Repeat, Workflow, Activity,
  AlertTriangle, CheckCircle, Clock, MessageSquare, TrendingUp,
} from 'lucide-react';
import { getESBMetrics } from '../api/client';
import type { ESBDashboardData } from '../types';

export function ESBDashboard() {
  const [data, setData] = useState<ESBDashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getESBMetrics()
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
    { label: 'Channels', value: s?.totalChannels ?? 0, icon: Radio, color: 'text-blue-600 bg-blue-50', link: '/esb/channels' },
    { label: 'Endpoints', value: s?.totalEndpoints ?? 0, icon: ArrowRightLeft, color: 'text-emerald-600 bg-emerald-50', link: '/esb/channels' },
    { label: 'Routes', value: s?.totalRoutes ?? 0, icon: GitBranch, color: 'text-violet-600 bg-violet-50', link: '/esb/routes' },
    { label: 'Transformers', value: s?.totalTransformers ?? 0, icon: Repeat, color: 'text-amber-600 bg-amber-50', link: '/esb/transformers' },
    { label: 'Active Sagas', value: s?.activeSagas ?? 0, icon: Workflow, color: 'text-pink-600 bg-pink-50', link: '/esb/sagas' },
    { label: 'Total Messages', value: s?.totalMessages ?? 0, icon: MessageSquare, color: 'text-slate-600 bg-slate-50', link: '/esb/monitoring' },
    { label: 'Dead Letters', value: s?.deadLetterCount ?? 0, icon: AlertTriangle, color: s?.deadLetterCount ? 'text-red-600 bg-red-50' : 'text-slate-400 bg-slate-50', link: '/esb/monitoring' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-slate-500">Enterprise Service Bus overview — channels, endpoints, routing, and message flow.</p>
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

      {/* Channels Overview */}
      <div className="card">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-semibold text-slate-900">Active Channels</h2>
          <NavLink to="/esb/channels" className="text-sm text-brand-600 hover:underline">View all</NavLink>
        </div>
        {data?.channels && data.channels.length > 0 ? (
          <div className="divide-y divide-slate-100">
            {data.channels.map((ch) => (
              <div key={ch.id} className="px-6 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Radio className="w-4 h-4 text-blue-500" />
                  <div>
                    <div className="text-sm font-medium text-slate-900">{ch.name}</div>
                    <div className="text-xs text-slate-500">{ch.type}</div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="text-sm font-mono text-slate-700">{ch.messageCount}</div>
                    <div className="text-[10px] text-slate-400">msgs</div>
                  </div>
                  {ch.errorCount > 0 && (
                    <div className="text-right">
                      <div className="text-sm font-mono text-red-600">{ch.errorCount}</div>
                      <div className="text-[10px] text-red-400">errors</div>
                    </div>
                  )}
                  <span className={
                    ch.status === 'active' ? 'badge-green' :
                    ch.status === 'paused' ? 'badge-yellow' : 'badge-gray'
                  }>
                    {ch.status === 'active' && <CheckCircle className="w-3 h-3 mr-1" />}
                    {ch.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-8 text-center text-sm text-slate-400">No channels configured yet.</div>
        )}
      </div>

      {/* Recent Messages */}
      <div className="card">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-semibold text-slate-900">Recent Messages</h2>
          <NavLink to="/esb/monitoring" className="text-sm text-brand-600 hover:underline">View all</NavLink>
        </div>
        {data?.recentMessages && data.recentMessages.length > 0 ? (
          <div className="divide-y divide-slate-100">
            {data.recentMessages.map((msg) => (
              <div key={msg.id} className="px-6 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <MessageSquare className={`w-4 h-4 ${
                    msg.status === 'delivered' ? 'text-green-500' :
                    msg.status === 'failed' ? 'text-red-500' :
                    msg.status === 'dead-letter' ? 'text-orange-500' : 'text-slate-400'
                  }`} />
                  <div>
                    <div className="text-sm text-slate-900">
                      <span className="font-medium">{msg.channelName}</span>
                      <span className="mx-2 text-slate-300">|</span>
                      <span className="text-slate-500">{msg.type}</span>
                    </div>
                    {msg.correlationId && (
                      <div className="text-xs text-slate-400 font-mono">{msg.correlationId.slice(0, 16)}...</div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={
                    msg.status === 'delivered' ? 'badge-green' :
                    msg.status === 'failed' ? 'badge-red' :
                    msg.status === 'dead-letter' ? 'badge-yellow' : 'badge-gray'
                  }>
                    {msg.status}
                  </span>
                  <span className="text-xs text-slate-400 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {new Date(msg.createdAt).toLocaleTimeString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-8 text-center text-sm text-slate-400">No messages recorded yet.</div>
        )}
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { to: '/esb/channels', label: 'Manage Channels', desc: 'Create and configure message channels', icon: Radio, color: 'text-blue-600' },
          { to: '/esb/routes', label: 'Routing Rules', desc: 'Set up content-based routing strategies', icon: GitBranch, color: 'text-violet-600' },
          { to: '/esb/transformers', label: 'Transformations', desc: 'Build message transformation pipelines', icon: Repeat, color: 'text-amber-600' },
          { to: '/esb/sagas', label: 'Saga Manager', desc: 'Orchestrate distributed transactions', icon: Workflow, color: 'text-pink-600' },
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
