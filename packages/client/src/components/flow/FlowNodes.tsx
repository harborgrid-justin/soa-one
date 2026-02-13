import { memo } from 'react';
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react';
import {
  CircleDot, Square, GitBranch, Zap, Clock, Code, Plug,
  CheckCircle, XCircle, Loader2, AlertTriangle,
} from 'lucide-react';

/** Status indicator shown on nodes */
function StatusBadge({ status }: { status?: string }) {
  if (!status) return null;
  const config: Record<string, { icon: typeof CheckCircle; color: string }> = {
    running: { icon: Loader2, color: 'text-blue-500 animate-spin' },
    success: { icon: CheckCircle, color: 'text-emerald-500' },
    error: { icon: XCircle, color: 'text-red-500' },
    warning: { icon: AlertTriangle, color: 'text-amber-500' },
  };
  const c = config[status];
  if (!c) return null;
  const Icon = c.icon;
  return (
    <div className="absolute -top-2 -right-2 w-5 h-5 bg-white dark:bg-slate-900 rounded-full flex items-center justify-center shadow-sm border border-slate-200 dark:border-slate-700">
      <Icon className={`w-3.5 h-3.5 ${c.color}`} />
    </div>
  );
}

type FlowNodeData = {
  label?: string;
  ruleSetName?: string;
  status?: string;
  description?: string;
  selected?: boolean;
};

type FlowNode = Node<FlowNodeData>;

export const StartNode = memo(({ data, selected }: NodeProps<FlowNode>) => (
  <div className={`relative bg-emerald-500 text-white rounded-full w-16 h-16 flex items-center justify-center shadow-lg transition-shadow ${selected ? 'ring-2 ring-emerald-300 ring-offset-2' : ''}`}>
    <Handle type="source" position={Position.Bottom} className="!bg-emerald-700 !w-3 !h-3" />
    <CircleDot className="w-6 h-6" />
    <StatusBadge status={data.status} />
  </div>
));
StartNode.displayName = 'StartNode';

export const EndNode = memo(({ data, selected }: NodeProps<FlowNode>) => (
  <div className={`relative bg-red-500 text-white rounded-full w-16 h-16 flex items-center justify-center shadow-lg transition-shadow ${selected ? 'ring-2 ring-red-300 ring-offset-2' : ''}`}>
    <Handle type="target" position={Position.Top} className="!bg-red-700 !w-3 !h-3" />
    <Square className="w-5 h-5" />
    <StatusBadge status={data.status} />
  </div>
));
EndNode.displayName = 'EndNode';

