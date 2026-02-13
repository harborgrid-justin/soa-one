import { useEffect, useState } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { Bell, Search, Menu, Sun, Moon, Monitor } from 'lucide-react';
import { getNotificationCount } from '../../api/client';
import { Avatar } from '../common/Avatar';
import { useStore } from '../../store';

const pageTitles: Record<string, string> = {
  '/': 'Dashboard',
  '/projects': 'Projects',
  '/rule-sets': 'Rule Sets',
  '/decision-tables': 'Decision Tables',
  '/data-models': 'Data Models',
  '/workflows': 'Workflows',
  '/adapters': 'Integration Adapters',
  '/test': 'Test Sandbox',
  '/monitoring': 'Monitoring',
  '/audit': 'Audit Log',
  '/api-docs': 'API & Queue',
  '/users': 'User Management',
  '/settings': 'Settings',
  '/analytics': 'Analytics',
  '/simulations': 'What-If Simulations',
  '/notifications': 'Notifications',
  '/import-export': 'Import / Export',
  '/approvals': 'Approvals',
  '/api-gateway': 'API Gateway',
  '/scheduled-jobs': 'Scheduled Jobs',
  '/templates': 'Template Marketplace',
  '/compliance': 'Compliance & Regulatory',
  '/performance': 'Performance Monitor',
  // V7
  '/environments': 'Environments',
  '/functions': 'Function Library',
  '/decision-explorer': 'Decision Trace Explorer',
  '/permissions': 'Permission Manager',
  '/reports': 'Report Generator',
  '/batch-execute': 'Batch Executor',
  // V8
  '/copilot': 'Rule Copilot',
  '/ab-testing': 'A/B Testing',
  '/impact-analysis': 'Impact Analysis',
  '/debugger': 'Rule Debugger',
  '/replay': 'Execution Replay',
  '/compliance-packs': 'Compliance Packs',
};

const themeIcons = { light: Sun, dark: Moon, system: Monitor } as const;
const themeOrder: Array<'light' | 'dark' | 'system'> = ['light', 'dark', 'system'];

export function Header() {
  const location = useLocation();
  const basePath = '/' + (location.pathname.split('/')[1] || '');
  const title = pageTitles[basePath] || 'SOA One';
  const [unreadCount, setUnreadCount] = useState(0);
  const { toggleMobileSidebar, theme, setTheme } = useStore();

  useEffect(() => {
    getNotificationCount()
      .then((data) => setUnreadCount(data?.unread || 0))
      .catch(() => {});
    const interval = setInterval(() => {
      getNotificationCount()
        .then((data) => setUnreadCount(data?.unread || 0))
        .catch(() => {});
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const cycleTheme = () => {
    const idx = themeOrder.indexOf(theme);
    setTheme(themeOrder[(idx + 1) % themeOrder.length]);
  };

  const ThemeIcon = themeIcons[theme];

  return (
    <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between px-6">
      <div className="flex items-center gap-3">
        {/* Mobile hamburger */}
        <button
          onClick={toggleMobileSidebar}
          className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 lg:hidden"
        >
          <Menu className="w-5 h-5" />
        </button>
        <h1 className="text-lg font-semibold text-slate-900 dark:text-white">{title}</h1>
      </div>
      <div className="flex items-center gap-3">
        {/* Search bar with Cmd+K hint */}
        <button
          onClick={() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }))}
          className="hidden sm:flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600 transition-colors w-64 text-sm"
        >
          <Search className="w-4 h-4" />
          <span className="flex-1 text-left">Search...</span>
          <kbd className="px-1.5 py-0.5 bg-white dark:bg-slate-700 rounded text-[11px] font-mono border border-slate-200 dark:border-slate-600 text-slate-400">
            {navigator.platform.includes('Mac') ? '\u2318K' : 'Ctrl+K'}
          </kbd>
        </button>

        {/* Theme toggle */}
        <button
          onClick={cycleTheme}
          className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 transition-colors"
          title={`Theme: ${theme}`}
        >
          <ThemeIcon className="w-5 h-5" />
        </button>

        {/* Notifications */}
        <Link
          to="/notifications"
          className="relative p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 transition-colors"
        >
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-pulse-badge">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </Link>

        {/* User avatar */}
        <Avatar name="Admin User" size="sm" />
      </div>
    </header>
  );
}
