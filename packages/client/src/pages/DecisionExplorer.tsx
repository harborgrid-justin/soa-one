import { useEffect, useState, useMemo } from 'react';
import {
  Search,
  GitBranch,
  CheckCircle,
  XCircle,
  ChevronDown,
  ChevronRight,
  Zap,
  Clock,
  Hash,
  BarChart3,
  RefreshCw,
} from 'lucide-react';
import api from '../api/client';
import { useStore } from '../store';
import { ReadOnlyFlowGraph } from '../components/flow/ReadOnlyFlowGraph';
import { getAutoLayout } from '../components/flow/autoLayout';
import type { Node, Edge } from '@xyflow/react';

interface ConditionEval {
  field: string;
  operator: string;
  expected: any;
  actual: any;
  matched: boolean;
}

interface RuleEval {
  ruleId: string;
  ruleName: string;
  evaluated: boolean;
  fired: boolean;
  conditions: ConditionEval[];
  actions: string[];
  executionOrder: number;
}

interface DecisionTrace {
  executionId: string;
  ruleSetId: string;
  ruleSetName: string;
  input: any;
  output: any;
  timestamp: string;
  totalRulesEvaluated: number;
  totalRulesFired: number;
  totalRulesSkipped: number;
  evaluations: RuleEval[];
  executionTimeMs: number;
}

interface RecentExecution {
  id: string;
  ruleSetName: string;
  timestamp: string;
  status: string;
}

