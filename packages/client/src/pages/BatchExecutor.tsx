import { useEffect, useState } from 'react';
import {
  Play,
  Layers,
  CheckCircle,
  XCircle,
  RefreshCw,
  Clock,
} from 'lucide-react';
import { getRuleSets, batchExecuteRuleSet } from '../api/client';
import { useStore } from '../store';

interface BatchResultItem {
  index: number;
  input: any;
  output: any;
  success: boolean;
  error?: string;
  executionTimeMs?: number;
}

interface BatchJob {
  id: string;
  ruleSetId: string;
  ruleSetName?: string;
  totalItems: number;
  completedItems: number;
  successCount: number;
  failureCount: number;
  status: 'running' | 'completed' | 'failed';
  createdAt: string;
  results?: BatchResultItem[];
}

const SAMPLE_BATCH_INPUT = `[
  {
    "applicant": { "age": 28, "state": "CA", "creditScore": 780 },
    "coverage": { "type": "standard", "deductible": 500 }
  },
  {
    "applicant": { "age": 45, "state": "NY", "creditScore": 650 },
    "coverage": { "type": "premium", "deductible": 250 }
  },
  {
    "applicant": { "age": 19, "state": "TX", "creditScore": 580 },
    "coverage": { "type": "basic", "deductible": 1000 }
  }
]`;

