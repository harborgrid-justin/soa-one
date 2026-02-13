import { useMemo } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  BackgroundVariant,
  type Node,
  type Edge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { nodeTypes } from './FlowNodes';
import { edgeTypes } from './FlowEdges';

interface ReadOnlyFlowGraphProps {
  nodes: Node[];
  edges: Edge[];
  height?: string;
  className?: string;
  showMinimap?: boolean;
  showControls?: boolean;
}

/** Read-only flow visualization used by Impact Analyzer, Debugger, Explorer, Replay */
export function ReadOnlyFlowGraph({
  nodes,
  edges,
  height = '400px',
  className = '',
  showMinimap = true,
  showControls = true,
}: ReadOnlyFlowGraphProps) {
  const memoNodeTypes = useMemo(() => nodeTypes, []);
  const memoEdgeTypes = useMemo(() => edgeTypes, []);

  return (
    <div className={`card overflow-hidden ${className}`} style={{ height }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={memoNodeTypes}
        edgeTypes={memoEdgeTypes}
        fitView
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        panOnDrag
        zoomOnScroll
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={15} size={1} />
        {showControls && <Controls showInteractive={false} />}
        {showMinimap && (
          <MiniMap
            nodeColor={(node) => {
              const colors: Record<string, string> = {
                start: '#10b981', end: '#ef4444', ruleTask: '#6366f1',
                decision: '#f59e0b', serviceTask: '#3b82f6', script: '#a855f7',
                timer: '#64748b', dependency: '#94a3b8',
              };
              return colors[node.type || ''] || '#94a3b8';
            }}
            maskColor="rgba(0,0,0,0.08)"
            pannable
            zoomable
          />
        )}
      </ReactFlow>
    </div>
  );
}
