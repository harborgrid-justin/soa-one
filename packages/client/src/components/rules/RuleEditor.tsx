import { useState } from 'react';
import { Plus, Trash2, Save, X } from 'lucide-react';
import type { Rule, Condition, ConditionGroup, Action, ComparisonOperator, ActionType, LogicalOperator } from '../../types';
import { OPERATOR_LABELS } from '../../types';

interface RuleEditorProps {
  rule: Rule;
  onSave: (rule: Rule) => void;
  onCancel: () => void;
}

export function RuleEditor({ rule: initial, onSave, onCancel }: RuleEditorProps) {
  const [rule, setRule] = useState<Rule>({ ...initial });

  const updateField = (field: keyof Rule, value: any) => {
    setRule((prev) => ({ ...prev, [field]: value }));
  };

  const addCondition = () => {
    const newCondition: Condition = { field: '', operator: 'equals', value: '' };
    const conditions = { ...rule.conditions };
    conditions.conditions = [...(conditions.conditions || []), newCondition];
    updateField('conditions', conditions);
  };

  const updateCondition = (index: number, field: keyof Condition, value: any) => {
    const conditions = { ...rule.conditions };
    const items = [...conditions.conditions];
    items[index] = { ...items[index], [field]: value } as Condition;
    conditions.conditions = items;
    updateField('conditions', conditions);
  };

  const removeCondition = (index: number) => {
    const conditions = { ...rule.conditions };
    conditions.conditions = conditions.conditions.filter((_: any, i: number) => i !== index);
    updateField('conditions', conditions);
  };

  const addAction = () => {
    const newAction: Action = { type: 'SET', field: '', value: '' };
    updateField('actions', [...(rule.actions || []), newAction]);
  };

  const updateAction = (index: number, field: keyof Action, value: any) => {
    const actions = [...rule.actions];
    actions[index] = { ...actions[index], [field]: value };
    updateField('actions', actions);
  };

  const removeAction = (index: number) => {
    updateField('actions', rule.actions.filter((_: any, i: number) => i !== index));
  };

  const parseValue = (val: string) => {
    if (val === 'true') return true;
    if (val === 'false') return false;
    if (val === 'null') return null;
    const num = Number(val);
    if (!isNaN(num) && val.trim() !== '') return num;
    return val;
  };

  return (
    <div className="space-y-6">
      {/* Basic info */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Rule Name</label>
          <input
            className="input"
            value={rule.name}
            onChange={(e) => updateField('name', e.target.value)}
          />
        </div>
        <div>
          <label className="label">Priority (higher = first)</label>
          <input
            className="input"
            type="number"
            value={rule.priority}
            onChange={(e) => updateField('priority', Number(e.target.value))}
          />
        </div>
      </div>
      <div>
        <label className="label">Description</label>
        <input
          className="input"
          value={rule.description}
          onChange={(e) => updateField('description', e.target.value)}
          placeholder="What does this rule do?"
        />
      </div>

      {/* Conditions */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <label className="text-sm font-semibold text-slate-900">IF</label>
            <select
              className="input w-auto py-1 px-2 text-xs"
              value={rule.conditions?.logic || 'AND'}
              onChange={(e) => updateField('conditions', { ...rule.conditions, logic: e.target.value as LogicalOperator })}
            >
              <option value="AND">ALL conditions match (AND)</option>
              <option value="OR">ANY condition matches (OR)</option>
            </select>
          </div>
          <button onClick={addCondition} className="btn-secondary btn-sm">
            <Plus className="w-3.5 h-3.5" /> Add Condition
          </button>
        </div>

        <div className="space-y-2">
          {(rule.conditions?.conditions || []).map((cond: any, i: number) => (
            <div key={i} className="flex items-center gap-2 bg-slate-50 rounded-lg p-3">
              <input
                className="input flex-1"
                placeholder="field.path"
                value={cond.field || ''}
                onChange={(e) => updateCondition(i, 'field', e.target.value)}
              />
              <select
                className="input w-44"
                value={cond.operator || 'equals'}
                onChange={(e) => updateCondition(i, 'operator', e.target.value)}
              >
                {Object.entries(OPERATOR_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
              {cond.operator !== 'isNull' && cond.operator !== 'isNotNull' && (
                <input
                  className="input flex-1"
                  placeholder="value"
                  value={cond.value === null || cond.value === undefined ? '' : String(cond.value)}
                  onChange={(e) => updateCondition(i, 'value', parseValue(e.target.value))}
                />
              )}
              <button onClick={() => removeCondition(i)} className="p-1.5 rounded hover:bg-red-50 text-slate-400 hover:text-red-600">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
          {(!rule.conditions?.conditions || rule.conditions.conditions.length === 0) && (
            <div className="text-sm text-slate-400 italic py-2 text-center">
              No conditions — this rule will always fire
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <label className="text-sm font-semibold text-slate-900">THEN</label>
          <button onClick={addAction} className="btn-secondary btn-sm">
            <Plus className="w-3.5 h-3.5" /> Add Action
          </button>
        </div>

        <div className="space-y-2">
          {(rule.actions || []).map((action: Action, i: number) => (
            <div key={i} className="flex items-center gap-2 bg-emerald-50/50 rounded-lg p-3">
              <select
                className="input w-36"
                value={action.type}
                onChange={(e) => updateAction(i, 'type', e.target.value as ActionType)}
              >
                <option value="SET">SET</option>
                <option value="APPEND">APPEND</option>
                <option value="INCREMENT">INCREMENT</option>
                <option value="DECREMENT">DECREMENT</option>
              </select>
              <input
                className="input flex-1"
                placeholder="output.field"
                value={action.field}
                onChange={(e) => updateAction(i, 'field', e.target.value)}
              />
              <span className="text-slate-400">=</span>
              <input
                className="input flex-1"
                placeholder="value"
                value={action.value === null || action.value === undefined ? '' : String(action.value)}
                onChange={(e) => updateAction(i, 'value', parseValue(e.target.value))}
              />
              <button onClick={() => removeAction(i)} className="p-1.5 rounded hover:bg-red-50 text-slate-400 hover:text-red-600">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
          {(!rule.actions || rule.actions.length === 0) && (
            <div className="text-sm text-slate-400 italic py-2 text-center">
              No actions defined
            </div>
          )}
        </div>
      </div>

      {/* Actions bar */}
      <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
        <button onClick={onCancel} className="btn-secondary">
          <X className="w-4 h-4" /> Cancel
        </button>
        <button onClick={() => onSave(rule)} className="btn-primary">
          <Save className="w-4 h-4" /> Save Rule
        </button>
      </div>
    </div>
  );
}