export function BatchExecutor() {
  const { addNotification } = useStore();
  const [ruleSets, setRuleSets] = useState<any[]>([]);
  const [selectedRuleSetId, setSelectedRuleSetId] = useState('');
  const [batchInput, setBatchInput] = useState(SAMPLE_BATCH_INPUT);
  const [loading, setLoading] = useState(true);
  const [executing, setExecuting] = useState(false);
  const [results, setResults] = useState<BatchResultItem[]>([]);
  const [jobs, setJobs] = useState<BatchJob[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    getRuleSets()
      .then((data) => {
        const list = data.ruleSets || data || [];
        setRuleSets(list);
      })
      .catch(() => {
        setRuleSets([]);
      })
      .finally(() => setLoading(false));
  }, []);

  const handleExecute = async () => {
    if (!selectedRuleSetId) {
      addNotification({ type: 'error', message: 'Please select a rule set' });
      return;
    }

    let parsed: any[];
    try {
      parsed = JSON.parse(batchInput);
      if (!Array.isArray(parsed)) {
        throw new Error('Input must be a JSON array');
      }
    } catch (err: any) {
      setError(err.message || 'Invalid JSON input');
      addNotification({ type: 'error', message: 'Invalid JSON: input must be a JSON array' });
      return;
    }

    setExecuting(true);
    setResults([]);
    setError('');

    try {
      const res = await batchExecuteRuleSet(selectedRuleSetId, { items: parsed });
      const batchResults: BatchResultItem[] = res.results || res || [];
      setResults(batchResults);

      const successCount = batchResults.filter((r) => r.success).length;
      const failCount = batchResults.length - successCount;

      const newJob: BatchJob = {
        id: res.id || crypto.randomUUID(),
        ruleSetId: selectedRuleSetId,
        ruleSetName: ruleSets.find((rs) => rs.id === selectedRuleSetId)?.name,
        totalItems: parsed.length,
        completedItems: batchResults.length,
        successCount,
        failureCount: failCount,
        status: 'completed',
        createdAt: new Date().toISOString(),
        results: batchResults,
      };
      setJobs((prev) => [newJob, ...prev]);

      addNotification({
        type: 'success',
        message: `Batch complete: ${successCount} succeeded, ${failCount} failed`,
      });
    } catch (err: any) {
      const msg = err.response?.data?.error || err.message || 'Batch execution failed';
      setError(msg);
      addNotification({ type: 'error', message: msg });
    } finally {
      setExecuting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const successCount = results.filter((r) => r.success).length;
  const failCount = results.length - successCount;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-brand-50 flex items-center justify-center">
          <Layers className="w-5 h-5 text-brand-600" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Batch Executor</h1>
          <p className="text-sm text-slate-500">
            Execute rule sets against multiple inputs simultaneously
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Input */}
        <div className="space-y-4">
          <div className="card p-5">
            <label className="label">Select Rule Set</label>
            <select
              className="input"
              value={selectedRuleSetId}
              onChange={(e) => setSelectedRuleSetId(e.target.value)}
            >
              <option value="">Choose a rule set...</option>
              {ruleSets.map((rs: any) => (
                <option key={rs.id} value={rs.id}>
                  {rs.name} {rs.version ? `(v${rs.version})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="card p-5">
            <label className="label">Batch Input (JSON Array)</label>
            <textarea
              className="input font-mono text-sm min-h-[300px]"
              value={batchInput}
              onChange={(e) => setBatchInput(e.target.value)}
              spellCheck={false}
              placeholder='[{"key": "value"}, {"key": "value2"}]'
            />
          </div>

          <button
            onClick={handleExecute}
            className="btn-primary w-full justify-center"
            disabled={executing || !selectedRuleSetId}
          >
            {executing ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Executing Batch...
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                Execute Batch
              </>
            )}
          </button>
        </div>

        {/* Right: Results */}
        <div className="space-y-4">
          {error && (
            <div className="card p-5 border-red-200 bg-red-50">
              <div className="flex items-center gap-2 text-red-700 font-medium mb-2">
                <XCircle className="w-5 h-5" /> Execution Error
              </div>
              <pre className="text-sm font-mono text-red-600 whitespace-pre-wrap">{error}</pre>
            </div>
          )}

          {executing && (
            <div className="card p-8 text-center">
              <RefreshCw className="w-8 h-8 text-brand-600 animate-spin mx-auto mb-3" />
              <p className="text-sm text-slate-500">Processing batch items...</p>
            </div>
          )}

          {results.length > 0 && (
            <>
              {/* Summary */}
              <div className="grid grid-cols-3 gap-4">
                <div className="card p-4 text-center">
                  <div className="text-2xl font-bold text-slate-900">{results.length}</div>
                  <div className="text-xs text-slate-500">Total Items</div>
                </div>
                <div className="card p-4 text-center">
                  <div className="text-2xl font-bold text-emerald-600">{successCount}</div>
                  <div className="text-xs text-slate-500">Succeeded</div>
                </div>
                <div className="card p-4 text-center">
                  <div className="text-2xl font-bold text-red-600">{failCount}</div>
                  <div className="text-xs text-slate-500">Failed</div>
                </div>
              </div>

              {/* Results table */}
              <div className="card">
                <div className="px-6 py-4 border-b border-slate-200">
                  <h3 className="font-semibold text-slate-900">Results</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50">
                        <th className="text-left px-6 py-3 font-medium text-slate-600">#</th>
                        <th className="text-left px-6 py-3 font-medium text-slate-600">Status</th>
                        <th className="text-left px-6 py-3 font-medium text-slate-600">Output / Error</th>
                        <th className="text-left px-6 py-3 font-medium text-slate-600">Time</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {results.map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/50">
                          <td className="px-6 py-3 text-slate-700">{idx + 1}</td>
                          <td className="px-6 py-3">
                            {item.success ? (
                              <span className="badge-green flex items-center gap-1 w-fit">
                                <CheckCircle className="w-3 h-3" /> Success
                              </span>
                            ) : (
                              <span className="badge-red flex items-center gap-1 w-fit">
                                <XCircle className="w-3 h-3" /> Failed
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-3">
                            <pre className="text-xs font-mono text-slate-600 whitespace-pre-wrap max-w-xs truncate">
                              {item.success
                                ? JSON.stringify(item.output, null, 2).substring(0, 120)
                                : item.error || 'Unknown error'}
                            </pre>
                          </td>
                          <td className="px-6 py-3 text-slate-500">
                            {item.executionTimeMs != null ? `${item.executionTimeMs}ms` : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {!results.length && !error && !executing && (
            <div className="card p-12 text-center">
              <Play className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="text-sm text-slate-500">
                Select a rule set, enter batch input, and click Execute
              </p>
            </div>
          )}

          {/* Previous Jobs */}
          {jobs.length > 0 && (
            <div className="card">
              <div className="px-6 py-4 border-b border-slate-200">
                <h3 className="font-semibold text-slate-900">Previous Batch Jobs</h3>
              </div>
              <div className="divide-y divide-slate-100">
                {jobs.map((job) => (
                  <div key={job.id} className="px-6 py-4 flex items-center gap-4">
                    <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                      <Layers className="w-4 h-4 text-slate-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm text-slate-900">
                          {job.ruleSetName || job.ruleSetId}
                        </span>
                        <span
                          className={
                            job.status === 'completed'
                              ? 'badge-green'
                              : job.status === 'running'
                                ? 'badge-yellow'
                                : 'badge-red'
                          }
                        >
                          {job.status}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-3">
                        <span>{job.totalItems} items</span>
                        <span className="text-emerald-600">{job.successCount} passed</span>
                        <span className="text-red-600">{job.failureCount} failed</span>
                      </div>
                    </div>
                    <div className="text-xs text-slate-400 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(job.createdAt).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
