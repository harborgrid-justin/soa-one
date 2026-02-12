import { useEffect, useState } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { Bell, Search } from 'lucide-react';
import { getNotificationCount } from '../../api/client';

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
};

export function Header() {
  const location = useLocation();
  const basePath = '/' + (location.pathname.split('/')[1] || '');
  const title = pageTitles[basePath] || 'SOA One';
  const [unreadCount, setUnreadCount] = useState(0);

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

  return (
    <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">{title}</h1>
      </div>
      <div className="flex items-center gap-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search rules, projects..."
            className="input pl-10 w-64 bg-slate-50"
          />
        </div>
        <Link
          to="/notifications"
          className="relative p-2 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors"
        >
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </Link>
        <div className="w-8 h-8 rounded-full bg-brand-600 flex items-center justify-center text-white text-sm font-medium">
          A
        </div>
      </div>
    </header>
  );
}
