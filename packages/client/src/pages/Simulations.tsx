import { useEffect, useState } from 'react';
import {
  FlaskConical,
  Plus,
  Play,
  CheckCircle,
  XCircle,
  Clock,
  Trash2,
  ChevronRight,
  RefreshCw,
  FileText,
} from 'lucide-react';
import { Modal } from '../components/common/Modal';
import {
  getRuleSets,
  getSimulations,
  createSimulation,
  deleteSimulation,
} from '../api/client';
import api from '../api/client';
import { useStore } from '../store';

interface TestCase {
  id: string;
  name: string;
  input: string;
  expectedOutput: string;
}

interface Simulation {
  id: string;
  name: string;
  ruleSetId: string;
  ruleSetName: string;
  testCases: TestCase[];
  status: 'draft' | 'running' | 'completed';
  createdAt: string;
  results?: SimulationResult[];
  stats?: {
    total: number;
    passed: number;
    failed: number;
    avgTimeMs: number;
  };
}

interface SimulationResult {
  testCaseId: string;
  testCaseName: string;
  input: any;
  expected: any;
  actual: any;
  passed: boolean;
  executionTimeMs: number;
  error?: string;
}

export function Simulations() {
  const { addNotification } = useStore();
  const [simulations, setSimulations] = useState<Simulation[]>([]);
  const [selectedSim, setSelectedSim] = useState<Simulation | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [ruleSets, setRuleSets] = useState<any[]>([]);

  // Create form state
  const [formName, setFormName] = useState('');
  const [formRuleSetId, setFormRuleSetId] = useState('');
  const [formTestCases, setFormTestCases] = useState<TestCase[]>([
    { id: '1', name: 'Test Case 1', input: '{}', expectedOutput: '' },
  ]);

  const fetchSimulations = () => {
    setLoading(true);
    getSimulations()
      .then((data) => setSimulations(data.simulations || data || []))
      .catch((err) => {
        console.error('Failed to fetch simulations', err);
        addNotification({ type: 'error', message: 'Failed to load simulations' });
        setSimulations([]);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchSimulations();
    getRuleSets()
      .then((data) => setRuleSets(data.ruleSets || data || []))
      .catch((err) => {
        console.error('Failed to fetch rule sets', err);
      });
  }, []);

  const addTestCase = () => {
    const id = String(formTestCases.length + 1);
    setFormTestCases([
      ...formTestCases,
      { id, name: `Test Case ${formTestCases.length + 1}`, input: '{}', expectedOutput: '' },
    ]);
  };

  const removeTestCase = (id: string) => {
    if (formTestCases.length <= 1) return;
    setFormTestCases(formTestCases.filter((tc) => tc.id !== id));
  };

  const updateTestCase = (id: string, field: keyof TestCase, value: string) => {
    setFormTestCases(formTestCases.map((tc) => (tc.id === id ? { ...tc, [field]: value } : tc)));
  };

  const handleCreate = () => {
    if (!formName.trim() || !formRuleSetId) {
      addNotification({ type: 'error', message: 'Name and rule set are required' });
      return;
    }

    const payload = {
      name: formName,
      ruleSetId: formRuleSetId,
      testCases: formTestCases.map((tc) => ({
        name: tc.name,
        input: tc.input,
        expectedOutput: tc.expectedOutput || undefined,
      })),
    };

    createSimulation(payload)
      .then(() => {
        addNotification({ type: 'success', message: 'Simulation created' });
        setShowCreateModal(false);
        setFormName('');
        setFormRuleSetId('');
        setFormTestCases([{ id: '1', name: 'Test Case 1', input: '{}', expectedOutput: '' }]);
        fetchSimulations();
      })
      .catch(() => {
        addNotification({ type: 'error', message: 'Failed to create simulation' });
      });
  };

  const handleRun = (sim: Simulation) => {
    setRunning(true);
    api
      .post(`/simulations/${sim.id}/run`)
      .then((r) => {
        const result = r.data;
        setSelectedSim({ ...sim, ...result, status: 'completed' });
        addNotification({ type: 'success', message: 'Simulation completed' });
        fetchSimulations();
      })
      .catch(() => {
        addNotification({ type: 'error', message: 'Failed to run simulation' });
      })
      .finally(() => setRunning(false));
  };

  const handleDelete = (id: string) => {
    deleteSimulation(id)
      .then(() => {
        addNotification({ type: 'success', message: 'Simulation deleted' });
        if (selectedSim?.id === id) setSelectedSim(null);
        fetchSimulations();
      })
      .catch(() => {
        addNotification({ type: 'error', message: 'Failed to delete simulation' });
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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-brand-50 flex items-center justify-center">
            <FlaskConical className="w-5 h-5 text-brand-600" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-slate-900">What-If Simulations</h1>
            <p className="text-sm text-slate-500">
              Test rule sets with multiple scenarios
            </p>
          </div>
        </div>
        <button onClick={() => setShowCreateModal(true)} className="btn-primary">
          <Plus className="w-4 h-4" />
          New Simulation
        </button>
      </div>

      {/* Two panel layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Simulation list */}
        <div className="card lg:col-span-1">
          <div className="px-6 py-4 border-b border-slate-200">
            <h3 className="font-semibold text-slate-900">Simulations</h3>
          </div>
          <div className="divide-y divide-slate-100">
            {simulations.length > 0 ? (
              simulations.map((sim) => (
                <button
                  key={sim.id}
                  onClick={() => setSelectedSim(sim)}
                  className={`w-full px-6 py-4 text-left hover:bg-slate-50/50 transition-colors flex items-center gap-3 ${
                    selectedSim?.id === sim.id ? 'bg-brand-50/50 border-r-2 border-r-brand-600' : ''
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm text-slate-900 truncate">{sim.name}</div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {sim.ruleSetName || 'Unknown rule set'} &middot;{' '}
                      {sim.testCases?.length || 0} test cases
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span
                      className={
                        sim.status === 'completed'
                          ? 'badge-green'
                          : sim.status === 'running'
                            ? 'badge-yellow'
                            : 'badge-gray'
                      }
                    >
                      {sim.status}
                    </span>
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  </div>
                </button>
              ))
            ) : (
              <div className="px-6 py-12 text-center">
                <FlaskConical className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                <p className="text-sm text-slate-500">No simulations yet.</p>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="btn-primary btn-sm mt-4"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Create One
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right: Simulation detail / run */}
        <div className="card lg:col-span-2">
          {selectedSim ? (
            <>
              <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-slate-900">{selectedSim.name}</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {selectedSim.ruleSetName} &middot; Created{' '}
                    {new Date(selectedSim.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleRun(selectedSim)}
                    className="btn-primary btn-sm"
                    disabled={running}
                  >
                    {running ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Play className="w-3.5 h-3.5" />
                    )}
                    {running ? 'Running...' : 'Run'}
                  </button>
                  <button
                    onClick={() => handleDelete(selectedSim.id)}
                    className="btn-secondary btn-sm text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Stats bar */}
              {selectedSim.stats && (
                <div className="px-6 py-3 border-b border-slate-200 bg-slate-50/50 grid grid-cols-4 gap-4 text-center text-sm">
                  <div>
                    <div className="font-semibold text-slate-900">{selectedSim.stats.total}</div>
                    <div className="text-xs text-slate-500">Total</div>
                  </div>
                  <div>
                    <div className="font-semibold text-emerald-600">
                      {selectedSim.stats.passed}
                    </div>
                    <div className="text-xs text-slate-500">Passed</div>
                  </div>
                  <div>
                    <div className="font-semibold text-red-600">{selectedSim.stats.failed}</div>
                    <div className="text-xs text-slate-500">Failed</div>
                  </div>
                  <div>
                    <div className="font-semibold text-amber-600">
                      {selectedSim.stats.avgTimeMs}ms
                    </div>
                    <div className="text-xs text-slate-500">Avg Time</div>
                  </div>
                </div>
              )}

              {/* Results table */}
              {selectedSim.results && selectedSim.results.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-100">
                        <th className="text-left px-6 py-3 font-medium text-slate-500">
                          Test Case
                        </th>
                        <th className="text-left px-6 py-3 font-medium text-slate-500">Input</th>
                        <th className="text-left px-6 py-3 font-medium text-slate-500">
                          Expected
                        </th>
                        <th className="text-left px-6 py-3 font-medium text-slate-500">Actual</th>
                        <th className="text-left px-6 py-3 font-medium text-slate-500">Status</th>
                        <th className="text-left px-6 py-3 font-medium text-slate-500">Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedSim.results.map((result) => (
                        <tr
                          key={result.testCaseId}
                          className={`border-b border-slate-50 ${
                            result.passed ? '' : 'bg-red-50/30'
                          }`}
                        >
                          <td className="px-6 py-3 font-medium text-slate-900">
                            {result.testCaseName}
                          </td>
                          <td className="px-6 py-3">
                            <code className="text-xs bg-slate-100 rounded px-1.5 py-0.5 font-mono text-slate-700 max-w-[150px] truncate block">
                              {typeof result.input === 'object'
                                ? JSON.stringify(result.input)
                                : String(result.input)}
                            </code>
                          </td>
                          <td className="px-6 py-3">
                            <code className="text-xs bg-slate-100 rounded px-1.5 py-0.5 font-mono text-slate-700 max-w-[150px] truncate block">
                              {result.expected
                                ? typeof result.expected === 'object'
                                  ? JSON.stringify(result.expected)
                                  : String(result.expected)
                                : '-'}
                            </code>
                          </td>
                          <td className="px-6 py-3">
                            <code className="text-xs bg-slate-100 rounded px-1.5 py-0.5 font-mono text-slate-700 max-w-[150px] truncate block">
                              {result.error
                                ? result.error
                                : typeof result.actual === 'object'
                                  ? JSON.stringify(result.actual)
                                  : String(result.actual ?? '-')}
                            </code>
                          </td>
                          <td className="px-6 py-3">
                            {result.passed ? (
                              <span className="badge-green">
                                <CheckCircle className="w-3 h-3 mr-1" />
                                Pass
                              </span>
                            ) : (
                              <span className="bg-red-100 text-red-700 text-xs font-medium px-2 py-0.5 rounded-full inline-flex items-center">
                                <XCircle className="w-3 h-3 mr-1" />
                                Fail
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-3 text-slate-600 font-mono text-xs">
                            {result.executionTimeMs}ms
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="px-6 py-16 text-center">
                  <Play className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                  <p className="text-sm text-slate-500">
                    Click "Run" to execute this simulation and see results.
                  </p>
                </div>
              )}
            </>
          ) : (
            <div className="px-6 py-16 text-center">
              <FileText className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="text-sm text-slate-500">Select a simulation to view details.</p>
            </div>
          )}
        </div>
      </div>

      {/* Create Simulation Modal */}
      <Modal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Create Simulation"
        size="xl"
      >
        <div className="space-y-4">
          <div>
            <label className="label">Simulation Name</label>
            <input
              className="input"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="e.g. Premium Calculation Scenarios"
            />
          </div>
          <div>
            <label className="label">Rule Set</label>
            <select
              className="input"
              value={formRuleSetId}
              onChange={(e) => setFormRuleSetId(e.target.value)}
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
            <div className="flex items-center justify-between mb-2">
              <label className="label mb-0">Test Cases</label>
              <button onClick={addTestCase} className="btn-secondary btn-sm">
                <Plus className="w-3.5 h-3.5" />
                Add Test Case
              </button>
            </div>
            <div className="space-y-4">
              {formTestCases.map((tc) => (
                <div key={tc.id} className="bg-slate-50 rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <input
                      className="input py-1.5 text-sm flex-1 mr-2"
                      value={tc.name}
                      onChange={(e) => updateTestCase(tc.id, 'name', e.target.value)}
                      placeholder="Test case name"
                    />
                    {formTestCases.length > 1 && (
                      <button
                        onClick={() => removeTestCase(tc.id)}
                        className="p-1.5 rounded-lg hover:bg-red-100 text-red-500 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-500 mb-1 block">
                      Input (JSON)
                    </label>
                    <textarea
                      className="input font-mono text-xs min-h-[80px]"
                      value={tc.input}
                      onChange={(e) => updateTestCase(tc.id, 'input', e.target.value)}
                      placeholder='{"key": "value"}'
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-500 mb-1 block">
                      Expected Output (JSON, optional)
                    </label>
                    <textarea
                      className="input font-mono text-xs min-h-[60px]"
                      value={tc.expectedOutput}
                      onChange={(e) => updateTestCase(tc.id, 'expectedOutput', e.target.value)}
                      placeholder='{"result": "expected"}'
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setShowCreateModal(false)} className="btn-secondary">
              Cancel
            </button>
            <button onClick={handleCreate} className="btn-primary">
              <FlaskConical className="w-4 h-4" />
              Create Simulation
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
