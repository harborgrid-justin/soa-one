import { useEffect, useState } from 'react';
import {
  RotateCcw,
  Search,
  Play,
  RefreshCw,
  ChevronRight,
  Clock,
  GitCompare,
  CheckCircle,
  XCircle,
  Layers,
  BarChart3,
} from 'lucide-react';
import { getRuleSets, getVersions } from '../api/client';
import api from '../api/client';
import { useStore } from '../store';

interface Execution {
  id: string;
  ruleSetId: string;
  ruleSetName: string;
  input: any;
  output: any;
  timestamp: string;
  version: number;
  executionTimeMs: number;
}

interface ReplayResult {
  originalOutput: any;
  replayOutput: any;
  diff: DiffField[];
  isIdentical: boolean;
  replayVersion: number;
  replayTimeMs: number;
}

interface DiffField {
  path: string;
  type: 'changed' | 'added' | 'removed';
  originalValue?: any;
  replayValue?: any;
}

interface BatchReplayResult {
  totalExecutions: number;
  changedCount: number;
  unchangedCount: number;
  errorCount: number;
  details: {
    executionId: string;
    changed: boolean;
    error?: string;
  }[];
}

export function ExecutionReplay() {
  const { addNotification } = useStore();
  const [searchId, setSearchId] = useState('');
  const [recentExecutions, setRecentExecutions] = useState<Execution[]>([]);
  const [selectedExecution, setSelectedExecution] = useState<Execution | null>(null);
  const [versions, setVersions] = useState<any[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<string>('current');
  const [replayResult, setReplayResult] = useState<ReplayResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [replaying, setReplaying] = useState(false);
  const [activeTab, setActiveTab] = useState<'single' | 'batch'>('single');

  // Batch replay
  const [ruleSets, setRuleSets] = useState<any[]>([]);
  const [batchRuleSetId, setBatchRuleSetId] = useState('');
  const [batchCount, setBatchCount] = useState(10);
  const [batchReplaying, setBatchReplaying] = useState(false);
  const [batchResult, setBatchResult] = useState<BatchReplayResult | null>(null);

  const fetchRecent = async () => {
    setLoading(true);
    try {
      const [execRes, rsRes] = await Promise.all([
        api.get('/execution-replay/recent'),
        getRuleSets(),
      ]);
      setRecentExecutions(execRes.data.executions || execRes.data || []);
      setRuleSets(rsRes.ruleSets || rsRes || []);
    } catch {
      setRecentExecutions([]);
    } finally {
      setLoading(false);
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
    try {
      const res = await api.get(`/execution-replay/${execId}`);
      setSelectedExecution(res.data.execution || res.data);
      setReplayResult(null);
      // Fetch versions for this rule set
      if (res.data.execution?.ruleSetId || res.data.ruleSetId) {
        const rsId = res.data.execution?.ruleSetId || res.data.ruleSetId;
        try {
          const vData = await getVersions(rsId);
          setVersions(vData.versions || vData || []);
        } catch {
          setVersions([]);
        }
      }
    } catch {
      addNotification({ type: 'error', message: 'Execution not found' });
    }
  };

  const handleReplay = async () => {
    if (!selectedExecution) return;
    setReplaying(true);
    setReplayResult(null);
    try {
      const res = await api.post(`/execution-replay/${selectedExecution.id}/replay`, {
        version: selectedVersion === 'current' ? undefined : Number(selectedVersion),
      });
      setReplayResult(res.data);
      addNotification({ type: 'success', message: 'Replay completed' });
    } catch {
      addNotification({ type: 'error', message: 'Replay failed' });
    } finally {
      setReplaying(false);
    }
  };

  const handleBatchReplay = async () => {
    if (!batchRuleSetId) {
      addNotification({ type: 'error', message: 'Please select a rule set' });
      return;
    }
    setBatchReplaying(true);
    setBatchResult(null);
    try {
      const res = await api.post('/execution-replay/batch-replay', {
        ruleSetId: batchRuleSetId,
        count: batchCount,
      });
      setBatchResult(res.data);
      addNotification({ type: 'success', message: 'Batch replay completed' });
    } catch {
      addNotification({ type: 'error', message: 'Batch replay failed' });
    } finally {
      setBatchReplaying(false);
    }
  };

  const diffColor = (type: string) => {
    switch (type) {
      case 'changed':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'added':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'removed':
        return 'bg-red-50 text-red-700 border-red-200';
      default:
        return 'bg-slate-50 text-slate-700 border-slate-200';
    }
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
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-brand-50 flex items-center justify-center">
          <RotateCcw className="w-5 h-5 text-brand-600" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Execution Replay</h1>
          <p className="text-sm text-slate-500">Replay past executions and compare outputs</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200">
        <button
          onClick={() => setActiveTab('single')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'single'
              ? 'border-brand-600 text-brand-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <GitCompare className="w-4 h-4 inline mr-1.5" />
          Single Replay
        </button>
        <button
          onClick={() => setActiveTab('batch')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'batch'
              ? 'border-brand-600 text-brand-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Layers className="w-4 h-4 inline mr-1.5" />
          Batch Replay
        </button>
      </div>

      {activeTab === 'single' && (
        <>
          {/* Search */}
          <div className="card p-5">
            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  className="input pl-10"
                  placeholder="Enter execution ID..."
                  value={searchId}
                  onChange={(e) => setSearchId(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                />
              </div>
              <button onClick={() => handleSearch()} className="btn-primary">
                <Search className="w-4 h-4" />
                Find
              </button>
            </div>

            {/* Recent */}
            {!selectedExecution && recentExecutions.length > 0 && (
              <div className="mt-4">
                <label className="label">Recent Executions</label>
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {recentExecutions.map((exec) => (
                    <button
                      key={exec.id}
                      onClick={() => {
                        setSearchId(exec.id);
                        handleSearch(exec.id);
                      }}
                      className="w-full text-left p-2.5 rounded-lg border border-slate-200 hover:border-brand-300 hover:bg-brand-50/30 transition-colors flex items-center gap-3"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-mono text-slate-400 truncate">
                          {exec.id}
                        </div>
                        <div className="text-sm text-slate-900">{exec.ruleSetName}</div>
                      </div>
                      <div className="text-xs text-slate-400 flex items-center gap-1 flex-shrink-0">
                        <Clock className="w-3 h-3" />
                        {new Date(exec.timestamp).toLocaleDateString()}
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-300 flex-shrink-0" />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Execution detail + Replay */}
          {selectedExecution && (
            <div className="space-y-4">
              {/* Original execution */}
              <div className="card p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-semibold text-slate-900">
                      {selectedExecution.ruleSetName}
                    </h3>
                    <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-2">
                      <span className="font-mono">{selectedExecution.id}</span>
                      <span>&middot;</span>
                      <span>v{selectedExecution.version}</span>
                      <span>&middot;</span>
                      <span>{new Date(selectedExecution.timestamp).toLocaleString()}</span>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">Input</label>
                    <pre className="bg-slate-50 rounded-lg p-3 text-xs font-mono text-slate-700 whitespace-pre-wrap max-h-40 overflow-y-auto">
                      {JSON.stringify(selectedExecution.input, null, 2)}
                    </pre>
                  </div>
                  <div>
                    <label className="label">Output</label>
                    <pre className="bg-slate-50 rounded-lg p-3 text-xs font-mono text-slate-700 whitespace-pre-wrap max-h-40 overflow-y-auto">
                      {JSON.stringify(selectedExecution.output, null, 2)}
                    </pre>
                  </div>
                </div>
              </div>

              {/* Replay controls */}
              <div className="card p-5 flex items-center gap-4">
                <div className="flex-1">
                  <label className="label">Replay With Version</label>
                  <select
                    className="input"
                    value={selectedVersion}
                    onChange={(e) => setSelectedVersion(e.target.value)}
                  >
                    <option value="current">Current (latest)</option>
                    {versions.map((v: any) => (
                      <option key={v.version || v.id} value={v.version || v.id}>
                        v{v.version || v.id}
                        {v.changelog ? ` - ${v.changelog}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  onClick={handleReplay}
                  className="btn-primary mt-5"
                  disabled={replaying}
                >
                  {replaying ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Play className="w-4 h-4" />
                  )}
                  Replay
                </button>
              </div>

              {/* Replay result */}
              {replayResult && (
                <div className="space-y-4">
                  <div className="card p-5">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-semibold text-slate-900">Comparison</h3>
                      {replayResult.isIdentical ? (
                        <span className="badge-green">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Identical
                        </span>
                      ) : (
                        <span className="badge-yellow">
                          <XCircle className="w-3 h-3 mr-1" />
                          {replayResult.diff.length} difference(s)
                        </span>
                      )}
                    </div>

                    {/* Side by side */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="label">Original Output (v{selectedExecution.version})</label>
                        <pre className="bg-slate-50 rounded-lg p-3 text-xs font-mono text-slate-700 whitespace-pre-wrap max-h-60 overflow-y-auto">
                          {JSON.stringify(replayResult.originalOutput, null, 2)}
                        </pre>
                      </div>
                      <div>
                        <label className="label">Replay Output (v{replayResult.replayVersion})</label>
                        <pre className="bg-slate-50 rounded-lg p-3 text-xs font-mono text-slate-700 whitespace-pre-wrap max-h-60 overflow-y-auto">
                          {JSON.stringify(replayResult.replayOutput, null, 2)}
                        </pre>
                      </div>
                    </div>
                  </div>

                  {/* Diff details */}
                  {replayResult.diff.length > 0 && (
                    <div className="card p-5">
                      <h3 className="font-semibold text-slate-900 mb-3">Differences</h3>
                      <div className="space-y-2">
                        {replayResult.diff.map((d, i) => (
                          <div
                            key={i}
                            className={`rounded-lg border px-4 py-3 ${diffColor(d.type)}`}
                          >
                            <div className="flex items-center gap-2 text-sm font-medium">
                              <span className="font-mono">{d.path}</span>
                              <span
                                className={`text-xs px-1.5 py-0.5 rounded ${
                                  d.type === 'changed'
                                    ? 'bg-amber-200'
                                    : d.type === 'added'
                                      ? 'bg-emerald-200'
                                      : 'bg-red-200'
                                }`}
                              >
                                {d.type}
                              </span>
                            </div>
                            <div className="flex gap-4 mt-1 text-xs font-mono">
                              {d.originalValue !== undefined && (
                                <span>
                                  old: {JSON.stringify(d.originalValue)}
                                </span>
                              )}
                              {d.replayValue !== undefined && (
                                <span>
                                  new: {JSON.stringify(d.replayValue)}
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {!selectedExecution && (
            <div className="card px-6 py-16 text-center">
              <RotateCcw className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="text-sm text-slate-500">
                Search for an execution ID or select a recent execution to replay.
              </p>
            </div>
          )}
        </>
      )}

      {activeTab === 'batch' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Config */}
          <div className="space-y-4">
            <div className="card p-5 space-y-4">
              <div>
                <label className="label">Rule Set</label>
                <select
                  className="input"
                  value={batchRuleSetId}
                  onChange={(e) => setBatchRuleSetId(e.target.value)}
                >
                  <option value="">Select a rule set...</option>
                  {ruleSets.map((rs: any) => (
                    <option key={rs.id} value={rs.id}>
                      {rs.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Number of Executions to Replay</label>
                <input
                  className="input"
                  type="number"
                  min={1}
                  max={100}
                  value={batchCount}
                  onChange={(e) => setBatchCount(Number(e.target.value))}
                />
              </div>
              <button
                onClick={handleBatchReplay}
                className="btn-primary w-full justify-center"
                disabled={batchReplaying || !batchRuleSetId}
              >
                {batchReplaying ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Replaying...
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4" />
                    Run Batch Replay
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Right: Results */}
          <div className="space-y-4">
            {batchResult ? (
              <>
                {/* Summary */}
                <div className="card p-4 grid grid-cols-4 gap-4 text-center">
                  <div>
                    <div className="text-lg font-bold text-slate-900">
                      {batchResult.totalExecutions}
                    </div>
                    <div className="text-xs text-slate-500">Total</div>
                  </div>
                  <div>
                    <div className="text-lg font-bold text-amber-600">
                      {batchResult.changedCount}
                    </div>
                    <div className="text-xs text-slate-500">Changed</div>
                  </div>
                  <div>
                    <div className="text-lg font-bold text-emerald-600">
                      {batchResult.unchangedCount}
                    </div>
                    <div className="text-xs text-slate-500">Unchanged</div>
                  </div>
                  <div>
                    <div className="text-lg font-bold text-red-600">
                      {batchResult.errorCount}
                    </div>
                    <div className="text-xs text-slate-500">Errors</div>
                  </div>
                </div>

                {/* Details list */}
                <div className="card">
                  <div className="px-6 py-4 border-b border-slate-200">
                    <h3 className="font-semibold text-slate-900">Results</h3>
                  </div>
                  <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
                    {batchResult.details.map((detail, idx) => (
                      <div
                        key={idx}
                        className="px-6 py-3 flex items-center gap-3"
                      >
                        <span className="text-xs text-slate-400 font-mono w-16 truncate">
                          {detail.executionId}
                        </span>
                        {detail.error ? (
                          <span className="bg-red-100 text-red-700 text-xs font-medium px-2 py-0.5 rounded-full inline-flex items-center">
                            <XCircle className="w-3 h-3 mr-1" />
                            Error
                          </span>
                        ) : detail.changed ? (
                          <span className="badge-yellow">
                            Changed
                          </span>
                        ) : (
                          <span className="badge-green">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Unchanged
                          </span>
                        )}
                        {detail.error && (
                          <span className="text-xs text-red-500 truncate">
                            {detail.error}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <div className="card px-6 py-16 text-center">
                <BarChart3 className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                <p className="text-sm text-slate-500">
                  {batchReplaying
                    ? 'Running batch replay...'
                    : 'Select a rule set and run batch replay to see how many decisions changed.'}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
