import { type EdgeProps, BaseEdge, EdgeLabelRenderer, getBezierPath, getSmoothStepPath } from '@xyflow/react';
import { X } from 'lucide-react';

/** Labeled bezier edge with optional delete button */
export function LabeledEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  label,
  data,
  markerEnd,
  style,
}: EdgeProps) {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition,
  });

  return (
    <>
      <BaseEdge id={id} path={edgePath} markerEnd={markerEnd} style={{ ...style, strokeWidth: 2 }} />
      {(label || (data as any)?.label) && (
        <EdgeLabelRenderer>
          <div
            style={{ transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)` }}
            className="absolute text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 shadow-sm pointer-events-auto"
          >
            {String(label || (data as any)?.label)}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

/** Animated smoothstep edge with pulse effect */
export function AnimatedEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  markerEnd,
  style,
}: EdgeProps) {
  const [edgePath] = getSmoothStepPath({
    sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition,
  });

  return (
    <BaseEdge
      id={id}
      path={edgePath}
      markerEnd={markerEnd}
      style={{
        ...style,
        strokeWidth: 2,
        strokeDasharray: '5,5',
        animation: 'dashmove 0.5s linear infinite',
      }}
    />
  );
}

/** Edge with delete button on hover */
export function DeletableEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  label,
  data,
  markerEnd,
  style,
}: EdgeProps) {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition,
  });

  const edgeData = data as Record<string, any> | undefined;

  const onDelete = () => {
    edgeData?.onDelete?.(id);
  };

  return (
    <>
      <BaseEdge id={id} path={edgePath} markerEnd={markerEnd} style={{ ...style, strokeWidth: 2 }} />
      <EdgeLabelRenderer>
        <div
          style={{ transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)` }}
          className="absolute flex items-center gap-1.5 pointer-events-auto"
        >
          {(label || edgeData?.label) && (
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 shadow-sm">
              {String(label || edgeData?.label)}
            </span>
          )}
          <button
            onClick={onDelete}
            className="w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 hover:opacity-100 group-hover:opacity-100 transition-opacity shadow-sm hover:bg-red-600"
            title="Delete edge"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      </EdgeLabelRenderer>
    </>
  );
}

export const edgeTypes = {
  labeled: LabeledEdge,
  animated: AnimatedEdge,
  deletable: DeletableEdge,
};
