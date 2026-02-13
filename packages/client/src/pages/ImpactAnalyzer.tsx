import { useEffect, useState } from 'react';
import {
  Target,
  AlertTriangle,
  TrendingUp,
  Shield,
  RefreshCw,
  Clock,
  ChevronRight,
} from 'lucide-react';
import { analyzeImpact, getImpactAnalyses, getRuleSets } from '../api/client';
import { useStore } from '../store';

interface ImpactResult {
  id: string;
  ruleSetId: string;
  ruleSetName?: string;
  proposedChange: string;
  affectedDecisions: number;
  riskLevel: 'low' | 'medium' | 'high';
  affectedSystems: string[];
  details?: string;
  recommendations?: string[];
  createdAt: string;
}

const riskConfig: Record<string, { badge: string; icon: string; color: string }> = {
  low: { badge: 'badge-green', icon: 'text-emerald-600', color: 'bg-emerald-50' },
  medium: { badge: 'badge-yellow', icon: 'text-amber-600', color: 'bg-amber-50' },
  high: { badge: 'badge-red', icon: 'text-red-600', color: 'bg-red-50' },
};

export function ImpactAnalyzer() {
  const { addNotification } = useStore();
  const [ruleSets, setRuleSets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<ImpactResult | null>(null);
  const [history, setHistory] = useState<ImpactResult[]>([]);
  const [error, setError] = useState('');

  // Form
  const [selectedRuleSetId, setSelectedRuleSetId] = useState('');
  const [proposedChange, setProposedChange] = useState('');

  useEffect(() => {
    setLoading(true);
    getRuleSets()
      .then((data) => {
        const list = data.ruleSets || data || [];
        setRuleSets(list);
      })
      .catch(() => setRuleSets([]))
      .finally(() => setLoading(false));
  }, []);

  const fetchHistory = async (ruleSetId: string) => {
    try {
      const data = await getImpactAnalyses(ruleSetId);
      setHistory(data.analyses || data || []);
    } catch {
      setHistory([]);
    }
  };

  useEffect(() => {
    if (selectedRuleSetId) {
      fetchHistory(selectedRuleSetId);
    }
  }, [selectedRuleSetId]);

  const handleAnalyze = async () => {
    if (!selectedRuleSetId) {
      addNotification({ type: 'error', message: 'Please select a rule set' });
      return;
    }
    if (!proposedChange.trim()) {
      addNotification({ type: 'error', message: 'Please describe the proposed change' });
      return;
    }

    setAnalyzing(true);
    setResult(null);
    setError('');

    try {
      const res = await analyzeImpact({
        ruleSetId: selectedRuleSetId,
        proposedChange,
      });
      const analysis: ImpactResult = res.analysis || res;
      analysis.ruleSetName = ruleSets.find((rs) => rs.id === selectedRuleSetId)?.name;
      setResult(analysis);
      setHistory((prev) => [analysis, ...prev]);
      addNotification({ type: 'success', message: 'Impact analysis complete' });
    } catch (err: any) {
      const msg = err.response?.data?.error || err.message || 'Impact analysis failed';
      setError(msg);
      addNotification({ type: 'error', message: msg });
    } finally {
      setAnalyzing(false);
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
          <Target className="w-5 h-5 text-brand-600" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Impact Analyzer</h1>
          <p className="text-sm text-slate-500">
            Analyze the impact of rule changes before deployment
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Form */}
        <div className="space-y-4">
          <div className="card p-5 space-y-4">
            <h3 className="font-semibold text-slate-900">Analyze Change Impact</h3>

            <div>
              <label className="label">Select Rule Set</label>
              <select
                className="input"
                value={selectedRuleSetId}
                onChange={(e) => setSelectedRuleSetId(e.target.value)}
              >
                <option value="">Choose a rule set...</option>
                {ruleSets.map((rs: any) => (
                  <option key={rs.id} value={rs.id}>
                    {rs.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label">Proposed Change</label>
              <textarea
                className="input min-h-[120px]"
                value={proposedChange}
                onChange={(e) => setProposedChange(e.target.value)}
                placeholder="Describe the proposed change... e.g., Modify age threshold from 25 to 21 for standard rate eligibility"
              />
            </div>

            <button
              onClick={handleAnalyze}
              className="btn-primary w-full justify-center"
              disabled={analyzing || !selectedRuleSetId || !proposedChange.trim()}
            >
              {analyzing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Target className="w-4 h-4" />
                  Analyze Impact
                </>
              )}
            </button>
          </div>

          {/* History */}
          {history.length > 0 && (
            <div className="card">
              <div className="px-5 py-4 border-b border-slate-200">
                <h3 className="font-semibold text-slate-900 text-sm">Previous Analyses</h3>
              </div>
              <div className="divide-y divide-slate-100 max-h-[300px] overflow-y-auto">
                {history.map((item, idx) => {
                  const risk = riskConfig[item.riskLevel] || riskConfig.low;
                  return (
                    <button
                      key={item.id || idx}
                      onClick={() => setResult(item)}
                      className="w-full text-left px-5 py-3 hover:bg-slate-50/50 transition-colors flex items-center gap-3"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-slate-900 truncate">
                            {item.ruleSetName || item.ruleSetId}
                          </span>
                          <span className={risk.badge}>{item.riskLevel}</span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5 truncate">{item.proposedChange}</p>
                      </div>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Right: Results */}
        <div className="lg:col-span-2 space-y-4">
          {error && (
            <div className="card p-5 border-red-200 bg-red-50">
              <div className="flex items-center gap-2 text-red-700 font-medium mb-2">
                <AlertTriangle className="w-5 h-5" /> Analysis Error
              </div>
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {result && (
            <>
              {/* Impact summary cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="card p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-lg bg-brand-50 flex items-center justify-center">
                      <TrendingUp className="w-5 h-5 text-brand-600" />
                    </div>
                    <span className="text-sm text-slate-500">Affected Decisions</span>
                  </div>
                  <div className="text-3xl font-bold text-slate-900">
                    {(result.affectedDecisions || 0).toLocaleString()}
                  </div>
                </div>

                <div className="card p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <div
                      className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        (riskConfig[result.riskLevel] || riskConfig.low).color
                      }`}
                    >
                      <AlertTriangle
                        className={`w-5 h-5 ${(riskConfig[result.riskLevel] || riskConfig.low).icon}`}
                      />
                    </div>
                    <span className="text-sm text-slate-500">Risk Level</span>
                  </div>
                  <div className="text-3xl font-bold text-slate-900 capitalize">{result.riskLevel}</div>
                </div>

                <div className="card p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center">
                      <Shield className="w-5 h-5 text-purple-600" />
                    </div>
                    <span className="text-sm text-slate-500">Affected Systems</span>
                  </div>
                  <div className="text-3xl font-bold text-slate-900">
                    {(result.affectedSystems || []).length}
                  </div>
                </div>
              </div>

              {/* Details */}
              <div className="card p-6">
                <h3 className="font-semibold text-slate-900 mb-4">Impact Details</h3>
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-medium text-slate-500">Proposed Change</label>
                    <p className="text-sm text-slate-700 mt-1">{result.proposedChange}</p>
                  </div>

                  {result.details && (
                    <div>
                      <label className="text-xs font-medium text-slate-500">Analysis Details</label>
                      <p className="text-sm text-slate-700 mt-1">{result.details}</p>
                    </div>
                  )}

                  {result.affectedSystems && result.affectedSystems.length > 0 && (
                    <div>
                      <label className="text-xs font-medium text-slate-500">Affected Downstream Systems</label>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {result.affectedSystems.map((system, i) => (
                          <span
                            key={i}
                            className="text-xs bg-slate-100 text-slate-700 rounded-full px-3 py-1 font-medium"
                          >
                            {system}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {result.recommendations && result.recommendations.length > 0 && (
                    <div>
                      <label className="text-xs font-medium text-slate-500">Recommendations</label>
                      <ul className="mt-2 space-y-2">
                        {result.recommendations.map((rec, i) => (
                          <li
                            key={i}
                            className="text-sm text-slate-700 bg-blue-50 rounded-lg px-4 py-2 flex items-start gap-2"
                          >
                            <Shield className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                            {rec}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="text-xs text-slate-400 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Analyzed {new Date(result.createdAt).toLocaleString()}
                  </div>
                </div>
              </div>
            </>
          )}

          {!result && !error && (
            <div className="card p-12 text-center">
              <Target className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-slate-900 mb-1">No Analysis Results</h3>
              <p className="text-sm text-slate-500">
                Select a rule set, describe a proposed change, and click Analyze Impact.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
