import { useEffect, useState } from 'react';
import {
  Activity, MessageSquare, AlertTriangle, CheckCircle, XCircle,
  Clock, Filter, RefreshCw, TrendingUp, Shield, Zap,
  BarChart3,
} from 'lucide-react';
import { getESBMessages, getESBMetrics, getESBMetricSnapshots } from '../api/client';
import { useStore } from '../store';
import type { ESBMessageRecord, ESBDashboardData } from '../types';

type StatusFilter = 'all' | 'pending' | 'delivered' | 'failed' | 'dead-letter';

export function ESBMonitoring() {
  const [messages, setMessages] = useState<ESBMessageRecord[]>([]);
  const [metrics, setMetrics] = useState<ESBDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [channelFilter, setChannelFilter] = useState('');
  const { addNotification } = useStore();

  const loadAll = async () => {
    setLoading(true);
    try {
      const params: any = { limit: 100 };
      if (statusFilter !== 'all') params.status = statusFilter;
      if (channelFilter) params.channelName = channelFilter;

      const [msgs, met] = await Promise.all([
        getESBMessages(params),
        getESBMetrics(),
      ]);
      setMessages(msgs);
      setMetrics(met);
    } catch {
      addNotification({ type: 'error', message: 'Failed to load ESB data' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAll(); }, [statusFilter, channelFilter]);

  const statusCounts = {
    delivered: messages.filter((m) => m.status === 'delivered').length,
    failed: messages.filter((m) => m.status === 'failed').length,
    'dead-letter': messages.filter((m) => m.status === 'dead-letter').length,
    pending: messages.filter((m) => m.status === 'pending').length,
  };

  const uniqueChannels = [...new Set(messages.map((m) => m.channelName))].sort();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">Monitor message flow, delivery status, circuit breakers, and resilience metrics.</p>
        <button onClick={loadAll} className="btn-secondary btn-sm">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-1">
            <MessageSquare className="w-4 h-4 text-blue-500" />
            <span className="text-xs text-slate-500">Total Messages</span>
          </div>
          <div className="text-2xl font-bold text-slate-900">{metrics?.summary.totalMessages ?? 0}</div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle className="w-4 h-4 text-green-500" />
            <span className="text-xs text-slate-500">Delivered</span>
          </div>
          <div className="text-2xl font-bold text-green-700">{statusCounts.delivered}</div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-1">
            <XCircle className="w-4 h-4 text-red-500" />
            <span className="text-xs text-slate-500">Failed</span>
          </div>
          <div className="text-2xl font-bold text-red-700">{statusCounts.failed}</div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="w-4 h-4 text-orange-500" />
            <span className="text-xs text-slate-500">Dead Letters</span>
          </div>
          <div className="text-2xl font-bold text-orange-700">{metrics?.summary.deadLetterCount ?? 0}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1">
          <Filter className="w-4 h-4 text-slate-400" />
          <span className="text-sm text-slate-500">Filter:</span>
        </div>
        <div className="flex gap-1">
          {(['all', 'pending', 'delivered', 'failed', 'dead-letter'] as StatusFilter[]).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                statusFilter === s
                  ? 'bg-brand-100 text-brand-700'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {s === 'all' ? 'All' : s}
            </button>
          ))}
        </div>
        {uniqueChannels.length > 0 && (
          <select
            className="input py-1 px-2 text-xs w-48"
            value={channelFilter}
            onChange={(e) => setChannelFilter(e.target.value)}
          >
            <option value="">All channels</option>
            {uniqueChannels.map((ch) => (
              <option key={ch} value={ch}>{ch}</option>
            ))}
          </select>
        )}
      </div>

      {/* Message List */}
      <div className="card">
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900">Message Log ({messages.length})</h2>
        </div>
        {messages.length > 0 ? (
          <div className="divide-y divide-slate-100 max-h-[600px] overflow-y-auto">
            {messages.map((msg) => (
              <div key={msg.id} className="px-6 py-3 flex items-center justify-between hover:bg-slate-50 transition-colors">
                <div className="flex items-center gap-3 min-w-0">
                  <MessageSquare className={`w-4 h-4 flex-shrink-0 ${
                    msg.status === 'delivered' ? 'text-green-500' :
                    msg.status === 'failed' ? 'text-red-500' :
                    msg.status === 'dead-letter' ? 'text-orange-500' : 'text-slate-400'
                  }`} />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-medium text-slate-900">{msg.channelName}</span>
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium uppercase ${
                        msg.type === 'command' ? 'bg-blue-100 text-blue-700' :
                        msg.type === 'event' ? 'bg-emerald-100 text-emerald-700' :
                        msg.type === 'query' ? 'bg-purple-100 text-purple-700' :
                        msg.type === 'reply' ? 'bg-teal-100 text-teal-700' :
                        'bg-slate-100 text-slate-600'
                      }`}>
                        {msg.type}
                      </span>
                    </div>
                    <div className="text-xs text-slate-400 truncate font-mono mt-0.5">
                      {JSON.stringify(msg.body).slice(0, 80)}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  {msg.correlationId && (
                    <span className="text-[10px] text-slate-400 font-mono">{msg.correlationId.slice(0, 8)}</span>
                  )}
                  <span className={
                    msg.status === 'delivered' ? 'badge-green' :
                    msg.status === 'failed' ? 'badge-red' :
                    msg.status === 'dead-letter' ? 'badge-yellow' : 'badge-gray'
                  }>
                    {msg.status}
                  </span>
                  <span className="text-xs text-slate-400 whitespace-nowrap">
                    {new Date(msg.createdAt).toLocaleTimeString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-12 text-center">
            <Activity className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm text-slate-500">
              {statusFilter !== 'all' || channelFilter
                ? 'No messages match the current filters.'
                : 'No messages recorded yet.'}
            </p>
          </div>
        )}
      </div>

      {/* System Health */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-3">
            <Shield className="w-5 h-5 text-blue-500" />
            <h3 className="font-semibold text-slate-900">Circuit Breakers</h3>
          </div>
          <div className="text-sm text-slate-500">
            Monitor circuit breaker states across your service endpoints.
            Breakers protect the bus from cascading failures.
          </div>
          <div className="mt-3 p-3 rounded-lg bg-green-50 text-sm text-green-700 flex items-center gap-2">
            <CheckCircle className="w-4 h-4" />
            All circuits healthy
          </div>
        </div>
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-3">
            <Zap className="w-5 h-5 text-amber-500" />
            <h3 className="font-semibold text-slate-900">Rate Limiters</h3>
          </div>
          <div className="text-sm text-slate-500">
            Track rate limiter usage across endpoints with fixed-window,
            sliding-window, and token-bucket strategies.
          </div>
          <div className="mt-3 p-3 rounded-lg bg-slate-50 text-sm text-slate-600 flex items-center gap-2">
            <BarChart3 className="w-4 h-4" />
            Within limits
          </div>
        </div>
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-5 h-5 text-violet-500" />
            <h3 className="font-semibold text-slate-900">Throughput</h3>
          </div>
          <div className="text-sm text-slate-500">
            Active sagas: {metrics?.summary.activeSagas ?? 0}.
            Channels: {metrics?.summary.totalChannels ?? 0}.
            Endpoints: {metrics?.summary.totalEndpoints ?? 0}.
          </div>
          <div className="mt-3 p-3 rounded-lg bg-slate-50 text-sm text-slate-600 flex items-center gap-2">
            <Activity className="w-4 h-4" />
            {metrics?.summary.totalMessages ?? 0} total processed
          </div>
        </div>
      </div>
    </div>
  );
}
