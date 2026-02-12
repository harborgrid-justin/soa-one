import { useEffect, useState } from 'react';
import {
  Gauge,
  Clock,
  Wifi,
  HardDrive,
  RefreshCw,
  Trash2,
  Flame,
  Database,
  Zap,
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import api from '../api/client';
import { useStore } from '../store';

interface CacheEntry {
  key: string;
  ttlSeconds: number;
  sizeBytes: number;
  hits: number;
  createdAt: string;
}

interface CacheStats {
  hitRate: number;
  avgResponseMs: number;
  activeConnections: number;
  memoryUsageMb: number;
  totalEntries: number;
  totalHits: number;
  totalMisses: number;
}

interface PerformancePoint {
  time: string;
  responseMs: number;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function formatTTL(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86400)}d`;
}

export function CacheMonitor() {
  const { addNotification } = useStore();
  const [loading, setLoading] = useState(true);
  const [flushing, setFlushing] = useState(false);
  const [warming, setWarming] = useState(false);
  const [stats, setStats] = useState<CacheStats>({
    hitRate: 94.2,
    avgResponseMs: 12,
    activeConnections: 28,
    memoryUsageMb: 256,
    totalEntries: 1847,
    totalHits: 45230,
    totalMisses: 2780,
  });
  const [entries, setEntries] = useState<CacheEntry[]>([]);
  const [perfData, setPerfData] = useState<PerformancePoint[]>([]);

  const fetchCacheData = () => {
    setLoading(true);
    Promise.all([
      api.get('/cache/stats').catch(() => null),
      api.get('/cache/entries').catch(() => null),
      api.get('/cache/performance').catch(() => null),
    ])
      .then(([statsRes, entriesRes, perfRes]) => {
        if (statsRes?.data) setStats(statsRes.data);
        if (entriesRes?.data) setEntries(entriesRes.data.entries || entriesRes.data || []);
        else {
          // Sample cache entries
          setEntries([
            { key: 'rs:premium-calc:v3', ttlSeconds: 3600, sizeBytes: 2048, hits: 1240, createdAt: new Date(Date.now() - 1000 * 60 * 30).toISOString() },
            { key: 'rs:eligibility:v2', ttlSeconds: 1800, sizeBytes: 1536, hits: 890, createdAt: new Date(Date.now() - 1000 * 60 * 45).toISOString() },
            { key: 'rs:risk-assessment:v1', ttlSeconds: 7200, sizeBytes: 4096, hits: 2100, createdAt: new Date(Date.now() - 1000 * 60 * 60).toISOString() },
            { key: 'dm:customer-profile', ttlSeconds: 900, sizeBytes: 512, hits: 450, createdAt: new Date(Date.now() - 1000 * 60 * 15).toISOString() },
            { key: 'rs:fraud-detect:v4', ttlSeconds: 3600, sizeBytes: 3072, hits: 1560, createdAt: new Date(Date.now() - 1000 * 60 * 20).toISOString() },
            { key: 'dt:pricing-table:v2', ttlSeconds: 1800, sizeBytes: 8192, hits: 670, createdAt: new Date(Date.now() - 1000 * 60 * 50).toISOString() },
            { key: 'rs:kyc-verify:v1', ttlSeconds: 3600, sizeBytes: 1024, hits: 340, createdAt: new Date(Date.now() - 1000 * 60 * 40).toISOString() },
            { key: 'dm:vehicle-data', ttlSeconds: 7200, sizeBytes: 2560, hits: 780, createdAt: new Date(Date.now() - 1000 * 60 * 55).toISOString() },
          ]);
        }
        if (perfRes?.data) setPerfData(perfRes.data.points || perfRes.data || []);
        else {
          // Sample performance data
          const now = Date.now();
          setPerfData(
            Array.from({ length: 24 }, (_, i) => ({
              time: new Date(now - (23 - i) * 3600000).toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
              }),
              responseMs: Math.floor(Math.random() * 20) + 5,
            }))
          );
        }
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchCacheData();
  }, []);

  const handleFlush = () => {
    setFlushing(true);
    api
      .post('/cache/flush')
      .then(() => {
        addNotification({ type: 'success', message: 'Cache flushed successfully' });
        setEntries([]);
        setStats((prev) => ({ ...prev, totalEntries: 0, hitRate: 0 }));
      })
      .catch(() => {
        addNotification({ type: 'error', message: 'Failed to flush cache' });
      })
      .finally(() => setFlushing(false));
  };

  const handleWarm = () => {
    setWarming(true);
    api
      .post('/cache/warm')
      .then(() => {
        addNotification({ type: 'success', message: 'Cache warming initiated' });
        fetchCacheData();
      })
      .catch(() => {
        addNotification({ type: 'error', message: 'Failed to warm cache' });
      })
      .finally(() => setWarming(false));
  };

  if (loading) {
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
            <Gauge className="w-5 h-5 text-brand-600" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Cache Monitor</h1>
            <p className="text-sm text-slate-500">Performance and cache management</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleWarm}
            className="btn-secondary btn-sm"
            disabled={warming}
          >
            <Flame className={`w-3.5 h-3.5 ${warming ? 'animate-pulse' : ''}`} />
            {warming ? 'Warming...' : 'Warm Cache'}
          </button>
          <button
            onClick={handleFlush}
            className="btn-secondary btn-sm text-red-600 hover:text-red-700"
            disabled={flushing}
          >
            <Trash2 className={`w-3.5 h-3.5 ${flushing ? 'animate-spin' : ''}`} />
            {flushing ? 'Flushing...' : 'Flush Cache'}
          </button>
          <button onClick={fetchCacheData} className="btn-secondary btn-sm" disabled={loading}>
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center">
              <Zap className="w-5 h-5 text-emerald-600" />
            </div>
            <span className="text-sm text-slate-500">Cache Hit Rate</span>
          </div>
          <div className="text-3xl font-bold text-slate-900">{stats.hitRate}%</div>
          <div className="mt-2 w-full bg-slate-100 rounded-full h-2">
            <div
              className="bg-emerald-500 h-2 rounded-full transition-all"
              style={{ width: `${stats.hitRate}%` }}
            />
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {stats.totalHits.toLocaleString()} hits / {stats.totalMisses.toLocaleString()} misses
          </p>
        </div>

        <div className="card p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center">
              <Clock className="w-5 h-5 text-amber-600" />
            </div>
            <span className="text-sm text-slate-500">Avg Response Time</span>
          </div>
          <div className="text-3xl font-bold text-slate-900">
            {stats.avgResponseMs}
            <span className="text-sm font-normal text-slate-500">ms</span>
          </div>
        </div>

        <div className="card p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
              <Wifi className="w-5 h-5 text-blue-600" />
            </div>
            <span className="text-sm text-slate-500">Active Connections</span>
          </div>
          <div className="text-3xl font-bold text-slate-900">{stats.activeConnections}</div>
        </div>

        <div className="card p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center">
              <HardDrive className="w-5 h-5 text-purple-600" />
            </div>
            <span className="text-sm text-slate-500">Memory Usage</span>
          </div>
          <div className="text-3xl font-bold text-slate-900">
            {stats.memoryUsageMb}
            <span className="text-sm font-normal text-slate-500">MB</span>
          </div>
        </div>
      </div>

      {/* Performance chart */}
      <div className="card p-6">
        <h3 className="font-semibold text-slate-900 mb-4">Response Time (Last 24h)</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={perfData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis
                dataKey="time"
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
                formatter={(value: any) => [`${value}ms`, 'Response Time']}
              />
              <Line
                type="monotone"
                dataKey="responseMs"
                stroke="#6366f1"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: '#6366f1' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Cache entries table */}
      <div className="card">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Database className="w-5 h-5 text-slate-400" />
            <h3 className="font-semibold text-slate-900">Cache Entries</h3>
            <span className="badge-gray">{entries.length}</span>
          </div>
        </div>
        {entries.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left px-6 py-3 font-medium text-slate-500">Key</th>
                  <th className="text-left px-6 py-3 font-medium text-slate-500">TTL</th>
                  <th className="text-left px-6 py-3 font-medium text-slate-500">Size</th>
                  <th className="text-left px-6 py-3 font-medium text-slate-500">Hits</th>
                  <th className="text-left px-6 py-3 font-medium text-slate-500">Created</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr
                    key={entry.key}
                    className="border-b border-slate-50 hover:bg-slate-50/50"
                  >
                    <td className="px-6 py-3">
                      <code className="text-xs bg-slate-100 rounded px-1.5 py-0.5 font-mono text-slate-700">
                        {entry.key}
                      </code>
                    </td>
                    <td className="px-6 py-3 text-slate-600">{formatTTL(entry.ttlSeconds)}</td>
                    <td className="px-6 py-3 text-slate-600">{formatBytes(entry.sizeBytes)}</td>
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-1.5">
                        <Zap className="w-3 h-3 text-amber-500" />
                        <span className="text-slate-700">
                          {entry.hits.toLocaleString()}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-3 text-slate-500 text-xs">
                      {new Date(entry.createdAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="px-6 py-16 text-center">
            <Database className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-slate-900 mb-1">Cache Empty</h3>
            <p className="text-sm text-slate-500 mb-4">
              No cache entries found. Use "Warm Cache" to pre-populate.
            </p>
            <button onClick={handleWarm} className="btn-primary btn-sm" disabled={warming}>
              <Flame className="w-3.5 h-3.5" />
              Warm Cache
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
