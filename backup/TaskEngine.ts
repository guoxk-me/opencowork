import { BrowserWindow } from 'electron';
import { TaskPlanner } from '../planner/TaskPlanner';
import { PlanExecutor } from '../planner/PlanExecutor';
import { TakeoverManager } from './TakeoverManager';
import { AnyAction, Plan, generateId } from '../action/ActionSchema';

export enum TaskStatus {
  IDLE = 'idle',
  PLANNING = 'planning',
  EXECUTING = 'executing',
  PAUSED = 'paused',
  WAITING_CONFIRM = 'waiting_confirm',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

export interface TaskHandle {
  id: string;
  status: TaskStatus;
  plan?: Plan;
  progress: { current: number; total: number };
  createdAt: number;
  updatedAt: number;
}

export interface TakeoverContext {
  currentNode: any;
  completedActions: AnyAction[];
  pendingNodes: any[];
  aiContext: {
    currentTask: string;
    conversationHistory: any[];
    variables: Record<string, any>;
  };
}

export class TaskEngine {
  private planner: TaskPlanner;
  private executor: PlanExecutor;
  private _takeoverManager: TakeoverManager;
  private tasks: Map<string, TaskHandle> = new Map();
  private mainWindow: BrowserWindow | null = null;
  private previewWindow: BrowserWindow | null = null;

  constructor() {
    this.planner = new TaskPlanner();
    this.executor = new PlanExecutor();
    this._takeoverManager = new TakeoverManager();
  }

  setMainWindow(window: BrowserWindow | null): void {
    this.mainWindow = window;
  }

  setPreviewWindow(window: BrowserWindow | null): void {
    this.previewWindow = window;
  }

  async startTask(task: string, mainWindow?: BrowserWindow): Promise<TaskHandle> {
    if (mainWindow) {
      this.mainWindow = mainWindow;
    }

    const handle: TaskHandle = {
      id: generateId(),
      status: TaskStatus.PLANNING,
      progress: { current: 0, total: 0 },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    this.tasks.set(handle.id, handle);

    try {
      console.log(`[TaskEngine] Starting task ${handle.id}:`, task);

      const plan = await this.planner.plan(task, {});
      handle.plan = plan;
      handle.status = TaskStatus.EXECUTING;
      handle.progress = {
        current: 0,
        total: plan.nodes.filter((n) => n.type === 'action').length,
      };

      this.executePlan(handle.id);

      return handle;
    } catch (error: any) {
      console.error(`[TaskEngine] Failed to start task:`, error);
      handle.status = TaskStatus.FAILED;
      throw error;
    }
  }

  private async executePlan(handleId: string): Promise<void> {
    const handle = this.tasks.get(handleId);
    if (!handle || !handle.plan) return;

    try {
      for await (const event of this.executor.execute(handle.plan)) {
        switch (event.type) {
          case 'node_start':
            handle.progress.current++;
            this.sendToRenderer('task:nodeStart', event);
            break;
          case 'node_complete':
            this.sendToRenderer('task:nodeComplete', event);
            // 如果是 browser action，截图并发送到预览窗口
            if (event.node.action && event.node.action.type.startsWith('browser:')) {
              const screenshot = await this.executor.getScreenshot();
              if (screenshot) {
                this.sendToRenderer('preview:screenshot', { screenshot });
              }
            }
            break;
          case 'node_error':
            console.error(`[TaskEngine] Node error:`, event.error);
            this.sendToRenderer('task:error', event);
            break;
          case 'completed':
            handle.status = TaskStatus.COMPLETED;
            this.sendToRenderer('task:completed', { handleId, result: event.summary });
            break;
          case 'failed':
            handle.status = TaskStatus.FAILED;
            this.sendToRenderer('task:error', { handleId, error: event.error });
            break;
        }
        handle.updatedAt = Date.now();
      }
    } catch (error: any) {
      console.error(`[TaskEngine] Plan execution failed:`, error);
      handle.status = TaskStatus.FAILED;
    }
  }

  async pause(handleId: string): Promise<void> {
    const handle = this.tasks.get(handleId);
    if (handle) {
      this.executor.pause();
      handle.status = TaskStatus.PAUSED;
      console.log(`[TaskEngine] Task paused: ${handleId}`);
    }
  }

  async resume(handleId: string): Promise<void> {
    const handle = this.tasks.get(handleId);
    if (handle) {
      this.executor.resume();
      handle.status = TaskStatus.EXECUTING;
      console.log(`[TaskEngine] Task resumed: ${handleId}`);
    }
  }

  async takeover(handleId: string): Promise<TakeoverContext | null> {
    const handle = this.tasks.get(handleId);
    if (!handle) return null;

    await this.pause(handleId);

    return {
      currentNode: null,
      completedActions: [],
      pendingNodes: [],
      aiContext: {
        currentTask: '',
        conversationHistory: [],
        variables: {},
      },
    };
  }

  async resumeFromUser(handleId: string, action: AnyAction): Promise<void> {
    console.log(`[TaskEngine] Resuming from user action:`, action);
    await this.resume(handleId);
  }

  async cancel(handleId: string): Promise<void> {
    const handle = this.tasks.get(handleId);
    if (handle) {
      this.executor.pause();
      handle.status = TaskStatus.CANCELLED;
      console.log(`[TaskEngine] Task cancelled: ${handleId}`);
    }
  }

  getState(handleId: string): TaskHandle | null {
    return this.tasks.get(handleId) || null;
  }

  private sendToRenderer(channel: string, data: any): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send(channel, data);
    }
    if (this.previewWindow && !this.previewWindow.isDestroyed()) {
      this.previewWindow.webContents.send(channel, data);
    }
  }
}

export default TaskEngine;
