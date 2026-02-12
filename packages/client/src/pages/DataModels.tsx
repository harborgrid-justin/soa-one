import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, Save, Database, ChevronRight, ChevronDown } from 'lucide-react';
import { getDataModel, getDataModels, updateDataModel, createDataModel } from '../api/client';
import { useStore } from '../store';
import type { DataModel, FieldDefinition } from '../types';

function FieldRow({
  field,
  depth,
  onUpdate,
  onRemove,
  onAddChild,
}: {
  field: FieldDefinition;
  depth: number;
  onUpdate: (field: FieldDefinition) => void;
  onRemove: () => void;
  onAddChild: () => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = field.type === 'object' && field.children && field.children.length > 0;

  return (
    <>
      <div
        className="flex items-center gap-2 py-2 px-3 hover:bg-slate-50 rounded-lg group"
        style={{ paddingLeft: `${depth * 24 + 12}px` }}
      >
        {field.type === 'object' ? (
          <button onClick={() => setExpanded(!expanded)} className="text-slate-400">
            {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
        ) : (
          <span className="w-4" />
        )}
        <input
          className="input py-1 flex-1 text-sm"
          value={field.name}
          onChange={(e) => onUpdate({ ...field, name: e.target.value })}
          placeholder="fieldName"
        />
        <select
          className="input py-1 w-28 text-xs"
          value={field.type}
          onChange={(e) => onUpdate({ ...field, type: e.target.value as any })}
        >
          <option value="string">String</option>
          <option value="number">Number</option>
          <option value="boolean">Boolean</option>
          <option value="date">Date</option>
          <option value="object">Object</option>
          <option value="array">Array</option>
        </select>
        <label className="flex items-center gap-1 text-xs text-slate-500">
          <input
            type="checkbox"
            className="rounded border-slate-300"
            checked={field.required || false}
            onChange={(e) => onUpdate({ ...field, required: e.target.checked })}
          />
          Req
        </label>
        {field.type === 'object' && (
          <button onClick={onAddChild} className="p-1 rounded hover:bg-brand-50 text-slate-400 hover:text-brand-600">
            <Plus className="w-3.5 h-3.5" />
          </button>
        )}
        <button onClick={onRemove} className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-red-50 text-slate-400 hover:text-red-600">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
      {expanded && hasChildren && field.children?.map((child, i) => (
        <FieldRow
          key={i}
          field={child}
          depth={depth + 1}
          onUpdate={(updated) => {
            const children = [...(field.children || [])];
            children[i] = updated;
            onUpdate({ ...field, children });
          }}
          onRemove={() => {
            const children = (field.children || []).filter((_, idx) => idx !== i);
            onUpdate({ ...field, children });
          }}
          onAddChild={() => {
            const children = [...(child.children || []), { name: '', type: 'string' as const }];
            const updatedChild = { ...child, children };
            const allChildren = [...(field.children || [])];
            allChildren[i] = updatedChild;
            onUpdate({ ...field, children: allChildren });
          }}
        />
      ))}
    </>
  );
}

export function DataModelEditor() {
  const { id } = useParams<{ id: string }>();
  const [model, setModel] = useState<DataModel | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { addNotification } = useStore();

  useEffect(() => {
    if (!id) return;
    getDataModel(id)
      .then((m) => {
        setModel({
          ...m,
          schema: typeof m.schema === 'string' ? JSON.parse(m.schema) : m.schema,
        });
      })
      .catch(() => addNotification({ type: 'error', message: 'Failed to load data model' }))
      .finally(() => setLoading(false));
  }, [id]);

  const handleSave = async () => {
    if (!model || !id) return;
    setSaving(true);
    try {
      await updateDataModel(id, { name: model.name, schema: model.schema });
      addNotification({ type: 'success', message: 'Data model saved' });
    } catch {
      addNotification({ type: 'error', message: 'Failed to save' });
    } finally {
      setSaving(false);
    }
  };

  const addField = () => {
    if (!model) return;
    const fields = [...model.schema.fields, { name: '', type: 'string' as const }];
    setModel({ ...model, schema: { ...model.schema, fields } });
  };

  const updateFieldAtIndex = (index: number, field: FieldDefinition) => {
    if (!model) return;
    const fields = [...model.schema.fields];
    fields[index] = field;
    setModel({ ...model, schema: { ...model.schema, fields } });
  };

  const removeFieldAtIndex = (index: number) => {
    if (!model) return;
    const fields = model.schema.fields.filter((_, i) => i !== index);
    setModel({ ...model, schema: { ...model.schema, fields } });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!model) return <div className="text-center py-16 text-slate-500">Model not found</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm">
          <Link to="/data-models" className="text-slate-500 hover:text-slate-700 flex items-center gap-1">
            <ArrowLeft className="w-4 h-4" /> Data Models
          </Link>
          <span className="text-slate-300">/</span>
          <span className="text-slate-900 font-medium">{model.name}</span>
        </div>
        <button onClick={handleSave} className="btn-primary btn-sm" disabled={saving}>
          <Save className="w-3.5 h-3.5" /> {saving ? 'Saving...' : 'Save Model'}
        </button>
      </div>

      <div className="card p-5">
        <label className="label">Model Name</label>
        <input
          className="input max-w-md"
          value={model.name}
          onChange={(e) => setModel({ ...model, name: e.target.value })}
        />
      </div>

      <div className="card">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h3 className="font-semibold text-slate-900">Fields</h3>
          <button onClick={addField} className="btn-primary btn-sm">
            <Plus className="w-3.5 h-3.5" /> Add Field
          </button>
        </div>
        <div className="p-2">
          {model.schema.fields.length > 0 ? (
            model.schema.fields.map((field, i) => (
              <FieldRow
                key={i}
                field={field}
                depth={0}
                onUpdate={(f) => updateFieldAtIndex(i, f)}
                onRemove={() => removeFieldAtIndex(i)}
                onAddChild={() => {
                  const updated = { ...field, children: [...(field.children || []), { name: '', type: 'string' as const }] };
                  updateFieldAtIndex(i, updated);
                }}
              />
            ))
          ) : (
            <div className="py-8 text-center text-sm text-slate-500">
              No fields defined. Add fields to define the data structure.
            </div>
          )}
        </div>
      </div>

      {/* JSON Preview */}
      <div className="card">
        <div className="px-6 py-4 border-b border-slate-200">
          <h3 className="font-semibold text-slate-900">Schema Preview</h3>
        </div>
        <pre className="p-4 text-xs font-mono text-slate-600 overflow-auto max-h-[300px]">
          {JSON.stringify(model.schema, null, 2)}
        </pre>
      </div>
    </div>
  );
}

// List page for data models
export function DataModelsList() {
  const [models, setModels] = useState<DataModel[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    getDataModels()
      .then(setModels)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-slate-500">Data models define the structure of facts your business rules evaluate.</p>
      {models.length > 0 ? (
        <div className="card divide-y divide-slate-100">
          {models.map((m) => (
            <div
              key={m.id}
              className="px-6 py-4 hover:bg-slate-50/50 cursor-pointer flex items-center justify-between"
              onClick={() => navigate(`/data-models/${m.id}`)}
            >
              <div className="flex items-center gap-3">
                <Database className="w-5 h-5 text-blue-600" />
                <div>
                  <div className="font-medium text-slate-900">{m.name}</div>
                  <div className="text-xs text-slate-500">{m.schema?.fields?.length || 0} fields</div>
                </div>
              </div>
              <span className="text-xs text-slate-400">{new Date(m.updatedAt).toLocaleDateString()}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="card p-12 text-center text-sm text-slate-500">
          No data models yet. Create one from a project page.
        </div>
      )}
    </div>
  );
}
