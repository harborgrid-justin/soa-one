import { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  Connection,
  Node,
  Edge,
  Handle,
  Position,
  NodeProps,
} from 'reactflow';
import 'reactflow/dist/style.css';
import {
  ArrowLeft, Save, Play, Plus, Trash2, Settings2,
  CircleDot, Square, GitBranch, Zap, Clock, Code, Plug,
} from 'lucide-react';
import { getWorkflow, updateWorkflow, executeWorkflow as runWorkflow } from '../api/client';
import { Modal } from '../components/common/Modal';
import { useStore } from '../store';

// Custom node components
function StartNode({ data }: NodeProps) {
  return (
    <div className="bg-emerald-500 text-white rounded-full w-16 h-16 flex items-center justify-center shadow-lg">
      <Handle type="source" position={Position.Bottom} className="!bg-emerald-700" />
      <CircleDot className="w-6 h-6" />
    </div>
  );
}

function EndNode({ data }: NodeProps) {
  return (
    <div className="bg-red-500 text-white rounded-full w-16 h-16 flex items-center justify-center shadow-lg">
      <Handle type="target" position={Position.Top} className="!bg-red-700" />
      <Square className="w-5 h-5" />
    </div>
  );
}

function RuleTaskNode({ data }: NodeProps) {
  return (
    <div className="bg-white border-2 border-brand-500 rounded-xl px-6 py-4 shadow-md min-w-[180px]">
      <Handle type="target" position={Position.Top} className="!bg-brand-600" />
      <div className="flex items-center gap-2 mb-1">
        <Zap className="w-4 h-4 text-brand-600" />
        <span className="text-xs font-semibold text-brand-600 uppercase tracking-wider">Rule Task</span>
      </div>
      <div className="text-sm font-medium text-slate-900">{data.label || 'Rule Task'}</div>
      {data.ruleSetName && <div className="text-xs text-slate-500 mt-1">{data.ruleSetName}</div>}
      <Handle type="source" position={Position.Bottom} className="!bg-brand-600" />
    </div>
  );
}

function DecisionNode({ data }: NodeProps) {
  return (
    <div className="bg-amber-50 border-2 border-amber-500 rounded-xl px-6 py-4 shadow-md min-w-[160px]">
      <Handle type="target" position={Position.Top} className="!bg-amber-600" />
      <div className="flex items-center gap-2 mb-1">
        <GitBranch className="w-4 h-4 text-amber-600" />
        <span className="text-xs font-semibold text-amber-600 uppercase tracking-wider">Decision</span>
      </div>
      <div className="text-sm font-medium text-slate-900">{data.label || 'Decision'}</div>
      <Handle type="source" position={Position.Bottom} id="yes" className="!bg-amber-600 !left-[30%]" />
      <Handle type="source" position={Position.Bottom} id="no" className="!bg-amber-600 !left-[70%]" />
    </div>
  );
}

function ServiceTaskNode({ data }: NodeProps) {
  return (
    <div className="bg-white border-2 border-blue-500 rounded-xl px-6 py-4 shadow-md min-w-[180px]">
      <Handle type="target" position={Position.Top} className="!bg-blue-600" />
      <div className="flex items-center gap-2 mb-1">
        <Plug className="w-4 h-4 text-blue-600" />
        <span className="text-xs font-semibold text-blue-600 uppercase tracking-wider">Service</span>
      </div>
      <div className="text-sm font-medium text-slate-900">{data.label || 'Service Task'}</div>
      <Handle type="source" position={Position.Bottom} className="!bg-blue-600" />
    </div>
  );
}

function ScriptNode({ data }: NodeProps) {
  return (
    <div className="bg-white border-2 border-purple-500 rounded-xl px-6 py-4 shadow-md min-w-[160px]">
      <Handle type="target" position={Position.Top} className="!bg-purple-600" />
      <div className="flex items-center gap-2 mb-1">
        <Code className="w-4 h-4 text-purple-600" />
        <span className="text-xs font-semibold text-purple-600 uppercase tracking-wider">Script</span>
      </div>
      <div className="text-sm font-medium text-slate-900">{data.label || 'Script'}</div>
      <Handle type="source" position={Position.Bottom} className="!bg-purple-600" />
    </div>
  );
}

