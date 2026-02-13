import dagre from 'dagre';
import type { Node, Edge } from '@xyflow/react';

interface LayoutOptions {
  direction?: 'TB' | 'LR' | 'BT' | 'RL';
  nodeWidth?: number;
  nodeHeight?: number;
  rankSep?: number;
  nodeSep?: number;
}

/** Auto-layout nodes using dagre algorithm */
export function getAutoLayout(
  nodes: Node[],
  edges: Edge[],
  options: LayoutOptions = {},
): { nodes: Node[]; edges: Edge[] } {
  const {
    direction = 'TB',
    nodeWidth = 200,
    nodeHeight = 80,
    rankSep = 80,
    nodeSep = 50,
  } = options;

  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: direction, ranksep: rankSep, nodesep: nodeSep });

  nodes.forEach((node) => {
    const isCircular = node.type === 'start' || node.type === 'end';
    g.setNode(node.id, {
      width: isCircular ? 64 : nodeWidth,
      height: isCircular ? 64 : nodeHeight,
    });
  });

  edges.forEach((edge) => {
    g.setEdge(edge.source, edge.target);
  });

  dagre.layout(g);

  const layoutedNodes = nodes.map((node) => {
    const dagNode = g.node(node.id);
    const isCircular = node.type === 'start' || node.type === 'end';
    const w = isCircular ? 64 : nodeWidth;
    const h = isCircular ? 64 : nodeHeight;

    return {
      ...node,
      position: {
        x: dagNode.x - w / 2,
        y: dagNode.y - h / 2,
      },
    };
  });

  return { nodes: layoutedNodes, edges };
}
