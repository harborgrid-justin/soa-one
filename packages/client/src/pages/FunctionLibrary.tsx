import { useEffect, useState } from 'react';
import {
  Code2,
  Plus,
  Search,
  Play,
  Trash2,
  Edit3,
  CheckCircle,
  XCircle,
  Tag,
  X,
  RefreshCw,
} from 'lucide-react';
import { Modal } from '../components/common/Modal';
import api from '../api/client';
import { useStore } from '../store';

interface FunctionParam {
  id: string;
  name: string;
  type: string;
}

interface CustomFunction {
  id: string;
  name: string;
  description: string;
  code: string;
  parameters: FunctionParam[];
  returnType: string;
  version: number;
  isValid: boolean;
  createdAt: string;
  updatedAt: string;
}

interface TestResult {
  output: any;
  error?: string;
  executionTimeMs: number;
}

export function FunctionLibrary() {
  const { addNotification } = useStore();
  const [functions, setFunctions] = useState<CustomFunction[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingFn, setEditingFn] = useState<CustomFunction | null>(null);
  const [showTestPanel, setShowTestPanel] = useState(false);
  const [testFn, setTestFn] = useState<CustomFunction | null>(null);
  const [testInput, setTestInput] = useState('{}');
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [testRunning, setTestRunning] = useState(false);

  // Form state
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formCode, setFormCode] = useState('// Your function code here\nfunction execute(params) {\n  return params;\n}');
  const [formParams, setFormParams] = useState<FunctionParam[]>([]);
  const [formReturnType, setFormReturnType] = useState('any');
  const [syntaxValid, setSyntaxValid] = useState(true);

  const fetchFunctions = async () => {
    setLoading(true);
    try {
      const res = await api.get('/functions');
      setFunctions(res.data.functions || res.data || []);
    } catch {
      addNotification({ type: 'error', message: 'Failed to load functions' });
      setFunctions([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFunctions();
  }, []);

  const validateSyntax = (code: string) => {
    try {
      new Function(code);
      setSyntaxValid(true);
    } catch {
      setSyntaxValid(false);
    }
  };

  const resetForm = () => {
    setFormName('');
    setFormDescription('');
    setFormCode('// Your function code here\nfunction execute(params) {\n  return params;\n}');
    setFormParams([]);
    setFormReturnType('any');
    setSyntaxValid(true);
    setEditingFn(null);
  };

  const openCreate = () => {
    resetForm();
    setShowModal(true);
  };

  const openEdit = (fn: CustomFunction) => {
    setEditingFn(fn);
    setFormName(fn.name);
    setFormDescription(fn.description);
    setFormCode(fn.code);
    setFormParams(fn.parameters || []);
    setFormReturnType(fn.returnType || 'any');
    setSyntaxValid(fn.isValid !== false);
    setShowModal(true);
  };

  const openTest = (fn: CustomFunction) => {
    setTestFn(fn);
    setTestInput(JSON.stringify(
      fn.parameters.reduce((acc, p) => ({ ...acc, [p.name]: '' }), {}),
      null,
      2,
    ));
    setTestResult(null);
    setShowTestPanel(true);
  };

  const handleSave = async () => {
    if (!formName.trim()) {
      addNotification({ type: 'error', message: 'Function name is required' });
      return;
    }
    const payload = {
      name: formName,
      description: formDescription,
      code: formCode,
      parameters: formParams,
      returnType: formReturnType,
    };
    try {
      if (editingFn) {
        await api.put(`/functions/${editingFn.id}`, payload);
        addNotification({ type: 'success', message: 'Function updated' });
      } else {
        await api.post('/functions', payload);
        addNotification({ type: 'success', message: 'Function created' });
      }
      setShowModal(false);
      resetForm();
      fetchFunctions();
    } catch {
      addNotification({ type: 'error', message: `Failed to ${editingFn ? 'update' : 'create'} function` });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/functions/${id}`);
      addNotification({ type: 'success', message: 'Function deleted' });
      fetchFunctions();
    } catch {
      addNotification({ type: 'error', message: 'Failed to delete function' });
    }
  };

  const handleTest = async () => {
    if (!testFn) return;
    setTestRunning(true);
    setTestResult(null);
    try {
      const input = JSON.parse(testInput);
      const res = await api.post(`/functions/${testFn.id}/test`, { args: input });
      setTestResult(res.data);
    } catch (err: any) {
      setTestResult({
        output: null,
        error: err?.response?.data?.message || 'Invalid JSON input or execution error',
        executionTimeMs: 0,
      });
    } finally {
      setTestRunning(false);
    }
  };

  const addParam = () => {
    setFormParams([...formParams, { id: String(Date.now()), name: '', type: 'string' }]);
  };

  const removeParam = (id: string) => {
    setFormParams(formParams.filter((p) => p.id !== id));
  };

  const updateParam = (id: string, field: keyof FunctionParam, value: string) => {
    setFormParams(formParams.map((p) => (p.id === id ? { ...p, [field]: value } : p)));
  };

  const filtered = functions.filter(
    (fn) =>
      fn.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      fn.description.toLowerCase().includes(searchQuery.toLowerCase()),
  );

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
            <Code2 className="w-5 h-5 text-brand-600" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Function Library</h1>
            <p className="text-sm text-slate-500">Custom functions for rule evaluations</p>
          </div>
        </div>
        <button onClick={openCreate} className="btn-primary">
          <Plus className="w-4 h-4" />
          New Function
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          className="input pl-10"
          placeholder="Search functions..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Function list + test panel */}
      <div className={`grid gap-6 ${showTestPanel ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'}`}>
        <div className="space-y-3">
          {filtered.length > 0 ? (
            filtered.map((fn) => (
              <div key={fn.id} className="card p-5">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-slate-900">{fn.name}</h3>
                      <span className="badge-blue">
                        <Tag className="w-3 h-3 mr-1" />
                        v{fn.version}
                      </span>
                      {fn.isValid !== false ? (
                        <span className="badge-green">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Valid
                        </span>
                      ) : (
                        <span className="bg-red-100 text-red-700 text-xs font-medium px-2 py-0.5 rounded-full inline-flex items-center">
                          <XCircle className="w-3 h-3 mr-1" />
                          Invalid
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-500 mt-1">{fn.description || 'No description'}</p>
                    {fn.parameters && fn.parameters.length > 0 && (
                      <div className="flex gap-1.5 mt-2 flex-wrap">
                        {fn.parameters.map((p) => (
                          <span key={p.id || p.name} className="badge-gray text-xs">
                            {p.name}: {p.type}
                          </span>
                        ))}
                        <span className="text-xs text-slate-400 self-center">
                          &rarr; {fn.returnType || 'any'}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0 ml-4">
                    <button onClick={() => openTest(fn)} className="btn-secondary btn-sm">
                      <Play className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => openEdit(fn)} className="btn-secondary btn-sm">
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(fn.id)}
                      className="btn-secondary btn-sm text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="card px-6 py-16 text-center">
              <Code2 className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="text-sm text-slate-500">
                {searchQuery ? 'No functions match your search.' : 'No custom functions yet.'}
              </p>
              {!searchQuery && (
                <button onClick={openCreate} className="btn-primary btn-sm mt-4">
                  <Plus className="w-3.5 h-3.5" />
                  Create One
                </button>
              )}
            </div>
          )}
        </div>

        {/* Test Panel */}
        {showTestPanel && testFn && (
          <div className="card">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-semibold text-slate-900">Test: {testFn.name}</h3>
              <button
                onClick={() => {
                  setShowTestPanel(false);
                  setTestFn(null);
                }}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="label">Input Arguments (JSON)</label>
                <textarea
                  className="input font-mono text-xs min-h-[120px]"
                  value={testInput}
                  onChange={(e) => setTestInput(e.target.value)}
                />
              </div>
              <button
                onClick={handleTest}
                className="btn-primary w-full justify-center"
                disabled={testRunning}
              >
                {testRunning ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Play className="w-4 h-4" />
                )}
                {testRunning ? 'Running...' : 'Run Test'}
              </button>
              {testResult && (
                <div className="space-y-2">
                  <label className="label">Output</label>
                  <div
                    className={`rounded-lg p-4 font-mono text-xs whitespace-pre-wrap ${
                      testResult.error ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'
                    }`}
                  >
                    {testResult.error
                      ? testResult.error
                      : JSON.stringify(testResult.output, null, 2)}
                  </div>
                  {testResult.executionTimeMs > 0 && (
                    <p className="text-xs text-slate-500">
                      Execution time: {testResult.executionTimeMs}ms
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      <Modal
        open={showModal}
        onClose={() => {
          setShowModal(false);
          resetForm();
        }}
        title={editingFn ? 'Edit Function' : 'Create Function'}
        size="xl"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Name</label>
              <input
                className="input"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g. calculateDiscount"
              />
            </div>
            <div>
              <label className="label">Return Type</label>
              <select
                className="input"
                value={formReturnType}
                onChange={(e) => setFormReturnType(e.target.value)}
              >
                <option value="any">any</option>
                <option value="string">string</option>
                <option value="number">number</option>
                <option value="boolean">boolean</option>
                <option value="object">object</option>
                <option value="array">array</option>
              </select>
            </div>
          </div>

          <div>
            <label className="label">Description</label>
            <input
              className="input"
              value={formDescription}
              onChange={(e) => setFormDescription(e.target.value)}
              placeholder="What does this function do?"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="label mb-0">Parameters</label>
              <button onClick={addParam} className="btn-secondary btn-sm">
                <Plus className="w-3.5 h-3.5" />
                Add
              </button>
            </div>
            {formParams.length > 0 ? (
              <div className="space-y-2">
                {formParams.map((p) => (
                  <div key={p.id} className="flex items-center gap-2">
                    <input
                      className="input flex-1"
                      value={p.name}
                      onChange={(e) => updateParam(p.id, 'name', e.target.value)}
                      placeholder="Parameter name"
                    />
                    <select
                      className="input w-32"
                      value={p.type}
                      onChange={(e) => updateParam(p.id, 'type', e.target.value)}
                    >
                      <option value="string">string</option>
                      <option value="number">number</option>
                      <option value="boolean">boolean</option>
                      <option value="object">object</option>
                      <option value="array">array</option>
                      <option value="any">any</option>
                    </select>
                    <button
                      onClick={() => removeParam(p.id)}
                      className="p-1.5 rounded-lg hover:bg-red-100 text-red-500"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400">No parameters defined.</p>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="label mb-0">Code</label>
              <span
                className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                  syntaxValid
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-red-100 text-red-700'
                }`}
              >
                {syntaxValid ? 'Syntax OK' : 'Syntax Error'}
              </span>
            </div>
            <textarea
              className="input font-mono text-xs min-h-[200px] leading-relaxed"
              value={formCode}
              onChange={(e) => {
                setFormCode(e.target.value);
                validateSyntax(e.target.value);
              }}
              spellCheck={false}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => {
                setShowModal(false);
                resetForm();
              }}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button onClick={handleSave} className="btn-primary">
              <Code2 className="w-4 h-4" />
              {editingFn ? 'Update Function' : 'Create Function'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
