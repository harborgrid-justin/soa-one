import type { Node } from '@xyflow/react';
import { X, Zap, GitBranch, Plug, Code, Clock, Square, CircleDot } from 'lucide-react';

const typeConfig: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  start: { label: 'Start Event', icon: CircleDot, color: 'text-emerald-600' },
  end: { label: 'End Event', icon: Square, color: 'text-red-600' },
  ruleTask: { label: 'Rule Task', icon: Zap, color: 'text-brand-600' },
  decision: { label: 'Decision Gateway', icon: GitBranch, color: 'text-amber-600' },
  serviceTask: { label: 'Service Task', icon: Plug, color: 'text-blue-600' },
  script: { label: 'Script Task', icon: Code, color: 'text-purple-600' },
  timer: { label: 'Timer', icon: Clock, color: 'text-slate-600' },
};

interface NodeConfigPanelProps {
  node: Node | null;
  onUpdate: (id: string, data: Record<string, any>) => void;
  onClose: () => void;
  onDelete: (id: string) => void;
}

export function NodeConfigPanel({ node, onUpdate, onClose, onDelete }: NodeConfigPanelProps) {
  if (!node) return null;

  const config = typeConfig[node.type || ''] || typeConfig.ruleTask;
  const Icon = config.icon;

  const handleLabelChange = (label: string) => {
    onUpdate(node.id, { ...node.data, label });
  };

  const handleDescChange = (description: string) => {
    onUpdate(node.id, { ...node.data, description });
  };

  return (
    <div className="absolute top-0 right-0 z-20 w-72 h-full bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-700 shadow-xl animate-slide-in-right overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-2">
          <Icon className={`w-4 h-4 ${config.color}`} />
          <span className="text-sm font-semibold text-slate-900 dark:text-white">{config.label}</span>
        </div>
        <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Properties */}
      <div className="p-4 space-y-4">
        <div>
          <label className="label">Node ID</label>
          <input className="input bg-slate-50 dark:bg-slate-800" value={node.id} readOnly />
        </div>

        <div>
          <label className="label">Label</label>
          <input
            className="input"
            value={(node.data as any).label || ''}
            onChange={(e) => handleLabelChange(e.target.value)}
            placeholder="Enter node label..."
          />
        </div>

        <div>
          <label className="label">Description</label>
          <textarea
            className="input min-h-[80px]"
            value={(node.data as any).description || ''}
            onChange={(e) => handleDescChange(e.target.value)}
            placeholder="Optional description..."
          />
        </div>

        {node.type === 'ruleTask' && (
          <div>
            <label className="label">Rule Set</label>
            <input
              className="input"
              value={(node.data as any).ruleSetName || ''}
              onChange={(e) => onUpdate(node.id, { ...node.data, ruleSetName: e.target.value })}
              placeholder="Rule set name..."
            />
          </div>
        )}

        <div>
          <label className="label">Position</label>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <span className="text-[10px] text-slate-400">X</span>
              <input className="input text-xs bg-slate-50 dark:bg-slate-800" value={Math.round(node.position.x)} readOnly />
            </div>
            <div>
              <span className="text-[10px] text-slate-400">Y</span>
              <input className="input text-xs bg-slate-50 dark:bg-slate-800" value={Math.round(node.position.y)} readOnly />
            </div>
          </div>
        </div>

        <hr className="border-slate-200 dark:border-slate-700" />

        <button
          onClick={() => onDelete(node.id)}
          className="btn-danger w-full justify-center btn-sm"
        >
          Delete Node
        </button>
      </div>
    </div>
  );
}
