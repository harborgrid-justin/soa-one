import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  AlertTriangle,
  ChevronRight,
  RefreshCw,
  Shield,
  ArrowLeft,
  AlertOctagon,
  Info,
} from 'lucide-react';
import api from '../api/client';
import { useStore } from '../store';

type Severity = 'high' | 'medium' | 'low';

interface Conflict {
  id: string;
  rule1Id: string;
  rule1Name: string;
  rule2Id: string;
  rule2Name: string;
  conflictType: string;
  description: string;
  severity: Severity;
}

interface ConflictsData {
  ruleSetId: string;
  ruleSetName: string;
  conflicts: Conflict[];
  summary: {
    total: number;
    high: number;
    medium: number;
    low: number;
  };
}

const severityConfig: Record<Severity, { badge: string; icon: typeof AlertOctagon; color: string; bg: string }> = {
  high: {
    badge: 'bg-red-100 text-red-700 text-xs font-medium px-2 py-0.5 rounded-full',
    icon: AlertOctagon,
    color: 'text-red-600',
    bg: 'bg-red-50',
  },
  medium: {
    badge: 'badge-yellow',
    icon: AlertTriangle,
    color: 'text-amber-600',
    bg: 'bg-amber-50',
  },
  low: {
    badge: 'badge-blue',
    icon: Info,
    color: 'text-blue-600',
    bg: 'bg-blue-50',
  },
};

export function RuleConflicts() {
  const { ruleSetId } = useParams<{ ruleSetId: string }>();
  const { addNotification } = useStore();
  const [data, setData] = useState<ConflictsData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchConflicts = () => {
    if (!ruleSetId) return;
    setLoading(true);
    api
      .get(`/rule-sets/${ruleSetId}/conflicts`)
      .then((r) => setData(r.data))
      .catch(() => {
        addNotification({ type: 'error', message: 'Failed to load conflict data' });
        setData(null);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchConflicts();
  }, [ruleSetId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Link to="/rule-sets" className="hover:text-brand-600 transition-colors">
          Rule Sets
        </Link>
        <ChevronRight className="w-4 h-4" />
        <Link
          to={`/rule-sets/${ruleSetId}`}
          className="hover:text-brand-600 transition-colors"
        >
          {data?.ruleSetName || 'Rule Set'}
        </Link>
        <ChevronRight className="w-4 h-4" />
        <span className="text-slate-900 font-medium">Conflict Detection</span>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Rule Conflicts</h1>
            <p className="text-sm text-slate-500">
              Detected conflicts in {data?.ruleSetName || 'rule set'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchConflicts} className="btn-secondary btn-sm" disabled={loading}>
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Re-scan
          </button>
          <Link to={`/rule-sets/${ruleSetId}`} className="btn-secondary btn-sm">
            <ArrowLeft className="w-3.5 h-3.5" />
            Back
          </Link>
        </div>
      </div>

      {/* Summary bar */}
      {data?.summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="card p-4">
            <div className="text-2xl font-bold text-slate-900">{data.summary.total}</div>
            <div className="text-sm text-slate-500">Total Conflicts</div>
          </div>
          <div className="card p-4 border-l-4 border-l-red-500">
            <div className="text-2xl font-bold text-red-600">{data.summary.high}</div>
            <div className="text-sm text-slate-500">High Severity</div>
          </div>
          <div className="card p-4 border-l-4 border-l-amber-500">
            <div className="text-2xl font-bold text-amber-600">{data.summary.medium}</div>
            <div className="text-sm text-slate-500">Medium Severity</div>
          </div>
          <div className="card p-4 border-l-4 border-l-blue-500">
            <div className="text-2xl font-bold text-blue-600">{data.summary.low}</div>
            <div className="text-sm text-slate-500">Low Severity</div>
          </div>
        </div>
      )}

      {/* Conflicts list */}
      <div className="space-y-4">
        {data?.conflicts && data.conflicts.length > 0 ? (
          data.conflicts.map((conflict) => {
            const config = severityConfig[conflict.severity];
            const SevIcon = config.icon;
            return (
              <div
                key={conflict.id}
                className={`card p-6 border-l-4 ${
                  conflict.severity === 'high'
                    ? 'border-l-red-500'
                    : conflict.severity === 'medium'
                      ? 'border-l-amber-500'
                      : 'border-l-blue-500'
                }`}
              >
                <div className="flex items-start gap-4">
                  <div
                    className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${config.bg}`}
                  >
                    <SevIcon className={`w-5 h-5 ${config.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      <span className={config.badge}>{conflict.severity}</span>
                      <span className="badge-gray">{conflict.conflictType}</span>
                    </div>
                    <p className="text-sm text-slate-700 mb-3">{conflict.description}</p>
                    <div className="flex items-center gap-3 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="text-slate-500">Rule 1:</span>
                        <span className="font-medium text-slate-900 bg-slate-100 rounded px-2 py-0.5 text-xs">
                          {conflict.rule1Name}
                        </span>
                      </div>
                      <span className="text-slate-300">&harr;</span>
                      <div className="flex items-center gap-2">
                        <span className="text-slate-500">Rule 2:</span>
                        <span className="font-medium text-slate-900 bg-slate-100 rounded px-2 py-0.5 text-xs">
                          {conflict.rule2Name}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="card px-6 py-16 text-center">
            <Shield className="w-10 h-10 text-emerald-300 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-slate-900 mb-1">No Conflicts Detected</h3>
            <p className="text-sm text-slate-500">
              All rules in this rule set are compatible with each other.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
