import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, LayoutDashboard, FolderOpen, GitBranch, Table2, Database,
  Workflow, FlaskConical, Activity, Shield, Users, BarChart3, Settings,
  Sparkles, Bug, Globe, Code2, FileText, Layers, ArrowRight,
} from 'lucide-react';

interface CommandItem {
  id: string;
  label: string;
  description?: string;
  icon: React.ElementType;
  path: string;
  category: string;
  keywords?: string[];
}

const commands: CommandItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, path: '/', category: 'Navigation', keywords: ['home', 'overview'] },
  { id: 'projects', label: 'Projects', icon: FolderOpen, path: '/projects', category: 'Navigation', keywords: ['folder'] },
  { id: 'rule-sets', label: 'Rule Sets', icon: GitBranch, path: '/rule-sets', category: 'Navigation', keywords: ['rules', 'business logic'] },
  { id: 'decision-tables', label: 'Decision Tables', icon: Table2, path: '/decision-tables', category: 'Navigation', keywords: ['table', 'matrix'] },
  { id: 'data-models', label: 'Data Models', icon: Database, path: '/data-models', category: 'Navigation', keywords: ['schema', 'model'] },
  { id: 'workflows', label: 'Workflows', icon: Workflow, path: '/workflows', category: 'Navigation', keywords: ['bpmn', 'process'] },
  { id: 'test', label: 'Test Sandbox', icon: FlaskConical, path: '/test', category: 'Operations', keywords: ['execute', 'run', 'sandbox'] },
  { id: 'monitoring', label: 'Monitoring', icon: Activity, path: '/monitoring', category: 'Operations', keywords: ['logs', 'metrics'] },
  { id: 'debugger', label: 'Rule Debugger', icon: Bug, path: '/debugger', category: 'Operations', keywords: ['debug', 'trace'] },
  { id: 'analytics', label: 'Analytics', icon: BarChart3, path: '/analytics', category: 'Intelligence', keywords: ['charts', 'graphs'] },
  { id: 'copilot', label: 'Rule Copilot', icon: Sparkles, path: '/copilot', category: 'Intelligence', keywords: ['ai', 'generate', 'suggest'] },
  { id: 'audit', label: 'Audit Log', icon: Shield, path: '/audit', category: 'Compliance', keywords: ['history', 'trail'] },
  { id: 'environments', label: 'Environments', icon: Globe, path: '/environments', category: 'Platform', keywords: ['deploy', 'staging', 'production'] },
  { id: 'functions', label: 'Function Library', icon: Code2, path: '/functions', category: 'Platform', keywords: ['custom', 'code'] },
  { id: 'reports', label: 'Reports', icon: FileText, path: '/reports', category: 'Platform', keywords: ['generate', 'export'] },
  { id: 'batch', label: 'Batch Executor', icon: Layers, path: '/batch-execute', category: 'Operations', keywords: ['bulk', 'mass'] },
  { id: 'users', label: 'Team & SSO', icon: Users, path: '/users', category: 'Admin', keywords: ['team', 'invite', 'sso', 'ldap'] },
  { id: 'settings', label: 'Settings', icon: Settings, path: '/settings', category: 'Admin', keywords: ['config', 'preferences'] },
];

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  // Global keyboard shortcut: Cmd+K / Ctrl+K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
      }
      if (e.key === 'Escape' && open) {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open]);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const filtered = useMemo(() => {
    if (!query.trim()) return commands;
    const q = query.toLowerCase();
    return commands.filter(
      (cmd) =>
        cmd.label.toLowerCase().includes(q) ||
        cmd.category.toLowerCase().includes(q) ||
        cmd.description?.toLowerCase().includes(q) ||
        cmd.keywords?.some((k) => k.includes(q))
    );
  }, [query]);

  // Reset selection when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [filtered.length]);

  const handleSelect = (cmd: CommandItem) => {
    navigate(cmd.path);
    setOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && filtered[selectedIndex]) {
      handleSelect(filtered[selectedIndex]);
    }
  };

  if (!open) return null;

  // Group by category
  const grouped = filtered.reduce<Record<string, CommandItem[]>>((acc, cmd) => {
    if (!acc[cmd.category]) acc[cmd.category] = [];
    acc[cmd.category].push(cmd);
    return acc;
  }, {});

  let globalIndex = -1;

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center pt-[15vh]">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setOpen(false)} />
      <div className="relative w-full max-w-lg mx-4 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 border-b border-slate-200 dark:border-slate-700">
          <Search className="w-5 h-5 text-slate-400 flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search pages, actions..."
            className="flex-1 py-4 bg-transparent text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none"
          />
          <kbd className="hidden sm:inline-flex px-1.5 py-0.5 text-[10px] font-mono font-medium text-slate-400 bg-slate-100 dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-[50vh] overflow-y-auto py-2">
          {filtered.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-slate-500">
              No results found for "{query}"
            </div>
          ) : (
            Object.entries(grouped).map(([category, items]) => (
              <div key={category}>
                <div className="px-4 py-1.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                  {category}
                </div>
                {items.map((cmd) => {
                  globalIndex++;
                  const idx = globalIndex;
                  return (
                    <button
                      key={cmd.id}
                      onClick={() => handleSelect(cmd)}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                        selectedIndex === idx
                          ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300'
                          : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                      }`}
                    >
                      <cmd.icon className="w-4 h-4 flex-shrink-0" />
                      <span className="flex-1 text-left">{cmd.label}</span>
                      {selectedIndex === idx && (
                        <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                      )}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer hints */}
        <div className="px-4 py-2.5 border-t border-slate-200 dark:border-slate-700 flex items-center gap-4 text-[11px] text-slate-400">
          <span className="flex items-center gap-1">
            <kbd className="px-1 py-0.5 bg-slate-100 dark:bg-slate-800 rounded text-[10px] font-mono">↑↓</kbd> navigate
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1 py-0.5 bg-slate-100 dark:bg-slate-800 rounded text-[10px] font-mono">↵</kbd> select
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1 py-0.5 bg-slate-100 dark:bg-slate-800 rounded text-[10px] font-mono">esc</kbd> close
          </span>
        </div>
      </div>
    </div>
  );
}
