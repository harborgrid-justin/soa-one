import { create } from 'zustand';
import type { Project, RuleSet, DashboardStats } from '../types';

interface AppState {
  // Current navigation
  sidebarOpen: boolean;
  toggleSidebar: () => void;

  // Mobile sidebar
  mobileSidebarOpen: boolean;
  toggleMobileSidebar: () => void;
  closeMobileSidebar: () => void;

  // Theme
  theme: 'light' | 'dark' | 'system';
  setTheme: (theme: 'light' | 'dark' | 'system') => void;

  // Active project
  currentProject: Project | null;
  setCurrentProject: (project: Project | null) => void;

  // Active rule set
  currentRuleSet: RuleSet | null;
  setCurrentRuleSet: (ruleSet: RuleSet | null) => void;

  // Dashboard cache
  dashboardStats: DashboardStats | null;
  setDashboardStats: (stats: DashboardStats) => void;

  // UI state
  isLoading: boolean;
  setLoading: (loading: boolean) => void;

  // Confirm dialog
  confirmDialog: ConfirmDialogState | null;
  showConfirm: (dialog: ConfirmDialogState) => void;
  hideConfirm: () => void;

  // Notifications
  notifications: Notification[];
  addNotification: (notification: Omit<Notification, 'id'>) => void;
  removeNotification: (id: string) => void;
}

interface ConfirmDialogState {
  title: string;
  message: string;
  variant?: 'danger' | 'warning' | 'info';
  confirmLabel?: string;
  onConfirm: () => void;
}

interface Notification {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  message: string;
}

let notifId = 0;

function getInitialTheme(): 'light' | 'dark' | 'system' {
  const stored = localStorage.getItem('soa-theme');
  if (stored === 'light' || stored === 'dark' || stored === 'system') return stored;
  return 'system';
}

function applyTheme(theme: 'light' | 'dark' | 'system') {
  const root = document.documentElement;
  if (theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
  localStorage.setItem('soa-theme', theme);
}

// Apply theme on load
applyTheme(getInitialTheme());

// Listen for system theme changes
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  const theme = localStorage.getItem('soa-theme') as 'light' | 'dark' | 'system' | null;
  if (theme === 'system' || !theme) applyTheme('system');
});

export const useStore = create<AppState>((set) => ({
  sidebarOpen: true,
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),

  mobileSidebarOpen: false,
  toggleMobileSidebar: () => set((s) => ({ mobileSidebarOpen: !s.mobileSidebarOpen })),
  closeMobileSidebar: () => set({ mobileSidebarOpen: false }),

  theme: getInitialTheme(),
  setTheme: (theme) => {
    applyTheme(theme);
    set({ theme });
  },

  currentProject: null,
  setCurrentProject: (project) => set({ currentProject: project }),

  currentRuleSet: null,
  setCurrentRuleSet: (ruleSet) => set({ currentRuleSet: ruleSet }),

  dashboardStats: null,
  setDashboardStats: (stats) => set({ dashboardStats: stats }),

  isLoading: false,
  setLoading: (loading) => set({ isLoading: loading }),

  confirmDialog: null,
  showConfirm: (dialog) => set({ confirmDialog: dialog }),
  hideConfirm: () => set({ confirmDialog: null }),

  notifications: [],
  addNotification: (notification) =>
    set((s) => ({
      notifications: [
        ...s.notifications,
        { ...notification, id: String(++notifId) },
      ],
    })),
  removeNotification: (id) =>
    set((s) => ({
      notifications: s.notifications.filter((n) => n.id !== id),
    })),
}));
