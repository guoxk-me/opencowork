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
  error?: string;
}

export interface TaskLog {
  type: 'info' | 'success' | 'error' | 'step';
  message: string;
  timestamp: number;
}

export interface AskUserRequest {
  requestId: string;
  question: string;
  options?: string[];
  defaultResponse?: string;
  timeout: number;
}

interface TaskState {
  // Session
  sessionId: string | null;
  setSessionId: (id: string | null) => void;

  // Messages
  messages: Message[];
  addMessage: (message: Omit<Message, 'id' | 'timestamp'>) => void;
  clearMessages: () => void;
  setMessages: (messages: Message[]) => void;

  // Task
  task: Task | null;
  setTask: (task: Task | null) => void;
  updateTaskProgress: (current: number, total: number) => void;
  updateTaskStatus: (status: Task['status']) => void;
  updateCurrentStep: (step: string) => void;
  setTaskError: (error: string) => void;

  // Task Logs
  logs: TaskLog[];
  addLog: (log: Omit<TaskLog, 'timestamp'>) => void;
  clearLogs: () => void;

  // Takeover
  isTakeover: boolean;
  setTakeover: (isTakeover: boolean) => void;

  // Plan viewer
  showPlanViewer: boolean;
  setShowPlanViewer: (show: boolean) => void;

  // Ask User Dialog
  askUserRequest: AskUserRequest | null;
  setAskUserRequest: (request: AskUserRequest | null) => void;
  respondToAskUser: (answer: string) => void;

  // Preview Mode
  previewMode: 'sidebar' | 'detached';
  setPreviewMode: (mode: 'sidebar' | 'detached') => void;
}

export const useTaskStore = create<TaskState>((set) => ({
  // Session
  sessionId: null,
  setSessionId: (id) => set({ sessionId: id }),

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
  setMessages: (messages) => set({ messages }),

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
  updateCurrentStep: (step) =>
    set((state) => ({
      task: state.task ? { ...state.task, currentStep: step } : null,
    })),
  setTaskError: (error) =>
    set((state) => ({
      task: state.task ? { ...state.task, error } : null,
    })),

  // Task Logs
  logs: [],
  addLog: (log) =>
    set((state) => ({
      logs: [
        ...state.logs,
        {
          ...log,
          timestamp: Date.now(),
        },
      ],
    })),
  clearLogs: () => set({ logs: [] }),

  // Takeover
  isTakeover: false,
  setTakeover: (isTakeover) => set({ isTakeover }),

  // Plan viewer
  showPlanViewer: false,
  setShowPlanViewer: (show) => set({ showPlanViewer: show }),

  // Ask User Dialog
  askUserRequest: null,
  setAskUserRequest: (request) => set({ askUserRequest: request }),
  respondToAskUser: (answer) => {
    const request = useTaskStore.getState().askUserRequest;
    if (request && window.electron) {
      window.electron.invoke('ask:user:response', {
        requestId: request.requestId,
        answer,
        cancelled: false,
      });
    }
    set({ askUserRequest: null });
  },

  // Preview Mode
  previewMode: 'sidebar' as const,
  setPreviewMode: (mode: 'sidebar' | 'detached') => {
    set({ previewMode: mode });
    if (window.electron) {
      window.electron.invoke('preview:setMode', { mode });
    }
  },
}));