export function DecisionExplorer() {
  const { addNotification } = useStore();
  const [loading, setLoading] = useState(false);
  const [searchId, setSearchId] = useState('');
  const [trace, setTrace] = useState<DecisionTrace | null>(null);
  const [recentExecutions, setRecentExecutions] = useState<RecentExecution[]>([]);
  const [expandedRules, setExpandedRules] = useState<Set<string>>(new Set());
  const [loadingRecent, setLoadingRecent] = useState(true);

  const fetchRecent = async () => {
    setLoadingRecent(true);
    try {
      const res = await api.get('/decision-explorer/recent');
      setRecentExecutions(res.data.executions || res.data || []);
    } catch {
      setRecentExecutions([]);
    } finally {
      setLoadingRecent(false);
    }
  };

  useEffect(() => {
    fetchRecent();
  }, []);

  const handleSearch = async (id?: string) => {
    const execId = id || searchId.trim();
    if (!execId) {
      addNotification({ type: 'error', message: 'Please enter an execution ID' });
      return;
    }
    setLoading(true);
    setTrace(null);
    try {
      const res = await api.get(`/decision-explorer/trace/${execId}`);
      setTrace(res.data);
      setExpandedRules(new Set());
    } catch {
      addNotification({ type: 'error', message: 'Execution trace not found' });
    } finally {
      setLoading(false);
    }
  };

  const toggleRule = (ruleId: string) => {
    setExpandedRules((prev) => {
      const next = new Set(prev);
      if (next.has(ruleId)) {
        next.delete(ruleId);
      } else {
        next.add(ruleId);
      }
      return next;
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-brand-50 flex items-center justify-center">
          <GitBranch className="w-5 h-5 text-brand-600" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Decision Explorer</h1>
          <p className="text-sm text-slate-500">Trace and visualize rule evaluations</p>
        </div>
      </div>

      {/* Search */}
      <div className="card p-5">
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              className="input pl-10"
              placeholder="Enter execution log ID..."
              value={searchId}
              onChange={(e) => setSearchId(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
          </div>
          <button
            onClick={() => handleSearch()}
            className="btn-primary"
            disabled={loading}
          >
            {loading ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Search className="w-4 h-4" />
            )}
            Search
          </button>
        </div>

        {/* Recent executions */}
        {!trace && (
          <div className="mt-4">
            <label className="label">Recent Executions</label>
            {loadingRecent ? (
              <div className="flex items-center justify-center py-4">
                <div className="w-5 h-5 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : recentExecutions.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 mt-2">
                {recentExecutions.slice(0, 9).map((exec) => (
                  <button
                    key={exec.id}
                    onClick={() => {
                      setSearchId(exec.id);
                      handleSearch(exec.id);
                    }}
                    className="text-left p-3 rounded-lg border border-slate-200 hover:border-brand-300 hover:bg-brand-50/30 transition-colors"
                  >
                    <div className="text-xs font-mono text-slate-500 truncate">{exec.id}</div>
                    <div className="text-sm font-medium text-slate-900 mt-0.5">
                      {exec.ruleSetName}
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5">
                      {new Date(exec.timestamp).toLocaleString()}
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-400 mt-2">No recent executions found.</p>
            )}
          </div>
        )}
      </div>

      {/* Trace Results */}
      {trace && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Summary */}
          <div className="space-y-4">
            {/* Summary card */}
            <div className="card p-5">
              <h3 className="font-semibold text-slate-900 mb-3">Summary</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500">Rule Set</span>
                  <span className="font-medium text-slate-900">{trace.ruleSetName}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500">Timestamp</span>
                  <span className="text-slate-700">
                    {new Date(trace.timestamp).toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500">Execution Time</span>
                  <span className="font-mono text-slate-700">{trace.executionTimeMs}ms</span>
                </div>
                <hr className="border-slate-100" />
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-slate-50 rounded-lg p-2">
                    <div className="text-lg font-bold text-slate-900">
                      {trace.totalRulesEvaluated}
                    </div>
                    <div className="text-xs text-slate-500">Evaluated</div>
                  </div>
                  <div className="bg-emerald-50 rounded-lg p-2">
                    <div className="text-lg font-bold text-emerald-600">
                      {trace.totalRulesFired}
                    </div>
                    <div className="text-xs text-slate-500">Fired</div>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-2">
                    <div className="text-lg font-bold text-slate-400">
                      {trace.totalRulesSkipped}
                    </div>
                    <div className="text-xs text-slate-500">Skipped</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Input / Output */}
            <div className="card p-5">
              <h3 className="font-semibold text-slate-900 mb-2">Input</h3>
              <pre className="bg-slate-50 rounded-lg p-3 text-xs font-mono text-slate-700 whitespace-pre-wrap max-h-40 overflow-y-auto">
                {JSON.stringify(trace.input, null, 2)}
              </pre>
            </div>
            <div className="card p-5">
              <h3 className="font-semibold text-slate-900 mb-2">Output</h3>
              <pre className="bg-emerald-50 rounded-lg p-3 text-xs font-mono text-emerald-700 whitespace-pre-wrap max-h-40 overflow-y-auto">
                {JSON.stringify(trace.output, null, 2)}
              </pre>
            </div>
          </div>

          {/* Right: Flow + Timeline */}
          <div className="lg:col-span-2 space-y-4">
            {/* Decision Trace Flow Graph */}
            {trace.evaluations.length > 0 && <TraceFlowGraph evaluations={trace.evaluations} />}

            <div className="card">
              <div className="px-6 py-4 border-b border-slate-200">
                <h3 className="font-semibold text-slate-900">Evaluation Timeline</h3>
              </div>
              <div className="p-6">
                {trace.evaluations.length > 0 ? (
                  <div className="relative">
                    {/* Vertical line */}
                    <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-slate-200" />

                    <div className="space-y-4">
                      {trace.evaluations
                        .sort((a, b) => a.executionOrder - b.executionOrder)
                        .map((evalItem) => (
                          <div key={evalItem.ruleId} className="relative pl-12">
                            {/* Dot */}
                            <div
                              className={`absolute left-2.5 top-3 w-3 h-3 rounded-full border-2 ${
                                evalItem.fired
                                  ? 'bg-emerald-500 border-emerald-500'
                                  : evalItem.evaluated
                                    ? 'bg-slate-300 border-slate-300'
                                    : 'bg-white border-slate-300'
                              }`}
                            />

                            <div
                              className={`rounded-lg border p-4 ${
                                evalItem.fired
                                  ? 'border-emerald-200 bg-emerald-50/30'
                                  : 'border-slate-200'
                              }`}
                            >
                              <button
                                onClick={() => toggleRule(evalItem.ruleId)}
                                className="w-full text-left flex items-center justify-between"
                              >
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-mono text-slate-400">
                                    #{evalItem.executionOrder}
                                  </span>
                                  <span className="font-medium text-slate-900">
                                    {evalItem.ruleName}
                                  </span>
                                  {evalItem.fired ? (
                                    <span className="badge-green">Fired</span>
                                  ) : evalItem.evaluated ? (
                                    <span className="badge-gray">Skipped</span>
                                  ) : (
                                    <span className="badge-gray">Not Evaluated</span>
                                  )}
                                </div>
                                {expandedRules.has(evalItem.ruleId) ? (
                                  <ChevronDown className="w-4 h-4 text-slate-400" />
                                ) : (
                                  <ChevronRight className="w-4 h-4 text-slate-400" />
                                )}
                              </button>

                              {expandedRules.has(evalItem.ruleId) && (
                                <div className="mt-3 space-y-3">
                                  {/* Conditions */}
                                  {evalItem.conditions.length > 0 && (
                                    <div>
                                      <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                                        Conditions
                                      </h4>
                                      <div className="space-y-1.5">
                                        {evalItem.conditions.map((cond, i) => (
                                          <div
                                            key={i}
                                            className={`flex items-center gap-3 text-xs rounded-lg px-3 py-2 ${
                                              cond.matched
                                                ? 'bg-emerald-50 text-emerald-700'
                                                : 'bg-red-50 text-red-700'
                                            }`}
                                          >
                                            {cond.matched ? (
                                              <CheckCircle className="w-3.5 h-3.5 flex-shrink-0" />
                                            ) : (
                                              <XCircle className="w-3.5 h-3.5 flex-shrink-0" />
                                            )}
                                            <span className="font-mono font-medium">
                                              {cond.field}
                                            </span>
                                            <span>{cond.operator}</span>
                                            <span className="font-mono">
                                              {JSON.stringify(cond.expected)}
                                            </span>
                                            <span className="text-slate-400">|</span>
                                            <span className="text-slate-600">
                                              actual: {JSON.stringify(cond.actual)}
                                            </span>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}

                                  {/* Actions */}
                                  {evalItem.actions.length > 0 && (
                                    <div>
                                      <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                                        Actions Taken
                                      </h4>
                                      <div className="space-y-1">
                                        {evalItem.actions.map((action, i) => (
                                          <div
                                            key={i}
                                            className="flex items-center gap-2 text-xs bg-blue-50 text-blue-700 rounded-lg px-3 py-2"
                                          >
                                            <Zap className="w-3.5 h-3.5" />
                                            {action}
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <GitBranch className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                    <p className="text-sm text-slate-500">No evaluation data available.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Empty state when no trace loaded */}
      {!trace && !loading && (
        <div className="card px-6 py-16 text-center">
          <BarChart3 className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Enter an execution ID or select a recent execution to view its decision trace.
          </p>
        </div>
      )}
    </div>
  );
}

/** Visualizes rule evaluations as a decision trace flow */
function TraceFlowGraph({ evaluations }: { evaluations: RuleEval[] }) {
  const { nodes, edges } = useMemo(() => {
    const sorted = [...evaluations].sort((a, b) => a.executionOrder - b.executionOrder);
    const rawNodes: Node[] = [
      { id: 'input', type: 'dependency', position: { x: 0, y: 0 }, data: { label: 'Input', status: 'fired' } },
      ...sorted.map((ev) => ({
        id: ev.ruleId,
        type: 'dependency' as const,
        position: { x: 0, y: 0 },
        data: {
          label: ev.ruleName,
          status: ev.fired ? 'fired' : ev.evaluated ? 'skipped' : 'skipped',
          description: ev.fired ? `Fired (${ev.conditions.length} conditions)` : 'Skipped',
        },
      })),
      { id: 'output', type: 'dependency', position: { x: 0, y: 0 }, data: { label: 'Output', status: 'fired' } },
    ];
    const rawEdges: Edge[] = [
      { id: 'e-input-first', source: 'input', target: sorted[0]?.ruleId || 'output', animated: true, type: 'labeled' },
      ...sorted.slice(1).map((ev, i) => ({
        id: `e-${sorted[i].ruleId}-${ev.ruleId}`,
        source: sorted[i].ruleId,
        target: ev.ruleId,
        animated: true,
        type: 'labeled' as const,
      })),
      { id: 'e-last-output', source: sorted[sorted.length - 1]?.ruleId || 'input', target: 'output', animated: true, type: 'labeled' },
    ];
    return getAutoLayout(rawNodes, rawEdges);
  }, [evaluations]);

  return (
    <div className="card overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex items-center gap-2">
        <GitBranch className="w-4 h-4 text-brand-600" />
        <h3 className="font-semibold text-slate-900 dark:text-white text-sm">Decision Trace Flow</h3>
        <div className="ml-auto flex items-center gap-3 text-[10px]">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" /> Fired</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-slate-300" /> Skipped</span>
        </div>
      </div>
      <ReadOnlyFlowGraph nodes={nodes} edges={edges} height="280px" showMinimap={false} className="border-0 shadow-none rounded-none" />
    </div>
  );
}