export const RuleTaskNode = memo(({ data, selected }: NodeProps<FlowNode>) => (
  <div className={`relative bg-white dark:bg-slate-800 border-2 border-brand-500 rounded-xl px-6 py-4 shadow-md min-w-[180px] transition-all ${selected ? 'ring-2 ring-brand-300 ring-offset-2 shadow-lg' : 'hover:shadow-lg'}`}>
    <Handle type="target" position={Position.Top} className="!bg-brand-600 !w-3 !h-3" />
    <div className="flex items-center gap-2 mb-1">
      <div className="w-6 h-6 rounded-md bg-brand-50 dark:bg-brand-900/30 flex items-center justify-center">
        <Zap className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400" />
      </div>
      <span className="text-[10px] font-semibold text-brand-600 dark:text-brand-400 uppercase tracking-wider">Rule Task</span>
    </div>
    <div className="text-sm font-medium text-slate-900 dark:text-white">{data.label || 'Rule Task'}</div>
    {data.ruleSetName && <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">{data.ruleSetName}</div>}
    {data.description && <div className="text-[10px] text-slate-400 mt-1 truncate max-w-[160px]">{data.description}</div>}
    <Handle type="source" position={Position.Bottom} className="!bg-brand-600 !w-3 !h-3" />
    <StatusBadge status={data.status} />
  </div>
));
RuleTaskNode.displayName = 'RuleTaskNode';

export const DecisionNode = memo(({ data, selected }: NodeProps<FlowNode>) => (
  <div className={`relative bg-amber-50 dark:bg-amber-900/20 border-2 border-amber-500 rounded-xl px-6 py-4 shadow-md min-w-[160px] transition-all ${selected ? 'ring-2 ring-amber-300 ring-offset-2 shadow-lg' : 'hover:shadow-lg'}`}>
    <Handle type="target" position={Position.Top} className="!bg-amber-600 !w-3 !h-3" />
    <div className="flex items-center gap-2 mb-1">
      <div className="w-6 h-6 rounded-md bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center">
        <GitBranch className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
      </div>
      <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider">Decision</span>
    </div>
    <div className="text-sm font-medium text-slate-900 dark:text-white">{data.label || 'Decision'}</div>
    <div className="flex justify-between mt-2 text-[9px] font-medium">
      <span className="text-emerald-600">Yes</span>
      <span className="text-red-500">No</span>
    </div>
    <Handle type="source" position={Position.Bottom} id="yes" className="!bg-emerald-500 !w-3 !h-3 !left-[30%]" />
    <Handle type="source" position={Position.Bottom} id="no" className="!bg-red-500 !w-3 !h-3 !left-[70%]" />
    <StatusBadge status={data.status} />
  </div>
));
DecisionNode.displayName = 'DecisionNode';

export const ServiceTaskNode = memo(({ data, selected }: NodeProps<FlowNode>) => (
  <div className={`relative bg-white dark:bg-slate-800 border-2 border-blue-500 rounded-xl px-6 py-4 shadow-md min-w-[180px] transition-all ${selected ? 'ring-2 ring-blue-300 ring-offset-2 shadow-lg' : 'hover:shadow-lg'}`}>
    <Handle type="target" position={Position.Top} className="!bg-blue-600 !w-3 !h-3" />
    <div className="flex items-center gap-2 mb-1">
      <div className="w-6 h-6 rounded-md bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center">
        <Plug className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
      </div>
      <span className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider">Service</span>
    </div>
    <div className="text-sm font-medium text-slate-900 dark:text-white">{data.label || 'Service Task'}</div>
    <Handle type="source" position={Position.Bottom} className="!bg-blue-600 !w-3 !h-3" />
    <StatusBadge status={data.status} />
  </div>
));
ServiceTaskNode.displayName = 'ServiceTaskNode';

export const ScriptNode = memo(({ data, selected }: NodeProps<FlowNode>) => (
  <div className={`relative bg-white dark:bg-slate-800 border-2 border-purple-500 rounded-xl px-6 py-4 shadow-md min-w-[160px] transition-all ${selected ? 'ring-2 ring-purple-300 ring-offset-2 shadow-lg' : 'hover:shadow-lg'}`}>
    <Handle type="target" position={Position.Top} className="!bg-purple-600 !w-3 !h-3" />
    <div className="flex items-center gap-2 mb-1">
      <div className="w-6 h-6 rounded-md bg-purple-50 dark:bg-purple-900/30 flex items-center justify-center">
        <Code className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
      </div>
      <span className="text-[10px] font-semibold text-purple-600 dark:text-purple-400 uppercase tracking-wider">Script</span>
    </div>
    <div className="text-sm font-medium text-slate-900 dark:text-white">{data.label || 'Script'}</div>
    <Handle type="source" position={Position.Bottom} className="!bg-purple-600 !w-3 !h-3" />
    <StatusBadge status={data.status} />
  </div>
));
ScriptNode.displayName = 'ScriptNode';

export const TimerNode = memo(({ data, selected }: NodeProps<FlowNode>) => (
  <div className={`relative bg-white dark:bg-slate-800 border-2 border-slate-400 dark:border-slate-500 rounded-xl px-6 py-4 shadow-md min-w-[140px] transition-all ${selected ? 'ring-2 ring-slate-300 ring-offset-2 shadow-lg' : 'hover:shadow-lg'}`}>
    <Handle type="target" position={Position.Top} className="!bg-slate-500 !w-3 !h-3" />
    <div className="flex items-center gap-2 mb-1">
      <div className="w-6 h-6 rounded-md bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
        <Clock className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
      </div>
      <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Timer</span>
    </div>
    <div className="text-sm font-medium text-slate-900 dark:text-white">{data.label || 'Wait'}</div>
    <Handle type="source" position={Position.Bottom} className="!bg-slate-500 !w-3 !h-3" />
    <StatusBadge status={data.status} />
  </div>
));
TimerNode.displayName = 'TimerNode';

/** Dependency graph node for impact analysis & debug views */
export const DependencyNode = memo(({ data, selected }: NodeProps<FlowNode>) => {
  const statusColors: Record<string, string> = {
    fired: 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20',
    skipped: 'border-slate-300 bg-slate-50 dark:bg-slate-800 dark:border-slate-600',
    error: 'border-red-500 bg-red-50 dark:bg-red-900/20',
    affected: 'border-amber-500 bg-amber-50 dark:bg-amber-900/20',
  };
  const borderClass = statusColors[data.status || 'skipped'] || statusColors.skipped;

  return (
    <div className={`relative border-2 rounded-xl px-5 py-3 shadow-sm min-w-[140px] transition-all ${borderClass} ${selected ? 'ring-2 ring-brand-300 ring-offset-2' : ''}`}>
      <Handle type="target" position={Position.Top} className="!bg-slate-400 !w-2.5 !h-2.5" />
      <div className="text-sm font-medium text-slate-900 dark:text-white">{data.label}</div>
      {data.description && <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">{data.description}</div>}
      <Handle type="source" position={Position.Bottom} className="!bg-slate-400 !w-2.5 !h-2.5" />
      <StatusBadge status={data.status === 'fired' ? 'success' : data.status === 'error' ? 'error' : undefined} />
    </div>
  );
});
DependencyNode.displayName = 'DependencyNode';

export const nodeTypes = {
  start: StartNode,
  end: EndNode,
  ruleTask: RuleTaskNode,
  decision: DecisionNode,
  serviceTask: ServiceTaskNode,
  script: ScriptNode,
  timer: TimerNode,
  dependency: DependencyNode,
};
