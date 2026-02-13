import { useEffect, useState } from 'react';
import {
  Split,
  BarChart3,
  Play,
  Pause,
  Plus,
  RefreshCw,
  Trash2,
  CheckCircle,
  Eye,
} from 'lucide-react';
import {
  getABTests,
  createABTest,
  startABTest,
  pauseABTest,
  completeABTest,
  deleteABTest,
  getRuleSets,
} from '../api/client';
import { useStore } from '../store';

interface ABTest {
  id: string;
  name: string;
  description?: string;
  controlRuleSetId: string;
  variantRuleSetId: string;
  trafficSplit: number;
  status: 'draft' | 'running' | 'paused' | 'completed';
  controlName?: string;
  variantName?: string;
  metrics?: {
    controlExecutions: number;
    variantExecutions: number;
    controlSuccessRate: number;
    variantSuccessRate: number;
    controlAvgTime: number;
    variantAvgTime: number;
  };
  createdAt: string;
  completedAt?: string;
}

const statusConfig: Record<string, { badge: string; label: string }> = {
  draft: { badge: 'badge-yellow', label: 'Draft' },
  running: { badge: 'badge-green', label: 'Running' },
  paused: { badge: 'badge-yellow', label: 'Paused' },
  completed: { badge: 'badge-green', label: 'Completed' },
};

