import { Link } from 'react-router-dom';
import { Home, ArrowLeft, Search } from 'lucide-react';

export function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
      {/* Large 404 display */}
      <div className="relative mb-8">
        <div className="text-[120px] sm:text-[160px] font-bold text-slate-100 dark:text-slate-800 leading-none select-none">
          404
        </div>
        <div className="absolute inset-0 flex items-center justify-center">
          <Search className="w-16 h-16 text-slate-300 dark:text-slate-600" />
        </div>
      </div>

      <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
        Page not found
      </h1>
      <p className="text-slate-500 dark:text-slate-400 text-center max-w-md mb-8">
        The page you're looking for doesn't exist or has been moved.
        Check the URL or navigate back to the dashboard.
      </p>

      <div className="flex items-center gap-3">
        <button
          onClick={() => window.history.back()}
          className="btn-secondary"
        >
          <ArrowLeft className="w-4 h-4" />
          Go Back
        </button>
        <Link to="/" className="btn-primary">
          <Home className="w-4 h-4" />
          Dashboard
        </Link>
      </div>

      {/* Keyboard shortcut hint */}
      <p className="mt-8 text-xs text-slate-400">
        Press{' '}
        <kbd className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded text-[11px] font-mono border border-slate-200 dark:border-slate-700">
          Ctrl+K
        </kbd>{' '}
        to search for pages
      </p>
    </div>
  );
}
