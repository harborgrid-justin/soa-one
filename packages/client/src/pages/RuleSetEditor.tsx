import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft, Plus, Play, Upload, Save, Trash2,
  ChevronDown, ChevronRight, ToggleLeft, ToggleRight, GripVertical,
} from 'lucide-react';
import {
  getRuleSet, createRule, updateRule, deleteRule,
  publishRuleSet, testRuleSet,
} from '../api/client';
import { RuleEditor } from '../components/rules/RuleEditor';
import { Modal } from '../components/common/Modal';
import { useStore } from '../store';
import type { RuleSet, Rule } from '../types';

export function RuleSetEditor() {
  const { id } = useParams<{ id: string }>();
  const [ruleSet, setRuleSet] = useState<RuleSet | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingRule, setEditingRule] = useState<Rule | null>(null);
  const [showNewRule, setShowNewRule] = useState(false);
  const [showTest, setShowTest] = useState(false);
  const [testInput, setTestInput] = useState('{\n  \n}');
  const [testResult, setTestResult] = useState<any>(null);
  const [testRunning, setTestRunning] = useState(false);
  const [newRuleName, setNewRuleName] = useState('');
  const [expandedRules, setExpandedRules] = useState<Set<string>>(new Set());
  const { addNotification } = useStore();

  const load = () => {
    if (!id) return;
    getRuleSet(id)
      .then((rs) => {
        setRuleSet(rs);
        // Parse JSON fields if they're strings
        if (rs.rules) {
          rs.rules = rs.rules.map((r: any) => ({
            ...r,
            conditions: typeof r.conditions === 'string' ? JSON.parse(r.conditions) : r.conditions,
            actions: typeof r.actions === 'string' ? JSON.parse(r.actions) : r.actions,
          }));
        }
      })
      .catch(() => addNotification({ type: 'error', message: 'Failed to load rule set' }))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [id]);

  const handleCreateRule = async () => {
    if (!newRuleName.trim() || !id) return;
    try {
      await createRule({
        ruleSetId: id,
        name: newRuleName.trim(),
        conditions: { logic: 'AND', conditions: [] },
        actions: [],
      });
      addNotification({ type: 'success', message: 'Rule created' });
      setShowNewRule(false);
      setNewRuleName('');
      load();
    } catch {
      addNotification({ type: 'error', message: 'Failed to create rule' });
    }
  };

  const handleSaveRule = async (rule: Rule) => {
    try {
      await updateRule(rule.id, {
        name: rule.name,
        description: rule.description,
        priority: rule.priority,
        conditions: rule.conditions,
        actions: rule.actions,
        enabled: rule.enabled,
      });
      addNotification({ type: 'success', message: 'Rule saved' });
      setEditingRule(null);
      load();
    } catch {
      addNotification({ type: 'error', message: 'Failed to save rule' });
    }
  };

  const handleDeleteRule = async (ruleId: string) => {
    if (!confirm('Delete this rule?')) return;
    try {
      await deleteRule(ruleId);
      addNotification({ type: 'success', message: 'Rule deleted' });
      load();
    } catch {
      addNotification({ type: 'error', message: 'Failed to delete rule' });
    }
  };

  const handleToggleRule = async (rule: Rule) => {
    try {
      await updateRule(rule.id, { enabled: !rule.enabled });
      load();
    } catch {
      addNotification({ type: 'error', message: 'Failed to toggle rule' });
    }
  };

  const handlePublish = async () => {
    if (!id) return;
    try {
      await publishRuleSet(id, { changelog: `Published v${(ruleSet?.version || 0) + 1}` });
      addNotification({ type: 'success', message: 'Rule set published!' });
      load();
    } catch {
      addNotification({ type: 'error', message: 'Failed to publish' });
    }
  };

  const handleTest = async () => {
    if (!id) return;
    setTestRunning(true);
    setTestResult(null);
    try {
      const input = JSON.parse(testInput);
      const result = await testRuleSet(id, input);
      setTestResult(result);
    } catch (err: any) {
      setTestResult({ error: err.message || 'Invalid JSON input' });
    } finally {
      setTestRunning(false);
    }
  };

  const toggleExpand = (ruleId: string) => {
    setExpandedRules((prev) => {
      const next = new Set(prev);
      if (next.has(ruleId)) next.delete(ruleId);
      else next.add(ruleId);
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

  if (!ruleSet) return <div className="text-center py-16 text-slate-500">Rule set not found</div>;

  return (
    <div className="space-y-6">
      {/* Breadcrumb + actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm">
          <Link to="/projects" className="text-slate-500 hover:text-slate-700 flex items-center gap-1">
            <ArrowLeft className="w-4 h-4" /> Projects
          </Link>
          <span className="text-slate-300">/</span>
          <Link to={`/projects/${ruleSet.projectId}`} className="text-slate-500 hover:text-slate-700">
            Project
          </Link>
          <span className="text-slate-300">/</span>
          <span className="text-slate-900 font-medium">{ruleSet.name}</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowTest(true)} className="btn-secondary btn-sm">
            <Play className="w-3.5 h-3.5" /> Test
          </button>
          <button onClick={handlePublish} className="btn-primary btn-sm">
            <Upload className="w-3.5 h-3.5" /> Publish v{ruleSet.version + 1}
          </button>
        </div>
      </div>

      {/* Rule Set Info */}
      <div className="card p-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">{ruleSet.name}</h2>
            <p className="text-sm text-slate-500">{ruleSet.description || 'No description'}</p>
          </div>
          <div className="flex items-center gap-3">
            <span className={ruleSet.status === 'published' ? 'badge-green' : 'badge-yellow'}>
              {ruleSet.status}
            </span>
            <span className="badge-gray">v{ruleSet.version}</span>
          </div>
        </div>
      </div>

      {/* Rules */}
      <div className="card">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h3 className="font-semibold text-slate-900">
            Rules ({ruleSet.rules?.length || 0})
          </h3>
          <button onClick={() => setShowNewRule(true)} className="btn-primary btn-sm">
            <Plus className="w-3.5 h-3.5" /> Add Rule
          </button>
        </div>

        {ruleSet.rules && ruleSet.rules.length > 0 ? (
          <div className="divide-y divide-slate-100">
            {ruleSet.rules.map((rule) => (
              <div key={rule.id} className="group">
                <div
                  className="px-6 py-4 flex items-center gap-3 hover:bg-slate-50/50 cursor-pointer"
                  onClick={() => toggleExpand(rule.id)}
                >
                  <div className="text-slate-300">
                    {expandedRules.has(rule.id)
                      ? <ChevronDown className="w-4 h-4" />
                      : <ChevronRight className="w-4 h-4" />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-slate-900">{rule.name}</span>
                      <span className="badge-gray text-[10px]">P{rule.priority}</span>
                      {!rule.enabled && <span className="badge-red text-[10px]">disabled</span>}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {rule.conditions?.conditions?.length || 0} conditions, {rule.actions?.length || 0} actions
                    </div>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleToggleRule(rule); }}
                      className="p-1.5 rounded hover:bg-slate-100"
                      title={rule.enabled ? 'Disable' : 'Enable'}
                    >
                      {rule.enabled
                        ? <ToggleRight className="w-4 h-4 text-emerald-600" />
                        : <ToggleLeft className="w-4 h-4 text-slate-400" />
                      }
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setEditingRule(rule); }}
                      className="p-1.5 rounded hover:bg-slate-100 text-slate-500"
                    >
                      <Save className="w-4 h-4" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDeleteRule(rule.id); }}
                      className="p-1.5 rounded hover:bg-red-50 text-slate-400 hover:text-red-600"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                {/* Expanded view */}
                {expandedRules.has(rule.id) && (
                  <div className="px-6 pb-4 pl-14">
                    <div className="bg-slate-50 rounded-lg p-4 text-xs font-mono space-y-3">
                      <div>
                        <div className="text-slate-500 font-sans text-[11px] font-medium mb-1 uppercase tracking-wider">Conditions ({rule.conditions?.logic || 'AND'})</div>
                        {rule.conditions?.conditions?.length > 0 ? (
                          <div className="space-y-1">
                            {rule.conditions.conditions.map((c: any, i: number) => (
                              <div key={i} className="text-slate-700">
                                <span className="text-brand-600">{c.field}</span>{' '}
                                <span className="text-amber-600">{c.operator}</span>{' '}
                                <span className="text-emerald-600">{JSON.stringify(c.value)}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">No conditions (always fires)</span>
                        )}
                      </div>
                      <div>
                        <div className="text-slate-500 font-sans text-[11px] font-medium mb-1 uppercase tracking-wider">Actions</div>
                        {rule.actions?.length > 0 ? (
                          <div className="space-y-1">
                            {rule.actions.map((a: any, i: number) => (
                              <div key={i} className="text-slate-700">
                                <span className="text-purple-600">{a.type}</span>{' '}
                                <span className="text-brand-600">{a.field}</span>{' '}
                                = <span className="text-emerald-600">{JSON.stringify(a.value)}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">No actions</span>
                        )}
                      </div>
                      <button
                        onClick={() => setEditingRule(rule)}
                        className="btn-secondary btn-sm mt-2"
                      >
                        Edit Rule
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="px-6 py-12 text-center text-sm text-slate-500">
            No rules yet. Add your first rule to get started.
          </div>
        )}
      </div>

      {/* Decision Tables summary */}
      {ruleSet.decisionTables && ruleSet.decisionTables.length > 0 && (
        <div className="card">
          <div className="px-6 py-4 border-b border-slate-200">
            <h3 className="font-semibold text-slate-900">
              Decision Tables ({ruleSet.decisionTables.length})
            </h3>
          </div>
          <div className="divide-y divide-slate-100">
            {ruleSet.decisionTables.map((table: any) => {
              const cols = typeof table.columns === 'string' ? JSON.parse(table.columns) : (table.columns || []);
              const rows = typeof table.rows === 'string' ? JSON.parse(table.rows) : (table.rows || []);
              return (
                <Link
                  key={table.id}
                  to={`/decision-tables/${table.id}`}
                  className="block px-6 py-4 hover:bg-slate-50/50"
                >
                  <div className="font-medium text-slate-900">{table.name}</div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    {cols.length} columns, {rows.length} rows
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* New Rule Modal */}
      <Modal open={showNewRule} onClose={() => setShowNewRule(false)} title="Add Rule">
        <div className="space-y-4">
          <div>
            <label className="label">Rule Name</label>
            <input
              className="input"
              placeholder="e.g., Young Driver Surcharge"
              value={newRuleName}
              onChange={(e) => setNewRuleName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreateRule()}
              autoFocus
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setShowNewRule(false)} className="btn-secondary">Cancel</button>
            <button onClick={handleCreateRule} className="btn-primary" disabled={!newRuleName.trim()}>Create</button>
          </div>
        </div>
      </Modal>

      {/* Edit Rule Modal */}
      {editingRule && (
        <Modal
          open={!!editingRule}
          onClose={() => setEditingRule(null)}
          title={`Edit: ${editingRule.name}`}
          size="xl"
        >
          <RuleEditor rule={editingRule} onSave={handleSaveRule} onCancel={() => setEditingRule(null)} />
        </Modal>
      )}

      {/* Test Modal */}
      <Modal open={showTest} onClose={() => { setShowTest(false); setTestResult(null); }} title="Test Rule Set" size="lg">
        <div className="space-y-4">
          <div>
            <label className="label">Input JSON</label>
            <textarea
              className="input font-mono text-sm min-h-[200px]"
              value={testInput}
              onChange={(e) => setTestInput(e.target.value)}
              placeholder='{"applicant": {"age": 30, "income": 50000}}'
            />
          </div>
          <button onClick={handleTest} className="btn-primary w-full" disabled={testRunning}>
            {testRunning ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <Play className="w-4 h-4" /> Run Test
              </>
            )}
          </button>
          {testResult && (
            <div className="bg-slate-50 rounded-lg p-4 max-h-[300px] overflow-auto">
              <pre className="text-xs font-mono text-slate-700 whitespace-pre-wrap">
                {JSON.stringify(testResult, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
