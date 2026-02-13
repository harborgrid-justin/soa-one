import { Zap, GitBranch, Plug, Code, Clock, Square } from 'lucide-react';

const nodeOptions = [
  { type: 'ruleTask', label: 'Rule Task', icon: Zap, color: 'border-brand-300 bg-brand-50 dark:bg-brand-900/20', desc: 'Execute a rule set' },
  { type: 'decision', label: 'Decision', icon: GitBranch, color: 'border-amber-300 bg-amber-50 dark:bg-amber-900/20', desc: 'Branch on condition' },
  { type: 'serviceTask', label: 'Service', icon: Plug, color: 'border-blue-300 bg-blue-50 dark:bg-blue-900/20', desc: 'Call external API' },
  { type: 'script', label: 'Script', icon: Code, color: 'border-purple-300 bg-purple-50 dark:bg-purple-900/20', desc: 'Transform data' },
  { type: 'timer', label: 'Timer', icon: Clock, color: 'border-slate-300 bg-slate-50 dark:bg-slate-800', desc: 'Wait / delay' },
  { type: 'end', label: 'End', icon: Square, color: 'border-red-300 bg-red-50 dark:bg-red-900/20', desc: 'End workflow' },
];

interface DragNodePanelProps {
  collapsed?: boolean;
}

export function DragNodePanel({ collapsed }: DragNodePanelProps) {
  const onDragStart = (event: React.DragEvent, nodeType: string) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.effectAllowed = 'move';
  };

  if (collapsed) {
    return (
      <div className="absolute top-4 left-4 z-10 flex flex-col gap-1 p-1.5 rounded-xl bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm border border-slate-200 dark:border-slate-700 shadow-lg">
        {nodeOptions.map((opt) => (
          <div
            key={opt.type}
            draggable
            onDragStart={(e) => onDragStart(e, opt.type)}
            className={`p-2 rounded-lg border cursor-grab active:cursor-grabbing ${opt.color} transition-transform hover:scale-105`}
            title={opt.label}
          >
            <opt.icon className="w-4 h-4" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="absolute top-4 left-4 z-10 w-48 bg-white/95 dark:bg-slate-800/95 backdrop-blur-sm border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg overflow-hidden">
      <div className="px-3 py-2 border-b border-slate-200 dark:border-slate-700">
        <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Drag to Canvas</span>
      </div>
      <div className="p-2 space-y-1">
        {nodeOptions.map((opt) => (
          <div
            key={opt.type}
            draggable
            onDragStart={(e) => onDragStart(e, opt.type)}
            className={`flex items-center gap-2.5 p-2 rounded-lg border cursor-grab active:cursor-grabbing ${opt.color} transition-all hover:shadow-sm hover:scale-[1.02]`}
          >
            <opt.icon className="w-4 h-4 flex-shrink-0" />
            <div>
              <div className="text-xs font-medium text-slate-900 dark:text-white">{opt.label}</div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400">{opt.desc}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
