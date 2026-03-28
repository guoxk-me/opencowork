import { create } from 'zustand';

export interface Message {
  id: string;
  role: 'user' | 'ai';
  content: string;
  timestamp: number;
}

export interface Task {
  id: string;
  status: 'idle' | 'planning' | 'executing' | 'paused' | 'waiting_confirm' | 'completed' | 'failed';
  description: string;
  progress: {
    current: number;
    total: number;
  };
  currentStep?: string;
  plan?: any;
}

interface TaskState {
  // Messages
  messages: Message[];
  addMessage: (message: Omit<Message, 'id' | 'timestamp'>) => void;
  clearMessages: () => void;

  // Task
  task: Task | null;
  setTask: (task: Task | null) => void;
  updateTaskProgress: (current: number, total: number) => void;
  updateTaskStatus: (status: Task['status']) => void;

  // Takeover
  isTakeover: boolean;
  setTakeover: (isTakeover: boolean) => void;

  // Plan viewer
  showPlanViewer: boolean;
  setShowPlanViewer: (show: boolean) => void;
}

export const useTaskStore = create<TaskState>((set) => ({
  // Messages
  messages: [],
  addMessage: (message) =>
    set((state) => ({
      messages: [
        ...state.messages,
        {
          ...message,
          id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          timestamp: Date.now(),
        },
      ],
    })),
  clearMessages: () => set({ messages: [] }),

  // Task
  task: null,
  setTask: (task) => set({ task }),
  updateTaskProgress: (current, total) =>
    set((state) => ({
      task: state.task ? { ...state.task, progress: { current, total } } : null,
    })),
  updateTaskStatus: (status) =>
    set((state) => ({
      task: state.task ? { ...state.task, status } : null,
    })),

  // Takeover
  isTakeover: false,
  setTakeover: (isTakeover) => set({ isTakeover }),

  // Plan viewer
  showPlanViewer: false,
  setShowPlanViewer: (show) => set({ showPlanViewer: show }),
}));
