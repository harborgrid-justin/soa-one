import { create } from 'zustand';
import type { Project, RuleSet, DashboardStats } from '../types';

interface AppState {
  // Current navigation
  sidebarOpen: boolean;
  toggleSidebar: () => void;

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

  // Notifications
  notifications: Notification[];
  addNotification: (notification: Omit<Notification, 'id'>) => void;
  removeNotification: (id: string) => void;
}

interface Notification {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  message: string;
}

let notifId = 0;

export const useStore = create<AppState>((set) => ({
  sidebarOpen: true,
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),

  currentProject: null,
  setCurrentProject: (project) => set({ currentProject: project }),

  currentRuleSet: null,
  setCurrentRuleSet: (ruleSet) => set({ currentRuleSet: ruleSet }),

  dashboardStats: null,
  setDashboardStats: (stats) => set({ dashboardStats: stats }),

  isLoading: false,
  setLoading: (loading) => set({ isLoading: loading }),

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
