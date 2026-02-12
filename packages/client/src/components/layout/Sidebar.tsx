import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  FolderOpen,
  GitBranch,
  Table2,
  Database,
  FlaskConical,
  Activity,
  Settings,
  ChevronLeft,
  Zap,
} from 'lucide-react';
import { useStore } from '../../store';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/projects', icon: FolderOpen, label: 'Projects' },
  { to: '/rule-sets', icon: GitBranch, label: 'Rule Sets' },
  { to: '/decision-tables', icon: Table2, label: 'Decision Tables' },
  { to: '/data-models', icon: Database, label: 'Data Models' },
  { to: '/test', icon: FlaskConical, label: 'Test Sandbox' },
  { to: '/monitoring', icon: Activity, label: 'Monitoring' },
  { to: '/api-docs', icon: Zap, label: 'API & Queue' },
];

export function Sidebar() {
  const { sidebarOpen, toggleSidebar } = useStore();

  return (
    <aside
      className={`fixed left-0 top-0 z-40 h-screen transition-all duration-300 ${
        sidebarOpen ? 'w-64' : 'w-[72px]'
      } bg-slate-900 text-white flex flex-col`}
    >
      {/* Logo */}
      <div className="flex items-center justify-between h-16 px-4 border-b border-slate-700/50">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center font-bold text-sm">
            S1
          </div>
          {sidebarOpen && (
            <div>
              <div className="font-semibold text-sm tracking-tight">SOA One</div>
              <div className="text-[10px] text-slate-400 uppercase tracking-wider">Rules Platform</div>
            </div>
          )}
        </div>
        <button
          onClick={toggleSidebar}
          className="p-1 rounded hover:bg-slate-700/50 text-slate-400 hover:text-white transition-colors"
        >
          <ChevronLeft className={`w-4 h-4 transition-transform ${!sidebarOpen ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-150 ${
                isActive
                  ? 'bg-brand-600/20 text-brand-300 font-medium'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`
            }
          >
            <item.icon className="w-5 h-5 flex-shrink-0" />
            {sidebarOpen && <span>{item.label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-slate-700/50">
        <NavLink
          to="/settings"
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
        >
          <Settings className="w-5 h-5 flex-shrink-0" />
          {sidebarOpen && <span>Settings</span>}
        </NavLink>
        {sidebarOpen && (
          <div className="mt-3 px-3 text-[10px] text-slate-600">
            v1.0.0
          </div>
        )}
      </div>
    </aside>
  );
}
