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
  X,
  Radio,
  Repeat,
  MessageSquare,
  Tags,
  Archive,
  Image,
  Inbox,
  Building2,
  Network,
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
    label: 'Service Bus',
    items: [
      { to: '/esb', icon: Radio, label: 'ESB Dashboard' },
      { to: '/esb/channels', icon: MessageSquare, label: 'Channels' },
      { to: '/esb/routes', icon: GitBranch, label: 'Routing' },
      { to: '/esb/transformers', icon: Repeat, label: 'Transformers' },
      { to: '/esb/sagas', icon: Workflow, label: 'Sagas' },
      { to: '/esb/monitoring', icon: Activity, label: 'ESB Monitor' },
    ],
  },
  {
    label: 'Content',
    items: [
      { to: '/cms', icon: FileText, label: 'CMS Dashboard' },
      { to: '/cms/documents', icon: FolderOpen, label: 'Documents' },
      { to: '/cms/search', icon: Search, label: 'Search' },
      { to: '/cms/workflows', icon: Workflow, label: 'Workflows' },
      { to: '/cms/taxonomies', icon: Tags, label: 'Taxonomies' },
      { to: '/cms/retention', icon: Archive, label: 'Retention' },
      { to: '/cms/security', icon: Shield, label: 'Security' },
      { to: '/cms/monitoring', icon: Activity, label: 'CMS Monitor' },
    ],
  },
  {
    label: 'Data Integration',
    items: [
      { to: '/di', icon: Database, label: 'DI Dashboard' },
      { to: '/di/connectors', icon: Plug, label: 'Connectors' },
      { to: '/di/pipelines', icon: GitBranch, label: 'Pipelines' },
      { to: '/di/cdc', icon: Radio, label: 'CDC' },
      { to: '/di/replication', icon: Layers, label: 'Replication' },
      { to: '/di/quality', icon: Shield, label: 'Quality' },
      { to: '/di/lineage', icon: Workflow, label: 'Lineage' },
      { to: '/di/catalog', icon: Search, label: 'Catalog' },
      { to: '/di/monitoring', icon: Activity, label: 'DI Monitor' },
    ],
  },
  {
    label: 'Data Quality',
    items: [
      { to: '/dqm', icon: ShieldCheck, label: 'DQM Dashboard' },
      { to: '/dqm/topics', icon: MessageSquare, label: 'Topics' },
      { to: '/dqm/queues', icon: Inbox, label: 'Queues' },
      { to: '/dqm/quality-rules', icon: Shield, label: 'Quality Rules' },
      { to: '/dqm/profiling', icon: Search, label: 'Profiling' },
      { to: '/dqm/cleansing', icon: Sparkles, label: 'Cleansing' },
      { to: '/dqm/matching', icon: GitBranch, label: 'Matching' },
      { to: '/dqm/scoring', icon: BarChart3, label: 'Scoring' },
      { to: '/dqm/monitoring', icon: Activity, label: 'DQM Monitor' },
    ],
  },
  {
    label: 'SOA Suite',
    items: [
      { to: '/soa', icon: Globe, label: 'SOA Dashboard' },
      { to: '/soa/services', icon: Globe, label: 'Services' },
      { to: '/soa/processes', icon: Workflow, label: 'BPEL Processes' },
      { to: '/soa/tasks', icon: Users, label: 'Human Tasks' },
      { to: '/soa/cep', icon: Zap, label: 'Event Processing' },
      { to: '/soa/b2b', icon: Building2, label: 'B2B Gateway' },
      { to: '/soa/apis', icon: Code2, label: 'API Gateway' },
      { to: '/soa/policies', icon: Shield, label: 'Policies & SLAs' },
      { to: '/soa/mesh', icon: Network, label: 'Service Mesh' },
      { to: '/soa/bam', icon: BarChart3, label: 'BAM' },
      { to: '/soa/monitoring', icon: Activity, label: 'SOA Monitor' },
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
  const { sidebarOpen, toggleSidebar, mobileSidebarOpen, closeMobileSidebar } = useStore();

  // Close mobile sidebar on navigation
  const handleNavClick = () => {
    if (mobileSidebarOpen) closeMobileSidebar();
  };

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className={`fixed left-0 top-0 z-40 h-screen transition-all duration-300 ${
          sidebarOpen ? 'w-64' : 'w-[72px]'
        } bg-slate-900 text-white flex-col hidden lg:flex`}
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
                    title={!sidebarOpen ? item.label : undefined}
                    className={({ isActive }) =>
                      `group relative flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-150 ${
                        isActive
                          ? 'bg-brand-600/20 text-brand-300 font-medium'
                          : 'text-slate-400 hover:text-white hover:bg-slate-800'
                      }`
                    }
                  >
                    <item.icon className="w-[18px] h-[18px] flex-shrink-0" />
                    {sidebarOpen && <span>{item.label}</span>}
                    {/* Collapsed tooltip */}
                    {!sidebarOpen && (
                      <span className="absolute left-full ml-2 px-2 py-1 bg-slate-800 text-white text-xs rounded-md whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50 shadow-lg">
                        {item.label}
                      </span>
                    )}
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
            title={!sidebarOpen ? 'Settings' : undefined}
            className="group relative flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
          >
            <Settings className="w-[18px] h-[18px] flex-shrink-0" />
            {sidebarOpen && <span>Settings</span>}
            {!sidebarOpen && (
              <span className="absolute left-full ml-2 px-2 py-1 bg-slate-800 text-white text-xs rounded-md whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50 shadow-lg">
                Settings
              </span>
            )}
          </NavLink>
          {sidebarOpen && (
            <div className="mt-3 px-3 text-[10px] text-slate-600">
              v8.0.0
            </div>
          )}
        </div>
      </aside>

      {/* Mobile sidebar drawer */}
      <aside
        className={`fixed left-0 top-0 z-40 h-screen w-72 bg-slate-900 text-white flex flex-col lg:hidden transition-transform duration-300 ${
          mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Mobile header */}
        <div className="flex items-center justify-between h-16 px-4 border-b border-slate-700/50">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center font-bold text-sm">
              S1
            </div>
            <div>
              <div className="font-semibold text-sm tracking-tight">SOA One</div>
              <div className="text-[10px] text-slate-400 uppercase tracking-wider">Rules Platform</div>
            </div>
          </div>
          <button
            onClick={closeMobileSidebar}
            className="p-1 rounded hover:bg-slate-700/50 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mobile navigation */}
        <nav className="flex-1 py-2 px-3 overflow-y-auto">
          {navSections.map((section) => (
            <div key={section.label} className="mb-2">
              <div className="px-3 py-2 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                {section.label}
              </div>
              <div className="space-y-0.5">
                {section.items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to === '/'}
                    onClick={handleNavClick}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-150 ${
                        isActive
                          ? 'bg-brand-600/20 text-brand-300 font-medium'
                          : 'text-slate-400 hover:text-white hover:bg-slate-800'
                      }`
                    }
                  >
                    <item.icon className="w-[18px] h-[18px] flex-shrink-0" />
                    <span>{item.label}</span>
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>

        {/* Mobile footer */}
        <div className="p-3 border-t border-slate-700/50">
          <NavLink
            to="/settings"
            onClick={handleNavClick}
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
          >
            <Settings className="w-[18px] h-[18px] flex-shrink-0" />
            <span>Settings</span>
          </NavLink>
          <div className="mt-3 px-3 text-[10px] text-slate-600">
            v8.0.0
          </div>
        </div>
      </aside>
    </>
  );
}
