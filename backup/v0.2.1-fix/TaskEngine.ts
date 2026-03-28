import { BrowserWindow } from 'electron';
import { TaskPlanner } from '../planner/TaskPlanner';
import { PlanExecutor } from '../planner/PlanExecutor';
import { TakeoverManager } from './TakeoverManager';
import { Replanner, ReplanTrigger, ReplanRequest, ExecutionState } from '../planner/Replanner';
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
  private replanner: Replanner;
  private _takeoverManager: TakeoverManager;
  private tasks: Map<string, TaskHandle> = new Map();
  private mainWindow: BrowserWindow | null = null;
  private previewWindow: BrowserWindow | null = null;

  constructor() {
    this.planner = new TaskPlanner();
    this.executor = new PlanExecutor();
    this.replanner = new Replanner();
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

      // 正确 await 任务执行完成
      await this.executePlan(handle.id);

      return handle;
    } catch (error: any) {
      console.error(`[TaskEngine] Failed to start task:`, error);
      handle.status = TaskStatus.FAILED;
      this.sendToRenderer('task:error', { handleId: handle.id, error: error.message });
      throw error;
    }
  }

  private async executePlan(handleId: string): Promise<void> {
    const handle = this.tasks.get(handleId);
    if (!handle || !handle.plan) return;

    // 启动实时截图
    this.executor.startScreencast();

    try {
      for await (const event of this.executor.execute(handle.plan)) {
        switch (event.type) {
          case 'node_start':
            handle.progress.current++;
            // 如果是 ask:user action，设置状态为 waiting_confirm
            if (event.node.action?.type === 'ask:user') {
              handle.status = TaskStatus.WAITING_CONFIRM;
            }
            this.sendToRenderer('task:nodeStart', event);
            break;
          case 'node_complete':
            // 如果之前是 ask:user，恢复执行状态
            if (handle.status === TaskStatus.WAITING_CONFIRM) {
              handle.status = TaskStatus.EXECUTING;
            }
            this.sendToRenderer('task:nodeComplete', event);
            break;
          case 'node_error':
            console.error(`[TaskEngine] Node error:`, event.error);
            
            // 尝试使用 LLM 驱动的 Replanner 恢复
            const errorCode = event.error?.code || 'UNKNOWN';
            const isRecoverable = event.error?.recoverable ?? true;
            
            if (isRecoverable && handle.plan) {
              const executionState: ExecutionState = {
                currentNodeId: event.node?.id || '',
                completedNodes: [],
                pageUrl: event.node?.action?.type === 'browser:navigate' ? (event.node.action.params as any)?.url : undefined,
              };
              
              let retryCount = 0;
              let replanSuccess = false;
              
              while (retryCount < 3 && !replanSuccess) {
                const replanRequest: ReplanRequest = {
                  trigger: errorCode === 'SELECTOR_NOT_FOUND' ? ReplanTrigger.SELECTOR_INVALID : 
                          errorCode === 'NAVIGATION_ERROR' ? ReplanTrigger.NAVIGATION_ERROR :
                          ReplanTrigger.ACTION_FAILED,
                  failedNodeId: event.node?.id,
                  error: {
                    code: errorCode,
                    message: event.error?.message || 'Unknown error',
                    recoverable: isRecoverable,
                  },
                  executionState,
                  remainingPlan: handle.plan,
                };
                
                // 使用 LLM 决策的重试机制
                const replanResult = await this.replanner.decideWithRetry(replanRequest, retryCount);
                
                console.log(`[TaskEngine] Replan attempt ${retryCount + 1}:`, replanResult);
                
                if (replanResult.success && replanResult.canContinue) {
                  replanSuccess = true;
                  this.sendToRenderer('task:statusUpdate', { 
                    status: 'replanning', 
                    message: `正在重试 (${retryCount + 1}/3): ${replanResult.reason || '重新执行'}` 
                  });
                  
                  // 应用 modifiedNodes 到计划
                  if (replanResult.modifiedNodes) {
                    for (const mod of replanResult.modifiedNodes) {
                      const nodeIndex = handle.plan.nodes.findIndex(n => n.id === mod.nodeId);
                      if (nodeIndex !== -1) {
                        if (mod.retryCount === -1) {
                          // 跳过节点
                          handle.plan.nodes.splice(nodeIndex, 1);
                        } else if (mod.newSelector && handle.plan.nodes[nodeIndex].action) {
                          (handle.plan.nodes[nodeIndex].action.params as any).selector = mod.newSelector;
                        } else if (mod.newAction && handle.plan.nodes[nodeIndex].action) {
                          handle.plan.nodes[nodeIndex].action = mod.newAction;
                        }
                      }
                    }
                  }
                  
                  // 如果需要询问用户
                  if (replanResult.suggestions?.includes('ask_user')) {
                    handle.status = TaskStatus.WAITING_CONFIRM;
                    this.sendToRenderer('ask:user:request', {
                      requestId: `replan-${Date.now()}`,
                      question: '任务执行遇到问题，是否继续尝试？',
                      options: ['继续重试', '停止任务'],
                      defaultResponse: '继续重试',
                      timeout: 60000,
                    });
                    // 等待用户响应
                    await new Promise(resolve => {
                      const checkStatus = setInterval(() => {
                        if (handle.status !== TaskStatus.WAITING_CONFIRM) {
                          clearInterval(checkStatus);
                          resolve(null);
                        }
                      }, 100);
                    });
                  }
                  
                  break;
                } else {
                  retryCount++;
                  if (retryCount >= 3) {
                    break;
                  }
                }
              }
              
              if (replanSuccess) {
                continue;
              }
            }
            
            this.sendToRenderer('task:error', event);
            break;
          case 'completed':
            handle.status = TaskStatus.COMPLETED;
            console.log(`[TaskEngine] Task completed, sending event to renderer`);
            this.sendToRenderer('task:completed', { handleId, result: event.summary });
            break;
          case 'failed':
            handle.status = TaskStatus.FAILED;
            console.log(`[TaskEngine] Task failed, sending event to renderer`);
            this.sendToRenderer('task:error', { handleId, error: event.error });
            break;
        }
        handle.updatedAt = Date.now();
      }
    } catch (error: any) {
      console.error(`[TaskEngine] Plan execution failed:`, error);
      handle.status = TaskStatus.FAILED;
      this.sendToRenderer('task:error', { handleId, error: error.message || 'Unknown error' });
    } finally {
      // 停止实时截图
      this.executor.stopScreencast();
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
    console.log('[TaskEngine] sendToRenderer called:', {
      channel,
      mainWindowExists: !!this.mainWindow,
      mainWindowDestroyed: this.mainWindow?.isDestroyed(),
      previewWindowExists: !!this.previewWindow,
      data: JSON.stringify(data).substring(0, 100)
    });
    
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send(channel, data);
      console.log('[TaskEngine] Sent to mainWindow:', channel);
    } else {
      console.warn('[TaskEngine] mainWindow not available or destroyed!');
    }
    
    if (this.previewWindow && !this.previewWindow.isDestroyed()) {
      this.previewWindow.webContents.send(channel, data);
      console.log('[TaskEngine] Sent to previewWindow:', channel);
    }
  }
}

export default TaskEngine;
