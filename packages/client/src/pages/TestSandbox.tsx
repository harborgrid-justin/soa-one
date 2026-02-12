import { useEffect, useState } from 'react';
import { Play, RotateCcw, CheckCircle, XCircle, Clock, Zap } from 'lucide-react';
import { getRuleSets, testRuleSet } from '../api/client';
import type { RuleSet, ExecutionResult } from '../types';

export function TestSandbox() {
  const [ruleSets, setRuleSets] = useState<RuleSet[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [input, setInput] = useState(SAMPLE_INPUT);
  const [result, setResult] = useState<ExecutionResult | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    getRuleSets().then(setRuleSets).catch(() => {});
  }, []);

  const handleRun = async () => {
    if (!selectedId) return;
    setRunning(true);
    setResult(null);
    setError('');
    try {
      const parsed = JSON.parse(input);
      const res = await testRuleSet(selectedId, parsed);
      setResult(res);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Execution failed');
    } finally {
      setRunning(false);
    }
  };

  const handleReset = () => {
    setResult(null);
    setError('');
    setInput(SAMPLE_INPUT);
  };

  return (
    <div className="space-y-6">
      <p className="text-sm text-slate-500">Test your rule sets against sample data without logging executions.</p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input panel */}
        <div className="space-y-4">
          <div className="card p-5">
            <label className="label">Select Rule Set</label>
            <select className="input" value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>
              <option value="">Choose a rule set...</option>
              {ruleSets.map((rs) => (
                <option key={rs.id} value={rs.id}>
                  {rs.name} (v{rs.version} - {rs.status})
                </option>
              ))}
            </select>
          </div>

          <div className="card p-5">
            <label className="label">Input Data (JSON)</label>
            <textarea
              className="input font-mono text-sm min-h-[350px]"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              spellCheck={false}
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleRun}
              className="btn-primary flex-1"
              disabled={running || !selectedId}
            >
              {running ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Play className="w-4 h-4" />
              )}
              {running ? 'Running...' : 'Execute Rules'}
            </button>
            <button onClick={handleReset} className="btn-secondary">
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Result panel */}
        <div className="space-y-4">
          {error && (
            <div className="card p-5 border-red-200 bg-red-50">
              <div className="flex items-center gap-2 text-red-700 font-medium mb-2">
                <XCircle className="w-5 h-5" /> Execution Error
              </div>
              <pre className="text-sm font-mono text-red-600 whitespace-pre-wrap">{error}</pre>
            </div>
          )}

          {result && (
            <>
              {/* Summary */}
              <div className="card p-5">
                <div className="flex items-center gap-2 mb-4">
                  {result.success ? (
                    <CheckCircle className="w-5 h-5 text-emerald-600" />
                  ) : (
                    <XCircle className="w-5 h-5 text-red-600" />
                  )}
                  <span className="font-semibold text-slate-900">
                    {result.success ? 'Execution Successful' : 'Execution Failed'}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-1 text-brand-600 mb-1">
                      <Zap className="w-4 h-4" />
                    </div>
                    <div className="text-lg font-bold text-slate-900">{result.rulesFired.length}</div>
                    <div className="text-xs text-slate-500">Rules Fired</div>
                  </div>
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-1 text-amber-600 mb-1">
                      <Clock className="w-4 h-4" />
                    </div>
                    <div className="text-lg font-bold text-slate-900">{result.executionTimeMs}ms</div>
                    <div className="text-xs text-slate-500">Duration</div>
                  </div>
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-1 text-emerald-600 mb-1">
                      <CheckCircle className="w-4 h-4" />
                    </div>
                    <div className="text-lg font-bold text-slate-900">
                      {Object.keys(result.output).length}
                    </div>
                    <div className="text-xs text-slate-500">Output Fields</div>
                  </div>
                </div>
              </div>

              {/* Output */}
              <div className="card">
                <div className="px-5 py-3 border-b border-slate-200">
                  <h4 className="font-semibold text-slate-900 text-sm">Output</h4>
                </div>
                <pre className="p-4 text-xs font-mono text-slate-700 overflow-auto max-h-[200px]">
                  {JSON.stringify(result.output, null, 2)}
                </pre>
              </div>

              {/* Rule Results */}
              <div className="card">
                <div className="px-5 py-3 border-b border-slate-200">
                  <h4 className="font-semibold text-slate-900 text-sm">Rule Results</h4>
                </div>
                <div className="divide-y divide-slate-100">
                  {result.ruleResults?.map((rr: any, i: number) => (
                    <div key={i} className="px-5 py-3 flex items-center justify-between">
                      <span className="text-sm text-slate-700">{rr.ruleName}</span>
                      <span className={rr.fired ? 'badge-green' : 'badge-gray'}>
                        {rr.fired ? 'fired' : 'skipped'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Table Results */}
              {result.tableResults && result.tableResults.length > 0 && (
                <div className="card">
                  <div className="px-5 py-3 border-b border-slate-200">
                    <h4 className="font-semibold text-slate-900 text-sm">Decision Table Results</h4>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {result.tableResults.map((tr: any, i: number) => (
                      <div key={i} className="px-5 py-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-slate-700">{tr.tableName}</span>
                          <span className="badge-blue">{tr.matchedRows.length} matches</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {!result && !error && (
            <div className="card p-12 text-center">
              <Play className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="text-sm text-slate-500">Select a rule set and click Execute to test</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const SAMPLE_INPUT = `{
  "applicant": {
    "age": 28,
    "state": "CA",
    "drivingYears": 5,
    "accidents": 1,
    "creditScore": 780
  },
  "vehicle": {
    "year": 2022,
    "make": "Toyota",
    "value": 32000,
    "type": "sedan"
  },
  "coverage": {
    "type": "standard",
    "deductible": 500
  }
}`;