function TimerNode({ data }: NodeProps) {
  return (
    <div className="bg-white border-2 border-slate-400 rounded-xl px-6 py-4 shadow-md min-w-[140px]">
      <Handle type="target" position={Position.Top} className="!bg-slate-500" />
      <div className="flex items-center gap-2 mb-1">
        <Clock className="w-4 h-4 text-slate-500" />
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Timer</span>
      </div>
      <div className="text-sm font-medium text-slate-900">{data.label || 'Wait'}</div>
      <Handle type="source" position={Position.Bottom} className="!bg-slate-500" />
    </div>
  );
}

const nodeTypes = {
  start: StartNode,
  end: EndNode,
  ruleTask: RuleTaskNode,
  decision: DecisionNode,
  serviceTask: ServiceTaskNode,
  script: ScriptNode,
  timer: TimerNode,
};

const nodeOptions = [
  { type: 'ruleTask', label: 'Rule Task', icon: Zap, desc: 'Execute a rule set' },
  { type: 'decision', label: 'Decision Gateway', icon: GitBranch, desc: 'Branch on condition' },
  { type: 'serviceTask', label: 'Service Task', icon: Plug, desc: 'Call external service' },
  { type: 'script', label: 'Script Task', icon: Code, desc: 'Transform data' },
  { type: 'timer', label: 'Timer', icon: Clock, desc: 'Wait/delay' },
  { type: 'end', label: 'End Event', icon: Square, desc: 'End the workflow' },
];

