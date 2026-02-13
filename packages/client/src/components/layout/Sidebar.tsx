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
  Workflow,
  Plug,
  Shield,
  Users,
  BarChart3,
  FlaskRound,
  Bell,
  AlertTriangle,
  ArrowDownUp,
  CheckSquare,
  Key,
  Clock,
  Store,
  ShieldCheck,
  Gauge,
  Globe,
  Code2,
  Search,
  Lock,
  FileText,
  Layers,
  Sparkles,
  Split,
  Target,
  Bug,
  RotateCcw,
  Package,
} from 'lucide-react';
import { useStore } from '../../store';

const navSections = [
  {
    label: 'Core',
    items: [
      { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
      { to: '/projects', icon: FolderOpen, label: 'Projects' },
      { to: '/rule-sets', icon: GitBranch, label: 'Rule Sets' },
      { to: '/decision-tables', icon: Table2, label: 'Decision Tables' },
      { to: '/data-models', icon: Database, label: 'Data Models' },
    ],
  },
  {
    label: 'Orchestration',
    items: [
      { to: '/workflows', icon: Workflow, label: 'Workflows' },
      { to: '/adapters', icon: Plug, label: 'Adapters' },
      { to: '/scheduled-jobs', icon: Clock, label: 'Scheduled Jobs' },
      { to: '/approvals', icon: CheckSquare, label: 'Approvals' },
    ],
  },
  {
    label: 'Intelligence',
    items: [
      { to: '/analytics', icon: BarChart3, label: 'Analytics' },
      { to: '/simulations', icon: FlaskRound, label: 'Simulations' },
      { to: '/copilot', icon: Sparkles, label: 'Rule Copilot' },
      { to: '/ab-testing', icon: Split, label: 'A/B Testing' },
      { to: '/impact-analysis', icon: Target, label: 'Impact Analysis' },
      { to: '/templates', icon: Store, label: 'Templates' },
    ],
  },
  {
    label: 'Operations',
    items: [
      { to: '/test', icon: FlaskConical, label: 'Test Sandbox' },
      { to: '/monitoring', icon: Activity, label: 'Monitoring' },
      { to: '/debugger', icon: Bug, label: 'Rule Debugger' },
      { to: '/replay', icon: RotateCcw, label: 'Execution Replay' },
      { to: '/decision-explorer', icon: Search, label: 'Decision Trace' },
      { to: '/batch-execute', icon: Layers, label: 'Batch Executor' },
      { to: '/audit', icon: Shield, label: 'Audit Log' },
      { to: '/notifications', icon: Bell, label: 'Notifications' },
      { to: '/api-docs', icon: Zap, label: 'API & Queue' },
      { to: '/import-export', icon: ArrowDownUp, label: 'Import / Export' },
    ],
  },
  {
    label: 'Platform',
    items: [
      { to: '/environments', icon: Globe, label: 'Environments' },
      { to: '/functions', icon: Code2, label: 'Function Library' },
      { to: '/permissions', icon: Lock, label: 'Permissions' },
      { to: '/reports', icon: FileText, label: 'Reports' },
      { to: '/compliance-packs', icon: Package, label: 'Compliance Packs' },
    ],
  },
  {
    label: 'Admin',
    items: [
      { to: '/users', icon: Users, label: 'Team & SSO' },
      { to: '/api-gateway', icon: Key, label: 'API Gateway' },
      { to: '/compliance', icon: ShieldCheck, label: 'Compliance' },
      { to: '/performance', icon: Gauge, label: 'Performance' },
    ],
  },
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
      <nav className="flex-1 py-2 px-3 overflow-y-auto">
        {navSections.map((section) => (
          <div key={section.label} className="mb-2">
            {sidebarOpen && (
              <div className="px-3 py-2 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                {section.label}
              </div>
            )}
            <div className="space-y-0.5">
              {section.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-150 ${
                      isActive
                        ? 'bg-brand-600/20 text-brand-300 font-medium'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800'
                    }`
                  }
                >
                  <item.icon className="w-[18px] h-[18px] flex-shrink-0" />
                  {sidebarOpen && <span>{item.label}</span>}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-slate-700/50">
        <NavLink
          to="/settings"
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
        >
          <Settings className="w-[18px] h-[18px] flex-shrink-0" />
          {sidebarOpen && <span>Settings</span>}
        </NavLink>
        {sidebarOpen && (
          <div className="mt-3 px-3 text-[10px] text-slate-600">
            v8.0.0
          </div>
        )}
      </div>
    </aside>
  );
}
