import { create } from 'zustand';

export interface OverviewSummary {
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  runningTasks: number;
  successRate: number;
  avgDurationMs: number;
  totalDurationMs: number;
}

export interface DailyStats {
  completed: number;
  failed: number;
  total: number;
}

export interface OverviewMetrics {
  summary: OverviewSummary;
  sourceStats: Record<string, number>;
  dailyStats: Record<string, DailyStats>;
  schedulerStats: {
    totalSchedules: number;
    activeSchedules: number;
  };
  imStats: {
    total: number;
    pending: number;
    completed: number;
    failed: number;
  };
}

interface OverviewState {
  metrics: OverviewMetrics | null;
  isLoading: boolean;
  error: string | null;
  dateRange: { start: number; end: number };

  setDateRange: (range: { start: number; end: number }) => void;
  loadMetrics: () => Promise<void>;
}

export const useOverviewStore = create<OverviewState>((set, get) => ({
  metrics: null,
  isLoading: false,
  error: null,
  dateRange: {
    start: Date.now() - 7 * 24 * 60 * 60 * 1000,
    end: Date.now(),
  },

  setDateRange: (range) => {
    set({ dateRange: range });
    get().loadMetrics();
  },

  loadMetrics: async () => {
    set({ isLoading: true, error: null });
    try {
      const { dateRange } = get();
      const response = await window.electron.invoke('overview:getMetrics', { dateRange });
      const payload = response?.data;
      if (response?.success && payload) {
        set({ metrics: payload });
      } else {
        throw new Error(response?.error || 'Failed to load metrics');
      }
    } catch (error: any) {
      console.error('[OverviewStore] loadMetrics error:', error);
      set({ error: error.message });
    } finally {
      set({ isLoading: false });
    }
  },
}));