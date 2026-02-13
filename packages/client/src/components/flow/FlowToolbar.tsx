import { useReactFlow } from '@xyflow/react';
import {
  ZoomIn, ZoomOut, Maximize2, Lock, Unlock, Grid3X3,
  Undo2, Redo2, AlignVerticalSpaceAround, Trash2, Copy, Clipboard,
} from 'lucide-react';

interface FlowToolbarProps {
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onAutoLayout: () => void;
  onDeleteSelected: () => void;
  onCopySelected: () => void;
  onPaste: () => void;
  hasClipboard: boolean;
  interactionLocked: boolean;
  onToggleLock: () => void;
  backgroundVariant: 'dots' | 'lines' | 'cross';
  onCycleBackground: () => void;
}

export function FlowToolbar({
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onAutoLayout,
  onDeleteSelected,
  onCopySelected,
  onPaste,
  hasClipboard,
  interactionLocked,
  onToggleLock,
  backgroundVariant,
  onCycleBackground,
}: FlowToolbarProps) {
  const { zoomIn, zoomOut, fitView, getZoom } = useReactFlow();

  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1 px-2 py-1.5 rounded-xl bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm border border-slate-200 dark:border-slate-700 shadow-lg">
      {/* Undo/Redo */}
      <ToolbarButton icon={Undo2} onClick={onUndo} disabled={!canUndo} title="Undo (Ctrl+Z)" />
      <ToolbarButton icon={Redo2} onClick={onRedo} disabled={!canRedo} title="Redo (Ctrl+Shift+Z)" />
      <Separator />

      {/* Zoom */}
      <ToolbarButton icon={ZoomOut} onClick={() => zoomOut()} title="Zoom Out" />
      <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 w-10 text-center select-none">
        {Math.round(getZoom() * 100)}%
      </span>
      <ToolbarButton icon={ZoomIn} onClick={() => zoomIn()} title="Zoom In" />
      <ToolbarButton icon={Maximize2} onClick={() => fitView({ padding: 0.2 })} title="Fit View" />
      <Separator />

      {/* Layout */}
      <ToolbarButton icon={AlignVerticalSpaceAround} onClick={onAutoLayout} title="Auto Layout (dagre)" />
      <ToolbarButton
        icon={Grid3X3}
        onClick={onCycleBackground}
        title={`Background: ${backgroundVariant}`}
        active={backgroundVariant !== 'dots'}
      />
      <ToolbarButton
        icon={interactionLocked ? Lock : Unlock}
        onClick={onToggleLock}
        title={interactionLocked ? 'Unlock Canvas' : 'Lock Canvas'}
        active={interactionLocked}
      />
      <Separator />

      {/* Clipboard */}
      <ToolbarButton icon={Copy} onClick={onCopySelected} title="Copy Selected (Ctrl+C)" />
      <ToolbarButton icon={Clipboard} onClick={onPaste} disabled={!hasClipboard} title="Paste (Ctrl+V)" />
      <ToolbarButton icon={Trash2} onClick={onDeleteSelected} title="Delete Selected (Del)" className="text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20" />
    </div>
  );
}

function Separator() {
  return <div className="w-px h-5 bg-slate-200 dark:bg-slate-700 mx-0.5" />;
}

function ToolbarButton({
  icon: Icon,
  onClick,
  disabled,
  title,
  active,
  className = '',
}: {
  icon: React.ElementType;
  onClick: () => void;
  disabled?: boolean;
  title?: string;
  active?: boolean;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`p-1.5 rounded-lg transition-colors ${
        active
          ? 'bg-brand-50 text-brand-600 dark:bg-brand-900/30 dark:text-brand-400'
          : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
      } disabled:opacity-30 disabled:cursor-not-allowed ${className}`}
    >
      <Icon className="w-4 h-4" />
    </button>
  );
}
