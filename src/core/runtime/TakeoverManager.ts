export enum TakeoverReason {
  USER_KEYPRESS = 'user_keypress',
  USER_CLICK = 'user_click',
  USER_MOUSE = 'user_mouse',
  USER_REMOTE = 'user_remote',
}

export interface TakeoverState {
  reason: TakeoverReason;
  timestamp: number;
  currentNode: any;
  completedActions: any[];
  pendingNodes: any[];
  aiContext: {
    currentTask: string;
    conversationHistory: any[];
    variables: Record<string, any>;
  };
}

export class TakeoverManager {
  private takeoverState: TakeoverState | null = null;
  private listeners: Set<(state: TakeoverState | null) => void> = new Set();

  triggerTakeover(reason: TakeoverReason, context: Partial<TakeoverState> = {}): void {
    console.log(`[TakeoverManager] Takeover triggered:`, reason);

    this.takeoverState = {
      reason,
      timestamp: Date.now(),
      currentNode: context.currentNode || null,
      completedActions: context.completedActions || [],
      pendingNodes: context.pendingNodes || [],
      aiContext: context.aiContext || {
        currentTask: '',
        conversationHistory: [],
        variables: {},
      },
    };

    this.notifyListeners();
  }

  resumeFromTakeover(action?: any): void {
    console.log(`[TakeoverManager] Resuming from takeover`);

    if (action) {
      console.log(`[TakeoverManager] User action:`, action);
    }

    this.takeoverState = null;
    this.notifyListeners();
  }

  getTakeoverState(): TakeoverState | null {
    return this.takeoverState;
  }

  isInTakeover(): boolean {
    return this.takeoverState !== null;
  }

  addListener(listener: (state: TakeoverState | null) => void): void {
    this.listeners.add(listener);
  }

  removeListener(listener: (state: TakeoverState | null) => void): void {
    this.listeners.delete(listener);
  }

  private notifyListeners(): void {
    this.listeners.forEach((listener) => listener(this.takeoverState));
  }
}

export default TakeoverManager;
