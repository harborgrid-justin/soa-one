import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Panel,
  addEdge,
  useNodesState,
  useEdgesState,
  useReactFlow,
  ReactFlowProvider,
  BackgroundVariant,
  type Connection,
  type Node,
  type Edge,
  type OnSelectionChangeParams,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { ArrowLeft, Save, Play, Settings2 } from 'lucide-react';
import { getWorkflow, updateWorkflow, executeWorkflow as runWorkflow } from '../api/client';
import { Modal } from '../components/common/Modal';
import { useStore } from '../store';
import { nodeTypes } from '../components/flow/FlowNodes';
import { edgeTypes } from '../components/flow/FlowEdges';
import { FlowToolbar } from '../components/flow/FlowToolbar';
import { DragNodePanel } from '../components/flow/DragNodePanel';
import { NodeConfigPanel } from '../components/flow/NodeConfigPanel';
import { useUndoRedo } from '../components/flow/useUndoRedo';
import { getAutoLayout } from '../components/flow/autoLayout';

const defaultLabels: Record<string, string> = {
  ruleTask: 'Rule Task', decision: 'Decision', serviceTask: 'Service Task',
  script: 'Script', timer: 'Wait', end: 'End',
};

function WorkflowDesignerInner() {
  const { id } = useParams<{ id: string }>();
  const [workflow, setWorkflow] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showTest, setShowTest] = useState(false);
  const [testInput, setTestInput] = useState('{\n  \n}');
  const [testResult, setTestResult] = useState<any>(null);
  const [testRunning, setTestRunning] = useState(false);
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [bgVariant, setBgVariant] = useState<'dots' | 'lines' | 'cross'>('dots');
  const [locked, setLocked] = useState(false);
  const [clipboard, setClipboard] = useState<Node[]>([]);
  const { addNotification } = useStore();
  const reactFlowInstance = useReactFlow();
  const wrapperRef = useRef<HTMLDivElement>(null);

  const memoNodeTypes = useMemo(() => nodeTypes, []);
  const memoEdgeTypes = useMemo(() => edgeTypes, []);

  const { takeSnapshot, undo, redo, canUndo, canRedo } = useUndoRedo(
    nodes, edges,
    (n) => setNodes(n),
    (e) => setEdges(e),
  );

  // Load workflow
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

  // Connection validation: no self-loops
  const isValidConnection = useCallback((connection: Connection | Edge) => {
    return connection.source !== connection.target;
  }, []);

  // Connect with labels for decision nodes
  const onConnect = useCallback(
    (connection: Connection) => {
      takeSnapshot();
      const sourceNode = nodes.find((n) => n.id === connection.source);
      let label: string | undefined;
      if (sourceNode?.type === 'decision') {
        label = connection.sourceHandle === 'yes' ? 'Yes' : 'No';
      }
      setEdges((eds) => addEdge({
        ...connection,
        animated: true,
        type: 'labeled',
        ...(label ? { label, data: { label } } : {}),
      }, eds));
    },
    [setEdges, nodes, takeSnapshot],
  );

  // Handle edge deletion from custom edge button
  const handleEdgeDelete = useCallback((edgeId: string) => {
    takeSnapshot();
    setEdges((eds) => eds.filter((e) => e.id !== edgeId));
  }, [setEdges, takeSnapshot]);

  // Inject delete handler into edge data
  const edgesWithHandlers = useMemo(() =>
    edges.map((e) => ({
      ...e,
      type: e.type || 'labeled',
      data: { ...e.data, onDelete: handleEdgeDelete },
    })),
    [edges, handleEdgeDelete],
  );

  // Selection tracking
  const onSelectionChange = useCallback(({ nodes: sel }: OnSelectionChangeParams) => {
    setSelectedNode(sel.length === 1 ? sel[0] : null);
  }, []);

  // Node config update
  const handleNodeDataUpdate = useCallback((nodeId: string, data: Record<string, any>) => {
    setNodes((nds) => nds.map((n) => n.id === nodeId ? { ...n, data } : n));
  }, [setNodes]);

  // Delete selected nodes/edges
  const deleteSelected = useCallback(() => {
    takeSnapshot();
    const selectedNodeIds = new Set(nodes.filter((n) => n.selected).map((n) => n.id));
    if (selectedNodeIds.size > 0) {
      setNodes((nds) => nds.filter((n) => !n.selected));
      setEdges((eds) => eds.filter((e) => !selectedNodeIds.has(e.source) && !selectedNodeIds.has(e.target)));
    }
    const selectedEdgeIds = new Set(edges.filter((e) => e.selected).map((e) => e.id));
    if (selectedEdgeIds.size > 0) {
      setEdges((eds) => eds.filter((e) => !e.selected));
    }
    setSelectedNode(null);
  }, [nodes, edges, setNodes, setEdges, takeSnapshot]);

  // Copy/Paste nodes
  const copySelected = useCallback(() => {
    const selected = nodes.filter((n) => n.selected);
    if (selected.length > 0) {
      setClipboard(selected);
      addNotification({ type: 'info', message: `Copied ${selected.length} node(s)` });
    }
  }, [nodes, addNotification]);

  const pasteNodes = useCallback(() => {
    if (clipboard.length === 0) return;
    takeSnapshot();
    const newNodes = clipboard.map((n) => ({
      ...n,
      id: `${n.type}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      position: { x: n.position.x + 50, y: n.position.y + 50 },
      selected: false,
    }));
    setNodes((nds) => [...nds, ...newNodes]);
    addNotification({ type: 'info', message: `Pasted ${newNodes.length} node(s)` });
  }, [clipboard, setNodes, takeSnapshot, addNotification]);

  // Auto-layout
  const autoLayout = useCallback(() => {
    takeSnapshot();
    const { nodes: laid } = getAutoLayout(nodes, edges);
    setNodes(laid);
    setTimeout(() => reactFlowInstance.fitView({ padding: 0.2 }), 50);
  }, [nodes, edges, setNodes, reactFlowInstance, takeSnapshot]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && e.shiftKey) { e.preventDefault(); redo(); }
      if ((e.metaKey || e.ctrlKey) && e.key === 'c') { e.preventDefault(); copySelected(); }
      if ((e.metaKey || e.ctrlKey) && e.key === 'v') { e.preventDefault(); pasteNodes(); }
      if (e.key === 'Delete' || e.key === 'Backspace') { deleteSelected(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [undo, redo, copySelected, pasteNodes, deleteSelected]);

  // Drag & drop from panel
  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    wrapperRef.current?.classList.add('flow-dropzone-active');
  }, []);

  const onDragLeave = useCallback(() => {
    wrapperRef.current?.classList.remove('flow-dropzone-active');
  }, []);

  const onDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    wrapperRef.current?.classList.remove('flow-dropzone-active');
    const type = event.dataTransfer.getData('application/reactflow');
    if (!type) return;
    takeSnapshot();
    const position = reactFlowInstance.screenToFlowPosition({
      x: event.clientX,
      y: event.clientY,
    });
    const newNode: Node = {
      id: `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type,
      position,
      data: { label: defaultLabels[type] || type },
    };
    setNodes((nds) => [...nds, newNode]);
  }, [reactFlowInstance, setNodes, takeSnapshot]);

  // Background cycling
  const cycleBg = useCallback(() => {
    const order: Array<'dots' | 'lines' | 'cross'> = ['dots', 'lines', 'cross'];
    setBgVariant((v) => order[(order.indexOf(v) + 1) % order.length]);
  }, []);

  // Save
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

  // Test/Run
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

  const bgVariantMap = { dots: BackgroundVariant.Dots, lines: BackgroundVariant.Lines, cross: BackgroundVariant.Cross };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm">
          <Link to={`/projects/${workflow.projectId}`} className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 flex items-center gap-1">
            <ArrowLeft className="w-4 h-4" /> Project
          </Link>
          <span className="text-slate-300 dark:text-slate-600">/</span>
          <span className="text-slate-900 dark:text-white font-medium">{workflow.name}</span>
          <span className="badge-gray ml-2">{workflow.status}</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowTest(true)} className="btn-secondary btn-sm">
            <Play className="w-3.5 h-3.5" /> Run
          </button>
          <button onClick={handleSave} className="btn-primary btn-sm" disabled={saving}>
            <Save className="w-3.5 h-3.5" /> {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      {/* Canvas */}
      <div ref={wrapperRef} className="card relative" style={{ height: '75vh' }}>
        <ReactFlow
          nodes={nodes}
          edges={edgesWithHandlers}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          isValidConnection={isValidConnection}
          onSelectionChange={onSelectionChange}
          nodeTypes={memoNodeTypes}
          edgeTypes={memoEdgeTypes}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          fitView
          snapToGrid
          snapGrid={[15, 15]}
          nodesDraggable={!locked}
          nodesConnectable={!locked}
          elementsSelectable={!locked}
          deleteKeyCode={null}
          multiSelectionKeyCode="Shift"
          selectionOnDrag
          proOptions={{ hideAttribution: true }}
        >
          <Background variant={bgVariantMap[bgVariant]} gap={15} size={1} />
          <Controls showInteractive={false} />
          <MiniMap
            nodeColor={(node) => {
              const colors: Record<string, string> = {
                start: '#10b981', end: '#ef4444', ruleTask: '#6366f1',
                decision: '#f59e0b', serviceTask: '#3b82f6', script: '#a855f7',
                timer: '#64748b',
              };
              return colors[node.type || ''] || '#94a3b8';
            }}
            maskColor="rgba(0,0,0,0.08)"
            pannable
            zoomable
          />
        </ReactFlow>

        {/* Drag panel */}
        <DragNodePanel />

        {/* Bottom toolbar */}
        <FlowToolbar
          canUndo={canUndo}
          canRedo={canRedo}
          onUndo={undo}
          onRedo={redo}
          onAutoLayout={autoLayout}
          onDeleteSelected={deleteSelected}
          onCopySelected={copySelected}
          onPaste={pasteNodes}
          hasClipboard={clipboard.length > 0}
          interactionLocked={locked}
          onToggleLock={() => setLocked((l) => !l)}
          backgroundVariant={bgVariant}
          onCycleBackground={cycleBg}
        />

        {/* Node config panel */}
        <NodeConfigPanel
          node={selectedNode}
          onUpdate={handleNodeDataUpdate}
          onClose={() => setSelectedNode(null)}
          onDelete={(nodeId) => {
            takeSnapshot();
            setNodes((nds) => nds.filter((n) => n.id !== nodeId));
            setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId));
            setSelectedNode(null);
          }}
        />
      </div>

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
              <div className={`p-3 rounded-lg ${testResult.status === 'completed' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' : 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300'}`}>
                <div className="font-medium text-sm">Status: {testResult.status || 'error'}</div>
                {testResult.error && <div className="text-xs mt-1">{testResult.error}</div>}
              </div>
              {testResult.output && (
                <div>
                  <div className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Output</div>
                  <pre className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3 text-xs font-mono overflow-auto max-h-[150px]">
                    {JSON.stringify(testResult.output, null, 2)}
                  </pre>
                </div>
              )}
              {testResult.logs && testResult.logs.length > 0 && (
                <div>
                  <div className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Execution Trace</div>
                  <div className="space-y-1">
                    {testResult.logs.map((log: any, i: number) => (
                      <div key={i} className="flex items-center gap-2 text-xs bg-slate-50 dark:bg-slate-800 rounded px-3 py-2">
                        <span className={`w-2 h-2 rounded-full ${log.status === 'completed' ? 'bg-emerald-500' : log.status === 'error' ? 'bg-red-500' : 'bg-slate-400'}`} />
                        <span className="font-medium text-slate-700 dark:text-slate-300">{log.label}</span>
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

/** WorkflowDesigner must be wrapped in ReactFlowProvider for useReactFlow */
export function WorkflowDesigner() {
  return (
    <ReactFlowProvider>
      <WorkflowDesignerInner />
    </ReactFlowProvider>
  );
}
