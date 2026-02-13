import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  GitCompare,
  ChevronRight,
  Plus,
  Minus,
  Pencil,
  ArrowLeft,
  RefreshCw,
  FileText,
} from 'lucide-react';
import { getVersionDiff } from '../api/client';
import { useStore } from '../store';

interface FieldChange {
  field: string;
  before: any;
  after: any;
}

interface RuleDiff {
  id: string;
  name: string;
  status: 'added' | 'removed' | 'modified' | 'unchanged';
  fields?: FieldChange[];
  rule?: any;
  v1Rule?: any;
  v2Rule?: any;
}

interface DiffData {
  ruleSetId: string;
  ruleSetName: string;
  v1: number;
  v2: number;
  v1PublishedAt: string;
  v2PublishedAt: string;
  rules: RuleDiff[];
  summary: {
    added: number;
    removed: number;
    modified: number;
    unchanged: number;
  };
}

export function VersionDiff() {
  const { ruleSetId, v1, v2 } = useParams<{ ruleSetId: string; v1: string; v2: string }>();
  const { addNotification } = useStore();
  const [diff, setDiff] = useState<DiffData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedRules, setExpandedRules] = useState<Set<string>>(new Set());

  const fetchDiff = () => {
    if (!ruleSetId || !v1 || !v2) return;
    setLoading(true);
    getVersionDiff(ruleSetId, Number(v1), Number(v2))
      .then((data) => setDiff(data))
      .catch(() => {
        addNotification({ type: 'error', message: 'Failed to load version diff' });
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchDiff();
  }, [ruleSetId, v1, v2]);

  const toggleRule = (ruleId: string) => {
    setExpandedRules((prev) => {
      const next = new Set(prev);
      if (next.has(ruleId)) next.delete(ruleId);
      else next.add(ruleId);
      return next;
    });
  };

  const statusConfig = {
    added: {
      bg: 'bg-emerald-50 border-emerald-200',
      text: 'text-emerald-700',
      badge: 'badge-green',
      icon: Plus,
      label: 'Added',
    },
    removed: {
      bg: 'bg-red-50 border-red-200',
      text: 'text-red-700',
      badge: 'bg-red-100 text-red-700 text-xs font-medium px-2 py-0.5 rounded-full',
      icon: Minus,
      label: 'Removed',
    },
    modified: {
      bg: 'bg-amber-50 border-amber-200',
      text: 'text-amber-700',
      badge: 'badge-yellow',
      icon: Pencil,
      label: 'Modified',
    },
    unchanged: {
      bg: 'bg-slate-50 border-slate-200',
      text: 'text-slate-500',
      badge: 'badge-gray',
      icon: FileText,
      label: 'Unchanged',
    },
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
          {diff?.ruleSetName || 'Rule Set'}
        </Link>
        <ChevronRight className="w-4 h-4" />
        <span className="text-slate-900 font-medium">
          Version {v1} vs {v2}
        </span>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-brand-50 flex items-center justify-center">
            <GitCompare className="w-5 h-5 text-brand-600" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Version Comparison</h1>
            <p className="text-sm text-slate-500">
              Comparing v{v1} with v{v2}
              {diff?.v1PublishedAt && diff?.v2PublishedAt && (
                <span>
                  {' '}
                  &middot; {new Date(diff.v1PublishedAt).toLocaleDateString()} vs{' '}
                  {new Date(diff.v2PublishedAt).toLocaleDateString()}
                </span>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchDiff} className="btn-secondary btn-sm" disabled={loading}>
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <Link to={`/rule-sets/${ruleSetId}`} className="btn-secondary btn-sm">
            <ArrowLeft className="w-3.5 h-3.5" />
            Back
          </Link>
        </div>
      </div>

      {/* Summary bar */}
      {diff?.summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="card p-4 border-l-4 border-l-emerald-500">
            <div className="text-2xl font-bold text-emerald-700">{diff.summary.added}</div>
            <div className="text-sm text-slate-500">Added</div>
          </div>
          <div className="card p-4 border-l-4 border-l-red-500">
            <div className="text-2xl font-bold text-red-700">{diff.summary.removed}</div>
            <div className="text-sm text-slate-500">Removed</div>
          </div>
          <div className="card p-4 border-l-4 border-l-amber-500">
            <div className="text-2xl font-bold text-amber-700">{diff.summary.modified}</div>
            <div className="text-sm text-slate-500">Modified</div>
          </div>
          <div className="card p-4 border-l-4 border-l-slate-300">
            <div className="text-2xl font-bold text-slate-600">{diff.summary.unchanged}</div>
            <div className="text-sm text-slate-500">Unchanged</div>
          </div>
        </div>
      )}

      {/* Side-by-side diff panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* V1 Panel */}
        <div className="card">
          <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 rounded-t-xl">
            <h3 className="font-semibold text-slate-900">Version {v1}</h3>
            {diff?.v1PublishedAt && (
              <p className="text-xs text-slate-500 mt-1">
                Published {new Date(diff.v1PublishedAt).toLocaleString()}
              </p>
            )}
          </div>
          <div className="divide-y divide-slate-100">
            {diff?.rules
              ?.filter((r) => r.status !== 'added')
              .map((rule) => {
                const config = statusConfig[rule.status];
                const Icon = config.icon;
                return (
                  <div
                    key={`v1-${rule.id}`}
                    className={`px-6 py-4 ${rule.status === 'removed' ? 'bg-red-50/50' : rule.status === 'modified' ? 'bg-amber-50/30' : ''}`}
                  >
                    <div className="flex items-center gap-2">
                      <Icon className={`w-4 h-4 ${config.text}`} />
                      <span className="font-medium text-sm text-slate-900">{rule.name}</span>
                      <span className={config.badge}>{config.label}</span>
                    </div>
                    {rule.status === 'modified' && rule.fields && (
                      <div className="mt-3 space-y-2">
                        {rule.fields.map((field) => (
                          <div key={field.field} className="text-xs">
                            <span className="font-medium text-slate-600">{field.field}:</span>
                            <div className="bg-red-50 rounded px-2 py-1 mt-1 font-mono text-red-700">
                              {typeof field.before === 'object'
                                ? JSON.stringify(field.before, null, 2)
                                : String(field.before ?? '(empty)')}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            {diff?.rules?.filter((r) => r.status !== 'added').length === 0 && (
              <div className="px-6 py-12 text-center text-sm text-slate-400">
                No rules in this version
              </div>
            )}
          </div>
        </div>

        {/* V2 Panel */}
        <div className="card">
          <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 rounded-t-xl">
            <h3 className="font-semibold text-slate-900">Version {v2}</h3>
            {diff?.v2PublishedAt && (
              <p className="text-xs text-slate-500 mt-1">
                Published {new Date(diff.v2PublishedAt).toLocaleString()}
              </p>
            )}
          </div>
          <div className="divide-y divide-slate-100">
            {diff?.rules
              ?.filter((r) => r.status !== 'removed')
              .map((rule) => {
                const config = statusConfig[rule.status];
                const Icon = config.icon;
                return (
                  <div
                    key={`v2-${rule.id}`}
                    className={`px-6 py-4 ${rule.status === 'added' ? 'bg-emerald-50/50' : rule.status === 'modified' ? 'bg-amber-50/30' : ''}`}
                  >
                    <div className="flex items-center gap-2">
                      <Icon className={`w-4 h-4 ${config.text}`} />
                      <span className="font-medium text-sm text-slate-900">{rule.name}</span>
                      <span className={config.badge}>{config.label}</span>
                    </div>
                    {rule.status === 'modified' && rule.fields && (
                      <div className="mt-3 space-y-2">
                        {rule.fields.map((field) => (
                          <div key={field.field} className="text-xs">
                            <span className="font-medium text-slate-600">{field.field}:</span>
                            <div className="bg-emerald-50 rounded px-2 py-1 mt-1 font-mono text-emerald-700">
                              {typeof field.after === 'object'
                                ? JSON.stringify(field.after, null, 2)
                                : String(field.after ?? '(empty)')}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            {diff?.rules?.filter((r) => r.status !== 'removed').length === 0 && (
              <div className="px-6 py-12 text-center text-sm text-slate-400">
                No rules in this version
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Detailed changes (expandable) */}
      <div className="card">
        <div className="px-6 py-4 border-b border-slate-200">
          <h3 className="font-semibold text-slate-900">All Changes</h3>
        </div>
        <div className="divide-y divide-slate-100">
          {diff?.rules?.map((rule) => {
            const config = statusConfig[rule.status];
            const Icon = config.icon;
            const expanded = expandedRules.has(rule.id);
            return (
              <div key={rule.id}>
                <button
                  onClick={() => toggleRule(rule.id)}
                  className={`w-full px-6 py-4 flex items-center gap-3 text-left hover:bg-slate-50/50 transition-colors ${
                    rule.status === 'added'
                      ? 'bg-emerald-50/30'
                      : rule.status === 'removed'
                        ? 'bg-red-50/30'
                        : rule.status === 'modified'
                          ? 'bg-amber-50/30'
                          : ''
                  }`}
                >
                  <ChevronRight
                    className={`w-4 h-4 text-slate-400 transition-transform ${expanded ? 'rotate-90' : ''}`}
                  />
                  <Icon className={`w-4 h-4 ${config.text}`} />
                  <span className="font-medium text-sm text-slate-900">{rule.name}</span>
                  <span className={config.badge}>{config.label}</span>
                </button>
                {expanded && (
                  <div className="px-6 pb-4 pl-16">
                    {rule.status === 'modified' && rule.fields && rule.fields.length > 0 ? (
                      <div className="space-y-3">
                        {rule.fields.map((field) => (
                          <div
                            key={field.field}
                            className="grid grid-cols-1 sm:grid-cols-2 gap-3"
                          >
                            <div>
                              <div className="text-xs font-medium text-slate-500 mb-1">
                                {field.field} (before)
                              </div>
                              <div className="bg-red-50 rounded-lg px-3 py-2 text-xs font-mono text-red-700 border border-red-100">
                                {typeof field.before === 'object'
                                  ? JSON.stringify(field.before, null, 2)
                                  : String(field.before ?? '(empty)')}
                              </div>
                            </div>
                            <div>
                              <div className="text-xs font-medium text-slate-500 mb-1">
                                {field.field} (after)
                              </div>
                              <div className="bg-emerald-50 rounded-lg px-3 py-2 text-xs font-mono text-emerald-700 border border-emerald-100">
                                {typeof field.after === 'object'
                                  ? JSON.stringify(field.after, null, 2)
                                  : String(field.after ?? '(empty)')}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : rule.status === 'added' ? (
                      <p className="text-sm text-emerald-600">
                        This rule was added in version {v2}.
                      </p>
                    ) : rule.status === 'removed' ? (
                      <p className="text-sm text-red-600">
                        This rule was removed in version {v2}.
                      </p>
                    ) : (
                      <p className="text-sm text-slate-500">No changes to this rule.</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          {(!diff?.rules || diff.rules.length === 0) && (
            <div className="px-6 py-12 text-center">
              <GitCompare className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="text-sm text-slate-500">No differences found between versions.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