export function WorkflowDesigner() {
  const { id } = useParams<{ id: string }>();
  const [workflow, setWorkflow] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showAddNode, setShowAddNode] = useState(false);
  const [showTest, setShowTest] = useState(false);
  const [testInput, setTestInput] = useState('{\n  \n}');
  const [testResult, setTestResult] = useState<any>(null);
  const [testRunning, setTestRunning] = useState(false);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const { addNotification } = useStore();

  const memoizedNodeTypes = useMemo(() => nodeTypes, []);

  useEffect(() => {
    if (!id) return;
    getWorkflow(id)
      .then((w) => {
        setWorkflow(w);
        setNodes(w.nodes || []);
        setEdges(w.edges || []);
      })
      .catch(() => addNotification({ type: 'error', message: 'Failed to load workflow' }))
      .finally(() => setLoading(false));
  }, [id]);

  const onConnect = useCallback(
    (connection: Connection) => setEdges((eds) => addEdge({ ...connection, animated: true }, eds)),
    [setEdges],
  );

  const handleSave = async () => {
    if (!id) return;
    setSaving(true);
    try {
      await updateWorkflow(id, { nodes, edges });
      addNotification({ type: 'success', message: 'Workflow saved' });
    } catch {
      addNotification({ type: 'error', message: 'Failed to save' });
    } finally {
      setSaving(false);
    }
  };

  const handleAddNode = (type: string) => {
    const newNode: Node = {
      id: `${type}-${Date.now()}`,
      type,
      position: { x: 250 + Math.random() * 100, y: 150 + nodes.length * 80 },
      data: { label: type === 'ruleTask' ? 'Rule Task' : type === 'decision' ? 'Decision' : type === 'serviceTask' ? 'Service Task' : type === 'script' ? 'Script' : type === 'timer' ? 'Wait' : type },
    };
    setNodes((nds) => [...nds, newNode]);
    setShowAddNode(false);
  };

  const handleTest = async () => {
    if (!id) return;
    setTestRunning(true);
    setTestResult(null);
    try {
      const input = JSON.parse(testInput);
      const result = await runWorkflow(id, input);
      setTestResult(result);
    } catch (err: any) {
      setTestResult({ error: err.message || 'Execution failed' });
    } finally {
      setTestRunning(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!workflow) return <div className="text-center py-16 text-slate-500">Workflow not found</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm">
          <Link to={`/projects/${workflow.projectId}`} className="text-slate-500 hover:text-slate-700 flex items-center gap-1">
            <ArrowLeft className="w-4 h-4" /> Project
          </Link>
          <span className="text-slate-300">/</span>
          <span className="text-slate-900 font-medium">{workflow.name}</span>
          <span className="badge-gray ml-2">{workflow.status}</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowAddNode(true)} className="btn-secondary btn-sm">
            <Plus className="w-3.5 h-3.5" /> Add Node
          </button>
          <button onClick={() => setShowTest(true)} className="btn-secondary btn-sm">
            <Play className="w-3.5 h-3.5" /> Run
          </button>
          <button onClick={handleSave} className="btn-primary btn-sm" disabled={saving}>
            <Save className="w-3.5 h-3.5" /> {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      {/* Canvas */}
      <div className="card" style={{ height: '70vh' }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={memoizedNodeTypes}
          fitView
          snapToGrid
          snapGrid={[15, 15]}
        >
          <Background gap={15} size={1} color="#e2e8f0" />
          <Controls />
          <MiniMap
            nodeColor={(node) => {
              switch (node.type) {
                case 'start': return '#10b981';
                case 'end': return '#ef4444';
                case 'ruleTask': return '#6366f1';
                case 'decision': return '#f59e0b';
                case 'serviceTask': return '#3b82f6';
                case 'script': return '#a855f7';
                case 'timer': return '#64748b';
                default: return '#94a3b8';
              }
            }}
          />
        </ReactFlow>
      </div>

      {/* Add Node Modal */}
      <Modal open={showAddNode} onClose={() => setShowAddNode(false)} title="Add Workflow Node">
        <div className="grid grid-cols-2 gap-3">
          {nodeOptions.map((opt) => (
            <button
              key={opt.type}
              onClick={() => handleAddNode(opt.type)}
              className="card p-4 hover:shadow-md text-left transition-shadow"
            >
              <opt.icon className="w-5 h-5 text-brand-600 mb-2" />
              <div className="font-medium text-slate-900 text-sm">{opt.label}</div>
              <div className="text-xs text-slate-500">{opt.desc}</div>
            </button>
          ))}
        </div>
      </Modal>

      {/* Test/Run Modal */}
      <Modal open={showTest} onClose={() => { setShowTest(false); setTestResult(null); }} title="Execute Workflow" size="lg">
        <div className="space-y-4">
          <div>
            <label className="label">Input Data (JSON)</label>
            <textarea
              className="input font-mono text-sm min-h-[150px]"
              value={testInput}
              onChange={(e) => setTestInput(e.target.value)}
            />
          </div>
          <button onClick={handleTest} className="btn-primary w-full" disabled={testRunning}>
            {testRunning ? 'Running...' : 'Execute'}
          </button>
          {testResult && (
            <div className="space-y-3">
              <div className={`p-3 rounded-lg ${testResult.status === 'completed' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                <div className="font-medium text-sm">
                  Status: {testResult.status || 'error'}
                </div>
                {testResult.error && <div className="text-xs mt-1">{testResult.error}</div>}
              </div>

              {testResult.output && (
                <div>
                  <div className="text-sm font-medium text-slate-700 mb-1">Output</div>
                  <pre className="bg-slate-50 rounded-lg p-3 text-xs font-mono overflow-auto max-h-[150px]">
                    {JSON.stringify(testResult.output, null, 2)}
                  </pre>
                </div>
              )}

              {testResult.logs && testResult.logs.length > 0 && (
                <div>
                  <div className="text-sm font-medium text-slate-700 mb-1">Execution Trace</div>
                  <div className="space-y-1">
                    {testResult.logs.map((log: any, i: number) => (
                      <div key={i} className="flex items-center gap-2 text-xs bg-slate-50 rounded px-3 py-2">
                        <span className={`w-2 h-2 rounded-full ${log.status === 'completed' ? 'bg-emerald-500' : log.status === 'error' ? 'bg-red-500' : 'bg-slate-400'}`} />
                        <span className="font-medium text-slate-700">{log.label}</span>
                        <span className="text-slate-400">{log.nodeType}</span>
                        <span className="text-slate-400 ml-auto">{log.durationMs}ms</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
