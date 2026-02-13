import { useEffect, useState } from 'react';
import {
  Bug,
  Play,
  ChevronRight,
  ChevronDown,
  CheckCircle,
  XCircle,
  RefreshCw,
  Code,
} from 'lucide-react';
import { getRuleSets, debugRuleSet } from '../api/client';
import { useStore } from '../store';

interface DebugStep {
  ruleName: string;
  ruleId?: string;
  condition: string;
  conditionResult: boolean;
  output?: any;
  executionTimeMs?: number;
  children?: DebugStep[];
}

interface DebugResult {
  id: string;
  ruleSetId: string;
  totalSteps: number;
  passingSteps: number;
  failingSteps: number;
  executionTimeMs: number;
  steps: DebugStep[];
  finalOutput: any;
}

interface DebugSession {
  id: string;
  ruleSetName: string;
  input: any;
  result: DebugResult;
  createdAt: string;
}

const SAMPLE_DEBUG_INPUT = `{
  "applicant": {
    "age": 28,
    "state": "CA",
    "creditScore": 780,
    "income": 85000
  },
  "loan": {
    "amount": 250000,
    "term": 30,
    "type": "fixed"
  }
}`;

export function RuleDebugger() {
  const { addNotification } = useStore();
  const [ruleSets, setRuleSets] = useState<any[]>([]);
  const [selectedRuleSetId, setSelectedRuleSetId] = useState('');
  const [testInput, setTestInput] = useState(SAMPLE_DEBUG_INPUT);
  const [loading, setLoading] = useState(true);
  const [debugging, setDebugging] = useState(false);
  const [debugResult, setDebugResult] = useState<DebugResult | null>(null);
  const [sessions, setSessions] = useState<DebugSession[]>([]);
  const [expandedSteps, setExpandedSteps] = useState<Set<number>>(new Set());
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    getRuleSets()
      .then((data) => setRuleSets(data.ruleSets || data || []))
      .catch(() => setRuleSets([]))
      .finally(() => setLoading(false));
  }, []);

  const handleDebug = async () => {
    if (!selectedRuleSetId) {
      addNotification({ type: 'error', message: 'Please select a rule set' });
      return;
    }

    let parsed: any;
    try {
      parsed = JSON.parse(testInput);
    } catch {
      setError('Invalid JSON input');
      addNotification({ type: 'error', message: 'Invalid JSON input' });
      return;
    }

    setDebugging(true);
    setDebugResult(null);
    setError('');
    setExpandedSteps(new Set());

    try {
      const res = await debugRuleSet(selectedRuleSetId, { input: parsed });
      const result: DebugResult = res.debug || res;
      setDebugResult(result);

      const session: DebugSession = {
        id: result.id || crypto.randomUUID(),
        ruleSetName: ruleSets.find((rs) => rs.id === selectedRuleSetId)?.name || selectedRuleSetId,
        input: parsed,
        result,
        createdAt: new Date().toISOString(),
      };
      setSessions((prev) => [session, ...prev.slice(0, 9)]);

      addNotification({ type: 'success', message: 'Debug session complete' });
    } catch (err: any) {
      const msg = err.response?.data?.error || err.message || 'Debug failed';
      setError(msg);
      addNotification({ type: 'error', message: msg });
    } finally {
      setDebugging(false);
    }
  };

  const toggleStep = (index: number) => {
    setExpandedSteps((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
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
          <Bug className="w-5 h-5 text-brand-600" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Rule Debugger</h1>
          <p className="text-sm text-slate-500">
            Step through rule execution to diagnose issues
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
            <label className="label">Test Input (JSON)</label>
            <textarea
              className="input font-mono text-sm min-h-[280px]"
              value={testInput}
              onChange={(e) => setTestInput(e.target.value)}
              spellCheck={false}
            />
          </div>

          <button
            onClick={handleDebug}
            className="btn-primary w-full justify-center"
            disabled={debugging || !selectedRuleSetId}
          >
            {debugging ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Debugging...
              </>
            ) : (
              <>
                <Bug className="w-4 h-4" />
                Debug
              </>
            )}
          </button>

          {/* Debug sessions */}
          {sessions.length > 0 && (
            <div className="card">
              <div className="px-5 py-4 border-b border-slate-200">
                <h3 className="font-semibold text-slate-900 text-sm">Debug Sessions</h3>
              </div>
              <div className="divide-y divide-slate-100 max-h-[200px] overflow-y-auto">
                {sessions.map((session) => (
                  <button
                    key={session.id}
                    onClick={() => setDebugResult(session.result)}
                    className="w-full text-left px-5 py-3 hover:bg-slate-50/50 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-slate-900">{session.ruleSetName}</span>
                      <span className="badge-green text-xs">
                        {session.result.passingSteps}/{session.result.totalSteps} passed
                      </span>
                    </div>
                    <span className="text-xs text-slate-400">
                      {new Date(session.createdAt).toLocaleTimeString()}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right: Execution Trace */}
        <div className="space-y-4">
          {error && (
            <div className="card p-5 border-red-200 bg-red-50">
              <div className="flex items-center gap-2 text-red-700 font-medium mb-2">
                <XCircle className="w-5 h-5" /> Debug Error
              </div>
              <pre className="text-sm font-mono text-red-600 whitespace-pre-wrap">{error}</pre>
            </div>
          )}

          {debugResult && (
            <>
              {/* Summary */}
              <div className="grid grid-cols-3 gap-4">
                <div className="card p-4 text-center">
                  <div className="text-2xl font-bold text-slate-900">{debugResult.totalSteps}</div>
                  <div className="text-xs text-slate-500">Total Steps</div>
                </div>
                <div className="card p-4 text-center">
                  <div className="text-2xl font-bold text-emerald-600">{debugResult.passingSteps}</div>
                  <div className="text-xs text-slate-500">Passed</div>
                </div>
                <div className="card p-4 text-center">
                  <div className="text-2xl font-bold text-red-600">{debugResult.failingSteps}</div>
                  <div className="text-xs text-slate-500">Failed</div>
                </div>
              </div>

              {/* Execution trace */}
              <div className="card">
                <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                  <h3 className="font-semibold text-slate-900">Execution Trace</h3>
                  <span className="text-xs text-slate-500">
                    {debugResult.executionTimeMs}ms total
                  </span>
                </div>
                <div className="divide-y divide-slate-100">
                  {(debugResult.steps || []).map((step, idx) => {
                    const expanded = expandedSteps.has(idx);
                    return (
                      <div key={idx}>
                        <button
                          onClick={() => toggleStep(idx)}
                          className="w-full text-left px-6 py-4 flex items-center gap-3 hover:bg-slate-50/50 transition-colors"
                        >
                          {expanded ? (
                            <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-slate-400 flex-shrink-0" />
                          )}
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <span className="text-xs font-mono bg-slate-100 rounded px-2 py-0.5 text-slate-600">
                              Step {idx + 1}
                            </span>
                            <span className="font-medium text-sm text-slate-900 truncate">
                              {step.ruleName}
                            </span>
                          </div>
                          {step.conditionResult ? (
                            <span className="badge-green flex items-center gap-1 flex-shrink-0">
                              <CheckCircle className="w-3 h-3" /> Pass
                            </span>
                          ) : (
                            <span className="badge-red flex items-center gap-1 flex-shrink-0">
                              <XCircle className="w-3 h-3" /> Fail
                            </span>
                          )}
                        </button>

                        {expanded && (
                          <div className="px-6 pb-4 pl-14 space-y-3">
                            <div>
                              <label className="text-xs font-medium text-slate-500">Condition Evaluated</label>
                              <pre className="mt-1 bg-slate-50 rounded-lg p-3 text-xs font-mono text-slate-700 whitespace-pre-wrap">
                                {step.condition}
                              </pre>
                            </div>
                            <div>
                              <label className="text-xs font-medium text-slate-500">Result</label>
                              <div className="mt-1">
                                {step.conditionResult ? (
                                  <span className="text-xs text-emerald-600 font-medium">
                                    Condition evaluated to TRUE - rule fired
                                  </span>
                                ) : (
                                  <span className="text-xs text-red-600 font-medium">
                                    Condition evaluated to FALSE - rule skipped
                                  </span>
                                )}
                              </div>
                            </div>
                            {step.output && (
                              <div>
                                <label className="text-xs font-medium text-slate-500">Output</label>
                                <pre className="mt-1 bg-slate-50 rounded-lg p-3 text-xs font-mono text-slate-700 whitespace-pre-wrap">
                                  {typeof step.output === 'string'
                                    ? step.output
                                    : JSON.stringify(step.output, null, 2)}
                                </pre>
                              </div>
                            )}
                            {step.executionTimeMs != null && (
                              <div className="text-xs text-slate-400">
                                Execution time: {step.executionTimeMs}ms
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Final output */}
              {debugResult.finalOutput && (
                <div className="card">
                  <div className="px-6 py-4 border-b border-slate-200 flex items-center gap-2">
                    <Code className="w-4 h-4 text-brand-600" />
                    <h3 className="font-semibold text-slate-900">Final Output</h3>
                  </div>
                  <div className="p-6">
                    <pre className="bg-slate-900 text-slate-100 rounded-lg p-4 text-xs font-mono whitespace-pre-wrap overflow-auto max-h-[300px]">
                      {JSON.stringify(debugResult.finalOutput, null, 2)}
                    </pre>
                  </div>
                </div>
              )}
            </>
          )}

          {!debugResult && !error && (
            <div className="card p-12 text-center">
              <Bug className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-slate-900 mb-1">No Debug Session</h3>
              <p className="text-sm text-slate-500">
                Select a rule set, provide test input, and click Debug to step through execution.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
