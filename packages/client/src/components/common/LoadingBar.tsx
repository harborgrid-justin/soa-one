import { useStore } from '../../store';

/**
 * Global loading bar at the top of the viewport.
 * Renders an animated indeterminate progress bar when isLoading is true.
 */
export function LoadingBar() {
  const { isLoading } = useStore();

  if (!isLoading) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[70] h-0.5">
      <div className="h-full bg-brand-500 animate-loading-bar" />
    </div>
  );
}