export function ABTestingDashboard() {
  const { addNotification } = useStore();
  const [tests, setTests] = useState<ABTest[]>([]);
  const [ruleSets, setRuleSets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedTest, setSelectedTest] = useState<ABTest | null>(null);

  // Create form
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formControlId, setFormControlId] = useState('');
  const [formVariantId, setFormVariantId] = useState('');
  const [formTrafficSplit, setFormTrafficSplit] = useState(50);
  const [creating, setCreating] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [testsData, rsData] = await Promise.all([
        getABTests().catch(() => []),
        getRuleSets().catch(() => []),
      ]);
      setTests(testsData.tests || testsData || []);
      setRuleSets(rsData.ruleSets || rsData || []);
    } catch {
      setTests([]);
      setRuleSets([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreate = async () => {
    if (!formName.trim() || !formControlId || !formVariantId) {
      addNotification({ type: 'error', message: 'Name, control, and variant rule sets are required' });
      return;
    }

    setCreating(true);
    try {
      await createABTest({
        name: formName,
        description: formDescription,
        controlRuleSetId: formControlId,
        variantRuleSetId: formVariantId,
        trafficSplit: formTrafficSplit,
      });
      addNotification({ type: 'success', message: 'A/B test created' });
      setShowCreateForm(false);
      setFormName('');
      setFormDescription('');
      setFormControlId('');
      setFormVariantId('');
      setFormTrafficSplit(50);
      fetchData();
    } catch (err: any) {
      addNotification({ type: 'error', message: err.response?.data?.error || 'Failed to create test' });
    } finally {
      setCreating(false);
    }
  };

  const handleStart = async (id: string) => {
    try {
      await startABTest(id);
      addNotification({ type: 'success', message: 'Test started' });
      fetchData();
    } catch {
      addNotification({ type: 'error', message: 'Failed to start test' });
    }
  };

  const handlePause = async (id: string) => {
    try {
      await pauseABTest(id);
      addNotification({ type: 'success', message: 'Test paused' });
      fetchData();
    } catch {
      addNotification({ type: 'error', message: 'Failed to pause test' });
    }
  };

  const handleComplete = async (id: string) => {
    try {
      await completeABTest(id);
      addNotification({ type: 'success', message: 'Test completed' });
      fetchData();
    } catch {
      addNotification({ type: 'error', message: 'Failed to complete test' });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteABTest(id);
      addNotification({ type: 'success', message: 'Test deleted' });
      if (selectedTest?.id === id) setSelectedTest(null);
      fetchData();
    } catch {
      addNotification({ type: 'error', message: 'Failed to delete test' });
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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-brand-50 flex items-center justify-center">
            <Split className="w-5 h-5 text-brand-600" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-slate-900">A/B Testing</h1>
            <p className="text-sm text-slate-500">
              Compare rule set variants with controlled experiments
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchData} className="btn-secondary btn-sm">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => setShowCreateForm(!showCreateForm)} className="btn-primary">
            <Plus className="w-4 h-4" />
            New Test
          </button>
        </div>
      </div>

      {/* Create form */}
      {showCreateForm && (
        <div className="card p-6">
          <h3 className="font-semibold text-slate-900 mb-4">Create A/B Test</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">Test Name</label>
              <input
                className="input"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g., Premium Calculation v2 Test"
              />
            </div>
            <div>
              <label className="label">Description (optional)</label>
              <input
                className="input"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="Describe the experiment..."
              />
            </div>
            <div>
              <label className="label">Control Rule Set</label>
              <select
                className="input"
                value={formControlId}
                onChange={(e) => setFormControlId(e.target.value)}
              >
                <option value="">Select control...</option>
                {ruleSets.map((rs: any) => (
                  <option key={rs.id} value={rs.id}>
                    {rs.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Variant Rule Set</label>
              <select
                className="input"
                value={formVariantId}
                onChange={(e) => setFormVariantId(e.target.value)}
              >
                <option value="">Select variant...</option>
                {ruleSets.map((rs: any) => (
                  <option key={rs.id} value={rs.id}>
                    {rs.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="label">
                Traffic Split (variant gets {formTrafficSplit}%, control gets {100 - formTrafficSplit}%)
              </label>
              <input
                type="range"
                min="1"
                max="99"
                value={formTrafficSplit}
                onChange={(e) => setFormTrafficSplit(Number(e.target.value))}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-slate-500 mt-1">
                <span>Control: {100 - formTrafficSplit}%</span>
                <span>Variant: {formTrafficSplit}%</span>
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <button onClick={() => setShowCreateForm(false)} className="btn-secondary">
              Cancel
            </button>
            <button onClick={handleCreate} className="btn-primary" disabled={creating}>
              {creating ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  Create Test
                </>
              )}
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Tests list */}
        <div className="lg:col-span-2">
          <div className="card">
            <div className="px-6 py-4 border-b border-slate-200">
              <h3 className="font-semibold text-slate-900">Tests</h3>
            </div>
            {tests.length > 0 ? (
              <div className="divide-y divide-slate-100">
                {tests.map((test) => {
                  const config = statusConfig[test.status] || statusConfig.draft;
                  return (
                    <div
                      key={test.id}
                      className={`px-6 py-4 flex items-center gap-4 hover:bg-slate-50/50 transition-colors cursor-pointer ${
                        selectedTest?.id === test.id ? 'bg-brand-50/30' : ''
                      }`}
                      onClick={() => setSelectedTest(test)}
                    >
                      <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                        <Split className="w-4 h-4 text-slate-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm text-slate-900">{test.name}</span>
                          <span className={config.badge}>{config.label}</span>
                        </div>
                        {test.description && (
                          <p className="text-xs text-slate-500 mt-0.5 truncate">{test.description}</p>
                        )}
                        <div className="text-xs text-slate-400 mt-1">
                          Split: {100 - test.trafficSplit}% control / {test.trafficSplit}% variant
                        </div>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {(test.status === 'draft' || test.status === 'paused') && (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleStart(test.id); }}
                            className="btn-secondary btn-sm"
                            title="Start"
                          >
                            <Play className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {test.status === 'running' && (
                          <>
                            <button
                              onClick={(e) => { e.stopPropagation(); handlePause(test.id); }}
                              className="btn-secondary btn-sm"
                              title="Pause"
                            >
                              <Pause className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleComplete(test.id); }}
                              className="btn-secondary btn-sm"
                              title="Complete"
                            >
                              <CheckCircle className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDelete(test.id); }}
                          className="btn-secondary btn-sm text-red-600 hover:text-red-700"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="px-6 py-16 text-center">
                <Split className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                <h3 className="text-lg font-semibold text-slate-900 mb-1">No A/B Tests</h3>
                <p className="text-sm text-slate-500 mb-4">
                  Create your first A/B test to compare rule set variants.
                </p>
                <button onClick={() => setShowCreateForm(true)} className="btn-primary btn-sm">
                  <Plus className="w-3.5 h-3.5" />
                  Create Test
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Results panel */}
        <div>
          {selectedTest ? (
            <div className="card p-5 space-y-4">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-brand-600" />
                <h3 className="font-semibold text-slate-900">Test Results</h3>
              </div>

              <div>
                <span className="text-sm font-medium text-slate-900">{selectedTest.name}</span>
                <span className={`ml-2 ${(statusConfig[selectedTest.status] || statusConfig.draft).badge}`}>
                  {(statusConfig[selectedTest.status] || statusConfig.draft).label}
                </span>
              </div>

              {selectedTest.metrics ? (
                <div className="space-y-3">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200">
                        <th className="text-left py-2 font-medium text-slate-600">Metric</th>
                        <th className="text-right py-2 font-medium text-slate-600">Control</th>
                        <th className="text-right py-2 font-medium text-slate-600">Variant</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      <tr>
                        <td className="py-2 text-slate-700">Executions</td>
                        <td className="py-2 text-right text-slate-900 font-medium">
                          {selectedTest.metrics.controlExecutions.toLocaleString()}
                        </td>
                        <td className="py-2 text-right text-slate-900 font-medium">
                          {selectedTest.metrics.variantExecutions.toLocaleString()}
                        </td>
                      </tr>
                      <tr>
                        <td className="py-2 text-slate-700">Success Rate</td>
                        <td className="py-2 text-right">
                          <span className="badge-green">{selectedTest.metrics.controlSuccessRate}%</span>
                        </td>
                        <td className="py-2 text-right">
                          <span
                            className={
                              selectedTest.metrics.variantSuccessRate >= selectedTest.metrics.controlSuccessRate
                                ? 'badge-green'
                                : 'badge-red'
                            }
                          >
                            {selectedTest.metrics.variantSuccessRate}%
                          </span>
                        </td>
                      </tr>
                      <tr>
                        <td className="py-2 text-slate-700">Avg Time</td>
                        <td className="py-2 text-right text-slate-900">
                          {selectedTest.metrics.controlAvgTime}ms
                        </td>
                        <td className="py-2 text-right text-slate-900">
                          {selectedTest.metrics.variantAvgTime}ms
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-6">
                  <BarChart3 className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm text-slate-500">
                    {selectedTest.status === 'draft'
                      ? 'Start the test to begin collecting metrics.'
                      : 'No metrics available yet.'}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="card p-8 text-center">
              <Eye className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm text-slate-500">Select a test to view its results</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
